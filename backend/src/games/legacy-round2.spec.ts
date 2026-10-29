import { CYBER_SURVIVOR } from '@hrrl/shared';
import { upgradeLegacyRound2 } from './legacy-round2';

const rubric = ['identified', 'warningSigns', 'response'].map((id) => ({ id, label: id, points: 10 }));
const oldR2 = { title: 'The Human Firewall', subtitle: '', intro: '', rules: [], hostNotes: [], actSec: 60, rubric, cards: [{ id: 'A' }], safetyNote: '' };
const tick = (identified: boolean, warningSigns: boolean, response: boolean) => ({ r2: { card: 'A', identified, warningSigns, response } });
const game = (stageId = 'r2-firewall') => ({
  content: { r2: oldR2, hostTips: ['Be energetic.', 'Make the Human Firewall round the highlight.'] },
  teams: [{ id: 'firewall' }, { id: 'ninjas' }, { id: 'missing' }],
  scores: { firewall: tick(true, true, true), ninjas: tick(true, false, true) } as Record<string, { r2?: unknown }>,
  state: { stageId },
});

describe('upgradeLegacyRound2', () => {
  it('converts ticks to marks', () => {
    const set = upgradeLegacyRound2(game())!;
    expect(set['scores.firewall.r2']).toEqual({ marks: 30 });
    expect(set['scores.ninjas.r2']).toEqual({ marks: 20 });
    expect(set['content.r2']).toEqual({ ...CYBER_SURVIVOR.r2, maxMarks: 30 });
  });
  it('leaves a team without a score entry alone (it is filled in on read, not half-written)', () => {
    const set = upgradeLegacyRound2(game())!;
    expect(Object.keys(set).some((k) => k.startsWith('scores.missing'))).toBe(false);
    const broken = upgradeLegacyRound2({ ...game(), scores: null })!;
    expect(Object.keys(broken).some((k) => k.startsWith('scores'))).toBe(false);
    expect(upgradeLegacyRound2({ content: { r2: oldR2 } })).toHaveProperty(['content.r2']);
  });
  it('keeps marks and an archive from an earlier conversion', () => {
    const g = { ...game(), legacy: { humanFirewall: { content: 'first' } } };
    g.scores.firewall = { r2: { marks: 25 } };
    const set = upgradeLegacyRound2(g)!;
    expect(set).not.toHaveProperty(['scores.firewall.r2']);
    expect(set).not.toHaveProperty(['legacy.humanFirewall']);
  });
  it('swaps the old host tip only', () => {
    expect(upgradeLegacyRound2(game())!['content.hostTips']).toEqual(['Be energetic.', 'Make the CyberMime Challenge the highlight.']);
    const edited = { ...game(), content: { r2: oldR2, hostTips: ['My own tip'] } };
    expect(upgradeLegacyRound2(edited)).not.toHaveProperty(['content.hostTips']);
  });
  it('marks null when nothing was ticked', () => {
    const g = game();
    g.scores.firewall = tick(false, false, false);
    expect(upgradeLegacyRound2(g)!['scores.firewall.r2']).toEqual({ marks: null });
  });
  it('archives the old content and scores', () => {
    const set = upgradeLegacyRound2(game())!;
    const legacy = set['legacy.humanFirewall'] as { content: unknown; scores: Record<string, unknown>; convertedAt: string };
    expect(legacy.content).toBe(oldR2);
    expect(legacy.scores.firewall).toEqual(tick(true, true, true).r2);
    expect(legacy.scores.missing).toBeUndefined();
    expect(Number.isNaN(Date.parse(legacy.convertedAt))).toBe(false);
  });
  it('moves the old per-team stage to r2-mime but leaves other stages alone', () => {
    expect(upgradeLegacyRound2(game('r2-firewall'))).toMatchObject({ 'state.stageId': 'r2-mime', 'state.revealed': false, 'state.timer': null });
    expect(upgradeLegacyRound2(game('r1-c1'))).not.toHaveProperty(['state.stageId']);
    expect(upgradeLegacyRound2(game('r2-scores'))).not.toHaveProperty(['state.stageId']);
  });
  it('returns null for an already converted game', () => {
    expect(upgradeLegacyRound2({ ...game(), content: { r2: CYBER_SURVIVOR.r2 } })).toBeNull();
  });
});
