import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  activityContentSchema,
  activitySettingsSchema,
  activityStatus,
  liveQuestions,
  questionCode,
  questionIssues,
  type ActivityUpdate,
  type AdminActivity,
  type AdminActivitySummary,
  type Question,
  type ScheduleInput,
  type Section,
} from '@hrrl/shared';
import { Activity, ActivityDocument, Counter } from './activity.schema';
import { Attempt } from '../attempts/attempt.schema';
import { AppError } from '../common/errors';
import { newId, SAFE_ID } from '../common/ids';

type ActivityLean = Activity & { _id: Types.ObjectId };

export interface PublishIssue {
  sectionId: string;
  questionId?: string;
  code: string;
  message: string;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

function slugify(title: string): string {
  return (
    title
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'activity'
  );
}

/** Ids and types of every live question: attempts reference these, so they freeze once responses exist. */
function structureSignature(sections: Section[]): string {
  return liveQuestions(sections)
    .map((q) => `${q.id}:${q.type}`)
    .sort()
    .join('|');
}

/** Everything that affects grading. A change here after submissions means stored scores are stale. */
function keySignature(sections: Section[]): string {
  return JSON.stringify(
    liveQuestions(sections).map((q) => [
      q.id,
      q.points,
      q.bonus,
      q.multiScoring,
      q.options.map((o) => [o.id, o.correct]),
      q.correctBoolean,
      q.acceptedAnswers,
      q.allowTypos,
      q.keywordGroups,
      q.minGroups,
      q.manualReview,
      q.correctNumber,
      q.tolerance,
      q.orderItems.map((i) => i.id),
      q.regions,
    ]),
  );
}

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name) private readonly activities: Model<Activity>,
    @InjectModel(Counter.name) private readonly counters: Model<Counter>,
    @InjectModel(Attempt.name) private readonly attempts: Model<Attempt>,
  ) {}

  private async nextCode(): Promise<string> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: 'activity' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return `CASE-${String(counter.seq).padStart(3, '0')}`;
  }

  private async uniqueSlug(base: string, exceptId?: Types.ObjectId): Promise<string> {
    let slug = base;
    for (let n = 2; ; n++) {
      const clash = await this.activities.exists({ slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
      if (!clash) return slug;
      slug = `${base}-${n}`;
    }
  }

  async findDoc(id: string): Promise<ActivityDocument> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Activity not found.');
    const doc = await this.activities.findById(id);
    if (!doc) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Activity not found.');
    return doc;
  }

  async findBySlug(slug: string): Promise<ActivityLean | null> {
    return this.activities.findOne({ slug }).lean<ActivityLean>();
  }

  async findLean(id: Types.ObjectId | string): Promise<ActivityLean | null> {
    return this.activities.findById(id).lean<ActivityLean>();
  }

  toAdmin(a: ActivityLean, attemptCount: number, submittedCount = 0): AdminActivity {
    return {
      _id: String(a._id),
      code: a.code,
      slug: a.slug,
      title: a.title,
      description: a.description,
      coverImage: a.coverImage ?? null,
      completionMessage: a.completionMessage,
      settings: activitySettingsSchema.parse(a.settings ?? {}),
      sections: a.sections,
      status: activityStatus(a),
      publishedAt: iso(a.publishedAt),
      opensAt: iso(a.opensAt),
      closesAt: iso(a.closesAt),
      version: a.version,
      attemptCount,
      submittedCount,
      createdAt: iso(a.createdAt)!,
      updatedAt: iso(a.updatedAt)!,
      needsRegrade: a.needsRegrade,
      resultsPublishedAt: iso(a.resultsPublishedAt),
    };
  }

  async get(id: string) {
    const doc = await this.findDoc(id);
    const [attemptCount, submittedCount] = await Promise.all([
      this.attempts.countDocuments({ activityId: doc._id, current: true }),
      this.attempts.countDocuments({ activityId: doc._id, current: true, status: 'submitted' }),
    ]);
    return this.toAdmin(doc.toObject() as ActivityLean, attemptCount, submittedCount);
  }

  async list(): Promise<AdminActivitySummary[]> {
    const rows = await this.activities.find().sort({ updatedAt: -1 }).lean<ActivityLean[]>();
    const stats = await this.attempts.aggregate<{ _id: Types.ObjectId; attempts: number; submitted: number; avgPct: number | null }>([
      { $match: { current: true } },
      {
        $group: {
          _id: '$activityId',
          attempts: { $sum: 1 },
          submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          avgPct: { $avg: { $cond: [{ $eq: ['$status', 'submitted'] }, '$pct', null] } },
        },
      },
    ]);
    const byId = new Map(stats.map((s) => [String(s._id), s]));
    return rows.map((a) => {
      const s = byId.get(String(a._id));
      return {
        _id: String(a._id),
        code: a.code,
        slug: a.slug,
        title: a.title,
        status: activityStatus(a),
        publishedAt: iso(a.publishedAt),
        opensAt: iso(a.opensAt),
        closesAt: iso(a.closesAt),
        questionCount: liveQuestions(a.sections).length,
        sectionCount: a.sections.length,
        attemptCount: s?.attempts ?? 0,
        submittedCount: s?.submitted ?? 0,
        avgPct: s?.avgPct != null ? Math.round(s.avgPct * 10) / 10 : null,
        feedbackMode: a.settings?.feedbackMode ?? 'end',
        resultsRelease: a.settings?.resultsRelease ?? 'manual',
        resultsPublishedAt: iso(a.resultsPublishedAt),
        updatedAt: iso(a.updatedAt)!,
      };
    });
  }

  async create(input: { title: string; description?: string }, adminId: string) {
    const content = activityContentSchema.parse({
      title: input.title,
      description: input.description ?? '',
      sections: [{ id: newId(), title: 'Section 1' }],
    });
    const doc = await this.activities.create({
      ...content,
      code: await this.nextCode(),
      slug: await this.uniqueSlug(slugify(input.title)),
      createdBy: new Types.ObjectId(adminId),
    });
    return this.toAdmin(doc.toObject() as ActivityLean, 0);
  }

  async update(id: string, patch: ActivityUpdate) {
    const doc = await this.findDoc(id);
    if (patch.version !== doc.version) {
      throw new AppError(HttpStatus.CONFLICT, 'version_conflict', 'This activity was changed elsewhere. Reload to see the latest version.');
    }
    const set: Record<string, unknown> = {};
    if (patch.sections) {
      for (const section of patch.sections) {
        if (!SAFE_ID.test(section.id)) throw new AppError(HttpStatus.BAD_REQUEST, 'invalid_id', 'Invalid section id.');
        for (const q of section.questions) {
          if (!SAFE_ID.test(q.id)) throw new AppError(HttpStatus.BAD_REQUEST, 'invalid_id', 'Invalid question id.');
        }
      }
      const attemptCount = await this.attempts.countDocuments({ activityId: doc._id });
      if (attemptCount > 0 && structureSignature(patch.sections) !== structureSignature(doc.sections)) {
        throw new AppError(
          HttpStatus.CONFLICT,
          'structure_locked',
          'Responses already exist, so questions cannot be added, removed or change type. Duplicate the activity to restructure it.',
        );
      }
      if (attemptCount > 0 && keySignature(patch.sections) !== keySignature(doc.sections)) set.needsRegrade = true;
      set.sections = patch.sections;
    }
    if (patch.slug && patch.slug !== doc.slug) set.slug = await this.uniqueSlug(patch.slug, doc._id);
    for (const key of ['title', 'description', 'coverImage', 'completionMessage', 'settings'] as const) {
      if (patch[key] !== undefined) set[key] = patch[key];
    }
    const updated = await this.activities.findOneAndUpdate(
      { _id: doc._id, version: patch.version },
      { $set: set, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated) {
      throw new AppError(HttpStatus.CONFLICT, 'version_conflict', 'This activity was changed elsewhere. Reload to see the latest version.');
    }
    return this.get(id);
  }

  publishIssues(a: Pick<Activity, 'sections'>): PublishIssue[] {
    const issues: PublishIssue[] = [];
    if (!liveQuestions(a.sections).length) {
      issues.push({ sectionId: a.sections[0]?.id ?? '', code: '—', message: 'Add at least one question before publishing.' });
    }
    a.sections.forEach((section, si) => {
      section.questions
        .filter((q) => !q.archived)
        .forEach((q, qi) => {
          for (const message of questionIssues(q, section)) {
            issues.push({ sectionId: section.id, questionId: q.id, code: questionCode(si, qi), message });
          }
        });
    });
    return issues;
  }

  async publish(id: string, schedule: ScheduleInput) {
    const doc = await this.findDoc(id);
    const issues = this.publishIssues(doc);
    if (issues.length) {
      throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'not_ready', 'Fix these before publishing.', { issues });
    }
    await this.activities.updateOne(
      { _id: doc._id },
      {
        $set: {
          publishedAt: doc.publishedAt ?? new Date(),
          opensAt: schedule.opensAt ? new Date(schedule.opensAt) : null,
          closesAt: schedule.closesAt ? new Date(schedule.closesAt) : null,
        },
        $inc: { version: 1 },
      },
    );
    return this.get(id);
  }

  async unpublish(id: string) {
    const doc = await this.findDoc(id);
    await this.activities.updateOne({ _id: doc._id }, { $set: { publishedAt: null }, $inc: { version: 1 } });
    return this.get(id);
  }

  async closeNow(id: string) {
    const doc = await this.findDoc(id);
    await this.activities.updateOne({ _id: doc._id }, { $set: { closesAt: new Date() }, $inc: { version: 1 } });
    return this.get(id);
  }

  async reopen(id: string) {
    const doc = await this.findDoc(id);
    await this.activities.updateOne({ _id: doc._id }, { $set: { closesAt: null }, $inc: { version: 1 } });
    return this.get(id);
  }

  /** Release (or withdraw) results for an activity whose results are held for admins. */
  async setResultsPublished(id: string, published: boolean) {
    const doc = await this.findDoc(id);
    await this.activities.updateOne({ _id: doc._id }, { $set: { resultsPublishedAt: published ? new Date() : null }, $inc: { version: 1 } });
    return this.get(id);
  }

  async duplicate(id: string, adminId: string) {
    const doc = await this.findDoc(id);
    const source = doc.toObject() as ActivityLean;
    const title = `${source.title} (copy)`;
    const sections = source.sections.map((s) => ({ ...s, questions: s.questions.filter((q) => !q.archived) }));
    const copy = await this.activities.create({
      title,
      description: source.description,
      coverImage: source.coverImage,
      completionMessage: source.completionMessage,
      settings: source.settings,
      sections,
      code: await this.nextCode(),
      slug: await this.uniqueSlug(slugify(title)),
      createdBy: new Types.ObjectId(adminId),
    });
    return this.toAdmin(copy.toObject() as ActivityLean, 0);
  }

  async remove(id: string) {
    const doc = await this.findDoc(id);
    await this.attempts.deleteMany({ activityId: doc._id });
    await doc.deleteOne();
  }

  async clearRegradeFlag(id: Types.ObjectId) {
    await this.activities.updateOne({ _id: id }, { $set: { needsRegrade: false } });
  }
}
