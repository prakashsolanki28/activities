import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { formatClock, useCountdown } from '~/lib/game-timer';
import { useHost } from './host-context';
import { cn } from '~/lib/utils';

const PRESETS = [15, 60, 120, 180] as const;
type Phase = 'idle' | 'running' | 'paused' | 'done';

const spoken = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return [m ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '', s ? `${s} seconds` : ''].filter(Boolean).join(' ') || '0 seconds';
};

/** The stage countdown: shown on the projector, counted against the server clock. */
export function TimerControls() {
  const { game, stage, nav, actions } = useHost();
  const timer = game.state.timer;
  const c = useCountdown(timer, game.serverNow);
  const phase: Phase = !timer ? 'idle' : c.done ? 'done' : c.paused ? 'paused' : 'running';
  const suggested = stage.timerSec ?? 15;

  // Announce start, pause and stop once; the ticking digits stay silent.
  const [announce, setAnnounce] = useState('');
  const signature = `${phase}:${timer?.endsAt ?? ''}`;
  const prev = useRef(signature);
  useEffect(() => {
    if (prev.current === signature) return;
    prev.current = signature;
    setAnnounce(
      phase === 'running'
        ? `Countdown running: ${spoken(c.seconds)} left`
        : phase === 'paused'
          ? `Countdown paused with ${spoken(c.seconds)} left`
          : phase === 'done'
            ? 'Time is up'
            : 'Countdown cleared',
    );
    // c.seconds is read at the moment the countdown starts or stops; it must not re-trigger the announcement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-line bg-ground px-3 py-2.5">
      <div className="flex min-w-[132px] items-center gap-3">
        <Timer className={cn('size-5 shrink-0', phase === 'running' ? 'text-brand' : phase === 'done' ? 'text-bad' : 'text-ink-3')} aria-hidden />
        <div>
          <span
            aria-live="off"
            className={cn(
              'block font-mono text-[28px] leading-8 font-semibold tabular-nums',
              phase === 'done' ? 'text-bad' : phase === 'idle' ? 'text-ink-3' : 'text-ink',
            )}
          >
            {formatClock(phase === 'idle' ? suggested : c.seconds)}
          </span>
          <span className="block text-xs text-ink-3">
            {phase === 'idle' ? 'Countdown' : phase === 'running' ? 'Running' : phase === 'paused' ? 'Paused' : 'Time is up'}
          </span>
        </div>
        {timer && phase !== 'idle' ? (
          <div
            className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-line sm:block"
            role="presentation"
          >
            <div className={cn('h-full rounded-full', phase === 'done' ? 'bg-bad' : 'bg-brand')} style={{ width: `${Math.round((1 - c.progress) * 100)}%` }} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {phase === 'idle' ? (
          <Button variant="outline" onClick={() => nav.startTimer(suggested)} className="h-11 px-4">
            <Play /> Start {formatClock(suggested)}
          </Button>
        ) : phase === 'running' ? (
          <Button variant="outline" onClick={() => actions.timer({ action: 'pause' })} className="h-11">
            <Pause /> Pause
          </Button>
        ) : phase === 'paused' ? (
          <Button variant="outline" onClick={() => actions.timer({ action: 'resume' })} className="h-11">
            <Play /> Resume
          </Button>
        ) : (
          <Button variant="outline" onClick={() => nav.startTimer(timer?.durationSec ?? suggested)} className="h-11">
            <RotateCcw /> Restart
          </Button>
        )}
        {phase !== 'idle' ? (
          <Button variant="ghost" onClick={() => actions.timer({ action: 'clear' })} className="h-11">
            <X /> Clear
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Start a countdown of">
        {PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => nav.startTimer(s)}
            className="h-11 min-w-11 rounded-md px-2 font-mono text-[13px] font-semibold text-ink-2 tabular-nums ring-1 ring-line-strong ring-inset outline-none hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Start ${spoken(s)}`}
          >
            {formatClock(s)}
          </button>
        ))}
      </div>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </span>
    </div>
  );
}
