import { gameQuestionsSchema, roundMax, withQuestions, type GameContent, type GameQuestions, type TeamTotals } from '@hrrl/shared';
import { newId } from '~/lib/ids';

/*
 * The question editor's draft: the game's editable questions plus a stable key per Round 2 card.
 * Card ids are their letters and change with position, so React needs keys that do not.
 */

export type ListName = 'r1' | 'r2' | 'r3' | 'r4';

export interface EditorState {
  q: GameQuestions;
  r2Keys: string[];
}

/** The schema's list minimums, so Delete can be disabled before the API would refuse. */
export const LIST_MIN: Record<ListName, number> = { r1: 1, r2: 1, r3: 2, r4: 1 };

export const LIST_PATH: Record<ListName, string> = { r1: 'r1.challenges', r2: 'r2.cards', r3: 'r3.actions', r4: 'r4.situations' };

export const ROUND_NO: Record<ListName, number> = { r1: 1, r2: 2, r3: 3, r4: 4 };

const NOUN: Record<ListName, [string, string]> = {
  r1: ['situation', 'situations'],
  r2: ['card', 'cards'],
  r3: ['action', 'actions'],
  r4: ['situation', 'situations'],
};

export const letter = (i: number) => String.fromCharCode(65 + i);

/** "Situation 3", "Card C", "Action 2". */
export function itemName(list: ListName, index: number): string {
  const noun = NOUN[list][0];
  const label = noun.charAt(0).toUpperCase() + noun.slice(1);
  return list === 'r2' ? `${label} ${letter(index)}` : `${label} ${index + 1}`;
}

export function nounFor(list: ListName, count: number): string {
  return NOUN[list][count === 1 ? 0 : 1];
}

/** The live array for a round's items (mutable: only call on a draft copy). */
export function listOf(q: GameQuestions, list: ListName): { id: string }[] {
  switch (list) {
    case 'r1':
      return q.r1.challenges;
    case 'r2':
      return q.r2.cards;
    case 'r3':
      return q.r3.actions;
    case 'r4':
      return q.r4.situations;
  }
}

/** Cards are lettered A, B, C… by position: the letter is what the printed card and the host show. */
export function reletter(q: GameQuestions) {
  q.r2.cards.forEach((c, i) => {
    c.id = letter(i);
  });
}

type Q = GameQuestions;

export function newItem(list: ListName, id: string): { id: string } {
  switch (list) {
    case 'r1': {
      const item: Q['r1']['challenges'][number] = { id, situation: '', answer: 'verify', explanation: '' };
      return item;
    }
    case 'r2': {
      const item: Q['r2']['cards'][number] = { id, title: '', brief: '', teamTask: '', warningSigns: [''], safeResponse: [''] };
      return item;
    }
    case 'r3': {
      const item: Q['r3']['actions'][number] = { id, label: '', cost: 10, points: 10 };
      return item;
    }
    case 'r4': {
      const item: Q['r4']['situations'][number] = { id, text: '', correctAction: '' };
      return item;
    }
  }
}

/** A fresh editor state for saved questions, keeping card keys by position so nothing remounts. */
export function stateFor(q: GameQuestions, keys: string[] = []): EditorState {
  return { q, r2Keys: q.r2.cards.map((_, i) => keys[i] ?? newId()) };
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

type ZodIssue = NonNullable<ReturnType<typeof gameQuestionsSchema.safeParse>['error']>['issues'][number];

export interface Issue {
  message: string;
  /** An empty required field: shown once the field has been left, or when the admin asks to see every issue. */
  quiet: boolean;
}

function friendly(i: ZodIssue): string {
  switch (i.code) {
    case 'invalid_type':
      if (i.expected === 'int') return 'Use a whole number';
      if (i.expected === 'number') return 'Enter a number';
      return i.message;
    case 'too_small':
      return i.origin === 'number' ? `Use ${i.minimum} or more` : i.message;
    case 'too_big':
      if (i.origin === 'number') return `Use ${i.maximum} or less`;
      if (i.origin === 'string') return `Keep it to ${i.maximum} characters`;
      if (i.origin === 'array') return `Up to ${i.maximum}`;
      return i.message;
    default:
      return i.message;
  }
}

/** Issues by dotted path, e.g. "r1.challenges.2.situation" (the first issue per path). */
export function collectIssues(q: GameQuestions): Map<string, Issue> {
  const out = new Map<string, Issue>();
  const r = gameQuestionsSchema.safeParse(q);
  if (r.success) return out;
  for (const i of r.error.issues) {
    const path = i.path.map(String).join('.');
    if (out.has(path)) continue;
    out.set(path, { message: friendly(i), quiet: i.code === 'too_small' && i.origin === 'string' });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Display helpers                                                      */
/* ------------------------------------------------------------------ */

export function maxOf(content: GameContent, q: GameQuestions): TeamTotals {
  return roundMax(withQuestions(content, q));
}

/** A number for display; a half-typed number box shows a dash. */
export const num = (n: number) => (Number.isFinite(n) ? String(n) : '–');

export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Focus an element after React has committed, and bring it to the middle of the screen. */
export function focusSoon(find: () => HTMLElement | null | undefined) {
  requestAnimationFrame(() => {
    const el = find();
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
}
