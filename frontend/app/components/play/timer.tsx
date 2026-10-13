import { useEffect, useRef, useState } from 'react';
import { Timer as TimerIcon } from 'lucide-react';
import { formatClock } from '~/lib/format';
import { cn } from '~/lib/utils';

/** Countdown against the server clock. Fires `onExpire` once when time runs out. */
export function Countdown({ deadlineAt, offsetMs, onExpire }: { deadlineAt: string; offsetMs: number; onExpire: () => void }) {
  const deadline = new Date(deadlineAt).getTime();
  const remaining = () => (deadline - (Date.now() + offsetMs)) / 1000;
  const [left, setLeft] = useState(remaining);
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const r = remaining();
      setLeft(r);
      if (r <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offsetMs]);

  const urgent = left <= 60;
  const warning = left <= 300;
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-xs px-2.5 font-mono text-sm font-bold tabular-nums',
        urgent ? 'bg-evidence text-white' : warning ? 'bg-manila text-manila-ink' : 'bg-graphite-3 text-shell-fg',
      )}
      role="timer"
      aria-label={`Time left ${formatClock(left)}`}
    >
      <TimerIcon className="size-3.5" aria-hidden />
      {formatClock(left)}
    </span>
  );
}
