import type { ActivityContentInput, QuestionInput, Region } from '@hrrl/shared';

/**
 * Seed content transcribed from "Activity 1.pdf" and "Acitivy 2.pdf".
 * Lines marked REVIEW are inferred or authored (the PDFs give no key, or answer in prose)
 * and should be confirmed by the CISO office.
 */

let n = 0;
const id = (prefix: string) => `${prefix}${(++n).toString(36).padStart(3, '0')}`;

const region = (x: number, y: number, w: number, h: number, label: string): Region => ({ id: id('r'), x, y, w, h, label });

const opts = (labels: string[], correct: number[] | 'all' | 'allExceptLast' = []) =>
  labels.map((label, i) => ({
    id: id('o'),
    label,
    correct: correct === 'all' ? true : correct === 'allExceptLast' ? i < labels.length - 1 : correct.includes(i),
  }));

const single = (prompt: string, labels: string[], correctIndex: number, extra: Partial<QuestionInput> = {}): QuestionInput => ({
  id: id('q'),
  type: 'single',
  prompt,
  options: opts(labels, [correctIndex]),
  ...extra,
});

const multi = (prompt: string, labels: string[], correct: number[] | 'all' | 'allExceptLast', extra: Partial<QuestionInput> = {}): QuestionInput => ({
  id: id('q'),
  type: 'multi',
  prompt,
  options: opts(labels, correct),
  multiScoring: 'partial',
  ...extra,
});

/* ------------------------------------------------------------------ */
/* Activity 1 — five phishing scenarios                                 */
/* ------------------------------------------------------------------ */

// Red-flag regions, in % of each 1536×1024 screenshot.
const email = {
  sender: region(37.9, 25.2, 23.2, 3.1, 'Sender domain is microsoft-support.com, not microsoft.com'),
  subject: region(19.0, 20.4, 47.2, 3.6, 'Alarming subject line'),
  disabled: region(51.2, 51.5, 18.9, 3.0, '"Permanently disabled today": threat'),
  verify: region(40.6, 58.3, 27.0, 2.9, 'Asks you to verify credentials immediately'),
  button: region(24.9, 64.8, 22.0, 6.0, 'Button hides where the link really goes'),
  deadline: region(49.0, 72.9, 10.4, 3.0, '"Within 2 hours": artificial deadline'),
  brand: region(24.8, 34.6, 11.9, 4.1, 'Copied Microsoft branding'),
};

const login = {
  url: region(16.8, 5.9, 19.6, 3.0, 'Domain is login-microsoft365-security.com, not a Microsoft domain'),
  padlock: region(10.6, 5.9, 1.9, 3.0, 'The padlock only means the connection is encrypted'),
  brand: region(35.7, 32.6, 11.4, 4.2, 'Copied Microsoft branding'),
  field: region(35.8, 48.4, 28.7, 5.1, 'Asks for your credentials'),
};

const whatsapp = {
  number: region(40.8, 1.4, 16.5, 5.6, 'Unknown mobile number, not an HR account'),
  today: region(37.5, 38.9, 19.0, 3.0, '"By today": deadline pressure'),
  pdf: region(37.5, 49.0, 38.3, 10.2, 'Unexpected attachment'),
  mandatory: region(37.5, 76.0, 24.4, 3.2, '"Mandatory for all employees": authority pressure'),
  signature: region(37.5, 66.6, 24.2, 6.0, 'Anyone can type "HR Department"'),
};

const teams = {
  url: region(37.1, 45.1, 30.1, 2.9, 'forms-hr-hrll.com: look-alike domain (hrll, not hrrl)'),
  eod: region(55.4, 50.2, 7.3, 2.8, '"EOD today": deadline pressure'),
  card: region(45.3, 70.7, 21.6, 7.5, 'Form asks you to sign in on an external site'),
  sender: region(36.1, 7.4, 14.8, 2.5, 'A familiar name can be impersonated'),
  ask: region(37.1, 40.2, 30.5, 2.9, 'Asks you to verify and update your details'),
};

const word = {
  filename: region(4.1, 1.4, 16.7, 2.7, '.docm: a macro-enabled document'),
  bar: region(0.7, 9.2, 98.6, 4.6, 'Protected View: the file came from the internet'),
  enable: region(73.7, 9.9, 10.0, 3.2, 'Enable Content would let macros run'),
  instruction: region(22.4, 47.8, 50.3, 2.8, 'Tells you to click "Enable Content"'),
  lure: region(22.4, 28.0, 31.8, 3.8, 'Salary topic used as bait'),
  action: region(22.5, 65.5, 57.2, 3.3, 'Action required: enable content'),
};

export const spotThePhish: ActivityContentInput & { slug: string } = {
  slug: 'spot-the-phish',
  title: 'Spot the Phish: Five Real-World Scenarios',
  description:
    'Five suspicious messages that look like they reached an HRRL inbox, phone or screen. Inspect each one, answer the questions, and see exactly where the red flags were.',
  completionMessage:
    'You inspected five real-world lures. Before you click, open or reply: STOP → THINK → VERIFY → REPORT. Report anything suspicious to the CISO Office through the approved channel.',
  settings: {
    feedbackMode: 'end',
    resultsRelease: 'manual',
    reviewAvailable: 'after_submit',
    navigation: 'free',
    // Options include "All of the above", so they must keep their authored order.
    shuffleOptions: false,
    shuffleQuestions: false,
    leaderboard: 'after_submit',
    certificateEnabled: true,
    certificateMinPct: 60,
    passingPct: 60,
  },
  sections: [
    {
      id: id('s'),
      title: 'The account-suspension email',
      intro: 'This email arrived in an HRRL Outlook inbox on a Monday morning. Inspect it carefully before answering.',
      image: { url: 'seed:s1-outlook-email.png', w: 1536, h: 1024, alt: 'Outlook email claiming an HRRL Microsoft 365 account will be disabled today' },
      questions: [
        single('What type of email is this?', ['Legitimate', 'Phishing', 'Marketing email', 'Internal notification'], 1, {
          explanation: 'A threat to disable your account, a look-alike sender domain and a "verify now" button add up to phishing.',
          highlights: [email.sender, email.disabled, email.button],
        }),
        single('Which sender detail should you check first?', ["Sender's display name", "Sender's email address/domain", 'Email subject colour', 'Email timestamp'], 1, {
          explanation: 'Display names can say anything. The address, and especially the domain after the @, is harder to fake.',
          highlights: [email.sender],
        }),
        single('Which part of the sender address is suspicious?\n\n`security-alert@microsoft-support.com`', ['`security-alert`', '`@`', '`microsoft-support.com`', 'Nothing is suspicious'], 2, {
          explanation: 'microsoft-support.com is not a Microsoft domain. Attackers register look-alike domains that contain a trusted brand name.',
          highlights: [email.sender],
        }),
        single('What type of language is used in the email?', ['Friendly language', 'Urgent and threatening language', 'Normal business communication', 'Informational language'], 1, {
          explanation: '"Permanently disabled today" and "within 2 hours" are designed to make you act before you think.',
          highlights: [email.disabled, email.deadline],
        }),
        single('What is the purpose of the "Verify Your Account" button?', ['Provide general information', 'Encourage the user to take immediate action', 'Download a company document', 'Contact HR'], 1, {
          explanation: 'The button pushes you to act at once, and it hides where the link actually goes.',
          highlights: [email.button],
        }),
        single('Which statement is a major warning sign?', ['The email contains the Microsoft logo', 'The email mentions Microsoft 365', 'The email threatens account suspension within two hours', 'The email has a subject line'], 2, {
          explanation: 'A short deadline backed by a threat is one of the most common phishing tactics.',
          highlights: [email.deadline],
        }),
        single('What information could an attacker potentially try to obtain through the verification link?', ['Office location', 'Login credentials', 'Employee attendance', 'Meeting schedule'], 1, {
          explanation: '"Verify your credentials" means a fake sign-in page that captures your username and password.',
          highlights: [email.verify],
        }),
        single('Why should you not click the "Verify Your Account" button?', ['It may lead to a fraudulent login page', 'It may contain a phishing link', 'It may attempt to steal credentials', 'All of the above'], 3, {
          highlights: [email.button],
        }),
        single('What should you do if you receive this email?', ['Click the button immediately', 'Reply and provide your credentials', 'Independently verify the request and report the email through the approved process', 'Forward it to colleagues'], 2, {
          explanation: 'Go to Microsoft 365 the way you always do, never through the email, and report the message.',
        }),
        // REVIEW: the PDF lists these indicators without marking a key; all are treated as correct.
        multi(
          'Which phishing indicators can you identify in this email? Select all that apply.',
          ['Suspicious sender domain', 'Urgent/threatening language', 'Request to verify credentials', 'Suspicious link/button', 'Short two-hour deadline', 'Account-disable threat', 'Unexpected security notification', 'Use of familiar Microsoft branding'],
          'all',
          {
            points: 2,
            explanation: 'Every item here is a red flag. Familiar branding is cheap to copy, so it proves nothing.',
            highlights: [email.sender, email.subject, email.disabled, email.verify, email.button, email.deadline, email.brand],
          },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The Microsoft sign-in page',
      intro: 'A link in an unexpected email opened this page in your browser.',
      image: { url: 'seed:s2-login-page.png', w: 1536, h: 1024, alt: 'Browser showing a Microsoft-style sign-in page at login-microsoft365-security.com' },
      questions: [
        single('What is your first impression of this webpage?', ['Legitimate Microsoft login page', 'Suspicious login page', 'HRRL internal portal', 'General information page'], 1, {
          highlights: [login.url],
        }),
        single('What should you check first before entering your credentials?', ['Background image', 'Microsoft logo', 'Website address/URL', 'Page colour'], 2, {
          explanation: 'Logos and backgrounds are copied in seconds. The address bar shows where you really are.',
          highlights: [login.url],
        }),
        single('What is suspicious about the URL shown in the browser?\n\n`login-microsoft365-security.com/office365/login`', ['It contains HTTPS', 'It contains the word "Microsoft"', 'The domain is not an official Microsoft domain', 'It contains `/login`'], 2, {
          explanation: 'The real domain is everything before the first single "/". Here that is login-microsoft365-security.com, which Microsoft does not own.',
          highlights: [login.url],
        }),
        {
          id: id('q'),
          type: 'boolean',
          prompt: 'Does the presence of HTTPS or the padlock icon prove that this website is legitimate?',
          correctBoolean: false,
          explanation: 'HTTPS protects the connection, but it does not prove that the website itself is trustworthy.',
          highlights: [login.padlock],
        },
        single('Why might a phishing website use the Microsoft logo and familiar login design?', ['To make the page look professional', 'To make users believe it is genuine', 'To trick users into entering credentials', 'All of the above'], 3, {
          highlights: [login.brand],
        }),
        single('What information could an attacker attempt to steal through this page?', ['Username/email', 'Password', 'Authentication information', 'All of the above'], 3, {
          highlights: [login.field],
        }),
        single('You received a link in an unexpected email and it opened this page. What should you do?', ['Enter your password quickly', 'Close the page and access Microsoft 365 through an official known route', 'Try another password', 'Share the link with a colleague'], 1),
        single('Which is the safest way to access Microsoft 365?', ['Click any Microsoft login link received by email', 'Search for a login page through random search results', "Use the organisation's approved portal/bookmark or known official Microsoft service", 'Use a link received through an unknown message'], 2),
        single('What should you do if you already entered your password on this suspicious page?', ['Ignore it', 'Wait and see what happens', "Immediately report the incident and follow the organisation's account-security procedure", 'Delete the browser history only'], 2, {
          explanation: 'Speed matters: reporting quickly lets the security team reset your password and block the attacker.',
        }),
        // REVIEW: inferred key, every item except the "HTTPS proves it is genuine" distractor.
        multi(
          'Which red flags can you identify in this screenshot? Select all that apply.',
          ['Unfamiliar/suspicious domain', 'Login page requesting credentials', 'Microsoft branding that may create false trust', 'Page reached through an unexpected link', 'HTTPS automatically proves it is genuine', 'Domain does not match the expected official service'],
          [0, 1, 2, 3, 5],
          { points: 2, highlights: [login.url, login.padlock, login.brand, login.field] },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The WhatsApp HR message',
      intro: 'This message arrived on your phone from a number you have not saved.',
      image: { url: 'seed:s3-whatsapp.png', w: 1536, h: 1024, alt: 'WhatsApp message from an unknown number sending an HR policy PDF' },
      questions: [
        single('What is the primary security concern in this WhatsApp conversation?', ['Normal HR communication', 'Suspicious/social-engineering message', 'General announcement', 'Personal message'], 1, {
          highlights: [whatsapp.number],
        }),
        single('What should you check first when receiving this message?', ['Profile picture', "Sender's phone number and identity", 'Message font', 'PDF file size'], 1, {
          highlights: [whatsapp.number],
        }),
        single('Why is the sender suspicious?', ['The sender is using an unknown mobile number', 'The message contains text', 'The message was received during working hours', 'The message contains a PDF'], 0, {
          highlights: [whatsapp.number],
        }),
        single('Which part of the message creates a sense of urgency?', ['"Dear Team"', '"Revised HR Policy 2026"', '"by today" and "mandatory for all employees"', '"Regards, HR Department"'], 2, {
          highlights: [whatsapp.today, whatsapp.mandatory],
        }),
        single('Why should you be cautious about the PDF attachment?', ['Any unexpected attachment can potentially contain malicious content', 'PDFs are always dangerous', 'PDF files cannot be opened on computers', 'The file is too small'], 0, {
          highlights: [whatsapp.pdf],
        }),
        single('What should you do before opening an unexpected HR document received through WhatsApp?', ['Open it immediately', 'Forward it to colleagues', 'Verify the sender and the request through an official channel', 'Download it to your personal device'], 2),
        single('What social-engineering technique is being used in this message?', ['Creating urgency and authority', 'Offering a reward', 'Providing technical support', 'Asking for a survey'], 0, {
          highlights: [whatsapp.today, whatsapp.mandatory, whatsapp.signature],
        }),
        single('The message uses HRRL branding and says "HR Department". Does this prove that the message is genuine?', ['Yes', 'No', 'Only if the PDF has an HRRL logo', 'Only if the sender uses a professional name'], 1, {
          explanation: 'Branding, names and official-looking documents can be copied or impersonated.',
          highlights: [whatsapp.signature],
        }),
        single('What is the safest action if you are unsure whether this message is genuine?', ['Open the PDF to check', 'Ask the unknown sender for confirmation', 'Independently contact the HR/CISO/IT team through an approved channel', 'Forward the message to your team'], 2),
        // REVIEW: inferred key, every item except the "PDF automatically means malicious" distractor.
        multi(
          'Which warning signs can you identify in this message? Select all that apply.',
          ['Unknown phone number', 'Unexpected HR-related document', 'Urgency / short deadline', '"Mandatory for all employees" pressure', 'Request to open an attachment', 'Use of organisational branding to create trust', 'No obvious indication that the sender is an approved HR account', 'The message contains a PDF, which automatically means it is malicious'],
          [0, 1, 2, 3, 4, 5, 6],
          { points: 2, highlights: [whatsapp.number, whatsapp.today, whatsapp.pdf, whatsapp.mandatory, whatsapp.signature] },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The Teams travel-reimbursement request',
      intro: 'A colleague you recognise sent you this Microsoft Teams message.',
      image: { url: 'seed:s4-teams.png', w: 1536, h: 1024, alt: 'Teams chat asking the employee to update travel details through an external form link' },
      questions: [
        single("What is the biggest warning sign in this Teams message?", ["The sender uses a person's name", 'The message asks you to update travel details through an external link', 'The message contains a greeting', 'The sender has a profile picture'], 1, {
          highlights: [teams.url, teams.ask],
        }),
        single('What is suspicious about the URL?\n\n`https://forms-hr-hrll.com/employee-travel-update`', ['It uses HTTPS', 'It contains the word "forms"', 'The domain does not appear to be an official HRRL or approved Microsoft Forms domain', 'It contains `/employee-travel-update`'], 2, {
          explanation: 'Read it slowly: "hrll", not "hrrl". Look-alike domains swap or double letters you skim past.',
          highlights: [teams.url],
        }),
        single('Which social-engineering technique is being used?', ['Urgency and pressure', 'Technical support', 'Entertainment', 'General information sharing'], 0, {
          explanation: 'Clue: "This needs to be completed by EOD today."',
          highlights: [teams.eod],
        }),
        single('What should you do before submitting your information through the form?', ['Open the link and enter the details immediately', 'Forward the link to colleagues', 'Verify the sender and form through an approved HR/IT channel', 'Enter only partial information'], 2),
        // REVIEW: inferred key, every item except "Familiar name automatically proves the message is genuine".
        multi(
          'Which warning signs can you identify? Select all that apply.',
          ['External/suspicious form domain', 'Urgent deadline', 'Request to update employee information', 'Message appears to come from a known employee', 'Link asks the user to sign in or submit information', 'Familiar name automatically proves the message is genuine'],
          [0, 1, 2, 3, 4],
          { points: 2, explanation: 'A known name is exactly what an attacker who has taken over, or copied, an account would use.', highlights: [teams.url, teams.eod, teams.card, teams.sender, teams.ask] },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The salary-revision document',
      intro: 'You opened an attached document about salary revisions. Word shows it in Protected View.',
      image: { url: 'seed:s5-word-doc.png', w: 1536, h: 1024, alt: 'Word document in Protected View asking the user to Enable Content to see salary details' },
      questions: [
        single('What is the most important warning sign visible in the document?', ['The document contains an HRRL logo', 'The file is opened in Protected View and asks the user to **Enable Content**', 'The document has a reference number', 'The document has a date'], 1, {
          highlights: [word.bar, word.enable, word.instruction],
        }),
        single('Why should you be cautious before clicking "Enable Content"?', ['It can allow active content/macros to run', 'It can potentially execute malicious code', 'It may compromise the computer or organisational environment', 'All of the above'], 3, {
          explanation: 'The file name ends in .docm, a macro-enabled document. Enable Content is what lets those macros run.',
          highlights: [word.filename, word.enable],
        }),
        single('Which part of the document is designed to make the employee more likely to open it?', ['The HRRL logo', 'The salary revision and personalised compensation information', 'The document date', 'The reference number'], 1, {
          explanation: 'Attackers use attractive or sensitive topics such as salary, appraisal, bonuses and promotions to create curiosity and urgency.',
          highlights: [word.lure],
        }),
        single('What should you do if an unexpected document asks you to enable content?', ['Enable Content immediately', 'Disable Protected View', 'Close the document and verify its source through an approved channel', 'Forward the document to colleagues'], 2),
        // REVIEW: inferred key, every item except "HRRL logo automatically proves the document is safe".
        multi(
          'Which warning signs can you identify? Select all that apply.',
          ['File is opened in Protected View', 'User is instructed to enable content', 'Salary information is used to encourage immediate action', 'Document contains organisational branding', 'Unexpected document may contain active content', 'HRRL logo automatically proves the document is safe'],
          [0, 1, 2, 3, 4],
          { points: 2, highlights: [word.filename, word.bar, word.enable, word.instruction, word.lure, word.action] },
        ),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Activity 2 — Cybersecurity Treasure Hunt                             */
/* ------------------------------------------------------------------ */

const shortText = (prompt: string, accepted: string[], extra: Partial<QuestionInput> = {}): QuestionInput => ({
  id: id('q'),
  type: 'short_text',
  prompt,
  acceptedAnswers: accepted,
  maxTries: 3,
  ...extra,
});

export const treasureHunt: ActivityContentInput & { slug: string } = {
  slug: 'cyber-treasure-hunt',
  title: 'HRRL Cybersecurity Treasure Hunt',
  description:
    'Ten challenges, each unlocking the clue to the next location. Solve riddles, decode messages and spot the traps. Every correct answer reveals where to go next.',
  completionMessage:
    "CONGRATULATIONS! You have completed the HRRL Cybersecurity Treasure Hunt. You didn't just find the clues — you learned how to recognise and respond to common cybersecurity threats.\n\nSTOP → THINK → VERIFY → REPORT",
  settings: {
    feedbackMode: 'instant',
    // Clues still appear after every answer; right/wrong and scores wait for the CISO Office.
    resultsRelease: 'manual',
    navigation: 'linear',
    shuffleOptions: false,
    shuffleQuestions: false,
    leaderboard: 'always',
    certificateEnabled: true,
    certificateMinPct: 50,
    passingPct: 50,
  },
  sections: [
    {
      id: id('s'),
      title: 'Challenge 1 · Who am I?',
      questions: [
        shortText(
          'I protect your account,\nBut I am not your password.\n\nI may ask for something you know,\nSomething you have,\nOr something you are.\n\n**What am I?**',
          ['Multi-Factor Authentication', 'multi factor authentication', 'MFA', '2FA', 'two factor authentication', 'two-step verification', 'two step authentication'],
          {
            explanation: 'Multi-factor authentication asks for more than one kind of proof, so a stolen password alone is not enough.',
            revealText: 'Good start. Security needs more than one layer.\nYour next clue is waiting where people go to connect to the digital world.',
          },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 2 · The suspicious link',
      intro: 'You receive this message:\n\n> "Your account will be suspended today. Verify immediately using the link provided."',
      questions: [
        // REVIEW: the PDF answer is prose; distractors are authored.
        single(
          'Before clicking the link, what should you check?',
          ['The URL/domain and whether the message is authentic', 'Whether the link is blue and underlined', 'How many colleagues received the same message', 'Whether the message uses your name'],
          0,
          {
            explanation: 'Verify the sender, the URL and the legitimacy of the request before clicking an unexpected link.',
            revealText: "Don't click me. Check me.\nKeyword: VERIFY",
            maxTries: 2,
          },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 3 · Password riddle',
      questions: [
        shortText('I should be long.\nI should be unique.\nI should not be shared.\nI protect your digital identity.\n\n**What am I?**', ['password', 'passphrase', 'pass phrase', 'passcode']),
        single('**Bonus:** Which of the following is the safer option?', ['`HRRL@123`', '`Prakash123`', 'A long, unique passphrase', 'Employee ID'], 2, {
          bonus: true,
          explanation: 'Company names, first names and IDs are the first things attackers guess. Length and uniqueness beat clever symbols.',
          revealText: 'You found the key.\nNow find where unknown devices should never be connected.',
        }),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 4 · The unknown USB',
      intro: 'I was found outside the office.\nNobody knows who owns me.\nI look harmless.\nBut connecting me could create a security incident.',
      questions: [
        // REVIEW: the PDF answer is prose; distractors are authored.
        single(
          'What should you do?',
          ["Plug it into a spare computer to find the owner", 'Scan it with antivirus first, then open it', "Don't connect it to any organisational computer; report it or hand it over through the approved procedure", 'Keep it, since it looks unused'],
          2,
          {
            explanation: 'Unknown USB devices can carry malware that runs the moment they are connected. Never plug one in; hand it over.',
            revealText: 'You found something dangerous without opening it.\nNow find the place where suspicious incidents should be reported.',
            maxTries: 2,
          },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 5 · Social engineering',
      intro:
        'A person calls you and says:\n\n> "I am from IT Support. Your account has a security problem. Give me your OTP so I can fix it."\n\nThe person sounds professional and knows your name.',
      questions: [
        { id: id('q'), type: 'boolean', prompt: 'Should you provide the OTP?', correctBoolean: false, explanation: 'Never share an OTP. Genuine IT staff never need it.' },
        // REVIEW: the PDF answer is prose; distractors are authored.
        single(
          'What should you do?',
          ['Share the OTP, since they already know your name', 'Share only half of the OTP', "Verify the caller's identity through an approved channel and report the request", 'Ask them to call back later, then share it'],
          2,
          {
            explanation: 'A familiar name, a professional tone or an urgent request does not prove that a person is genuine.',
            revealText: "A trusted name doesn't always mean a trusted person.\nFind the next clue where people communicate.",
            maxTries: 2,
          },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 6 · Decode the message',
      questions: [
        shortText('Decode the following numbers:\n\n**16 – 8 – 9 – 19 – 8 – 9 – 14 – 7**\n\nHint: A = 1, B = 2, C = 3…', ['phishing'], {
          allowTypos: false,
          revealText: 'You decoded the threat.\nNow find the place where suspicious messages should never be trusted without verification.',
        }),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 7 · Malware puzzle',
      questions: [
        shortText(
          'I can hide inside a file.\nI can spread from one computer to another.\nI may damage systems or steal information.\nYou may never see me coming.\n\n**Who am I?**',
          ['malware', 'malicious software', 'virus', 'computer virus'],
          { explanation: 'Malware is any software built to cause harm. Viruses, worms, trojans and ransomware are all malware.' },
        ),
        single('**Bonus:** Which of the following could potentially carry malware?', ['Email attachment', 'Malicious website', 'Unknown USB device', 'Downloaded software', 'All of the above'], 4, { bonus: true }),
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 8 · Incident reporting',
      intro: 'You accidentally clicked a suspicious link.\nNothing happened. No warning appeared.\nYour computer seems completely normal.',
      questions: [
        {
          id: id('q'),
          type: 'boolean',
          prompt: 'Should you still report the incident?',
          correctBoolean: true,
          explanation: "Even when nothing visible happens, a suspected cybersecurity incident should be reported through the organisation's approved incident-reporting process.",
          revealText: 'When something goes wrong, silence is not security.\nFind the place where help is available.',
        },
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 9 · Spot the red flags',
      intro:
        '> **URGENT**\n> Your employee account will be deleted today.\n> Click the link below within **30 minutes**.\n> Failure to verify your account will result in immediate suspension.\n> Enter your: **Username + Password + OTP**',
      questions: [
        {
          id: id('q'),
          type: 'list_text',
          prompt: 'Identify at least **five** cybersecurity red flags.',
          inputCount: 5,
          minGroups: 5,
          points: 5,
          keywordGroups: [
            { id: id('g'), label: 'Urgent language', keywords: ['urgent', 'urgency', 'hurry', 'immediately'] },
            { id: id('g'), label: 'Threat of account suspension', keywords: ['suspension', 'suspend', 'suspended', 'deleted', 'delete', 'deletion', 'threat', 'threaten'] },
            { id: id('g'), label: 'Very short deadline', keywords: ['deadline', '30 minutes', 'thirty minutes', 'time limit', 'short time'] },
            { id: id('g'), label: 'Suspicious or unverified link', keywords: ['link', 'url', 'click'] },
            { id: id('g'), label: 'Request for password', keywords: ['password', 'credentials', 'username'] },
            { id: id('g'), label: 'Request for OTP', keywords: ['otp', 'one time password', 'code'] },
            { id: id('g'), label: 'Unexpected verification request', keywords: ['unexpected', 'verification', 'verify', 'unsolicited'] },
          ],
          explanation: 'Attackers often use urgency, fear and authority to make employees act without thinking.',
        },
      ],
    },
    {
      id: id('s'),
      title: 'Challenge 10 · Final challenge',
      questions: [
        shortText(
          'I am not a firewall.\nI am not antivirus.\nI am not encryption.\nI am not a security tool.\n\nYet I can help stop an attack before it succeeds.\nI ask one simple question: **"Should I trust this?"**\n\n**What am I?**',
          ['cybersecurity aware employee', 'cyber security aware employee', 'security aware employee', 'cyber aware employee', 'aware employee', 'human firewall', 'security conscious employee', 'alert employee'],
          { explanation: 'You are. A cybersecurity-aware employee stops attacks that no tool can.' },
        ),
      ],
    },
    {
      id: id('s'),
      title: 'Bonus · Caesar cipher',
      intro: 'For those who finish early.',
      questions: [
        shortText('Decode: **SKLVKLQJ**\n\nHint: move every letter **3 places backward**.', ['phishing'], { bonus: true, allowTypos: false }),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Activity 3 — Spot Every Red Flag (live boxes on the screenshots)     */
/* ------------------------------------------------------------------ */

const spot = (prompt: string, flags: Region[], explanation: string): QuestionInput => ({
  id: id('q'),
  type: 'spot_flags',
  prompt,
  // One point per flag, so every red flag found counts the same.
  points: flags.length,
  maxMisses: 3,
  // Fresh ids: the same boxes also serve as highlights in "Spot the Phish".
  regions: flags.map((f) => ({ ...f, id: id('f') })),
  explanation,
});

export const spotEveryFlag: ActivityContentInput & { slug: string } = {
  slug: 'spot-every-red-flag',
  title: 'Spot Every Red Flag',
  description:
    'Five real-looking lures, one at a time. Draw a box around everything that gives each one away: every red flag you find drops a numbered marker, and three wrong boxes end the screenshot. Ten minutes on the clock.',
  completionMessage:
    'Every lure you just saw used the same tricks: a look-alike sender or link, a deadline, an authority, and a request for something it should never ask for. STOP → THINK → VERIFY → REPORT.',
  settings: {
    feedbackMode: 'instant',
    // The live game: each box is judged as soon as it is checked.
    resultsRelease: 'immediate',
    navigation: 'linear',
    timeLimitSec: 600,
    shuffleOptions: false,
    shuffleQuestions: false,
    leaderboard: 'always',
    certificateEnabled: true,
    certificateMinPct: 60,
    passingPct: 60,
  },
  sections: [
    {
      id: id('s'),
      title: 'The account-suspension email',
      intro: 'This email arrived in an HRRL Outlook inbox on a Monday morning.',
      image: { url: 'seed:s1-outlook-email.png', w: 1536, h: 1024, alt: 'Outlook email claiming an HRRL Microsoft 365 account will be disabled today' },
      questions: [
        spot(
          '**What is wrong with this email?** Draw a box around every red flag you can find.',
          [email.sender, email.disabled, email.verify, email.button, email.deadline],
          'A look-alike domain, a threat, a deadline and a "verify now" button: four classic levers in one message. Go to Microsoft 365 the way you always do, never through the email.',
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The Microsoft sign-in page',
      intro: 'A link in an unexpected email opened this page.',
      image: { url: 'seed:s2-login-page.png', w: 1536, h: 1024, alt: 'Browser showing a Microsoft-style sign-in page at login-microsoft365-security.com' },
      questions: [
        spot(
          '**Box everything that tells you this sign-in page is fake.**',
          [login.url, login.brand, login.field],
          'The address bar is the only part a copier cannot fake. The real domain is everything before the first single "/" — here, not Microsoft. The padlock only means the connection is encrypted.',
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The WhatsApp HR message',
      intro: 'This message arrived on your phone from a number you have not saved.',
      image: { url: 'seed:s3-whatsapp.png', w: 1536, h: 1024, alt: 'WhatsApp message from an unknown number sending an HR policy PDF' },
      questions: [
        spot(
          '**Box every warning sign in this WhatsApp message.**',
          [whatsapp.number, whatsapp.today, whatsapp.pdf, whatsapp.mandatory, whatsapp.signature],
          'Anyone can type "HR Department". An unknown number, a deadline and an unexpected attachment mean: verify through an official channel before opening anything.',
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The Teams travel-reimbursement request',
      intro: 'A colleague you recognise sent you this Microsoft Teams message.',
      image: { url: 'seed:s4-teams.png', w: 1536, h: 1024, alt: 'Teams chat asking the employee to update travel details through an external form link' },
      questions: [
        spot(
          '**A familiar name sent this. Box every red flag anyway.**',
          [teams.url, teams.eod, teams.card, teams.ask],
          'Read the link slowly: "hrll", not "hrrl". A known name is exactly what an attacker who has copied or taken over an account would use.',
        ),
      ],
    },
    {
      id: id('s'),
      title: 'The salary-revision document',
      intro: 'You opened an attached document about salary revisions.',
      image: { url: 'seed:s5-word-doc.png', w: 1536, h: 1024, alt: 'Word document in Protected View asking the user to Enable Content to see salary details' },
      questions: [
        spot(
          '**Before you click anything: box every red flag in this document.**',
          [word.filename, word.enable, word.instruction, word.lure],
          'A .docm file is macro-enabled, and "Enable Content" is what lets those macros run. Salary, bonus and appraisal topics are favourite bait.',
        ),
      ],
    },
  ],
};
