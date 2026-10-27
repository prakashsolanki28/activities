import { EyeOff, MonitorPlay } from 'lucide-react';
import { CARD_LABELS, type CardChoice, type GameStatus, type Team } from '@hrrl/shared';
import { cn } from '~/lib/utils';

const STATUS: Record<GameStatus, { label: string; className: string; dot: string }> = {
  setup: { label: 'Not started', className: 'bg-ground-2 text-ink-2', dot: 'bg-ink-3' },
  live: { label: 'In progress', className: 'bg-ok-tint text-ok ring-1 ring-ok/30 ring-inset', dot: 'bg-ok' },
  finished: { label: 'Finished', className: 'bg-brand-tint text-brand ring-1 ring-brand/30 ring-inset', dot: 'bg-brand' },
};

/** Game status in plain words: Not started, In progress, Finished. */
export function GameStatusBadge({ status, className }: { status: GameStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap', s.className, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

export function TeamName({ team, className, strong = true }: { team: Pick<Team, 'name' | 'emoji'>; className?: string; strong?: boolean }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {team.emoji ? (
        <span className="w-5 shrink-0 text-center text-base leading-none" aria-hidden>
          {team.emoji}
        </span>
      ) : null}
      <span className={cn('truncate', strong && 'font-semibold text-ink')}>{team.name}</span>
    </span>
  );
}

export const CARD_TONE: Record<CardChoice, { chip: string; on: string; dot: string }> = {
  safe: { chip: 'bg-ok-tint text-ok ring-ok/40', on: 'bg-ok text-white ring-ok', dot: 'bg-ok' },
  danger: { chip: 'bg-bad-tint text-bad ring-bad/40', on: 'bg-bad text-white ring-bad', dot: 'bg-bad' },
  verify: { chip: 'bg-warn-tint text-warn ring-warn/40', on: 'bg-warn text-white ring-warn', dot: 'bg-warn' },
};

export function CardChip({ choice, className }: { choice: CardChoice; className?: string }) {
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset', CARD_TONE[choice].chip, className)}>
      <span className={cn('size-2 rounded-full', CARD_TONE[choice].dot)} aria-hidden />
      {CARD_LABELS[choice]}
    </span>
  );
}

export function BulletList({ items, className }: { items: readonly string[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn('grid gap-1.5 text-sm leading-5 text-ink-2', className)}>
      {items.map((t, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink-3" aria-hidden />
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function SubHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h4 className={cn('text-xs font-semibold tracking-[0.02em] text-ink-3 uppercase', className)}>{children}</h4>;
}

/** What the projector shows for this stage. */
export function RoomSection({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-label="On the projector" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2">
          <MonitorPlay className="size-4 text-ink-3" aria-hidden /> On the projector
        </h3>
        {aside}
      </div>
      <div className="grid gap-3 rounded-lg border border-line bg-surface p-4">{children}</div>
    </section>
  );
}

/** Answers and notes for the host; never on the projector unless the label says so. */
export function HostSection({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section aria-label="Only on your screen" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink-2">
          <EyeOff className="size-4 text-warn" aria-hidden /> Only on your screen
        </h3>
        {aside}
      </div>
      <div className="grid gap-4 rounded-lg bg-warn-tint p-4 ring-1 ring-warn/25 ring-inset">{children}</div>
    </section>
  );
}

/** Small status line next to an answer: hidden until Reveal, or on the projector now. */
export function RevealNote({ shown, hiddenText = 'Hidden on the projector until you press Reveal', shownText = 'On the projector now' }: { shown: boolean; hiddenText?: string; shownText?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', shown ? 'text-ok' : 'text-ink-3')}>
      <span className={cn('size-1.5 rounded-full', shown ? 'bg-ok' : 'bg-ink-3')} aria-hidden />
      {shown ? shownText : hiddenText}
    </span>
  );
}
