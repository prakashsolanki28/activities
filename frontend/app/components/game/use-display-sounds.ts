import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicGameDisplay } from '@hrrl/shared';
import { createGameSound, type GameSound } from '~/lib/game-sound';
import type { Countdown } from '~/lib/game-timer';

/**
 * Sounds for the projector. Nothing plays for whatever is already on screen when the page opens:
 * the first payload only seeds the guards.
 */
export function useDisplaySounds(display: PublicGameDisplay | undefined, cd: Countdown) {
  const soundRef = useRef<GameSound | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [muted, setMutedState] = useState(false);
  const stageRef = useRef<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const buzzedRef = useRef<string | null>(null);
  const seenRef = useRef(false);

  const sound = useCallback(() => (soundRef.current ??= createGameSound()), []);

  const unlock = useCallback(() => {
    sound().unlock();
    setUnlocked(true);
  }, [sound]);

  const toggleMute = useCallback(() => {
    const s = sound();
    s.setMuted(!s.muted);
    setMutedState(s.muted);
  }, [sound]);

  const endsAt = display?.timer?.endsAt ?? null;
  const stageId = display?.stage.id ?? null;
  const kind = display?.stage.kind;
  const championTeamId = display?.view.kind === 'final' ? display.view.championTeamId : null;

  // Stage changes: sting on round intros and twists, fanfare for a champion.
  useEffect(() => {
    if (!stageId) return;
    const prev = stageRef.current;
    stageRef.current = stageId;
    if (prev === null || prev === stageId) return;
    if (kind === 'round-intro' || kind === 'r3-twist') sound().sting();
    else if (kind === 'final' && championTeamId) sound().fanfare();
  }, [stageId, kind, championTeamId, sound]);

  // Last five seconds: one tick per second.
  useEffect(() => {
    if (!display) return;
    const secs = cd.running && !cd.paused && cd.seconds > 0 && cd.seconds <= 5 ? cd.seconds : null;
    if (secs === null) {
      tickRef.current = null;
      return;
    }
    if (tickRef.current !== secs) {
      tickRef.current = secs;
      // The second on screen when the page opens would be a stray blip.
      if (seenRef.current) sound().tick();
    }
  }, [display, cd.running, cd.paused, cd.seconds, sound]);

  // Time's up: one buzzer per timer run (keyed by endsAt). Runs last, so it also marks the first payload as seen.
  useEffect(() => {
    if (!display) return;
    const first = !seenRef.current;
    seenRef.current = true;
    if (!endsAt || !cd.done || buzzedRef.current === endsAt) return;
    buzzedRef.current = endsAt;
    if (!first) sound().buzzer();
  }, [display, endsAt, cd.done, sound]);

  return { unlocked, muted, unlock, toggleMute };
}
