import { useId, useState } from 'react';
import { CircleCheck, CircleX, Trophy } from 'lucide-react';
import { CARD_CHOICES, CARD_LABELS, auctionSpend, champion, emptyTeamScore, needsTiebreak, scoreTeam, type CardChoice, type Team } from '@hrrl/shared';
import { Card, MessageBar } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { useHost } from './host-context';
import { CARD_TONE, CardChip, TeamName } from './bits';
import { Scoreboard } from './scoreboard';
import { cn } from '~/lib/utils';

const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Scoring for the current stage, then the scoreboard. */
export function ScorePanel({ className }: { className?: string }) {
  const { game, stage } = useHost();
  let title = 'Scoreboard';
  let hint: string | null = null;
  let body: React.ReactNode = null;
  switch (stage.kind) {
    case 'r1-challenge':
      title = 'What each team held up';
      hint = 'Tap the card each team showed. Tap it again to clear.';
      body = <R1Scoring />;
      break;
    case 'r2-mime':
      title = 'Round 2 marks';
      hint = `Type each team’s marks out of ${game.content.r2.maxMarks}. The room sees them at Scores after Round 2.`;
      body = <R2Marks />;
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
    case 'scores':
      // Marks can still be corrected here; they are already on the projector.
      if (stage.round === 'r2') {
        title = 'Round 2 marks';
        hint = `Type each team’s marks out of ${game.content.r2.maxMarks}. They are on the projector now, so a correction shows straight away.`;
        body = <R2Marks />;
      }
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
            <Scoreboard size={stage.kind === 'scores' ? 'full' : 'compact'} />
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
/* Round 2: marks the host types for each team                          */
/* ------------------------------------------------------------------ */

function R2Marks() {
  const { game } = useHost();
  const max = game.content.r2.maxMarks;
  return (
    <ul className="grid gap-2">
      {game.teams.map((t) => (
        <R2MarksRow key={t.id} team={t} max={max} />
      ))}
    </ul>
  );
}

const marksText = (marks: number | null) => (marks == null ? '' : String(marks));

/** What was typed: null for an empty box, undefined when it is not a whole number from 0 to max. */
function parseMarks(text: string, max: number): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d{1,4}$/.test(t)) return undefined;
  const n = Number(t);
  return n <= max ? n : undefined;
}

/**
 * One team's marks. The box keeps its own text while the host types; it is sent on blur or Enter
 * (Escape puts the saved marks back). Saved marks that change elsewhere replace the text unless the
 * host is typing in this box.
 */
function R2MarksRow({ team, max }: { team: Team; max: number }) {
  const { game, actions } = useHost();
  const id = useId();
  const saved = game.scores[team.id]?.r2?.marks ?? null;
  const points = game.totals[team.id]?.r2 ?? 0;
  const [draft, setDraft] = useState(() => marksText(saved));
  const [invalid, setInvalid] = useState(false);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState(false);
  const [synced, setSynced] = useState(saved);
  if (saved !== synced) {
    setSynced(saved);
    if (!focused || !typed) {
      setDraft(marksText(saved));
      setInvalid(false);
      setTyped(false);
    }
  }

  /** Includes changes still on their way to the server. */
  const latest = () => (actions.latest() ?? game).scores[team.id]?.r2?.marks ?? null;

  const commit = () => {
    if (!typed) return;
    const marks = parseMarks(draft, max);
    if (marks === undefined) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setTyped(false);
    setDraft(marksText(marks));
    if (marks !== latest()) actions.score(team.id, { round: 'r2', marks });
  };

  const revert = () => {
    setDraft(marksText(latest()));
    setInvalid(false);
    setTyped(false);
  };

  const errId = `${id}-error`;
  return (
    <li className="rounded-lg border border-line px-3 py-2">
      <div className="flex items-center gap-3">
        <TeamName team={team} className="flex-1" />
        <div className="flex shrink-0 items-center gap-1.5">
          <Input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="done"
            value={draft}
            aria-label={`Marks for ${team.name}`}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-max ${errId}` : `${id}-max`}
            onFocus={() => setFocused(true)}
            onChange={(e) => {
              setDraft(e.target.value);
              setTyped(true);
              setInvalid(false);
            }}
            onBlur={() => {
              setFocused(false);
              commit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                revert();
              }
            }}
            className="h-11 w-16 text-right text-[15px] tabular-nums"
          />
          <span id={`${id}-max`} className="text-[13px] text-ink-3 tabular-nums">
            <span aria-hidden>/ {max}</span>
            <span className="sr-only">out of {max}</span>
          </span>
        </div>
        <span className={cn('min-w-18 shrink-0 text-right text-[13px] tabular-nums', saved == null ? 'text-ink-3' : 'font-semibold text-ink')}>
          {saved == null ? 'Not marked' : `${points} points`}
        </span>
      </div>
      <p id={errId} aria-live="polite" className="mt-1 text-xs leading-5 font-semibold text-red-ink empty:mt-0">
        {invalid ? `Use a whole number from 0 to ${max}` : null}
      </p>
    </li>
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
