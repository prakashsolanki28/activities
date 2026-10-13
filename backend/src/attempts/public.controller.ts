import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { enterSchema, saveAnswerSchema, spotMarkInputSchema, type EnterInput, type SaveAnswerInput, type SpotMarkInput } from '@hrrl/shared';
import { AttemptsService } from './attempts.service';
import { ZodPipe } from '../common/zod.pipe';

const TOKEN = 'x-attempt-token';

@Controller('public')
export class PublicController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('activities/:slug')
  meta(@Param('slug') slug: string) {
    return this.attempts.publicMeta(slug);
  }

  @Post('activities/:slug/attempts')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  enter(@Param('slug') slug: string, @Body(new ZodPipe(enterSchema)) body: EnterInput, @Req() req: Request) {
    return this.attempts.enter(slug, body, { ip: req.ip ?? '', userAgent: String(req.headers['user-agent'] ?? '') });
  }

  @Get('activities/:slug/leaderboard')
  leaderboard(@Param('slug') slug: string, @Headers(TOKEN) token?: string) {
    return this.attempts.leaderboard(slug, token);
  }

  @Get('attempts/:id')
  state(@Param('id') id: string, @Headers(TOKEN) token?: string) {
    return this.attempts.getState(id, token);
  }

  @Post('attempts/:id/start')
  @HttpCode(200)
  start(@Param('id') id: string, @Headers(TOKEN) token?: string) {
    return this.attempts.start(id, token);
  }

  @Put('attempts/:id/answers/:questionId')
  save(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body(new ZodPipe(saveAnswerSchema)) body: SaveAnswerInput,
    @Headers(TOKEN) token?: string,
  ) {
    return this.attempts.saveAnswer(id, questionId, token, body);
  }

  @Post('attempts/:id/answers/:questionId/marks')
  @HttpCode(200)
  mark(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body(new ZodPipe(spotMarkInputSchema)) body: SpotMarkInput,
    @Headers(TOKEN) token?: string,
  ) {
    return this.attempts.spotMark(id, questionId, token, body);
  }

  @Post('attempts/:id/submit')
  @HttpCode(200)
  submit(@Param('id') id: string, @Headers(TOKEN) token?: string) {
    return this.attempts.submit(id, token);
  }

  @Get('certificates/:code')
  certificate(@Param('code') code: string) {
    return this.attempts.certificate(code);
  }
}
