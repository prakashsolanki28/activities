import { useQuery } from '@tanstack/react-query';
import type {
  AnswerValue,
  AttemptState,
  CertificateResponse,
  EnterInput,
  LeaderboardResponse,
  PublicActivity,
  SaveAnswerResponse,
  SpotBox,
  SpotMarkResponse,
} from '@hrrl/shared';
import { api } from './api';

const tokenHeader = (token: string) => ({ headers: { 'x-attempt-token': token } });

export const publicKeys = {
  activity: (slug: string) => ['public', 'activity', slug] as const,
  attempt: (attemptId: string) => ['public', 'attempt', attemptId] as const,
  leaderboard: (slug: string) => ['public', 'leaderboard', slug] as const,
  certificate: (code: string) => ['public', 'certificate', code] as const,
};

export const publicApi = {
  activity: (slug: string) => api.get<PublicActivity>(`/public/activities/${encodeURIComponent(slug)}`),
  enter: (slug: string, body: EnterInput) => api.post<{ state: AttemptState }>(`/public/activities/${encodeURIComponent(slug)}/attempts`, body),
  state: (attemptId: string, token: string) => api.get<AttemptState>(`/public/attempts/${attemptId}`, tokenHeader(token)),
  start: (attemptId: string, token: string) => api.post<AttemptState>(`/public/attempts/${attemptId}/start`, undefined, tokenHeader(token)),
  save: (attemptId: string, token: string, questionId: string, body: { value: AnswerValue; seq: number; check?: boolean }) =>
    api.put<SaveAnswerResponse>(`/public/attempts/${attemptId}/answers/${questionId}`, body, tokenHeader(token)),
  spotMark: (attemptId: string, token: string, questionId: string, body: SpotBox & { seq: number }) =>
    api.post<SpotMarkResponse>(`/public/attempts/${attemptId}/answers/${questionId}/marks`, body, tokenHeader(token)),
  submit: (attemptId: string, token: string) => api.post<AttemptState>(`/public/attempts/${attemptId}/submit`, undefined, tokenHeader(token)),
  leaderboard: (slug: string, token?: string) =>
    api.get<LeaderboardResponse>(`/public/activities/${encodeURIComponent(slug)}/leaderboard`, token ? tokenHeader(token) : undefined),
  certificate: (code: string) => api.get<CertificateResponse>(`/public/certificates/${encodeURIComponent(code)}`),
};

export function usePublicActivity(slug: string) {
  return useQuery({ queryKey: publicKeys.activity(slug), queryFn: () => publicApi.activity(slug), staleTime: 30_000 });
}

export function useAttemptState(attemptId: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: publicKeys.attempt(attemptId ?? 'none'),
    queryFn: () => publicApi.state(attemptId!, token!),
    enabled: !!attemptId && !!token,
    staleTime: Infinity,
  });
}

/** Difference between server and device clocks, so countdowns never trust the device. */
export function clockOffset(serverNow: string): number {
  return new Date(serverNow).getTime() - Date.now();
}
