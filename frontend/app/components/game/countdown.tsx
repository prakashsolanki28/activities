import { formatClock } from '~/lib/game-timer';
import { cn } from '~/lib/utils';
import type { Countdown } from '~/lib/game-timer';

/** Big digital clock for the masthead. Red in the last five seconds. */
export function ClockFace({ cd }: { cd: Countdown }) {
  const urgent = !cd.paused && cd.seconds <= 5 && (cd.running || cd.done);
  const label = cd.done ? 'Time’s up!' : cd.paused ? 'Paused' : null;
  return (
    <div
      className={cn(
        'flex items-center gap-[1.2vw] rounded-xs px-[1.4vw] py-[0.6vh] tabular-nums transition-colors',
        urgent ? 'cs-urgent bg-evidence text-white' : 'bg-graphite text-shell-fg',
      )}
      role="timer"
      aria-live="off"
      data-testid="clock"
    >
      <span className="font-mono text-[clamp(2.2rem,4.6vw,5rem)] leading-none font-extrabold">{formatClock(cd.seconds)}</span>
      {label ? <span className="text-[clamp(1rem,1.7vw,1.9rem)] leading-tight font-bold">{label}</span> : null}
    </div>
  );
}

/** Thin bar under the masthead that drains as time runs out. */
export function DrainBar({ cd }: { cd: Countdown }) {
  const urgent = !cd.paused && cd.seconds <= 5 && (cd.running || cd.done);
  return (
    <div className="h-[1.1vh] min-h-1.5 w-full bg-graphite-3" aria-hidden>
      <div className={cn('h-full origin-left', urgent ? 'bg-evidence' : 'bg-marker')} style={{ width: `${(1 - cd.progress) * 100}%`, transition: 'width 250ms linear' }} />
    </div>
  );
}
