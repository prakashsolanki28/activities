import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CYBER_SURVIVOR } from '@hrrl/shared';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { Game } from '../src/games/game.schema';
import { AuthService } from '../src/auth/auth.service';

let mongo: MongoMemoryServer;
let app: INestApplication<App>;
let cookie: string;
let moduleRef: TestingModule;

const http = () => request(app.getHttpServer());
const createGame = async (body: Record<string, unknown> = {}) => (await http().post('/api/admin/games').set('Cookie', cookie).send(body).expect(201)).body;
const setState = (id: string, body: Record<string, unknown>) => http().post(`/api/admin/games/${id}/state`).set('Cookie', cookie).send(body);
const setScore = (id: string, team: string, body: Record<string, unknown>) => http().put(`/api/admin/games/${id}/scores/${team}`).set('Cookie', cookie).send(body);
const display = (code: string) => http().get(`/api/public/games/${code}`);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri('hrrl_games_test');
  process.env.NODE_ENV = 'test';
  process.env.UPLOAD_DIR = '/tmp/hrrl-test-uploads';
  moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  await moduleRef.get(AuthService).create({ name: 'Owner', email: 'owner@hrrl.test', password: 'correct-horse-battery', role: 'owner' });
  const login = await http().post('/api/auth/login').send({ email: 'owner@hrrl.test', password: 'correct-horse-battery' }).expect(200);
  cookie = String(login.headers['set-cookie']).split(';')[0];
}, 60_000);

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('games API', () => {
  it('rejects unauthenticated admin calls', async () => {
    await http().get('/api/admin/games').expect(401);
    await http().post('/api/admin/games').send({}).expect(401);
  });

  it('creates with defaults and serves the lobby publicly', async () => {
    const g = await createGame();
    expect(g.teams).toHaveLength(4);
    expect(g.status).toBe('setup');
    expect(g.title).toBe('Cyber Survivor');
    expect(g.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(Object.keys(g.scores)).toHaveLength(4);
    const pub = await display(g.code.toLowerCase()).expect(200);
    expect(pub.body.view.kind).toBe('lobby');
    expect(pub.body.code).toBe(g.code);
  });

  it('keeps r1 answers off the projector until revealed', async () => {
    const g = await createGame();
    const c1 = CYBER_SURVIVOR.r1.challenges[0]!;
    await setState(g._id, { stageId: 'r1-c1' }).expect(200);
    for (const team of ['firewall', 'ninjas']) await setScore(g._id, team, { round: 'r1', challengeId: 'c1', choice: c1.answer }).expect(200);
    const hidden = await display(g.code).expect(200);
    const json = JSON.stringify(hidden.body);
    expect(json).not.toContain(c1.explanation);
    expect(hidden.body.view.answer).toBeUndefined();
    expect(hidden.body.scoreboard.every((r: { totals: { total: number } }) => r.totals.total === 0)).toBe(true);

    const admin = await http().get(`/api/admin/games/${g._id}`).set('Cookie', cookie).expect(200);
    expect(admin.body.totals.firewall.total).toBe(5);

    await setState(g._id, { revealed: true }).expect(200);
    const shown = await display(g.code).expect(200);
    expect(shown.body.view.answer).toBe(c1.answer);
    expect(shown.body.view.explanation).toBe(c1.explanation);
    expect(shown.body.scoreboard.find((r: { teamId: string }) => r.teamId === 'firewall').totals.total).toBe(5);
  });

  it('keeps the r2 card off the projector until revealed', async () => {
    const g = await createGame();
    const card = CYBER_SURVIVOR.r2.cards[0]!;
    await setState(g._id, { stageId: 'r2-firewall' }).expect(200);
    const hidden = JSON.stringify((await display(g.code).expect(200)).body);
    expect(hidden).not.toContain(card.title);
    expect(hidden).not.toContain(card.brief);
    await setState(g._id, { revealed: true }).expect(200);
    expect(JSON.stringify((await display(g.code).expect(200)).body)).toContain(card.title);
  });

  it('validates budget and stage ids', async () => {
    const g = await createGame();
    // Every action together costs exactly the budget, so spending it all is allowed.
    await setScore(g._id, 'firewall', { round: 'r3', picks: ['report', 'secure', 'preserve', 'ignore', 'delete'] }).expect(200);
    // Shrink this game's budget to prove the guard.
    await moduleRef.get<Model<Game>>(getModelToken(Game.name)).updateOne({ _id: g._id }, { $set: { 'content.r3.budget': 50 } });
    const over = await setScore(g._id, 'firewall', { round: 'r3', picks: ['report', 'secure'] }).expect(400);
    expect(over.body.code).toBe('over_budget');
    await setScore(g._id, 'firewall', { round: 'r3', picks: ['report', 'preserve'] }).expect(200);
    await setScore(g._id, 'nobody', { round: 'r4', situationId: 'usb', correct: true }).expect(404);
    const bad = await setState(g._id, { stageId: 'nope' }).expect(400);
    expect(bad.body.code).toBe('unknown_stage');
  });

  it('blocks team set changes after start but allows renames', async () => {
    const g = await createGame();
    await setState(g._id, { stageId: 'r1-intro' }).expect(200);
    const teams = g.teams.map((t: { name: string }, i: number) => (i === 0 ? { ...t, name: 'Renamed' } : t));
    const renamed = await http().patch(`/api/admin/games/${g._id}`).set('Cookie', cookie).send({ teams }).expect(200);
    expect(renamed.body.teams[0].name).toBe('Renamed');
    const res = await http().patch(`/api/admin/games/${g._id}`).set('Cookie', cookie).send({ teams: teams.slice(0, 3) }).expect(409);
    expect(res.body.code).toBe('game_started');
  });

  it('blocks reordering teams after start (it moves Round 2 stages and default cards)', async () => {
    const g = await createGame();
    await setState(g._id, { stageId: 'r1-intro' }).expect(200);
    const swapped = [g.teams[1], g.teams[0], ...g.teams.slice(2)];
    const res = await http().patch(`/api/admin/games/${g._id}`).set('Cookie', cookie).send({ teams: swapped }).expect(409);
    expect(res.body.code).toBe('game_started');
  });

  it('rejects team ids that clash with fixed stage ids', async () => {
    const teams = [
      { id: 'scores', name: 'A', emoji: '' },
      { id: 'b', name: 'B', emoji: '' },
    ];
    await http().post('/api/admin/games').set('Cookie', cookie).send({ teams }).expect(400);
  });

  it('refuses state changes from a window that is behind (stale reveal)', async () => {
    const g = await createGame();
    await setState(g._id, { stageId: 'r1-c2', expectedStageId: 'lobby' }).expect(200);
    // A second tab still showing Challenge 1 presses Reveal: it must not reveal Challenge 2.
    const stale = await setState(g._id, { revealed: true, expectedStageId: 'r1-c1' }).expect(409);
    expect(stale.body.code).toBe('stage_changed');
    const pub = await display(g.code).expect(200);
    expect(pub.body.revealed).toBe(false);
    expect(JSON.stringify(pub.body)).not.toContain('explanation');
    await setState(g._id, { revealed: true, expectedStageId: 'r1-c2' }).expect(200);
  });

  it('adds and removes teams in setup, keeping scores in step', async () => {
    const g = await createGame();
    const teams = [...g.teams.slice(1), { id: 'extra', name: 'Extra', emoji: '' }];
    const res = await http().patch(`/api/admin/games/${g._id}`).set('Cookie', cookie).send({ teams }).expect(200);
    expect(Object.keys(res.body.scores).sort()).toEqual(['defenders', 'extra', 'hackbusters', 'ninjas']);
  });

  it('timer start, pause, resume, clear', async () => {
    const g = await createGame();
    const started = await setState(g._id, { stageId: 'r1-c1', timer: { action: 'start', durationSec: 30 } }).expect(200);
    expect(started.body.state.timer.endsAt).toBeTruthy();
    const paused = await setState(g._id, { timer: { action: 'pause' } }).expect(200);
    expect(paused.body.state.timer.endsAt).toBeNull();
    expect(paused.body.state.timer.remainingSec).toBeGreaterThan(0);
    const resumed = await setState(g._id, { timer: { action: 'resume' } }).expect(200);
    expect(resumed.body.state.timer.endsAt).toBeTruthy();
    expect(resumed.body.state.timer.remainingSec).toBeNull();
    const cleared = await setState(g._id, { timer: { action: 'clear' } }).expect(200);
    expect(cleared.body.state.timer).toBeNull();
  });

  it('tiebreak winner is exclusive', async () => {
    const g = await createGame();
    await setScore(g._id, 'firewall', { round: 'tiebreak', win: true }).expect(200);
    const res = await setScore(g._id, 'ninjas', { round: 'tiebreak', win: true }).expect(200);
    const wins = Object.entries(res.body.scores).filter(([, s]) => (s as { tiebreakWin: boolean }).tiebreakWin);
    expect(wins.map(([k]) => k)).toEqual(['ninjas']);
    const off = await setScore(g._id, 'ninjas', { round: 'tiebreak', win: false }).expect(200);
    expect(Object.values(off.body.scores).some((s) => (s as { tiebreakWin: boolean }).tiebreakWin)).toBe(false);
  });

  it('reset clears scores and state', async () => {
    const g = await createGame();
    await setState(g._id, { stageId: 'r1-c1' }).expect(200);
    await setScore(g._id, 'firewall', { round: 'r4', situationId: 'usb', correct: true }).expect(200);
    const res = await http().post(`/api/admin/games/${g._id}/reset`).set('Cookie', cookie).expect(200);
    expect(res.body.state).toEqual({ stageId: 'lobby', revealed: false, timer: null });
    expect(res.body.scores.firewall.r4).toEqual({});
    expect(res.body.totals.firewall.total).toBe(0);
  });

  it('lists summaries with a leader, and delete removes the public display', async () => {
    const g = await createGame({ title: 'Summary game' });
    await setState(g._id, { stageId: 'r1-c1' }).expect(200);
    await setScore(g._id, 'ninjas', { round: 'r4', situationId: 'usb', correct: true }).expect(200);
    const list = await http().get('/api/admin/games').set('Cookie', cookie).expect(200);
    const row = list.body.find((r: { _id: string }) => r._id === g._id);
    expect(row).toMatchObject({ title: 'Summary game', teamCount: 4, status: 'live', stageLabel: 'Challenge 1' });
    expect(row.leader).toMatchObject({ name: 'Team Cyber Ninjas', total: 5 });
    await http().delete(`/api/admin/games/${g._id}`).set('Cookie', cookie).expect(204);
    await display(g.code).expect(404);
    await http().get(`/api/admin/games/${g._id}`).set('Cookie', cookie).expect(404);
  });
});
