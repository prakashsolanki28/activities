import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { ROUND_IDS, type Stage } from '@hrrl/shared';
import { useHost } from './host-context';
import { cn } from '~/lib/utils';

interface Group {
  key: string;
  title: string;
  subtitle?: string;
  items: { stage: Stage; index: number }[];
}

/** Every stage in play order, grouped by round. Click one to jump to it. */
export function StageRail({ autoScroll = false, className }: { autoScroll?: boolean; className?: string }) {
  const { game, stages, index: current, nav } = useHost();
  const c = game.content;
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoScroll) currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [autoScroll, current]);

  const groups: Group[] = [];
  stages.forEach((stage, index) => {
    const key = stage.round ?? (stage.kind === 'lobby' ? 'start' : 'finish');
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const n = stage.round ? ROUND_IDS.indexOf(stage.round) + 1 : 0;
      g = stage.round
        ? { key, title: `Round ${n}`, subtitle: c[stage.round].title, items: [] }
        : { key, title: key === 'start' ? 'Start' : 'Finish', items: [] };
      groups.push(g);
    }
    g.items.push({ stage, index });
  });

  const answered = (s: Stage) => (s.kind === 'r1-challenge' && s.challengeId ? game.teams.filter((t) => game.scores[t.id]?.r1[s.challengeId!] != null).length : null);

  return (
    <nav aria-label="Stages" className={cn('grid gap-4', className)}>
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="px-2 text-xs font-semibold tracking-[0.02em] text-ink-3 uppercase">
            {g.title}
            {g.subtitle ? <span className="mt-0.5 block text-[13px] font-normal tracking-normal text-ink-2 normal-case">{g.subtitle}</span> : null}
          </h3>
          <ol className="mt-1.5 grid gap-0.5">
            {g.items.map(({ stage, index }) => {
              const isCurrent = index === current;
              const done = index < current;
              const count = answered(stage);
              return (
                <li key={stage.id}>
                  <button
                    ref={isCurrent ? currentRef : undefined}
                    type="button"
                    onClick={() => nav.go(stage.id)}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'relative flex min-h-10 w-full items-center gap-2.5 rounded-md py-1.5 pr-2 pl-2 text-left text-[13px] leading-5 outline-none',
                      'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                      isCurrent ? 'bg-brand-tint font-semibold text-ink' : 'text-ink-2 hover:bg-ground-2 hover:text-ink',
                    )}
                  >
                    {isCurrent ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand" aria-hidden /> : null}
                    <span
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums',
                        isCurrent ? 'bg-brand text-white' : done ? 'bg-ground-2 text-ink-3' : 'text-ink-3 ring-1 ring-line-strong ring-inset',
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="size-3" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{stage.kind === 'round-intro' ? 'Introduction' : stage.label}</span>
                    {count != null ? (
                      <span className={cn('shrink-0 text-[11px] tabular-nums', count === game.teams.length ? 'text-ok' : 'text-ink-3')} title={`${count} of ${game.teams.length} answers recorded`}>
                        {count}/{game.teams.length}
                        <span className="sr-only"> answers recorded</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );
}
