import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Clock3, MonitorPlay } from 'lucide-react';
import type { LeaderboardEntry, LeaderboardResponse } from '@hrrl/shared';
import type { Route } from './+types/leaderboard';
import { Button } from '~/components/ui/button';
import { Wordmark } from '~/components/brand';
import { EvidenceMarker } from '~/components/evidence/marker';
import { CodeChip } from '~/components/evidence/tags';
import { PublicMessage, PublicShell } from '~/components/play/public-shell';
import { ApiError, errorMessage } from '~/lib/api';
import { loadAttempt } from '~/lib/attempt-store';
import { formatDuration, formatPct } from '~/lib/format';
import { publicApi, publicKeys } from '~/lib/public-api';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Leaderboard · HRRL Activities' }];

export default function Leaderboard() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const display = params.get('display') === '1';
  const [stored] = useState(() => (typeof window === 'undefined' ? null : loadAttempt(slug)));
  const board = useQuery({
    queryKey: publicKeys.leaderboard(slug),
    queryFn: () => publicApi.leaderboard(slug, stored?.token),
    refetchInterval: display ? 15_000 : 60_000,
  });

  if (board.error) {
    const locked = board.error instanceof ApiError && board.error.code === 'leaderboard_locked';
    const held = board.error instanceof ApiError && board.error.code === 'results_pending';
    return (
      <PublicMessage
        title={held ? 'Results are not published yet' : locked ? 'The leaderboard opens after you submit' : 'No leaderboard here'}
        action={
          <Button asChild variant="outline">
            <Link to={`/a/${slug}`}>
              <ArrowLeft /> Back to the activity
            </Link>
          </Button>
        }
      >
        {held ? 'The leaderboard appears once the CISO Office publishes the results.' : locked ? 'Finish the activity to see how you compare.' : errorMessage(board.error)}
      </PublicMessage>
    );
  }
  if (display) return <ProjectorBoard data={board.data} slug={slug} />;

  return (
    <PublicShell
      right={
        <Button asChild variant="shell" size="sm">
          <Link to={`/a/${slug}/leaderboard?display=1`}>
            <MonitorPlay /> Projector view
          </Link>
        </Button>
      }
    >
      {!board.data ? (
        <div className="h-64 max-w-3xl animate-pulse rounded-xs bg-ground-2" aria-busy="true" />
      ) : (
        <div className="max-w-3xl">
          <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.02em] text-ink">{board.data.activity.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
            <CodeChip>{board.data.activity.code}</CodeChip>
            <span>{board.data.participants} submitted</span>
          </div>
          <p className="mt-3 text-[15px] text-ink-2">Ranked by score, then by time taken. Employee IDs are partly hidden.</p>
          <BoardTable entries={board.data.entries} />
          {stored ? (
            <Button asChild variant="outline" className="mt-6">
              <Link to={`/a/${slug}/result`}>
                <ArrowLeft /> Your result
              </Link>
            </Button>
          ) : null}
        </div>
      )}
    </PublicShell>
  );
}

function BoardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (!entries.length) {
    return <p className="mt-8 rounded-xs bg-surface px-5 py-6 text-ink-2 ring-1 ring-line">No one has submitted yet. Check back once people finish.</p>;
  }
  return (
    <table className="mt-8 w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-line-strong text-[12px] font-bold tracking-[0.04em] text-ink-3 uppercase">
          <th scope="col" className="w-14 py-2 pr-2">
            Rank
          </th>
          <th scope="col" className="py-2">
            Name
          </th>
          <th scope="col" className="py-2 text-right">
            Score
          </th>
          <th scope="col" className="hidden py-2 pl-4 text-right sm:table-cell">
            Time
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={`${e.rank}-${e.employeeIdMasked}`} className={cn('border-b border-line', e.isYou && 'bg-marker-wash')}>
            <td className="py-3 pr-2">
              {e.rank <= 3 ? <EvidenceMarker n={e.rank} size={24} title={`Rank ${e.rank}`} /> : <span className="pl-1.5 font-mono text-sm font-bold text-ink-3">{e.rank}</span>}
            </td>
            <td className="py-3">
              <span className="font-semibold text-ink">{e.name}</span>
              {e.isYou ? <span className="ml-2 text-xs font-bold text-manila-ink">You</span> : null}
              <span className="block font-mono text-xs text-ink-3">{e.employeeIdMasked}</span>
            </td>
            <td className="py-3 text-right font-bold text-ink tabular-nums">
              {formatPct(e.pct)}
              {e.pending ? (
                <span className="ml-1 inline-flex align-middle text-manila-ink" title="Some answers awaiting review">
                  <Clock3 className="size-3.5" aria-label="Awaiting review" />
                </span>
              ) : null}
            </td>
            <td className="hidden py-3 pl-4 text-right text-sm text-ink-2 tabular-nums sm:table-cell">{formatDuration(e.durationSec)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Big-screen board for live events: graphite, large type, refreshes itself, QR to join. */
function ProjectorBoard({ data, slug }: { data?: LeaderboardResponse; slug: string }) {
  const joinUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/a/${slug}`;
  const top = data?.entries.slice(0, 10) ?? [];
  return (
    <div className="on-shell min-h-dvh bg-graphite px-[4vw] py-[4vh] text-shell-fg">
      <div className="flex items-start justify-between gap-8">
        <div>
          <Wordmark sub="CISO Office" />
          <h1 className="mt-6 max-w-[24ch] text-[clamp(2rem,4vw,4rem)] leading-[1.05] font-extrabold tracking-[-0.02em]">{data?.activity.title ?? 'Leaderboard'}</h1>
          <p className="mt-3 text-[clamp(1rem,1.4vw,1.4rem)] text-shell-muted">{data ? `${data.participants} submitted · updates every 15 seconds` : 'Loading…'}</p>
        </div>
        {joinUrl ? (
          <div className="hidden shrink-0 rounded-xs bg-surface p-3 text-center text-ink md:block">
            <QRCodeSVG value={joinUrl} size={148} level="M" bgColor="#ffffff" fgColor="#1a1c1e" />
            <p className="mt-2 text-xs font-bold">Scan to take part</p>
          </div>
        ) : null}
      </div>
      <ol className="mt-[5vh] grid gap-[1.2vh]">
        {top.map((e) => (
          <li
            key={`${e.rank}-${e.employeeIdMasked}`}
            className={cn('grid grid-cols-[4rem_1fr_auto_auto] items-center gap-6 rounded-xs px-5 py-[1.4vh]', e.rank <= 3 ? 'bg-graphite-2 ring-1 ring-graphite-3' : '')}
          >
            {e.rank <= 3 ? <EvidenceMarker n={e.rank} size={40} /> : <span className="pl-3 font-mono text-[clamp(1.2rem,1.8vw,1.8rem)] font-bold text-shell-muted">{e.rank}</span>}
            <span className="truncate text-[clamp(1.3rem,2.2vw,2.2rem)] font-bold">{e.name}</span>
            <span className="font-mono text-[clamp(1rem,1.5vw,1.5rem)] text-shell-muted tabular-nums">{formatDuration(e.durationSec)}</span>
            <span className="min-w-[5ch] text-right text-[clamp(1.4rem,2.4vw,2.4rem)] font-extrabold text-marker tabular-nums">{formatPct(e.pct)}</span>
          </li>
        ))}
        {data && !top.length ? <li className="text-[clamp(1.2rem,2vw,2rem)] text-shell-muted">Waiting for the first submission…</li> : null}
      </ol>
    </div>
  );
}
