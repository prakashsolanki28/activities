import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, rowPaginationFeature, rowSortingFeature, tableFeatures, useTable, type PaginationState, type SortingState } from '@tanstack/react-table';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, EyeOff, Loader2, MonitorPlay, RotateCcw, Search, X } from 'lucide-react';
import { resultsVisible, type AdminActivity, type AdminAnswerDetail, type AdminAttemptRow, type AttemptListQuery } from '@hrrl/shared';
import type { Route } from './+types/responses';
import { useActivityContext } from './layout';
import { SortHeader, td, th } from '~/components/admin/data-table';
import { ResponsesSummary } from '~/components/admin/responses-summary';
import { Card, EmptyState, ErrorNote, MessageBar, Pills } from '~/components/admin/ui';
import { Prompt } from '~/components/evidence/prompt';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { errorMessage } from '~/lib/api';
import { adminApi, adminKeys, useActivityAction, useAttempts } from '~/lib/admin-api';
import { formatDateTime, formatDuration, formatPct, formatPoints } from '~/lib/format';
import { plain } from '~/lib/describe';
import { questionNumbers } from '~/lib/numbering';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Responses · HRRL Activities' }];

type View = 'summary' | 'individual' | 'leaderboard';

export default function Responses() {
  const { activity } = useActivityContext();
  const [params, setParams] = useSearchParams();
  const asked = params.get('view');
  const view: View = asked === 'individual' || asked === 'leaderboard' ? asked : 'summary';
  const insights = useQuery({ queryKey: adminKeys.insights(activity._id), queryFn: () => adminApi.insights(activity._id), refetchInterval: 60_000 });
  const d = insights.data;

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'summary') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  return (
    <main className="mx-auto grid max-w-[1120px] grid-cols-[minmax(0,1fr)] gap-5 px-4 py-6 sm:px-8">
      <ResultsControl activity={activity} submitted={d?.submitted ?? 0} />

      <Card className="flex flex-wrap items-center gap-x-10 gap-y-4 px-5 py-4">
        <Stat label="Responses" value={d ? String(d.submitted) : '–'} note={d?.inProgress ? `${d.inProgress} still answering` : undefined} />
        <Stat label="Average score" value={d ? formatPct(d.avgPct) : '–'} note={d?.passRate != null ? `${formatPct(d.passRate)} passed` : undefined} />
        <Stat label="Typical time" value={d ? formatDuration(d.medianDurationSec) : '–'} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <Download /> Download <ChevronDown className="opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <a href={adminApi.exportUrl(activity._id, 'xlsx')} download>
                Excel workbook (.xlsx)
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={adminApi.exportUrl(activity._id, 'csv')} download>
                CSV file (.csv)
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>

      <Pills
        label="View"
        value={view}
        onChange={setView}
        options={[
          ['summary', 'Summary'],
          ['individual', 'Individual responses'],
          ['leaderboard', 'Leaderboard'],
        ]}
      />

      {view === 'individual' ? (
        <IndividualResponses activity={activity} />
      ) : view === 'leaderboard' ? (
        <LeaderboardView activity={activity} />
      ) : insights.error ? (
        <ErrorNote>{errorMessage(insights.error)}</ErrorNote>
      ) : !d ? (
        <div className="grid gap-5" aria-busy="true">
          <div className="h-64 animate-pulse rounded-lg bg-ground-2" />
          <div className="h-40 animate-pulse rounded-lg bg-ground-2" />
        </div>
      ) : !d.submitted ? (
        <Card>
          <EmptyState title="No responses yet">
            {activity.status === 'draft'
              ? 'Open the activity and share its link. A summary of the answers appears here as people submit.'
              : d.inProgress
                ? `${d.inProgress} ${d.inProgress === 1 ? 'person is' : 'people are'} answering now. The summary appears as soon as someone submits.`
                : 'A summary of the answers appears here as people submit.'}
          </EmptyState>
        </Card>
      ) : (
        <ResponsesSummary activity={activity} data={d} />
      )}
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-[13px] text-ink-3">{label}</p>
      <p className="text-[28px] leading-9 font-semibold text-ink tabular-nums">{value}</p>
      {note ? <p className="text-xs text-ink-3">{note}</p> : <p className="text-xs">&nbsp;</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- results release */

/** Where results stand for employees, and the one button that changes it. */
function ResultsControl({ activity: a, submitted }: { activity: AdminActivity; submitted: number }) {
  const [confirm, setConfirm] = useState<'publish' | 'hide' | null>(null);
  const qc = useQueryClient();
  const publish = useActivityAction(a._id, () => adminApi.publishResults(a._id));
  const hide = useActivityAction(a._id, () => adminApi.hideResults(a._id));
  const busy = publish.isPending || hide.isPending;
  const run = () => {
    const m = confirm === 'publish' ? publish : hide;
    m.mutate([], {
      onSuccess: () => {
        toast.success(confirm === 'publish' ? 'Results published' : 'Results hidden');
        void qc.invalidateQueries({ queryKey: adminKeys.leaderboard(a._id) });
        setConfirm(null);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };
  const release = a.settings.resultsRelease;
  const settingsLink = (
    <Link to="settings" className="font-semibold text-brand hover:underline">
      Change in Settings
    </Link>
  );

  return (
    <>
      {release === 'immediate' ? (
        <MessageBar intent="info">
          Employees see their results as soon as they submit. {settingsLink}
        </MessageBar>
      ) : release === 'never' ? (
        <MessageBar intent="info">
          Results are for admins only. Employees see “Submitted” and nothing more. {settingsLink}
        </MessageBar>
      ) : a.resultsPublishedAt ? (
        <MessageBar
          intent="success"
          action={
            <Button size="sm" variant="outline" onClick={() => setConfirm('hide')}>
              Hide results
            </Button>
          }
        >
          Results published {formatDateTime(a.resultsPublishedAt)}. Employees can see their scores, and anyone who submits now sees theirs straight away.
        </MessageBar>
      ) : (
        <MessageBar
          intent={submitted ? 'warning' : 'info'}
          action={
            <Button size="sm" onClick={() => setConfirm('publish')}>
              Publish results
            </Button>
          }
        >
          {submitted
            ? `Results are hidden. ${submitted} ${submitted === 1 ? 'person has' : 'people have'} submitted and ${submitted === 1 ? 'sees' : 'see'} only “Submitted” until you publish.`
            : 'Results stay hidden until you publish them. Employees see “Submitted” until then.'}
        </MessageBar>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'publish' ? 'Publish results?' : 'Hide results again?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'publish'
                ? 'Everyone who has submitted can open their link to see their score and the correct answers, as your settings allow. The leaderboard and certificates become available too. You can hide results again later.'
                : 'Employees will see “Submitted” instead of their score. The leaderboard and certificates are hidden until you publish again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                run();
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              {confirm === 'publish' ? 'Publish results' : 'Hide results'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------------------------------------------------------- leaderboard */

/** Where employees can see this activity's leaderboard right now, in plain words. */
function leaderboardWhere(a: AdminActivity): { intent: 'info' | 'warning'; text: string; settings?: boolean } {
  const s = a.settings;
  if (s.leaderboard === 'off') return { intent: 'info', text: 'Employees do not see a leaderboard for this activity. Only admins see this ranking.', settings: true };
  if (!s.showScore) return { intent: 'info', text: 'Scores are hidden from employees, so they do not see the leaderboard. Only admins see this ranking.', settings: true };
  if (s.resultsRelease === 'never' || s.feedbackMode === 'hidden') return { intent: 'info', text: 'Results are for admins only, so employees do not see the leaderboard.', settings: true };
  if (!resultsVisible(a)) return { intent: 'warning', text: 'Employees see this leaderboard once you publish results.' };
  if (s.leaderboard === 'after_submit') return { intent: 'info', text: 'Employees see this leaderboard after they submit, from their results page. Employee IDs are partly hidden for them.' };
  return { intent: 'info', text: 'Anyone with the activity link can see this leaderboard, and you can put it on a projector. Employee IDs are partly hidden for them.' };
}

function LeaderboardView({ activity: a }: { activity: AdminActivity }) {
  const board = useQuery({ queryKey: adminKeys.leaderboard(a._id), queryFn: () => adminApi.leaderboard(a._id), refetchInterval: 30_000 });
  const [open, setOpen] = useState<string | null>(null);
  const where = leaderboardWhere(a);
  const publicUrl = typeof window === 'undefined' ? `/a/${a.slug}/leaderboard` : `${window.location.origin}/a/${a.slug}/leaderboard`;
  const projector = a.status !== 'draft' && a.settings.leaderboard === 'always' && a.settings.showScore && a.settings.resultsRelease !== 'never';
  const entries = board.data?.entries ?? [];

  return (
    <div className="grid gap-4">
      <MessageBar
        intent={where.intent}
        action={
          where.settings ? (
            <Button asChild size="sm" variant="outline">
              <Link to="../settings">Change in Settings</Link>
            </Button>
          ) : projector ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(publicUrl);
                  toast.success('Leaderboard link copied');
                }}
              >
                <Copy /> Copy link
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={`/a/${a.slug}/leaderboard?display=1`} target="_blank" rel="noopener">
                  <MonitorPlay /> Projector view
                </a>
              </Button>
            </div>
          ) : null
        }
      >
        {where.text}
      </MessageBar>

      {board.error ? <ErrorNote>{errorMessage(board.error)}</ErrorNote> : null}

      <Card className="overflow-hidden">
        {board.isPending ? (
          <div className="grid gap-2 p-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-sm bg-ground-2" />
            ))}
          </div>
        ) : !entries.length ? (
          <EmptyState title="No one on the leaderboard yet">People appear here, best score first, as soon as they submit.</EmptyState>
        ) : (
          <>
          <div aria-hidden className="hidden grid-cols-[3rem_minmax(0,1fr)_9rem_8rem_6rem] gap-x-3 border-b border-line px-5 py-2.5 text-xs font-semibold text-ink-3 sm:grid">
            <span>Rank</span>
            <span>Name</span>
            <span>Employee ID</span>
            <span>Score</span>
            <span className="text-right">Time taken</span>
          </div>
          <ol aria-label={`Leaderboard for ${a.title}`} className="divide-y divide-line">
            {entries.map((e) => (
              <li key={e.attemptId ?? `${e.rank}-${e.name}`}>
                <button
                  type="button"
                  disabled={!e.attemptId}
                  onClick={() => e.attemptId && setOpen(e.attemptId)}
                  className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left hover:bg-ground sm:grid-cols-[3rem_minmax(0,1fr)_9rem_8rem_6rem] sm:px-5"
                >
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-full text-sm font-semibold tabular-nums',
                      e.rank === 1 ? 'bg-brand text-white' : e.rank <= 3 ? 'bg-brand-tint text-brand' : 'text-ink-3',
                    )}
                    aria-label={`Rank ${e.rank}`}
                  >
                    {e.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{e.name}</span>
                    <span className="block text-xs text-ink-3 sm:hidden">
                      {e.employeeIdMasked} · {formatDuration(e.durationSec)}
                    </span>
                  </span>
                  <span className="hidden text-sm text-ink-2 sm:block">{e.employeeIdMasked}</span>
                  <span className="text-right text-sm font-semibold text-ink tabular-nums sm:text-left">
                    {formatPct(e.pct)} <span className="text-xs font-normal text-ink-3">{formatPoints(e.score)}/{formatPoints(e.maxScore)}</span>
                    {e.pending ? <span className="block text-xs font-semibold text-warn">Needs marking</span> : null}
                  </span>
                  <span className="hidden text-right text-sm text-ink-2 tabular-nums sm:block">{formatDuration(e.durationSec)}</span>
                </button>
              </li>
            ))}
          </ol>
          </>
        )}
      </Card>
      {entries.length ? (
        <p className="text-[13px] text-ink-3">
          Ranked by score, then by the quicker time. {board.data && board.data.participants > entries.length ? `Showing the top ${entries.length} of ${board.data.participants}. ` : ''}
          People you hid from the leaderboard are left out. Select a name to see their answers.
        </p>
      ) : null}

      <ResponseSheet activity={a} attemptId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------- individual responses */

const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });
const helper = createColumnHelper<typeof features, AdminAttemptRow>();
const columns = helper.columns([
  helper.accessor('name', { header: 'Name' }),
  helper.accessor('employeeId', { header: 'Employee ID' }),
  helper.accessor('status', { header: 'Status', enableSorting: false }),
  helper.accessor('pct', { header: 'Score' }),
  helper.accessor('durationSec', { header: 'Time taken' }),
  helper.accessor('submittedAt', { header: 'Submitted' }),
]);
const emptyRows: AdminAttemptRow[] = [];
type StatusFilter = AttemptListQuery['status'];

const REASON: Record<string, string> = { timeout: 'time ran out', closed: 'activity closed', admin: 'by an admin' };

const FILTERS = [
  ['all', 'All'],
  ['submitted', 'Submitted'],
  ['in_progress', 'Still answering'],
  ['pending_review', 'Needs marking'],
] as const;

function IndividualResponses({ activity }: { activity: AdminActivity }) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'submittedAt', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 25 });
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(search.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const query: Partial<AttemptListQuery> = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    status,
    q: q || undefined,
    sort: (sorting[0]?.id ?? 'submittedAt') as AttemptListQuery['sort'],
    dir: sorting[0]?.desc === false ? 'asc' : 'desc',
  };
  const list = useAttempts(activity._id, query);
  const table = useTable({
    features,
    columns,
    data: list.data?.items ?? emptyRows,
    rowCount: list.data?.total ?? 0,
    state: { sorting, pagination },
    onSortingChange: (u) => {
      setSorting(u);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
  });

  const head = (id: string, label: string, align?: 'left' | 'right') => {
    const col = table.getColumn(id)!;
    return <SortHeader label={label} sorted={col.getIsSorted()} onToggle={() => col.toggleSorting()} align={align} />;
  };
  const total = list.data?.total ?? 0;
  const from = total ? pagination.pageIndex * pagination.pageSize + 1 : 0;
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Pills
          label="Show"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          options={FILTERS}
        />
        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Search by name or employee ID</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or employee ID" className="h-8 pl-9" />
        </label>
      </div>

      {list.error ? <ErrorNote className="mt-4">{errorMessage(list.error)}</ErrorNote> : null}

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>{head('name', 'Name')}</th>
                <th className={cn(th, 'w-36')}>{head('employeeId', 'Employee ID')}</th>
                <th className={cn(th, 'w-52')}>Status</th>
                <th className={cn(th, 'w-28 text-right')}>{head('pct', 'Score', 'right')}</th>
                <th className={cn(th, 'w-28 text-right')}>{head('durationSec', 'Time taken', 'right')}</th>
                <th className={cn(th, 'w-40')}>{head('submittedAt', 'Submitted')}</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y divide-line', list.isPlaceholderData && 'opacity-60')}>
              {list.isPending
                ? [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-8 animate-pulse rounded-sm bg-ground-2" />
                      </td>
                    </tr>
                  ))
                : table.getRowModel().rows.map((row) => {
                    const r = row.original;
                    return (
                      <tr key={r._id} className="cursor-pointer hover:bg-ground" onClick={() => setOpen(r._id)}>
                        <td className={td}>
                          <button type="button" className="text-left font-semibold text-ink hover:text-brand hover:underline" onClick={() => setOpen(r._id)}>
                            {r.name}
                          </button>
                          {r.hiddenFromLeaderboard ? <EyeOff className="ml-1.5 inline size-3.5 text-ink-3" aria-label="Hidden from leaderboard" /> : null}
                        </td>
                        <td className={cn(td, 'text-ink-2')}>{r.employeeId}</td>
                        <td className={cn(td, 'whitespace-nowrap text-[13px]')}>
                          {r.status === 'in_progress' ? (
                            <span className="text-ink-3">Still answering · {r.answeredCount} done</span>
                          ) : r.pendingReview ? (
                            <span className="font-semibold text-warn">Needs marking</span>
                          ) : (
                            <span className="text-ink-2">Submitted{r.submitReason && REASON[r.submitReason] ? ` · ${REASON[r.submitReason]}` : ''}</span>
                          )}
                        </td>
                        <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>
                          {r.status === 'submitted' ? (
                            <>
                              {formatPct(r.pct)} <span className="text-xs font-normal text-ink-3">{formatPoints(r.score)}/{formatPoints(r.maxScore)}</span>
                            </>
                          ) : (
                            <span className="text-ink-3">–</span>
                          )}
                        </td>
                        <td className={cn(td, 'text-right whitespace-nowrap text-ink-2 tabular-nums')}>{formatDuration(r.durationSec)}</td>
                        <td className={cn(td, 'whitespace-nowrap text-ink-2')}>{formatDateTime(r.submittedAt)}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!list.isPending && !total ? (
          <EmptyState title={q || status !== 'all' ? 'No responses match' : 'No responses yet'}>
            {q || status !== 'all' ? 'Try another filter or search.' : activity.status === 'draft' ? 'Open the activity and share its link to start collecting responses.' : 'Responses appear here as soon as people start.'}
          </EmptyState>
        ) : null}
      </Card>

      {total ? (
        <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-ink-3">
          <span className="tabular-nums">
            {from}–{to} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}

      <ResponseSheet activity={activity} attemptId={open} onClose={() => setOpen(null)} />
    </div>
  );
}

/* ---------------------------------------------------------------- one response */

function ResponseSheet({ activity, attemptId, onClose }: { activity: AdminActivity; attemptId: string | null; onClose: () => void }) {
  const activityId = activity._id;
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: adminKeys.attempt(attemptId ?? 'none'), queryFn: () => adminApi.attempt(attemptId!), enabled: !!attemptId });
  const [confirmReset, setConfirmReset] = useState(false);
  const numbers = useMemo(() => questionNumbers(activity.sections), [activity.sections]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.attemptsAll(activityId) });
    void qc.invalidateQueries({ queryKey: adminKeys.insights(activityId) });
    void qc.invalidateQueries({ queryKey: adminKeys.dashboard });
  };
  const patch = useMutation({
    mutationFn: (body: Parameters<typeof adminApi.patchAttempt>[1]) => adminApi.patchAttempt(attemptId!, body),
    onSuccess: (d) => {
      qc.setQueryData(adminKeys.attempt(d._id), d);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: () => adminApi.resetAttempt(attemptId!),
    onSuccess: () => {
      toast.success('Done. They can take the activity again.');
      refresh();
      void qc.invalidateQueries({ queryKey: adminKeys.activity(activityId) });
      setConfirmReset(false);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const d = detail.data;
  // Show answers in the order of the form, whatever order this person saw them in.
  const answers = useMemo(() => [...(d?.answers ?? [])].sort((x, y) => (numbers.get(x.questionId) ?? 0) - (numbers.get(y.questionId) ?? 0)), [d, numbers]);
  const pending = answers.filter((a) => a.reveal.needsReview).length;

  return (
    <Sheet open={!!attemptId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto bg-ground p-0 sm:max-w-xl">
        {!d ? (
          <div className="p-6" aria-busy="true">
            <SheetTitle className="sr-only">Loading response</SheetTitle>
            <div className="h-7 w-48 animate-pulse rounded-sm bg-ground-2" />
          </div>
        ) : (
          <>
            <SheetHeader className="gap-0 border-b border-line bg-surface px-6 pt-6 pb-5">
              <SheetTitle className="text-xl font-semibold text-ink">{d.name}</SheetTitle>
              <SheetDescription className="text-sm text-ink-3">Employee ID {d.employeeId}</SheetDescription>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-3">
                <Fact label="Score">
                  {d.status === 'submitted' ? (
                    <>
                      {formatPct(d.pct)} <span className="font-normal text-ink-3">({formatPoints(d.score)} of {formatPoints(d.maxScore)} points)</span>
                    </>
                  ) : (
                    'Still answering'
                  )}
                </Fact>
                <Fact label="Time taken">{formatDuration(d.durationSec)}</Fact>
                <Fact label="Submitted">{d.submittedAt ? formatDateTime(d.submittedAt) : 'Not yet'}</Fact>
              </dl>
              <details className="group/more mt-3 text-[13px]">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm font-semibold text-brand hover:underline [&::-webkit-details-marker]:hidden">
                  More details <ChevronDown className="size-3.5 transition-transform group-open/more:rotate-180" aria-hidden />
                </summary>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                  <Fact label="Resume code" hint="Give this to them if they need to continue on another device.">
                    {d.resumeCode}
                  </Fact>
                  {d.certificateCode ? <Fact label="Certificate number">{d.certificateCode}</Fact> : null}
                  <Fact label="IP address">{d.ip ? d.ip.replace(/^::ffff:/, '') : 'Unknown'}</Fact>
                </dl>
              </details>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink">
                  <Switch checked={d.hiddenFromLeaderboard} onCheckedChange={(v) => patch.mutate({ hiddenFromLeaderboard: v })} />
                  Hide from leaderboard
                </label>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => setConfirmReset(true)}>
                  <RotateCcw /> Let them retake
                </Button>
              </div>
            </SheetHeader>
            {pending ? (
              <MessageBar intent="warning" className="mx-4 mt-4">
                {pending} written {pending === 1 ? 'answer needs' : 'answers need'} marking. Enter the points below.
              </MessageBar>
            ) : null}
            <ol className="grid gap-3 p-4">
              {answers.map((a) => (
                <AnswerCard
                  key={a.questionId}
                  answer={a}
                  number={numbers.get(a.questionId)}
                  canGrade={d.status === 'submitted'}
                  busy={patch.isPending}
                  onGrade={(points) => patch.mutate({ grades: [{ questionId: a.questionId, points }] })}
                />
              ))}
            </ol>
          </>
        )}
        <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Let {d?.name} retake the activity?</AlertDialogTitle>
              <AlertDialogDescription>
                This response is removed from results and the leaderboard (it stays in the archive). Employee ID {d?.employeeId} can then start again from the beginning.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  reset.mutate();
                }}
              >
                {reset.isPending ? <Loader2 className="animate-spin" /> : null}
                Let them retake
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

function Fact({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div title={hint}>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-semibold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function AnswerCard({
  answer: a,
  number,
  canGrade,
  busy,
  onGrade,
}: {
  answer: AdminAnswerDetail;
  number: number | undefined;
  canGrade: boolean;
  busy: boolean;
  onGrade: (points: number | null) => void;
}) {
  const r = a.reveal;
  const [points, setPoints] = useState(a.override != null ? String(a.override) : '');
  const gradable = canGrade && (r.needsReview || a.override != null || a.type === 'long_text' || a.type === 'list_text' || a.type === 'short_text');
  return (
    <li className="grid gap-2 rounded-lg bg-surface px-5 py-4 shadow-card">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="flex-1 font-semibold text-ink-3">{number ? `Question ${number}` : 'Question'}</span>
        <span className="flex shrink-0 items-center gap-1.5 font-semibold whitespace-nowrap tabular-nums">
          {r.needsReview ? (
            <span className="text-warn">Needs marking</span>
          ) : r.isCorrect === true ? (
            <span className="flex items-center gap-1 text-ok">
              <Check className="size-3.5" strokeWidth={3} aria-hidden /> Correct · {formatPoints(r.points)}
            </span>
          ) : r.isCorrect === false ? (
            <span className="flex items-center gap-1 text-bad">
              <X className="size-3.5" strokeWidth={3} aria-hidden /> {r.points > 0 ? 'Partly right' : 'Wrong'} · {formatPoints(r.points)}
            </span>
          ) : (
            <span className="font-normal text-ink-3">Not scored</span>
          )}
          {r.maxPoints && !r.needsReview ? <span className="font-normal text-ink-3">/ {formatPoints(r.maxPoints)}</span> : null}
        </span>
      </div>
      <Prompt text={a.prompt} size="sm" className="text-sm leading-5 font-semibold text-ink [&_code]:bg-transparent [&_code]:px-0 [&_code]:font-sans [&_code]:text-[1em]" />
      <p className={cn('rounded-md bg-ground px-3 py-2 text-sm leading-6 whitespace-pre-wrap', a.display ? 'text-ink' : 'text-ink-3 italic')}>{plain(a.display) || 'No answer'}</p>
      {r.isCorrect === false && a.correctDisplay ? (
        <p className="text-[13px] text-ink-2">
          Correct answer: <span className="font-semibold text-ink">{plain(a.correctDisplay)}</span>
        </p>
      ) : null}
      {a.override != null ? <p className="text-xs text-ink-3">Marked by hand</p> : null}
      {a.tries > 1 ? <p className="text-xs text-ink-3">{a.tries} tries</p> : null}
      {gradable ? (
        <form
          className="mt-1 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onGrade(points === '' ? null : Math.max(0, Number(points)));
          }}
        >
          <label className="text-[13px] font-semibold text-ink-2" htmlFor={`pts-${a.questionId}`}>
            Points
          </label>
          <Input id={`pts-${a.questionId}`} type="number" min={0} step={0.5} max={r.maxPoints || undefined} value={points} onChange={(e) => setPoints(e.target.value)} className="h-8 w-20" placeholder={formatPoints(r.points)} />
          <Button type="submit" size="sm" variant={r.needsReview ? 'default' : 'outline'} disabled={busy}>
            Save mark
          </Button>
          {a.override != null ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onGrade(null)}>
              Use automatic mark
            </Button>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}
