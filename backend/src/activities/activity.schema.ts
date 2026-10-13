import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { ActivitySettings, ImageRef, Section } from '@hrrl/shared';

/**
 * Sections and settings are validated by the shared Zod schemas before every write,
 * so they are stored as plain objects (no Mongoose subdocument _ids).
 */
@Schema({ timestamps: true, collection: 'activities', minimize: false })
export class Activity {
  @Prop({ required: true, unique: true }) code!: string;
  @Prop({ required: true, unique: true }) slug!: string;
  @Prop({ required: true, trim: true }) title!: string;
  @Prop({ default: '' }) description!: string;
  @Prop({ type: MongooseSchema.Types.Mixed, default: null }) coverImage!: ImageRef | null;
  @Prop({ default: '' }) completionMessage!: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) settings!: ActivitySettings;
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) sections!: Section[];
  @Prop({ type: Date, default: null }) publishedAt!: Date | null;
  @Prop({ type: Date, default: null }) opensAt!: Date | null;
  @Prop({ type: Date, default: null }) closesAt!: Date | null;
  @Prop({ default: 0 }) version!: number;
  /** Set when an answer key changed after submissions; cleared by regrade. */
  @Prop({ default: false }) needsRegrade!: boolean;
  @Prop({ type: Date, default: null }) resultsPublishedAt!: Date | null;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Admin', default: null }) createdBy!: unknown;
  createdAt!: Date;
  updatedAt!: Date;
}

export type ActivityDocument = HydratedDocument<Activity>;
export const ActivitySchema = SchemaFactory.createForClass(Activity);

@Schema({ collection: 'counters' })
export class Counter {
  @Prop({ required: true }) _id!: string;
  @Prop({ default: 0 }) seq!: number;
}
export const CounterSchema = SchemaFactory.createForClass(Counter);
