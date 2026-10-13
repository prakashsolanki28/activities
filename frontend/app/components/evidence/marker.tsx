import { cn } from '~/lib/utils';

export type MarkerTone = 'marker' | 'correct' | 'missed' | 'muted' | 'outline';
type Tone = MarkerTone;

const TONES: Record<Tone, { face: string; side: string; text: string; stroke: string }> = {
  marker: { face: 'var(--marker)', side: '#d6a815', text: 'var(--marker-ink)', stroke: 'rgb(26 28 30 / 0.55)' },
  correct: { face: 'var(--ledger-green)', side: '#17663f', text: '#ffffff', stroke: 'rgb(0 0 0 / 0.35)' },
  missed: { face: 'var(--evidence-red)', side: '#9a2b1f', text: '#ffffff', stroke: 'rgb(0 0 0 / 0.35)' },
  muted: { face: 'var(--ground-2)', side: '#d5d8d0', text: 'var(--ink-3)', stroke: 'var(--line-strong)' },
  outline: { face: 'var(--surface)', side: 'var(--ground-2)', text: 'var(--ink)', stroke: 'var(--ink-3)' },
};

/**
 * A numbered evidence tent marker — the product's signature. Front face plus a darker
 * side face so it reads as a folded card standing on the evidence, not a badge.
 */
export function EvidenceMarker({
  n,
  tone = 'marker',
  size = 26,
  className,
  title,
}: {
  n: number | string;
  tone?: Tone;
  size?: number;
  className?: string;
  title?: string;
}) {
  const t = TONES[tone];
  const label = String(n);
  return (
    <svg
      viewBox="0 0 26 28"
      width={size}
      height={(size * 28) / 26}
      className={cn('shrink-0 overflow-visible', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M17 2.5 L23.5 26 L20 26 L15.5 2.5 Z" fill={t.side} />
      <path d="M8.5 2.5 H17 L22 26 H2.5 Z" fill={t.face} stroke={t.stroke} strokeWidth="0.75" strokeLinejoin="round" />
      <text
        x="12.4"
        y="19.6"
        textAnchor="middle"
        fontSize={label.length > 1 ? 9.5 : 11.5}
        fontWeight="800"
        fontFamily="var(--font-sans)"
        fill={t.text}
      >
        {label}
      </text>
    </svg>
  );
}
