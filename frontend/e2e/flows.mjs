// Functional flows through the real UI, one per role. Run against a seeded local stack:
//   backend: python manage.py seed_data (DEBUG) + runserver; web: npm run build && npx next start
//   node e2e/flows.mjs . e2e-results [filter]
// Every API write is printed; a 4xx/5xx means the web app sent something the API rejects.
import { createRequire } from 'node:module';
import path from 'node:path';
const [, , FRONTEND, OUT, ONLY] = process.argv;
const require = createRequire(path.join(FRONTEND, 'package.json'));
const { chromium } = require('@playwright/test');

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8000/api/v1';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const summary = [];
let current = null; // the open session, so a failed flow can still be photographed

async function session(email, password) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const writes = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('response', async (r) => {
    const req = r.request();
    if (!r.url().startsWith(API) || req.method() === 'GET' || req.method() === 'OPTIONS') return;
    let body = '';
    if (r.status() >= 400) { try { body = (await r.text()).slice(0, 300); } catch { /* ignore */ } }
    writes.push({ method: req.method(), path: r.url().replace(API, ''), status: r.status(), body, sent: (req.postData() || '').slice(0, 300) });
  });
  await page.goto(`${BASE}/login`);
  await page.fill('[name="identifier"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  writes.length = 0;
  current = { page, ctx, writes, errors };
  return current;
}

async function flow(name, fn) {
  if (ONLY && !name.toLowerCase().includes(ONLY.toLowerCase())) return;
  let s;
  current = null;
  try {
    s = await fn();
    const bad = s.writes.filter((w) => w.status >= 400);
    const ok = s.writes.length > 0 && bad.length === 0 && s.errors.length === 0 && (s.check ?? true);
    summary.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    for (const w of s.writes) console.log(`        ${w.status} ${w.method} ${w.path}${w.status >= 400 ? `  <- ${w.body}\n          sent: ${w.sent}` : ''}`);
    if (s.writes.length === 0) console.log('        (no API write happened)');
    for (const e of s.errors) console.log(`        PAGE ERROR ${e}`);
    if (s.note) console.log(`        ${s.note}`);
    await s.page.screenshot({ path: `${OUT}/flow_${name.replace(/\W+/g, '_')}.png` });
  } catch (e) {
    summary.push({ name, ok: false });
    console.log(`FAIL  ${name} — ${String(e).split('\n')[0].slice(0, 200)}`);
    s = s ?? current;
    if (s?.page) {
      await s.page.screenshot({ path: `${OUT}/flow_${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
      for (const w of s.writes) console.log(`        ${w.status} ${w.method} ${w.path}${w.status >= 400 ? `  <- ${w.body}` : ''}`);
    }
  } finally {
    await (s ?? current)?.ctx?.close();
  }
}

// ── Parent requests a home visit ─────────────────────────────────────────────
await flow('parent requests a visit', async () => {
  const s = await session('parent@ikibondo.rw', 'parent123');
  const { page } = s;
  await page.goto(`${BASE}/parent/request-visit`);
  await page.waitForLoadState('networkidle');
  await page.getByText('Uwimana Jean').first().click();
  await page.getByText(/^Soon$/).first().click().catch(() => {});
  await page.getByPlaceholder(/Describe what you have noticed/).fill('Not eating well for two days');
  await page.getByRole('button', { name: /submit request/i }).click();
  await page.waitForTimeout(2000);
  return s;
});

// ── CHW accepts and completes it ─────────────────────────────────────────────
await flow('CHW accepts and completes a visit request', async () => {
  const s = await session('chw1@ikibondo.rw', 'chw123');
  const { page } = s;
  await page.goto(`${BASE}/chw/requests`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Accept', exact: true }).first().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^accepted/i }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  const complete = page.getByRole('button', { name: /mark (as )?complete|^complete$|complete visit/i }).first();
  if (await complete.isVisible().catch(() => false)) { await complete.click(); await page.waitForTimeout(1500); }
  s.note = `buttons now: ${(await page.getByRole('button').allInnerTexts()).filter((t) => /accept|complete|decline/i.test(t)).join(' | ')}`;
  return s;
});

// ── CHW records a visit online and sees the risk result ──────────────────────
await flow('CHW records a visit online', async () => {
  const s = await session('chw1@ikibondo.rw', 'chw123');
  const { page } = s;
  await page.goto(`${BASE}/chw/visit`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Ishimwe Pierre/ }).click();
  await page.getByRole('button', { name: /log visit/i }).first().click();
  await page.getByLabel('Weight (kg)').fill('6.9');
  await page.getByLabel('Height (cm)').fill('65');
  await page.getByLabel('MUAC (cm)').fill('13.1');
  await page.getByRole('button', { name: /save & get risk score/i }).click();
  await page.waitForTimeout(3000);
  const text = await page.locator('body').innerText();
  s.check = /LOW|MEDIUM|HIGH/.test(text) && !/Failed to save/i.test(text);
  s.note = `risk shown: ${(text.match(/\b(LOW|MEDIUM|HIGH)\b/) || ['none'])[0]}`;
  return s;
});

// ── Nurse records a measurement from the child page ──────────────────────────
await flow('nurse records a measurement', async () => {
  const s = await session('nurse@ikibondo.rw', 'nurse123');
  const { page } = s;
  await page.goto(`${BASE}/nurse/children`);
  await page.waitForLoadState('networkidle');
  await page.getByText('Ineza Aline').first().click();
  await page.waitForLoadState('networkidle');
  await page.getByText('Visit history', { exact: true }).click();
  await page.getByRole('button', { name: /record measurement/i }).first().click();
  await page.getByLabel('Weight (kg)').fill('4.6');
  await page.getByLabel('Height (cm)').fill('55');
  await page.getByLabel('MUAC (cm)').fill('12.8');
  await page.getByRole('button', { name: /^save$/i }).last().click();
  await page.waitForTimeout(2500);
  return s;
});

// ── Nurse creates and completes a referral ───────────────────────────────────
await flow('nurse creates and completes a referral', async () => {
  const s = await session('nurse@ikibondo.rw', 'nurse123');
  const { page } = s;
  await page.goto(`${BASE}/nurse/referrals`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /new referral/i }).click();
  await page.waitForTimeout(500);
  const childSelect = page.locator('select').first();
  if (await childSelect.isVisible().catch(() => false)) {
    const opts = await childSelect.locator('option').allInnerTexts();
    const pick = opts.findIndex((o) => /Ineza/.test(o));
    await childSelect.selectOption({ index: pick > 0 ? pick : 1 });
  }
  await page.getByPlaceholder(/Kigali University Hospital/).fill('Mahama Health Centre');
  await page.getByPlaceholder(/Clinical reason/).fill('Persistent fever and poor feeding');
  await page.getByRole('button', { name: /^(create|save|submit|refer)/i }).last().click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^complete/i }).first().click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder(/Outcome at receiving facility/).fill('Treated and discharged');
  await page.getByRole('button', { name: /record outcome|save/i }).last().click();
  await page.waitForTimeout(1500);
  return s;
});

// ── Supervisor opens a clinic session ────────────────────────────────────────
await flow('supervisor opens a clinic session', async () => {
  const s = await session('supervisor@ikibondo.rw', 'super123');
  const { page } = s;
  await page.goto(`${BASE}/supervisor/clinic-sessions`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /new session/i }).click();
  await page.waitForTimeout(800);
  const vaccine = page.locator('select').first();
  await vaccine.selectOption({ index: 1 }).catch(() => {});
  await page.getByRole('button', { name: /^(open|create|start)/i }).last().click();
  await page.waitForTimeout(1500);
  return s;
});

// ── Nurse records attendance in a vaccination session ────────────────────────
await flow('nurse records vaccination attendance', async () => {
  const s = await session('nurse@ikibondo.rw', 'nurse123');
  const { page } = s;
  await page.goto(`${BASE}/nurse/vaccines/session`);
  await page.waitForLoadState('networkidle');
  // Open a session for a dose that is due (seed: Ineza Aline, OPV1)
  await page.getByRole('button', { name: /new session/i }).click();
  await page.waitForTimeout(500);
  const vax = page.locator('select').filter({ has: page.locator('option', { hasText: 'OPV1' }) }).first();
  await vax.selectOption({ label: 'OPV1' }).catch(async () => {
    const opts = await vax.locator('option').allInnerTexts();
    await vax.selectOption({ index: opts.findIndex((o) => o.startsWith('OPV1')) });
  });
  await page.getByRole('button', { name: /^open session/i }).click();
  await page.waitForTimeout(1500);
  await page.getByText(/^OPV1$/).first().click();
  await page.waitForTimeout(1500);
  // Tap a child once to mark the dose given, then save
  await page.getByRole('button', { name: /Ineza Aline/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^save \(\d+\)/i }).click();
  await page.waitForTimeout(1500);
  return s;
});

// ── Admin creates a staff account ────────────────────────────────────────────
await flow('admin creates a staff account', async () => {
  const s = await session('admin@ikibondo.rw', 'admin123');
  const { page } = s;
  await page.goto(`${BASE}/admin/users`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /create staff account/i }).click();
  await page.waitForTimeout(500);
  await page.getByLabel(/full name/i).last().fill('Test Nurse Two');
  await page.getByLabel(/^email/i).last().fill(`nurse2.${Date.now()}@ikibondo.rw`);
  await page.getByLabel(/phone/i).last().fill(`+2507880${String(Date.now()).slice(-5)}`);
  const selects = page.locator('form select');
  await selects.nth(0).selectOption('NURSE').catch(() => {});
  await selects.nth(1).selectOption({ index: 1 }).catch(() => {});
  await page.getByRole('button', { name: /^create/i }).last().click();
  await page.waitForTimeout(2000);
  return s;
});

// ── Nurse registers a newborn with a new parent account ──────────────────────
await flow('nurse registers a newborn and parent', async () => {
  const s = await session('nurse@ikibondo.rw', 'nurse123');
  const { page } = s;
  await page.goto(`${BASE}/nurse/register`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /new parent account/i }).click();
  await page.getByLabel(/full name/i).first().fill('Mukamana Ange');
  await page.getByLabel(/phone/i).first().fill(`+25078${String(Date.now()).slice(-7)}`);
  await page.getByRole('button', { name: /next/i }).click();
  await page.waitForTimeout(800);
  await page.getByLabel('Full name').first().fill('Mukamana Teta');
  await page.getByRole('button', { name: 'Female', exact: true }).click();
  await page.getByRole('button', { name: /same as parent/i }).click();
  const rel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select relationship' }) });
  await rel.selectOption({ index: 1 });
  await page.getByRole('button', { name: /review & confirm/i }).click();
  await page.getByRole('button', { name: /register & link/i }).click();
  await page.waitForTimeout(3000);
  const body = await page.locator('main').innerText();
  s.check = /Child registered/i.test(body);
  s.note = /scan this code|sent to/i.test(body) ? 'set-password link panel shown' : 'no set-password panel';
  return s;
});

await browser.close();
console.log(`\n${summary.filter((x) => x.ok).length}/${summary.length} flows passed`);
