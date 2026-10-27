import type { CardChoice } from '@hrrl/shared';

/** One look for the three answer cards, shared by the projector and the printed cards. */
export const CARD_META: Record<CardChoice, { symbol: string; word: string; solid: string; border: string; text: string; borderStyle: string }> = {
  safe: { symbol: '✓', word: 'Safe', solid: 'bg-ledger text-white', border: 'border-ledger', text: 'text-ledger', borderStyle: 'border-solid' },
  danger: { symbol: '✕', word: 'Danger', solid: 'bg-evidence text-white', border: 'border-evidence', text: 'text-evidence', borderStyle: 'border-double' },
  verify: { symbol: '?', word: 'Verify first', solid: 'bg-marker text-marker-ink', border: 'border-marker', text: 'text-manila-ink', borderStyle: 'border-dashed' },
};
