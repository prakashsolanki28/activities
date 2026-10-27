import type { CardChoice, DisplayView, PublicGameDisplay, Team } from '@hrrl/shared';
import { CARD_CHOICES, CARD_LABELS } from '@hrrl/shared';
import { EvidenceMarker } from '~/components/evidence/marker';
import { cn } from '~/lib/utils';
import { CARD_META } from './card-meta';
import { ScoreTable } from './score-table';

type V<K extends DisplayView['kind']> = Extract<DisplayView, { kind: K }>;
type Teams = Map<string, Team>;

const H1 = 'text-[clamp(2.4rem,5.4vw,6rem)] leading-[1.02] font-extrabold tracking-[-0.02em]';
const LEAD = 'text-[clamp(1.1rem,2vw,2.3rem)] leading-snug text-shell-muted';
const EYEBROW = 'text-[clamp(0.9rem,1.5vw,1.7rem)] font-bold tracking-[0.12em] text-marker uppercase';

function TeamLabel({ team }: { team?: Team }) {
  if (!team) return null;
  return (
    <span className="whitespace-nowrap">
      <span className="mr-[0.4em]">{team.emoji}</span>
      {team.name}
    </span>
  );
}

export function StageView({ display }: { display: PublicGameDisplay }) {
  const teams: Teams = new Map(display.teams.map((t) => [t.id, t]));
  const v = display.view;
  switch (v.kind) {
    case 'lobby':
      return <Lobby display={display} view={v} />;
    case 'round-intro':
      return <RoundIntro view={v} />;
    case 'r1-challenge':
      return <R1 view={v} teams={teams} />;
    case 'r2-team':
      return <R2 view={v} team={teams.get(v.teamId)} />;
    case 'r3-auction':
      return <R3Auction view={v} />;
    case 'r3-twist':
      return <R3Twist view={v} />;
    case 'r3-reveal':
      return <R3Reveal view={v} teams={display.teams} />;
    case 'r4-mission':
      return <R4Mission view={v} />;
    case 'r4-reveal':
      return <R4Reveal view={v} teams={display.teams} />;
    case 'scores':
      return (
        <div className="flex h-full flex-col justify-center gap-[3vh]">
          <h2 className={H1}>Scores after Round {v.afterRound.replace('r', '')}</h2>
          <ScoreTable display={display} />
        </div>
      );
    case 'tiebreak':
      return <Tiebreak view={v} teams={teams} />;
    case 'final':
      return <Final view={v} display={display} team={v.championTeamId ? teams.get(v.championTeamId) : undefined} />;
  }
}

function Lobby({ display, view }: { display: PublicGameDisplay; view: V<'lobby'> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[4vh]">
      <div>
        <p className={EYEBROW}>{display.tagline}</p>
        <h1 className="mt-[1vh] text-[clamp(3.2rem,8.4vw,9.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">{display.title}</h1>
        <p className={cn(LEAD, 'mt-[2vh] max-w-[34ch]')}>{view.subtitle}</p>
      </div>
      <ul className="flex flex-wrap gap-[1.2vw]" aria-label="Teams">
        {display.teams.map((t) => (
          <li key={t.id} className="flex items-center gap-[0.9vw] rounded-xs bg-graphite-2 px-[1.6vw] py-[1.6vh] text-[clamp(1.2rem,2.3vw,2.7rem)] font-bold ring-1 ring-graphite-3">
            <span className="text-[1.5em] leading-none">{t.emoji}</span>
            {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoundIntro({ view }: { view: V<'round-intro'> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[3vh]">
      <div>
        <p className={EYEBROW}>Round {view.number}</p>
        <h1 className={cn(H1, 'mt-[1vh]')}>{view.title}</h1>
        <p className="mt-[1.4vh] text-[clamp(1.1rem,1.9vw,2.2rem)] font-semibold text-shell-muted">{view.subtitle}</p>
      </div>
      <p className="max-w-[48ch] text-[clamp(1.2rem,2.1vw,2.5rem)] leading-snug">{view.intro}</p>
      <ul className="flex flex-wrap gap-[1vw]">
        {view.rules.map((r) => (
          <li key={r} className="rounded-xs bg-marker px-[1.4vw] py-[1.2vh] text-[clamp(1rem,1.8vw,2.1rem)] font-bold text-marker-ink">
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Swatch({ choice, state }: { choice: CardChoice; state: 'plain' | 'win' | 'dim' }) {
  const m = CARD_META[choice];
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-center gap-[0.8vw] rounded-xs px-[1vw] py-[1.8vh] text-[clamp(1.2rem,2.4vw,2.8rem)] font-extrabold uppercase transition-all',
        m.solid,
        state === 'win' && 'scale-[1.04] ring-[0.5vh] ring-white',
        state === 'dim' && 'opacity-30',
      )}
      data-testid={`swatch-${choice}`}
    >
      <span aria-hidden className="text-[1.2em] leading-none">
        {m.symbol}
      </span>
      {CARD_LABELS[choice]}
    </div>
  );
}

function R1({ view, teams }: { view: V<'r1-challenge'>; teams: Teams }) {
  const open = view.answer !== undefined;
  return (
    <div className="flex h-full flex-col justify-between gap-[3vh]">
      <div className="flex flex-col gap-[2.4vh]">
        <p className={EYEBROW}>
          Challenge {view.number} / {view.total}
        </p>
        <p className={cn('max-w-[28ch] text-[clamp(2rem,4.4vw,5rem)] leading-[1.1] font-extrabold tracking-[-0.015em]', open && 'text-[clamp(1.6rem,3vw,3.6rem)]')} data-testid="situation">
          {view.situation}
        </p>
        {open ? (
          <div className="flex flex-col gap-[2vh]" data-testid="r1-answer">
            <p className="max-w-[60ch] text-[clamp(1.1rem,1.8vw,2.1rem)] leading-snug">{view.explanation}</p>
            <ul className="flex flex-wrap gap-[0.8vw]">
              {Object.entries(view.teamAnswers ?? {}).map(([id, choice]) => {
                const t = teams.get(id);
                const right = choice === view.answer;
                return (
                  <li key={id} className="flex items-center gap-[0.7vw] rounded-xs bg-graphite-2 px-[1vw] py-[0.9vh] text-[clamp(0.95rem,1.5vw,1.8rem)] ring-1 ring-graphite-3">
                    <TeamLabel team={t} />
                    <span className="font-bold text-shell-muted">{choice ? CARD_LABELS[choice] : 'No card'}</span>
                    <span className={cn('text-[1.3em] leading-none font-extrabold', right ? 'text-[#4cd08b]' : 'text-[#ff7b6b]')} aria-label={right ? 'Correct' : 'Wrong'}>
                      {right ? '✓' : '✗'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="flex gap-[1.2vw]" aria-label="Answer cards">
        {CARD_CHOICES.map((c) => (
          <Swatch key={c} choice={c} state={!open ? 'plain' : c === view.answer ? 'win' : 'dim'} />
        ))}
      </div>
    </div>
  );
}

function R2({ view, team }: { view: V<'r2-team'>; team?: Team }) {
  return (
    <div className="flex h-full flex-col justify-between gap-[3vh]">
      {view.card ? (
        <div className="flex flex-col gap-[2.4vh]" data-testid="r2-card">
          <div>
            <p className={EYEBROW}>
              {team?.emoji} {team?.name} · The scenario
            </p>
            <h2 className={cn(H1, 'mt-[1vh]')}>{view.card.title}</h2>
          </div>
          <div className="grid grid-cols-2 gap-[2vw]">
            <ListBlock title="Warning signs" items={view.card.warningSigns} tone="danger" />
            <ListBlock title="Safe response" items={view.card.safeResponse} tone="safe" />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-[3vh]">
          <p className={EYEBROW}>
            Team {view.number} of {view.total}
          </p>
          <h2 className="text-[clamp(3rem,7.5vw,8.5rem)] leading-none font-extrabold tracking-[-0.025em]">
            <span className="mr-[0.25em]">{team?.emoji}</span>
            {team?.name}
          </h2>
          <p className="text-[clamp(1.4rem,2.8vw,3.3rem)] font-bold">Your volunteer is acting: guess the scenario!</p>
        </div>
      )}
      <p className="max-w-[80ch] text-[clamp(0.85rem,1.15vw,1.3rem)] text-shell-muted">{view.safetyNote}</p>
    </div>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: 'safe' | 'danger' }) {
  return (
    <section className={cn('rounded-xs bg-graphite-2 p-[1.6vw] ring-1 ring-graphite-3 border-t-[0.8vh]', tone === 'safe' ? 'border-ledger' : 'border-evidence')}>
      <h3 className="text-[clamp(1rem,1.7vw,2rem)] font-extrabold tracking-[0.06em] uppercase">{title}</h3>
      <ul className="mt-[1.2vh] flex flex-col gap-[1.2vh] text-[clamp(1rem,1.7vw,2rem)] leading-snug">
        {items.map((s) => (
          <li key={s} className="flex gap-[0.8vw]">
            <span aria-hidden className={cn('font-extrabold', tone === 'safe' ? 'text-[#4cd08b]' : 'text-[#ff7b6b]')}>
              {tone === 'safe' ? '✓' : '⚠'}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

function R3Auction({ view }: { view: V<'r3-auction'> }) {
  return (
    <div className="flex h-full flex-col justify-between gap-[3vh]">
      <div className="flex items-end justify-between gap-[3vw]">
        <div>
          <p className={EYEBROW}>{view.scenario.title}</p>
          <p className="mt-[1vh] max-w-[30ch] text-[clamp(1.6rem,3.2vw,3.8rem)] leading-[1.1] font-extrabold">{view.scenario.text}</p>
        </div>
        <p className="shrink-0 rounded-xs bg-marker px-[1.6vw] py-[1.4vh] text-[clamp(1.1rem,2.2vw,2.6rem)] font-extrabold text-marker-ink">Budget: {view.budget} Cyber Coins</p>
      </div>
      <ul className="grid gap-[1.2vh]" aria-label="Actions for auction">
        {view.actions.map((a, i) => (
          <li key={a.id} className="flex items-center gap-[1.4vw] rounded-xs bg-graphite-2 px-[1.4vw] py-[1.6vh] ring-1 ring-graphite-3">
            <span className="flex size-[3.2vw] min-w-9 items-center justify-center rounded-full bg-graphite-3 font-mono text-[clamp(1rem,1.8vw,2rem)] font-bold">{String.fromCharCode(65 + i)}</span>
            <span className="flex-1 text-[clamp(1.1rem,2vw,2.4rem)] leading-snug font-semibold">{a.label}</span>
            <span className="shrink-0 font-mono text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold text-marker tabular-nums">{a.cost} 🪙</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function R3Twist({ view }: { view: V<'r3-twist'> }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[4vh] text-center">
      <div className="cs-alert flex flex-col items-center gap-[3vh] rounded-xs border-[0.8vh] border-evidence bg-graphite-2 px-[4vw] py-[6vh]" role="alert">
        <p className="text-[clamp(1rem,1.8vw,2.1rem)] font-extrabold tracking-[0.2em] text-[#ff7b6b] uppercase">⚠ Alert</p>
        <h2 className="text-[clamp(3rem,7vw,8rem)] leading-none font-extrabold tracking-[-0.02em]">{view.headline}</h2>
        <p className="max-w-[26ch] text-[clamp(1.6rem,3.2vw,3.8rem)] leading-tight font-bold">{view.text}</p>
      </div>
      <p className="text-[clamp(1.3rem,2.6vw,3rem)] font-bold text-marker">{view.question}</p>
    </div>
  );
}

function R3Reveal({ view, teams }: { view: V<'r3-reveal'>; teams: Team[] }) {
  const cost = new Map(view.actions.map((a) => [a.id, a.cost]));
  const spent = (id: string) => [...new Set(view.picks[id] ?? [])].reduce((n, p) => n + (cost.get(p) ?? 0), 0);
  return (
    <div className="flex h-full flex-col justify-center gap-[2.4vh]">
      <table className="w-full border-collapse text-[clamp(0.9rem,1.5vw,1.8rem)]">
        <thead>
          <tr className="border-b-2 border-graphite-3 text-left align-bottom text-[clamp(0.75rem,1.1vw,1.3rem)] text-shell-muted">
            <th scope="col" className="py-[0.8vh]">
              Action
            </th>
            <th scope="col" className="text-center">
              Points
            </th>
            {teams.map((t) => (
              <th key={t.id} scope="col" className="text-center font-bold">
                {t.emoji}
                <span className="block text-[0.8em]">{t.name.replace(/^Team /, '')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.actions.map((a) => (
            <tr key={a.id} className="border-b border-graphite-3">
              <td className="py-[1.1vh] pr-[1vw] font-semibold">{a.label}</td>
              <td className="text-center">
                <span className={cn('inline-block rounded-xs px-[0.7vw] py-[0.3vh] font-mono font-extrabold', a.points > 0 ? 'bg-ledger text-white' : 'bg-evidence text-white')}>{a.points > 0 ? `+${a.points}` : `−${Math.abs(a.points)}`}</span>
              </td>
              {teams.map((t) => {
                const picked = (view.picks[t.id] ?? []).includes(a.id);
                return (
                  <td key={t.id} className={cn('text-center text-[1.4em] font-extrabold', picked ? (a.points > 0 ? 'text-[#4cd08b]' : 'text-[#ff7b6b]') : 'text-graphite-3')}>
                    {picked ? '●' : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="font-bold text-shell-muted">
            <td className="py-[1.1vh]">Coins spent</td>
            <td />
            {teams.map((t) => (
              <td key={t.id} className="text-center font-mono text-shell-fg tabular-nums">
                {spent(t.id)} 🪙
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="max-w-[70ch] rounded-xs bg-marker px-[1.6vw] py-[1.4vh] text-[clamp(1rem,1.7vw,2rem)] leading-snug font-semibold text-marker-ink">
        <span className="font-extrabold">The lesson: </span>
        {view.lesson}
      </p>
    </div>
  );
}

function R4Mission({ view }: { view: V<'r4-mission'> }) {
  return (
    <div className="flex h-full flex-col justify-between gap-[3vh]">
      <div className="flex items-end gap-[3vw]">
        <p className="font-mono text-[clamp(3rem,7vw,8rem)] leading-none font-extrabold text-marker">{view.time}</p>
        <h2 className="pb-[0.6vh] text-[clamp(1.8rem,3.8vw,4.4rem)] leading-[1.05] font-extrabold">{view.headline}</h2>
      </div>
      <ol className="grid grid-cols-2 gap-[1.4vw]">
        {view.situations.map((s, i) => (
          <li key={s.id} className="flex items-start gap-[1.2vw] rounded-xs border-l-[0.8vh] border-evidence bg-graphite-2 p-[1.6vw] ring-1 ring-graphite-3">
            <EvidenceMarker n={i + 1} size={44} />
            <span className="text-[clamp(1.1rem,1.9vw,2.3rem)] leading-snug font-semibold">{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="text-[clamp(1.2rem,2.2vw,2.6rem)] font-bold">{view.mission}</p>
    </div>
  );
}

function R4Reveal({ view, teams }: { view: V<'r4-reveal'>; teams: Team[] }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <table className="w-full border-collapse text-[clamp(0.9rem,1.5vw,1.8rem)]">
        <thead>
          <tr className="border-b-2 border-graphite-3 text-left align-bottom text-[clamp(0.75rem,1.1vw,1.3rem)] text-shell-muted">
            <th scope="col" className="py-[0.8vh]">
              Situation and safest action
            </th>
            {teams.map((t) => (
              <th key={t.id} scope="col" className="text-center font-bold">
                {t.emoji}
                <span className="block text-[0.8em]">{t.name.replace(/^Team /, '')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.situations.map((s, i) => (
            <tr key={s.id} className="border-b border-graphite-3">
              <td className="py-[1.4vh] pr-[1.5vw]">
                <span className="flex items-start gap-[1vw]">
                  <EvidenceMarker n={i + 1} size={30} />
                  <span>
                    <span className="block font-semibold">{s.text}</span>
                    <span className="mt-[0.4vh] block font-bold text-[#4cd08b]">→ {s.correctAction}</span>
                  </span>
                </span>
              </td>
              {teams.map((t) => {
                const ok = view.checks[t.id]?.[s.id] === true;
                return (
                  <td key={t.id} className={cn('text-center text-[1.8em] font-extrabold', ok ? 'text-[#4cd08b]' : 'text-[#ff7b6b]')}>
                    <span aria-label={ok ? 'Correct' : 'Missed'}>{ok ? '✓' : '✗'}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tiebreak({ view, teams }: { view: V<'tiebreak'>; teams: Teams }) {
  const winner = view.winnerTeamId ? teams.get(view.winnerTeamId) : undefined;
  return (
    <div className="flex h-full flex-col justify-center gap-[3vh]">
      <div>
        <p className={EYEBROW}>Level on points</p>
        <h2 className={cn(H1, 'mt-[1vh]')}>Tie-breaker!</h2>
      </div>
      <ul className="flex flex-wrap gap-[1vw]">
        {view.tiedTeamIds.map((id) => (
          <li key={id} className={cn('rounded-xs px-[1.4vw] py-[1.2vh] text-[clamp(1.1rem,2.1vw,2.5rem)] font-bold ring-1', winner?.id === id ? 'bg-marker text-marker-ink ring-marker' : 'bg-graphite-2 ring-graphite-3')}>
            <TeamLabel team={teams.get(id)} />
          </li>
        ))}
      </ul>
      <p className="max-w-[40ch] text-[clamp(1.4rem,2.8vw,3.3rem)] leading-tight font-bold">{view.question}</p>
      <p className="text-[clamp(0.9rem,1.4vw,1.6rem)] text-shell-muted">{view.rule}</p>
      {view.expected ? (
        <div className="flex flex-col gap-[1.2vh] rounded-xs bg-graphite-2 p-[1.6vw] ring-1 ring-graphite-3" data-testid="tiebreak-answer">
          <ul className="flex flex-col gap-[0.8vh] text-[clamp(1rem,1.7vw,2rem)]">
            {view.expected.map((e) => (
              <li key={e} className="flex gap-[0.8vw]">
                <span aria-hidden className="font-extrabold text-[#4cd08b]">
                  ✓
                </span>
                {e}
              </li>
            ))}
          </ul>
          {winner ? (
            <p className="text-[clamp(1.2rem,2.2vw,2.6rem)] font-extrabold text-marker">
              Winner: <TeamLabel team={winner} />
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const CONFETTI = ['#f2c230', '#1e7f4f', '#c0392b', '#eceee9'];

function Final({ view, display, team }: { view: V<'final'>; display: PublicGameDisplay; team?: Team }) {
  const total = display.scoreboard.find((r) => r.teamId === view.championTeamId)?.totals.total;
  return (
    <div className="relative flex h-full flex-col justify-center gap-[3vh] overflow-hidden">
      {team ? (
        <div className="cs-confetti" aria-hidden>
          {Array.from({ length: 36 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 97) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 9) * 0.35}s`, animationDuration: `${4 + (i % 5)}s` }} />
          ))}
        </div>
      ) : null}
      {team ? (
        <div data-testid="champion" className="relative">
          <p className={EYEBROW}>🏆 {view.championTitle}</p>
          <h2 className="cs-pop mt-[1vh] text-[clamp(3rem,7.4vw,8.5rem)] leading-none font-extrabold tracking-[-0.025em]">
            <span className="mr-[0.25em]">{team.emoji}</span>
            {team.name}
          </h2>
          <p className="mt-[1.4vh] text-[clamp(1.4rem,2.8vw,3.3rem)] font-bold text-marker">{total} points</p>
        </div>
      ) : (
        <div data-testid="champion-tie" className="relative">
          <p className={EYEBROW}>{view.championTitle}</p>
          <h2 className={cn(H1, 'mt-[1vh]')}>It’s a tie! Tie-breaker next</h2>
        </div>
      )}
      <div className="relative">
        <ScoreTable display={display} highlightId={view.championTeamId} />
      </div>
    </div>
  );
}

/** CSS-only motion, switched on only when the viewer has not asked for reduced motion. */
export function DisplayStyles() {
  return (
    <style>{`
      .cs-confetti { position:absolute; inset:0; pointer-events:none; }
      .cs-confetti span { position:absolute; top:-3vh; width:0.9vw; height:1.6vh; opacity:0; }
      @media (prefers-reduced-motion: no-preference) {
        @keyframes cs-fall { 0% { transform: translateY(0) rotate(0); opacity:1 } 100% { transform: translateY(110vh) rotate(540deg); opacity:1 } }
        @keyframes cs-pop { 0% { transform: scale(.85); opacity:0 } 60% { transform: scale(1.04) } 100% { transform: scale(1); opacity:1 } }
        @keyframes cs-pulse { 0%,100% { box-shadow: 0 0 0 0 rgb(192 57 43 / .55) } 50% { box-shadow: 0 0 0 1.6vh rgb(192 57 43 / 0) } }
        @keyframes cs-urgent { 0%,100% { opacity:1 } 50% { opacity:.8 } }
        .cs-confetti span { animation: cs-fall linear infinite; }
        .cs-pop { animation: cs-pop .8s ease-out both; }
        .cs-alert { animation: cs-pulse 1.6s ease-in-out infinite; }
        .cs-urgent { animation: cs-urgent 1s ease-in-out infinite; }
      }
      @media (prefers-reduced-motion: reduce) { .cs-confetti { display:none; } }
    `}</style>
  );
}
