import { questionSchema, replaySpot, type QuestionInput } from '@hrrl/shared';
import { gradeAnswer, normalizeText, levenshtein, correctAnswerFor } from './grading';

const q = (input: Partial<QuestionInput> & { type: QuestionInput['type'] }) =>
  questionSchema.parse({ id: 'q1', prompt: 'p', points: 2, ...input });

describe('normalizeText', () => {
  it('lowercases, strips punctuation and articles, collapses space', () => {
    expect(normalizeText('  A Cybersecurity-Aware   Employee! ')).toBe('cybersecurity aware employee');
  });
});

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('malware', 'malwear')).toBe(2);
    expect(levenshtein('phishing', 'phising')).toBe(1);
  });
});

describe('single', () => {
  const question = q({
    type: 'single',
    options: [
      { id: 'a', label: 'Legit' },
      { id: 'b', label: 'Phishing', correct: true },
    ],
  });
  it('awards points for the correct option', () => {
    expect(gradeAnswer(question, 'b')).toMatchObject({ isCorrect: true, points: 2, maxPoints: 2 });
  });
  it('gives zero for a wrong or missing answer', () => {
    expect(gradeAnswer(question, 'a')).toMatchObject({ isCorrect: false, points: 0 });
    expect(gradeAnswer(question, undefined)).toMatchObject({ isCorrect: false, points: 0 });
  });
});

describe('multi', () => {
  const options = [
    { id: 'a', label: 'A', correct: true },
    { id: 'b', label: 'B', correct: true },
    { id: 'c', label: 'C', correct: true },
    { id: 'd', label: 'D' },
  ];
  it('all-or-nothing needs the exact set', () => {
    const question = q({ type: 'multi', options });
    expect(gradeAnswer(question, ['a', 'b', 'c']).isCorrect).toBe(true);
    expect(gradeAnswer(question, ['a', 'b']).points).toBe(0);
  });
  it('partial credit subtracts wrong picks, so ticking everything does not pay', () => {
    const question = q({ type: 'multi', options, multiScoring: 'partial', points: 3 });
    expect(gradeAnswer(question, ['a', 'b']).points).toBe(2);
    expect(gradeAnswer(question, ['a', 'b', 'c', 'd']).points).toBe(2);
    expect(gradeAnswer(question, ['d']).points).toBe(0);
    expect(gradeAnswer(question, ['a', 'b', 'c']).isCorrect).toBe(true);
  });
});

describe('boolean', () => {
  it('compares against the key', () => {
    const question = q({ type: 'boolean', correctBoolean: false });
    expect(gradeAnswer(question, false).isCorrect).toBe(true);
    expect(gradeAnswer(question, true).isCorrect).toBe(false);
  });
});

describe('short_text', () => {
  const question = q({
    type: 'short_text',
    acceptedAnswers: ['Multi-Factor Authentication', 'MFA', '2FA'],
  });
  it('accepts synonyms, case and punctuation variants', () => {
    expect(gradeAnswer(question, 'mfa').isCorrect).toBe(true);
    expect(gradeAnswer(question, 'multi factor authentication').isCorrect).toBe(true);
    expect(gradeAnswer(question, 'Multifactor authentication').isCorrect).toBe(true);
    expect(gradeAnswer(question, 'It is MFA').isCorrect).toBe(true);
  });
  it('tolerates typos only on longer answers', () => {
    expect(gradeAnswer(question, 'multi factor autentication').isCorrect).toBe(true);
    expect(gradeAnswer(question, 'MTA').isCorrect).toBe(false);
  });
  it('does not reward pasting a pile of keywords', () => {
    expect(gradeAnswer(question, 'malware phishing ransomware firewall antivirus mfa vpn password').isCorrect).toBe(false);
  });
  it('can disable typo tolerance', () => {
    const strict = q({ type: 'short_text', acceptedAnswers: ['phishing'], allowTypos: false });
    expect(gradeAnswer(strict, 'phising').isCorrect).toBe(false);
    expect(gradeAnswer(strict, 'PHISHING').isCorrect).toBe(true);
  });
});

describe('list_text', () => {
  const question = q({
    type: 'list_text',
    points: 5,
    inputCount: 5,
    minGroups: 5,
    keywordGroups: [
      { id: 'g1', label: 'Urgent language', keywords: ['urgent', 'urgency'] },
      { id: 'g2', label: 'Threat of suspension', keywords: ['suspension', 'suspend', 'deleted', 'threat'] },
      { id: 'g3', label: 'Short deadline', keywords: ['deadline', '30 minutes', 'time limit'] },
      { id: 'g4', label: 'Suspicious link', keywords: ['link', 'url'] },
      { id: 'g5', label: 'Asks for password', keywords: ['password'] },
      { id: 'g6', label: 'Asks for OTP', keywords: ['otp', 'one time password'] },
      { id: 'g7', label: 'Unexpected request', keywords: ['unexpected', 'verification'] },
    ],
  });
  it('counts each group once and each input once', () => {
    const r = gradeAnswer(question, ['Urgent tone', 'asks for my password', 'asks for OTP', 'a link', 'deadline of 30 minutes']);
    expect(r.isCorrect).toBe(true);
    expect(r.points).toBe(5);
  });
  it('gives partial credit below the threshold', () => {
    const r = gradeAnswer(question, ['urgent', 'urgency', 'password', '', '']);
    expect(r.isCorrect).toBe(false);
    expect(r.points).toBe(2);
  });
  it('one input packed with keywords only matches one group', () => {
    const r = gradeAnswer(question, ['urgent suspension deadline link password otp', '', '', '', '']);
    expect(r.points).toBe(1);
  });
  it('reports which groups matched for the reveal', () => {
    const c = correctAnswerFor(question, ['urgent', 'otp', '', '', '']);
    expect(c?.groups?.filter((g) => g.matched).map((g) => g.id)).toEqual(['g1', 'g6']);
  });
});

describe('long_text', () => {
  it('is unscored unless manual review is on', () => {
    expect(gradeAnswer(q({ type: 'long_text' }), 'anything')).toMatchObject({ isCorrect: null, maxPoints: 0 });
    expect(gradeAnswer(q({ type: 'long_text', manualReview: true }), 'anything')).toMatchObject({
      isCorrect: null,
      needsReview: true,
      maxPoints: 2,
      points: 0,
    });
  });
  it('a blank manual-review answer needs no review', () => {
    expect(gradeAnswer(q({ type: 'long_text', manualReview: true }), '  ')).toMatchObject({ needsReview: false, isCorrect: false });
  });
});

describe('number', () => {
  const question = q({ type: 'number', correctNumber: 100000, tolerance: 0 });
  it('strips Indian and Western separators', () => {
    expect(gradeAnswer(question, '1,00,000').isCorrect).toBe(true);
    expect(gradeAnswer(question, '100,000').isCorrect).toBe(true);
    expect(gradeAnswer(question, 100000).isCorrect).toBe(true);
    expect(gradeAnswer(question, '99999').isCorrect).toBe(false);
  });
  it('honours tolerance', () => {
    expect(gradeAnswer(q({ type: 'number', correctNumber: 10, tolerance: 0.5 }), '10.4').isCorrect).toBe(true);
  });
});

describe('ordering', () => {
  const question = q({
    type: 'ordering',
    points: 4,
    orderItems: [
      { id: 's', label: 'Stop' },
      { id: 't', label: 'Think' },
      { id: 'v', label: 'Verify' },
      { id: 'r', label: 'Report' },
    ],
  });
  it('full marks for the exact order', () => {
    expect(gradeAnswer(question, ['s', 't', 'v', 'r'])).toMatchObject({ isCorrect: true, points: 4 });
  });
  it('partial credit by longest common subsequence', () => {
    expect(gradeAnswer(question, ['t', 's', 'v', 'r'])).toMatchObject({ isCorrect: false, points: 3 });
  });
});

describe('hotspot', () => {
  const question = q({ type: 'hotspot', regions: [{ id: 'r1', x: 40, y: 10, w: 20, h: 5 }] });
  it('hits inside a region, with finger padding', () => {
    expect(gradeAnswer(question, { x: 50, y: 12 }).isCorrect).toBe(true);
    expect(gradeAnswer(question, { x: 39, y: 9 }).isCorrect).toBe(true);
    expect(gradeAnswer(question, { x: 10, y: 80 }).isCorrect).toBe(false);
  });
});

describe('rating and bonus', () => {
  it('rating is unscored', () => {
    expect(gradeAnswer(q({ type: 'rating' }), 4)).toMatchObject({ isCorrect: null, maxPoints: 0, points: 0 });
  });
  it('bonus counts toward score but not max', () => {
    const bonus = q({ type: 'boolean', correctBoolean: true, bonus: true });
    expect(gradeAnswer(bonus, true)).toMatchObject({ points: 2, maxPoints: 0 });
  });
});

describe('spot_flags', () => {
  // Flags in % of the image.
  const question = q({
    type: 'spot_flags',
    points: 4,
    regions: [
      { id: 'a', x: 10, y: 10, w: 20, h: 4, label: 'Sender domain' },
      { id: 'b', x: 60, y: 50, w: 10, h: 10, label: 'Verify button' },
      { id: 'c', x: 0, y: 80, w: 100, h: 6, label: 'Protected View bar' },
      { id: 'd', x: 70, y: 81, w: 8, h: 3, label: 'Enable Content button' },
    ],
  });
  type Box = { x: number; y: number; w: number; h: number };
  const judge = (boxes: Box[]) => replaySpot(question.regions, boxes, 1);
  const kinds = (boxes: Box[]) => judge(boxes).outcomes.map((o) => o.kind);

  it('a box around a flag finds it; boxing it again is a repeat, not a miss', () => {
    const r = judge([
      { x: 9, y: 9, w: 23, h: 6 },
      { x: 11, y: 10, w: 18, h: 4 },
    ]);
    expect(r.outcomes.map((o) => o.kind)).toEqual(['hit', 'repeat']);
    expect(r.misses).toBe(0);
  });

  it('a box away from every flag is a miss', () => {
    expect(kinds([{ x: 40, y: 30, w: 10, h: 5 }])).toEqual(['miss']);
  });

  it('a box that only grazes a flag is a miss', () => {
    // Overlaps the sender domain by a sliver at its right end.
    expect(kinds([{ x: 29, y: 9, w: 12, h: 6 }])).toEqual(['miss']);
  });

  it('a loose box far bigger than a small flag does not count', () => {
    expect(kinds([{ x: 40, y: 30, w: 40, h: 35 }])).toEqual(['miss']);
  });

  it('a giant box is shrunk to the size limit, so it cannot sweep the screenshot', () => {
    expect(kinds([{ x: 0, y: 0, w: 100, h: 100 }])).toEqual(['miss']);
  });

  it('a tight box inside a large flag finds it', () => {
    expect(judge([{ x: 20, y: 81, w: 15, h: 4 }]).outcomes[0]).toEqual({ kind: 'hit', index: 2 });
  });

  it('the best-fitting flag wins when flags overlap', () => {
    // Around the Enable Content button, which sits inside the Protected View bar.
    expect(judge([{ x: 69, y: 80, w: 10, h: 5 }]).outcomes[0]).toEqual({ kind: 'hit', index: 3 });
  });

  it('still scores answers saved as circles, using the image aspect ratio', () => {
    const legacy = replaySpot(question.regions, [{ x: 20, y: 12, r: 3 }], 1);
    expect(legacy.outcomes[0]).toEqual({ kind: 'hit', index: 0 });
  });

  it('scores the share of flags found', () => {
    const sender = { x: 9, y: 9, w: 23, h: 6 };
    const verify = { x: 59, y: 49, w: 12, h: 12 };
    const bar = { x: 20, y: 81, w: 15, h: 4 };
    const enable = { x: 69, y: 80, w: 10, h: 5 };
    expect(gradeAnswer(question, { marks: [sender] }, 1)).toMatchObject({ isCorrect: false, points: 1, maxPoints: 4 });
    expect(gradeAnswer(question, { marks: [sender, verify, bar, enable] }, 1)).toMatchObject({ isCorrect: true, points: 4 });
    expect(gradeAnswer(question, undefined, 1)).toMatchObject({ isCorrect: false, points: 0 });
  });

  it('reports which flags were found for the reveal', () => {
    expect(correctAnswerFor(question, { marks: [{ x: 59, y: 49, w: 12, h: 12 }] }, 1)?.foundIndexes).toEqual([1]);
  });
});
