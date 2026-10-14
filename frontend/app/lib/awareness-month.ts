/**
 * National Cyber Security Awareness Month, October 2026: one lesson a day on the home page.
 * Quotes are attributed as published; tips are the CISO Office's own words, each tagged with the
 * step of STOP → THINK → VERIFY → REPORT it practises.
 */
export type Step = 'stop' | 'think' | 'verify' | 'report';

export type Lesson =
  | { kind: 'quote'; text: string; author: string; source: string }
  | { kind: 'tip'; step: Step; title: string; text: string };

export const MONTH = { year: 2026, month: 10, days: 31 } as const;

export const STEPS: { id: Step; label: string; text: string }[] = [
  { id: 'stop', label: 'Stop', text: 'Pause when a message pushes you to act fast, pay, or share something.' },
  { id: 'think', label: 'Think', text: 'Were you expecting it? Does the request make sense coming from that sender?' },
  { id: 'verify', label: 'Verify', text: 'Check through a channel you already trust: a known number, the official site, the person face to face.' },
  { id: 'report', label: 'Report', text: 'Tell the CISO Office through the approved channel, even if you have already clicked.' },
];

export const stepNumber = (step: Step) => STEPS.findIndex((s) => s.id === step) + 1;

/** Index 0 is 1 October. */
export const LESSONS: Lesson[] = [
  { kind: 'quote', text: 'Amateurs hack systems; professionals hack people.', author: 'Bruce Schneier', source: 'Security technologist · Crypto-Gram, 2000' },
  { kind: 'tip', step: 'stop', title: 'Pressure is the warning sign', text: 'Urgent, alarming or too-good-to-be-true messages are built to rush you. Stop before you click, pay or reply.' },
  { kind: 'tip', step: 'verify', title: 'Read the address, not the name', text: 'Display names can say anything. Look at the address after the @: a familiar name on a strange or slightly misspelt domain is a classic phishing sign.' },
  { kind: 'tip', step: 'think', title: 'Hover before you click', text: 'On a computer, rest the pointer on a link to see where it really goes; on a phone, press and hold. If the address does not match the sender, do not open it.' },
  { kind: 'quote', text: 'The human factor is truly security’s weakest link.', author: 'Kevin Mitnick', source: 'Security consultant · The Art of Deception, 2002' },
  { kind: 'tip', step: 'stop', title: 'Never share an OTP', text: 'No bank, IT team or government office will ask for your one-time password. Anyone who asks for it is trying to take over your account or your money.' },
  { kind: 'tip', step: 'verify', title: 'Call back on a number you know', text: 'If a call, email or WhatsApp message asks for money, passwords or data, end it and call the person back on a number from the directory, never one they gave you.' },
  { kind: 'tip', step: 'think', title: 'Use a passphrase', text: 'Four or more random words are longer and easier to remember than a short, complicated password. Use a different one for every account.' },
  { kind: 'quote', text: 'There are only two types of companies: those that have been hacked and those that will be.', author: 'Robert S. Mueller III', source: 'Director, FBI · RSA Conference, 2012' },
  { kind: 'tip', step: 'verify', title: 'Turn on two-step verification', text: 'A password plus a code on your phone stops most account takeovers. Switch it on for email, banking and social media.' },
  { kind: 'tip', step: 'stop', title: 'Leave unknown pen drives alone', text: 'A USB drive found in the car park or handed out at an event can carry malware. Do not plug it in; hand it to the CISO Office.' },
  { kind: 'tip', step: 'think', title: 'Lock your screen every time', text: 'Press Windows + L whenever you leave your desk, even for a minute. An unlocked screen lets anyone act as you.' },
  { kind: 'quote', text: 'Security is a process, not a product.', author: 'Bruce Schneier', source: 'Security technologist · Crypto-Gram, 2000' },
  { kind: 'tip', step: 'verify', title: 'Check where a QR code takes you', text: 'Before you type anything on a page that opened from a QR code, read its web address. A sticker over a genuine code can lead to a fake login or payment page.' },
  { kind: 'tip', step: 'stop', title: 'There is no “digital arrest”', text: 'Callers posing as police, CBI or customs who say you are under “digital arrest” and must pay are fraudsters. Real officers never do this over a video call. Hang up.' },
  { kind: 'tip', step: 'think', title: 'Keep the plant off social media', text: 'Photos and posts from inside the refinery can reveal layouts, equipment and shift routines. Keep plant areas and work details off your feeds.' },
  { kind: 'quote', text: 'If you think technology can solve your security problems, then you don’t understand the problems and you don’t understand the technology.', author: 'Bruce Schneier', source: 'Security technologist · Secrets and Lies, 2000' },
  { kind: 'tip', step: 'verify', title: 'Jobs and prizes never cost a fee', text: 'Messages offering jobs, prizes or refunds in return for a “registration fee” are scams. Genuine recruiters and lotteries never ask you to pay first.' },
  { kind: 'tip', step: 'stop', title: 'Unexpected attachment? Ask first', text: 'Invoices, salary slips or “urgent documents” you were not expecting can carry ransomware. Check with the sender through another channel before opening.' },
  { kind: 'tip', step: 'verify', title: 'New bank details? Confirm by phone', text: 'A vendor or colleague emailing new bank details is a common fraud. Confirm by phone with a contact you already know before anyone pays.' },
  { kind: 'quote', text: 'It takes 20 years to build a reputation and few minutes of cyber-incident to ruin it.', author: 'Stéphane Nappo', source: 'Chief Information Security Officer' },
  { kind: 'tip', step: 'think', title: 'Install updates when asked', text: 'Update your phone, computer and apps promptly. Most attacks use weaknesses that already have a fix.' },
  { kind: 'tip', step: 'stop', title: 'Keep personal devices off plant systems', text: 'Never connect phones, chargers or pen drives to control-room or plant computers. Plant networks are kept separate for a reason.' },
  { kind: 'tip', step: 'think', title: 'Free Wi-Fi is not for banking', text: 'Avoid banking or signing in to work accounts on free Wi-Fi at stations and cafés. Use your mobile data instead.' },
  { kind: 'quote', text: 'The only truly secure system is one that is powered off, cast in a block of concrete and sealed in a lead-lined room with armed guards — and even then I have my doubts.', author: 'Gene Spafford', source: 'Computer scientist, Purdue University' },
  { kind: 'tip', step: 'report', title: 'Report it, even if you clicked', text: 'Clicked a bad link or typed a password on a strange page? Tell the CISO Office straight away. The sooner it is reported, the less damage it does.' },
  { kind: 'tip', step: 'report', title: 'Lost money to fraud? Call 1930', text: 'Call the national cyber-crime helpline 1930 at once, or report at cybercrime.gov.in. A quick report gives the bank the best chance to stop the money.' },
  { kind: 'tip', step: 'verify', title: 'Faces and voices can be faked', text: 'A call or video that looks and sounds like a senior officer can be a deepfake. If it asks for money or secrets, verify through another channel first.' },
  { kind: 'tip', step: 'report', title: 'Send phishing to the CISO Office', text: 'Report a suspicious email to the CISO Office through the approved channel, then delete it. Your report can protect colleagues who received the same message.' },
  { kind: 'tip', step: 'think', title: 'Clear desk, clear screen', text: 'Do not leave passwords on sticky notes or papers with sensitive details on your desk. Lock them away at the end of every shift.' },
  { kind: 'tip', step: 'report', title: 'Make it a habit', text: 'Stop. Think. Verify. Report. Four steps for every message, every day, long after October.' },
];

const istDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

export type MonthState = { phase: 'before' | 'during' | 'after'; today: number };

/** Where today (India time) falls against October 2026: `today` is the number of lessons open. */
export function monthState(now = new Date()): MonthState {
  const [y, m, d] = istDate.format(now).split('-').map(Number);
  const here = y * 12 + m;
  const target = MONTH.year * 12 + MONTH.month;
  if (here < target) return { phase: 'before', today: 0 };
  if (here > target) return { phase: 'after', today: MONTH.days };
  return { phase: 'during', today: d };
}

const dayDate = (day: number) => new Date(Date.UTC(MONTH.year, MONTH.month - 1, day, 6, 30));
const longDay = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });
const shortDay = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });

export const formatLessonDay = (day: number) => longDay.format(dayDate(day));
export const formatShortLessonDay = (day: number) => shortDay.format(dayDate(day));

/** Monday-first column of 1 October (0 = Monday). */
export const firstWeekday = (dayDate(1).getUTCDay() + 6) % 7;
