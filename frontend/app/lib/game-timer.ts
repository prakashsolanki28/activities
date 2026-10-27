import { useEffect, useMemo, useState } from 'react';
import { timerRemaining, type GameTimer } from '@hrrl/shared';
import { clockOffset } from './public-api';

export interface Countdown {
  /** Whole seconds left, rounded up (shows 15 … 1, then 0). */
  seconds: number;
  /** 0 → 1 share of the duration used. */
  progress: number;
  running: boolean;
  paused: boolean;
  done: boolean;
}

/** Live countdown for a game timer, corrected to the server clock. Ticks four times a second while running. */
export function useCountdown(timer: GameTimer | null | undefined, serverNow: string | undefined): Countdown {
  const offset = useMemo(() => (serverNow ? clockOffset(serverNow) : 0), [serverNow]);
  const running = !!timer?.endsAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [running, timer?.endsAt]);

  if (!timer) return { seconds: 0, progress: 0, running: false, paused: false, done: false };
  const left = timerRemaining(timer, now + offset);
  const seconds = Math.ceil(left - 0.05);
  return {
    seconds: Math.max(0, seconds),
    progress: timer.durationSec ? Math.min(1, Math.max(0, 1 - left / timer.durationSec)) : 1,
    running: running && left > 0,
    paused: timer.remainingSec != null,
    done: running && left <= 0,
  };
}

export const formatClock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
