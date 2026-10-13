import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Request } from 'express';
import type { AdminRole } from '@hrrl/shared';
import { HttpStatus } from '@nestjs/common';
import { Admin } from './admin.schema';
import { AppError } from '../common/errors';

export const AUTH_COOKIE = 'hrrl_admin';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthedAdmin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

type AuthedRequest = Request & { admin?: AuthedAdmin };

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthedAdmin => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().admin!;
});

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectModel(Admin.name) private readonly admins: Model<Admin>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    if (!token) throw new AppError(HttpStatus.UNAUTHORIZED, 'unauthenticated', 'Please sign in.');
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token);
    } catch {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'session_expired', 'Your session has expired. Please sign in again.');
    }
    // Re-read the admin so role changes and removals take effect immediately.
    const admin = await this.admins.findById(payload.sub).lean();
    if (!admin) throw new AppError(HttpStatus.UNAUTHORIZED, 'unauthenticated', 'Please sign in.');
    req.admin = { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role };

    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(admin.role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'forbidden', 'Only the owner can do this.');
    }
    return true;
  }
}
