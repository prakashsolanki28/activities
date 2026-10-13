import { z } from 'zod';
import type { AnswerValue, Reveal, SubmitReason } from './attempt';
import type { QuestionType } from './activity';

export const ADMIN_ROLES = ['owner', 'editor'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(200),
});

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
  role: z.enum(ADMIN_ROLES).default('editor'),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(ADMIN_ROLES).optional(),
  password: z.string().min(10).max(200).optional(),
});

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt: string;
}

export const attemptListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'in_progress', 'submitted', 'pending_review']).default('all'),
  sort: z
    .enum(['submittedAt', 'startedAt', 'pct', 'durationSec', 'name', 'employeeId'])
    .default('submittedAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type AttemptListQuery = z.infer<typeof attemptListQuerySchema>;

export interface AdminAttemptRow {
  _id: string;
  name: string;
  employeeId: string;
  status: 'in_progress' | 'submitted';
  submitReason: SubmitReason | null;
  startedAt: string | null;
  submittedAt: string | null;
  score: number;
  maxScore: number;
  pct: number;
  durationSec: number | null;
  pendingReview: boolean;
  hiddenFromLeaderboard: boolean;
  answeredCount: number;
  ip: string;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminAnswerDetail {
  questionId: string;
  code: string;
  type: QuestionType;
  prompt: string;
  value: AnswerValue | null;
  display: string;
  tries: number;
  answeredAt: string | null;
  reveal: Reveal;
  /** The answer key in words, for admins reviewing a response. */
  correctDisplay: string;
  override: number | null;
}

export interface AdminAttemptDetail extends AdminAttemptRow {
  resumeCode: string;
  userAgent: string;
  answers: AdminAnswerDetail[];
  certificateCode: string | null;
}

export const gradeOverrideSchema = z.object({
  questionId: z.string().min(1),
  /** null clears the override. */
  points: z.number().min(0).nullable(),
});

export const attemptPatchSchema = z.object({
  hiddenFromLeaderboard: z.boolean().optional(),
  grades: z.array(gradeOverrideSchema).optional(),
});

export interface QuestionInsight {
  questionId: string;
  code: string;
  type: QuestionType;
  prompt: string;
  answered: number;
  correct: number;
  pctCorrect: number | null;
  /** For choice types: how many picked each option. */
  options?: { id: string; label: string; correct: boolean; count: number }[];
  /** For list_text: how often each keyword group was matched. */
  groups?: { id: string; label: string; count: number }[];
  topWrong?: { text: string; count: number }[];
  /** spot_flags: how many employees found each red flag. */
  flags?: { index: number; label: string; found: number }[];
}

export interface ActivityInsights {
  participants: number;
  submitted: number;
  inProgress: number;
  avgPct: number | null;
  medianDurationSec: number | null;
  passRate: number | null;
  histogram: { bucket: string; from: number; to: number; count: number }[];
  questions: QuestionInsight[];
  sharedIpFlags: { ip: string; attempts: number }[];
}

export interface DashboardData {
  counts: { live: number; scheduled: number; draft: number; closed: number };
  today: { started: number; submitted: number };
  totals: { attempts: number; submitted: number; avgPct: number | null };
  recent: {
    _id: string;
    activityId: string;
    activityTitle: string;
    activityCode: string;
    name: string;
    employeeId: string;
    pct: number;
    pendingReview: boolean;
    submittedAt: string;
  }[];
  activities: {
    _id: string;
    code: string;
    title: string;
    slug: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
    submittedCount: number;
    avgPct: number | null;
  }[];
  /** Submissions per day, last 14 days (Asia/Kolkata). */
  daily: { date: string; submitted: number }[];
}
