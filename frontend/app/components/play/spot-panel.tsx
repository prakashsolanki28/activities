import { Check, ScanSearch, X } from 'lucide-react';
import type { Reveal, SpotState } from '@hrrl/shared';
import { EvidenceMarker } from '~/components/evidence/marker';
import { cn } from '~/lib/utils';

export type SpotNote =
  | { kind: 'hit'; label: string; n: number }
  | { kind: 'miss'; left: number | null }
  | { kind: 'repeat'; n: number }
  | { kind: 'recorded'; left: number }
  | null;

/**
 * The live scoreboard beside the evidence: one tent per red flag (filled as found),
 * wrong guesses left, and the names of the flags found so far.
 */
export function SpotPanel({ spot, reveal, note, onDone, busy }: { spot: SpotState; reveal?: Reveal | null; note?: SpotNote; onDone?: () => void; busy?: boolean }) {
  if (spot.silent) return <SilentSpotPanel spot={spot} onDone={onDone} busy={busy} />;
  const foundIdx = new Set(spot.found.map((f) => f.index));
  const left = spot.maxMisses > 0 ? Math.max(0, spot.maxMisses - spot.misses) : null;
  const finalRegions = reveal?.correct?.regions;

  return (
    <div className="grid gap-4 rounded-xs bg-surface p-4 ring-1 ring-line">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-ink-3">Red flags found</p>
          <p className="mt-0.5 text-2xl leading-none font-extrabold text-ink tabular-nums" aria-live="polite">
            {spot.found.length}
            <span className="text-base font-semibold text-ink-3"> of {spot.total}</span>
          </p>
        </div>
        {!spot.locked && left !== null ? (
          <div className="text-right">
            <p className="text-[13px] font-bold text-ink-3">Wrong guesses left</p>
            <p className="mt-1.5 flex justify-end gap-1" aria-label={`${left} wrong guesses left`}>
              {Array.from({ length: spot.maxMisses }, (_, i) => (
                <span key={i} className={cn('size-3 rounded-full border-2', i < left ? 'border-graphite bg-graphite' : 'border-evidence/60 bg-transparent')} />
              ))}
            </p>
          </div>
        ) : null}
      </div>

      <ol className="flex flex-wrap gap-1.5" aria-label="Red flags">
        {Array.from({ length: spot.total }, (_, i) => {
          const found = foundIdx.has(i);
          const tone = finalRegions ? (found ? 'correct' : 'missed') : found ? 'marker' : 'muted';
          return (
            <li key={i}>
              <EvidenceMarker n={found || finalRegions ? i + 1 : '?'} size={24} tone={tone} title={`Red flag ${i + 1}: ${found ? 'found' : finalRegions ? 'missed' : 'not found yet'}`} />
            </li>
          );
        })}
      </ol>

      {note && !spot.locked ? (
        <p
          key={JSON.stringify(note) + spot.found.length + spot.misses}
          role="status"
          className={cn(
            'animate-stamp-in flex items-center gap-2 rounded-xs px-3 py-2 text-sm font-semibold',
            note.kind === 'hit' && 'bg-marker-wash text-ink',
            note.kind === 'miss' && 'bg-red-wash text-red-ink',
            note.kind === 'repeat' && 'bg-ground-2 text-ink-2',
          )}
        >
          {note.kind === 'hit' ? (
            <>
              <EvidenceMarker n={note.n} size={18} /> Found: {note.label}
            </>
          ) : note.kind === 'miss' ? (
            <>
              <X className="size-4" strokeWidth={3} aria-hidden /> Not a red flag.{note.left !== null ? ` ${note.left} wrong ${note.left === 1 ? 'guess' : 'guesses'} left.` : ''}
            </>
          ) : note.kind === 'repeat' ? (
            <>Already found: that is flag {note.n}.</>
          ) : null}
        </p>
      ) : null}

      {finalRegions ? (
        <ol className="grid gap-1.5" aria-label="Every red flag">
          {finalRegions.map((r, i) => {
            const found = foundIdx.has(i);
            return (
              <li key={r.id} className="flex items-start gap-2.5 text-sm leading-5">
                <EvidenceMarker n={i + 1} size={20} tone={found ? 'correct' : 'missed'} className="mt-px" />
                <span className="flex-1 text-ink">{r.label}</span>
                <span className={cn('flex shrink-0 items-center gap-1 text-xs font-bold', found ? 'text-green-ink' : 'text-red-ink')}>
                  {found ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : <X className="size-3.5" strokeWidth={3} aria-hidden />}
                  {found ? 'Found' : 'Missed'}
                </span>
              </li>
            );
          })}
        </ol>
      ) : spot.found.length ? (
        <ol className="grid gap-1.5" aria-label="Found so far">
          {spot.found.map((f) => (
            <li key={f.index} className="animate-stamp-in flex items-start gap-2.5 text-sm leading-5 text-ink">
              <EvidenceMarker n={f.index + 1} size={20} className="mt-px" />
              {f.region.label}
            </li>
          ))}
        </ol>
      ) : (
        <p className="flex gap-2 text-sm leading-6 text-ink-2">
          <ScanSearch className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
          Drag a box around anything suspicious, adjust it by its corners, then press Check. Zoom in for small details.
        </p>
      )}

      {onDone && !spot.locked ? (
        <button type="button" onClick={onDone} disabled={busy} className="justify-self-start text-[13px] font-semibold text-slate underline underline-offset-4 hover:text-ink disabled:opacity-50">
          I can’t find any more. Show me the rest
        </button>
      ) : null}
    </div>
  );
}

/** Results held: boxes are recorded, nothing is judged out loud. */
function SilentSpotPanel({ spot, onDone, busy }: { spot: SpotState; onDone?: () => void; busy?: boolean }) {
  const left = Math.max(0, spot.maxMarks - spot.drawn.length);
  return (
    <div className="grid gap-4 rounded-xs bg-surface p-4 ring-1 ring-line">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-ink-3">Boxes drawn</p>
          <p className="mt-0.5 text-2xl leading-none font-extrabold text-ink tabular-nums" aria-live="polite">
            {spot.drawn.length}
            <span className="text-base font-semibold text-ink-3"> of {spot.maxMarks}</span>
          </p>
        </div>
        <p className="text-right text-[13px] leading-5 text-ink-2">
          There {spot.total === 1 ? 'is' : 'are'} <strong className="text-ink">{spot.total}</strong> red {spot.total === 1 ? 'flag' : 'flags'} to find.
        </p>
      </div>
      <p className="flex gap-2 text-sm leading-6 text-ink-2">
        <ScanSearch className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
        {spot.locked
          ? 'Your boxes are recorded. You will see which red flags you found when the CISO Office publishes the results.'
          : `Drag a box around everything suspicious, then press Mark it. Results are not shown now; the CISO Office publishes them later. ${left} ${left === 1 ? 'box' : 'boxes'} left.`}
      </p>
      {onDone && !spot.locked ? (
        <button type="button" onClick={onDone} disabled={busy} className="justify-self-start text-[13px] font-semibold text-slate underline underline-offset-4 hover:text-ink disabled:opacity-50">
          I’m done with this screenshot
        </button>
      ) : null}
    </div>
  );
}
