import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CisoLockup, HrrlLockup } from '~/components/brand';
import { ClockFace, DrainBar } from '~/components/game/countdown';
import { ScoreStrip } from '~/components/game/score-table';
import { DisplayStyles, StageView } from '~/components/game/stage-views';
import { useDisplaySounds } from '~/components/game/use-display-sounds';
import { PublicMessage } from '~/components/play/public-shell';
import { ApiError, errorMessage } from '~/lib/api';
import { useGameDisplay } from '~/lib/game-api';
import { useCountdown } from '~/lib/game-timer';
import type { Route } from './+types/display';

export const meta: Route.MetaFunction = () => [{ title: 'Cyber Survivor · HRRL Activities' }];

const NO_STRIP = new Set(['lobby', 'scores', 'final']);

/** Projector display: public, read-only, polls once a second. Keys: F fullscreen, M mute. */
export default function GameDisplay() {
  const { code = '' } = useParams();
  const q = useGameDisplay(code);
  const display = q.data;
  const cd = useCountdown(display?.timer, display?.serverNow);
  const { unlocked, muted, unlock, toggleMute } = useDisplaySounds(display, cd);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setHintVisible(false), 9000);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      unlock();
      const k = e.key.toLowerCase();
      if (k === 'f') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
      } else if (k === 'm') {
        toggleMute();
      }
      setHintVisible(true);
      window.setTimeout(() => setHintVisible(false), 4000);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unlock, toggleMute]);

  if (q.error && !display) {
    if (q.error instanceof ApiError && (q.error.status === 404 || q.error.code === 'game_not_found')) {
      return <PublicMessage title="No game here">Check the code on the host screen. It looks like this game does not exist or has been removed.</PublicMessage>;
    }
    // Anything else (server down, network): say so. The query keeps polling, so the game appears once it is back.
    return <PublicMessage title="Connecting to the game…">{errorMessage(q.error)} This screen keeps trying and will show the game as soon as it can reach it.</PublicMessage>;
  }
  if (!display) {
    return (
      <div className="flex h-dvh flex-col bg-graphite" aria-busy="true">
        <div className="h-[13vh] bg-surface" />
        <div className="m-[4vw] flex-1 animate-pulse rounded-xs bg-graphite-2" />
      </div>
    );
  }

  const showStrip = !NO_STRIP.has(display.stage.kind);
  const round = display.stage.round ? `Round ${display.stage.round.replace('r', '')} · ` : '';
  return (
    <div className="on-shell flex h-dvh flex-col overflow-hidden bg-graphite text-shell-fg" onClick={unlock} data-testid="display" data-stage={display.stage.id}>
      <DisplayStyles />
      <header className="flex items-center gap-[2.5vw] bg-surface px-[3vw] py-[1.4vh] text-ink">
        <HrrlLockup className="h-[clamp(40px,7.5vh,96px)] shrink-0" />
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[clamp(1.1rem,2.2vw,2.6rem)] leading-tight font-extrabold tracking-[-0.01em]">{display.title}</p>
          <p className="truncate text-[clamp(0.8rem,1.35vw,1.6rem)] leading-tight font-semibold text-ink-3" data-testid="stage-label">
            {round}
            {display.stage.label}
          </p>
        </div>
        {display.timer ? <ClockFace cd={cd} /> : null}
        <CisoLockup className="h-[clamp(30px,5.5vh,70px)] shrink-0" />
      </header>
      {display.timer ? <DrainBar cd={cd} /> : <div className="h-[1.1vh] min-h-1.5 bg-graphite-3" aria-hidden />}
      <main className="min-h-0 flex-1 overflow-hidden px-[4vw] py-[3vh]">
        <StageView display={display} />
      </main>
      {showStrip ? <ScoreStrip display={display} /> : null}

      {/* Notices share the top-right corner: stage text is left-aligned, so they never cover it. */}
      <div className="pointer-events-none fixed top-[15vh] right-[2vw] flex flex-col items-end gap-2">
        {q.isError ? (
          <div className="rounded-xs bg-marker px-4 py-2 text-sm font-bold text-marker-ink" role="status">
            Reconnecting…
          </div>
        ) : null}
        {!unlocked ? (
          <div className="rounded-full bg-surface px-5 py-2 text-[clamp(0.85rem,1.2vw,1.3rem)] font-bold text-ink shadow-plate" data-testid="sound-chip">
            Click anywhere to turn on sound
          </div>
        ) : null}
        <div className="rounded-xs bg-graphite-2/90 px-3 py-1.5 text-xs text-shell-muted transition-opacity duration-700" style={{ opacity: hintVisible || muted ? 1 : 0 }} aria-hidden>
          F fullscreen · M {muted ? 'unmute (sound is off)' : 'mute'}
        </div>
      </div>
    </div>
  );
}
