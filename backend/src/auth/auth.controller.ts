import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { adminUserCreateSchema, adminUserUpdateSchema, loginSchema } from '@hrrl/shared';
import { z } from 'zod';
import { AuthService, toAdminUser } from './auth.service';
import { AdminGuard, AUTH_COOKIE, CurrentAdmin, Roles, type AuthedAdmin } from './auth.guard';
import { ZodPipe } from '../common/zod.pipe';
import { appConfig } from '../config';

const SESSION_MS = 12 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, admin } = await this.auth.login(body.email, body.password);
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig().COOKIE_SECURE,
      path: '/api',
      maxAge: SESSION_MS,
    });
    return { admin };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/api' });
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@CurrentAdmin() admin: AuthedAdmin) {
    return { admin: { _id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
  }
}

@Controller('admin/users')
@UseGuards(AdminGuard)
export class UsersController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  list() {
    return this.auth.list();
  }

  @Post()
  @Roles('owner')
  async create(@Body(new ZodPipe(adminUserCreateSchema)) body: z.infer<typeof adminUserCreateSchema>) {
    const admin = await this.auth.create(body);
    return toAdminUser(admin.toObject());
  }

  @Patch(':id')
  @Roles('owner')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(adminUserUpdateSchema)) body: z.infer<typeof adminUserUpdateSchema>,
    @CurrentAdmin() actor: AuthedAdmin,
  ) {
    return this.auth.update(id, body, actor.id);
  }

  @Delete(':id')
  @Roles('owner')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentAdmin() actor: AuthedAdmin) {
    return this.auth.remove(id, actor.id);
  }
}
