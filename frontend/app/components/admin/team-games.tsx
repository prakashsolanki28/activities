import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ListChecks, Loader2, MonitorPlay, MoreHorizontal, Plus, Printer, Presentation, Trash2 } from 'lucide-react';
import { DEFAULT_TEAMS, type AdminGameSummary, type Team } from '@hrrl/shared';
import { Card, EmptyState, ErrorNote } from '~/components/admin/ui';
import { td, th } from '~/components/admin/data-table';
import { GameStatusBadge } from '~/components/admin/game/bits';
import { TeamsEditor, checkTeams, cleanTeams } from '~/components/admin/game/teams-editor';
import { Field } from '~/components/field';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
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
import { relativeFromNow } from '~/lib/format';
import { gameApi, gameKeys, useGames } from '~/lib/game-api';
import { cn } from '~/lib/utils';

const DEFAULT_NAME = 'Cyber Survivor';
const freshTeams = (): Team[] => DEFAULT_TEAMS.map((t) => ({ ...t }));

/** Team games list on the admin home page, under the activities. */
export function TeamGamesCard() {
  const list = useGames();
  const [creating, setCreating] = useState(false);
  // A fresh form every time the dialog opens.
  const [createKey, setCreateKey] = useState(0);
  const [deleting, setDeleting] = useState<AdminGameSummary | null>(null);
  const games = list.data ?? [];
  const startCreate = () => {
    setCreateKey((k) => k + 1);
    setCreating(true);
  };

  return (
    <Card className="mt-8 overflow-hidden" aria-labelledby="team-games-title">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <h2 id="team-games-title" className="text-base font-semibold text-ink">
            Team games
          </h2>
          <p className="mt-0.5 max-w-[70ch] text-sm leading-5 text-ink-3">
            Live games you run in a room with a projector. Teams answer on printed cards; you keep the score.
          </p>
        </div>
        <Button variant="outline" onClick={startCreate}>
          <Plus /> New team game
        </Button>
      </header>

      {list.error ? <ErrorNote className="mx-4 mb-4 sm:mx-5">{errorMessage(list.error)}</ErrorNote> : null}

      {list.isPending ? (
        <div className="grid gap-2 border-t border-line px-4 py-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-sm bg-ground-2" />
          ))}
        </div>
      ) : games.length ? (
        <>
          {/* Phones get stacked rows; the table starts at the sm breakpoint. */}
          <ul className="divide-y divide-line border-t border-line sm:hidden">
            {games.map((g) => (
              <li key={g._id} className="flex items-start gap-2 py-3 pr-2 pl-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/games/${g._id}`} className="line-clamp-2 text-[15px] leading-5 font-semibold text-ink hover:text-brand hover:underline">
                    {g.title}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <GameStatusBadge status={g.status} />
                    {g.status === 'live' ? <span className="text-ink-2">{g.stageLabel}</span> : null}
                    <Leader leader={g.leader} />
                  </div>
                </div>
                <RowActions game={g} onDelete={() => setDeleting(g)} />
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-t border-line sm:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className={th}>Name</th>
                  <th className={cn(th, 'w-56')}>Status</th>
                  <th className={cn(th, 'w-56')}>Leader</th>
                  <th className={cn(th, 'w-32')}>Last update</th>
                  <th className={cn(th, 'w-12')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {games.map((g) => (
                  <tr key={g._id} className="hover:bg-ground">
                    <td className={cn(td, 'max-w-0')}>
                      <Link to={`/admin/games/${g._id}`} className="block truncate text-[15px] font-semibold text-ink hover:text-brand hover:underline">
                        {g.title}
                      </Link>
                      <span className="block truncate text-xs text-ink-3">
                        {g.teamCount} {g.teamCount === 1 ? 'team' : 'teams'} · Code <span className="font-mono">{g.code}</span>
                      </span>
                    </td>
                    <td className={td}>
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <GameStatusBadge status={g.status} />
                        {g.status === 'live' ? <span className="max-w-full truncate text-xs text-ink-3">{g.stageLabel}</span> : null}
                      </span>
                    </td>
                    <td className={cn(td, 'max-w-0')}>
                      <Leader leader={g.leader} />
                    </td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-3')}>{relativeFromNow(g.updatedAt)}</td>
                    <td className={td}>
                      <RowActions game={g} onDelete={() => setDeleting(g)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !list.error ? (
        <EmptyState
          title="No team games yet"
          className="border-t border-line"
          action={
            <Button onClick={startCreate}>
              <Plus /> New team game
            </Button>
          }
        >
          Start from Cyber Survivor: four rounds, four teams and a projector screen the whole room can follow.
        </EmptyState>
      ) : null}

      <NewTeamGameDialog key={createKey} open={creating} onOpenChange={setCreating} />
      <DeleteGameDialog game={deleting} onClose={() => setDeleting(null)} />
    </Card>
  );
}

function Leader({ leader }: { leader: AdminGameSummary['leader'] }) {
  if (!leader || leader.total <= 0) return <span className="text-[13px] text-ink-3">No points yet</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[13px]">
      {leader.emoji ? (
        <span aria-hidden className="shrink-0">
          {leader.emoji}
        </span>
      ) : null}
      <span className="truncate font-semibold text-ink">{leader.name}</span>
      <span className="shrink-0 text-ink-3 tabular-nums">· {leader.total} pts</span>
    </span>
  );
}

function RowActions({ game, onDelete }: { game: AdminGameSummary; onDelete: () => void }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${game.title}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => navigate(`/admin/games/${game._id}`)}>
          <Presentation /> Open host console
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(`/admin/games/${game._id}/questions`)} className="items-start">
          <ListChecks className="mt-0.5" />
          <span>
            Edit questions
            {game.status !== 'setup' ? <span className="block text-xs text-ink-3">Read-only once the game has started</span> : null}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open(`/g/${encodeURIComponent(game.code)}`, '_blank', 'noopener')}>
          <MonitorPlay /> Open projector
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open(`/admin/games/${game._id}/print`, '_blank', 'noopener')}>
          <Printer /> Print cards
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewTeamGameDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState(DEFAULT_NAME);
  const [teams, setTeams] = useState<Team[]>(freshTeams);
  const [tried, setTried] = useState(false);
  const check = checkTeams(teams);

  const create = useMutation({
    mutationFn: () => gameApi.create({ title: title.trim() || DEFAULT_NAME, teams: cleanTeams(teams) }),
    onSuccess: (g) => {
      qc.setQueryData(gameKeys.game(g._id), g);
      void qc.invalidateQueries({ queryKey: gameKeys.games });
      onOpenChange(false);
      navigate(`/admin/games/${g._id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (title.trim() && check.ok) create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>New team game</DialogTitle>
            <DialogDescription>Starts from Cyber Survivor. You can rename teams later, and add or remove them until the game starts.</DialogDescription>
          </DialogHeader>
          <Field label="Name" className="mt-5" error={tried && !title.trim() ? 'Give the game a name' : undefined}>
            {(p) => <Input {...p} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}
          </Field>
          <fieldset className="mt-5">
            <legend className="mb-1.5 text-[13px] font-semibold text-ink">Teams</legend>
            <TeamsEditor teams={teams} onChange={setTeams} disabled={create.isPending} />
          </fieldset>
          {create.error ? <ErrorNote className="mt-4">{errorMessage(create.error)}</ErrorNote> : null}
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !title.trim() || !check.ok}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGameDialog({ game, onClose }: { game: AdminGameSummary | null; onClose: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => gameApi.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: gameKeys.game(id) });
      void qc.invalidateQueries({ queryKey: gameKeys.games });
      toast.success('Game deleted');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <AlertDialog open={!!game} onOpenChange={(o) => !o && !remove.isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{game?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>The scores are deleted and the projector page stops working. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(e) => {
              e.preventDefault();
              if (game) remove.mutate(game._id);
            }}
          >
            {remove.isPending ? <Loader2 className="animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
