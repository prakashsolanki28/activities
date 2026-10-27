import { Trophy } from 'lucide-react';
import { ROUND_IDS } from '@hrrl/shared';
import { useHost } from './host-context';
import { TeamName } from './bits';
import { cn } from '~/lib/utils';

/** Every team's points by round, ranked best first. The host sees the full scores, revealed or not. */
export function Scoreboard({ size = 'compact', className }: { size?: 'compact' | 'full'; className?: string }) {
  const { game, ranked, max } = useHost();
  const full = size === 'full';
  const cell = full ? 'h-11 px-2' : 'h-9 px-1.5';
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className={cn('w-full tabular-nums', full ? 'text-sm' : 'text-[13px]')}>
        <caption className="sr-only">Scoreboard, best first</caption>
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            <th scope="col" className={cn(cell, 'w-7 pl-0 text-left font-semibold')}>
              <span className="sr-only">Rank</span>#
            </th>
            <th scope="col" className={cn(cell, 'text-left font-semibold')}>
              Team
            </th>
            {ROUND_IDS.map((r, i) => (
              <th key={r} scope="col" className={cn(cell, 'w-11 text-right font-semibold whitespace-nowrap')}>
                <abbr title={`Round ${i + 1}, out of ${max[r]}`} className="no-underline">
                  R{i + 1}
                </abbr>
                <span className="block text-[11px] font-normal">/{max[r]}</span>
              </th>
            ))}
            <th scope="col" className={cn(cell, 'w-14 pr-0 text-right font-semibold whitespace-nowrap')}>
              Total
              <span className="block text-[11px] font-normal">/{max.total}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ranked.map((r) => {
            const t = game.totals[r.team.id] ?? r.totals;
            const lead = r.rank === 1 && t.total > 0;
            return (
              <tr key={r.team.id}>
                <td className={cn(cell, 'pl-0 font-semibold text-ink-2')}>{r.rank}</td>
                <td className={cn(cell, 'max-w-0')}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <TeamName team={r.team} />
                    {r.tiebreakWin ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-1.5 text-[11px] font-semibold text-brand" title="Won the tie-breaker">
                        <Trophy className="size-3" aria-hidden /> Tie-break
                      </span>
                    ) : null}
                  </span>
                </td>
                {ROUND_IDS.map((rid) => (
                  <td key={rid} className={cn(cell, 'text-right text-ink-2')}>
                    {t[rid]}
                  </td>
                ))}
                <td className={cn(cell, 'pr-0 text-right font-semibold', lead ? 'text-brand' : 'text-ink', full && 'text-base')}>{t.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
