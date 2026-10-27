import { Link, useParams } from 'react-router';
import { ArrowLeft, ListOrdered } from 'lucide-react';
import type { Route } from './+types/host';
import { ErrorNote, MessageBar } from '~/components/admin/ui';
import { HostProvider, useHost } from '~/components/admin/game/host-context';
import { HostHeader } from '~/components/admin/game/host-header';
import { StageRail } from '~/components/admin/game/stage-rail';
import { StagePanel } from '~/components/admin/game/stage-panel';
import { ScorePanel } from '~/components/admin/game/score-panel';
import { useHostShortcuts } from '~/components/admin/game/shortcuts';
import { useGamePolling } from '~/components/admin/game/use-host-actions';
import { ApiError, errorMessage } from '~/lib/api';
import { useGame } from '~/lib/game-api';

export const meta: Route.MetaFunction = () => [{ title: 'Host console · HRRL Activities' }];

/** Host console: run a live team game from the laptop while the projector shows the room view. */
export default function GameHost() {
  const { id = '' } = useParams();
  const game = useGame(id);
  useGamePolling(id, !!game.data);

  if (!game.data) {
    if (game.error) {
      const missing = game.error instanceof ApiError && game.error.status === 404;
      return (
        <div className="mx-auto grid max-w-[1120px] gap-4 px-4 py-8 sm:px-8">
          <ErrorNote>{missing ? 'This game was not found. It may have been deleted.' : errorMessage(game.error)}</ErrorNote>
          <Link to="/admin" className="inline-flex items-center gap-1.5 justify-self-start rounded-sm text-[13px] font-semibold text-brand hover:underline">
            <ArrowLeft className="size-3.5" aria-hidden /> All activities
          </Link>
        </div>
      );
    }
    return (
      <div aria-busy="true">
        <div className="border-b border-line bg-surface">
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="h-4 w-28 animate-pulse rounded-sm bg-ground-2" />
            <div className="mt-3 h-7 w-80 max-w-full animate-pulse rounded-sm bg-ground-2" />
          </div>
        </div>
        <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_360px] lg:px-8 xl:grid-cols-[240px_minmax(0,1fr)_420px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-surface shadow-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <HostProvider game={game.data}>
      <HostConsole refreshError={game.isRefetchError ? game.error : null} />
    </HostProvider>
  );
}

function HostConsole({ refreshError }: { refreshError: Error | null }) {
  const { nav, stages, index } = useHost();
  useHostShortcuts(nav);
  return (
    <div>
      <HostHeader />
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {refreshError ? (
          <MessageBar intent="warning" className="mb-4">
            Could not refresh the game: {errorMessage(refreshError)} It will try again in a few seconds.
          </MessageBar>
        ) : null}
        <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)_360px] xl:grid-cols-[240px_minmax(0,1fr)_420px]">
          {/* Phones and tablets: the stage list folds away above the stage. */}
          <details className="group rounded-lg bg-surface shadow-card lg:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-lg px-4 text-sm font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <ListOrdered className="size-4 text-ink-3" aria-hidden />
              All stages
              <span className="font-normal text-ink-3">
                · {index + 1} of {stages.length}
              </span>
              <span className="ml-auto text-xs font-normal text-brand group-open:hidden">Show</span>
              <span className="ml-auto hidden text-xs font-normal text-brand group-open:inline">Hide</span>
            </summary>
            <div className="max-h-[60dvh] overflow-y-auto border-t border-line px-2 py-3">
              <StageRail />
            </div>
          </details>
          <aside className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg bg-surface px-2 py-4 shadow-card lg:block">
            <StageRail autoScroll />
          </aside>
          <StagePanel />
          <ScorePanel />
        </div>
      </div>
    </div>
  );
}
