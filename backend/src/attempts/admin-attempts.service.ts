import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import ExcelJS from 'exceljs';
import {
  activityStatus,
  liveQuestions,
  replaySpot,
  type ActivityInsights,
  type AdminAttemptDetail,
  type AdminAttemptRow,
  type AttemptListQuery,
  type DashboardData,
  type Paged,
  type QuestionInsight,
} from '@hrrl/shared';
import { Activity } from '../activities/activity.schema';
import { Attempt } from './attempt.schema';
import { AttemptsService } from './attempts.service';
import { AppError } from '../common/errors';
import { DISPLAY_TZ } from '../config';
import { describeAnswer, describeCorrect, matchKeywordGroups, normalizeText } from './grading';
import { aspectOf, indexQuestions, revealFor, type ActivityLean } from './serialize';

type AttemptLean = Attempt & { _id: Types.ObjectId };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function istDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: DISPLAY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function istDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: DISPLAY_TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

@Injectable()
export class AdminAttemptsService {
  constructor(
    @InjectModel(Attempt.name) private readonly attempts: Model<Attempt>,
    @InjectModel(Activity.name) private readonly activities: Model<Activity>,
    private readonly lifecycle: AttemptsService,
  ) {}

  private async activity(id: string): Promise<ActivityLean> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Activity not found.');
    const a = await this.activities.findById(id).lean<ActivityLean>();
    if (!a) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Activity not found.');
    return a;
  }

  private async attempt(id: string): Promise<AttemptLean> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Response not found.');
    const a = await this.attempts.findOne({ _id: id, current: true }).lean<AttemptLean>();
    if (!a) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Response not found.');
    return a;
  }

  private row(a: AttemptLean): AdminAttemptRow {
    return {
      _id: String(a._id),
      name: a.name,
      employeeId: a.employeeId,
      status: a.status,
      submitReason: a.submitReason,
      startedAt: iso(a.startedAt),
      submittedAt: iso(a.submittedAt),
      score: a.score,
      maxScore: a.maxScore,
      pct: a.pct,
      durationSec: a.durationSec,
      pendingReview: a.pendingReview,
      hiddenFromLeaderboard: a.hiddenFromLeaderboard,
      answeredCount: Object.keys(a.answers ?? {}).length,
      ip: a.ip,
      createdAt: iso(a.createdAt)!,
    };
  }

  private filter(activityId: Types.ObjectId, q: Pick<AttemptListQuery, 'q' | 'status'>): QueryFilter<Attempt> {
    const f: QueryFilter<Attempt> = { activityId, current: true };
    if (q.status === 'in_progress' || q.status === 'submitted') f.status = q.status;
    if (q.status === 'pending_review') f.pendingReview = true;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      f.$or = [{ name: rx }, { employeeId: rx }];
    }
    return f;
  }

  async list(activityId: string, q: AttemptListQuery): Promise<Paged<AdminAttemptRow>> {
    const activity = await this.activity(activityId);
    const f = this.filter(activity._id, q);
    const dir = q.dir === 'asc' ? 1 : -1;
    const sortKey = q.sort === 'employeeId' ? 'employeeIdNorm' : q.sort;
    const [items, total] = await Promise.all([
      this.attempts
        .find(f)
        .sort({ [sortKey]: dir, _id: dir })
        .skip((q.page - 1) * q.pageSize)
        .limit(q.pageSize)
        .lean<AttemptLean[]>(),
      this.attempts.countDocuments(f),
    ]);
    return { items: items.map((a) => this.row(a)), total, page: q.page, pageSize: q.pageSize };
  }

  async detail(attemptId: string): Promise<AdminAttemptDetail> {
    const a = await this.attempt(attemptId);
    const activity = await this.activity(String(a.activityId));
    const index = indexQuestions(activity.sections);
    return {
      ...this.row(a),
      resumeCode: a.resumeCode,
      userAgent: a.userAgent,
      certificateCode: a.certificateCode,
      answers: a.questionOrder
        .filter((qid) => index.has(qid))
        .map((qid) => {
          const entry = index.get(qid)!;
          const stored = a.answers?.[qid];
          return {
            questionId: qid,
            code: entry.code,
            type: entry.question.type,
            prompt: entry.question.prompt,
            value: stored?.value ?? null,
            display: describeAnswer(entry.question, stored?.value, aspectOf(entry)),
            tries: stored?.tries ?? 0,
            answeredAt: iso(stored?.answeredAt),
            reveal: revealFor(entry, stored),
            correctDisplay: describeCorrect(entry.question),
            override: stored?.override ?? null,
          };
        })
        .sort((x, y) => x.code.localeCompare(y.code)),
    };
  }

  async patch(attemptId: string, body: { hiddenFromLeaderboard?: boolean; grades?: { questionId: string; points: number | null }[] }) {
    const a = await this.attempt(attemptId);
    const set: Record<string, unknown> = {};
    if (body.hiddenFromLeaderboard !== undefined) set.hiddenFromLeaderboard = body.hiddenFromLeaderboard;
    if (body.grades?.length) {
      if (a.status !== 'submitted') throw new AppError(HttpStatus.CONFLICT, 'not_submitted', 'Grade after the employee submits.');
      const activity = await this.activity(String(a.activityId));
      const index = indexQuestions(activity.sections);
      for (const g of body.grades) {
        const entry = index.get(g.questionId);
        if (!entry || !a.questionOrder.includes(g.questionId)) throw new AppError(HttpStatus.BAD_REQUEST, 'invalid_question', 'Unknown question.');
        const cap = entry.question.bonus ? entry.question.points : Math.max(entry.question.points, 0);
        if (g.points != null && g.points > cap) {
          throw new AppError(HttpStatus.BAD_REQUEST, 'too_many_points', `At most ${cap} points for ${entry.code}.`);
        }
        if (!a.answers?.[g.questionId]) {
          set[`answers.${g.questionId}`] = { value: null, seq: 0, tries: 0, locked: true, answeredAt: new Date(), override: g.points };
        } else {
          set[`answers.${g.questionId}.override`] = g.points;
        }
      }
    }
    if (Object.keys(set).length) await this.attempts.updateOne({ _id: a._id }, { $set: set });
    if (body.grades?.length) await this.regradeOne(a._id);
    return this.detail(attemptId);
  }

  private async regradeOne(id: Types.ObjectId) {
    const fresh = await this.attempts.findById(id).lean<AttemptLean>();
    const activity = await this.activities.findById(fresh!.activityId).lean<ActivityLean>();
    await this.lifecycle.grade(fresh!, activity!);
  }

  /** Reset: archive the attempt so the employee can start again. Kept for audit. */
  async reset(attemptId: string) {
    const a = await this.attempt(attemptId);
    await this.attempts.updateOne({ _id: a._id }, { $unset: { current: 1 }, $set: { resetAt: new Date() } });
  }

  async regrade(activityId: string) {
    const activity = await this.activity(activityId);
    const submitted = await this.attempts.find({ activityId: activity._id, status: 'submitted' }).lean<AttemptLean[]>();
    for (const a of submitted) await this.lifecycle.grade(a, activity);
    await this.activities.updateOne({ _id: activity._id }, { $set: { needsRegrade: false } });
    return { regraded: submitted.length };
  }

  async insights(activityId: string): Promise<ActivityInsights> {
    const activity = await this.activity(activityId);
    const all = await this.attempts.find({ activityId: activity._id, current: true }).lean<AttemptLean[]>();
    const submitted = all.filter((a) => a.status === 'submitted');
    const index = indexQuestions(activity.sections);
    const durations = submitted.map((a) => a.durationSec ?? 0).sort((x, y) => x - y);
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
    const passing = activity.settings?.passingPct ?? 60;

    const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`, from: i * 10, to: i === 9 ? 100 : i * 10 + 9.99, count: 0 }));
    for (const a of submitted) buckets[Math.min(9, Math.floor(a.pct / 10))].count++;

    const questions: QuestionInsight[] = [];
    for (const [qid, entry] of index) {
      const q = entry.question;
      const answered = submitted.filter((a) => a.answers?.[qid]?.value != null);
      const correct = answered.filter((a) => a.answers[qid].isCorrect === true).length;
      const insight: QuestionInsight = {
        questionId: qid,
        code: entry.code,
        type: q.type,
        prompt: q.prompt,
        answered: answered.length,
        correct,
        pctCorrect: answered.length && q.type !== 'rating' && !(q.type === 'long_text') ? Math.round((correct / answered.length) * 1000) / 10 : null,
      };
      if (q.type === 'single' || q.type === 'multi') {
        insight.options = q.options.map((o) => ({
          id: o.id,
          label: o.label,
          correct: o.correct,
          count: answered.filter((a) => {
            const v = a.answers[qid].value;
            return Array.isArray(v) ? v.includes(o.id) : v === o.id;
          }).length,
        }));
      }
      if (q.type === 'boolean') {
        insight.options = [
          { id: 'true', label: q.trueLabel, correct: q.correctBoolean === true, count: answered.filter((a) => a.answers[qid].value === true).length },
          { id: 'false', label: q.falseLabel, correct: q.correctBoolean === false, count: answered.filter((a) => a.answers[qid].value === false).length },
        ];
      }
      if (q.type === 'rating') {
        insight.options = Array.from({ length: q.scaleMax }, (_, i) => ({
          id: String(i + 1),
          label: String(i + 1),
          correct: false,
          count: answered.filter((a) => a.answers[qid].value === i + 1).length,
        }));
      }
      if (q.type === 'list_text') {
        const counts = new Map<string, number>();
        for (const a of answered) {
          const v = a.answers[qid].value;
          for (const g of matchKeywordGroups(q.keywordGroups, Array.isArray(v) ? v : [])) counts.set(g, (counts.get(g) ?? 0) + 1);
        }
        insight.groups = q.keywordGroups.map((g) => ({ id: g.id, label: g.label || g.keywords[0], count: counts.get(g.id) ?? 0 }));
      }
      if (q.type === 'spot_flags') {
        const counts = new Array<number>(q.regions.length).fill(0);
        for (const a of answered) {
          const v = a.answers[qid].value;
          const marks = v && typeof v === 'object' && !Array.isArray(v) && 'marks' in v ? v.marks : [];
          for (const i of replaySpot(q.regions, marks, aspectOf(entry)).found) counts[i]++;
        }
        insight.flags = q.regions.map((r, index) => ({ index, label: r.label, found: counts[index] }));
      }
      if (q.type === 'short_text' || q.type === 'number') {
        const wrong = new Map<string, number>();
        for (const a of answered) {
          if (a.answers[qid].isCorrect) continue;
          const text = normalizeText(String(a.answers[qid].value ?? ''));
          if (text) wrong.set(text, (wrong.get(text) ?? 0) + 1);
        }
        insight.topWrong = [...wrong.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 5)
          .map(([text, count]) => ({ text, count }));
      }
      questions.push(insight);
    }

    const byIp = new Map<string, number>();
    for (const a of all) if (a.ip) byIp.set(a.ip, (byIp.get(a.ip) ?? 0) + 1);
    // Many IDs from one address is normal on a corporate network, so only flag outliers.
    const threshold = Math.max(10, Math.ceil(all.length * 0.5));
    const sharedIpFlags = [...byIp.entries()].filter(([, n]) => n >= threshold && all.length >= 20).map(([ip, attempts]) => ({ ip, attempts }));

    return {
      participants: all.length,
      submitted: submitted.length,
      inProgress: all.length - submitted.length,
      avgPct: submitted.length ? Math.round((submitted.reduce((s, a) => s + a.pct, 0) / submitted.length) * 10) / 10 : null,
      medianDurationSec: median,
      passRate: submitted.length ? Math.round((submitted.filter((a) => a.pct >= passing).length / submitted.length) * 1000) / 10 : null,
      histogram: buckets,
      questions,
      sharedIpFlags,
    };
  }

  async export(activityId: string, format: 'xlsx' | 'csv'): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const activity = await this.activity(activityId);
    const rows = await this.attempts.find({ activityId: activity._id, current: true }).sort({ submittedAt: -1 }).lean<AttemptLean[]>();
    const index = indexQuestions(activity.sections);
    const entries = [...index.values()];
    const header = [
      'Name',
      'Employee ID',
      'Status',
      'Score',
      'Max score',
      'Percent',
      'Duration (s)',
      'Started (IST)',
      'Submitted (IST)',
      'Ended by',
      'Pending review',
      ...entries.flatMap((e) => [`${e.code} answer`, `${e.code} result`]),
    ];
    const data = rows.map((a) => [
      a.name,
      a.employeeId,
      a.status === 'submitted' ? 'Submitted' : 'In progress',
      a.score,
      a.maxScore,
      a.pct,
      a.durationSec ?? '',
      istDateTime(a.startedAt),
      istDateTime(a.submittedAt),
      a.submitReason ?? '',
      a.pendingReview ? 'Yes' : '',
      ...entries.flatMap((e) => {
        const stored = a.answers?.[e.question.id];
        const result = stored?.isCorrect === true ? 'Correct' : stored?.isCorrect === false ? 'Wrong' : stored?.needsReview ? 'Review' : '';
        return [describeAnswer(e.question, stored?.value, aspectOf(e)), result];
      }),
    ]);
    const base = `${activity.code}-${activity.slug}-responses`;
    if (format === 'csv') {
      const cell = (v: unknown) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [header, ...data].map((r) => r.map(cell).join(',')).join('\r\n');
      return { buffer: Buffer.from('﻿' + csv, 'utf8'), filename: `${base}.csv`, mime: 'text/csv; charset=utf-8' };
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HRRL Activities';
    const ws = wb.addWorksheet('Responses', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] });
    ws.addRow(header);
    data.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c, i) => (c.width = i < 2 ? 22 : i < 11 ? 14 : 28));
    const qs = wb.addWorksheet('Questions');
    qs.addRow(['Code', 'Type', 'Question']);
    entries.forEach((e) => qs.addRow([e.code, e.question.type, e.question.prompt]));
    qs.getRow(1).font = { bold: true };
    qs.columns = [{ width: 10 }, { width: 14 }, { width: 90 }];
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, filename: `${base}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  async dashboard(): Promise<DashboardData> {
    const activities = await this.activities.find().sort({ updatedAt: -1 }).lean<ActivityLean[]>();
    const counts = { live: 0, scheduled: 0, draft: 0, closed: 0 };
    for (const a of activities) counts[activityStatus(a)]++;

    const today = istDate(new Date());
    const since = new Date(Date.now() - 15 * 86400_000);
    const recentAttempts = await this.attempts.find({ current: true, createdAt: { $gte: since } }).lean<AttemptLean[]>();
    const started = recentAttempts.filter((a) => a.startedAt && istDate(a.startedAt) === today).length;
    const submittedToday = recentAttempts.filter((a) => a.submittedAt && istDate(a.submittedAt) === today).length;

    const daily: { date: string; submitted: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = istDate(new Date(Date.now() - i * 86400_000));
      daily.push({ date, submitted: recentAttempts.filter((a) => a.submittedAt && istDate(a.submittedAt) === date).length });
    }

    const [totals] = await this.attempts.aggregate<{ attempts: number; submitted: number; avgPct: number | null }>([
      { $match: { current: true } },
      {
        $group: {
          _id: null,
          attempts: { $sum: 1 },
          submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          avgPct: { $avg: { $cond: [{ $eq: ['$status', 'submitted'] }, '$pct', null] } },
        },
      },
    ]);
    const perActivity = await this.attempts.aggregate<{ _id: Types.ObjectId; submitted: number; avgPct: number | null }>([
      { $match: { current: true, status: 'submitted' } },
      { $group: { _id: '$activityId', submitted: { $sum: 1 }, avgPct: { $avg: '$pct' } } },
    ]);
    const statsById = new Map(perActivity.map((p) => [String(p._id), p]));
    const titleById = new Map(activities.map((a) => [String(a._id), a]));

    const recent = await this.attempts.find({ current: true, status: 'submitted' }).sort({ submittedAt: -1 }).limit(8).lean<AttemptLean[]>();

    return {
      counts,
      today: { started, submitted: submittedToday },
      totals: {
        attempts: totals?.attempts ?? 0,
        submitted: totals?.submitted ?? 0,
        avgPct: totals?.avgPct != null ? Math.round(totals.avgPct * 10) / 10 : null,
      },
      recent: recent.map((a) => ({
        _id: String(a._id),
        activityId: String(a.activityId),
        activityTitle: titleById.get(String(a.activityId))?.title ?? '—',
        activityCode: titleById.get(String(a.activityId))?.code ?? '',
        name: a.name,
        employeeId: a.employeeId,
        pct: a.pct,
        pendingReview: a.pendingReview,
        submittedAt: iso(a.submittedAt)!,
      })),
      activities: activities
        .filter((a) => ['live', 'scheduled'].includes(activityStatus(a)))
        .map((a) => ({
          _id: String(a._id),
          code: a.code,
          title: a.title,
          slug: a.slug,
          status: activityStatus(a),
          opensAt: iso(a.opensAt),
          closesAt: iso(a.closesAt),
          submittedCount: statsById.get(String(a._id))?.submitted ?? 0,
          avgPct: statsById.get(String(a._id))?.avgPct != null ? Math.round(statsById.get(String(a._id))!.avgPct! * 10) / 10 : null,
        })),
      daily,
    };
  }

  questionCount(a: ActivityLean) {
    return liveQuestions(a.sections).length;
  }
}
