import { Link } from 'react-router';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Play } from 'lucide-react';
import { ROUND_IDS, answersVisible } from '@hrrl/shared';
import { Card, MessageBar } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import { useHost } from './host-context';
import { HostView, RoomView } from './stage-content';
import { TimerControls } from './timer-controls';
import { TeamsForm } from './teams-editor';
import { ShortcutsButton } from './shortcuts';
import { cn } from '~/lib/utils';

/** The current stage: what the room sees, what only the host sees, the countdown and the controls. */
export function StagePanel({ className }: { className?: string }) {
  const { game, stage, stages, index } = useHost();
  const roundNo = stage.round ? ROUND_IDS.indexOf(stage.round) + 1 : null;
  return (
    <Card className={cn('flex flex-col', className)} aria-labelledby="stage-title">
      <header className="px-4 pt-4 sm:px-5">
        <p className="text-xs font-semibold text-ink-3">
          Stage {index + 1} of {stages.length}
          {roundNo && stage.kind !== 'round-intro' ? ` · Round ${roundNo}: ${game.content[stage.round!].title}` : ''}
        </p>
        <h2 id="stage-title" className="mt-0.5 text-xl leading-7 font-semibold text-ink">
          {stage.label}
        </h2>
      </header>
      <div className="grid gap-5 px-4 pt-4 pb-5 sm:px-5">
        <TimerControls key={stage.id} />
        <RoomView />
        {stage.kind === 'lobby' && game.status === 'setup' ? <LobbyTeams /> : null}
        {stage.kind === 'lobby' && game.status === 'setup' ? <LobbyQuestions /> : null}
        <HostView />
      </div>
      <Controls />
    </Card>
  );
}

function LobbyTeams() {
  const { game, actions } = useHost();
  const scored = Object.values(game.totals).some((t) => t.total > 0);
  return (
    <section aria-labelledby="lobby-teams" className="grid gap-3">
      <div>
        <h3 id="lobby-teams" className="text-[13px] font-semibold text-ink-2">
          Teams
        </h3>
        <p className="text-xs text-ink-3">Names and emoji show on the projector. You can add or remove teams until the game starts.</p>
      </div>
      <TeamsForm
        key={game.teams.map((t) => `${t.id}:${t.name}:${t.emoji}`).join('|')}
        initial={game.teams}
        onSave={async (teams) => {
          await actions.updateTeams(teams);
          toast.success('Teams saved');
        }}
        note={scored ? <MessageBar intent="warning">Some teams already have points. Removing a team deletes its scores.</MessageBar> : null}
      />
    </section>
  );
}

function LobbyQuestions() {
  const { game } = useHost();
  return (
    <p className="text-[13px] leading-5 text-ink-3">
      You can change the situations, cards and points until the game starts.{' '}
      <Link to={`/admin/games/${game._id}/questions`} className="rounded-sm font-semibold text-brand hover:underline">
        Edit the questions
      </Link>
    </p>
  );
}

function Controls() {
  const { game, stage, stages, index, nav } = useHost();
  const next = stages[index + 1];
  const shown = answersVisible(stage, game.state.revealed);
  const isLobby = stage.kind === 'lobby';
  return (
    <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center gap-2 rounded-b-lg border-t border-line bg-surface px-4 py-3 sm:px-5">
      <Button variant="outline" onClick={nav.back} disabled={index === 0} className="h-11" aria-keyshortcuts="ArrowLeft">
        <ArrowLeft /> Back
      </Button>
      {stage.revealable ? (
        <Button
          variant={game.state.revealed ? 'secondary' : 'outline'}
          onClick={nav.toggleReveal}
          aria-pressed={game.state.revealed}
          className="h-11"
          aria-keyshortcuts="R"
        >
          {game.state.revealed ? <EyeOff /> : <Eye />}
          {game.state.revealed ? 'Hide answer' : 'Reveal answer'}
        </Button>
      ) : shown ? (
        <span className="px-1 text-xs font-semibold text-ok">Results are on the projector</span>
      ) : null}
      <ShortcutsButton />
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {next && !isLobby ? (
          <span className="hidden min-w-0 truncate text-xs text-ink-3 xl:inline">
            Up next: <span className="font-semibold text-ink-2">{next.label}</span>
          </span>
        ) : null}
        <Button onClick={nav.next} disabled={!next} className="h-11 px-5" aria-keyshortcuts="ArrowRight">
          {isLobby ? (
            <>
              <Play /> Start the game
            </>
          ) : (
            <>
              Next <ArrowRight />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
