import { useId } from 'react';
import { CircleCheck, CircleX, Trophy } from 'lucide-react';
import {
  CARD_CHOICES,
  CARD_LABELS,
  auctionSpend,
  champion,
  emptyTeamScore,
  needsTiebreak,
  r2CardFor,
  scoreTeam,
  type CardChoice,
  type Team,
} from '@hrrl/shared';
import { Card, MessageBar } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { useHost } from './host-context';
import { CARD_TONE, CardChip, TeamName } from './bits';
import { Scoreboard } from './scoreboard';
import { cn } from '~/lib/utils';

const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Scoring for the current stage, then the scoreboard. */
export function ScorePanel({ className }: { className?: string }) {
  const { stage } = useHost();
  let title = 'Scoreboard';
  let hint: string | null = null;
  let body: React.ReactNode = null;
  switch (stage.kind) {
    case 'r1-challenge':
      title = 'What each team held up';
      hint = 'Tap the card each team showed. Tap it again to clear.';
      body = <R1Scoring />;
      break;
    case 'r2-team':
      title = 'Score this team';
      hint = 'Hand the card face down to the volunteer, then tick what the team got right.';
      body = <R2Scoring />;
      break;
    case 'r3-auction':
    case 'r3-twist':
    case 'r3-reveal':
      title = 'Auction picks';
      hint = 'Tick the actions each team bought. A team cannot spend more than its budget.';
      body = <R3Scoring />;
      break;
    case 'r4-mission':
    case 'r4-reveal':
      title = 'Correct actions';
      hint = 'Tick each correct action on the team’s sheet.';
      body = <R4Scoring />;
      break;
    case 'tiebreak':
      title = 'Tie-breaker';
      hint = 'Pick the team that gave the clearest, safest answer.';
      body = <TiebreakScoring />;
      break;
    default:
      break;
  }

  return (
    <Card className={cn('flex flex-col', className)} aria-labelledby="score-panel-title">
      <header className="px-4 pt-4 pb-3 sm:px-5">
        <h2 id="score-panel-title" className="text-base font-semibold text-ink">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-[13px] leading-5 text-ink-3">{hint}</p> : null}
      </header>
      {body ? (
        <>
          <div className="px-4 pb-4 sm:px-5">{body}</div>
          <div className="border-t border-line px-4 pt-3 pb-4 sm:px-5">
            <h3 className="mb-1 text-[13px] font-semibold text-ink-2">Scoreboard</h3>
            <Scoreboard />
          </div>
        </>
      ) : (
        <div className="grid gap-4 px-4 pb-4 sm:px-5">
          {stage.kind === 'final' ? <ChampionNote /> : null}
          <Scoreboard size="full" />
        </div>
      )}
    </Card>
  );
}

function ChampionNote() {
  const { ranked, nav, stages } = useHost();
  if (needsTiebreak(ranked)) {
    const hasStage = stages.some((s) => s.id === 'tiebreak');
    return (
      <MessageBar
        intent="warning"
        action={
          hasStage ? (
            <Button size="sm" variant="outline" onClick={() => nav.go('tiebreak')}>
              Go to the tie-breaker
            </Button>
          ) : undefined
        }
      >
        Tie: run the tie-breaker.
      </MessageBar>
    );
  }
  const champ = champion(ranked);
  if (!champ) return null;
  const total = ranked[0]?.totals.total ?? 0;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-brand-tint px-4 py-3 ring-1 ring-brand/25 ring-inset">
      <Trophy className="size-6 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-3">Champion</p>
        <p className="text-base font-semibold">
          <TeamName team={champ} /> <span className="font-normal text-ink-2">· {total} points</span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Round 1: one card per team                                           */
/* ------------------------------------------------------------------ */

function R1Scoring() {
  const { game, stage, actions } = useHost();
  const ch = game.content.r1.challenges.find((x) => x.id === stage.challengeId);
  if (!ch) return null;
  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        Correct card: <CardChip choice={ch.answer} />
      </p>
      <ul className="grid gap-3">
        {game.teams.map((t) => {
          const picked = game.scores[t.id]?.r1[ch.id] ?? null;
          const right = picked === ch.answer;
          return (
            <li key={t.id} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <TeamName team={t} />
                {picked ? (
                  <span className={cn('inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold', right ? 'text-ok' : 'text-bad')}>
                    {right ? <CircleCheck className="size-4" aria-hidden /> : <CircleX className="size-4" aria-hidden />}
                    {right ? `Correct · +${game.content.r1.pointsEach}` : 'Wrong'}
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-3">No answer yet</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={`Card held up by ${t.name}`}>
                {CARD_CHOICES.map((choice) => (
                  <CardToggle
                    key={choice}
                    choice={choice}
                    pressed={picked === choice}
                    onClick={() => actions.score(t.id, { round: 'r1', challengeId: ch.id, choice: picked === choice ? null : choice })}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CardToggle({ choice, pressed, onClick }: { choice: CardChoice; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'h-11 rounded-md px-2 text-[13px] font-semibold ring-1 ring-inset transition-colors',
        focusRing,
        pressed ? CARD_TONE[choice].on : 'bg-surface text-ink-2 ring-line-strong hover:bg-ground',
      )}
    >
      {CARD_LABELS[choice]}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Round 2: the card and the rubric for one team                        */
/* ------------------------------------------------------------------ */

function R2Scoring() {
  const { game, stage, actions } = useHost();
  const c = game.content;
  const team = game.teams.find((t) => t.id === stage.teamId);
  if (!team) return <p className="text-sm text-ink-3">This team is not in the game any more.</p>;
  const score = game.scores[team.id] ?? emptyTeamScore();
  const card = r2CardFor(c, game.teams, team.id, score);
  const usedBy = (cardId: string) => game.teams.filter((t) => t.id !== team.id && r2CardFor(c, game.teams, t.id, game.scores[t.id]).id === cardId);
  const points = scoreTeam(c, score).r2;
  const max = c.r2.rubric.reduce((n, r) => n + r.points, 0);

  return (
    <div className="grid gap-4">
      <TeamName team={team} className="text-base" />
      <div>
        <h3 className="text-[13px] font-semibold text-ink">Secret card</h3>
        <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5" role="group" aria-label="Secret card for this team">
          {c.r2.cards.map((k) => {
            const others = usedBy(k.id);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={card.id === k.id}
                onClick={() => card.id !== k.id && actions.score(team.id, { round: 'r2', card: k.id })}
                title={others.length ? `${k.title} · also given to ${others.map((o) => o.name).join(', ')}` : k.title}
                className={cn(
                  'relative h-11 rounded-md text-[15px] font-semibold ring-1 ring-inset transition-colors',
                  focusRing,
                  card.id === k.id ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink-2 ring-line-strong hover:bg-ground',
                )}
              >
                {k.id}
                {others.length ? <span className={cn('absolute top-1 right-1 size-1.5 rounded-full', card.id === k.id ? 'bg-white' : 'bg-ink-3')} aria-hidden /> : null}
                <span className="sr-only">
                  : {k.title}
                  {others.length ? `, also given to ${others.map((o) => o.name).join(', ')}` : ''}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 rounded-lg border border-line bg-ground p-3">
          <p className="text-sm font-semibold text-ink">
            Card {card.id}: {card.title}
          </p>
          <p className="mt-1.5 text-xs font-semibold text-ink-3">Hand to the volunteer, or read it to them quietly</p>
          <p className="mt-0.5 text-sm leading-5 text-ink">{card.brief}</p>
          <p className="mt-2 text-xs font-semibold text-ink-3">Their team’s task</p>
          <p className="mt-0.5 text-sm leading-5 text-ink-2">{card.teamTask}</p>
        </div>
      </div>
      <fieldset>
        <legend className="flex w-full items-baseline justify-between gap-2 text-[13px] font-semibold text-ink">
          <span>What the team got right</span>
          <span className="font-normal text-ink-2 tabular-nums">
            {points} / {max} points
          </span>
        </legend>
        <div className="mt-1.5 grid gap-1">
          {c.r2.rubric.map((r) => (
            <CheckRow
              key={r.id}
              checked={score.r2[r.id]}
              onChange={(v) => actions.score(team.id, { round: 'r2', [r.id]: v })}
              label={r.label}
              meta={`${r.points} points`}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Round 3: picks within the budget                                     */
/* ------------------------------------------------------------------ */

function R3Scoring() {
  const { game, stage, actions } = useHost();
  const c = game.content;
  const toggle = (teamId: string, actionId: string, on: boolean) => {
    // Build on the latest cached picks so quick taps add up.
    const g = actions.latest() ?? game;
    const cur = new Set(g.scores[teamId]?.r3.picks ?? []);
    if (on) cur.add(actionId);
    else cur.delete(actionId);
    const picks = c.r3.actions.filter((a) => cur.has(a.id)).map((a) => a.id);
    actions.score(teamId, { round: 'r3', picks });
  };
  return (
    <div className="grid gap-4">
      {stage.kind === 'r3-twist' ? (
        <MessageBar>Ask each team: “{c.r3.twist.question}” Update their picks if they change their minds.</MessageBar>
      ) : null}
      <ul className="grid gap-4">
        {game.teams.map((t) => (
          <R3Team key={t.id} team={t} onToggle={(actionId, on) => toggle(t.id, actionId, on)} />
        ))}
      </ul>
    </div>
  );
}

function R3Team({ team, onToggle }: { team: Team; onToggle: (actionId: string, on: boolean) => void }) {
  const { game } = useHost();
  const c = game.content;
  const score = game.scores[team.id] ?? emptyTeamScore();
  const picks = new Set(score.r3.picks);
  const spent = auctionSpend(c, score.r3.picks);
  const left = c.r3.budget - spent;
  const points = scoreTeam(c, score).r3;
  const pct = Math.min(100, Math.round((spent / c.r3.budget) * 100));
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <TeamName team={team} />
        <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">{points} points</span>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs text-ink-3 tabular-nums">
          <span>
            {spent} / {c.r3.budget} coins spent
          </span>
          <span>{left} left</span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-ground-2"
          role="meter"
          aria-label={`Coins spent by ${team.name}`}
          aria-valuemin={0}
          aria-valuemax={c.r3.budget}
          aria-valuenow={spent}
          aria-valuetext={`${spent} of ${c.r3.budget} coins spent`}
        >
          <div className={cn('h-full rounded-full', spent > c.r3.budget ? 'bg-bad' : 'bg-brand')} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-2 grid gap-0.5">
        {c.r3.actions.map((a) => {
          const on = picks.has(a.id);
          const tooDear = !on && a.cost > left;
          return (
            <CheckRow
              key={a.id}
              checked={on}
              disabled={tooDear}
              onChange={(v) => onToggle(a.id, v)}
              label={a.label}
              meta={
                <>
                  {a.cost} coins
                  <span className={cn('ml-1.5', a.points > 0 ? 'text-ok' : a.points < 0 ? 'text-bad' : 'text-ink-3')}>
                    {a.points > 0 ? `+${a.points}` : a.points < 0 ? `−${Math.abs(a.points)}` : '0'}
                  </span>
                </>
              }
              note={tooDear ? 'Not enough coins left' : undefined}
            />
          );
        })}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Round 4: correct actions per team                                    */
/* ------------------------------------------------------------------ */

function R4Scoring() {
  const { game, actions } = useHost();
  const c = game.content;
  const max = c.r4.situations.length * c.r4.pointsEach;
  return (
    <ul className="grid gap-4">
      {game.teams.map((t) => {
        const score = game.scores[t.id] ?? emptyTeamScore();
        const points = scoreTeam(c, score).r4;
        return (
          <li key={t.id} className="rounded-lg border border-line p-3">
            <div className="flex items-center justify-between gap-2">
              <TeamName team={t} />
              <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">
                {points} / {max} points
              </span>
            </div>
            <div className="mt-2 grid gap-0.5">
              {c.r4.situations.map((s) => (
                <CheckRow
                  key={s.id}
                  checked={!!score.r4[s.id]}
                  onChange={(v) => actions.score(t.id, { round: 'r4', situationId: s.id, correct: v })}
                  label={s.correctAction}
                  meta={`${c.r4.pointsEach} points`}
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Tie-breaker                                                          */
/* ------------------------------------------------------------------ */

function TiebreakScoring() {
  const { game, tied, actions } = useHost();
  if (tied.length < 2) {
    return <MessageBar intent="success">No tie at the top. You can skip this stage.</MessageBar>;
  }
  const total = game.totals[tied[0]!.id]?.total ?? 0;
  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-ink-2">
        {tied.length} teams are level on {total} points.
      </p>
      <ul className="grid gap-2">
        {tied.map((t) => {
          const win = !!game.scores[t.id]?.tiebreakWin;
          return (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-line py-1.5 pr-1.5 pl-3">
              <TeamName team={t} />
              <button
                type="button"
                aria-pressed={win}
                onClick={() => actions.score(t.id, { round: 'tiebreak', win: !win })}
                aria-label={`Winner: ${t.name}`}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold ring-1 ring-inset transition-colors',
                  focusRing,
                  win ? 'bg-brand text-white ring-brand' : 'bg-surface text-ink-2 ring-line-strong hover:bg-ground',
                )}
              >
                <Trophy className="size-4" aria-hidden /> Winner
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared                                                               */
/* ------------------------------------------------------------------ */

/** A checkbox with its label as one 44px-tall target. */
function CheckRow({
  checked,
  onChange,
  label,
  meta,
  note,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  meta?: React.ReactNode;
  note?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn('flex min-h-11 items-start gap-3 rounded-md px-2 py-2.5 hover:bg-ground', disabled && 'opacity-60 hover:bg-transparent')}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        aria-describedby={note ? `${id}-note` : undefined}
        className="mt-0.5 size-5"
      />
      <label htmlFor={id} className={cn('min-w-0 flex-1 text-sm leading-5 text-ink', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        {label}
        {note ? (
          <span id={`${id}-note`} className="block text-xs text-ink-3">
            {note}
          </span>
        ) : null}
      </label>
      {meta ? <span className="shrink-0 pt-px text-xs font-semibold whitespace-nowrap text-ink-3 tabular-nums">{meta}</span> : null}
    </div>
  );
}
