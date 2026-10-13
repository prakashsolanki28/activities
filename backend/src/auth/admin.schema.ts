import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ADMIN_ROLES, type AdminRole } from '@hrrl/shared';

@Schema({ timestamps: true, collection: 'admins' })
export class Admin {
  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ required: true, unique: true, lowercase: true, trim: true }) email!: string;
  @Prop({ required: true, select: false }) passwordHash!: string;
  @Prop({ type: String, required: true, enum: ADMIN_ROLES, default: 'editor' }) role!: AdminRole;
  createdAt!: Date;
  updatedAt!: Date;
}

export type AdminDocument = HydratedDocument<Admin>;
export const AdminSchema = SchemaFactory.createForClass(Admin);
