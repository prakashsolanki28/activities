import { useState } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Eye, Loader2, RefreshCcw, Share2 } from 'lucide-react';
import type { AdminActivity } from '@hrrl/shared';
import type { Route } from './+types/layout';
import { ErrorNote, MessageBar, StatusBadge } from '~/components/admin/ui';
import { ShareSheet } from '~/components/admin/share-sheet';
import { PreviewDialog } from '~/components/admin/preview-dialog';
import { Button } from '~/components/ui/button';
import { errorMessage } from '~/lib/api';
import { adminApi, adminKeys, useActivity } from '~/lib/admin-api';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Activity · HRRL Activities' }];

export interface ActivityContext {
  activity: AdminActivity;
  openShare: () => void;
  openPreview: (questionId?: string | null) => void;
}

export function useActivityContext() {
  return useOutletContext<ActivityContext>();
}

export default function ActivityLayout() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const activity = useActivity(id);
  const qc = useQueryClient();
  const [preview, setPreview] = useState<{ open: boolean; at?: string | null }>({ open: false });
  const shareOpen = params.get('share') === '1';
  const setShare = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('share', '1');
    else next.delete('share');
    setParams(next, { replace: true });
  };

  const regrade = useMutation({
    mutationFn: () => adminApi.regrade(id),
    onSuccess: (r) => {
      toast.success(`Scores updated for ${r.regraded} ${r.regraded === 1 ? 'response' : 'responses'}`);
      void qc.invalidateQueries({ queryKey: adminKeys.activity(id) });
      void qc.invalidateQueries({ queryKey: adminKeys.attemptsAll(id) });
      void qc.invalidateQueries({ queryKey: adminKeys.insights(id) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (activity.error) {
    return (
      <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8">
        <ErrorNote>{errorMessage(activity.error)}</ErrorNote>
      </div>
    );
  }
  if (!activity.data) {
    return (
      <div className="border-b border-line bg-surface" aria-busy="true">
        <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-8">
          <div className="h-7 w-80 animate-pulse rounded-sm bg-ground-2" />
        </div>
      </div>
    );
  }
  const a = activity.data;
  const tabs = [
    { to: '', label: 'Questions', end: true },
    { to: 'responses', label: 'Responses', count: a.submittedCount },
    { to: 'settings', label: 'Settings' },
  ];

  return (
    <div>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-[1120px] px-4 pt-4 sm:px-8">
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-brand hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> All activities
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-0">
              <h1 className="line-clamp-2 text-xl leading-7 font-semibold text-ink sm:line-clamp-1">{a.title}</h1>
              <StatusBadge status={a.status} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview({ open: true, at: params.get('q') })}>
                <Eye /> Preview
              </Button>
              <Button onClick={() => setShare(true)}>
                <Share2 /> Share
              </Button>
            </div>
          </div>
          <nav aria-label="Activity" className="mt-3 flex justify-center gap-2">
            {tabs.map((t) => (
              <NavLink
                key={t.label}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex h-11 items-center gap-1.5 px-3 text-sm font-semibold transition-colors',
                    isActive ? 'text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-brand' : 'text-ink-3 hover:text-ink',
                  )
                }
              >
                {t.label}
                {t.count ? <span className="rounded-full bg-ground-2 px-2 text-xs font-semibold text-ink-2 tabular-nums">{t.count}</span> : null}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      {a.needsRegrade ? (
        <div className="mx-auto max-w-[1120px] px-4 pt-4 sm:px-8">
          <MessageBar
            intent="warning"
            action={
              <Button size="sm" variant="outline" onClick={() => regrade.mutate()} disabled={regrade.isPending}>
                {regrade.isPending ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
                Update scores
              </Button>
            }
          >
            You changed a correct answer after people responded. Their scores still use the old answer.
          </MessageBar>
        </div>
      ) : null}
      <Outlet context={{ activity: a, openShare: () => setShare(true), openPreview: (at) => setPreview({ open: true, at }) } satisfies ActivityContext} />
      <ShareSheet activity={a} open={shareOpen} onOpenChange={setShare} />
      <PreviewDialog key={preview.at ?? 'start'} activity={a} open={preview.open} startAt={preview.at} onOpenChange={(open) => setPreview((p) => ({ ...p, open }))} />
    </div>
  );
}
