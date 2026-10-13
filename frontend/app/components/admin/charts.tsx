import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
  /** Tooltip body; defaults to "label: value". */
  detail?: React.ReactNode;
  tone?: 'data' | 'muted' | 'good';
}

function niceMax(max: number): number {
  if (max <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= max / 4)! * pow;
  return Math.ceil(max / step) * step;
}

const TONE = { data: 'bg-data', muted: 'bg-line-strong', good: 'bg-ok' } as const;

/**
 * Columns grow from one baseline: ≤24px wide, 4px rounded data-end, square at the base,
 * hairline grid, and a full-height hover target per column carrying the tooltip.
 */
export function ColumnChart({
  data,
  height = 160,
  format = (n) => String(n),
  label,
  labelEvery = 1,
  threshold,
}: {
  data: ColumnDatum[];
  height?: number;
  format?: (n: number) => string;
  label: string;
  labelEvery?: number;
  threshold?: { at: number; label: string };
}) {
  const max = niceMax(Math.max(...data.map((d) => d.value), threshold?.at ?? 0));
  // Counts of people never get a half-person gridline.
  const ticks = Number.isInteger(max / 2) ? [0, max / 2, max] : [0, max];
  return (
    <figure aria-label={label}>
      <div className="relative grid grid-cols-[auto_1fr] gap-x-2">
        <div className="relative text-right text-[11px] text-ink-3 tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0" style={{ bottom: `${(t / max) * 100}%`, transform: 'translateY(50%)' }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          {threshold ? (
            <span className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${(threshold.at / max) * 100}%` }}>
              <span className="absolute -top-4 right-0 bg-surface px-1 text-xs font-semibold text-ink-3">{threshold.label}</span>
            </span>
          ) : null}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d) => (
              <Tooltip key={d.key}>
                <TooltipTrigger asChild>
                  <span className="group/col flex h-full flex-1 cursor-default items-end justify-center" tabIndex={0}>
                    <span
                      className={cn('w-full max-w-6 rounded-t-[4px] transition-opacity group-hover/col:opacity-80', TONE[d.tone ?? 'data'])}
                      style={{ height: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%` }}
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{d.detail ?? `${d.label}: ${format(d.value)}`}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
        <span />
        <div className="relative mt-1.5 flex h-4 gap-[2px] text-[11px] text-ink-3" aria-hidden>
          {data.map((d, i) => (
            <span key={d.key} className="relative flex-1">
              {i % labelEvery === 0 ? <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{d.label}</span> : null}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bar with its value at the tip; for a single measure per row (0–100%). */
export function MeterBar({ value, max = 100, tone = 'data', label }: { value: number | null; max?: number; tone?: 'data' | 'good' | 'muted'; label: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="flex items-center gap-2" role="img" aria-label={label}>
      <span className="relative h-2.5 flex-1 rounded-r-[4px] bg-ground-2">
        <span className={cn('absolute inset-y-0 left-0 rounded-r-[4px]', TONE[tone])} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
