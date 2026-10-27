import {
  auctionSpend,
  buildPublicDisplay,
  champion,
  CYBER_SURVIVOR as content,
  DEFAULT_TEAMS,
  emptyTeamScore,
  initialGameState,
  needsTiebreak,
  rankTeams,
  scoreTeam,
  visibleScores,
  type TeamScore,
} from '@hrrl/shared';

const teams = DEFAULT_TEAMS;
const perfect = (): TeamScore => ({
  r1: Object.fromEntries(content.r1.challenges.map((c) => [c.id, c.answer])),
  r2: { card: null, identified: true, warningSigns: true, response: true },
  r3: { picks: ['report', 'secure', 'preserve'] },
  r4: Object.fromEntries(content.r4.situations.map((s) => [s.id, true])),
  tiebreakWin: false,
});
const withScores = (scores: Record<string, TeamScore>) => Object.fromEntries(teams.map((t) => [t.id, scores[t.id] ?? emptyTeamScore()]));

describe('scoreTeam', () => {
  it('a perfect team scores 100 (20/30/30/20)', () => {
    expect(scoreTeam(content, perfect())).toEqual({ r1: 20, r2: 30, r3: 30, r4: 20, total: 100 });
  });
  it('clamps round 3 between 0 and 30', () => {
    expect(scoreTeam(content, { ...emptyTeamScore(), r3: { picks: ['ignore', 'delete'] } }).r3).toBe(0);
    expect(scoreTeam(content, { ...emptyTeamScore(), r3: { picks: ['report', 'ignore'] } }).r3).toBe(5);
  });
  it('computes auction spend', () => {
    expect(auctionSpend(content, ['report', 'secure', 'preserve'])).toBe(80);
    expect(auctionSpend(content, ['report', 'report'])).toBe(30);
    expect(auctionSpend(content, ['nope'])).toBe(0);
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
