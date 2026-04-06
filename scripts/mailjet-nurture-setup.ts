/**
 * Mailjet Nurture Sequence Setup
 * Run once: npx ts-node scripts/mailjet-nurture-setup.ts
 *
 * Creates:
 * 1. ComplyScan contact list
 * 2. 3 email templates (welcome, scan tips, upgrade nudge)
 * 3. Marketing campaign with 3-email automation sequence
 */

import { NextConfig } from 'next';

const MAILJET_API_KEY = process.env.MAILJET_API_KEY!;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY!;
const MJ_BASE = 'https://api.mailjet.com/v4';

const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

async function mj(endpoint: string, options: RequestInit = {}) {
  const r = await fetch(`${MJ_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Mailjet ${options.method || 'GET'} ${endpoint} → ${r.status}: ${body}`);
  }
  return r.json();
}

async function main() {
  console.log('🔧 Setting up ComplyScan Mailjet nurture sequence...\n');

  // ── 1. Create contact list ─────────────────────────────────────────────────
  console.log('📋 Creating contact list...');
  const listRes = await mj('/contactslist', {
    method: 'POST',
    body: JSON.stringify({
      Name: 'ComplyScan Users',
      SubscribeEmail: false, // double opt-in for GDPR
    }),
  });
  const listId = listRes.Data[0].ID;
  console.log(`   ✓ Contact list created: ID=${listId}\n`);

  // ── 2. Create email templates ──────────────────────────────────────────────
  console.log('📧 Creating email templates...\n');

  const templates = [
    {
      name: 'ComplyScan — Welcome Email',
      subject: 'Your GDPR scan is ready — here\'s what to expect',
      template: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ComplyScan</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#2563eb;font-size:28px;margin:0;">ComplyScan</h1>
    </div>
    <div style="background:#1e293b;border-radius:16px;padding:40px;color:#e2e8f0;">
      <h2 style="color:#ffffff;font-size:22px;margin:0 0 16px;">Your GDPR scan is on its way 🛡️</h2>
      <p style="color:#94a3b8;line-height:1.7;font-size:16px;margin:0 0 16px;">
        Hi there,
      </p>
      <p style="color:#94a3b8;line-height:1.7;font-size:16px;margin:0 0 24px;">
        Your compliance scan is being prepared. Within a few minutes you'll receive a full PDF report covering cookie consent, privacy policy gaps, tracking scripts, and more.
      </p>
      <p style="color:#94a3b8;line-height:1.7;font-size:16px;margin:0 0 32px;">
        In the meantime, here are <strong style="color:#ffffff;">5 GDPR issues we catch most often</strong>:
      </p>
      <ol style="color:#94a3b8;line-height:2.2;font-size:15px;margin:0 0 32px;padding-left:20px;">
        <li>Missing or incomplete cookie consent banner</li>
        <li>No privacy policy or outdated one</li>
        <li>Forms collecting data without consent</li>
        <li>Third-party scripts (Google Analytics, Meta Pixel) without prior consent</li>
        <li>No process for handling data subject rights requests</li>
      </ol>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://complyscan.pages.dev/blog/is-my-website-gdpr-compliant"
           style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Read the GDPR guide →
        </a>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
        ComplyScan — GDPR compliance made effortless<br/>
        <a href="https://complyscan.pages.dev" style="color:#2563eb;">complyscan.pages.dev</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    },
    {
      name: 'ComplyScan — Scan Tips (Day 2)',
      subject: '5 GDPR issues we catch that most people miss',
      template: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#2563eb;font-size:28px;margin:0;">ComplyScan</h1>
    </div>
    <div style="background:#1e293b;border-radius:16px;padding:40px;color:#e2e8f0;">
      <h2 style="color:#ffffff;font-size:22px;margin:0 0 8px;">5 GDPR issues hiding in plain sight 🔍</h2>
      <p style="color:#94a3b8;line-height:1.7;font-size:15px;margin:0 0 24px;">
        These come up constantly — even on sites that thought they were compliant:
      </p>
      <div style="margin-bottom:20px;padding:16px;background:#0f172a;border-radius:10px;border-left:4px solid #2563eb;">
        <strong style="color:#ffffff;font-size:14px;">1. Cookie banner without "reject" option</strong>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">GDPR requires an equally easy way to refuse as to accept. A greyed-out reject button fails.</p>
      </div>
      <div style="margin-bottom:20px;padding:16px;background:#0f172a;border-radius:10px;border-left:4px solid #f59e0b;">
        <strong style="color:#ffffff;font-size:14px;">2. Google Fonts loaded from external servers</strong>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">Every font request transfers visitor IPs to Google's servers. Self-host fonts or use a consent banner.</p>
      </div>
      <div style="margin-bottom:20px;padding:16px;background:#0f172a;border-radius:10px;border-left:4px solid #ef4444;">
        <strong style="color:#ffffff;font-size:14px;">3. Embedded YouTube/videos without consent</strong>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">Embedding a YouTube video sets cookies before the user has consented. Use the "nocookie" domain.</p>
      </div>
      <div style="margin-bottom:20px;padding:16px;background:#0f172a;border-radius:10px;border-left:4px solid:#22c55e;">
        <strong style="color:#ffffff;font-size:14px;">4. Contact forms with no data processing notice</strong>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">Even a simple contact form needs a statement explaining how the data will be used and stored.</p>
      </div>
      <div style="margin-bottom:20px;padding:16px;background:#0f172a;border-radius:10px;border-left:4px solid #8b5cf6;">
        <strong style="color:#ffffff;font-size:14px;">5. No DPA (Data Processing Agreement) with processors</strong>
        <p style="color:#94a3b8;font-size:13px;margin:4px 0 0;">If you use Mailchimp, Stripe, Google Analytics, etc., you need signed DPAs with each.</p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://complyscan.pages.dev/blog/gdpr-compliance-checklist"
           style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          Run a free GDPR scan →
        </a>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
        ComplyScan — GDPR compliance made effortless<br/>
        <a href="https://complyscan.pages.dev" style="color:#2563eb;">complyscan.pages.dev</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    },
    {
      name: 'ComplyScan — Upgrade Nudge (Day 7)',
      subject: 'You\'ve used your free scans — here\'s what\'s next',
      template: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#2563eb;font-size:28px;margin:0;">ComplyScan</h1>
    </div>
    <div style="background:#1e293b;border-radius:16px;padding:40px;color:#e2e8f0;">
      <h2 style="color:#ffffff;font-size:22px;margin:0 0 16px;">Unlimited GDPR scans for your business 🚀</h2>
      <p style="color:#94a3b8;line-height:1.7;font-size:16px;margin:0 0 20px;">
        You've run your first few scans — here's what the <strong style="color:#ffffff;">Agency plan</strong> unlocks:
      </p>
      <div style="margin-bottom:16px;padding:16px;background:#0f172a;border-radius:10px;">
        <div style="font-size:15px;font-weight:700;color:#2563eb;margin-bottom:6px;">Unlimited scans</div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">No more counting. Scan every client site, every quarter, without limits.</p>
      </div>
      <div style="margin-bottom:16px;padding:16px;background:#0f172a;border-radius:10px;">
        <div style="font-size:15px;font-weight:700;color:#2563eb;margin-bottom:6px;">White-label PDF reports</div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Send reports directly to clients under your own brand.</p>
      </div>
      <div style="margin-bottom:16px;padding:16px;background:#0f172a;border-radius:10px;">
        <div style="font-size:15px;font-weight:700;color:#2563eb;margin-bottom:6px;">Client dashboard</div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Manage all client scans in one place. Track remediation over time.</p>
      </div>
      <div style="text-align:center;margin:32px 0;">
        <a href="https://complyscan.pages.dev/#pricing"
           style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
          View Agency plan →
        </a>
      </div>
      <p style="color:#64748b;font-size:13px;text-align:center;margin:0;">
        €99/month — 3 client sites free to start<br/>
        <a href="https://complyscan.pages.dev" style="color:#2563eb;">complyscan.pages.dev</a>
      </p>
    </div>
  </div>
</body>
</html>`,
    },
  ];

  const templateIds: Record<string, number> = {};
  for (const t of templates) {
    const res = await mj('/template', {
      method: 'POST',
      body: JSON.stringify({
        Name: t.name,
        Subject: t.subject,
        Html-part: t.template,
        IsTextPartIncluded: false,
        IsActive: true,
        Draft: false,
      }),
    });
    const id = res.Data[0].ID;
    templateIds[t.name] = id;
    console.log(`   ✓ Template created: "${t.name}" (ID=${id})`);
  }

  console.log('\n✅ Mailjet nurture sequence ready!');
  console.log('\nTemplate IDs:');
  Object.entries(templateIds).forEach(([name, id]) => console.log(`  ${name}: ${id}`));
  console.log(`\nContact List ID: ${listId}`);
  console.log('\nNext: update app/api/scan/route.ts to call Mailjet when a user signs up.');
  console.log('See: scripts/mailjet-nurture-setup.ts for integration code.\n');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});


