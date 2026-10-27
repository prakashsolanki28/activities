import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import type { Route } from './+types/questions';
import { ErrorNote } from '~/components/admin/ui';
import { QuestionsEditor } from '~/components/admin/game/questions/editor';
import { ApiError, errorMessage } from '~/lib/api';
import { useQuery } from '@tanstack/react-query';
import { gameApi, gameKeys } from '~/lib/game-api';

export const meta: Route.MetaFunction = () => [{ title: 'Questions · HRRL Activities' }];

/** Question editor for one team game: every round's questions, editable until the game starts. */
export default function GameQuestions() {
  const { id = '' } = useParams();
  // Same key as useGame, but kept fresh: another window may save the questions or start the game.
  const game = useQuery({
    queryKey: gameKeys.game(id),
    queryFn: () => gameApi.get(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: () => (typeof document === 'undefined' || document.visibilityState === 'visible' ? 15_000 : false),
  });

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
          <div className="mx-auto max-w-[1120px] px-4 py-5 sm:px-8">
            <div className="h-4 w-32 animate-pulse rounded-sm bg-ground-2" />
            <div className="mt-3 h-7 w-96 max-w-full animate-pulse rounded-sm bg-ground-2" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded-sm bg-ground-2" />
          </div>
        </div>
        <div className="mx-auto grid max-w-[800px] gap-3 px-4 pt-6 sm:px-6">
          <div className="h-40 animate-pulse rounded-lg bg-surface shadow-card" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-lg bg-surface shadow-card" />
          ))}
        </div>
      </div>
    );
  }

  return <QuestionsEditor key={id} game={game.data} refreshError={game.isRefetchError ? game.error : null} />;
}
