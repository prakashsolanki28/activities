// Cyber Survivor walk: create a game, drive it through the admin API, assert on the projector display,
// then check the Host console and every print sheet.
// Usage: node e2e/survivor.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = process.argv[3] ?? '.impeccable/review';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@hrrl.local', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe-2026!' };
const errors = [];
const failures = [];
const step = (label) => console.log(`• ${label}`);
const check = (ok, label) => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
};
mkdirSync(out, { recursive: true });

// ---- API helpers (admin cookie) ----
const loginRes = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) });
if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
const cookie = loginRes.headers.get('set-cookie').split(';')[0];
const [cookieName, ...cookieRest] = cookie.split('=');
async function call(method, path, body) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

// ---- Browser ----
const browser = await chromium.launch();
async function open(viewport, withCookie = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (withCookie) await ctx.addCookies([{ name: cookieName, value: cookieRest.join('='), url: base }]);
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && !/status of 40[13]/.test(m.text()) && errors.push(`[console] ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  p.on('response', (r) => r.status() >= 500 && errors.push(`[${r.status()}] ${r.url()}`));
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${out}/survivor-${name}.png`, animations: 'disabled' });

// What the contract says each team (default teams) should hold. Firewall plays a perfect game.
const TEAM = 'firewall';
const OTHER = 'ninjas';
const TITLE = `E2E Survivor ${Date.now().toString().slice(-5)}`;
let game;
try {
  step('create game');
  game = await call('POST', '/admin/games', { title: TITLE });
  const { _id: id, code } = game;
  const setState = (body) => call('POST', `/admin/games/${id}/state`, body);
  const score = (teamId, body) => call('PUT', `/admin/games/${id}/scores/${teamId}`, body);

  const p = await open({ width: 1920, height: 1080 });
  await p.goto(`${base}/g/${code}`);
  // The projector shows the game's own title (the template's "Cyber Survivor" is only the default).
  await p.waitForSelector('[data-testid="display"][data-stage="lobby"]');
  await p.getByText(TITLE).first().waitFor();
  const stageIs = (sid) => p.waitForSelector(`[data-testid="display"][data-stage="${sid}"]`, { timeout: 8000 });
  const total = async (teamId) => Number(await p.getByTestId(`strip-total-${teamId}`).innerText());
  await shot(p, 'lobby');
  check((await p.getByText('Team Firewall').count()) > 0, 'lobby lists the teams');

  // Firewall's R1 answers are right (by the contract: c1 verify, c2 danger, c3 safe, c4 danger); ninjas answer c1 wrong.
  step('round 1');
  for (const [cid, choice] of [['c1', 'verify'], ['c2', 'danger'], ['c3', 'safe'], ['c4', 'danger']]) await score(TEAM, { round: 'r1', challengeId: cid, choice });
  await score(OTHER, { round: 'r1', challengeId: 'c1', choice: 'safe' });
  await setState({ stageId: 'r1-intro' });
  await stageIs('r1-intro');
  await shot(p, 'round-intro');
  await setState({ stageId: 'r1-c1' });
  await stageIs('r1-c1');
  await p.getByTestId('situation').waitFor();
  const hidden = 'known, independent contact';
  check((await p.getByText(hidden).count()) === 0, 'c1 explanation hidden before reveal');
  check((await total(TEAM)) === 0, 'score strip is 0 before reveal');
  await setState({ revealed: true });
  await p.getByText(hidden).waitFor({ timeout: 8000 });
  check(true, 'c1 explanation shown after reveal');
  await p.waitForFunction(() => document.querySelector('[data-testid="strip-total-firewall"]')?.textContent === '5', null, { timeout: 8000 });
  check((await total(TEAM)) === 5, 'score strip updates after reveal (5)');
  check((await total(OTHER)) === 0, 'wrong answer scores nothing');
  await shot(p, 'r1-reveal');
  for (const sid of ['r1-c2', 'r1-c3', 'r1-c4']) {
    await setState({ stageId: sid, revealed: true });
  }
  await setState({ stageId: 'r1-scores' });
  await stageIs('r1-scores');
  check((await p.getByTestId('score-table').count()) === 1, 'scores stage shows the full table');
  await shot(p, 'scores');

  step('round 2');
  await score(TEAM, { round: 'r2', identified: true, warningSigns: true, response: true });
  await setState({ stageId: 'r2-intro' });
  await setState({ stageId: `r2-${TEAM}` });
  await stageIs(`r2-${TEAM}`);
  await p.getByText('Your volunteer is acting').waitFor();
  check((await p.getByText('The Fake IT Call').count()) === 0, 'card A title hidden before reveal');
  check((await total(TEAM)) === 20, 'R2 points not counted before reveal');
  await setState({ revealed: true });
  await p.getByText('The Fake IT Call').waitFor({ timeout: 8000 });
  check(true, 'card A title shown after reveal');
  await p.waitForFunction(() => document.querySelector('[data-testid="strip-total-firewall"]')?.textContent === '50', null, { timeout: 8000 });
  check(true, 'score strip counts R2 after reveal (50)');
  await shot(p, 'r2-reveal');
  await setState({ stageId: 'r2-scores' });

  step('round 3 and 4');
  await score(TEAM, { round: 'r3', picks: ['report', 'secure', 'preserve'] });
  for (const sit of ['email', 'otp', 'usb', 'payment']) await score(TEAM, { round: 'r4', situationId: sit, correct: true });
  await setState({ stageId: 'r3-intro' });
  await setState({ stageId: 'r3-auction', timer: { action: 'start', durationSec: 180 } });
  await stageIs('r3-auction');
  await p.getByText('Budget: 100 Cyber Coins').waitFor();
  check((await p.getByTestId('clock').count()) === 1, 'countdown clock visible while a timer runs');
  await shot(p, 'r3-auction');
  await setState({ stageId: 'r3-twist' });
  await stageIs('r3-twist');
  await shot(p, 'r3-twist');
  await setState({ stageId: 'r3-reveal' });
  await stageIs('r3-reveal');
  await setState({ stageId: 'r3-scores' });
  await setState({ stageId: 'r4-intro' });
  await setState({ stageId: 'r4-mission' });
  await stageIs('r4-mission');
  await p.getByText('The office has a problem!').waitFor();
  await setState({ stageId: 'r4-reveal' });
  await stageIs('r4-reveal');
  await shot(p, 'r4-reveal');

  step('final');
  await setState({ stageId: 'final' });
  await stageIs('final');
  const champ = p.getByTestId('champion');
  await champ.waitFor({ timeout: 8000 });
  check((await champ.innerText()).includes('Team Firewall'), 'final shows Team Firewall as champion');
  check((await champ.innerText()).includes('100'), 'champion total is 100');
  await shot(p, 'final');

  step('host console');
  const host = await open({ width: 1440, height: 900 }, true);
  await host.goto(`${base}/admin/games/${id}`);
  await host.getByText(TITLE).first().waitFor({ timeout: 10000 });
  check(true, 'Host console renders the game title');
  await shot(host, 'host');

  step('print sheets');
  const pr = await open({ width: 1200, height: 900 }, true);
  for (const sheet of ['cards', 'scenarios', 'scoreboard', 'certificate']) {
    await pr.goto(`${base}/admin/games/${id}/print?sheet=${sheet}`);
    await pr.waitForSelector(`[data-sheet="${sheet}"]`, { timeout: 10000 });
    await pr.waitForTimeout(300);
    await shot(pr, `print-${sheet}`);
    check(true, `print sheet: ${sheet}`);
  }
  check((await pr.getByText('Team Firewall').count()) > 0, 'certificate names the champion');
} finally {
  if (game) {
    try {
      await call('DELETE', `/admin/games/${game._id}`);
      step('game deleted');
    } catch (e) {
      errors.push(`[cleanup] ${e.message}`);
    }
  }
  await browser.close();
}

if (errors.length || failures.length) {
  console.error(`\nFAILED\n${[...failures.map((f) => `[check] ${f}`), ...errors].join('\n')}`);
  process.exit(1);
}
console.log('\nSurvivor walk OK');
