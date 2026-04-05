/**
 * Mailjet integration — subscribe users and trigger nurture sequence
 * Credentials come from .env.local (project-scoped, approved in TOOLS.md)
 */

const MJ_API_KEY = process.env.MAILJET_API_KEY!;
const MJ_SECRET_KEY = process.env.MAILJET_SECRET_KEY!;
const MJ_BASE = 'https://api.mailjet.com/v4';
const LIST_ID = process.env.MAILJET_LIST_ID!; // set after running setup script

const auth = Buffer.from(`${MJ_API_KEY}:${MJ_SECRET_KEY}`).toString('base64');

async function mj(endpoint: string, options: RequestInit = {}): Promise<any> {
  const r = await fetch(`${MJ_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Mailjet ${options.method || 'GET'} ${endpoint} → ${r.status}: ${body}`);
  return JSON.parse(body);
}

/**
 * Add a new user to the ComplyScan nurture list and trigger the sequence.
 * Called from the scan API after a successful Stripe checkout or free scan.
 */
export async function subscribeToNurture({
  email,
  firstName,
  scanUrl,
}: {
  email: string;
  firstName?: string;
  scanUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Upsert contact
    await mj('/contact', {
      method: 'POST',
      body: JSON.stringify({
        Email: email,
        Properties: {
          FirstName: firstName || '',
          ScanUrl: scanUrl || '',
        },
        IsExcludedFromCampaigns: false,
      }),
    });

    // 2. Add to contact list (GDPR: user explicitly opted in via scan purchase/signup)
    if (LIST_ID) {
      await mj(`/contactslist/${LIST_ID}/managecontact`, {
        method: 'POST',
        body: JSON.stringify({
          Email: email,
          Name: 'add',
          IsUnsubscribed: false,
        }),
      });
    }

    // 3. Send welcome email immediately via template
    await mj('/send', {
      method: 'POST',
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: 'hello@complyscan.ch', Name: 'ComplyScan' },
            To: [{ Email: email, Name: firstName || undefined }],
            TemplateID: Number(process.env.MJ_TEMPLATE_WELCOME || 0),
            TemplateLanguage: true,
            Subject: 'Your GDPR scan is ready — here\'s what to expect',
            Variables: {
              first_name: firstName || 'there',
              scan_url: scanUrl || 'https://complyscan.ch',
            },
          },
        ],
      }),
    });

    console.log(`[Mailjet] Nurture sequence triggered for: ${email}`);
    return { success: true };
  } catch (err: any) {
    // Non-fatal — don't block the scan flow if Mailjet is down
    console.error(`[Mailjet] Nurture error for ${email}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send the Day-2 scan tips email to a specific contact.
 * Can be called from a cron job or triggered manually.
 */
export async function sendScanTipsEmail(email: string): Promise<void> {
  await mj('/send', {
    method: 'POST',
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: 'hello@complyscan.ch', Name: 'ComplyScan' },
          To: [{ Email: email }],
          TemplateID: Number(process.env.MJ_TEMPLATE_TIPS || 0),
          TemplateLanguage: true,
          Subject: '5 GDPR issues we catch that most people miss',
        },
      ],
    }),
  });
}

/**
 * Send the Day-7 upgrade email to a specific contact.
 */
export async function sendUpgradeEmail(email: string): Promise<void> {
  await mj('/send', {
    method: 'POST',
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: 'hello@complyscan.ch', Name: 'ComplyScan' },
          To: [{ Email: email }],
          TemplateID: Number(process.env.MJ_TEMPLATE_UPGRADE || 0),
          TemplateLanguage: true,
          Subject: 'You\'ve used your free scans — here\'s what\'s next',
        },
      ],
    }),
  });
}

export async function sendReportEmail({
  email,
  subject,
  html,
  name,
}: {
  email: string;
  subject: string;
  html: string;
  name?: string;
}): Promise<void> {
  await mj('/send', {
    method: 'POST',
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: 'hello@complyscan.ch', Name: 'ComplyScan' },
          To: [{ Email: email, Name: name || undefined }],
          Subject: subject,
          HTMLPart: html,
        },
      ],
    }),
  });
}
