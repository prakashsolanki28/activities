import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityInsights,
  ActivityUpdate,
  AdminActivity,
  AdminActivitySummary,
  AdminAttemptDetail,
  AdminAttemptRow,
  AdminUser,
  AttemptListQuery,
  DashboardData,
  ImageRef,
  LeaderboardResponse,
  Paged,
  ScheduleInput,
} from '@hrrl/shared';
import { api } from './api';

export interface Me {
  _id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor';
}

export interface PublishIssue {
  sectionId: string;
  questionId?: string;
  code: string;
  message: string;
}

export const adminKeys = {
  me: ['admin', 'me'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  activities: ['admin', 'activities'] as const,
  activity: (id: string) => ['admin', 'activity', id] as const,
  issues: (id: string) => ['admin', 'activity', id, 'issues'] as const,
  attempts: (id: string, q: Partial<AttemptListQuery>) => ['admin', 'activity', id, 'attempts', q] as const,
  attemptsAll: (id: string) => ['admin', 'activity', id, 'attempts'] as const,
  attempt: (aid: string) => ['admin', 'attempt', aid] as const,
  insights: (id: string) => ['admin', 'activity', id, 'insights'] as const,
  leaderboard: (id: string) => ['admin', 'activity', id, 'leaderboard'] as const,
  users: ['admin', 'users'] as const,
};

export const adminApi = {
  me: () => api.get<{ admin: Me }>('/auth/me').then((r) => r.admin),
  login: (email: string, password: string) => api.post<{ admin: Me }>('/auth/login', { email, password }),
  logout: () => api.post<void>('/auth/logout'),
  dashboard: () => api.get<DashboardData>('/admin/dashboard'),
  activities: () => api.get<AdminActivitySummary[]>('/admin/activities'),
  activity: (id: string) => api.get<AdminActivity>(`/admin/activities/${id}`),
  create: (title: string) => api.post<AdminActivity>('/admin/activities', { title }),
  update: (id: string, patch: ActivityUpdate) => api.patch<AdminActivity>(`/admin/activities/${id}`, patch),
  issues: (id: string) => api.get<{ issues: PublishIssue[] }>(`/admin/activities/${id}/issues`),
  publish: (id: string, schedule: ScheduleInput) => api.post<AdminActivity>(`/admin/activities/${id}/publish`, schedule),
  unpublish: (id: string) => api.post<AdminActivity>(`/admin/activities/${id}/unpublish`),
  close: (id: string) => api.post<AdminActivity>(`/admin/activities/${id}/close`),
  reopen: (id: string) => api.post<AdminActivity>(`/admin/activities/${id}/reopen`),
  duplicate: (id: string) => api.post<AdminActivity>(`/admin/activities/${id}/duplicate`),
  publishResults: (id: string) => api.post<AdminActivity>(`/admin/activities/${id}/results/publish`),
  hideResults: (id: string) => api.post<AdminActivity>(`/admin/activities/${id}/results/hide`),
  remove: (id: string) => api.del<void>(`/admin/activities/${id}`),
  regrade: (id: string) => api.post<{ regraded: number }>(`/admin/activities/${id}/regrade`),
  upload: (file: File, alt = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('alt', alt);
    return api.post<ImageRef>('/admin/uploads', form);
  },
  attempts: (id: string, q: Partial<AttemptListQuery>) => {
    const params = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return api.get<Paged<AdminAttemptRow>>(`/admin/activities/${id}/attempts?${params}`);
  },
  attempt: (aid: string) => api.get<AdminAttemptDetail>(`/admin/attempts/${aid}`),
  patchAttempt: (aid: string, body: { hiddenFromLeaderboard?: boolean; grades?: { questionId: string; points: number | null }[] }) =>
    api.patch<AdminAttemptDetail>(`/admin/attempts/${aid}`, body),
  resetAttempt: (aid: string) => api.del<void>(`/admin/attempts/${aid}`),
  exportUrl: (id: string, format: 'xlsx' | 'csv') => `/api/admin/activities/${id}/attempts/export?format=${format}`,
  insights: (id: string) => api.get<ActivityInsights>(`/admin/activities/${id}/insights`),
  leaderboard: (id: string) => api.get<LeaderboardResponse>(`/admin/activities/${id}/leaderboard`),
  users: () => api.get<AdminUser[]>('/admin/users'),
  createUser: (body: { name: string; email: string; password: string; role: 'owner' | 'editor' }) => api.post<AdminUser>('/admin/users', body),
  updateUser: (id: string, body: { name?: string; role?: 'owner' | 'editor'; password?: string }) => api.patch<AdminUser>(`/admin/users/${id}`, body),
  removeUser: (id: string) => api.del<void>(`/admin/users/${id}`),
};

export function useMe() {
  return useQuery({ queryKey: adminKeys.me, queryFn: adminApi.me, staleTime: 5 * 60_000, retry: false });
}

export function useActivity(id: string) {
  return useQuery({ queryKey: adminKeys.activity(id), queryFn: () => adminApi.activity(id) });
}

export function useAttempts(id: string, q: Partial<AttemptListQuery>) {
  return useQuery({ queryKey: adminKeys.attempts(id, q), queryFn: () => adminApi.attempts(id, q), placeholderData: keepPreviousData });
}

/** Mutations that change an activity's lifecycle all refresh the same caches. */
export function useActivityAction<TArgs extends unknown[]>(id: string, fn: (...args: TArgs) => Promise<AdminActivity>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(...args),
    onSuccess: (a) => {
      qc.setQueryData(adminKeys.activity(id), a);
      void qc.invalidateQueries({ queryKey: adminKeys.activities });
      void qc.invalidateQueries({ queryKey: adminKeys.dashboard });
    },
  });
}
