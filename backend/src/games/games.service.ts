import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  auctionSpend,
  buildPublicDisplay,
  buildStages,
  DEFAULT_TEAMS,
  emptyTeamScore,
  GAME_TEMPLATES,
  gameStatus,
  initialGameState,
  rankTeams,
  scoreTeam,
  type AdminGame,
  type AdminGameSummary,
  type GameCreateInput,
  type GameState,
  type GameStateUpdate,
  type GameUpdateInput,
  type PublicGameDisplay,
  type TeamScore,
  type TeamScoreUpdate,
  type TeamTotals,
} from '@hrrl/shared';
import { Game } from './game.schema';
import { AppError } from '../common/errors';
import { humanCode, SAFE_ID } from '../common/ids';

type GameLean = Game & { _id: Types.ObjectId };

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : new Date(0).toISOString());

@Injectable()
export class GamesService {
  constructor(@InjectModel(Game.name) private readonly games: Model<Game>) {}

  private async findLean(id: string): Promise<GameLean> {
    const doc = Types.ObjectId.isValid(id) ? await this.games.findById(id).lean<GameLean>() : null;
    if (!doc) throw new AppError(HttpStatus.NOT_FOUND, 'not_found', 'Game not found.');
    return doc;
  }

  private fullScores(g: GameLean): Record<string, TeamScore> {
    return Object.fromEntries(g.teams.map((t) => [t.id, g.scores?.[t.id] ?? emptyTeamScore()]));
  }

  private toAdmin(g: GameLean): AdminGame {
    const scores = this.fullScores(g);
    const totals: Record<string, TeamTotals> = Object.fromEntries(g.teams.map((t) => [t.id, scoreTeam(g.content, scores[t.id])]));
    return {
      _id: String(g._id),
      code: g.code,
      title: g.title,
      content: g.content,
      teams: g.teams,
      scores,
      state: g.state,
      status: gameStatus(g.state.stageId),
      totals,
      serverNow: new Date().toISOString(),
      createdAt: iso(g.createdAt),
      updatedAt: iso(g.updatedAt),
    };
  }

  async get(id: string): Promise<AdminGame> {
    return this.toAdmin(await this.findLean(id));
  }

  async list(): Promise<AdminGameSummary[]> {
    const rows = await this.games.find().sort({ updatedAt: -1 }).lean<GameLean[]>();
    return rows.map((g) => {
      const status = gameStatus(g.state.stageId);
      const stageLabel = buildStages(g.content, g.teams).find((s) => s.id === g.state.stageId)?.label ?? '';
      const top = status === 'setup' ? undefined : rankTeams(g.content, g.teams, this.fullScores(g))[0];
      return {
        _id: String(g._id),
        code: g.code,
        title: g.title,
        teamCount: g.teams.length,
        status,
        stageLabel,
        leader: top && top.totals.total > 0 ? { name: top.team.name, emoji: top.team.emoji, total: top.totals.total } : null,
        createdAt: iso(g.createdAt),
        updatedAt: iso(g.updatedAt),
      };
    });
  }

  async create(input: GameCreateInput, adminId: string | null): Promise<AdminGame> {
    const content = structuredClone(GAME_TEMPLATES['cyber-survivor']);
    const teams = input.teams ?? DEFAULT_TEAMS.map((t) => ({ ...t }));
    const base = {
      title: input.title ?? content.title,
      templateId: content.templateId,
      content,
      teams,
      scores: Object.fromEntries(teams.map((t) => [t.id, emptyTeamScore()])),
      state: initialGameState(),
      createdBy: adminId ? new Types.ObjectId(adminId) : null,
    };
    for (let attempt = 0; ; attempt++) {
      try {
        const doc = await this.games.create({ ...base, code: humanCode(6) });
        return this.toAdmin(doc.toObject() as GameLean);
      } catch (e) {
        if ((e as { code?: number }).code === 11000 && attempt < 8) continue;
        throw e;
      }
    }
  }

  async update(id: string, input: GameUpdateInput): Promise<AdminGame> {
    const g = await this.findLean(id);
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};
    if (input.title !== undefined) $set.title = input.title;
    if (input.teams) {
      const before = new Set(g.teams.map((t) => t.id));
      const after = new Set(input.teams.map((t) => t.id));
      // Order matters too: it sets the Round 2 stage order and each team's default card.
      const changed = g.teams.length !== input.teams.length || g.teams.some((t, i) => t.id !== input.teams![i]!.id);
      if (changed && g.state.stageId !== 'lobby') {
        throw new AppError(HttpStatus.CONFLICT, 'game_started', 'Teams can only be added, removed or reordered before the game starts.');
      }
      $set.teams = input.teams;
      for (const t of input.teams) if (!before.has(t.id)) $set[`scores.${t.id}`] = emptyTeamScore();
      for (const t of g.teams) if (!after.has(t.id)) $unset[`scores.${t.id}`] = 1;
    }
    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    if (Object.keys(update).length) await this.games.updateOne({ _id: g._id }, update);
    return this.get(id);
  }

  async setState(id: string, input: GameStateUpdate): Promise<AdminGame> {
    const g = await this.findLean(id);
    const moved = () =>
      new AppError(HttpStatus.CONFLICT, 'stage_changed', 'The game moved on in another window. The latest stage is shown now.');
    if (input.expectedStageId !== undefined && input.expectedStageId !== g.state.stageId) throw moved();
    const state: GameState = { ...g.state, timer: g.state.timer ? { ...g.state.timer } : null };
    const now = Date.now();
    if (input.stageId !== undefined) {
      if (!buildStages(g.content, g.teams, true).some((s) => s.id === input.stageId)) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'unknown_stage', 'That stage does not exist in this game.');
      }
      if (input.stageId !== state.stageId) {
        state.stageId = input.stageId;
        state.revealed = false;
        state.timer = null;
      }
    }
    if (input.revealed !== undefined) state.revealed = input.revealed;
    const t = input.timer;
    if (t) {
      if (t.action === 'start') state.timer = { durationSec: t.durationSec, endsAt: new Date(now + t.durationSec * 1000).toISOString(), remainingSec: null };
      else if (t.action === 'clear') state.timer = null;
      else if (t.action === 'pause' && state.timer?.endsAt) {
        state.timer = { ...state.timer, remainingSec: Math.max(0, (new Date(state.timer.endsAt).getTime() - now) / 1000), endsAt: null };
      } else if (t.action === 'resume' && state.timer && !state.timer.endsAt && state.timer.remainingSec != null) {
        state.timer = { ...state.timer, endsAt: new Date(now + state.timer.remainingSec * 1000).toISOString(), remainingSec: null };
      }
    }
    // Only if no other window changed the stage since we read it.
    const res = await this.games.updateOne({ _id: g._id, 'state.stageId': g.state.stageId }, { $set: { state } });
    if (res.matchedCount === 0) throw moved();
    return this.get(id);
  }

  async setScore(id: string, teamId: string, input: TeamScoreUpdate): Promise<AdminGame> {
    const g = await this.findLean(id);
    if (!SAFE_ID.test(teamId) || !g.teams.some((t) => t.id === teamId)) {
      throw new AppError(HttpStatus.NOT_FOUND, 'team_not_found', 'Team not found.');
    }
    const p = `scores.${teamId}`;
    const c = g.content;
    const bad = (code: string, message: string) => new AppError(HttpStatus.BAD_REQUEST, code, message);
    const ops: { filter?: Record<string, unknown>; $set: Record<string, unknown> }[] = [];

    switch (input.round) {
      case 'r1':
        if (!c.r1.challenges.some((x) => x.id === input.challengeId)) throw bad('unknown_challenge', 'That challenge does not exist.');
        ops.push({ $set: { [`${p}.r1.${input.challengeId}`]: input.choice } });
        break;
      case 'r2': {
        if (input.card != null && !c.r2.cards.some((x) => x.id === input.card)) throw bad('unknown_card', 'That card does not exist.');
        const set: Record<string, unknown> = {};
        if (input.card !== undefined) set[`${p}.r2.card`] = input.card;
        for (const k of ['identified', 'warningSigns', 'response'] as const) if (input[k] !== undefined) set[`${p}.r2.${k}`] = input[k];
        if (Object.keys(set).length) ops.push({ $set: set });
        break;
      }
      case 'r3': {
        const picks = [...new Set(input.picks)];
        if (picks.some((x) => !c.r3.actions.some((a) => a.id === x))) throw bad('unknown_action', 'That action does not exist.');
        if (auctionSpend(c, picks) > c.r3.budget) throw bad('over_budget', `That is more than the ${c.r3.budget} Cyber Coins budget.`);
        ops.push({ $set: { [`${p}.r3.picks`]: picks } });
        break;
      }
      case 'r4':
        if (!c.r4.situations.some((x) => x.id === input.situationId)) throw bad('unknown_situation', 'That situation does not exist.');
        ops.push({ $set: { [`${p}.r4.${input.situationId}`]: input.correct } });
        break;
      case 'tiebreak':
        if (input.win) {
          ops.push({ $set: Object.fromEntries(g.teams.map((t) => [`scores.${t.id}.tiebreakWin`, t.id === teamId])) });
        } else {
          ops.push({ $set: { [`${p}.tiebreakWin`]: false } });
        }
        break;
    }
    for (const op of ops) await this.games.updateOne({ _id: g._id }, { $set: op.$set });
    return this.get(id);
  }

  async reset(id: string): Promise<AdminGame> {
    const g = await this.findLean(id);
    await this.games.updateOne(
      { _id: g._id },
      { $set: { scores: Object.fromEntries(g.teams.map((t) => [t.id, emptyTeamScore()])), state: initialGameState() } },
    );
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const g = await this.findLean(id);
    await this.games.deleteOne({ _id: g._id });
  }

  async publicDisplay(code: string): Promise<PublicGameDisplay> {
    const g = await this.games.findOne({ code: String(code).toUpperCase() }).lean<GameLean>();
    if (!g) throw new AppError(HttpStatus.NOT_FOUND, 'game_not_found', 'No game with that code.');
    return buildPublicDisplay(
      { code: g.code, title: g.title, content: g.content, teams: g.teams, scores: this.fullScores(g), state: g.state },
      new Date(),
    );
  }

  async count(): Promise<number> {
    return this.games.estimatedDocumentCount();
  }
}
