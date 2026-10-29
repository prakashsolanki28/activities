import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { GameContent, GameState, Team, TeamScore } from '@hrrl/shared';

/** Content, teams, scores and state are validated by the shared Zod contract, so they are stored as plain objects. */
@Schema({ timestamps: true, collection: 'games', minimize: false })
export class Game {
  @Prop({ required: true, unique: true }) code!: string;
  @Prop({ required: true, trim: true }) title!: string;
  @Prop({ required: true, default: 'cyber-survivor' }) templateId!: string;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) content!: GameContent;
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) teams!: Team[];
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) scores!: Record<string, TeamScore>;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) state!: GameState;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Admin', default: null }) createdBy!: unknown;
  /** Data from earlier versions of the game, kept when a round is replaced (e.g. legacy.humanFirewall, the old Round 2). */
  @Prop({ type: MongooseSchema.Types.Mixed, default: undefined }) legacy?: Record<string, unknown>;
  createdAt!: Date;
  updatedAt!: Date;
}

export type GameDocument = HydratedDocument<Game>;
export const GameSchema = SchemaFactory.createForClass(Game);
