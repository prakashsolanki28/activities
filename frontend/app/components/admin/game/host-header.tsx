import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, Copy, ListChecks, Loader2, MonitorPlay, MoreHorizontal, Printer, RotateCcw, Users } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
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
import { useHost } from './host-context';
import { GameStatusBadge } from './bits';
import { TeamsForm } from './teams-editor';

export const DISPLAY_WINDOW = 'cyber-survivor-display';

export function openProjector(code: string) {
  window.open(`/g/${encodeURIComponent(code)}`, DISPLAY_WINDOW);
}

/** White band like the activity pages: back link, title, status, code and the game's actions. */
export function HostHeader() {
  const { game } = useHost();
  const [dialog, setDialog] = useState<'reset' | 'teams' | null>(null);
  const canEditTeams = game.status === 'setup';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/g/${game.code}`);
      toast.success('Projector link copied');
    } catch {
      toast.error('Could not copy. The projector page is /g/' + game.code);
    }
  };

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-brand hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden /> All activities
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-3 gap-y-2 sm:basis-0">
            <h1 className="min-w-0 truncate text-xl leading-7 font-semibold text-ink">{game.title}</h1>
            <GameStatusBadge status={game.status} />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-6 items-center gap-1.5 rounded-sm bg-ground-2 px-2 text-xs text-ink-2 outline-none hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              title="Copy the projector link"
            >
              Code <span className="font-mono font-semibold tracking-wide text-ink">{game.code}</span>
              <Copy className="size-3 text-ink-3" aria-hidden />
              <span className="sr-only">: copy the projector link</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openProjector(game.code)}>
              <MonitorPlay /> Open projector
            </Button>
            <Button variant="outline" asChild>
              <a href={`/admin/games/${game._id}/print`} target="_blank" rel="noopener">
                <Printer /> Print
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/admin/games/${game._id}/questions`}>
                <ListChecks /> Questions
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label="More actions">
                  <MoreHorizontal /> <span className="hidden sm:inline">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => setDialog('teams')} disabled={!canEditTeams} className="items-start">
                  <Users className="mt-0.5" />
                  <span>
                    Edit teams
                    {!canEditTeams ? <span className="block text-xs text-ink-3">Teams can only be changed before the game starts.</span> : null}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDialog('reset')}>
                  <RotateCcw /> Reset game
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <ResetDialog open={dialog === 'reset'} onClose={() => setDialog(null)} />
      <TeamsDialog open={dialog === 'teams' && canEditTeams} onClose={() => setDialog(null)} />
    </div>
  );
}

function ResetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useHost();
  const [busy, setBusy] = useState(false);
  const reset = async () => {
    setBusy(true);
    try {
      await actions.reset();
      toast.success('Game reset');
      onClose();
    } catch {
      // The error toast comes from the action.
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset the game?</AlertDialogTitle>
          <AlertDialogDescription>Clears every score and goes back to the start. The teams stay as they are. This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              void reset();
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Reset game
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TeamsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { game, actions } = useHost();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit teams</DialogTitle>
          <DialogDescription>Names and emoji show on the projector and the scoreboard.</DialogDescription>
        </DialogHeader>
        {open ? (
          <TeamsForm
            initial={game.teams}
            onCancel={onClose}
            onSave={async (teams) => {
              await actions.updateTeams(teams);
              toast.success('Teams saved');
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
