import { Trophy } from 'lucide-react';
import { ROUND_IDS, answersVisible, champion, needsTiebreak, r2CardFor, type Team } from '@hrrl/shared';
import { MessageBar } from '~/components/admin/ui';
import { useHost } from './host-context';
import { BulletList, CardChip, HostSection, RevealNote, RoomSection, SubHeading, TeamName } from './bits';
import { cn } from '~/lib/utils';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold tracking-[0.02em] text-ink-3 uppercase">{children}</p>;
}

function Big({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-lg leading-7 font-semibold text-ink', className)}>{children}</p>;
}

function Waiting({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed border-line-strong px-3 py-2.5 text-[13px] leading-5 text-ink-3">{children}</p>;
}

function TeamChips({ teams }: { teams: Team[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {teams.map((t) => (
        <li key={t.id} className="inline-flex h-8 items-center rounded-full bg-ground-2 px-3 text-[13px]">
          <TeamName team={t} />
        </li>
      ))}
    </ul>
  );
}

const coins = (n: number) => `${n} ${n === 1 ? 'coin' : 'coins'}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/** What the room sees on the projector at this stage (answers only once they are shown). */
export function RoomView() {
  const { game, stage, ranked, tied } = useHost();
  const c = game.content;
  const open = answersVisible(stage, game.state.revealed);
  const teamById = (id: string | undefined) => game.teams.find((t) => t.id === id);

  let body: React.ReactNode;
  switch (stage.kind) {
    case 'lobby':
      body = (
        <>
          <div>
            <p className="text-2xl leading-8 font-semibold text-ink">{game.title}</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink-2">{c.tagline}</p>
            <p className="mt-1 text-sm text-ink-3">{c.subtitle}</p>
          </div>
          <TeamChips teams={game.teams} />
        </>
      );
      break;
    case 'round-intro': {
      const r = c[stage.round!];
      body = (
        <>
          <div>
            <Eyebrow>
              Round {ROUND_IDS.indexOf(stage.round!) + 1} · {r.subtitle}
            </Eyebrow>
            <Big className="mt-1 text-xl">{r.title}</Big>
          </div>
          <p className="text-[15px] leading-6 text-ink-2">{r.intro}</p>
          <BulletList items={r.rules} />
        </>
      );
      break;
    }
    case 'r1-challenge': {
      const i = c.r1.challenges.findIndex((x) => x.id === stage.challengeId);
      const ch = c.r1.challenges[i];
      if (!ch) {
        body = <Waiting>This challenge is not in the game any more.</Waiting>;
        break;
      }
      body = (
        <>
          <Eyebrow>
            Challenge {i + 1} of {c.r1.challenges.length}
          </Eyebrow>
          <Big>{ch.situation}</Big>
          {open ? (
            <div className="grid gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-ink-2">Answer</span>
                <CardChip choice={ch.answer} />
              </div>
              <p className="text-sm leading-5 text-ink-2">{ch.explanation}</p>
            </div>
          ) : (
            <Waiting>The answer, why, and each team’s card appear here when you press Reveal.</Waiting>
          )}
        </>
      );
      break;
    }
    case 'r2-team': {
      const team = teamById(stage.teamId);
      const n = game.teams.findIndex((t) => t.id === stage.teamId) + 1;
      const card = team ? r2CardFor(c, game.teams, team.id, game.scores[team.id]) : null;
      body = (
        <>
          <Eyebrow>
            Team {n} of {game.teams.length}
          </Eyebrow>
          {team ? <Big className="text-xl">{team.emoji ? `${team.emoji} ` : ''}{team.name}</Big> : <Waiting>This team is not in the game any more.</Waiting>}
          <p className="text-sm leading-5 text-ink-2">One volunteer acts out the secret card. Their team guesses the scenario and explains the safest response.</p>
          <p className="text-[13px] leading-5 text-ink-3">{c.r2.safetyNote}</p>
          {card && open ? (
            <div className="grid gap-3 border-t border-line pt-3">
              <p className="text-[15px] font-semibold text-ink">
                Card {card.id}: {card.title}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <SubHeading>Warning signs</SubHeading>
                  <BulletList className="mt-1.5" items={card.warningSigns} />
                </div>
                <div>
                  <SubHeading>Safe response</SubHeading>
                  <BulletList className="mt-1.5" items={card.safeResponse} />
                </div>
              </div>
            </div>
          ) : (
            <Waiting>The card stays secret until you press Reveal.</Waiting>
          )}
        </>
      );
      break;
    }
    case 'r3-auction':
      body = (
        <>
          <div>
            <Big>{c.r3.scenario.title}</Big>
            <p className="mt-1 text-[15px] leading-6 text-ink-2">{c.r3.scenario.text}</p>
          </div>
          <p className="text-[13px] font-semibold text-ink-2">Each team has {c.r3.budget} Cyber Coins.</p>
          <ul className="grid gap-1.5">
            {c.r3.actions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm leading-5">
                <span className="text-ink">{a.label}</span>
                <span className="shrink-0 font-semibold text-ink-2 tabular-nums">{coins(a.cost)}</span>
              </li>
            ))}
          </ul>
        </>
      );
      break;
    case 'r3-twist':
      body = (
        <>
          <Big className="text-xl">{c.r3.twist.headline}</Big>
          <p className="text-[15px] leading-6 text-ink-2">{c.r3.twist.text}</p>
          <p className="text-[15px] font-semibold text-ink">{c.r3.twist.question}</p>
        </>
      );
      break;
    case 'r3-reveal':
      body = (
        <>
          <ul className="grid gap-1.5">
            {c.r3.actions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm leading-5">
                <span className="text-ink">{a.label}</span>
                <span className={cn('shrink-0 font-semibold tabular-nums', a.points > 0 ? 'text-ok' : 'text-bad')}>{signed(a.points)} points</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-3 text-sm leading-5 text-ink-2">{c.r3.lesson}</p>
          <p className="text-[13px] text-ink-3">Each team’s picks and points are shown beside the actions.</p>
        </>
      );
      break;
    case 'r4-mission':
      body = (
        <>
          <div>
            <Eyebrow>{c.r4.time}</Eyebrow>
            <Big className="mt-1 text-xl">{c.r4.headline}</Big>
            <p className="mt-1 text-[15px] leading-6 text-ink-2">{c.r4.mission}</p>
          </div>
          <ol className="grid gap-1.5 text-sm leading-5 text-ink">
            {c.r4.situations.map((s, i) => (
              <li key={s.id} className="flex gap-2">
                <span className="w-4 shrink-0 font-semibold text-ink-3 tabular-nums">{i + 1}.</span>
                {s.text}
              </li>
            ))}
          </ol>
        </>
      );
      break;
    case 'r4-reveal':
      body = (
        <ol className="grid gap-3 text-sm leading-5">
          {c.r4.situations.map((s, i) => (
            <li key={s.id} className="flex gap-2">
              <span className="w-4 shrink-0 font-semibold text-ink-3 tabular-nums">{i + 1}.</span>
              <span>
                <span className="block text-ink-2">{s.text}</span>
                <span className="block font-semibold text-ok">{s.correctAction}</span>
              </span>
            </li>
          ))}
        </ol>
      );
      break;
    case 'scores':
      body = (
        <p className="text-[15px] text-ink-2">
          The scoreboard after Round {ROUND_IDS.indexOf(stage.round!) + 1}
          {ranked[0] && ranked[0].totals.total > 0 && tied.length < 2 ? (
            <>
              . <TeamName team={ranked[0].team} className="align-middle" /> leads with {ranked[0].totals.total} points.
            </>
          ) : (
            '.'
          )}
        </p>
      );
      break;
    case 'tiebreak': {
      const winner = ranked.find((r) => r.tiebreakWin && tied.some((t) => t.id === r.team.id));
      body = (
        <>
          <Big>{c.tiebreak.question}</Big>
          <p className="text-sm text-ink-2">{c.tiebreak.rule}</p>
          {tied.length > 1 ? <TeamChips teams={tied} /> : <Waiting>No tie at the top right now.</Waiting>}
          {open ? (
            <div className="grid gap-2 border-t border-line pt-3">
              <SubHeading>Expected answer</SubHeading>
              <BulletList items={c.tiebreak.expected} />
              {winner ? (
                <p className="text-sm font-semibold text-ok">
                  Winner: <TeamName team={winner.team} className="align-middle" />
                </p>
              ) : null}
            </div>
          ) : (
            <Waiting>The expected answer and the winner appear here when you press Reveal.</Waiting>
          )}
        </>
      );
      break;
    }
    case 'final': {
      const champ = champion(ranked);
      body = (
        <>
          <Eyebrow>{c.championTitle}</Eyebrow>
          {champ ? (
            <p className="flex items-center gap-2 text-2xl leading-8 font-semibold text-ink">
              <Trophy className="size-6 text-warn" aria-hidden />
              <span>
                {champ.emoji ? `${champ.emoji} ` : ''}
                {champ.name}
              </span>
            </p>
          ) : (
            <Waiting>The top teams are tied. Run the tie-breaker to crown a champion.</Waiting>
          )}
        </>
      );
      break;
    }
  }

  return <RoomSection>{body}</RoomSection>;
}

/** Answers, expected responses and notes for the host. Returns null when the stage has none. */
export function HostView() {
  const { game, stage, ranked, tied, max } = useHost();
  const c = game.content;
  const open = answersVisible(stage, game.state.revealed);
  const notes = stage.round ? c[stage.round].hostNotes : [];

  let body: React.ReactNode = null;
  switch (stage.kind) {
    case 'lobby':
      body = (
        <div>
          <SubHeading>Tips for the host</SubHeading>
          <BulletList className="mt-1.5" items={c.hostTips} />
        </div>
      );
      break;
    case 'round-intro':
      body = (
        <>
          {notes.length ? (
            <div>
              <SubHeading>Notes for this round</SubHeading>
              <BulletList className="mt-1.5" items={notes} />
            </div>
          ) : null}
          {stage.round === 'r2' ? <Note title="Safety">{c.r2.safetyNote}</Note> : null}
          {stage.round === 'r3' ? <Note title="Say to the room">{c.r3.facilitatorNote}</Note> : null}
        </>
      );
      break;
    case 'r1-challenge': {
      const ch = c.r1.challenges.find((x) => x.id === stage.challengeId);
      if (!ch) break;
      body = (
        <>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">Answer</span>
                <CardChip choice={ch.answer} />
              </span>
              <RevealNote shown={open} />
            </div>
            <p className="text-sm leading-5 text-ink-2">{ch.explanation}</p>
          </div>
          <NotesBlock items={notes} />
        </>
      );
      break;
    }
    case 'r2-team': {
      const team = game.teams.find((t) => t.id === stage.teamId);
      if (!team) break;
      const card = r2CardFor(c, game.teams, team.id, game.scores[team.id]);
      body = (
        <>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">
                Card {card.id}: {card.title}
              </span>
              <RevealNote shown={open} />
            </div>
            <p className="text-sm leading-5 text-ink-2">
              <span className="font-semibold text-ink">The team’s task: </span>
              {card.teamTask}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <SubHeading>Warning signs to listen for</SubHeading>
                <BulletList className="mt-1.5" items={card.warningSigns} />
              </div>
              <div>
                <SubHeading>Safe response</SubHeading>
                <BulletList className="mt-1.5" items={card.safeResponse} />
              </div>
            </div>
          </div>
          <NotesBlock items={notes} />
        </>
      );
      break;
    }
    case 'r3-auction':
    case 'r3-twist':
    case 'r3-reveal':
      body = (
        <>
          {stage.kind === 'r3-twist' ? <Note title="Ask the room">{`${c.r3.twist.question} Update each team’s picks if they change their minds.`}</Note> : null}
          {stage.kind !== 'r3-reveal' ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">Points for each action</span>
                <RevealNote shown={false} hiddenText="Shown on the projector at Auction results" />
              </div>
              <ul className="grid gap-1 text-sm leading-5">
                {c.r3.actions.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3">
                    <span className="text-ink-2">{a.label}</span>
                    <span className={cn('shrink-0 font-semibold tabular-nums', a.points > 0 ? 'text-ok' : 'text-bad')}>{signed(a.points)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-3">The round is kept between 0 and {max.r3} points.</p>
            </div>
          ) : null}
          <NotesBlock items={notes} />
          <Note title="Say to the room">{c.r3.facilitatorNote}</Note>
        </>
      );
      break;
    case 'r4-mission':
      body = (
        <>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">Correct actions</span>
              <RevealNote shown={false} hiddenText="Shown on the projector at Mission results" />
            </div>
            <ol className="grid gap-1.5 text-sm leading-5">
              {c.r4.situations.map((s, i) => (
                <li key={s.id} className="flex gap-2">
                  <span className="w-4 shrink-0 font-semibold text-ink-3 tabular-nums">{i + 1}.</span>
                  <span className="text-ink-2">{s.correctAction}</span>
                </li>
              ))}
            </ol>
          </div>
          <NotesBlock items={notes} />
        </>
      );
      break;
    case 'r4-reveal':
      body = notes.length ? <NotesBlock items={notes} /> : null;
      break;
    case 'tiebreak':
      body = (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink">Expected answer</span>
            <RevealNote shown={open} />
          </div>
          <BulletList items={c.tiebreak.expected} />
          <p className="text-xs text-ink-3">{c.tiebreak.rule} The tie-breaker adds no points; it only decides the order.</p>
        </div>
      );
      break;
    case 'final':
      body = needsTiebreak(ranked) ? (
        <MessageBar intent="warning">
          {tied.map((t) => t.name).join(', ')} are tied at the top. Go back to the tie-breaker to pick a winner.
        </MessageBar>
      ) : null;
      break;
    case 'scores':
      break;
  }

  if (!body) return null;
  return <HostSection>{body}</HostSection>;
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <p className="text-sm leading-5 text-ink-2">
      <span className="font-semibold text-ink">{title}: </span>
      {children}
    </p>
  );
}

function NotesBlock({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <SubHeading>Notes for this round</SubHeading>
      <BulletList className="mt-1.5" items={items} />
    </div>
  );
}

