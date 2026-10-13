import {
  activitySettingsSchema,
  replaySpot,
  toSpotBox,
  resultsVisible as visibleBySettings,
  type ResultsRelease,
  type SpotState,
  activityStatus,
  liveQuestions,
  questionCode,
  type ActivitySettings,
  type PublicActivity,
  type PublicQuestion,
  type PublicSection,
  type Question,
  type Reveal,
  type Section,
} from '@hrrl/shared';
import type { Types } from 'mongoose';
import type { Activity } from '../activities/activity.schema';
import type { StoredAnswer } from './attempt.schema';
import { correctAnswerFor, gradeAnswer } from './grading';

export type ActivityLean = Activity & { _id: Types.ObjectId };

export interface IndexedQuestion {
  question: Question;
  section: Section;
  sectionIndex: number;
  code: string;
}

/** Live questions by id, with their stable authored code (S2·Q07). */
export function indexQuestions(sections: Section[]): Map<string, IndexedQuestion> {
  const map = new Map<string, IndexedQuestion>();
  sections.forEach((section, sectionIndex) => {
    section.questions
      .filter((q) => !q.archived)
      .forEach((question, qi) => map.set(question.id, { question, section, sectionIndex, code: questionCode(sectionIndex, qi) }));
  });
  return map;
}

/** Image height / width for the evidence a question is judged on (spot_flags distances). */
export function aspectOf(entry: IndexedQuestion): number {
  const img = entry.question.image ?? entry.section.image;
  return img ? img.h / img.w : 1;
}

export function releaseOf(a: ActivityLean): ResultsRelease {
  const s = settingsOf(a);
  return s.feedbackMode === 'hidden' ? 'never' : s.resultsRelease;
}

/** Scores, answers, leaderboard and certificates may be shown to employees. */
export function resultsVisible(a: ActivityLean): boolean {
  return visibleBySettings({ settings: settingsOf(a), resultsPublishedAt: a.resultsPublishedAt });
}

/** Right/wrong while answering: only when results are released right away. */
export function liveFeedback(a: ActivityLean): boolean {
  return releaseOf(a) === 'immediate' && settingsOf(a).feedbackMode === 'instant';
}

/** Spot-the-flags judges boxes out loud only when results are released right away. */
export function liveSpot(a: ActivityLean): boolean {
  return releaseOf(a) === 'immediate';
}

export function settingsOf(a: ActivityLean): ActivitySettings {
  return activitySettingsSchema.parse(a.settings ?? {});
}

export function publicActivity(a: ActivityLean, now = new Date()): PublicActivity {
  const s = settingsOf(a);
  return {
    slug: a.slug,
    code: a.code,
    title: a.title,
    description: a.description,
    coverImage: a.coverImage ?? null,
    status: activityStatus(a, now),
    opensAt: a.opensAt ? a.opensAt.toISOString() : null,
    closesAt: a.closesAt ? a.closesAt.toISOString() : null,
    questionCount: liveQuestions(a.sections).length,
    sectionCount: a.sections.filter((sec) => sec.questions.some((q) => !q.archived)).length,
    timeLimitSec: s.timeLimitSec ?? null,
    feedbackMode: s.feedbackMode,
    navigation: s.feedbackMode === 'instant' ? 'linear' : s.navigation,
    leaderboard: s.leaderboard,
    showScore: s.showScore,
    liveFeedback: liveFeedback(a),
    resultsStatus: resultsVisible(a) ? 'visible' : releaseOf(a) === 'never' ? 'never' : 'pending',
    certificateEnabled: s.certificateEnabled,
    certificateMinPct: s.certificateMinPct,
    outline: a.sections.filter((sec) => sec.questions.some((q) => !q.archived)).map((sec) => sec.title),
    employeeIdPattern: s.employeeIdPattern,
    employeeIdHint: s.employeeIdHint,
    serverNow: now.toISOString(),
  };
}

/**
 * ALLOWLIST: every field is copied explicitly. Never spread the admin question here —
 * correct flags, accepted answers, keyword groups, regions, explanations and next clues
 * must not reach the browser before a reveal.
 */
export function publicQuestion(entry: IndexedQuestion, order?: string[]): PublicQuestion {
  const { question: q, section, code } = entry;
  const base: PublicQuestion = {
    id: q.id,
    code,
    sectionId: section.id,
    type: q.type,
    prompt: q.prompt,
    image: q.image ?? null,
    points: q.points,
    bonus: q.bonus,
    required: q.required,
    maxTries: q.maxTries,
  };
  const byOrder = <T extends { id: string }>(items: T[]): T[] => {
    if (!order?.length) return items;
    const pos = new Map(order.map((id, i) => [id, i]));
    return [...items].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  };
  switch (q.type) {
    case 'single':
    case 'multi':
      base.options = byOrder(q.options).map((o) => ({ id: o.id, label: o.label, image: o.image ?? null }));
      break;
    case 'boolean':
      base.trueLabel = q.trueLabel;
      base.falseLabel = q.falseLabel;
      break;
    case 'list_text':
      base.inputCount = q.inputCount;
      break;
    case 'number':
      base.unit = q.unit;
      break;
    case 'ordering':
      base.orderItems = byOrder(q.orderItems).map((i) => ({ id: i.id, label: i.label }));
      break;
    case 'rating':
      base.scaleMax = q.scaleMax;
      base.minLabel = q.minLabel;
      base.maxLabel = q.maxLabel;
      break;
    case 'spot_flags':
      // The count is part of the game; where the flags are is not.
      base.flagCount = q.regions.length;
      base.maxMisses = q.maxMisses;
      break;
    default:
      break;
  }
  return base;
}

export function publicSections(a: ActivityLean, questionOrder: string[], index: Map<string, IndexedQuestion>): PublicSection[] {
  return a.sections
    .map((section, i) => ({
      id: section.id,
      index: i,
      title: section.title,
      intro: section.intro,
      image: section.image ?? null,
      outro: section.outro,
      questionIds: questionOrder.filter((qid) => index.get(qid)?.section.id === section.id),
    }))
    .filter((s) => s.questionIds.length > 0);
}

export function revealFor(entry: IndexedQuestion, stored: StoredAnswer | undefined): Reveal {
  const q = entry.question;
  const aspect = aspectOf(entry);
  const graded = gradeAnswer(q, stored?.value ?? undefined, aspect);
  const override = stored?.override ?? null;
  return {
    questionId: q.id,
    isCorrect: override != null ? override >= graded.maxPoints && graded.maxPoints > 0 : graded.isCorrect,
    points: override ?? graded.points,
    maxPoints: graded.maxPoints,
    needsReview: override == null && graded.needsReview,
    correct: correctAnswerFor(q, stored?.value ?? undefined, aspect),
    explanation: q.explanation,
    revealText: q.revealText,
    // For spot_flags the flags themselves are what gets marked on the evidence.
    highlights: q.type === 'spot_flags' ? q.regions : q.highlights,
  };
}

/** Most boxes allowed when results are held and misses cannot be announced. */
export function maxSilentMarks(q: Question): number {
  return q.regions.length + (q.maxMisses > 0 ? q.maxMisses : q.regions.length);
}

/** Live progress of a spot_flags question. Discloses only flags already found. */
export function spotStateFor(entry: IndexedQuestion, stored: StoredAnswer | undefined, silent = false): SpotState {
  const q = entry.question;
  const aspect = aspectOf(entry);
  const value = stored?.value;
  const marks = value && typeof value === 'object' && !Array.isArray(value) && 'marks' in value ? value.marks : [];
  if (silent) {
    return {
      total: q.regions.length,
      maxMisses: q.maxMisses,
      misses: 0,
      found: [],
      missMarks: [],
      locked: !!stored?.locked,
      silent: true,
      drawn: marks.map((m) => toSpotBox(m, aspect)),
      maxMarks: maxSilentMarks(q),
    };
  }
  const { found, outcomes } = replaySpot(q.regions, marks, aspect);
  return {
    total: q.regions.length,
    maxMisses: q.maxMisses,
    misses: outcomes.filter((o) => o.kind === 'miss').length,
    found: [...found].sort((a, b) => a - b).map((index) => ({ index, region: q.regions[index] })),
    missMarks: marks.filter((_, i) => outcomes[i]?.kind === 'miss').map((m) => toSpotBox(m, aspect)),
    locked: !!stored?.locked,
    silent: false,
    drawn: [],
    maxMarks: 0,
  };
}
