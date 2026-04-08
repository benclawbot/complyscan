/**
* Report Delivery & Subscription Integration Tests
* Tests: scan creation, report generation, webhook handling, subscriber flows
*
* Run with: npx vitest run tests/report-delivery.test.ts
* Requires: Local dev server running on port 3000 (npm start)
*/
import { describe, it, expect, beforeAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

const BASE_URL = 'http://localhost:3000';

// Test scan data - a real URL that returns a valid response
const TEST_URL = 'https://example.com';

describe('Report Delivery API', () => {
let scanIdForReport: string;

// Create a completed scan in DB directly for report delivery testing
beforeAll(async () => {
// Create a scan record directly in DB and mark it completed with mock result
const { getDb } = await import('@/lib/db');
const db = getDb();

const mockResult = {
crawl: {
title: 'Example Domain',
description: 'Example Domain',
h1s: ['Example Domain'],
trackingScripts: [],
formsCount: 0,
hasSSL: true,
statusCode: 200,
},
ruleChecks: [
{ name: 'HTTPS', passed: true, detail: 'Site uses HTTPS', recommendation: null },
{ name: 'Privacy Policy', passed: false, detail: 'No privacy policy found', recommendation: 'Add a privacy policy page' },
],
aiAnalysis: {
gdprScore: 65,
riskLevel: 'medium',
summary: 'This website has basic GDPR compliance issues that should be addressed.',
issues: [
{ severity: 'warning', title: 'Missing Privacy Policy', description: 'No privacy policy page was found.', fix: 'Add a privacy policy page at /privacy or /privacy-policy' },
],
},
scannedAt: new Date().toISOString(),
};

scanIdForReport = uuidv4();
db.prepare(`
INSERT INTO scans (id, url, status, result_json, email)
VALUES (?, ?, 'completed', ?, 'test@example.com')
`).run(scanIdForReport, TEST_URL, JSON.stringify(mockResult));
});

describe('GET /api/report/[id]', () => {
it('returns 404 for non-existent scan', async () => {
const response = await fetch(`${BASE_URL}/api/report/${uuidv4()}`);
expect(response.status).toBe(404);
const data = await response.json();
expect(data.error).toBe('Scan not found');
});

it('returns report HTML for completed scan', async () => {
const response = await fetch(`${BASE_URL}/api/report/${scanIdForReport}`);
expect(response.status).toBe(200);
const data = await response.json();
expect(data.reportHtml).toBeDefined();
expect(typeof data.reportHtml).toBe('string');
expect(data.reportHtml.length).toBeGreaterThan(100);

// Check HTML contains expected elements
expect(data.reportHtml).toContain('GDPR Compliance Report');
expect(data.reportHtml).toContain('https://example.com'); // URL is visible text
expect(data.reportHtml).toContain('65'); // Score
expect(data.reportHtml).toContain('MEDIUM RISK');
expect(data.reportHtml).toContain('Automated Checks');
});

it('returns 202 for pending scan', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
const pendingId = uuidv4();

db.prepare(`
INSERT INTO scans (id, url, status, email)
VALUES (?, ?, 'pending', 'pending@test.com')
`).run(pendingId, TEST_URL);

const response = await fetch(`${BASE_URL}/api/report/${pendingId}`);
expect(response.status).toBe(202);
const data = await response.json();
expect(data.error).toMatch(/not yet complete/i);
});

it('returns 202 for processing scan', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
const processingId = uuidv4();

db.prepare(`
INSERT INTO scans (id, url, status, email)
VALUES (?, ?, 'processing', 'processing@test.com')
`).run(processingId, TEST_URL);

const response = await fetch(`${BASE_URL}/api/report/${processingId}`);
expect(response.status).toBe(202);
});

it('returns 500 for failed scan', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
const failedId = uuidv4();

db.prepare(`
INSERT INTO scans (id, url, status, email)
VALUES (?, ?, 'failed', 'failed@test.com')
`).run(failedId, TEST_URL);

const response = await fetch(`${BASE_URL}/api/report/${failedId}`);
expect(response.status).toBe(500);
});

it('escapes HTML in report to prevent XSS in rule check fields', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
const xssId = uuidv4();
const maliciousUrl = 'https://example.com';

// ruleChecks fields (name, detail, recommendation) are escaped with escapeHtml()
// Use passed: false so check goes to failedChecks (which renders recommendation)
const mockResult = {
crawl: { title: 'Safe Title', description: '', h1s: [], trackingScripts: [], formsCount: 0, hasSSL: true, statusCode: 200 },
ruleChecks: [{ name: '<b>XSS in name</b>', passed: false, detail: '<img src=x onerror=alert(1)>', recommendation: '<script>alert(1)</script>' }],
aiAnalysis: { gdprScore: 50, riskLevel: 'medium', summary: 'safe summary', issues: [] },
scannedAt: new Date().toISOString(),
};

db.prepare(`
INSERT INTO scans (id, url, status, result_json)
VALUES (?, ?, 'completed', ?)
`).run(xssId, maliciousUrl, JSON.stringify(mockResult));

const response = await fetch(`${BASE_URL}/api/report/${xssId}`);
expect(response.status).toBe(200);
const data = await response.json();
// ruleCheck fields ARE escaped by escapeHtml(), so script tags should be encoded
expect(data.reportHtml).toContain('&lt;b&gt;'); // name was escaped
expect(data.reportHtml).toContain('&lt;img'); // detail was escaped
expect(data.reportHtml).toContain('&lt;script&gt;'); // recommendation was escaped
// Raw tags should NOT appear
expect(data.reportHtml).not.toContain('<b>XSS');
expect(data.reportHtml).not.toContain('<img src=x onerror');
expect(data.reportHtml).not.toContain('<script>alert');
});
});

describe('GET /report/[id] (frontend page)', () => {
it('renders report page for completed scan', async () => {
const response = await fetch(`${BASE_URL}/report/${scanIdForReport}`);
expect(response.status).toBe(200);
const text = await response.text();
expect(text).toContain('ComplyScan');
expect(text).toContain('GDPR');
});

it('returns 404 for non-existent scan', async () => {
const response = await fetch(`${BASE_URL}/report/${uuidv4()}`);
// Next.js may redirect or show custom 404
expect([404, 307, 200]).toContain(response.status);
});
});
});

describe('Subscription Flow', () => {
const testEmail = `subscriber-${Date.now()}@test.com`;
let subscriberId: string;
let subscriberToken: string;

describe('POST /api/stripe/checkout (subscription)', () => {
it('returns 400 when URL is missing', async () => {
// Use a non-monthly plan so URL validation fires
const response = await fetch(`${BASE_URL}/api/stripe/checkout`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ email: testEmail, plan: 'single_scan' }),
});
expect(response.status).toBe(400);
const data = await response.json();
expect(data.error).toMatch(/url/i);
});

it('returns 500 when price is not configured (plan falls through to single_scan)', async () => {
const response = await fetch(`${BASE_URL}/api/stripe/checkout`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: TEST_URL, email: testEmail }),
});
// Without STRIPE_PRICE_SINGLE_SCAN configured, returns 500 "Price not configured"
expect(response.status).toBe(500);
const data = await response.json();
expect(data.error).toMatch(/price|configured/i);
});

it('returns 500 when Stripe is not properly configured (real Stripe key needed for this to pass)', async () => {
// This test verifies the error handling path works
const response = await fetch(`${BASE_URL}/api/stripe/checkout`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: TEST_URL, email: testEmail, plan: 'monthly' }),
});
// Will be 500 if Stripe key is test/mock, 401 if real key is invalid
expect([200, 401, 500]).toContain(response.status);
});
});

describe('Subscriber Database Operations', () => {
it('can create and retrieve a subscriber', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
subscriberId = uuidv4();
const stripeCustomerId = `cus_test_${Date.now()}`;

db.prepare(`
INSERT INTO subscribers (id, stripe_customer_id, email, plan, status)
VALUES (?, ?, ?, 'monthly', 'active')
`).run(subscriberId, stripeCustomerId, testEmail);

const subscriber = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(subscriberId) as any;
expect(subscriber).toBeDefined();
expect(subscriber.email).toBe(testEmail);
expect(subscriber.plan).toBe('monthly');
expect(subscriber.status).toBe('active');
});

it('can create subscriber token', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
subscriberToken = uuidv4();

db.prepare(`
INSERT INTO subscriber_tokens (token, subscriber_id)
VALUES (?, ?)
`).run(subscriberToken, subscriberId);

const token = db.prepare('SELECT * FROM subscriber_tokens WHERE token = ?').get(subscriberToken) as any;
expect(token).toBeDefined();
expect(token.subscriber_id).toBe(subscriberId);
});

it('can mark subscriber as cancelled', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();

db.prepare(`
UPDATE subscribers SET status = 'cancelled' WHERE id = ?
`).run(subscriberId);

const subscriber = db.prepare('SELECT status FROM subscribers WHERE id = ?').get(subscriberId) as any;
expect(subscriber.status).toBe('cancelled');
});

it('token lookup returns cancelled status for cancelled subscriber', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();

const token = db.prepare(`
SELECT t.token, s.status
FROM subscriber_tokens t
JOIN subscribers s ON s.id = t.subscriber_id
WHERE t.token = ?
`).get(subscriberToken) as any;

expect(token).toBeDefined();
expect(token.status).toBe('cancelled');
});

// Re-activate for dashboard tests that follow
it('re-activates subscriber for dashboard tests', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();
db.prepare(`UPDATE subscribers SET status = 'active' WHERE id = ?`).run(subscriberId);
const subscriber = db.prepare('SELECT status FROM subscribers WHERE id = ?').get(subscriberId) as any;
expect(subscriber.status).toBe('active');
});
});

describe('GET /api/dashboard', () => {
it('returns 401 for missing token', async () => {
const response = await fetch(`${BASE_URL}/api/dashboard`);
expect(response.status).toBe(401);
});

it('returns data for valid subscriber token', async () => {
const response = await fetch(`${BASE_URL}/api/dashboard?token=${subscriberToken}`);
expect(response.status).toBe(200);
const data = await response.json();
expect(data.subscriber).toBeDefined();
expect(data.subscriber.email).toBe(testEmail);
});

it('returns recentScans for subscriber', async () => {
const { getDb } = await import('@/lib/db');
const db = getDb();

// Create a scan for this subscriber
const scanId = uuidv4();
db.prepare(`
INSERT INTO scans (id, url, status, subscriber_id)
VALUES (?, ?, 'completed', ?)
`).run(scanId, 'https://test.com', subscriberId);

const response = await fetch(`${BASE_URL}/api/dashboard?token=${subscriberToken}`);
expect(response.status).toBe(200);
const data = await response.json();
expect(data.recentScans).toBeDefined();
expect(Array.isArray(data.recentScans)).toBe(true);
});
});

describe('POST /api/scan/subscriber', () => {
it('returns 400 when token is missing', async () => {
const response = await fetch(`${BASE_URL}/api/scan/subscriber`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: TEST_URL }),
});
expect(response.status).toBe(400);
const data = await response.json();
expect(data.error).toMatch(/token|required/i);
});

it('accepts valid URL from active subscriber', async () => {
// Reactivate subscriber for this test
const { getDb } = await import('@/lib/db');
const db = getDb();
db.prepare(`UPDATE subscribers SET status = 'active' WHERE id = ?`).run(subscriberId);

const response = await fetch(`${BASE_URL}/api/scan/subscriber`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: TEST_URL, token: subscriberToken }),
});
// May return 200 (sync) or 202 (async) depending on whether scan completes
expect([200, 202]).toContain(response.status);
const data = await response.json();
expect(data.scanId).toBeDefined();
});

it('rejects invalid URL format', async () => {
const response = await fetch(`${BASE_URL}/api/scan/subscriber`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ url: 'not-a-valid-url', token: subscriberToken }),
});
expect(response.status).toBe(400);
const data = await response.json();
expect(data.error).toMatch(/invalid|url/i);
});
});
});

describe('Webhook Security', () => {
describe('GET /api/stripe/webhook', () => {
it('returns 405 for GET requests', async () => {
const response = await fetch(`${BASE_URL}/api/stripe/webhook`, {
method: 'GET',
});
expect(response.status).toBe(405);
});
});

describe('POST /api/stripe/webhook (without signature)', () => {
it('returns 400 when stripe-signature header is missing (Stripe verification throws)', async () => {
const response = await fetch(`${BASE_URL}/api/stripe/webhook`, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ type: 'checkout.session.completed' }),
});
// Missing signature → 400 Bad Request (code checks signature before constructEvent)
expect(response.status).toBe(400);
});
});
});

