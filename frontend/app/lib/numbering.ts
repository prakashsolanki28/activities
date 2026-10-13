import type { Section } from '@hrrl/shared';

/** Question numbers as the builder shows them: 1, 2, 3… across sections, skipping deleted questions. */
export function questionNumbers(sections: Section[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sections) for (const q of s.questions) if (!q.archived) out.set(q.id, out.size + 1);
  return out;
}
