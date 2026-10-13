import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Interval } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  activityStatus,
  isAnswered,
  maskEmployeeId,
  normalizeEmployeeId,
  type AnswerState,
  type AnswerValue,
  type AttemptResult,
  type AttemptState,
  type CertificateResponse,
  type EnterInput,
  type LeaderboardResponse,
  type Question,
  type Reveal,
  type SaveAnswerInput,
  type SaveAnswerResponse,
  type SpotMarkInput,
  type SpotMarkResponse,
  type SpotState,
  clampSpotBox,
  judgeSpotMark,
  replaySpot,
  type SubmitReason,
} from '@hrrl/shared';
import { Activity } from '../activities/activity.schema';
import { Attempt, AttemptDocument, type StoredAnswer } from './attempt.schema';
import { AppError } from '../common/errors';
import { hashToken, humanCode, newToken, SAFE_ID, shuffle } from '../common/ids';
import { DEADLINE_GRACE_MS } from '../config';
import { gradeAnswer } from './grading';
import {
  aspectOf,
  indexQuestions,
  liveFeedback,
  liveSpot,
  maxSilentMarks,
  resultsVisible,
  spotStateFor,
  publicActivity,
  publicQuestion,
  publicSections,
  revealFor,
  settingsOf,
  type ActivityLean,
  type IndexedQuestion,
} from './serialize';

type AttemptLean = Attempt & { _id: Types.ObjectId; tokenHashes?: string[] };

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const err = {
  notFound: () => new AppError(HttpStatus.NOT_FOUND, 'not_found', 'This activity link is not available.'),
  badToken: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'invalid_token', 'This session is no longer valid on this device. Enter your details again.'),
};

@Injectable()
export class AttemptsService {
  private readonly log = new Logger(AttemptsService.name);

  constructor(
    @InjectModel(Attempt.name) private readonly attempts: Model<Attempt>,
    @InjectModel(Activity.name) private readonly activities: Model<Activity>,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Loading                                                            */
  /* ---------------------------------------------------------------- */

  private async activityBySlug(slug: string): Promise<ActivityLean> {
    const a = await this.activities.findOne({ slug }).lean<ActivityLean>();
    if (!a || !a.publishedAt) throw err.notFound();
    return a;
  }

  private async load(attemptId: string, token: string | undefined) {
    if (!Types.ObjectId.isValid(attemptId) || !token) throw err.badToken();
    const attempt = await this.attempts.findById(attemptId).select('+tokenHashes').lean<AttemptLean>();
    if (!attempt || !attempt.current || !attempt.tokenHashes?.includes(hashToken(token))) throw err.badToken();
    const activity = await this.activities.findById(attempt.activityId).lean<ActivityLean>();
    if (!activity || !activity.publishedAt) throw err.notFound();
    return this.expireIfNeeded(attempt, activity);
  }

  /** Lazily finalise attempts whose time is up or whose activity has closed. */
  private async expireIfNeeded(attempt: AttemptLean, activity: ActivityLean) {
    if (attempt.status !== 'in_progress') return { attempt, activity };
    const now = Date.now();
    let reason: SubmitReason | null = null;
    if (attempt.deadlineAt && now > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS) reason = 'timeout';
    else if (activityStatus(activity) === 'closed') reason = 'closed';
    if (!reason) return { attempt, activity };
    const finalized = await this.finalize(attempt._id, reason);
    return { attempt: finalized ?? attempt, activity };
  }

  /* ---------------------------------------------------------------- */
  /* Public lifecycle                                                   */
  /* ---------------------------------------------------------------- */

  async publicMeta(slug: string) {
    return publicActivity(await this.activityBySlug(slug));
  }

  async enter(slug: string, input: EnterInput, meta: { ip: string; userAgent: string }) {
    const activity = await this.activityBySlug(slug);
    const settings = settingsOf(activity);
    const employeeId = input.employeeId.trim();
    const employeeIdNorm = normalizeEmployeeId(employeeId);
    if (!employeeIdNorm) throw new AppError(HttpStatus.BAD_REQUEST, 'invalid_employee_id', 'Enter your employee ID.');
    if (settings.employeeIdPattern) {
      let ok = true;
      try {
        ok = new RegExp(settings.employeeIdPattern).test(employeeId);
      } catch {
        ok = true; // a broken admin pattern must not lock everyone out
      }
      if (!ok) {
        throw new AppError(
          HttpStatus.BAD_REQUEST,
          'invalid_employee_id',
          settings.employeeIdHint || 'That employee ID does not look right. Check it and try again.',
        );
      }
    }

    const existing = await this.attempts
      .findOne({ activityId: activity._id, employeeIdNorm, current: true })
      .select('+tokenHashes')
      .lean<AttemptLean>();
    if (existing) return this.resumeExisting(existing, activity, input);

    const status = activityStatus(activity);
    if (status === 'scheduled') throw new AppError(HttpStatus.FORBIDDEN, 'not_open', 'This activity has not opened yet.');
    if (status === 'closed') throw new AppError(HttpStatus.FORBIDDEN, 'closed', 'This activity has closed.');

    const { questionOrder, optionOrder } = this.buildOrder(activity);
    const token = newToken();
    const result = await this.attempts.findOneAndUpdate(
      { activityId: activity._id, employeeIdNorm, current: true },
      {
        $setOnInsert: {
          activityId: activity._id,
          employeeIdNorm,
          current: true,
          name: input.name.trim().replace(/\s+/g, ' '),
          employeeId,
          status: 'in_progress',
          questionOrder,
          optionOrder,
          answers: {},
          tokenHashes: [hashToken(token)],
          resumeCode: humanCode(6),
          ip: meta.ip,
          userAgent: meta.userAgent.slice(0, 300),
        },
      },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true },
    );
    if (result.lastErrorObject?.updatedExisting) {
      // Lost a race with another device entering the same ID at the same moment.
      const winner = await this.attempts.findById(result.value!._id).select('+tokenHashes').lean<AttemptLean>();
      return this.resumeExisting(winner!, activity, input);
    }
    const attempt = await this.attempts.findById(result.value!._id).lean<AttemptLean>();
    return { state: await this.fullState(attempt!, activity, token) };
  }

  private async resumeExisting(existing: AttemptLean, activity: ActivityLean, input: EnterInput) {
    if (input.token && existing.tokenHashes?.includes(hashToken(input.token))) {
      const { attempt } = await this.expireIfNeeded(existing, activity);
      return { state: await this.fullState(attempt, activity, input.token) };
    }
    if (input.resumeCode && input.resumeCode.trim().toUpperCase() === existing.resumeCode) {
      const token = newToken();
      await this.attempts.updateOne({ _id: existing._id }, { $push: { tokenHashes: hashToken(token) } });
      const { attempt } = await this.expireIfNeeded(existing, activity);
      return { state: await this.fullState(attempt, activity, token) };
    }
    if (input.resumeCode) {
      throw new AppError(HttpStatus.CONFLICT, 'bad_resume_code', 'That resume code does not match. Check it and try again.');
    }
    if (existing.status === 'submitted') {
      throw new AppError(
        HttpStatus.CONFLICT,
        'already_submitted',
        'This employee ID has already completed this activity. If that was not you, contact the CISO office.',
      );
    }
    throw new AppError(
      HttpStatus.CONFLICT,
      'resume_code_required',
      'This employee ID already has the activity in progress. Enter the resume code shown when it started.',
    );
  }

  private buildOrder(activity: ActivityLean) {
    const s = settingsOf(activity);
    const questionOrder: string[] = [];
    const optionOrder: Record<string, string[]> = {};
    for (const section of activity.sections) {
      const live = section.questions.filter((q) => !q.archived);
      // Sections stay in order: questions refer to their section's evidence.
      const ordered = s.shuffleQuestions ? shuffle(live) : live;
      for (const q of ordered) {
        questionOrder.push(q.id);
        if (s.shuffleOptions && (q.type === 'single' || q.type === 'multi')) optionOrder[q.id] = shuffle(q.options.map((o) => o.id));
        if (q.type === 'ordering') optionOrder[q.id] = this.unsolvedShuffle(q.orderItems.map((i) => i.id));
      }
    }
    return { questionOrder, optionOrder };
  }

  /** The starting order of an ordering question must never be the answer. */
  private unsolvedShuffle(ids: string[]): string[] {
    if (ids.length < 2) return ids;
    for (let i = 0; i < 10; i++) {
      const out = shuffle(ids);
      if (out.some((id, k) => id !== ids[k])) return out;
    }
    return [...ids.slice(1), ids[0]];
  }

  async getState(attemptId: string, token: string | undefined): Promise<AttemptState> {
    const { attempt, activity } = await this.load(attemptId, token);
    return this.fullState(attempt, activity);
  }

  /** State plus the result block once submitted. */
  private async fullState(attempt: AttemptLean, activity: ActivityLean, token?: string): Promise<AttemptState> {
    const state = this.stateFor(attempt, activity, token);
    if (attempt.status === 'submitted' && resultsVisible(activity)) state.result = await this.resultFor(attempt, activity);
    return state;
  }

  async start(attemptId: string, token: string | undefined): Promise<AttemptState> {
    const { attempt, activity } = await this.load(attemptId, token);
    if (attempt.status === 'in_progress' && !attempt.startedAt) {
      const now = new Date();
      const s = settingsOf(activity);
      const limits = [s.timeLimitSec ? now.getTime() + s.timeLimitSec * 1000 : Infinity, activity.closesAt?.getTime() ?? Infinity];
      const deadline = Math.min(...limits);
      await this.attempts.updateOne(
        { _id: attempt._id, startedAt: null },
        { $set: { startedAt: now, deadlineAt: Number.isFinite(deadline) ? new Date(deadline) : null } },
      );
    }
    return this.getState(attemptId, token);
  }

  async saveAnswer(attemptId: string, questionId: string, token: string | undefined, input: SaveAnswerInput): Promise<SaveAnswerResponse> {
    if (!SAFE_ID.test(questionId)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Question not found.');
    const { attempt, activity } = await this.load(attemptId, token);
    if (attempt.status !== 'in_progress') {
      throw new AppError(HttpStatus.CONFLICT, 'submitted', 'This activity has already been submitted.');
    }
    if (!attempt.startedAt) throw new AppError(HttpStatus.CONFLICT, 'not_started', 'Start the activity first.');
    const index = indexQuestions(activity.sections);
    const entry = index.get(questionId);
    if (!entry || !attempt.questionOrder.includes(questionId)) {
      throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Question not found.');
    }
    const q = entry.question;
    if (q.type === 'spot_flags') return this.finishSpot(attempt, activity, entry, input);
    const value = this.coerceValue(q, input.value);
    const prev = attempt.answers?.[questionId];
    if (prev?.locked) throw new AppError(HttpStatus.CONFLICT, 'locked', 'This answer is already locked in.');
    if (prev && prev.seq >= input.seq) {
      throw new AppError(HttpStatus.CONFLICT, 'stale', 'A newer answer was already saved.', { answer: this.answerState(prev) });
    }

    const s = settingsOf(activity);
    // Right/wrong only when results are released right away; otherwise answers just lock.
    const instant = liveFeedback(activity);
    const linear = s.feedbackMode === 'instant' || s.navigation === 'linear';
    let locked = false;
    let tries = prev?.tries ?? 0;
    let tryResult: SaveAnswerResponse['tryResult'] = null;
    let grade: ReturnType<typeof gradeAnswer> | null = null;

    if (input.check) {
      if (!isAnswered(q.type, value)) throw new AppError(HttpStatus.BAD_REQUEST, 'empty', 'Answer the question first.');
      if (instant) {
        grade = gradeAnswer(q, value, aspectOf(entry));
        tries += 1;
        const settled = grade.isCorrect !== false || tries >= q.maxTries;
        locked = settled;
        if (!settled) tryResult = { isCorrect: false, triesLeft: q.maxTries - tries };
      } else if (linear) {
        locked = true;
      }
    }

    const stored: StoredAnswer = {
      value,
      seq: input.seq,
      tries,
      locked,
      answeredAt: new Date(),
      ...(grade ? { isCorrect: grade.isCorrect, points: grade.points, maxPoints: grade.maxPoints, needsReview: grade.needsReview } : {}),
    };
    const path = `answers.${questionId}`;
    const updated = await this.attempts.findOneAndUpdate(
      {
        _id: attempt._id,
        status: 'in_progress',
        $and: [
          { $or: [{ deadlineAt: null }, { deadlineAt: { $gt: new Date(Date.now() - DEADLINE_GRACE_MS) } }] },
          { $or: [{ [`${path}.seq`]: { $exists: false } }, { [`${path}.seq`]: { $lt: input.seq } }] },
        ],
        [`${path}.locked`]: { $ne: true },
      },
      { $set: { [path]: stored } },
      { returnDocument: 'after' },
    );
    if (!updated) {
      const fresh = await this.attempts.findById(attempt._id).lean<AttemptLean>();
      if (fresh?.status !== 'in_progress') throw new AppError(HttpStatus.CONFLICT, 'submitted', 'This activity has already been submitted.');
      const current = fresh.answers?.[questionId];
      if (current?.locked) throw new AppError(HttpStatus.CONFLICT, 'locked', 'This answer is already locked in.');
      if (current && current.seq >= input.seq) {
        throw new AppError(HttpStatus.CONFLICT, 'stale', 'A newer answer was already saved.', { answer: this.answerState(current) });
      }
      throw new AppError(HttpStatus.CONFLICT, 'time_up', 'Time is up for this activity.');
    }

    return {
      answer: this.answerState(stored),
      reveal: instant && locked ? revealFor(entry, stored) : null,
      tryResult,
      revealText: locked && q.revealText ? q.revealText : null,
      serverNow: new Date().toISOString(),
    };
  }

  async submit(attemptId: string, token: string | undefined): Promise<AttemptState> {
    const { attempt } = await this.load(attemptId, token);
    if (attempt.status === 'in_progress') {
      // The client submits the moment its countdown ends; that is a timeout, not a choice.
      const timedOut = !!attempt.deadlineAt && Date.now() >= attempt.deadlineAt.getTime() - 1500;
      await this.finalize(attempt._id, timedOut ? 'timeout' : 'user');
    }
    return this.getState(attemptId, token);
  }

  /* ---------------------------------------------------------------- */
  /* Spot the red flags: judged one box at a time                       */
  /* ---------------------------------------------------------------- */

  async spotMark(attemptId: string, questionId: string, token: string | undefined, input: SpotMarkInput): Promise<SpotMarkResponse> {
    if (!SAFE_ID.test(questionId)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Question not found.');
    const { attempt, activity } = await this.load(attemptId, token);
    if (attempt.status !== 'in_progress') throw new AppError(HttpStatus.CONFLICT, 'submitted', 'This activity has already been submitted.');
    if (!attempt.startedAt) throw new AppError(HttpStatus.CONFLICT, 'not_started', 'Start the activity first.');
    const entry = indexQuestions(activity.sections).get(questionId);
    if (!entry || entry.question.type !== 'spot_flags' || !attempt.questionOrder.includes(questionId)) {
      throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Question not found.');
    }
    const q = entry.question;
    const prev = attempt.answers?.[questionId];
    if (prev?.locked) throw new AppError(HttpStatus.CONFLICT, 'locked', 'This question is already finished.');
    if (prev && prev.seq >= input.seq) throw new AppError(HttpStatus.CONFLICT, 'stale', 'A newer mark was already saved.');

    const aspect = aspectOf(entry);
    const marks = prev?.value && typeof prev.value === 'object' && !Array.isArray(prev.value) && 'marks' in prev.value ? prev.value.marks : [];
    const box = clampSpotBox({ x: input.x, y: input.y, w: input.w, h: input.h });
    const before = replaySpot(q.regions, marks, aspect);
    const outcome = judgeSpotMark(box, q.regions, before.found, aspect);
    // Repeats are not stored: they neither count against the employee nor change the score.
    const silent = !liveSpot(activity);
    if (silent && marks.length >= maxSilentMarks(q)) {
      throw new AppError(HttpStatus.CONFLICT, 'locked', 'No boxes left for this screenshot.');
    }
    const nextMarks = outcome.kind === 'repeat' && !silent ? marks : [...marks, box];
    const after = replaySpot(q.regions, nextMarks, aspect);
    // Held results: nothing is announced, so the question only ends at the box cap or "I'm done".
    const locked = silent
      ? nextMarks.length >= maxSilentMarks(q)
      : after.found.size === q.regions.length || (q.maxMisses > 0 && after.misses >= q.maxMisses);
    const grade = locked ? gradeAnswer(q, { marks: nextMarks }, aspect) : null;
    const stored: StoredAnswer = {
      value: { marks: nextMarks },
      seq: input.seq,
      tries: nextMarks.length,
      locked,
      answeredAt: new Date(),
      ...(grade ? { isCorrect: grade.isCorrect, points: grade.points, maxPoints: grade.maxPoints, needsReview: false } : {}),
    };
    await this.writeAnswer(attempt._id, questionId, input.seq, stored);
    return this.spotResponse(entry, stored, activity, outcome);
  }

  /** "I'm done": lock a spot_flags question with the flags found so far. */
  private async finishSpot(attempt: AttemptLean, activity: ActivityLean, entry: IndexedQuestion, input: SaveAnswerInput): Promise<SaveAnswerResponse> {
    if (!input.check) throw new AppError(HttpStatus.BAD_REQUEST, 'invalid_answer', 'Mark the red flags on the screenshot.');
    const prev = attempt.answers?.[entry.question.id];
    if (prev?.locked) throw new AppError(HttpStatus.CONFLICT, 'locked', 'This question is already finished.');
    const value = prev?.value ?? { marks: [] };
    const grade = gradeAnswer(entry.question, value, aspectOf(entry));
    const stored: StoredAnswer = {
      value,
      seq: input.seq,
      tries: prev?.tries ?? 0,
      locked: true,
      answeredAt: new Date(),
      isCorrect: grade.isCorrect,
      points: grade.points,
      maxPoints: grade.maxPoints,
      needsReview: false,
    };
    await this.writeAnswer(attempt._id, entry.question.id, input.seq, stored);
    const showReveal = liveSpot(activity);
    return {
      answer: this.answerState(stored),
      reveal: showReveal ? revealFor(entry, stored) : null,
      tryResult: null,
      revealText: entry.question.revealText || null,
      serverNow: new Date().toISOString(),
    };
  }

  private spotResponse(entry: IndexedQuestion, stored: StoredAnswer, activity: ActivityLean, outcome: ReturnType<typeof judgeSpotMark>): SpotMarkResponse {
    const silent = !liveSpot(activity);
    const spot = spotStateFor(entry, stored, silent);
    const showReveal = stored.locked && !silent;
    return {
      outcome: silent ? 'recorded' : outcome.kind,
      hit: !silent && outcome.kind === 'hit' ? { index: outcome.index, region: entry.question.regions[outcome.index] } : null,
      spot,
      answer: this.answerState(stored),
      reveal: showReveal ? revealFor(entry, stored) : null,
      revealText: stored.locked && entry.question.revealText ? entry.question.revealText : null,
      serverNow: new Date().toISOString(),
    };
  }

  /** Conditional single-answer write shared by every save path: in progress, in time, not locked, newer seq. */
  private async writeAnswer(attemptId: Types.ObjectId, questionId: string, seq: number, stored: StoredAnswer) {
    const path = `answers.${questionId}`;
    const updated = await this.attempts.findOneAndUpdate(
      {
        _id: attemptId,
        status: 'in_progress',
        $and: [
          { $or: [{ deadlineAt: null }, { deadlineAt: { $gt: new Date(Date.now() - DEADLINE_GRACE_MS) } }] },
          { $or: [{ [`${path}.seq`]: { $exists: false } }, { [`${path}.seq`]: { $lt: seq } }] },
        ],
        [`${path}.locked`]: { $ne: true },
      },
      { $set: { [path]: stored } },
      { returnDocument: 'after' },
    );
    if (updated) return;
    const fresh = await this.attempts.findById(attemptId).lean<AttemptLean>();
    if (fresh?.status !== 'in_progress') throw new AppError(HttpStatus.CONFLICT, 'submitted', 'This activity has already been submitted.');
    const current = fresh.answers?.[questionId];
    if (current?.locked) throw new AppError(HttpStatus.CONFLICT, 'locked', 'This question is already finished.');
    if (current && current.seq >= seq) throw new AppError(HttpStatus.CONFLICT, 'stale', 'A newer answer was already saved.');
    throw new AppError(HttpStatus.CONFLICT, 'time_up', 'Time is up for this activity.');
  }

  /** Validate the shape of an answer for its question type; null clears an answer. */
  private coerceValue(q: Question, value: AnswerValue): AnswerValue {
    const bad = () => new AppError(HttpStatus.BAD_REQUEST, 'invalid_answer', 'That answer is not valid for this question.');
    if (value === null) return null;
    const optionIds = new Set(q.options.map((o) => o.id));
    switch (q.type) {
      case 'single':
        if (typeof value !== 'string' || !optionIds.has(value)) throw bad();
        return value;
      case 'multi':
        if (!Array.isArray(value) || !value.every((v) => optionIds.has(v))) throw bad();
        return [...new Set(value)];
      case 'boolean':
        if (typeof value !== 'boolean') throw bad();
        return value;
      case 'short_text':
        if (typeof value !== 'string') throw bad();
        return value.slice(0, 500);
      case 'long_text':
        if (typeof value !== 'string') throw bad();
        return value.slice(0, 5000);
      case 'list_text':
        if (!Array.isArray(value) || value.length > q.inputCount) throw bad();
        return value.map((v) => String(v).slice(0, 300));
      case 'number':
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.length <= 40) return value;
        throw bad();
      case 'ordering': {
        const ids = q.orderItems.map((i) => i.id);
        if (!Array.isArray(value) || value.length !== ids.length || !ids.every((id) => value.includes(id))) throw bad();
        return value;
      }
      case 'hotspot':
        if (typeof value !== 'object' || Array.isArray(value) || !('x' in value)) throw bad();
        return { x: Math.min(100, Math.max(0, value.x)), y: Math.min(100, Math.max(0, value.y)) };
      case 'rating':
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > q.scaleMax) throw bad();
        return value;
      case 'spot_flags':
        throw bad();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Finalising and grading                                             */
  /* ---------------------------------------------------------------- */

  /** Flip to submitted exactly once, then grade. Safe to call concurrently and repeatedly. */
  async finalize(attemptId: Types.ObjectId, reason: SubmitReason): Promise<AttemptLean | null> {
    const now = new Date();
    await this.attempts.updateOne(
      { _id: attemptId, status: 'in_progress' },
      { $set: { status: 'submitted', submittedAt: now, submitReason: reason } },
    );
    const attempt = await this.attempts.findById(attemptId).lean<AttemptLean>();
    if (!attempt) return null;
    if (attempt.gradedAt) return attempt;
    const activity = await this.activities.findById(attempt.activityId).lean<ActivityLean>();
    if (!activity) return attempt;
    return this.grade(attempt, activity);
  }

  /** (Re)compute scores for a submitted attempt, keeping manual overrides. */
  async grade(attempt: AttemptLean, activity: ActivityLean): Promise<AttemptLean | null> {
    const s = settingsOf(activity);
    const index = indexQuestions(activity.sections);
    const answers: Record<string, StoredAnswer> = { ...(attempt.answers ?? {}) };
    let score = 0;
    let maxScore = 0;
    let pendingReview = false;
    for (const qid of attempt.questionOrder) {
      const entry = index.get(qid);
      if (!entry) continue;
      const stored = answers[qid];
      const g = gradeAnswer(entry.question, stored?.value ?? undefined, aspectOf(entry));
      const override = stored?.override ?? null;
      const points = override ?? g.points;
      const needsReview = override == null && g.needsReview;
      score += points;
      maxScore += g.maxPoints;
      pendingReview ||= needsReview;
      if (stored) {
        answers[qid] = { ...stored, isCorrect: g.isCorrect, points, maxPoints: g.maxPoints, needsReview };
      }
    }
    const pct = maxScore > 0 ? Math.min(100, round1((score / maxScore) * 100)) : 100;
    const end = attempt.submittedAt ?? new Date();
    const begin = attempt.startedAt ?? attempt.createdAt;
    let durationSec = Math.max(0, Math.round((end.getTime() - begin.getTime()) / 1000));
    if (s.timeLimitSec) durationSec = Math.min(durationSec, s.timeLimitSec);
    const earnsCertificate = s.certificateEnabled && !pendingReview && pct >= s.certificateMinPct;
    const certificateCode = earnsCertificate ? (attempt.certificateCode ?? humanCode(8)) : null;

    return this.attempts
      .findOneAndUpdate(
        { _id: attempt._id, status: 'submitted' },
        { $set: { answers, score: round2(score), maxScore: round2(maxScore), pct, durationSec, pendingReview, certificateCode, gradedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .lean<AttemptLean>();
  }

  @Interval('attempt-sweeper', 30_000)
  async sweep() {
    try {
      const cutoff = new Date(Date.now() - DEADLINE_GRACE_MS);
      const timedOut = await this.attempts.find({ status: 'in_progress', deadlineAt: { $lt: cutoff } }, { _id: 1 }).limit(500).lean();
      for (const a of timedOut) await this.finalize(a._id, 'timeout');

      const closed = await this.activities.find({ closesAt: { $lte: new Date() } }, { _id: 1 }).lean();
      if (closed.length) {
        const open = await this.attempts
          .find({ status: 'in_progress', activityId: { $in: closed.map((c) => c._id) } }, { _id: 1 })
          .limit(500)
          .lean();
        for (const a of open) await this.finalize(a._id, 'closed');
      }
      const ungraded = await this.attempts.find({ status: 'submitted', gradedAt: null }, { _id: 1 }).limit(100).lean();
      for (const a of ungraded) await this.finalize(a._id, 'user');
    } catch (e) {
      this.log.error('Sweep failed', e as Error);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Views                                                              */
  /* ---------------------------------------------------------------- */

  private answerState(a: StoredAnswer): AnswerState {
    return { value: a.value, locked: a.locked, tries: a.tries, seq: a.seq };
  }

  reviewAvailable(activity: ActivityLean, attempt: Pick<Attempt, 'status'>): boolean {
    if (attempt.status !== 'submitted' || !resultsVisible(activity)) return false;
    const s = settingsOf(activity);
    if (s.feedbackMode === 'instant' || s.resultsRelease === 'manual') return true;
    return s.reviewAvailable === 'after_submit' || activityStatus(activity) === 'closed';
  }

  stateFor(attempt: AttemptLean, activity: ActivityLean, token?: string): AttemptState {
    const s = settingsOf(activity);
    const index = indexQuestions(activity.sections);
    const order = attempt.questionOrder.filter((qid) => index.has(qid));
    const reviewAvailable = this.reviewAvailable(activity, attempt);
    const answers: Record<string, AnswerState> = {};
    const reveals: Record<string, Reveal> = {};
    const revealTexts: Record<string, string> = {};
    const spot: Record<string, SpotState> = {};
    for (const qid of order) {
      const entry = index.get(qid)!;
      const stored = attempt.answers?.[qid];
      if (stored) answers[qid] = this.answerState(stored);
      const lockedOrDone = stored?.locked || attempt.status === 'submitted';
      if (lockedOrDone && entry.question.revealText && s.feedbackMode !== 'hidden') revealTexts[qid] = entry.question.revealText;
      const isSpot = entry.question.type === 'spot_flags';
      const liveReveal = (isSpot ? liveSpot(activity) : liveFeedback(activity)) && stored?.locked;
      if (reviewAvailable || liveReveal) reveals[qid] = revealFor(entry, stored);
      if (isSpot) spot[qid] = spotStateFor(entry, stored, !liveSpot(activity));
    }
    return {
      attemptId: String(attempt._id),
      ...(token ? { token } : {}),
      resumeCode: attempt.resumeCode,
      status: attempt.status,
      name: attempt.name,
      employeeId: attempt.employeeId,
      startedAt: attempt.startedAt?.toISOString() ?? null,
      deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
      serverNow: new Date().toISOString(),
      activity: publicActivity(activity),
      sections: publicSections(activity, order, index),
      questions: order.map((qid) => publicQuestion(index.get(qid)!, attempt.optionOrder?.[qid])),
      answers,
      reveals,
      revealTexts,
      completionMessage: attempt.status === 'submitted' ? activity.completionMessage || null : null,
      result: null,
      reviewAvailable,
      spot,
    };
  }

  async resultFor(attempt: AttemptLean, activity: ActivityLean): Promise<AttemptResult> {
    const s = settingsOf(activity);
    let rank: number | null = null;
    let rankOf: number | null = null;
    if (s.leaderboard !== 'off' && s.showScore && !attempt.hiddenFromLeaderboard) {
      const base = { activityId: activity._id, status: 'submitted' as const, current: true, hiddenFromLeaderboard: false };
      const [ahead, total] = await Promise.all([
        this.attempts.countDocuments({
          ...base,
          $or: [{ pct: { $gt: attempt.pct } }, { pct: attempt.pct, durationSec: { $lt: attempt.durationSec ?? 0 } }],
        }),
        this.attempts.countDocuments(base),
      ]);
      rank = ahead + 1;
      rankOf = total;
    }
    const hide = !s.showScore;
    return {
      score: hide ? 0 : attempt.score,
      maxScore: hide ? 0 : attempt.maxScore,
      pct: hide ? 0 : attempt.pct,
      passed: !hide && attempt.pct >= s.passingPct,
      pendingReview: attempt.pendingReview,
      durationSec: attempt.durationSec ?? 0,
      rank,
      rankOf,
      certificateCode: attempt.certificateCode,
      submitReason: attempt.submitReason ?? 'user',
    };
  }

  async leaderboard(slug: string, token: string | undefined, opts: { admin?: boolean; activityId?: string } = {}): Promise<LeaderboardResponse> {
    const activity = opts.activityId
      ? await this.activities.findById(opts.activityId).lean<ActivityLean>()
      : await this.activities.findOne({ slug }).lean<ActivityLean>();
    if (!activity || (!opts.admin && !activity.publishedAt)) throw err.notFound();
    const s = settingsOf(activity);
    let youId: string | null = null;
    if (token) {
      const mine = await this.attempts
        .findOne({ activityId: activity._id, current: true, tokenHashes: hashToken(token) })
        .select('+tokenHashes')
        .lean<AttemptLean>();
      if (mine) youId = String(mine._id);
      if (mine && mine.status !== 'submitted') youId = null;
    }
    if (!opts.admin) {
      if (s.leaderboard === 'off' || !s.showScore) throw new AppError(HttpStatus.NOT_FOUND, 'no_leaderboard', 'This activity has no leaderboard.');
      if (!resultsVisible(activity)) throw new AppError(HttpStatus.FORBIDDEN, 'results_pending', 'The leaderboard appears once the CISO Office publishes results.');
      if (s.leaderboard === 'after_submit' && !youId) {
        throw new AppError(HttpStatus.FORBIDDEN, 'leaderboard_locked', 'The leaderboard opens once you have submitted.');
      }
    }
    const base = { activityId: activity._id, status: 'submitted' as const, current: true, hiddenFromLeaderboard: false };
    const [rows, participants] = await Promise.all([
      this.attempts.find(base).sort({ pct: -1, durationSec: 1, submittedAt: 1 }).limit(100).lean<AttemptLean[]>(),
      this.attempts.countDocuments(base),
    ]);
    return {
      activity: { title: activity.title, code: activity.code, slug: activity.slug, status: activityStatus(activity) },
      participants,
      serverNow: new Date().toISOString(),
      entries: rows.map((r, i) => ({
        rank: i + 1,
        name: r.name,
        employeeIdMasked: opts.admin ? r.employeeId : maskEmployeeId(r.employeeId),
        pct: r.pct,
        score: r.score,
        maxScore: r.maxScore,
        durationSec: r.durationSec ?? 0,
        pending: r.pendingReview,
        ...(youId && String(r._id) === youId ? { isYou: true } : {}),
        ...(opts.admin ? { attemptId: String(r._id) } : {}),
      })),
    };
  }

  async certificate(code: string): Promise<CertificateResponse> {
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(clean)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Certificate not found.');
    const attempt = await this.attempts.findOne({ certificateCode: clean, status: 'submitted', current: true }).lean<AttemptLean>();
    if (!attempt) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Certificate not found.');
    const activity = await this.activities.findById(attempt.activityId).lean<ActivityLean>();
    if (!activity || !resultsVisible(activity)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Certificate not found.');
    const index = indexQuestions(activity.sections);
    const pattern: (boolean | null)[] = [];
    for (const [qid, entry] of index) {
      const a = attempt.answers?.[qid];
      pattern.push(entry.question.type === 'rating' ? null : (a?.isCorrect ?? false));
    }
    return {
      code: clean,
      name: attempt.name,
      employeeIdMasked: maskEmployeeId(attempt.employeeId),
      activityTitle: activity.title,
      activityCode: activity.code,
      pct: attempt.pct,
      score: attempt.score,
      maxScore: attempt.maxScore,
      submittedAt: attempt.submittedAt!.toISOString(),
      pattern,
    };
  }

  indexFor(activity: ActivityLean): Map<string, IndexedQuestion> {
    return indexQuestions(activity.sections);
  }
}
