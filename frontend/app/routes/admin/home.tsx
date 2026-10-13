import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Copy, CopyPlus, ExternalLink, ListOrdered, MoreHorizontal, PenLine, Search, Table2, Trash2 } from 'lucide-react';
import type { ActivityStatus, AdminActivitySummary } from '@hrrl/shared';
import type { Route } from './+types/home';
import { NewActivityButton } from '~/components/admin/new-activity';
import { Card, EmptyState, ErrorNote, PageHeader, StatusBadge } from '~/components/admin/ui';
import { SortHeader, td, th } from '~/components/admin/data-table';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
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
import { adminApi, adminKeys } from '~/lib/admin-api';
import { formatDateTime, relativeFromNow } from '~/lib/format';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Activities · HRRL Activities' }];

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
});
const helper = createColumnHelper<typeof features, AdminActivitySummary>();
const empty: AdminActivitySummary[] = [];
type Filter = 'all' | ActivityStatus;

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['live', 'Open'],
  ['scheduled', 'Scheduled'],
  ['draft', 'Drafts'],
  ['closed', 'Closed'],
];

/** Where results stand for employees, in plain words. */
export function resultsLabel(a: Pick<AdminActivitySummary, 'resultsRelease' | 'resultsPublishedAt' | 'submittedCount'>): { text: string; tone: string } {
  if (a.resultsRelease === 'immediate') return { text: 'Shown right away', tone: 'text-ink-3' };
  if (a.resultsRelease === 'never') return { text: 'Admins only', tone: 'text-ink-3' };
  if (a.resultsPublishedAt) return { text: 'Published', tone: 'text-ok font-semibold' };
  return { text: a.submittedCount ? 'Not published yet' : 'Held until you publish', tone: a.submittedCount ? 'text-warn font-semibold' : 'text-ink-3' };
}

function whenText(a: AdminActivitySummary) {
  if (a.status === 'draft') return 'Not shared yet';
  if (a.status === 'scheduled' && a.opensAt) return `Opens ${formatDateTime(a.opensAt)}`;
  if (a.status === 'closed' && a.closesAt) return `Closed ${formatDateTime(a.closesAt)}`;
  return a.closesAt ? `Open until ${formatDateTime(a.closesAt)}` : 'Open, no end date';
}

export default function Home() {
  const list = useQuery({ queryKey: adminKeys.activities, queryFn: adminApi.activities });
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [deleting, setDeleting] = useState<AdminActivitySummary | null>(null);

  const rows = useMemo(() => (list.data ?? empty).filter((a) => filter === 'all' || a.status === filter), [list.data, filter]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, live: 0, scheduled: 0, draft: 0, closed: 0 };
    for (const a of list.data ?? empty) {
      c.all++;
      c[a.status]++;
    }
    return c;
  }, [list.data]);
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('title', { header: 'Name', sortFn: 'text' }),
        helper.accessor('status', { header: 'Status', enableGlobalFilter: false }),
        helper.accessor('submittedCount', { header: 'Responses', enableGlobalFilter: false }),
        helper.accessor((a) => new Date(a.updatedAt).getTime(), { id: 'updatedAt', header: 'Last edited', enableGlobalFilter: false }),
      ]),
    [],
  );
  const table = useTable({
    features,
    columns,
    data: rows,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: (v) => setSearch(typeof v === 'function' ? v(search) : String(v ?? '')),
    globalFilterFn: 'includesString',
    enableSortingRemoval: false,
  });
  const head = (id: string, label: string, align?: 'left' | 'right') => {
    const col = table.getColumn(id)!;
    return <SortHeader label={label} sorted={col.getIsSorted()} onToggle={() => col.toggleSorting()} align={align} />;
  };
  const visible = table.getRowModel().rows;
  const pendingResults = (list.data ?? empty).filter((a) => a.resultsRelease === 'manual' && !a.resultsPublishedAt && a.submittedCount > 0).length;

  return (
    <main className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8">
      <PageHeader
        title="Activities"
        description={
          pendingResults
            ? `${pendingResults} ${pendingResults === 1 ? 'activity has' : 'activities have'} responses waiting for you to publish results.`
            : 'Quizzes, scenario drills and treasure hunts for HRRL staff.'
        }
        actions={<NewActivityButton />}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                filter === value ? 'bg-brand-tint text-brand ring-1 ring-brand ring-inset' : 'bg-surface text-ink-2 ring-1 ring-line-strong ring-inset hover:bg-ground-2',
              )}
            >
              {label}
              <span className="ml-1.5 font-normal tabular-nums opacity-80">{counts[value]}</span>
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Search activities</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="h-8 pl-9" />
        </label>
      </div>

      {list.error ? <ErrorNote className="mt-6">{errorMessage(list.error)}</ErrorNote> : null}

      <Card className="mt-4 overflow-hidden">
        {/* Phones get stacked rows; the table starts at the sm breakpoint. */}
        <ul className="divide-y divide-line sm:hidden" aria-busy={list.isPending}>
          {list.isPending
            ? [0, 1, 2].map((i) => (
                <li key={i} className="px-4 py-3">
                  <div className="h-12 animate-pulse rounded-sm bg-ground-2" />
                </li>
              ))
            : visible.map((row) => {
                const a = row.original;
                const results = resultsLabel(a);
                return (
                  <li key={a._id} className="flex items-start gap-2 py-3 pr-2 pl-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/activities/${a._id}`} className="line-clamp-2 text-[15px] leading-5 font-semibold text-ink hover:text-brand hover:underline">
                        {a.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                        <StatusBadge status={a.status} />
                        <span className="text-ink-2 tabular-nums">
                          {a.submittedCount} {a.submittedCount === 1 ? 'response' : 'responses'}
                        </span>
                        <span className={results.tone}>{results.text}</span>
                      </div>
                    </div>
                    <RowActions activity={a} onDelete={() => setDeleting(a)} />
                  </li>
                );
              })}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line">
              <tr>
                <th className={th}>{head('title', 'Name')}</th>
                <th className={cn(th, 'w-32')}>Status</th>
                <th className={cn(th, 'w-28 text-right')}>{head('submittedCount', 'Responses', 'right')}</th>
                <th className={cn(th, 'w-44')}>Results</th>
                <th className={cn(th, 'w-32')}>{head('updatedAt', 'Last edited')}</th>
                <th className={cn(th, 'w-12')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.isPending
                ? [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-9 animate-pulse rounded-sm bg-ground-2" />
                      </td>
                    </tr>
                  ))
                : visible.map((row) => {
                    const a = row.original;
                    const results = resultsLabel(a);
                    return (
                      <tr key={a._id} className="hover:bg-ground">
                        <td className={cn(td, 'max-w-0')}>
                          <Link to={`/admin/activities/${a._id}`} className="block truncate text-[15px] font-semibold text-ink hover:text-brand hover:underline">
                            {a.title}
                          </Link>
                          <span className="block truncate text-xs text-ink-3">
                            {a.questionCount} {a.questionCount === 1 ? 'question' : 'questions'} · {whenText(a)}
                          </span>
                        </td>
                        <td className={td}>
                          <StatusBadge status={a.status} />
                        </td>
                        <td className={cn(td, 'text-right tabular-nums')}>
                          {a.submittedCount ? (
                            <Link to={`/admin/activities/${a._id}/responses`} className="font-semibold text-brand hover:underline">
                              {a.submittedCount}
                            </Link>
                          ) : (
                            <span className="text-ink-3">0</span>
                          )}
                        </td>
                        <td className={cn(td, 'text-[13px] whitespace-nowrap', results.tone)}>{results.text}</td>
                        <td className={cn(td, 'whitespace-nowrap text-ink-3')}>{relativeFromNow(a.updatedAt)}</td>
                        <td className={td}>
                          <RowActions activity={a} onDelete={() => setDeleting(a)} />
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!list.isPending && !visible.length ? (
          list.data?.length ? (
            <EmptyState title="Nothing matches">Try another filter or search word.</EmptyState>
          ) : (
            <EmptyState title="Create your first activity" action={<NewActivityButton />}>
              Give it a name, add questions and screenshots, then share the link with employees.
            </EmptyState>
          )
        ) : null}
      </Card>
      <DeleteDialog activity={deleting} onClose={() => setDeleting(null)} />
    </main>
  );
}

function RowActions({ activity, onDelete }: { activity: AdminActivitySummary; onDelete: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const duplicate = useMutation({
    mutationFn: () => adminApi.duplicate(activity._id),
    onSuccess: (copy) => {
      void qc.invalidateQueries({ queryKey: adminKeys.activities });
      toast.success('Copy created');
      navigate(`/admin/activities/${copy._id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/a/${activity.slug}`);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy. Open Share to copy the link.');
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${activity.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => navigate(`/admin/activities/${activity._id}`)}>
          <PenLine /> Edit questions
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/admin/activities/${activity._id}/responses`)}>
          <Table2 /> View responses
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/admin/activities/${activity._id}/responses?view=leaderboard`)}>
          <ListOrdered /> Leaderboard
        </DropdownMenuItem>
        {activity.status !== 'draft' ? (
          <>
            <DropdownMenuItem onSelect={copyLink}>
              <Copy /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.open(`/a/${activity.slug}`, '_blank', 'noopener')}>
              <ExternalLink /> Open as employee
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onSelect={() => duplicate.mutate()} disabled={duplicate.isPending}>
          <CopyPlus /> Make a copy
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteDialog({ activity, onClose }: { activity: AdminActivitySummary | null; onClose: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => adminApi.remove(activity!._id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.activities });
      toast.success('Activity deleted');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <AlertDialog open={!!activity} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{activity?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {activity?.attemptCount ? `All ${activity.attemptCount} responses will be deleted too. ` : ''}The link will stop working. This cannot be undone; download the responses first if you need them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-bad text-white hover:bg-bad/90"
            onClick={(e) => {
              e.preventDefault();
              remove.mutate();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
