import type { PublicGameDisplay } from '@hrrl/shared';
import { EvidenceMarker } from '~/components/evidence/marker';
import { cn } from '~/lib/utils';

/** Full ranked table: R1 R2 R3 R4 and Total, from the (already reveal-safe) public scoreboard. */
export function ScoreTable({ display, highlightId }: { display: PublicGameDisplay; highlightId?: string | null }) {
  const teams = new Map(display.teams.map((t) => [t.id, t]));
  const { max } = display;
  const cols: { key: 'r1' | 'r2' | 'r3' | 'r4' | 'total'; label: string }[] = [
    { key: 'r1', label: `R1 / ${max.r1}` },
    { key: 'r2', label: `R2 / ${max.r2}` },
    { key: 'r3', label: `R3 / ${max.r3}` },
    { key: 'r4', label: `R4 / ${max.r4}` },
    { key: 'total', label: `Total / ${max.total}` },
  ];
  return (
    <table className="w-full border-collapse text-left" style={{ fontSize: `clamp(0.8rem, min(1.9vw, ${38 / (display.scoreboard.length + 1)}vh), 2.2rem)` }} data-testid="score-table">
      <thead>
        <tr className="border-b-2 border-graphite-3 text-[0.65em] font-bold tracking-[0.06em] text-shell-muted uppercase">
          <th scope="col" className="w-[7vw] py-[0.8vh]">
            Rank
          </th>
          <th scope="col">Team</th>
          {cols.map((c) => (
            <th key={c.key} scope="col" className="text-right">
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {display.scoreboard.map((row) => {
          const team = teams.get(row.teamId);
          return (
            <tr key={row.teamId} className={cn('border-b border-graphite-3', highlightId === row.teamId && 'bg-graphite-2')} data-testid={`score-row-${row.teamId}`}>
              <td className="py-[0.35em]">
                {row.rank <= 3 ? <EvidenceMarker n={row.rank} size={30} title={`Rank ${row.rank}`} /> : <span className="pl-2 font-mono font-bold text-shell-muted">{row.rank}</span>}
              </td>
              <td className="font-bold">
                <span className="mr-[0.6vw]">{team?.emoji}</span>
                {team?.name ?? row.teamId}
                {row.tiebreakWin ? <span className="ml-3 text-[0.6em] font-bold text-marker">Tie-breaker winner</span> : null}
              </td>
              {cols.map((c) => (
                <td key={c.key} className={cn('text-right tabular-nums', c.key === 'total' ? 'font-extrabold text-marker' : 'text-shell-fg')}>
                  {row.totals[c.key]}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Slim strip along the bottom: team and running total, in rank order. */
export function ScoreStrip({ display }: { display: PublicGameDisplay }) {
  const teams = new Map(display.teams.map((t) => [t.id, t]));
  return (
    <div className="flex items-stretch gap-[1vw] border-t-2 border-graphite-3 bg-graphite-2 px-[4vw] py-[1.2vh]" data-testid="score-strip">
      {display.scoreboard.map((row) => {
        const t = teams.get(row.teamId);
        return (
          <div key={row.teamId} className="flex min-w-0 flex-1 items-center justify-between gap-[0.8vw]" data-testid={`strip-${row.teamId}`}>
            <span className="truncate text-[clamp(0.9rem,1.5vw,1.7rem)] font-semibold">
              <span className="mr-[0.4vw]">{t?.emoji}</span>
              {t?.name}
            </span>
            <span className="font-mono text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold text-marker tabular-nums" data-testid={`strip-total-${row.teamId}`}>
              {row.totals.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
