// Plays "Spot Every Red Flag": drag a box, resize it, confirm it; a tap, a box too big, a miss, a repeat,
// finishing a screenshot, and giving up on one.
// Usage: node e2e/spot.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = '.impeccable/review';
const errors = [];
const step = (s) => console.log(`• ${s}`);
const browser = await chromium.launch();

// This walk needs the live game (results right away, right/wrong after each box).
// Switch the activity to that for the run and put the admin's own choice back afterwards.
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@hrrl.local', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe-2026!' };
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) });
const cookie = login.headers.get('set-cookie').split(';')[0];
const api = async (path, init = {}) => {
  const r = await fetch(`${base}/api${path}`, { ...init, headers: { cookie, 'Content-Type': 'application/json', ...init.headers } });
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${r.status} ${await r.text()}`);
  return r.json();
};
const summary = (await api('/admin/activities')).find((a) => a.slug === 'spot-every-red-flag');
const original = await api(`/admin/activities/${summary._id}`);
const setSettings = async (settings) => {
  const current = await api(`/admin/activities/${summary._id}`);
  await api(`/admin/activities/${summary._id}`, { method: 'PATCH', body: JSON.stringify({ version: current.version, settings }) });
};
const live = original.settings.resultsRelease === 'immediate' && original.settings.feedbackMode === 'instant';
if (!live) await setSettings({ ...original.settings, resultsRelease: 'immediate', feedbackMode: 'instant' });

// Flag boxes for screenshot 1 (email) and 2 (login page), in % of the screenshot: [x, y, w, h].
const EMAIL = [
  [37.9, 25.2, 23.2, 3.1],
  [51.2, 51.5, 18.9, 3.0],
  [40.6, 58.3, 27.0, 2.9],
  [24.9, 64.8, 22.0, 6.0],
  [49.0, 72.9, 10.4, 3.0],
];
const LOGIN_URL = [16.8, 5.9, 19.6, 3.0];

async function play(viewport, prefix, id) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`[${prefix}] ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`[${prefix}] ${m.text()}`));
  await p.goto(`${base}/a/spot-every-red-flag`);
  await p.getByLabel('Full name').fill('Spot Tester');
  await p.getByLabel('Employee ID').fill(id);
  await p.getByRole('button', { name: 'Continue' }).click();
  await p.getByRole('button', { name: 'Start activity' }).click();
  await p.getByText('Red flags found').waitFor();
  return { p, ctx, ...tools(p, 'main figure img') };
}

/** Screen-space helpers for one plate: points in %, and dragging a box around a flag. */
function tools(p, imgSelector) {
  const at = async (x, y) => {
    const b = await p.locator(imgSelector).first().boundingBox();
    return { x: b.x + (b.width * x) / 100, y: b.y + (b.height * y) / 100 };
  };
  const drag = async ([x, y, w, h], pad = 1) => {
    const a = await at(x - pad, y - pad);
    const b = await at(x + w + pad, y + h + pad);
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(b.x, b.y, { steps: 8 });
    await p.mouse.up();
  };
  const check = () => p.getByRole('button', { name: 'Check', exact: true }).click();
  return { at, drag, check };
}

// ---- Desktop ----
{
  const { p, ctx, at, drag, check } = await play({ width: 1440, height: 900 }, 'desktop', `S${Date.now().toString().slice(-6)}`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/desktop-spot-start.png` });

  // A plain click marks nothing; it explains how to draw.
  const t = await at(50, 40);
  await p.mouse.click(t.x, t.y);
  await p.getByText('Drag to draw a box around the red flag.').waitFor();
  step('a tap marks nothing and says to drag');

  // Draw a box over the left half of the sender domain, then stretch it with the corner handle.
  const [sx, sy, sw, sh] = EMAIL[0];
  await drag([sx, sy, sw / 2, sh]);
  await p.getByRole('button', { name: 'Check', exact: true }).waitFor();
  await p.screenshot({ path: `${out}/desktop-spot-draft.png` });
  const corner = await at(sx + sw / 2 + 1, sy + sh + 1);
  const target = await at(sx + sw + 1, sy + sh + 1);
  await p.mouse.move(corner.x, corner.y);
  await p.mouse.down();
  await p.mouse.move(target.x, target.y, { steps: 6 });
  await p.mouse.up();
  await check();
  await p.getByText(/Found: Sender domain/).waitFor();
  step('a resized box found the sender domain');

  // A box far too big is refused before it is checked.
  await drag([10, 20, 80, 60], 0);
  await p.getByText('Box one thing at a time').waitFor();
  await p.getByRole('button', { name: 'Remove this box' }).click();
  step('a box too big cannot be checked');

  // A miss in empty space.
  await drag([84, 86, 8, 6], 0);
  await check();
  await p.getByText(/Not a red flag/).waitFor();
  step('a miss costs a wrong guess');

  // The same flag again: a repeat, no penalty.
  await drag(EMAIL[0]);
  await check();
  await p.getByText(/Already found/).waitFor();
  step('boxing a found flag again is free');
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/desktop-spot-playing.png` });

  // The rest, confirmed from the keyboard.
  for (const f of EMAIL.slice(1)) {
    await drag(f);
    await p.getByRole('button', { name: 'Check', exact: true }).waitFor();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
  }
  await p.getByText(/Every red flag found/).waitFor();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/desktop-spot-complete.png` });
  step('all five flags in the email found, Enter confirms a box');
  await p.getByRole('button', { name: /Continue/ }).click();

  // Screenshot 2: find one, then give up.
  await p.getByText('Red flags found').waitFor();
  await drag(LOGIN_URL);
  await check();
  await p.getByText(/Found: /).waitFor();
  await p.getByRole('button', { name: /I’m done/ }).click();
  await p.getByText(/You found 1 of 3 red flags/).waitFor();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/desktop-spot-gaveup.png` });
  step('giving up reveals the missed flags');
  await ctx.close();
}

// ---- Phone ----
{
  const { p, ctx, drag, check } = await play({ width: 390, height: 844 }, 'mobile', `M${Date.now().toString().slice(-6)}`);
  for (const f of EMAIL.slice(0, 2)) {
    await drag(f);
    await check();
    await p.getByText(/Found: /).waitFor();
    await p.waitForTimeout(300);
  }
  await drag([2, 88, 8, 8], 0);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/mobile-spot-draft.png`, fullPage: true });
  await check();
  await p.getByText(/Not a red flag/).waitFor();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/mobile-spot-playing.png`, fullPage: true });
  step('phone: boxes find flags');
  await ctx.close();
}

// ---- Admin: builder preview and insights ----
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => errors.push(`[admin] ${e.message}`));
  await p.goto(`${base}/admin/login`);
  await p.getByLabel('Work email').fill(process.env.ADMIN_EMAIL ?? 'admin@hrrl.local');
  await p.getByLabel('Password').fill(process.env.ADMIN_PASSWORD ?? 'ChangeMe-2026!');
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.getByRole('heading', { name: 'Activities', exact: true }).waitFor();
  const { id, qid } = await p.evaluate(async () => {
    const a = (await (await fetch('/api/admin/activities')).json()).find((x) => x.slug === 'spot-every-red-flag');
    const full = await (await fetch(`/api/admin/activities/${a._id}`)).json();
    return { id: a._id, qid: full.sections[0].questions[0].id };
  });
  await p.goto(`${base}/admin/activities/${id}?q=${qid}`);
  await p.getByText('Wrong guesses allowed').waitFor();
  await p.waitForTimeout(700);
  await p.screenshot({ path: '.impeccable/review/desktop-admin-spot-builder.png' });
  // Play the preview: box the sender domain.
  await p.getByRole('button', { name: 'Preview this question' }).first().click();
  await p.getByRole('dialog').locator('figure img').first().waitFor();
  const preview = tools(p, '[role=dialog] figure img');
  await preview.drag(EMAIL[0]);
  await preview.check();
  await p.getByText(/Found: /).waitFor();
  await p.screenshot({ path: '.impeccable/review/desktop-admin-spot-preview.png' });
  await p.keyboard.press('Escape');
  await p.goto(`${base}/admin/activities/${id}/responses`);
  await p.getByText('Which red flags people missed').waitFor();
  await p.waitForTimeout(900);
  await p.screenshot({ path: '.impeccable/review/desktop-admin-spot-responses.png' });
  step('admin: question preview plays, responses show the red-flag map');
  await p.close();
}

if (!live) await setSettings(original.settings);
await browser.close();
console.log(errors.length ? `\nERRORS:\n${[...new Set(errors)].join('\n')}` : '\nNo errors.');
