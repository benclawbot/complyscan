#!/usr/bin/env node
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3100';

function isJsonResponse(r) {
  return (r.headers.get('content-type') || '').includes('application/json');
}

async function readJsonish(r) {
  const t = await r.text();
  try { return { text: t, json: JSON.parse(t) }; } catch { return { text: t, json: null }; }
}

const tests = [
  {
    name: 'GET / returns homepage',
    run: async () => {
      const r = await fetch(`${BASE_URL}/`);
      return { pass: r.status === 200, detail: `status=${r.status}` };
    },
  },
  {
    name: 'GET /api/health returns ok',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/health`);
      const { text, json } = await readJsonish(r);
      const pass = r.status === 200 && isJsonResponse(r) && (json?.ok === true || text.includes('ok'));
      return { pass, detail: `status=${r.status} body=${text.slice(0,120)}` };
    },
  },
  {
    name: 'GET /api/auth/me unauthenticated',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/auth/me`);
      const { text } = await readJsonish(r);
      return { pass: r.status === 401 && text.includes('authenticated'), detail: `status=${r.status} body=${text.slice(0,120)}` };
    },
  },
  {
    name: 'POST /api/scan/free validation (missing URL)',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/scan/free`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'qa@example.com' }),
      });
      const { text } = await readJsonish(r);
      return { pass: r.status === 400 && text.includes('URL is required'), detail: `status=${r.status} body=${text.slice(0,160)}` };
    },
  },
  {
    name: 'POST /api/scan/free success path',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/scan/free`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', email: `qa-${Date.now()}@example.com` }),
      });
      const { text, json } = await readJsonish(r);
      const pass = r.status === 200 && isJsonResponse(r) && typeof json?.scanId === 'string';
      return { pass, detail: `status=${r.status} body=${text.slice(0,200)}` };
    },
  },
  {
    name: 'POST /api/stripe/checkout returns success/correct config error',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/stripe/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly', email: 'qa@example.com' }),
      });
      const { text, json } = await readJsonish(r);
      const passSuccess = r.status === 200 && typeof json?.url === 'string';
      const passConfigError = r.status === 500 && /not configured|price/i.test(text);
      return { pass: passSuccess || passConfigError, detail: `status=${r.status} body=${text.slice(0,200)}` };
    },
  },
  {
    name: 'GET /api/stripe/session handles unknown session with JSON error',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/stripe/session?session_id=missing_${Date.now()}`);
      const { text } = await readJsonish(r);
      const pass = isJsonResponse(r) && (r.status === 200 || r.status === 500) && text.length > 0;
      return { pass, detail: `status=${r.status} body=${text.slice(0,200)}` };
    },
  },
  {
    name: 'GET /api/dashboard unauthenticated',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/dashboard`);
      const { text } = await readJsonish(r);
      return { pass: r.status === 401 && /token required|invalid token/i.test(text), detail: `status=${r.status} body=${text.slice(0,160)}` };
    },
  },
  {
    name: 'GET /api/scan/user unauthenticated',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/scan/user`);
      const { text } = await readJsonish(r);
      return { pass: r.status === 401 && /token required|invalid token|unauthorized/i.test(text), detail: `status=${r.status} body=${text.slice(0,160)}` };
    },
  },
  {
    name: 'GET /api/scan/subscriber unauthenticated',
    run: async () => {
      const r = await fetch(`${BASE_URL}/api/scan/subscriber`);
      const { text } = await readJsonish(r);
      return { pass: r.status === 401 && /token required|invalid token|invalid or expired/i.test(text), detail: `status=${r.status} body=${text.slice(0,160)}` };
    },
  },
];

(async () => {
  console.log(`Running exhaustive route smoke suite against ${BASE_URL}\n`);
  let passCount = 0;
  for (const t of tests) {
    try {
      const res = await t.run();
      if (res.pass) {
        passCount += 1;
        console.log(`PASS  ${t.name}`);
      } else {
        console.log(`FAIL  ${t.name}`);
      }
      console.log(`      ${res.detail}`);
    } catch (e) {
      console.log(`ERROR ${t.name}`);
      console.log(`      ${String(e)}`);
    }
  }
  console.log(`\nSummary: ${passCount}/${tests.length} passed`);
  process.exit(passCount === tests.length ? 0 : 1);
})();


