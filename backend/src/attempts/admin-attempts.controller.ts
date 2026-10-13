import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { attemptListQuerySchema, attemptPatchSchema, type AttemptListQuery } from '@hrrl/shared';
import { AdminAttemptsService } from './admin-attempts.service';
import { AttemptsService } from './attempts.service';
import { AdminGuard } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';

const exportQuery = z.object({ format: z.enum(['xlsx', 'csv']).default('xlsx') });

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminAttemptsController {
  constructor(
    private readonly admin: AdminAttemptsService,
    private readonly lifecycle: AttemptsService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('activities/:id/attempts')
  list(@Param('id') id: string, @Query(new ZodPipe(attemptListQuerySchema)) query: AttemptListQuery) {
    return this.admin.list(id, query);
  }

  @Get('activities/:id/attempts/export')
  async export(@Param('id') id: string, @Query(new ZodPipe(exportQuery)) q: z.infer<typeof exportQuery>, @Res() res: Response) {
    const file = await this.admin.export(id, q.format);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get('activities/:id/insights')
  insights(@Param('id') id: string) {
    return this.admin.insights(id);
  }

  @Get('activities/:id/leaderboard')
  leaderboard(@Param('id') id: string) {
    return this.lifecycle.leaderboard('', undefined, { admin: true, activityId: id });
  }

  @Post('activities/:id/regrade')
  @HttpCode(200)
  regrade(@Param('id') id: string) {
    return this.admin.regrade(id);
  }

  @Get('attempts/:attemptId')
  detail(@Param('attemptId') attemptId: string) {
    return this.admin.detail(attemptId);
  }

  @Patch('attempts/:attemptId')
  patch(@Param('attemptId') attemptId: string, @Body(new ZodPipe(attemptPatchSchema)) body: z.infer<typeof attemptPatchSchema>) {
    return this.admin.patch(attemptId, body);
  }

  @Delete('attempts/:attemptId')
  @HttpCode(204)
  reset(@Param('attemptId') attemptId: string) {
    return this.admin.reset(attemptId);
  }
}
