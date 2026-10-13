// Authoring walk: build an activity in the UI (upload, three question types, hotspot region),
// set a 1-minute limit, publish, then play it and let the timer auto-submit.
// Usage: node e2e/builder.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const ADMIN = { email: process.env.ADMIN_EMAIL ?? 'admin@hrrl.local', password: process.env.ADMIN_PASSWORD ?? 'ChangeMe-2026!' };
const errors = [];
const step = (s) => console.log(`• ${s}`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
p.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(`[console] ${m.text()}`));

await p.goto(`${base}/admin/login`);
await p.getByLabel('Work email').fill(ADMIN.email);
await p.getByLabel('Password').fill(ADMIN.password);
await p.getByRole('button', { name: 'Sign in' }).click();
await p.getByRole('heading', { name: 'Activities', exact: true }).waitFor();

await p.getByRole('button', { name: 'New activity' }).click();
await p.getByRole('dialog').getByLabel('Name').fill(`E2E builder check ${Date.now().toString().slice(-5)}`);
await p.getByRole('button', { name: 'Create', exact: true }).click();
await p.getByRole('navigation', { name: 'Activity' }).waitFor();
await p.getByRole('textbox', { name: 'Activity title' }).waitFor();
// A new activity may already start with an empty section.
if (!(await p.getByText(/^Section 1 of/).count())) await p.getByRole('button', { name: 'Add section' }).first().click();
await p.getByText('Section 1 of 1').waitFor();
step('activity created');

// Section screenshot upload
await p.locator('input[type=file]').first().setInputFiles('backend/src/seed/images/s2-login-page.png');
await p.getByText(/1536 × 1024px/).waitFor({ timeout: 20000 });
step('screenshot uploaded');

const question = () => p.getByRole('textbox', { name: 'Question', exact: true });
const addQuestion = async (label) => {
  await p.getByRole('button', { name: 'Add new question' }).last().click();
  await p.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await question().waitFor();
};

await addQuestion('Single choice');
await question().fill('Is this a genuine Microsoft sign-in page?');
await p.getByRole('textbox', { name: 'Option 1', exact: true }).fill('Yes, it has the Microsoft logo');
await p.getByRole('textbox', { name: 'Option 2', exact: true }).fill('No, the domain is not Microsoft');
await p.getByRole('textbox', { name: 'Option 3', exact: true }).fill('Yes, it uses HTTPS');
await p.getByRole('textbox', { name: 'Option 4', exact: true }).fill('Cannot tell');
await p.getByRole('radio', { name: 'Mark option 2 correct' }).click();
step('single choice');

await addQuestion('Spot on the image');
await question().fill('Tap the part of the page that gives it away.');
// Draw the correct area over the address bar (≈ x 17–36%, y 6–9%).
const box = await p.locator('[data-region-editor]').first().boundingBox();
await p.mouse.move(box.x + box.width * 0.16, box.y + box.height * 0.05);
await p.mouse.down();
await p.mouse.move(box.x + box.width * 0.37, box.y + box.height * 0.1, { steps: 8 });
await p.mouse.up();
step('hotspot area drawn');

await addQuestion('Short answer');
await question().fill('What is this kind of attack called?');
const chips = p.getByPlaceholder('e.g. MFA, Multi-factor authentication');
await chips.fill('phishing');
await chips.press('Enter');
step('short answer');

await p.getByText('All changes saved').waitFor({ timeout: 15000 });
await p.waitForTimeout(1200);

const tab = (name) => p.getByRole('navigation', { name: 'Activity' }).getByRole('link', { name });
await tab('Settings').click();
await p.getByRole('radio', { name: /Right away/ }).click();
await p.getByRole('switch', { name: /Show right or wrong after every question/ }).click();
await p.getByRole('switch', { name: /^Time limit/ }).click();
await p.getByLabel('Minutes allowed').fill('1');
await p.getByRole('button', { name: 'Save', exact: true }).click();
await p.getByText('Settings saved').waitFor();
step('settings saved: right away, right/wrong after each question, 1 minute');

await p.getByRole('button', { name: 'Share', exact: true }).click();
await p.getByRole('button', { name: 'Open now' }).waitFor();
if (await p.getByText(/before sharing/).isVisible()) {
  await p.screenshot({ path: '.impeccable/review/_builder-fail.png', fullPage: true });
  throw new Error('activity reported problems before sharing');
}
await p.getByRole('button', { name: 'Open now' }).click();
await p.getByText('Employees can take part now.').waitFor();
const url = await p.getByLabel('Employee link').inputValue();
step(`published at ${url}`);

// Employee plays it on a phone.
const emp = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
emp.on('pageerror', (e) => errors.push(`[pageerror employee] ${e.message}`));
await emp.goto(url);
await emp.getByLabel('Full name').fill('Builder Check');
await emp.getByLabel('Employee ID').fill(`B${Date.now().toString().slice(-6)}`);
await emp.getByRole('button', { name: 'Continue' }).click();
await emp.getByRole('button', { name: 'Start activity' }).click();
await emp.getByRole('timer').waitFor();
await emp.locator('fieldset label').nth(1).click();
await emp.getByRole('button', { name: /Check answer/ }).click();
await emp.getByRole('button', { name: /Continue/ }).waitFor();
if (!(await emp.getByText(/^Correct/).first().isVisible())) throw new Error('single choice was not marked correct');
await emp.getByRole('button', { name: /Continue/ }).click();
step('single choice answered correctly');

// Hotspot: tap the address bar on the evidence.
const img = await emp.locator('figure img').first().boundingBox();
await emp.mouse.click(img.x + img.width * 0.26, img.y + img.height * 0.075);
await emp.getByText(/Marked\./).waitFor();
await emp.getByRole('button', { name: /Check answer/ }).click();
await emp.getByRole('button', { name: /Continue/ }).waitFor();
if (!(await emp.getByText('You marked the right spot.').isVisible())) throw new Error('hotspot tap was not marked correct');
await emp.waitForTimeout(700);
await emp.screenshot({ path: '.impeccable/review/mobile-hotspot-reveal.png', fullPage: true });
await emp.getByRole('button', { name: /Continue/ }).click();
step('hotspot tapped correctly');

// Leave the last question unanswered and wait for the timer.
await emp.getByRole('heading', { name: /Case closed/ }).waitFor({ timeout: 90000 });
await emp.getByText(/Time ran out/).waitFor();
step('timer auto-submitted the attempt');

await browser.close();
console.log(errors.length ? `\nERRORS:\n${[...new Set(errors)].join('\n')}` : '\nNo errors.');
