import { cn } from '~/lib/utils';

export const exhibitLetter = (index: number) =>
  index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + Math.floor(index / 26) - 1)}${String.fromCharCode(65 + (index % 26))}`;

/** Manila exhibit tag with a punched hole: labels a scenario or challenge. */
export function ExhibitTag({ index, title, className, tone = 'manila' }: { index: number; title?: string; className?: string; tone?: 'manila' | 'shell' }) {
  return (
    <span
      className={cn(
        'relative inline-flex min-w-0 items-center gap-2 py-1 pr-2.5 pl-6 text-xs leading-none font-bold',
        '[clip-path:polygon(10px_0,100%_0,100%_100%,10px_100%,0_50%)]',
        tone === 'manila' ? 'bg-manila text-manila-ink' : 'bg-graphite-3 text-shell-fg',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('absolute top-1/2 left-[9px] size-[7px] -translate-y-1/2 rounded-full', tone === 'manila' ? 'bg-graphite/70' : 'bg-graphite')}
      />
      <span className="tracking-[0.08em] whitespace-nowrap uppercase">Exhibit {exhibitLetter(index)}</span>
      {title ? <span className="min-w-0 truncate font-semibold tracking-normal normal-case opacity-90">· {title}</span> : null}
    </span>
  );
}

/** Stable code chip: CASE-014, S2·Q07. Mono so l/I/1 and O/0 never blur. */
export function CodeChip({ children, className, tone = 'manila' }: { children: React.ReactNode; className?: string; tone?: 'manila' | 'plain' | 'shell' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs px-1.5 py-0.5 font-mono text-[11px] leading-4 font-semibold tracking-tight whitespace-nowrap',
        tone === 'manila' && 'bg-manila-wash text-manila-ink',
        tone === 'plain' && 'bg-ground-2 text-ink-2',
        tone === 'shell' && 'bg-graphite-3 text-shell-fg',
        className,
      )}
    >
      {children}
    </span>
  );
}
