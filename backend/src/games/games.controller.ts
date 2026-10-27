import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import {
  gameCreateSchema,
  gameQuestionsSchema,
  gameStateUpdateSchema,
  gameUpdateSchema,
  teamScoreUpdateSchema,
  type GameCreateInput,
  type GameQuestions,
  type GameStateUpdate,
  type GameUpdateInput,
  type TeamScoreUpdate,
} from '@hrrl/shared';
import { GamesService } from './games.service';
import { AdminGuard, CurrentAdmin, type AuthedAdmin } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';

@Controller('admin/games')
@UseGuards(AdminGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get()
  list() {
    return this.games.list();
  }

  @Post()
  create(@Body(new ZodPipe(gameCreateSchema)) body: GameCreateInput, @CurrentAdmin() admin: AuthedAdmin) {
    return this.games.create(body, admin.id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.games.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodPipe(gameUpdateSchema)) body: GameUpdateInput) {
    return this.games.update(id, body);
  }

  @Put(':id/questions')
  setQuestions(@Param('id') id: string, @Body(new ZodPipe(gameQuestionsSchema)) body: GameQuestions, @Headers('if-match') ifMatch?: string) {
    return this.games.setQuestions(id, body, ifMatch);
  }

  @Post(':id/state')
  @HttpCode(200)
  setState(@Param('id') id: string, @Body(new ZodPipe(gameStateUpdateSchema)) body: GameStateUpdate) {
    return this.games.setState(id, body);
  }

  @Put(':id/scores/:teamId')
  setScore(@Param('id') id: string, @Param('teamId') teamId: string, @Body(new ZodPipe(teamScoreUpdateSchema)) body: TeamScoreUpdate) {
    return this.games.setScore(id, teamId, body);
  }

  @Post(':id/reset')
  @HttpCode(200)
  reset(@Param('id') id: string) {
    return this.games.reset(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.games.remove(id);
  }
}
