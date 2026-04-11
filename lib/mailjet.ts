/**
 * Mailjet integration — subscribe users and trigger nurture sequence
 */

type MailjetVersion = 'v3' | 'v3.1';

type MailjetConfig = {
  apiKey: string;
  secretKey: string;
  listId?: string;
};

function getMailjetConfig(): MailjetConfig {
  const apiKey = process.env.MAILJET_API_KEY?.trim() || '';
  const secretKey = process.env.MAILJET_SECRET_KEY?.trim() || '';
  const listId = process.env.MAILJET_LIST_ID?.trim() || undefined;

  if (!apiKey || !secretKey) {
    throw new Error('Mailjet credentials are not configured');
  }

  return { apiKey, secretKey, listId };
}

async function mj(endpoint: string, options: RequestInit = {}, version: MailjetVersion = 'v3'): Promise<any> {
  const { apiKey, secretKey } = getMailjetConfig();
  const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

  const r = await fetch(`https://api.mailjet.com/${version}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await r.text();
  if (!r.ok) {
    throw new Error(`Mailjet ${options.method || 'GET'} ${version}${endpoint} → ${r.status}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}

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
    const { listId } = getMailjetConfig();

    await mj('/REST/contact', {
      method: 'POST',
      body: JSON.stringify({
        Email: email,
        Properties: {
          FirstName: firstName || '',
          ScanUrl: scanUrl || '',
        },
        IsExcludedFromCampaigns: false,
      }),
    }, 'v3');

    if (listId) {
      await mj(`/REST/contactslist/${listId}/managecontact`, {
        method: 'POST',
        body: JSON.stringify({
          Email: email,
          Name: 'add',
          IsUnsubscribed: false,
        }),
      }, 'v3');
    }

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
              scan_url: scanUrl || (process.env.NEXT_PUBLIC_APP_URL || 'https://complyscan.pages.dev'),
            },
          },
        ],
      }),
    }, 'v3.1');

    console.log(`[Mailjet] Nurture sequence triggered for: ${email}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Mailjet] Nurture error for ${email}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

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
  }, 'v3.1');
}

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
  }, 'v3.1');
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
  }, 'v3.1');
}
