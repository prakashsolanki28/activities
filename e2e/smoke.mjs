// Smoke walk: employee flows for both seeded activities + every admin page.
// Usage: node e2e/smoke.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? '.impeccable/review';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@hrrl.local', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe-2026!' };
const errors = [];
const stamp = Date.now().toString().slice(-5);

const browser = await chromium.launch();
async function page(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  // 401 (signed-out probe) and 403 (held leaderboard) are expected answers, not faults.
  p.on('console', (m) => m.type() === 'error' && !/status of 40[13]/.test(m.text()) && errors.push(`[console] ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  p.on('response', (r) => r.status() >= 500 && errors.push(`[${r.status()}] ${r.url()}`));
  return p;
}
async function adminCookie() {
  const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) });
  return r.headers.get('set-cookie').split(';')[0];
}
async function adminResults(slug, action) {
  const cookie = await adminCookie();
  const list = await (await fetch(`${base}/api/admin/activities`, { headers: { cookie } })).json();
  const id = list.find((a) => a.slug === slug)._id;
  const r = await fetch(`${base}/api/admin/activities/${id}/results/${action}`, { method: 'POST', headers: { cookie } });
  if (!r.ok) throw new Error(`${action} results failed: ${r.status}`);
}
const adminPublishResults = (slug) => adminResults(slug, 'publish');
// Start from the default: results held until an admin publishes them.
await adminResults('spot-the-phish', 'hide');
const shot = (p, name, full = false) => p.screenshot({ path: `${out}/${name}.png`, fullPage: full, animations: 'disabled' });
const step = (label) => console.log(`• ${label}`);

// ---------- Employee: Spot the Phish (end review, free navigation) ----------
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(`${base}/a/spot-the-phish`);
  await p.getByRole('heading', { name: /Spot the Phish/ }).waitFor();
  await shot(p, 'desktop-entry');
  step('entry page');
  await p.getByLabel('Full name').fill('Ravi Kumar');
  await p.getByLabel('Employee ID').fill(`E${stamp}1`);
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByText('Your resume code').waitFor();
  await shot(p, 'desktop-briefing');
  step('briefing');
  await p.getByRole('button', { name: 'Start activity' }).click();
  await p.getByRole('heading', { level: 2 }).first().waitFor();
  await p.waitForTimeout(400);
  await shot(p, 'desktop-player');
  step('player');
  // Answer the first five questions with option 2, then jump to review.
  for (let i = 0; i < 5; i++) {
    const opts = p.locator('fieldset label');
    if (await opts.count()) await opts.nth(Math.min(1, (await opts.count()) - 1)).click();
    else if (await p.getByRole('radio', { name: /No/ }).count()) await p.getByRole('radio', { name: /No/ }).click();
    await p.waitForTimeout(150);
    await p.getByRole('button', { name: /^Next/ }).click();
    await p.waitForTimeout(250);
  }
  await shot(p, 'desktop-player-q6');
  // Jump to the end via the progress track.
  const cells = p.getByRole('navigation', { name: 'Progress' }).getByRole('button');
  await cells.last().click();
  await p.getByRole('button', { name: /Review answers/ }).click();
  await p.getByRole('heading', { name: 'Review before you submit' }).waitFor();
  await shot(p, 'desktop-review', true);
  step('review');
  await p.getByRole('button', { name: 'Submit answers' }).click();
  await p.getByRole('button', { name: 'Submit', exact: true }).click();
  // Results are held by default: the employee sees "Submitted" until an admin publishes.
  await p.getByRole('heading', { name: /^Submitted\./ }).waitFor();
  await shot(p, 'desktop-result-held');
  await p.goto(`${base}/a/spot-the-phish/leaderboard`);
  await p.getByText('Results are not published yet').waitFor();
  step('results held');
  await adminPublishResults('spot-the-phish');
  await p.goto(`${base}/a/spot-the-phish/result`);
  await p.getByRole('heading', { name: /Case closed/ }).waitFor();
  await p.waitForTimeout(800);
  await shot(p, 'desktop-result');
  await shot(p, 'desktop-result-full', true);
  step('result');
  await p.goto(`${base}/a/spot-the-phish/leaderboard`);
  await p.getByRole('table').waitFor();
  await shot(p, 'desktop-leaderboard');
  await p.goto(`${base}/a/spot-the-phish/leaderboard?display=1`);
  await p.waitForTimeout(1200);
  await shot(p, 'desktop-projector');
  step('leaderboard + projector');
  if (process.env.CERT) {
    await p.goto(`${base}/c/${process.env.CERT}`);
    await p.getByRole('heading', { level: 1 }).waitFor();
    await shot(p, 'desktop-certificate');
    step('certificate');
  }
  await p.context().close();
}

// ---------- Employee: Treasure hunt (one at a time, results held) on a phone ----------
{
  const p = await page({ width: 390, height: 844 });
  await p.goto(`${base}/a/cyber-treasure-hunt`);
  await p.getByRole('heading', { name: /Treasure Hunt/ }).waitFor();
  await shot(p, 'mobile-entry');
  await p.getByLabel('Full name').fill('Anita Sharma');
  await p.getByLabel('Employee ID').fill(`T${stamp}2`);
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Start activity' }).click();
  await p.getByPlaceholder('Type your answer').waitFor();
  // Results are held, so there is no right/wrong yet, but the next clue still appears.
  await p.getByPlaceholder('Type your answer').fill('multi factor authentication');
  await p.getByRole('button', { name: /Confirm and continue/ }).click();
  await p.getByText('Next clue', { exact: true }).waitFor();
  if (await p.getByText(/Not quite|^Correct/).count()) throw new Error('right/wrong shown while results are held');
  await p.waitForTimeout(500);
  await shot(p, 'mobile-player-reveal', true);
  step('treasure hunt reveal');
  await p.context().close();
}

// ---------- Employee: Spot the Phish on a phone (player with evidence) ----------
{
  const p = await page({ width: 390, height: 844 });
  await p.goto(`${base}/a/spot-the-phish`);
  await p.getByLabel('Full name').fill('Mobile Tester');
  await p.getByLabel('Employee ID').fill(`M${stamp}3`);
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Start activity' }).click();
  await p.locator('fieldset label').first().waitFor();
  await p.waitForTimeout(400);
  await shot(p, 'mobile-player');
  await p.context().close();
}

// ---------- Admin ----------
async function signIn(p) {
  await p.goto(`${base}/admin`);
  await p.getByLabel('Work email').waitFor();
  await p.getByLabel('Work email').fill(ADMIN.email);
  await p.getByLabel('Password').fill(ADMIN.password);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.getByRole('heading', { name: 'Activities', exact: true }).waitFor();
}
{
  const p = await page({ width: 1440, height: 900 });
  await p.goto(`${base}/admin`);
  await p.getByLabel('Work email').waitFor();
  await shot(p, 'desktop-admin-login');
  await signIn(p);
  const row = p.locator('table').getByRole('link', { name: /Spot the Phish/ }).first();
  await row.waitFor();
  await shot(p, 'desktop-admin-home');
  step('home');
  await row.click();
  await p.getByRole('navigation', { name: 'Activity' }).waitFor();
  await p.getByText('Section 1 of').first().waitFor();
  await shot(p, 'desktop-admin-questions');
  step('questions');
  await p.getByRole('button', { name: 'Preview' }).click();
  await p.getByRole('dialog').getByText(/What employees see/).waitFor();
  await shot(p, 'desktop-admin-preview');
  await p.keyboard.press('Escape');
  step('preview');
  const tab = (name) => p.getByRole('navigation', { name: 'Activity' }).getByRole('link', { name });
  await tab(/Responses/).click();
  await p.getByText('Which red flags people missed').waitFor();
  await shot(p, 'desktop-admin-responses', true);
  step('responses summary');
  await p.getByRole('button', { name: 'Individual responses' }).click();
  await p.locator('tbody tr').first().click();
  await p.getByText('Question 1', { exact: true }).first().waitFor();
  await shot(p, 'desktop-admin-response-drawer');
  await p.keyboard.press('Escape');
  step('response drawer');
  await tab('Settings').click();
  await p.getByText('When can employees see their results?').waitFor();
  await shot(p, 'desktop-admin-settings', true);
  step('settings');
  await p.getByRole('button', { name: 'Share' }).click();
  await p.getByRole('dialog').getByText('Link', { exact: true }).waitFor();
  await shot(p, 'desktop-admin-share');
  await p.keyboard.press('Escape');
  step('share');
  await p.goto(`${base}/admin/admins`);
  await p.getByRole('heading', { name: 'Manage admins' }).waitFor();
  await shot(p, 'desktop-admin-admins');
  await p.goto(`${base}/admin`);
  await p.getByRole('button', { name: 'New activity' }).click();
  await p.getByRole('dialog').waitFor();
  await p.waitForTimeout(300);
  await shot(p, 'desktop-admin-new-activity');
  step('admins + new activity');
  await p.context().close();
}

// ---------- Admin on a phone ----------
{
  const p = await page({ width: 390, height: 844 });
  await signIn(p);
  await p.waitForTimeout(500);
  await shot(p, 'mobile-admin-home', true);
  step('admin on a phone');
  await p.context().close();
}

await browser.close();
console.log(errors.length ? `\nERRORS (${errors.length}):\n${[...new Set(errors)].join('\n')}` : '\nNo console or server errors.');
