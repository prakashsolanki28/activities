import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Model } from 'mongoose';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { AuthService } from '../src/auth/auth.service';

let mongo: MongoMemoryServer;
let app: INestApplication<App>;
let cookie: string;

const SECRET_FIELDS = ['"correct"', 'acceptedAnswers', 'keywordGroups', '"regions"', 'explanation', 'correctBoolean', 'correctNumber', 'highlights'];

function expectNoKeys(body: unknown) {
  const json = JSON.stringify(body);
  for (const field of SECRET_FIELDS) expect(json).not.toContain(field);
}

const sections = [
  {
    id: 'sec1',
    title: 'Exhibit A',
    questions: [
      {
        id: 'q1',
        type: 'single',
        prompt: 'What type of email is this?',
        options: [
          { id: 'o1', label: 'Legitimate' },
          { id: 'o2', label: 'Phishing', correct: true },
        ],
        explanation: 'Check the sender domain.',
        revealText: 'Next clue: where people connect.',
        highlights: [{ id: 'h1', x: 10, y: 10, w: 20, h: 5, label: 'Sender domain' }],
      },
      { id: 'q2', type: 'short_text', prompt: 'Who am I?', acceptedAnswers: ['MFA', 'multi-factor authentication'], maxTries: 2 },
      { id: 'q3', type: 'long_text', prompt: 'Describe', manualReview: true, points: 2 },
    ],
  },
];

async function createActivity(settings: Record<string, unknown>) {
  const created = await request(app.getHttpServer()).post('/api/admin/activities').set('Cookie', cookie).send({ title: 'Spot the Phish' }).expect(201);
  const id = created.body._id as string;
  await request(app.getHttpServer())
    .patch(`/api/admin/activities/${id}`)
    .set('Cookie', cookie)
    .send({ version: created.body.version, sections, settings: { ...created.body.settings, resultsRelease: 'immediate', ...settings } })
    .expect(200);
  const published = await request(app.getHttpServer()).post(`/api/admin/activities/${id}/publish`).set('Cookie', cookie).send({}).expect(200);
  return { id, slug: published.body.slug as string };
}

const enter = (slug: string, body: Record<string, unknown>) =>
  request(app.getHttpServer()).post(`/api/public/activities/${slug}/attempts`).send({ name: 'Ravi Kumar', employeeId: 'E-1001', ...body });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri('hrrl_test');
  process.env.NODE_ENV = 'test';
  process.env.UPLOAD_DIR = '/tmp/hrrl-test-uploads';
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  await moduleRef.get(AuthService).create({ name: 'Owner', email: 'owner@hrrl.test', password: 'correct-horse-battery', role: 'owner' });
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'owner@hrrl.test', password: 'correct-horse-battery' })
    .expect(200);
  cookie = String(login.headers['set-cookie']).split(';')[0];
}, 60_000);

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

describe('admin auth', () => {
  it('rejects unauthenticated admin calls', async () => {
    await request(app.getHttpServer()).get('/api/admin/activities').expect(401);
  });
  it('rejects a bad password', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'owner@hrrl.test', password: 'nope' }).expect(401);
  });
});

describe('partial updates', () => {
  it('a sections-only save keeps settings, and a settings-only save keeps sections', async () => {
    const created = await request(app.getHttpServer()).post('/api/admin/activities').set('Cookie', cookie).send({ title: 'Partial' }).expect(201);
    const id = created.body._id;
    const withSettings = await request(app.getHttpServer())
      .patch(`/api/admin/activities/${id}`)
      .set('Cookie', cookie)
      .send({ version: created.body.version, settings: { ...created.body.settings, feedbackMode: 'instant', timeLimitSec: 600 } })
      .expect(200);
    expect(withSettings.body.sections).toHaveLength(1);
    const withSections = await request(app.getHttpServer())
      .patch(`/api/admin/activities/${id}`)
      .set('Cookie', cookie)
      .send({ version: withSettings.body.version, sections })
      .expect(200);
    expect(withSections.body.settings).toMatchObject({ feedbackMode: 'instant', timeLimitSec: 600 });
    expect(withSections.body.title).toBe('Partial');
  });
});

describe('publishing', () => {
  it('refuses to publish an incomplete activity and lists issues', async () => {
    const created = await request(app.getHttpServer()).post('/api/admin/activities').set('Cookie', cookie).send({ title: 'Empty' }).expect(201);
    const res = await request(app.getHttpServer()).post(`/api/admin/activities/${created.body._id}/publish`).set('Cookie', cookie).send({}).expect(422);
    expect(res.body.code).toBe('not_ready');
    expect(res.body.issues.length).toBeGreaterThan(0);
  });
});

describe('attempt lifecycle (end-review mode)', () => {
  let slug: string;
  let activityId: string;
  beforeAll(async () => {
    ({ slug, id: activityId } = await createActivity({ feedbackMode: 'end', reviewAvailable: 'after_submit' }));
  });

  it('never sends answer keys before submission', async () => {
    const meta = await request(app.getHttpServer()).get(`/api/public/activities/${slug}`).expect(200);
    expectNoKeys(meta.body);
    const res = await enter(slug, { employeeId: 'K-1' }).expect(200);
    expectNoKeys(res.body);
    expect(res.body.state.token).toBeTruthy();
    expect(res.body.state.resumeCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('creates exactly one attempt when the same ID enters concurrently', async () => {
    const results = await Promise.all([enter(slug, { employeeId: 'RACE-1' }), enter(slug, { employeeId: 'race 1' })]);
    const ok = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].body.code).toBe('resume_code_required');
  });

  it('resumes on the same device by token and on another device by resume code', async () => {
    const first = await enter(slug, { employeeId: 'E-2002' }).expect(200);
    const { token, resumeCode, attemptId } = first.body.state;
    const sameDevice = await enter(slug, { employeeId: 'e 2002', token }).expect(200);
    expect(sameDevice.body.state.attemptId).toBe(attemptId);
    await enter(slug, { employeeId: 'E-2002' }).expect(409);
    await enter(slug, { employeeId: 'E-2002', resumeCode: 'WRONG1' }).expect(409);
    const otherDevice = await enter(slug, { employeeId: 'E-2002', resumeCode: resumeCode.toLowerCase() }).expect(200);
    expect(otherDevice.body.state.attemptId).toBe(attemptId);
    expect(otherDevice.body.state.token).not.toBe(token);
  });

  it('rejects stale saves, grades on submit, and makes submit idempotent', async () => {
    const res = await enter(slug, { employeeId: 'E-3003' }).expect(200);
    const { token, attemptId } = res.body.state;
    const api = (method: 'put' | 'post' | 'get', path: string) =>
      request(app.getHttpServer())[method](`/api/public/attempts/${attemptId}${path}`).set('x-attempt-token', token);

    await api('put', '/answers/q1').send({ value: 'o2', seq: 1 }).expect(409); // not started
    await api('post', '/start').expect(200);
    await api('put', '/answers/q1').send({ value: 'o1', seq: 2 }).expect(200);
    const stale = await api('put', '/answers/q1').send({ value: 'o2', seq: 1 }).expect(409);
    expect(stale.body.code).toBe('stale');
    await api('put', '/answers/q1').send({ value: 'o2', seq: 3 }).expect(200);
    await api('put', '/answers/q2').send({ value: 'multi factor authentication', seq: 4 }).expect(200);
    await api('put', '/answers/q3').send({ value: 'It asked for my password urgently', seq: 5 }).expect(200);
    await api('put', '/answers/q1').send({ value: 'not-an-option', seq: 6 }).expect(400);

    const [a, b] = await Promise.all([api('post', '/submit'), api('post', '/submit')]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.result).toMatchObject({ score: 2, maxScore: 4, pendingReview: true });
    expect(b.body.result.score).toBe(2);
    expect(a.body.reveals.q1.correct.optionIds).toEqual(['o2']);
    await api('put', '/answers/q1').send({ value: 'o1', seq: 9 }).expect(409);
  });

  it('manual grading resolves review and regrade keeps overrides', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/admin/activities/${activityId}/attempts?status=pending_review`)
      .set('Cookie', cookie)
      .expect(200);
    const row = list.body.items.find((r: { employeeId: string }) => r.employeeId === 'E-3003');
    const graded = await request(app.getHttpServer())
      .patch(`/api/admin/attempts/${row._id}`)
      .set('Cookie', cookie)
      .send({ grades: [{ questionId: 'q3', points: 2 }] })
      .expect(200);
    expect(graded.body).toMatchObject({ score: 4, maxScore: 4, pendingReview: false });
    await request(app.getHttpServer()).post(`/api/admin/activities/${activityId}/regrade`).set('Cookie', cookie).expect(200);
    const after = await request(app.getHttpServer()).get(`/api/admin/attempts/${row._id}`).set('Cookie', cookie).expect(200);
    expect(after.body.score).toBe(4);
  });

  it('blocks a second attempt, then allows a retake after an admin reset', async () => {
    await enter(slug, { employeeId: 'E-3003' }).expect(409);
    const list = await request(app.getHttpServer()).get(`/api/admin/activities/${activityId}/attempts?q=E-3003`).set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).delete(`/api/admin/attempts/${list.body.items[0]._id}`).set('Cookie', cookie).expect(204);
    const retake = await enter(slug, { employeeId: 'E-3003' }).expect(200);
    expect(retake.body.state.status).toBe('in_progress');
  });

  it('finalises an attempt whose deadline has passed', async () => {
    const res = await enter(slug, { employeeId: 'E-4004' }).expect(200);
    const { token, attemptId } = res.body.state;
    await request(app.getHttpServer()).post(`/api/public/attempts/${attemptId}/start`).set('x-attempt-token', token).expect(200);
    const attempts = app.get<Model<unknown>>(getModelToken('Attempt'));
    await attempts.updateOne({ _id: attemptId }, { $set: { deadlineAt: new Date(Date.now() - 60_000) } });
    const state = await request(app.getHttpServer()).get(`/api/public/attempts/${attemptId}`).set('x-attempt-token', token).expect(200);
    expect(state.body.status).toBe('submitted');
    expect(state.body.result.submitReason).toBe('timeout');
  });

  it('freezes structure once responses exist', async () => {
    const current = await request(app.getHttpServer()).get(`/api/admin/activities/${activityId}`).set('Cookie', cookie).expect(200);
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/activities/${activityId}`)
      .set('Cookie', cookie)
      .send({ version: current.body.version, sections: [{ ...sections[0], questions: sections[0].questions.slice(0, 2) }] })
      .expect(409);
    expect(res.body.code).toBe('structure_locked');
  });
});

describe('instant mode', () => {
  it('reveals only after an answer locks, and spends tries without leaking the key', async () => {
    const { slug } = await createActivity({ feedbackMode: 'instant' });
    const res = await enter(slug, { employeeId: 'I-1' }).expect(200);
    const { token, attemptId } = res.body.state;
    const api = (method: 'put' | 'post', path: string) =>
      request(app.getHttpServer())[method](`/api/public/attempts/${attemptId}${path}`).set('x-attempt-token', token);
    await api('post', '/start').expect(200);

    const wrongTry = await api('put', '/answers/q2').send({ value: 'password', seq: 1, check: true }).expect(200);
    expect(wrongTry.body.reveal).toBeNull();
    expect(wrongTry.body.tryResult).toEqual({ isCorrect: false, triesLeft: 1 });
    expectNoKeys(wrongTry.body);

    const secondTry = await api('put', '/answers/q2').send({ value: 'MFA', seq: 2, check: true }).expect(200);
    expect(secondTry.body.reveal.isCorrect).toBe(true);
    expect(secondTry.body.answer.locked).toBe(true);

    const q1 = await api('put', '/answers/q1').send({ value: 'o1', seq: 3, check: true }).expect(200);
    expect(q1.body.reveal).toMatchObject({ isCorrect: false, explanation: 'Check the sender domain.' });
    expect(q1.body.reveal.highlights).toHaveLength(1);
    expect(q1.body.revealText).toBe('Next clue: where people connect.');
    await api('put', '/answers/q1').send({ value: 'o2', seq: 4, check: true }).expect(409);
  });
});

describe('spot the red flags', () => {
  it('judges boxes live, never discloses unfound flags, and locks when wrong guesses run out', async () => {
    const created = await request(app.getHttpServer()).post('/api/admin/activities').set('Cookie', cookie).send({ title: 'Spot' }).expect(201);
    const spotSections = [
      {
        id: 'sp1',
        title: 'Login page',
        image: { url: '/uploads/test.webp', w: 1000, h: 500, alt: 'login page' },
        questions: [
          {
            id: 'spq',
            type: 'spot_flags',
            prompt: 'Box every red flag.',
            points: 2,
            maxMisses: 2,
            explanation: 'Check the domain.',
            regions: [
              { id: 'fa', x: 10, y: 10, w: 20, h: 4, label: 'Look-alike domain' },
              { id: 'fb', x: 60, y: 50, w: 10, h: 10, label: 'Credential form' },
            ],
          },
        ],
      },
    ];
    await request(app.getHttpServer())
      .patch(`/api/admin/activities/${created.body._id}`)
      .set('Cookie', cookie)
      .send({ version: created.body.version, sections: spotSections, settings: { ...created.body.settings, feedbackMode: 'end', resultsRelease: 'immediate' } })
      .expect(200);
    const pub = await request(app.getHttpServer()).post(`/api/admin/activities/${created.body._id}/publish`).set('Cookie', cookie).send({}).expect(200);

    const entered = await enter(pub.body.slug, { employeeId: 'SP-1' }).expect(200);
    const { token, attemptId } = entered.body.state;
    expect(entered.body.state.questions[0]).toMatchObject({ type: 'spot_flags', flagCount: 2, maxMisses: 2 });
    expectNoKeys(entered.body.state);
    const api = (method: 'post' | 'put', path: string) => request(app.getHttpServer())[method](`/api/public/attempts/${attemptId}${path}`).set('x-attempt-token', token);
    await api('post', '/start').expect(200);
    const mark = (x: number, y: number, w: number, h: number, seq: number) => api('post', '/answers/spq/marks').send({ x, y, w, h, seq });

    await api('post', '/answers/spq/marks').send({ x: 20, y: 12, r: 3, seq: 1 }).expect(400); // circles are no longer accepted
    const miss = await mark(85, 85, 8, 8, 1).expect(200);
    expect(miss.body).toMatchObject({ outcome: 'miss', hit: null, reveal: null, spot: { misses: 1, found: [], total: 2 } });
    expect(JSON.stringify(miss.body)).not.toContain('Credential form');

    const hit = await mark(9, 9, 23, 6, 2).expect(200);
    expect(hit.body.outcome).toBe('hit');
    expect(hit.body.hit).toMatchObject({ index: 0, region: { label: 'Look-alike domain' } });
    expect(JSON.stringify(hit.body)).not.toContain('Credential form');

    const repeat = await mark(11, 10, 18, 4, 3).expect(200);
    expect(repeat.body).toMatchObject({ outcome: 'repeat', spot: { misses: 1 } });

    await mark(5, 85, 6, 6, 2).expect(409); // stale seq
    await api('put', '/answers/spq').send({ value: { marks: [{ x: 59, y: 49, w: 12, h: 12 }] }, seq: 9 }).expect(400); // cannot forge marks

    const last = await mark(35, 75, 8, 8, 4).expect(200);
    expect(last.body.spot).toMatchObject({ misses: 2, locked: true });
    expect(last.body.reveal.correct.foundIndexes).toEqual([0]);
    expect(last.body.reveal.highlights).toHaveLength(2);
    await mark(59, 49, 12, 12, 5).expect(409);

    const done = await api('post', '/submit').expect(200);
    expect(done.body.result).toMatchObject({ score: 1, maxScore: 2 });
  });
});

describe('held results', () => {
  it('shows nothing until an admin publishes results, then everything', async () => {
    const { id, slug } = await createActivity({ feedbackMode: 'end', resultsRelease: 'manual', leaderboard: 'always' });
    const res = await enter(slug, { employeeId: 'H-1' }).expect(200);
    const { token, attemptId } = res.body.state;
    expect(res.body.state.activity.resultsStatus).toBe('pending');
    const api = (method: 'put' | 'post' | 'get', path: string) =>
      request(app.getHttpServer())[method](`/api/public/attempts/${attemptId}${path}`).set('x-attempt-token', token);
    await api('post', '/start').expect(200);
    await api('put', '/answers/q1').send({ value: 'o2', seq: 1 }).expect(200);
    const submitted = await api('post', '/submit').expect(200);
    expect(submitted.body.result).toBeNull();
    expect(submitted.body.reveals).toEqual({});
    expectNoKeys(submitted.body);
    await request(app.getHttpServer()).get(`/api/public/activities/${slug}/leaderboard`).expect(403);

    await request(app.getHttpServer()).post(`/api/admin/activities/${id}/results/publish`).set('Cookie', cookie).expect(200);
    const after = await api('get', '').expect(200);
    expect(after.body.activity.resultsStatus).toBe('visible');
    expect(after.body.result.score).toBe(1);
    expect(after.body.reveals.q1.correct.optionIds).toEqual(['o2']);
    await request(app.getHttpServer()).get(`/api/public/activities/${slug}/leaderboard`).expect(200);

    await request(app.getHttpServer()).post(`/api/admin/activities/${id}/results/hide`).set('Cookie', cookie).expect(200);
    const hidden = await api('get', '').expect(200);
    expect(hidden.body.result).toBeNull();
  });

  it('instant mode with held results locks answers and shows clues, but never right or wrong', async () => {
    const { slug } = await createActivity({ feedbackMode: 'instant', resultsRelease: 'manual' });
    const res = await enter(slug, { employeeId: 'H-2' }).expect(200);
    const { token, attemptId } = res.body.state;
    const api = (method: 'put' | 'post', path: string) =>
      request(app.getHttpServer())[method](`/api/public/attempts/${attemptId}${path}`).set('x-attempt-token', token);
    await api('post', '/start').expect(200);
    const checked = await api('put', '/answers/q1').send({ value: 'o1', seq: 1, check: true }).expect(200);
    expect(checked.body).toMatchObject({ reveal: null, tryResult: null, revealText: 'Next clue: where people connect.' });
    expect(checked.body.answer.locked).toBe(true);
    expectNoKeys(checked.body);
  });
});
