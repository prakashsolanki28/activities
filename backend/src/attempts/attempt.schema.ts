import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { SUBMIT_REASONS, type AnswerValue, type SubmitReason } from '@hrrl/shared';

export interface StoredAnswer {
  value: AnswerValue;
  seq: number;
  tries: number;
  locked: boolean;
  answeredAt: Date;
  /** Filled in when graded (at check time in instant mode, otherwise at submission). */
  isCorrect?: boolean | null;
  points?: number;
  maxPoints?: number;
  needsReview?: boolean;
  /** Manual grade by an admin; wins over the computed points. */
  override?: number | null;
}

@Schema({ timestamps: true, collection: 'attempts', minimize: false })
export class Attempt {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true }) activityId!: Types.ObjectId;
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ required: true, trim: true }) employeeId!: string;
  @Prop({ required: true }) employeeIdNorm!: string;
  /** true for the live attempt of this employee; unset on admin reset (see partial unique index). */
  @Prop({ type: Boolean }) current?: boolean;
  @Prop({ type: String, required: true, enum: ['in_progress', 'submitted'], default: 'in_progress' }) status!: 'in_progress' | 'submitted';
  @Prop({ type: String, enum: [...SUBMIT_REASONS, null], default: null }) submitReason!: SubmitReason | null;
  @Prop({ type: Date, default: null }) startedAt!: Date | null;
  @Prop({ type: Date, default: null }) deadlineAt!: Date | null;
  @Prop({ type: Date, default: null }) submittedAt!: Date | null;
  @Prop({ type: Date, default: null }) gradedAt!: Date | null;
  @Prop({ type: [String], default: [] }) questionOrder!: string[];
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) optionOrder!: Record<string, string[]>;
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) answers!: Record<string, StoredAnswer>;
  @Prop({ default: 0 }) score!: number;
  @Prop({ default: 0 }) maxScore!: number;
  @Prop({ default: 0 }) pct!: number;
  @Prop({ type: Number, default: null }) durationSec!: number | null;
  @Prop({ default: false }) pendingReview!: boolean;
  @Prop({ type: String, default: null }) certificateCode!: string | null;
  @Prop({ default: false }) hiddenFromLeaderboard!: boolean;
  @Prop({ type: [String], default: [], select: false }) tokenHashes!: string[];
  @Prop({ required: true }) resumeCode!: string;
  @Prop({ default: '' }) ip!: string;
  @Prop({ default: '' }) userAgent!: string;
  @Prop({ type: Date, default: null }) resetAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export type AttemptDocument = HydratedDocument<Attempt>;
export const AttemptSchema = SchemaFactory.createForClass(Attempt);

AttemptSchema.index(
  { activityId: 1, employeeIdNorm: 1 },
  { unique: true, partialFilterExpression: { current: true }, name: 'one_current_attempt_per_employee' },
);
AttemptSchema.index({ activityId: 1, status: 1, pct: -1, durationSec: 1 });
AttemptSchema.index({ status: 1, deadlineAt: 1 });
AttemptSchema.index({ certificateCode: 1 }, { unique: true, partialFilterExpression: { certificateCode: { $type: 'string' } } });
