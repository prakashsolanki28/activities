import { z } from 'zod';

export const QUESTION_TYPES = [
  'single',
  'multi',
  'boolean',
  'short_text',
  'list_text',
  'long_text',
  'number',
  'ordering',
  'hotspot',
  'rating',
  'spot_flags',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Types that never contribute to the score. */
export const UNSCORED_TYPES: readonly QuestionType[] = ['rating'];

export const FEEDBACK_MODES = ['instant', 'end', 'hidden'] as const;
export type FeedbackMode = (typeof FEEDBACK_MODES)[number];

export const NAVIGATION_MODES = ['linear', 'free'] as const;
export const LEADERBOARD_MODES = ['off', 'after_submit', 'always'] as const;
export const REVIEW_AVAILABILITY = ['after_submit', 'after_close'] as const;
export const MULTI_SCORING = ['all_or_nothing', 'partial'] as const;
/** When employees see their results: straight away, once an admin publishes them, or never. */
export const RESULTS_RELEASE = ['immediate', 'manual', 'never'] as const;
export type ResultsRelease = (typeof RESULTS_RELEASE)[number];

export const ACTIVITY_STATUSES = ['draft', 'scheduled', 'live', 'closed'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

const id = z.string().min(1).max(64);

export const imageRefSchema = z.object({
  url: z.string().min(1),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  alt: z.string().max(300).default(''),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

/** A rectangle on an image, in percent of the image's natural size (0–100). */
export const regionSchema = z.object({
  id,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0.5).max(100),
  h: z.number().min(0.5).max(100),
  label: z.string().max(200).default(''),
});
export type Region = z.infer<typeof regionSchema>;

export const optionSchema = z.object({
  id,
  label: z.string().max(500).default(''),
  image: imageRefSchema.nullish(),
  correct: z.boolean().default(false),
});
export type Option = z.infer<typeof optionSchema>;

export const orderItemSchema = z.object({ id, label: z.string().min(1).max(300) });

export const keywordGroupSchema = z.object({
  id,
  label: z.string().max(200).default(''),
  keywords: z.array(z.string().min(1).max(100)).min(1),
});
export type KeywordGroup = z.infer<typeof keywordGroupSchema>;

export const questionSchema = z.object({
  id,
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().max(4000).default(''),
  image: imageRefSchema.nullish(),
  points: z.number().min(0).max(100).default(1),
  bonus: z.boolean().default(false),
  required: z.boolean().default(true),
  maxTries: z.number().int().min(1).max(5).default(1),
  // spot_flags: wrong boxes allowed before the question locks (0 = unlimited)
  maxMisses: z.number().int().min(0).max(10).default(3),
  explanation: z.string().max(4000).default(''),
  revealText: z.string().max(2000).default(''),
  /** Red-flag regions on the section evidence, lit up once the answer is revealed. */
  highlights: z.array(regionSchema).default([]),
  archived: z.boolean().default(false),

  // single / multi
  options: z.array(optionSchema).default([]),
  multiScoring: z.enum(MULTI_SCORING).default('all_or_nothing'),
  // boolean
  trueLabel: z.string().max(40).default('Yes'),
  falseLabel: z.string().max(40).default('No'),
  correctBoolean: z.boolean().nullish(),
  // short_text
  acceptedAnswers: z.array(z.string().min(1).max(200)).default([]),
  allowTypos: z.boolean().default(true),
  // list_text
  inputCount: z.number().int().min(1).max(12).default(5),
  keywordGroups: z.array(keywordGroupSchema).default([]),
  minGroups: z.number().int().min(1).max(12).default(1),
  // long_text
  manualReview: z.boolean().default(false),
  // number
  correctNumber: z.number().nullish(),
  tolerance: z.number().min(0).default(0),
  unit: z.string().max(20).default(''),
  // ordering (items stored in the correct order)
  orderItems: z.array(orderItemSchema).default([]),
  // hotspot (correct regions on question.image, falling back to the section image)
  regions: z.array(regionSchema).default([]),
  // rating
  scaleMax: z.number().int().min(3).max(10).default(5),
  minLabel: z.string().max(60).default(''),
  maxLabel: z.string().max(60).default(''),
});
export type Question = z.infer<typeof questionSchema>;
export type QuestionInput = z.input<typeof questionSchema>;

export const sectionSchema = z.object({
  id,
  title: z.string().max(200).default(''),
  intro: z.string().max(4000).default(''),
  image: imageRefSchema.nullish(),
  outro: z.string().max(2000).default(''),
  questions: z.array(questionSchema).default([]),
});
export type Section = z.infer<typeof sectionSchema>;

export const activitySettingsSchema = z.object({
  feedbackMode: z.enum(FEEDBACK_MODES).default('end'),
  resultsRelease: z.enum(RESULTS_RELEASE).default('manual'),
  reviewAvailable: z.enum(REVIEW_AVAILABILITY).default('after_submit'),
  showScore: z.boolean().default(true),
  navigation: z.enum(NAVIGATION_MODES).default('free'),
  timeLimitSec: z.number().int().min(30).max(6 * 3600).nullish(),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  leaderboard: z.enum(LEADERBOARD_MODES).default('after_submit'),
  certificateEnabled: z.boolean().default(true),
  certificateMinPct: z.number().min(0).max(100).default(60),
  passingPct: z.number().min(0).max(100).default(60),
  employeeIdPattern: z.string().max(200).default(''),
  employeeIdHint: z.string().max(120).default(''),
});
export type ActivitySettings = z.infer<typeof activitySettingsSchema>;

export const activityContentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).default(''),
  coverImage: imageRefSchema.nullish(),
  completionMessage: z.string().max(4000).default(''),
  settings: activitySettingsSchema.default(activitySettingsSchema.parse({})),
  sections: z.array(sectionSchema).default([]),
});
export type ActivityContent = z.infer<typeof activityContentSchema>;
export type ActivityContentInput = z.input<typeof activityContentSchema>;

/**
 * Body for PATCH /api/admin/activities/:id. Every field is optional with NO defaults:
 * Zod 4 applies defaults inside .partial(), which would silently reset omitted fields.
 */
export const activityUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  coverImage: imageRefSchema.nullish(),
  completionMessage: z.string().max(4000).optional(),
  settings: activitySettingsSchema.optional(),
  sections: z.array(sectionSchema).optional(),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes')
    .optional(),
  version: z.number().int().min(0),
});
export type ActivityUpdate = z.infer<typeof activityUpdateSchema>;

export const activityCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
});

export const scheduleSchema = z
  .object({
    opensAt: z.iso.datetime().nullish(),
    closesAt: z.iso.datetime().nullish(),
  })
  .refine((v) => !v.opensAt || !v.closesAt || new Date(v.opensAt) < new Date(v.closesAt), {
    message: 'Close time must be after open time',
    path: ['closesAt'],
  });
export type ScheduleInput = z.infer<typeof scheduleSchema>;

/** Full activity as the admin API returns it. */
export interface AdminActivity extends ActivityContent {
  _id: string;
  code: string;
  slug: string;
  status: ActivityStatus;
  publishedAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  version: number;
  /** Everyone who has started (in progress or submitted). */
  attemptCount: number;
  /** Responses: people who have submitted. */
  submittedCount: number;
  /** An answer key changed after submissions; stored scores are stale until regraded. */
  needsRegrade: boolean;
  /** Set when an admin publishes results (resultsRelease "manual"). */
  resultsPublishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminActivitySummary {
  _id: string;
  code: string;
  slug: string;
  title: string;
  status: ActivityStatus;
  publishedAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  sectionCount: number;
  attemptCount: number;
  submittedCount: number;
  avgPct: number | null;
  feedbackMode: FeedbackMode;
  resultsRelease: ResultsRelease;
  resultsPublishedAt: string | null;
  updatedAt: string;
}

/** Employees may see scores, answers, leaderboard and certificates. */
export function resultsVisible(a: { settings?: { resultsRelease?: ResultsRelease; feedbackMode?: FeedbackMode }; resultsPublishedAt?: string | Date | null }): boolean {
  const release = a.settings?.feedbackMode === 'hidden' ? 'never' : (a.settings?.resultsRelease ?? 'manual');
  return release === 'immediate' || (release === 'manual' && !!a.resultsPublishedAt);
}

export function activityStatus(
  a: { publishedAt?: string | Date | null; opensAt?: string | Date | null; closesAt?: string | Date | null },
  now: Date = new Date(),
): ActivityStatus {
  if (!a.publishedAt) return 'draft';
  if (a.closesAt && new Date(a.closesAt) <= now) return 'closed';
  if (a.opensAt && new Date(a.opensAt) > now) return 'scheduled';
  return 'live';
}

export function liveQuestions(sections: Pick<Section, 'questions'>[]): Question[] {
  return sections.flatMap((s) => s.questions.filter((q) => !q.archived));
}

/** Stable human code for a question position, e.g. "S2·Q07". */
export function questionCode(sectionIndex: number, questionIndex: number): string {
  return `S${sectionIndex + 1}·Q${String(questionIndex + 1).padStart(2, '0')}`;
}

export function maxPointsFor(q: Pick<Question, 'type' | 'points' | 'bonus' | 'manualReview'>): number {
  if (q.bonus || UNSCORED_TYPES.includes(q.type)) return 0;
  if (q.type === 'long_text' && !q.manualReview) return 0;
  return q.points;
}

export function isScored(q: Pick<Question, 'type' | 'manualReview'>): boolean {
  if (UNSCORED_TYPES.includes(q.type)) return false;
  if (q.type === 'long_text') return q.manualReview;
  return true;
}

/** Problems that block publishing a question; shared so the builder can flag them live. */
export function questionIssues(q: Question, section: Pick<Section, 'image'>): string[] {
  const issues: string[] = [];
  if (!q.prompt.trim()) issues.push('Add the question text.');
  switch (q.type) {
    case 'single':
      if (q.options.length < 2) issues.push('Add at least two options.');
      if (q.options.filter((o) => o.correct).length !== 1) issues.push('Mark exactly one option as correct.');
      if (q.options.some((o) => !o.label.trim() && !o.image)) issues.push('Every option needs a label or an image.');
      break;
    case 'multi':
      if (q.options.length < 2) issues.push('Add at least two options.');
      if (!q.options.some((o) => o.correct)) issues.push('Mark at least one option as correct.');
      if (q.options.some((o) => !o.label.trim() && !o.image)) issues.push('Every option needs a label or an image.');
      break;
    case 'boolean':
      if (q.correctBoolean == null) issues.push(`Choose whether "${q.trueLabel}" or "${q.falseLabel}" is correct.`);
      break;
    case 'short_text':
      if (!q.acceptedAnswers.length) issues.push('Add at least one accepted answer.');
      break;
    case 'list_text':
      if (q.keywordGroups.length < q.minGroups) issues.push('Add at least as many keyword groups as answers required.');
      if (q.minGroups > q.inputCount) issues.push('Answers required cannot exceed the number of answer boxes.');
      break;
    case 'number':
      if (q.correctNumber == null) issues.push('Enter the correct number.');
      break;
    case 'ordering':
      if (q.orderItems.length < 2) issues.push('Add at least two items to order.');
      break;
    case 'hotspot':
      if (!q.image && !section.image) issues.push('Hotspot questions need an image on the question or its section.');
      if (!q.regions.length) issues.push('Draw at least one correct region.');
      break;
    case 'spot_flags':
      if (!q.image && !section.image) issues.push('Add a screenshot to the question or its section.');
      if (!q.regions.length) issues.push('Mark at least one red flag on the screenshot.');
      if (q.regions.some((r) => !r.label.trim())) issues.push('Name every red flag: employees see the name when they find it.');
      break;
    default:
      break;
  }
  return issues;
}

/* ------------------------------------------------------------------ */
/* Spot the red flags: one matching rule for server, preview and regrade */
/* ------------------------------------------------------------------ */

/** A box the employee draws around a red flag: top-left corner and size, in % of image width / height. */
export interface SpotBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Answers saved before boxes existed stored circles: centre in %, radius in % of image width. */
export interface SpotCircle {
  x: number;
  y: number;
  r: number;
}

export type SpotMark = SpotBox | SpotCircle;

export type SpotOutcome = { kind: 'hit'; index: number } | { kind: 'repeat'; index: number } | { kind: 'miss' };

/** Largest box, in % of the image, so one box cannot sweep the screenshot. */
export const SPOT_MAX_W = 60;
export const SPOT_MAX_H = 40;
/** Smallest box side, in % of the image. */
export const SPOT_MIN_SIDE = 1;
/** Forgiveness around a flag, in % of the image on every side. */
const SPOT_PAD = 1;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Keep a box on the image and within the size limits, shrinking or growing it around its centre. */
export function clampSpotBox(b: SpotBox): SpotBox {
  const w = clamp(b.w, SPOT_MIN_SIDE, SPOT_MAX_W);
  const h = clamp(b.h, SPOT_MIN_SIDE, SPOT_MAX_H);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const round = (n: number) => Math.round(n * 10) / 10;
  return { x: round(clamp(cx - w / 2, 0, 100 - w)), y: round(clamp(cy - h / 2, 0, 100 - h)), w: round(w), h: round(h) };
}

/** Any stored mark as a box. A legacy circle becomes its bounding square; `aspect` is image height / width. */
export function toSpotBox(m: SpotMark, aspect: number): SpotBox {
  if ('w' in m) return clampSpotBox(m);
  const r = clamp(m.r, 0.5, 12);
  const ry = r / (aspect || 1);
  return clampSpotBox({ x: m.x - r, y: m.y - ry, w: r * 2, h: ry * 2 });
}

function overlap(a: SpotBox, b: SpotBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Judge one box against the flags. A box finds a flag when it covers most of it without being
 * far bigger than it, or when it sits mostly inside a large flag. The best-fitting flag wins;
 * one that is already found is a repeat. Ratios of areas in % are the same at any aspect ratio.
 */
export function judgeSpotMark(mark: SpotMark, regions: Region[], found: ReadonlySet<number>, aspect: number): SpotOutcome {
  const box = toSpotBox(mark, aspect);
  const boxArea = box.w * box.h;
  let best: { index: number; score: number; area: number } | null = null;
  regions.forEach((r, index) => {
    const padded = { x: r.x - SPOT_PAD, y: r.y - SPOT_PAD, w: r.w + SPOT_PAD * 2, h: r.h + SPOT_PAD * 2 };
    const inter = overlap(box, padded);
    if (!inter) return;
    const cover = inter / (padded.w * padded.h); // how much of the flag the box takes in
    const fill = inter / boxArea; // how much of the box is the flag
    if (!((cover >= 0.4 && fill >= 0.12) || fill >= 0.6)) return;
    const score = cover + fill;
    const area = r.w * r.h;
    if (!best || score > best.score || (score === best.score && area < best.area)) best = { index, score, area };
  });
  if (!best) return { kind: 'miss' };
  const { index } = best as { index: number };
  return found.has(index) ? { kind: 'repeat', index } : { kind: 'hit', index };
}

/** Replay every mark in order: the score is always recomputed from the marks themselves. */
export function replaySpot(regions: Region[], marks: SpotMark[], aspect: number) {
  const found = new Set<number>();
  const outcomes: SpotOutcome[] = [];
  let misses = 0;
  for (const m of marks) {
    const o = judgeSpotMark(m, regions, found, aspect);
    outcomes.push(o);
    if (o.kind === 'hit') found.add(o.index);
    if (o.kind === 'miss') misses++;
  }
  return { found, misses, outcomes };
}
