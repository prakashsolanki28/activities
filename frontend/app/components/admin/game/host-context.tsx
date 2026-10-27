import { createContext, useContext, useMemo } from 'react';
import { toast } from 'sonner';
import type { AdminGame } from '@hrrl/shared';
import { deriveHost, useHostActions, type HostActions, type HostModel } from './use-host-actions';

export interface HostNav {
  go: (stageId: string) => void;
  next: () => void;
  back: () => void;
  toggleReveal: () => void;
  /** Starts the countdown: the given seconds, else the stage's own, else 15. */
  startTimer: (sec?: number) => void;
  /** Pauses a running countdown or resumes a paused one. False when there is no countdown. */
  togglePause: () => boolean;
}

export interface HostValue extends HostModel {
  game: AdminGame;
  actions: HostActions;
  nav: HostNav;
}

const HostContext = createContext<HostValue | null>(null);

export function useHost(): HostValue {
  const v = useContext(HostContext);
  if (!v) throw new Error('useHost must be used inside <HostProvider>');
  return v;
}

export function HostProvider({ game, children }: { game: AdminGame; children: React.ReactNode }) {
  const actions = useHostActions(game._id);
  const model = useMemo(() => deriveHost(game), [game]);

  // Navigation reads the latest cached game, so quick key presses build on each other.
  const nav = useMemo<HostNav>(() => {
    const now = () => {
      const g = actions.latest() ?? game;
      return { g, ...deriveHost(g) };
    };
    const go = (stageId: string) => {
      if (stageId === now().g.state.stageId) return;
      if (document.querySelector('[data-unsaved-teams]')) {
        toast.error('Save or undo your team changes first.');
        return;
      }
      actions.setState({ stageId });
    };
    return {
      go,
      next: () => {
        const { stages, index } = now();
        const s = stages[index + 1];
        if (s) go(s.id);
      },
      back: () => {
        const { stages, index } = now();
        const s = stages[index - 1];
        if (s) go(s.id);
      },
      toggleReveal: () => {
        const { g, stage } = now();
        if (stage.revealable) actions.setState({ revealed: !g.state.revealed });
      },
      startTimer: (sec) => {
        const { stage } = now();
        actions.timer({ action: 'start', durationSec: sec ?? stage.timerSec ?? 15 });
      },
      togglePause: () => {
        const t = now().g.state.timer;
        if (t?.endsAt) actions.timer({ action: 'pause' });
        else if (t?.remainingSec != null) actions.timer({ action: 'resume' });
        else return false;
        return true;
      },
    };
  }, [actions, game]);

  const value = useMemo<HostValue>(() => ({ game, ...model, actions, nav }), [game, model, actions, nav]);
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}
