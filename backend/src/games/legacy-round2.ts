import { CYBER_SURVIVOR } from '@hrrl/shared';

// The old Round 2 ("The Human Firewall") shapes. The shared contract no longer has them.
type OldRubricItem = { id: 'identified' | 'warningSigns' | 'response'; label: string; points: number };
type OldR2Content = {
  title: string;
  subtitle: string;
  intro: string;
  rules: string[];
  hostNotes: string[];
  actSec: number;
  rubric?: OldRubricItem[];
  cards: unknown[];
  safetyNote: string;
};
type OldR2Score = { card?: string | null; identified?: boolean; warningSigns?: boolean; response?: boolean; marks?: unknown };

/** A lean game document, typed loosely: old documents may be missing parts. */
export type LegacyRound2Input = {
  content: { r2?: unknown; hostTips?: unknown };
  teams?: { id: string }[];
  scores?: unknown;
  state?: { stageId?: unknown };
  legacy?: { humanFirewall?: unknown } | null;
};

const DEFAULT_ITEM_POINTS = 10;
const KEEP_STAGES = new Set(['r2-intro', 'r2-mime', 'r2-scores']);
const OLD_TIP = 'Make the Human Firewall round the highlight.';
const NEW_TIP = 'Make the CyberMime Challenge the highlight.';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The `$set` (dotted keys) that moves a game saved with the old Round 2 to the CyberMime Round 2,
 * or null when it is already converted. Nothing is deleted: the old content and scores are archived
 * under `legacy.humanFirewall` (an archive already there is never overwritten).
 */
export function upgradeLegacyRound2(game: LegacyRound2Input): Record<string, unknown> | null {
  const old = game.content.r2 as OldR2Content | undefined;
  if (!old || !Array.isArray(old.cards)) return null;

  const rubric = Array.isArray(old.rubric) ? old.rubric : [];
  const pointsOf = (id: OldRubricItem['id']) => rubric.find((r) => r.id === id)?.points ?? DEFAULT_ITEM_POINTS;
  const total = rubric.reduce((sum, r) => sum + r.points, 0);
  // The editor schema accepts 1..100 marks.
  const maxMarks = rubric.length ? Math.min(Math.max(Math.round(total), 1), 100) : CYBER_SURVIVOR.r2.maxMarks;

  const set: Record<string, unknown> = {};
  const archivedScores: Record<string, unknown> = {};
  // Only existing score entries are touched: a missing one is filled in on read, and writing r2 alone would leave a partial score.
  const scores = isObject(game.scores) ? game.scores : {};
  for (const t of game.teams ?? []) {
    const entry = scores[t.id];
    if (!isObject(entry)) continue;
    const was = entry.r2 as OldR2Score | undefined;
    // Marks already typed (a game converted before) are kept.
    if (typeof was?.marks === 'number') continue;
    if (was) archivedScores[t.id] = was;
    const ticked = (['identified', 'warningSigns', 'response'] as const).filter((k) => was?.[k] === true);
    set[`scores.${t.id}.r2`] = { marks: ticked.length ? ticked.reduce((sum, k) => sum + pointsOf(k), 0) : null };
  }

  set['content.r2'] = { ...structuredClone(CYBER_SURVIVOR.r2), maxMarks };
  if (!game.legacy?.humanFirewall) set['legacy.humanFirewall'] = { content: old, scores: archivedScores, convertedAt: new Date().toISOString() };

  // The template's host tip named the old round; edited tips are left as they are.
  const tips = game.content.hostTips;
  if (Array.isArray(tips) && tips.includes(OLD_TIP)) set['content.hostTips'] = tips.map((tip) => (tip === OLD_TIP ? NEW_TIP : tip));

  // A per-team Round 2 stage no longer exists. Moving stage clears reveal and timer, as setState does.
  const stage = game.state?.stageId;
  if (typeof stage === 'string' && stage.startsWith('r2-') && !KEEP_STAGES.has(stage)) {
    set['state.stageId'] = 'r2-mime';
    set['state.revealed'] = false;
    set['state.timer'] = null;
  }
  return set;
}
