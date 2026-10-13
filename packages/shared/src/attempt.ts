import { z } from 'zod';
import {
  imageRefSchema,
  regionSchema,
  QUESTION_TYPES,
  FEEDBACK_MODES,
  NAVIGATION_MODES,
  LEADERBOARD_MODES,
  type ActivityStatus,
  type ImageRef,
  type QuestionType,
  type Region,
  type SpotBox,
} from './activity';

/* ------------------------------------------------------------------ */
/* Public (employee-facing) shapes — built by ALLOWLIST, never by      */
/* deleting fields from the admin document. Nothing here may carry an  */
/* answer key.                                                          */
/* ------------------------------------------------------------------ */

export const publicOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  image: imageRefSchema.nullish(),
});

export const publicQuestionSchema = z.object({
  id: z.string(),
  code: z.string(),
  sectionId: z.string(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  image: imageRefSchema.nullish(),
  points: z.number(),
  bonus: z.boolean(),
  required: z.boolean(),
  maxTries: z.number(),
  options: z.array(publicOptionSchema).optional(),
  trueLabel: z.string().optional(),
  falseLabel: z.string().optional(),
  inputCount: z.number().optional(),
  unit: z.string().optional(),
  /** Ordering items, pre-shuffled by the server (never in solved order). */
  orderItems: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  scaleMax: z.number().optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  /** spot_flags: how many red flags there are, and how many wrong boxes are allowed. */
  flagCount: z.number().optional(),
  maxMisses: z.number().optional(),
});
export type PublicQuestion = z.infer<typeof publicQuestionSchema>;

export const publicSectionSchema = z.object({
  id: z.string(),
  index: z.number(),
  title: z.string(),
  intro: z.string(),
  image: imageRefSchema.nullish(),
  outro: z.string(),
  questionIds: z.array(z.string()),
});
export type PublicSection = z.infer<typeof publicSectionSchema>;

export interface PublicActivity {
  slug: string;
  code: string;
  title: string;
  description: string;
  coverImage: ImageRef | null;
  status: ActivityStatus;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  sectionCount: number;
  timeLimitSec: number | null;
  feedbackMode: (typeof FEEDBACK_MODES)[number];
  navigation: (typeof NAVIGATION_MODES)[number];
  leaderboard: (typeof LEADERBOARD_MODES)[number];
  showScore: boolean;
  /** Right/wrong is shown while answering (instant feedback with results released right away). */
  liveFeedback: boolean;
  /** visible: results are out; pending: held until an admin publishes; never: admins only. */
  resultsStatus: 'visible' | 'pending' | 'never';
  certificateEnabled: boolean;
  certificateMinPct: number;
  /** Section titles in order, for the "in this case" list on the start page. */
  outline: string[];
  employeeIdPattern: string;
  employeeIdHint: string;
  serverNow: string;
}

/* ------------------------------------------------------------------ */
/* Answers                                                              */
/* ------------------------------------------------------------------ */

export const hotspotPointSchema = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

export const spotBoxSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(0.5).max(100),
  h: z.number().min(0.5).max(100),
});
/** Answers saved before boxes existed hold circles; they are still read and scored. */
export const spotCircleSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  r: z.number().min(0.5).max(40),
});
/** Stored value of a spot_flags answer. Only the server writes it, one box at a time. */
export const spotValueSchema = z.object({ marks: z.array(z.union([spotBoxSchema, spotCircleSchema])).max(80) });
export type SpotValue = z.infer<typeof spotValueSchema>;

export const spotMarkInputSchema = spotBoxSchema.extend({ seq: z.number().int().min(0) });
export type SpotMarkInput = z.infer<typeof spotMarkInputSchema>;

export const answerValueSchema = z.union([
  z.string().max(5000),
  z.array(z.string().max(500)).max(50),
  z.boolean(),
  z.number(),
  hotspotPointSchema,
  spotValueSchema,
  z.null(),
]);
export type AnswerValue = z.infer<typeof answerValueSchema>;

export const saveAnswerSchema = z.object({
  value: answerValueSchema,
  /** Monotonic client counter; stale saves are rejected. */
  seq: z.number().int().min(0),
  /** In instant mode, "check" locks the answer (or spends a try) and returns the reveal. */
  check: z.boolean().default(false),
});
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

export const enterSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  employeeId: z.string().trim().min(1, 'Enter your employee ID').max(40),
  resumeCode: z.string().trim().max(12).optional(),
  token: z.string().max(200).optional(),
});
export type EnterInput = z.infer<typeof enterSchema>;

/** Correct-answer description, sent only after reveal. */
export interface CorrectAnswer {
  optionIds?: string[];
  boolean?: boolean;
  text?: string[];
  groups?: { id: string; label: string; keywords: string[]; matched: boolean }[];
  minGroups?: number;
  number?: number;
  tolerance?: number;
  order?: { id: string; label: string }[];
  regions?: Region[];
  /** spot_flags: indexes (into regions) the employee found. */
  foundIndexes?: number[];
}

export interface Reveal {
  questionId: string;
  isCorrect: boolean | null;
  points: number;
  maxPoints: number;
  needsReview: boolean;
  correct: CorrectAnswer | null;
  explanation: string;
  revealText: string;
  highlights: Region[];
}

export interface AnswerState {
  value: AnswerValue;
  locked: boolean;
  tries: number;
  seq: number;
}

export interface AttemptResult {
  score: number;
  maxScore: number;
  pct: number;
  passed: boolean;
  pendingReview: boolean;
  durationSec: number;
  rank: number | null;
  rankOf: number | null;
  certificateCode: string | null;
  submitReason: SubmitReason;
}

export const SUBMIT_REASONS = ['user', 'timeout', 'closed', 'admin'] as const;
export type SubmitReason = (typeof SUBMIT_REASONS)[number];

export interface AttemptState {
  attemptId: string;
  token?: string;
  resumeCode: string;
  status: 'in_progress' | 'submitted';
  name: string;
  employeeId: string;
  startedAt: string | null;
  deadlineAt: string | null;
  serverNow: string;
  activity: PublicActivity;
  sections: PublicSection[];
  questions: PublicQuestion[];
  answers: Record<string, AnswerState>;
  /** Reveals already earned (instant mode, or review after submission). */
  reveals: Record<string, Reveal>;
  /** Next-clue text is part of the story, shown once an answer locks in any mode. */
  revealTexts: Record<string, string>;
  completionMessage: string | null;
  result: AttemptResult | null;
  reviewAvailable: boolean;
  /** Live progress of every spot_flags question: only flags already found are disclosed. */
  spot: Record<string, SpotState>;
}

export interface SpotFound {
  /** Position in the answer key; employees see it as marker number index + 1. */
  index: number;
  region: Region;
}

export interface SpotState {
  total: number;
  maxMisses: number;
  misses: number;
  found: SpotFound[];
  /** Where wrong boxes landed, so they stay visible. */
  missMarks: SpotBox[];
  locked: boolean;
  /** Results held: boxes are recorded without saying whether they hit. */
  silent: boolean;
  /** Silent mode only: every box drawn, and the most allowed. */
  drawn: SpotBox[];
  maxMarks: number;
}

export interface SpotMarkResponse {
  outcome: 'hit' | 'miss' | 'repeat' | 'recorded';
  hit: SpotFound | null;
  spot: SpotState;
  answer: AnswerState;
  reveal: Reveal | null;
  revealText: string | null;
  serverNow: string;
}

export interface SaveAnswerResponse {
  answer: AnswerState;
  reveal: Reveal | null;
  /** Instant mode with tries left: whether this try was right, without the key. */
  tryResult: { isCorrect: boolean; triesLeft: number } | null;
  revealText: string | null;
  serverNow: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  employeeIdMasked: string;
  pct: number;
  score: number;
  maxScore: number;
  durationSec: number;
  pending: boolean;
  isYou?: boolean;
  /** Admin view only: opens the person's response. */
  attemptId?: string;
}

export interface LeaderboardResponse {
  activity: { title: string; code: string; slug: string; status: ActivityStatus };
  entries: LeaderboardEntry[];
  participants: number;
  serverNow: string;
}

export interface CertificateResponse {
  code: string;
  name: string;
  employeeIdMasked: string;
  activityTitle: string;
  activityCode: string;
  pct: number;
  score: number;
  maxScore: number;
  submittedAt: string;
  /** Per-question outcomes in order: true correct, false wrong, null unscored. Drives the certificate's print. */
  pattern: (boolean | null)[];
}

/* ------------------------------------------------------------------ */
/* Helpers shared by both sides                                         */
/* ------------------------------------------------------------------ */

export function normalizeEmployeeId(raw: string): string {
  return raw.normalize('NFKC').trim().toUpperCase().replace(/[\s\-_.]/g, '');
}

export function maskEmployeeId(id: string): string {
  if (id.length <= 3) return '•'.repeat(id.length);
  return `${'•'.repeat(Math.max(2, id.length - 3))}${id.slice(-3)}`;
}

export function isAnswered(type: QuestionType, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    return type === 'ordering' ? value.length > 0 : value.some((v) => v.trim().length > 0);
  }
  if (typeof value === 'object' && 'marks' in value) return value.marks.length > 0;
  return true;
}
