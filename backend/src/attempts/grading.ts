import {
  maxPointsFor,
  replaySpot,
  type AnswerValue,
  type CorrectAnswer,
  type KeywordGroup,
  type Question,
} from '@hrrl/shared';

export interface GradeResult {
  isCorrect: boolean | null;
  points: number;
  maxPoints: number;
  needsReview: boolean;
}

const STOPWORDS = new Set(['a', 'an', 'the']);
/** Hotspot regions are padded by this many percent on each side, for fingers. */
const HOTSPOT_PAD = 2;
/** Extra tokens tolerated around an accepted phrase ("it is MFA"). */
const PHRASE_SLACK = 4;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function normalizeText(raw: string): string {
  return tokens(raw).join(' ');
}

function tokens(raw: string): string[] {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t));
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Edits tolerated for a phrase of this many characters; short answers like "MFA" must be exact. */
function allowedEdits(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  if (length <= 16) return 2;
  return 3;
}

/**
 * Whole-token phrase match: the phrase must appear as a contiguous run of tokens
 * (spacing-insensitive, so "multifactor" matches "multi factor"), optionally with typos.
 */
function containsPhrase(answer: string[], phrase: string[], allowTypos: boolean): boolean {
  if (!phrase.length || !answer.length) return false;
  const target = phrase.join('');
  const edits = allowTypos ? allowedEdits(target.length) : 0;
  const maxWindow = Math.min(answer.length, phrase.length + 1);
  for (let size = 1; size <= maxWindow; size++) {
    for (let start = 0; start + size <= answer.length; start++) {
      const window = answer.slice(start, start + size).join('');
      if (Math.abs(window.length - target.length) > edits) continue;
      if (window === target || (edits > 0 && levenshtein(window, target) <= edits)) return true;
    }
  }
  return false;
}

function shortTextCorrect(q: Question, value: string): boolean {
  const answer = tokens(value);
  if (!answer.length) return false;
  return q.acceptedAnswers.some((accepted) => {
    const phrase = tokens(accepted);
    if (answer.length > phrase.length + PHRASE_SLACK) return false;
    return containsPhrase(answer, phrase, q.allowTypos);
  });
}

function groupMatches(group: KeywordGroup, input: string[]): boolean {
  return group.keywords.some((k) => containsPhrase(input, tokens(k), true));
}

/** Maximum bipartite matching: each input claims at most one group, each group counts once. */
export function matchKeywordGroups(groups: KeywordGroup[], inputs: string[]): Set<string> {
  const tokenized = inputs.map((i) => tokens(i ?? ''));
  const edges = tokenized.map((t) => (t.length ? groups.filter((g) => groupMatches(g, t)).map((g) => g.id) : []));
  const owner = new Map<string, number>();

  const tryAssign = (input: number, seen: Set<string>): boolean => {
    for (const groupId of edges[input]) {
      if (seen.has(groupId)) continue;
      seen.add(groupId);
      const current = owner.get(groupId);
      if (current === undefined || tryAssign(current, seen)) {
        owner.set(groupId, input);
        return true;
      }
    }
    return false;
  };
  edges.forEach((_, i) => tryAssign(i, new Set()));
  return new Set(owner.keys());
}

function parseNumber(value: AnswerValue | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\s,_]/g, '').replace(/−/g, '-');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function lcsLength(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

const asString = (v: AnswerValue | undefined) => (typeof v === 'string' ? v : '');
const asStrings = (v: AnswerValue | undefined) => (Array.isArray(v) ? v : []);
const asMarks = (v: AnswerValue | undefined | null) => (v && typeof v === 'object' && !Array.isArray(v) && 'marks' in v ? v.marks : []);

/** `aspect` (image height / width) only matters for spot_flags. */
export function gradeAnswer(q: Question, value: AnswerValue | undefined, aspect = 1): GradeResult {
  const maxPoints = maxPointsFor(q);
  const all = (ok: boolean): GradeResult => ({ isCorrect: ok, points: ok ? q.points : 0, maxPoints, needsReview: false });
  const partial = (fraction: number, ok: boolean): GradeResult => ({
    isCorrect: ok,
    points: round2(q.points * Math.max(0, Math.min(1, fraction))),
    maxPoints,
    needsReview: false,
  });

  switch (q.type) {
    case 'single': {
      const picked = asString(value);
      return all(q.options.some((o) => o.id === picked && o.correct));
    }
    case 'multi': {
      const picked = new Set(asStrings(value));
      const correctIds = q.options.filter((o) => o.correct).map((o) => o.id);
      const right = correctIds.filter((id) => picked.has(id)).length;
      const wrong = [...picked].filter((id) => !correctIds.includes(id)).length;
      const exact = right === correctIds.length && wrong === 0;
      if (q.multiScoring === 'partial' && correctIds.length) return partial((right - wrong) / correctIds.length, exact);
      return all(exact);
    }
    case 'boolean':
      return all(typeof value === 'boolean' && q.correctBoolean != null && value === q.correctBoolean);
    case 'short_text':
      return all(shortTextCorrect(q, asString(value)));
    case 'list_text': {
      const matched = matchKeywordGroups(q.keywordGroups, asStrings(value)).size;
      const need = Math.max(1, Math.min(q.minGroups, q.keywordGroups.length));
      return partial(matched / need, matched >= need);
    }
    case 'long_text': {
      if (!q.manualReview) return { isCorrect: null, points: 0, maxPoints: 0, needsReview: false };
      const blank = !asString(value).trim();
      return { isCorrect: blank ? false : null, points: 0, maxPoints, needsReview: !blank };
    }
    case 'number': {
      const n = parseNumber(value);
      return all(n !== null && q.correctNumber != null && Math.abs(n - q.correctNumber) <= q.tolerance);
    }
    case 'ordering': {
      const correct = q.orderItems.map((i) => i.id);
      const given = asStrings(value);
      if (!correct.length) return all(false);
      const exact = given.length === correct.length && given.every((id, i) => id === correct[i]);
      return partial(lcsLength(given, correct) / correct.length, exact);
    }
    case 'hotspot': {
      const point = value && typeof value === 'object' && !Array.isArray(value) && 'x' in value ? value : null;
      return all(
        !!point &&
          q.regions.some(
            (r) =>
              point.x >= r.x - HOTSPOT_PAD &&
              point.x <= r.x + r.w + HOTSPOT_PAD &&
              point.y >= r.y - HOTSPOT_PAD &&
              point.y <= r.y + r.h + HOTSPOT_PAD,
          ),
      );
    }
    case 'rating':
      return { isCorrect: null, points: 0, maxPoints: 0, needsReview: false };
    case 'spot_flags': {
      const total = q.regions.length;
      if (!total) return all(false);
      const { found } = replaySpot(q.regions, asMarks(value), aspect);
      return partial(found.size / total, found.size === total);
    }
  }
}

/** The answer key in a shape the player can render. Only ever sent after a reveal. */
export function correctAnswerFor(q: Question, value: AnswerValue | undefined, aspect = 1): CorrectAnswer | null {
  switch (q.type) {
    case 'single':
    case 'multi':
      return { optionIds: q.options.filter((o) => o.correct).map((o) => o.id) };
    case 'boolean':
      return q.correctBoolean == null ? null : { boolean: q.correctBoolean };
    case 'short_text':
      return { text: q.acceptedAnswers };
    case 'list_text': {
      const matched = matchKeywordGroups(q.keywordGroups, asStrings(value));
      return {
        minGroups: q.minGroups,
        groups: q.keywordGroups.map((g) => ({ id: g.id, label: g.label, keywords: g.keywords, matched: matched.has(g.id) })),
      };
    }
    case 'number':
      return q.correctNumber == null ? null : { number: q.correctNumber, tolerance: q.tolerance };
    case 'ordering':
      return { order: q.orderItems.map((i) => ({ id: i.id, label: i.label })) };
    case 'hotspot':
      return { regions: q.regions };
    case 'spot_flags':
      return { regions: q.regions, foundIndexes: [...replaySpot(q.regions, asMarks(value), aspect).found].sort((a, b) => a - b) };
    default:
      return null;
  }
}

/** The answer key in words, for admins. */
export function describeCorrect(q: Question): string {
  switch (q.type) {
    case 'single':
    case 'multi':
      return q.options.filter((o) => o.correct).map((o) => o.label).join('; ');
    case 'boolean':
      return q.correctBoolean == null ? '' : q.correctBoolean ? q.trueLabel : q.falseLabel;
    case 'short_text':
      return q.acceptedAnswers.join(' / ');
    case 'list_text':
      return `Any ${q.minGroups} of: ${q.keywordGroups.map((g) => g.label || g.keywords[0]).join('; ')}`;
    case 'number':
      return q.correctNumber == null ? '' : `${q.correctNumber}${q.tolerance ? ` ± ${q.tolerance}` : ''}${q.unit ? ` ${q.unit}` : ''}`;
    case 'ordering':
      return q.orderItems.map((i) => i.label).join(' → ');
    case 'hotspot':
      return 'The outlined area on the evidence';
    case 'spot_flags':
      return q.regions.map((r, i) => `${i + 1}. ${r.label}`).join('; ');
    default:
      return '';
  }
}

/** Plain-text rendering of an answer for tables and exports. */
export function describeAnswer(q: Question, value: AnswerValue | undefined | null, aspect = 1): string {
  if (value === undefined || value === null) return '';
  switch (q.type) {
    case 'spot_flags': {
      const { found, misses } = replaySpot(q.regions, asMarks(value), aspect);
      const names = [...found].sort((a, b) => a - b).map((i) => q.regions[i]?.label).filter(Boolean);
      return `Found ${found.size} of ${q.regions.length}${names.length ? `: ${names.join('; ')}` : ''} · ${misses} wrong ${misses === 1 ? 'box' : 'boxes'}`;
    }
    case 'single':
      return q.options.find((o) => o.id === value)?.label ?? '';
    case 'multi':
      return asStrings(value)
        .map((id) => q.options.find((o) => o.id === id)?.label ?? '')
        .filter(Boolean)
        .join('; ');
    case 'boolean':
      return value === true ? q.trueLabel : value === false ? q.falseLabel : '';
    case 'list_text':
      return asStrings(value).filter((v) => v.trim()).join('; ');
    case 'ordering':
      return asStrings(value)
        .map((id) => q.orderItems.find((i) => i.id === id)?.label ?? '')
        .join(' → ');
    case 'hotspot':
      return typeof value === 'object' && !Array.isArray(value) && 'x' in value ? `(${Math.round(value.x)}%, ${Math.round(value.y)}%)` : '';
    default:
      return String(value);
  }
}
