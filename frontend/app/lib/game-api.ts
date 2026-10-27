import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminGame,
  AdminGameSummary,
  GameCreateInput,
  GameStateUpdate,
  GameUpdateInput,
  PublicGameDisplay,
  TeamScoreUpdate,
} from '@hrrl/shared';
import { api } from './api';

export const gameKeys = {
  games: ['admin', 'games'] as const,
  game: (id: string) => ['admin', 'game', id] as const,
  display: (code: string) => ['public', 'game', code] as const,
};

export const gameApi = {
  list: () => api.get<AdminGameSummary[]>('/admin/games'),
  create: (body: GameCreateInput = {}) => api.post<AdminGame>('/admin/games', body),
  get: (id: string) => api.get<AdminGame>(`/admin/games/${id}`),
  update: (id: string, body: GameUpdateInput) => api.patch<AdminGame>(`/admin/games/${id}`, body),
  setState: (id: string, body: GameStateUpdate) => api.post<AdminGame>(`/admin/games/${id}/state`, body),
  score: (id: string, teamId: string, body: TeamScoreUpdate) => api.put<AdminGame>(`/admin/games/${id}/scores/${encodeURIComponent(teamId)}`, body),
  reset: (id: string) => api.post<AdminGame>(`/admin/games/${id}/reset`),
  remove: (id: string) => api.del<void>(`/admin/games/${id}`),
  display: (code: string) => api.get<PublicGameDisplay>(`/public/games/${encodeURIComponent(code)}`),
};

export function useGames() {
  return useQuery({ queryKey: gameKeys.games, queryFn: gameApi.list });
}

export function useGame(id: string) {
  return useQuery({ queryKey: gameKeys.game(id), queryFn: () => gameApi.get(id) });
}

/** The projector polls once a second: one small read, and the room sees changes almost at once. */
export function useGameDisplay(code: string) {
  return useQuery({ queryKey: gameKeys.display(code), queryFn: () => gameApi.display(code), refetchInterval: 1000, refetchIntervalInBackground: true, staleTime: 0 });
}

/** Every game mutation returns the whole game: put it straight in the cache and refresh the list. */
export function useGameAction<TArgs extends unknown[]>(id: string, fn: (...args: TArgs) => Promise<AdminGame>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(...args),
    onSuccess: (g) => {
      qc.setQueryData(gameKeys.game(id), g);
      void qc.invalidateQueries({ queryKey: gameKeys.games });
    },
  });
}
