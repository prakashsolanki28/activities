import {
  auctionSpend,
  buildPublicDisplay,
  champion,
  CYBER_SURVIVOR as content,
  DEFAULT_TEAMS,
  emptyTeamScore,
  gameQuestionsSchema,
  gameStarted,
  gameStatus,
  questionsFingerprint,
  roundMax as maxOf,
  scoreTeam as scoreOf,
  initialGameState,
  needsTiebreak,
  rankTeams,
  questionsOf,
  roundMax,
  roundRules,
  roundSubtitle,
  scoreTeam,
  visibleScores,
  withQuestions,
  type TeamScore,
} from '@hrrl/shared';

const teams = DEFAULT_TEAMS;
const perfect = (): TeamScore => ({
  r1: Object.fromEntries(content.r1.challenges.map((c) => [c.id, c.answer])),
  r2: { card: null, identified: true, warningSigns: true, response: true },
  r3: { picks: ['report', 'secure', 'preserve', 'reuse'] },
  r4: Object.fromEntries(content.r4.situations.map((s) => [s.id, true])),
  tiebreakWin: false,
});
const withScores = (scores: Record<string, TeamScore>) => Object.fromEntries(teams.map((t) => [t.id, scores[t.id] ?? emptyTeamScore()]));

describe('scoreTeam', () => {
  it('a perfect team scores 130 (30/30/40/30)', () => {
    expect(content.r1.challenges.map((c) => c.answer)).toEqual(['verify', 'danger', 'safe', 'danger', 'verify', 'danger']);
    expect(scoreTeam(content, perfect())).toEqual({ r1: 30, r2: 30, r3: 40, r4: 30, total: 130 });
    expect(roundMax(content).total).toBe(130);
    expect(auctionSpend(content, ['report', 'secure', 'preserve', 'reuse'])).toBe(90);
  });
  it('clamps round 3 between 0 and 40', () => {
    expect(scoreTeam(content, { ...emptyTeamScore(), r3: { picks: ['ignore', 'delete', 'forward'] } }).r3).toBe(0);
    expect(scoreTeam(content, { ...emptyTeamScore(), r3: { picks: ['report', 'ignore'] } }).r3).toBe(5);
  });
  it('computes auction spend', () => {
    expect(auctionSpend(content, ['report', 'secure', 'preserve'])).toBe(80);
    expect(auctionSpend(content, ['report', 'report'])).toBe(30);
    expect(auctionSpend(content, ['nope'])).toBe(0);
    expect(auctionSpend(content, content.r3.actions.map((a) => a.id))).toBe(120);
    expect(auctionSpend(content, content.r3.actions.map((a) => a.id))).toBeGreaterThan(content.r3.budget);
  });
});

describe('roundSubtitle and roundRules', () => {
  const legacy = (round: 'r1' | 'r4', rule: string) => ({ ...content, [round]: { ...content[round], subtitle: '5 minutes · 20 points', rules: [rule] } });
  it('computes the points from the current questions', () => {
    expect(roundSubtitle(content, 'r1')).toBe(`${content.r1.subtitle.replace(/\s*·.*$/, '')} · 30 points`);
    expect(roundSubtitle(content, 'r3')).toMatch(/· 40 points$/);
  });
  it('replaces legacy stored points text with one computed line', () => {
    const c = legacy('r1', '5 points for each correct answer');
    expect(roundSubtitle(c, 'r1')).toBe('5 minutes · 30 points');
    const rules = roundRules(c, 'r1');
    expect(rules).toEqual(['5 points for each correct answer']);
    expect(rules.filter((r) => /points?\b/.test(r))).toHaveLength(1);
  });
  it('follows an edited points value and keeps the budget line first in round 3', () => {
    const c = withQuestions(content, { ...questionsOf(content), r1: { ...questionsOf(content).r1, pointsEach: 10 } });
    expect(roundRules(c, 'r1').at(-1)).toBe('10 points for each correct answer');
    expect(roundSubtitle(c, 'r1')).toMatch(/· 60 points$/);
    expect(roundRules(content, 'r3')[0]).toBe('100 Cyber Coins per team');
  });
});

describe('gameQuestionsSchema', () => {
  const ok = () => questionsOf(content);
  it('accepts the standard template', () => {
    expect(gameQuestionsSchema.safeParse(ok()).success).toBe(true);
  });
  it('rejects reserved and duplicate ids', () => {
    for (const id of ['intro', 'scores']) {
      const q = ok();
      q.r1.challenges[0]!.id = id;
      expect(gameQuestionsSchema.safeParse(q).success).toBe(false);
    }
    const dup = ok();
    dup.r1.challenges[1]!.id = dup.r1.challenges[0]!.id;
    expect(gameQuestionsSchema.safeParse(dup).success).toBe(false);
  });
  it('rejects a budget too small for any positive action', () => {
    const q = ok();
    q.r3.budget = 5;
    expect(gameQuestionsSchema.safeParse(q).success).toBe(false);
  });
});

describe('withQuestions', () => {
  it('keeps titles and timers', () => {
    const q = questionsOf(content);
    q.r1.pointsEach = 10;
    const next = withQuestions(content, q);
    expect(next.title).toBe(content.title);
    expect(next.r1.title).toBe(content.r1.title);
    expect(next.r1.answerSec).toBe(content.r1.answerSec);
    expect(next.r2.actSec).toBe(content.r2.actSec);
    expect(next.r3.planSec).toBe(content.r3.planSec);
    expect(next.r4.missionSec).toBe(content.r4.missionSec);
    expect(next.tiebreak.answerSec).toBe(content.tiebreak.answerSec);
    expect(next.r1.pointsEach).toBe(10);
  });
});

describe('ranking', () => {
  it('shares a rank on ties and breaks them with the tie-breaker', () => {
    const tied = withScores({ firewall: perfect(), ninjas: perfect() });
    const ranked = rankTeams(content, teams, tied);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(1);
    expect(needsTiebreak(ranked)).toBe(true);
    expect(champion(ranked)).toBeNull();

    const broken = withScores({ firewall: perfect(), ninjas: { ...perfect(), tiebreakWin: true } });
    const r2 = rankTeams(content, teams, broken);
    expect(r2[0]!.team.id).toBe('ninjas');
    expect(r2[0]!.rank).toBe(1);
    expect(r2[1]!.rank).toBe(2);
    expect(needsTiebreak(r2)).toBe(false);
    expect(champion(r2)?.id).toBe('ninjas');
  });
});

describe('visibility', () => {
  const scores = withScores({ firewall: perfect() });
  it('hides an r1 answer until its reveal', () => {
    expect(visibleScores(content, teams, scores, 'r1-c1', false).firewall!.r1).toEqual({});
    expect(visibleScores(content, teams, scores, 'r1-c1', true).firewall!.r1).toEqual({ c1: 'verify' });
  });
  it('omits unrevealed r1 answers and explanations from the public display', () => {
    const d = buildPublicDisplay({ code: 'ABC123', title: 't', content, teams, scores, state: { stageId: 'r1-c1', revealed: false, timer: null } });
    const json = JSON.stringify(d);
    expect(json).not.toContain(content.r1.challenges[0]!.explanation);
    expect(d.view).not.toHaveProperty('answer');
    expect(d.scoreboard.every((r) => r.totals.total === 0)).toBe(true);
  });
  it('omits the r2 card text until revealed', () => {
    const state = { stageId: 'r2-firewall', revealed: false, timer: null };
    const hidden = JSON.stringify(buildPublicDisplay({ code: 'ABC123', title: 't', content, teams, scores, state }));
    const card = content.r2.cards[0]!;
    for (const text of [card.title, card.brief, card.warningSigns[0]!]) expect(hidden).not.toContain(text);
    const shown = JSON.stringify(buildPublicDisplay({ code: 'ABC123', title: 't', content, teams, scores, state: { ...state, revealed: true } }));
    expect(shown).toContain(card.title);
    expect(shown).not.toContain(card.brief);
  });
  it('lobby shows nothing scored', () => {
    const d = buildPublicDisplay({ code: 'ABC123', title: 't', content, teams, scores, state: initialGameState() });
    expect(d.view.kind).toBe('lobby');
  });
});

describe('review fixes', () => {
  it('Round 3 maximum is the best set of good actions within the budget', () => {
    expect(maxOf(content).r3).toBe(40);
    const tight = { ...content, r3: { ...content.r3, budget: 30 } };
    // preserve (20) + reuse (10) = 30 coins for 20 points beats report or secure alone (10).
    expect(maxOf(tight).r3).toBe(20);
  });

  it('a game counts as started once it left Welcome or has scores', () => {
    const scores = Object.fromEntries(DEFAULT_TEAMS.map((t) => [t.id, emptyTeamScore()]));
    expect(gameStarted(initialGameState(), scores)).toBe(false);
    expect(gameStarted({ ...initialGameState(), started: true }, scores)).toBe(true);
    const scored = { ...scores, firewall: { ...emptyTeamScore(), r4: { usb: true } } };
    expect(gameStarted(initialGameState(), scored)).toBe(true);
    expect(gameStatus('lobby', true)).toBe('live');
    expect(gameStatus('lobby')).toBe('setup');
  });

  it('an inherited object name never scores', () => {
    const odd = { ...content, r4: { ...content.r4, situations: [{ id: 'constructor', text: 'x', correctAction: 'y' }] } };
    expect(scoreOf(odd, emptyTeamScore()).r4).toBe(0);
    const q = questionsOf(content);
    q.r1.challenges[0]!.id = '__proto__';
    expect(gameQuestionsSchema.safeParse(q).success).toBe(false);
  });

  it('fingerprints change with the questions only', () => {
    const a = questionsFingerprint(content);
    expect(questionsFingerprint({ ...content, title: 'Other' })).toBe(a);
    const q = questionsOf(content);
    q.r4.pointsEach = 6;
    expect(questionsFingerprint({ ...content, r4: { ...content.r4, pointsEach: 6 } })).not.toBe(a);
  });
});
