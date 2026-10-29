import type { CardChoice, DisplayView, PublicGameDisplay, Team } from '@hrrl/shared';
import { CARD_CHOICES, CARD_LABELS } from '@hrrl/shared';
import { EvidenceMarker } from '~/components/evidence/marker';
import { cn } from '~/lib/utils';
import { CARD_META } from './card-meta';
import { ScoreTable } from './score-table';

type V<K extends DisplayView['kind']> = Extract<DisplayView, { kind: K }>;
type Teams = Map<string, Team>;

const VH = 0.5625; // 1vh expressed in vw on a 16:9 screen

/**
 * Largest font size (in vw) at which `lens` (one text block per entry, each wrapping inside `wVw` wide) fit in `hVh`
 * of height, never larger than `std`. Solves a*f^2 + b*f = H, where a is the wrapped-text area per unit of font size
 * and b the per-block padding/leading. Short standard content hits `std`, so only long content shrinks.
 */
function fitVw(lens: number[], wVw: number, hVh: number, std: number, gap = 0.7) {
  const H = hVh * VH;
  const a = (lens.reduce((n, l) => n + l + 14, 0) * 0.47 * 1.2) / wVw;
  const b = lens.length * gap;
  const f = a > 0 ? (-b + Math.sqrt(b * b + 4 * a * H)) / (2 * a) : std;
  return Math.max(Math.min(f, std), 0.5);
}

/** Font-size style for a size from `fitVw`, bounded by the viewport height as well as its width. */
const sizeStyle = (f: number, minRem = 0.6) => ({ fontSize: `clamp(${minRem}rem, min(${f.toFixed(3)}vw, ${(f / VH).toFixed(3)}vh), 5rem)` });

const maxLen = (xs: string[]) => xs.reduce((n, x) => Math.max(n, x.length), 0);

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
    case 'r2-mime':
      return <R2Mime view={v} />;
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
      {/* Round 2 has no rules: its slide shows only the round's own text. */}
      {view.rules.length ? (
        <ul className="flex flex-wrap gap-[1vw]">
          {view.rules.map((r) => (
            <li key={r} className="rounded-xs bg-marker px-[1.4vw] py-[1.2vh] text-[clamp(1rem,1.8vw,2.1rem)] font-bold text-marker-ink">
              {r}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Swatch({ choice, state }: { choice: CardChoice; state: 'plain' | 'win' | 'dim' }) {
  const m = CARD_META[choice];
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-center gap-[0.8vw] rounded-xs px-[1vw] py-[1.4vh] text-[clamp(1.1rem,2.4vw,2.8rem)] font-extrabold uppercase transition-all',
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
  const sitLen = view.situation.length;
  const sitSize = sizeStyle(fitVw([sitLen], 88, open ? 15 : 34, open ? 3 : 4.4, 0), 1);
  const expLen = (view.explanation ?? '').length;
  const expSize = sizeStyle(fitVw([expLen], 90, 15, 1.8, 0), 0.8);
  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-[2vh]">
      <div className="flex min-h-0 flex-col gap-[2vh]">
        <p className={EYEBROW}>
          Challenge {view.number} / {view.total}
        </p>
        <p className={cn('leading-[1.1] font-extrabold tracking-[-0.015em]', sitLen <= 110 && 'max-w-[28ch]')} style={sitSize} data-testid="situation">
          {view.situation}
        </p>
        {open ? (
          <div className="flex flex-col gap-[2vh]" data-testid="r1-answer">
            <p className={cn('leading-snug', expLen <= 200 && 'max-w-[60ch]')} style={expSize}>
              {view.explanation}
            </p>
            <ul className="flex flex-wrap gap-[0.8vw] text-[clamp(0.8rem,1.5vw,1.8rem)]">
              {Object.entries(view.teamAnswers ?? {}).map(([id, choice]) => {
                const t = teams.get(id);
                const right = choice === view.answer;
                return (
                  <li key={id} className="flex items-center gap-[0.7vw] rounded-xs bg-graphite-2 px-[1vw] py-[0.9vh] text-[1em] ring-1 ring-graphite-3">
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

function R2Mime({ view }: { view: V<'r2-mime'> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-[4vh]" data-testid="r2-mime">
      <p className={EYEBROW}>Round 2</p>
      <h1 className="text-[clamp(3.2rem,8.4vw,9.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em] uppercase">{view.headline}</h1>
      <p className="max-w-[24ch] text-[clamp(1.6rem,3.6vw,4.2rem)] leading-tight font-bold text-shell-muted">{view.slogan}</p>
    </div>
  );
}

function R3Auction({ view }: { view: V<'r3-auction'> }) {
  const n = view.actions.length;
  const cols = n > 4 ? 2 : 1;
  const rows = Math.ceil(n / cols);
  const actionFont = sizeStyle(fitVw(Array(rows).fill(maxLen(view.actions.map((a) => a.label))), cols === 2 ? 28 : 70, 36, 1.9, 0.5), 0.6);
  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-[2vh]">
      <div className="flex items-end justify-between gap-[3vw]">
        <div>
          <p className={EYEBROW}>{view.scenario.title}</p>
          <p className="mt-[1vh] max-w-[34ch] text-[clamp(1.3rem,2.7vw,3.2rem)] leading-[1.1] font-extrabold">{view.scenario.text}</p>
        </div>
        <p className="shrink-0 rounded-xs bg-marker px-[1.6vw] py-[1.2vh] text-[clamp(1.1rem,2.2vw,2.6rem)] font-extrabold text-marker-ink">Budget: {view.budget} Cyber Coins</p>
      </div>
      <ul
        className={cn('grid min-h-0 flex-1 gap-[1.2vh] [grid-auto-rows:1fr]', cols === 2 ? 'grid-cols-2 gap-x-[1.2vw]' : 'grid-cols-1')}
        style={actionFont}
        aria-label="Actions for auction"
      >
        {view.actions.map((a, i) => (
          <li key={a.id} className="flex items-center gap-[0.8em] overflow-hidden rounded-xs bg-graphite-2 px-[0.7em] ring-1 ring-graphite-3">
            <span className="flex size-[1.9em] shrink-0 items-center justify-center rounded-full bg-graphite-3 font-mono text-[0.85em] font-bold">{String.fromCharCode(65 + i)}</span>
            <span className="min-w-0 flex-1 text-[1em] leading-tight font-semibold">{a.label}</span>
            <span className="shrink-0 font-mono text-[1.05em] font-extrabold text-marker tabular-nums">{a.cost} 🪙</span>
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
  const labelW = 92 - 7 - teams.length * 6;
  const tableFont = sizeStyle(fitVw([...view.actions.map((a) => a.label.length), 6, 12], labelW, 52, 1.5, 1.1), 0.6);
  const lessonFont = sizeStyle(fitVw([view.lesson.length + 12], 84, 12, 1.4, 1), 0.6);
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-[1.4vh]">
      <table className="w-full border-collapse" style={tableFont}>
        <thead>
          <tr className="border-b-2 border-graphite-3 text-left align-bottom text-[0.75em] text-shell-muted">
            <th scope="col" className="py-[0.3em]">
              Action
            </th>
            <th scope="col" className="w-[7vw] text-center">
              Points
            </th>
            {teams.map((t) => (
              <th key={t.id} scope="col" className="w-[6vw] text-center font-bold">
                {t.emoji}
                <span className="block text-[0.8em]">{t.name.replace(/^Team /, '')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.actions.map((a) => (
            <tr key={a.id} className="border-b border-graphite-3">
              <td className="py-[0.25em] pr-[1vw] leading-tight font-semibold">{a.label}</td>
              <td className="text-center">
                <span className={cn('inline-block rounded-xs px-[0.5em] font-mono font-extrabold', a.points > 0 ? 'bg-ledger text-white' : a.points < 0 ? 'bg-evidence text-white' : 'bg-graphite-3 text-shell-fg')}>
                  {a.points > 0 ? `+${a.points}` : a.points < 0 ? `−${Math.abs(a.points)}` : '0'}
                </span>
              </td>
              {teams.map((t) => {
                const picked = (view.picks[t.id] ?? []).includes(a.id);
                return (
                  <td key={t.id} className={cn('text-center leading-none font-extrabold', picked ? (a.points > 0 ? 'text-[#4cd08b]' : a.points < 0 ? 'text-[#ff7b6b]' : 'text-shell-muted') : 'text-graphite-3')}>
                    {picked ? '●' : '·'}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="font-bold text-shell-muted">
            <td className="py-[0.25em]">Coins spent</td>
            <td />
            {teams.map((t) => (
              <td key={t.id} className="text-center font-mono text-shell-fg tabular-nums">
                {spent(t.id)} 🪙
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="rounded-xs bg-marker px-[1.6vw] py-[0.8vh] leading-snug font-semibold text-marker-ink" style={lessonFont}>
        <span className="font-extrabold">The lesson: </span>
        {view.lesson}
      </p>
    </div>
  );
}

function R4Mission({ view }: { view: V<'r4-mission'> }) {
  const rows = Math.ceil(view.situations.length / 2);
  const itemFont = sizeStyle(fitVw(Array(rows).fill(maxLen(view.situations.map((s) => s.text))), 33, 36, 1.9, 0.5), 0.6);
  return (
    <div className="flex h-full min-h-0 flex-col justify-between gap-[2vh]">
      <div className="flex items-end gap-[3vw]">
        <p className="font-mono text-[clamp(2.4rem,5.4vw,6.4rem)] leading-none font-extrabold text-marker">{view.time}</p>
        <h2 className="pb-[0.6vh] text-[clamp(1.5rem,3.2vw,3.8rem)] leading-[1.05] font-extrabold">{view.headline}</h2>
      </div>
      <ol className="grid min-h-0 flex-1 grid-cols-2 [grid-auto-rows:1fr] gap-[1.2vw]" style={itemFont}>
        {view.situations.map((s, i) => (
          <li key={s.id} className="flex items-center gap-[0.8em] overflow-hidden rounded-xs border-l-[0.8vh] border-evidence bg-graphite-2 px-[0.8em] ring-1 ring-graphite-3">
            <EvidenceMarker n={i + 1} size={36} />
            <span className="leading-tight font-semibold">{s.text}</span>
          </li>
        ))}
      </ol>
      <p className="text-[clamp(1rem,2vw,2.4rem)] leading-tight font-bold" style={sizeStyle(fitVw([view.mission.length], 90, 8, 2, 0), 0.8)}>
        {view.mission}
      </p>
    </div>
  );
}

function R4Reveal({ view, teams }: { view: V<'r4-reveal'>; teams: Team[] }) {
  const many = view.situations.length > 6;
  const tick = (t: Team, sid: string) => view.checks[t.id]?.[sid] === true;
  if (many) {
    const rows = Math.ceil(view.situations.length / 2);
    const rowLen = Math.max(...view.situations.map((s) => s.text.length + s.correctAction.length));
    const font = sizeStyle(fitVw(Array(rows).fill(rowLen), 36, 62, 1.5, 2.6), 0.55);
    return (
      <ol className="grid h-full min-h-0 grid-cols-2 [grid-auto-rows:1fr] gap-x-[1.6vw] gap-y-[0.9vh]" style={font}>
        {view.situations.map((s, i) => (
          <li key={s.id} className="flex min-h-0 items-start gap-[0.6em] overflow-hidden rounded-xs bg-graphite-2 px-[0.6em] py-[0.35em] ring-1 ring-graphite-3">
            <EvidenceMarker n={i + 1} size={24} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block font-semibold">{s.text}</span>
              <span className="block font-bold text-[#4cd08b]">→ {s.correctAction}</span>
              <span className="mt-[0.2em] flex flex-wrap gap-x-[0.7em] text-[0.8em] leading-tight font-bold">
                {teams.map((t) => (
                  <span key={t.id} className={tick(t, s.id) ? 'text-[#4cd08b]' : 'text-[#ff7b6b]'} aria-label={`${t.name} ${tick(t, s.id) ? 'correct' : 'missed'}`}>
                    {t.emoji}
                    {tick(t, s.id) ? '✓' : '✗'}
                  </span>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ol>
    );
  }
  const textW = 92 - 4 - teams.length * 6;
  const font = sizeStyle(fitVw([...view.situations.map((s) => s.text.length + s.correctAction.length), 12], textW, 58, 1.5, 0.9), 0.6);
  return (
    <div className="flex h-full min-h-0 flex-col justify-center">
      <table className="w-full border-collapse" style={font}>
        <thead>
          <tr className="border-b-2 border-graphite-3 text-left align-bottom text-[0.75em] text-shell-muted">
            <th scope="col" className="py-[0.3em]">
              Situation and safest action
            </th>
            {teams.map((t) => (
              <th key={t.id} scope="col" className="w-[6vw] text-center font-bold">
                {t.emoji}
                <span className="block text-[0.8em]">{t.name.replace(/^Team /, '')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.situations.map((s, i) => (
            <tr key={s.id} className="border-b border-graphite-3">
              <td className="py-[0.3em] pr-[1.5vw]">
                <span className="flex items-start gap-[0.7em]">
                  <EvidenceMarker n={i + 1} size={28} />
                  <span className="leading-tight">
                    <span className="block font-semibold">{s.text}</span>
                    <span className="block font-bold text-[#4cd08b]">→ {s.correctAction}</span>
                  </span>
                </span>
              </td>
              {teams.map((t) => {
                const ok = tick(t, s.id);
                return (
                  <td key={t.id} className={cn('text-center leading-none font-extrabold', ok ? 'text-[#4cd08b]' : 'text-[#ff7b6b]')}>
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
  const revealed = !!view.expected;
  const qFont = sizeStyle(fitVw([view.question.length], revealed ? 44 : 78, revealed ? 32 : 24, revealed ? 2.8 : 2.8, 0), 0.8);
  const aLens = (view.expected ?? []).map((e) => e.length);
  const aFont = sizeStyle(fitVw(aLens, 40, 28, 1.7, 0.8), 0.6);
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-[2.4vh]">
      <div>
        <p className={EYEBROW}>Level on points</p>
        <h2 className={cn(H1, 'mt-[1vh]', revealed && 'text-[clamp(1.8rem,3.6vw,4rem)]')}>Tie-breaker!</h2>
      </div>
      <ul className="flex flex-wrap gap-[1vw]">
        {view.tiedTeamIds.map((id) => (
          <li key={id} className={cn('rounded-xs px-[1.4vw] py-[1vh] text-[clamp(1rem,2.1vw,2.5rem)] font-bold ring-1', winner?.id === id ? 'bg-marker text-marker-ink ring-marker' : 'bg-graphite-2 ring-graphite-3')}>
            <TeamLabel team={teams.get(id)} />
          </li>
        ))}
      </ul>
      <div className={cn('grid min-h-0 gap-[2vw]', revealed ? 'grid-cols-2' : 'grid-cols-1')}>
        <div className="min-w-0">
          <p className={cn('leading-tight font-bold', !revealed && 'max-w-[40ch]')} style={qFont}>
            {view.question}
          </p>
          <p className="mt-[1.4vh] text-[clamp(0.8rem,1.4vw,1.6rem)] text-shell-muted">{view.rule}</p>
        </div>
        {view.expected ? (
          <div className="flex min-w-0 flex-col gap-[1vh] self-start rounded-xs bg-graphite-2 p-[1.2vw] ring-1 ring-graphite-3" data-testid="tiebreak-answer">
            <ul className="flex flex-col gap-[0.6vh] leading-snug" style={aFont}>
              {view.expected.map((e) => (
                <li key={e} className="flex gap-[0.6em]">
                  <span aria-hidden className="font-extrabold text-[#4cd08b]">
                    ✓
                  </span>
                  {e}
                </li>
              ))}
            </ul>
            {winner ? (
              <p className="text-[clamp(1.1rem,2.2vw,2.6rem)] font-extrabold text-marker">
                Winner: <TeamLabel team={winner} />
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
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
