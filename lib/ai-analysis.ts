function getAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('No API key set (OPENAI_API_KEY, ANTHROPIC_AUTH_TOKEN, or MINIMAX_API_KEY)');
  }
  return {
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.minimax.io/v1',
  };
}

export interface AiAnalysisResult {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  issues: Array<{
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    fix: string;
  }>;
  positives: string[];
  gdprScore: number;
}

function validateResult(obj: unknown): obj is AiAnalysisResult {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.summary === 'string' &&
    ['low', 'medium', 'high'].includes(o.riskLevel as string) &&
    Array.isArray(o.issues) &&
    Array.isArray(o.positives) &&
    typeof o.gdprScore === 'number'
  );
}

function heuristicScoreFromChecks(ruleBasedChecks: any[]): number {
  const checks = Array.isArray(ruleBasedChecks) ? ruleBasedChecks : [];
  let score = 100;
  for (const c of checks) {
    if (c?.passed !== false) continue;
    const severity = String(c?.severity || '').toLowerCase();
    if (severity === 'critical') score -= 25;
    else if (severity === 'warning') score -= 10;
    else score -= 3;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function riskFromScore(score: number): AiAnalysisResult['riskLevel'] {
  if (score >= 75) return 'low';
  if (score >= 50) return 'medium';
  return 'high';
}

async function createChatCompletion(prompt: string): Promise<string> {
  const { apiKey, baseURL } = getAiConfig();
  const response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(data?.error?.message || `AI API request failed: ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content || '{}';
}

export async function analyzeWithAI(crawlResult: any, ruleBasedChecks: any[]): Promise<AiAnalysisResult> {
  const { securityHeaders, screenshots: _screenshots, ...rest } = crawlResult ?? {};
  void securityHeaders;

  function jsonEscape(val: unknown): unknown {
    if (typeof val === 'string') {
      return val
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .slice(0, 5000);
    }
    if (Array.isArray(val)) return val.map(jsonEscape);
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) out[k] = jsonEscape(v);
      return out;
    }
    return val;
  }

  const truncated = {
    ...rest,
    html: rest.html ? rest.html.substring(0, 1500) + '...[truncated]' : '',
    screenshots: [],
  };
  const escaped = jsonEscape(truncated) as typeof truncated;

  const prompt = `You are a GDPR compliance expert. Analyze this website scan data and provide a structured GDPR compliance assessment.

SCAN DATA:
${JSON.stringify(escaped, null, 2)}

RULE-BASED CHECKS ALREADY PERFORMED:
${JSON.stringify(ruleBasedChecks, null, 2)}

Return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of compliance posture",
  "riskLevel": "low | medium | high",
  "issues": [
    {
      "title": "Issue title",
      "description": "What the problem is and why it matters under GDPR",
      "severity": "critical | warning | info",
      "fix": "Specific action to fix this issue"
    }
  ],
  "positives": ["List of things done well from a GDPR perspective"],
  "gdprScore": 0-100
}

Be specific. Generic advice is not helpful. Focus on actionable fixes.`;

  const fallbackScore = heuristicScoreFromChecks(ruleBasedChecks);
  const fallbackRisk = riskFromScore(fallbackScore);

  let content = '';
  try {
    content = await createChatCompletion(prompt);
  } catch {
    return {
      summary: 'AI analysis unavailable. Showing rule-based score only.',
      riskLevel: fallbackRisk,
      issues: [],
      positives: [],
      gdprScore: fallbackScore,
    };
  }
  content = content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  content = content.replace(/<think>[\s\S]*?<\/thinking>/gi, '').trim();
  content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) content = jsonMatch[0];

  content = content.replace(/\\u([0-9a-fA-F](?![0-9a-fA-F]{3}))/g, (_, c) => c);
  content = content.replace(/,(\s*[}\]])/g, '$1');
  content = content.replace(/[\x00-\x1F\x7F]/g, '');

  function repairJson(raw: string): string {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (!inString) {
        if (ch === '"') {
          inString = true;
          result += ch;
        } else if (ch === '\\' && raw[i + 1] === '"') {
          result += raw[i + 1];
          i += 2;
          continue;
        } else {
          result += ch;
        }
      } else {
        if (ch === '\\') {
          const next = raw[i + 1];
          if (next === '"' || next === '\\' || next === '/' || next === 'n' || next === 'r' || next === 't' || next === 'u') {
            result += ch + next;
            i += 2;
            continue;
          }
          result += ch;
          i++;
          continue;
        }
        if (ch === '"') {
          inString = false;
          result += ch;
        } else {
          result += ch;
        }
      }
      i++;
    }
    return result;
  }

  content = repairJson(content);

  let needsTruncationRepair = false;
  try {
    JSON.parse(content);
  } catch {
    const lastChar = content.trim().slice(-1);
    needsTruncationRepair = (
      (content.match(/\{/g) || []).length > (content.match(/\}/g) || []).length ||
      (content.match(/\[/g) || []).length > (content.match(/\]/g) || []).length ||
      (lastChar !== '"' && lastChar !== '}' && lastChar !== ']')
    );
  }

  if (needsTruncationRepair) {
    let repaired = content.trim();
    const lastPropMatch = repaired.match(/("[\w]+":\s*(?:"[^"]*"|[\d.]+|true|false|null|\{[^}]*\}|\[[^\]]*\])(?=\s*,\s*"[\w]+"))/);
    let truncateAt = repaired.length;

    if (lastPropMatch) {
      const lastCompleteProp = lastPropMatch[0];
      const propEndIdx = repaired.lastIndexOf(lastCompleteProp) + lastCompleteProp.length;
      const commaAfter = repaired.indexOf(',', propEndIdx);
      truncateAt = commaAfter > 0 ? commaAfter + 1 : propEndIdx;
    } else {
      const allMatches = [...repaired.matchAll(/("[\w]+":\s*"[^"\\]*(?:\\.[^"\\]*)*")/g)];
      if (allMatches.length > 0) {
        const last = allMatches[allMatches.length - 1];
        const afterLast = repaired.indexOf('"', (last.index ?? 0) + last[0].length);
        if (afterLast > 0) truncateAt = afterLast + 1;
      }
    }

    repaired = repaired.substring(0, truncateAt);
    if (!repaired.includes('"issues"')) repaired += '"issues": []';
    if (!repaired.includes('"positives"')) repaired += ',"positives": []';
    if (!repaired.includes('"riskLevel"')) repaired += `,"riskLevel": "${fallbackRisk}"`;
    if (!repaired.includes('"gdprScore"')) repaired += `,"gdprScore": ${fallbackScore}`;

    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
    content = repaired;
  }

  let parsed: AiAnalysisResult;
  try {
    parsed = JSON.parse(content) as AiAnalysisResult;
  } catch (parseErr: unknown) {
    const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    const summaryMatch = content.match(/"summary"\s*:\s*"([^"\\]*(\\.[^"\\]*)*)"/);
    const scoreMatch = content.match(/"gdprScore"\s*:\s*(\d+)/);
    if (summaryMatch || scoreMatch) {
      parsed = {
        summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"').substring(0, 2000) : 'AI analysis unavailable. Please try again.',
        gdprScore: scoreMatch ? Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10))) : fallbackScore,
        riskLevel: fallbackRisk,
        issues: [],
        positives: [],
      };
    } else {
      console.error(`AI response JSON parse failed: ${errMsg} | content preview: ${content.substring(0, 300)}`);
      return {
        summary: 'AI analysis unavailable. Showing rule-based score only.',
        riskLevel: fallbackRisk,
        issues: [],
        positives: [],
        gdprScore: fallbackScore,
      };
    }
  }

  if (!validateResult(parsed)) {
    console.error(`AI response validation failed — missing required fields. Got: ${JSON.stringify(Object.keys(parsed || {}))}`);
    return {
      summary: 'AI analysis unavailable. Showing rule-based score only.',
      riskLevel: fallbackRisk,
      issues: [],
      positives: [],
      gdprScore: fallbackScore,
    };
  }

  return parsed;
}
