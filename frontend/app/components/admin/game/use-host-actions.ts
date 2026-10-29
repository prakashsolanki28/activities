import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  buildStages,
  emptyTeamScore,
  gameStarted,
  gameStatus,
  rankTeams,
  roundMax,
  scoreTeam,
  tiedLeaders,
  type AdminGame,
  type GameStateUpdate,
  type GameTimerAction,
  type RankedTeam,
  type Stage,
  type Team,
  type TeamScore,
  type TeamScoreUpdate,
  type TeamTotals,
} from '@hrrl/shared';
import { errorMessage } from '~/lib/api';
import { gameApi, gameKeys } from '~/lib/game-api';

/** Every change the host makes to one game shares this key (and one queue, so the server sees them in order). */
export const gameChangeKey = (id: string) => ['admin', 'game', id, 'change'] as const;

/* ------------------------------------------------------------------ */
/* Derived view of a game                                               */
/* ------------------------------------------------------------------ */

export interface HostModel {
  ranked: RankedTeam[];
  /** Teams level at the top on the full scores (empty when one team leads). */
  tied: Team[];
  stages: Stage[];
  index: number;
  stage: Stage;
  max: TeamTotals;
}

/**
 * The stage list follows the full scores: the tie-breaker joins it once the last round is scored
 * (Mission results onwards) and the top is still tied, or while you are on it. Earlier, everyone
 * level on 0 would count as a tie.
 */
export function deriveHost(game: AdminGame): HostModel {
  const ranked = rankTeams(game.content, game.teams, game.scores);
  const tied = tiedLeaders(ranked);
  const full = buildStages(game.content, game.teams, true);
  const atEnd = full.findIndex((s) => s.id === game.state.stageId) >= full.findIndex((s) => s.id === 'r4-reveal');
  const stages = buildStages(game.content, game.teams, (atEnd && tied.length > 1) || game.state.stageId === 'tiebreak');
  const index = Math.max(0, stages.findIndex((s) => s.id === game.state.stageId));
  return { ranked, tied, stages, index, stage: stages[index]!, max: roundMax(game.content) };
}

/* ------------------------------------------------------------------ */
/* Optimistic updates: mirror what the API does                         */
/* ------------------------------------------------------------------ */

export function applyState(g: AdminGame, body: GameStateUpdate): AdminGame {
  let state = g.state;
  if (body.stageId !== undefined && body.stageId !== state.stageId) {
    state = { stageId: body.stageId, revealed: false, timer: null, started: !!g.state.started || body.stageId !== 'lobby' };
  }
  if (body.revealed !== undefined) state = { ...state, revealed: body.revealed };
  if (body.timer?.action === 'clear') state = { ...state, timer: null };
  return state === g.state ? g : { ...g, state, status: gameStatus(state.stageId, gameStarted(state, g.scores)) };
}

export function applyScore(g: AdminGame, teamId: string, u: TeamScoreUpdate): AdminGame {
  const scores: Record<string, TeamScore> = { ...g.scores };
  const cur = scores[teamId] ?? emptyTeamScore();
  let next: TeamScore;
  switch (u.round) {
    case 'r1':
      next = { ...cur, r1: { ...cur.r1, [u.challengeId]: u.choice } };
      break;
    case 'r2':
      next = { ...cur, r2: { marks: u.marks } };
      break;
    case 'r3':
      next = { ...cur, r3: { picks: [...u.picks] } };
      break;
    case 'r4':
      next = { ...cur, r4: { ...cur.r4, [u.situationId]: u.correct } };
      break;
    case 'tiebreak':
      // Marking one team the winner clears the others.
      if (u.win) for (const t of g.teams) if (t.id !== teamId && scores[t.id]?.tiebreakWin) scores[t.id] = { ...scores[t.id]!, tiebreakWin: false };
      next = { ...cur, tiebreakWin: u.win };
      break;
  }
  scores[teamId] = next;
  const totals = Object.fromEntries(g.teams.map((t) => [t.id, scoreTeam(g.content, scores[t.id])]));
  return { ...g, scores, totals };
}

/* ------------------------------------------------------------------ */
/* Actions                                                              */
/* ------------------------------------------------------------------ */

interface Change {
  run: () => Promise<AdminGame>;
  apply?: (g: AdminGame) => AdminGame;
  /** The caller shows the error itself. */
  silent?: boolean;
}

export interface HostActions {
  /** The latest cached game, including changes still on their way to the server. */
  latest: () => AdminGame | undefined;
  setState: (body: GameStateUpdate) => void;
  timer: (action: GameTimerAction) => void;
  score: (teamId: string, body: TeamScoreUpdate) => void;
  reset: () => Promise<void>;
  updateTeams: (teams: Team[]) => Promise<void>;
}

/**
 * Host changes feel instant: the cached game changes first, then the request goes out. Changes run
 * one at a time in the order made, so the last response holds every change; earlier responses are
 * skipped while later ones are queued, so a tap never flickers back. A failure rolls back, shows a
 * toast and reloads the game.
 */
export function useHostActions(id: string): HostActions {
  const qc = useQueryClient();
  const dirty = useRef(false);
  const key = gameKeys.game(id);
  const changeKey = gameChangeKey(id);
  const isLast = () => qc.isMutating({ mutationKey: changeKey }) <= 1;

  const m = useMutation({
    mutationKey: changeKey,
    scope: { id: `game:${id}` },
    mutationFn: (c: Change) => c.run(),
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<AdminGame>(key);
      if (before && c.apply) qc.setQueryData<AdminGame>(key, c.apply(before));
      return { before };
    },
    onSuccess: (g) => {
      if (isLast()) qc.setQueryData(key, g);
    },
    onError: (e, c, ctx) => {
      if (!c.silent) toast.error(errorMessage(e));
      if (isLast() && ctx?.before) qc.setQueryData(key, ctx.before);
      dirty.current = true;
    },
    onSettled: () => {
      if (!isLast()) return;
      void qc.invalidateQueries({ queryKey: gameKeys.games });
      if (dirty.current) {
        dirty.current = false;
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  });
  const { mutate, mutateAsync } = m;

  return useMemo<HostActions>(
    () => ({
      latest: () => qc.getQueryData<AdminGame>(gameKeys.game(id)),
      // Each state change names the stage the host was looking at (including queued changes), so a
      // stale tab gets a 409 instead of revealing or timing a stage it is not showing.
      setState: (body) => {
        const expectedStageId = qc.getQueryData<AdminGame>(gameKeys.game(id))?.state.stageId;
        mutate({ run: () => gameApi.setState(id, { ...body, expectedStageId }), apply: (g) => applyState(g, body) });
      },
      timer: (action) => {
        const expectedStageId = qc.getQueryData<AdminGame>(gameKeys.game(id))?.state.stageId;
        mutate({ run: () => gameApi.setState(id, { timer: action, expectedStageId }), apply: (g) => applyState(g, { timer: action }) });
      },
      score: (teamId, body) => mutate({ run: () => gameApi.score(id, teamId, body), apply: (g) => applyScore(g, teamId, body) }),
      reset: async () => {
        await mutateAsync({ run: () => gameApi.reset(id) });
      },
      updateTeams: async (teams) => {
        await mutateAsync({ run: () => gameApi.update(id, { teams }), silent: true });
      },
    }),
    [qc, id, mutate, mutateAsync],
  );
}

/**
 * A light refresh in case the game is also open in another tab. Skipped while the tab is hidden,
 * while a change is on its way (so the poll cannot undo an optimistic tap) and while a load is running.
 */
export function useGamePolling(id: string, enabled: boolean, everyMs = 5000) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const key = gameKeys.game(id);
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (qc.isMutating({ mutationKey: gameChangeKey(id) }) || qc.isFetching({ queryKey: key })) return;
      void qc.refetchQueries({ queryKey: key, type: 'active' });
    };
    const timer = window.setInterval(tick, everyMs);
    const onShow = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [id, enabled, everyMs, qc]);
}
