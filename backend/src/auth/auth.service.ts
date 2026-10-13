import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import type { AdminUser, AdminRole } from '@hrrl/shared';
import { Admin, AdminDocument } from './admin.schema';
import { AppError } from '../common/errors';
import { appConfig } from '../config';

export const toAdminUser = (a: Admin & { _id: unknown }): AdminUser => ({
  _id: String(a._id),
  name: a.name,
  email: a.email,
  role: a.role,
  createdAt: a.createdAt?.toISOString?.() ?? '',
});

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectModel(Admin.name) private readonly admins: Model<Admin>,
    private readonly jwt: JwtService,
  ) {}

  /** Make sure an owner exists so a fresh install can sign in. */
  async onModuleInit() {
    if (appConfig().NODE_ENV === 'test') return;
    const count = await this.admins.countDocuments();
    if (count === 0) {
      const cfg = appConfig();
      await this.create({ name: cfg.ADMIN_NAME, email: cfg.ADMIN_EMAIL, password: cfg.ADMIN_PASSWORD, role: 'owner' });
      this.log.log(`Created owner account ${cfg.ADMIN_EMAIL}`);
    }
  }

  async login(email: string, password: string) {
    const admin = await this.admins.findOne({ email }).select('+passwordHash');
    // Compare even when the admin is missing, so timing does not reveal which emails exist.
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!admin || !ok) throw new AppError(HttpStatus.UNAUTHORIZED, 'bad_credentials', 'Email or password is incorrect.');
    const token = await this.jwt.signAsync({ sub: String(admin._id), role: admin.role });
    return { token, admin: toAdminUser(admin.toObject()) };
  }

  async create(input: { name: string; email: string; password: string; role: AdminRole }): Promise<AdminDocument> {
    const exists = await this.admins.exists({ email: input.email });
    if (exists) throw new AppError(HttpStatus.CONFLICT, 'email_taken', 'An admin with this email already exists.');
    const passwordHash = await bcrypt.hash(input.password, 12);
    return this.admins.create({ name: input.name, email: input.email, role: input.role, passwordHash });
  }

  async list(): Promise<AdminUser[]> {
    const rows = await this.admins.find().sort({ createdAt: 1 }).lean();
    return rows.map(toAdminUser);
  }

  async update(id: string, patch: { name?: string; role?: AdminRole; password?: string }, actorId: string) {
    const admin = await this.admins.findById(id);
    if (!admin) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Admin not found.');
    if (patch.role && patch.role !== 'owner' && admin.role === 'owner') await this.assertAnotherOwner(id);
    if (patch.role && id === actorId && patch.role !== admin.role) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'self_role', 'You cannot change your own role.');
    }
    if (patch.name) admin.name = patch.name;
    if (patch.role) admin.role = patch.role;
    if (patch.password) admin.passwordHash = await bcrypt.hash(patch.password, 12);
    await admin.save();
    return toAdminUser(admin.toObject());
  }

  async remove(id: string, actorId: string) {
    if (id === actorId) throw new AppError(HttpStatus.BAD_REQUEST, 'self_delete', 'You cannot remove your own account.');
    const admin = await this.admins.findById(id);
    if (!admin) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Admin not found.');
    if (admin.role === 'owner') await this.assertAnotherOwner(id);
    await admin.deleteOne();
  }

  private async assertAnotherOwner(id: string) {
    const others = await this.admins.countDocuments({ role: 'owner', _id: { $ne: id } });
    if (!others) throw new AppError(HttpStatus.BAD_REQUEST, 'last_owner', 'There must always be at least one owner.');
  }
}
