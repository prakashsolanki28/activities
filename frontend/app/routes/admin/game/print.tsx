import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { CARD_CHOICES, CARD_LABELS, champion, rankTeams, roundMax, type AdminGame } from '@hrrl/shared';
import { CisoLockup, HrrlLockup } from '~/components/brand';
import { CARD_META } from '~/components/game/card-meta';
import { Button } from '~/components/ui/button';
import { ApiError, errorMessage } from '~/lib/api';
import { useAdminTheme } from '~/lib/admin-theme';
import { formatDate } from '~/lib/format';
import { useGame } from '~/lib/game-api';
import { cn } from '~/lib/utils';
import type { Route } from './+types/print';

export const meta: Route.MetaFunction = () => [{ title: 'Print · HRRL Activities' }];

const SHEETS = [
  { id: 'cards', label: 'Team cards' },
  { id: 'scenarios', label: 'Scenario cards' },
  { id: 'scoreboard', label: 'Host scoreboard' },
  { id: 'certificate', label: 'Certificate' },
] as const;
type SheetId = (typeof SHEETS)[number]['id'];

const PAGE = 'break-after-page break-inside-avoid last:break-after-auto';

/** Printable cards, scenario cards, blank scoreboard and the champion certificate. Sits outside the admin layout so it prints clean. */
export default function GamePrint() {
  useAdminTheme();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const raw = params.get('sheet');
  const sheet: SheetId = SHEETS.some((s) => s.id === raw) ? (raw as SheetId) : 'cards';
  const q = useGame(id);

  const toolbar = (
    <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-2 print:hidden">
      <Button asChild variant="outline" size="sm">
        <Link to={`/admin/games/${id}`}>
          <ArrowLeft /> Back to game
        </Link>
      </Button>
      <nav className="flex flex-1 flex-wrap gap-1" aria-label="Sheets">
        {SHEETS.map((s) => (
          <Button key={s.id} asChild variant={s.id === sheet ? 'default' : 'ghost'} size="sm">
            <Link to={`?sheet=${s.id}`} replace aria-current={s.id === sheet ? 'page' : undefined}>
              {s.label}
            </Link>
          </Button>
        ))}
      </nav>
      <Button size="sm" onClick={() => window.print()}>
        <Printer /> Print
      </Button>
    </div>
  );

  if (q.error) {
    const signedOut = q.error instanceof ApiError && q.error.status === 401;
    return (
      <div className="min-h-dvh bg-ground-2 p-6" data-sheet="error">
        <div className="mx-auto max-w-lg rounded-xs bg-surface p-6 ring-1 ring-line">
          {signedOut ? (
            <>
              <h1 className="text-xl font-bold text-ink">Sign in to print</h1>
              <p className="mt-2 text-ink-2">You need to be signed in as an admin to print game sheets.</p>
              <Button asChild className="mt-4">
                <Link to={`/admin/login?next=${encodeURIComponent(location.pathname + location.search)}`}>Sign in</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-ink">Could not load the game</h1>
              <p className="mt-2 text-ink-2">{errorMessage(q.error)}</p>
            </>
          )}
        </div>
      </div>
    );
  }
  if (!q.data) return <div className="min-h-dvh bg-ground-2" aria-busy="true" />;

  const game = q.data;
  const landscape = sheet === 'certificate';
  return (
    <div className="min-h-dvh bg-ground-2 px-4 py-6 print:bg-white print:p-0" data-sheet={sheet}>
      <style>{`
        @page { size: ${landscape ? 'A4 landscape' : 'A4'}; margin: 12mm; }
        @media print { html, body { background: #fff !important; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      `}</style>
      {toolbar}
      {sheet === 'cards' ? <Cards game={game} /> : null}
      {sheet === 'scenarios' ? <Scenarios game={game} /> : null}
      {sheet === 'scoreboard' ? <Scoreboard game={game} /> : null}
      {sheet === 'certificate' ? <Certificate game={game} /> : null}
    </div>
  );
}

/** A sheet of paper: on screen a white card, in print just the page. */
function Paper({ children, className, landscape }: { children: React.ReactNode; className?: string; landscape?: boolean }) {
  return (
    <section
      className={cn(
        'mx-auto mb-6 bg-surface p-[10mm] shadow-plate print:mb-0 print:p-0 print:shadow-none',
        landscape ? 'w-[297mm] max-w-full print:h-[186mm] print:w-[273mm]' : 'w-[210mm] max-w-full print:h-[272mm] print:w-[186mm]',
        PAGE,
        className,
      )}
    >
      {children}
    </section>
  );
}

function Cards({ game }: { game: AdminGame }) {
  return (
    <>
      {game.teams.map((t) => (
        <Paper key={t.id} className="flex flex-col gap-[5mm]">
          <header className="flex items-center justify-between border-b-2 border-ink pb-[3mm]">
            <h2 className="text-[26pt] leading-none font-extrabold text-ink">
              <span className="mr-[3mm]">{t.emoji}</span>
              {t.name}
            </h2>
            <span className="text-[11pt] font-semibold text-ink-3">{game.title} · Answer cards</span>
          </header>
          {CARD_CHOICES.map((c) => {
            const m = CARD_META[c];
            return (
              <div key={c} className={cn('flex flex-1 items-center justify-center gap-[8mm] rounded-[3mm] border-[2.2mm] bg-white', m.border, m.borderStyle)}>
                <span aria-hidden className={cn('text-[70pt] leading-none font-extrabold', m.text)}>
                  {m.symbol}
                </span>
                <span className={cn('text-[52pt] leading-none font-extrabold tracking-[0.02em] uppercase', m.text)}>{CARD_LABELS[c]}</span>
              </div>
            );
          })}
        </Paper>
      ))}
    </>
  );
}

function Scenarios({ game }: { game: AdminGame }) {
  const cards = game.content.r2.cards;
  const pages: (typeof cards)[] = [];
  for (let i = 0; i < cards.length; i += 2) pages.push(cards.slice(i, i + 2));
  return (
    <>
      {pages.map((pair, p) => (
        <Paper key={p} className="flex flex-col">
          {pair.map((c, i) => (
            <article key={c.id} className={cn('flex flex-1 flex-col gap-[3mm] py-[4mm]', i > 0 && 'border-t-[0.5mm] border-dashed border-ink-3')}>
              {i > 0 ? <p className="-mt-[7mm] mb-[1mm] text-center text-[8pt] text-ink-3 select-none">✂ cut here</p> : null}
              <div className="flex items-start gap-[5mm]">
                <span className="flex size-[22mm] shrink-0 items-center justify-center rounded-[3mm] border-[1.2mm] border-ink text-[40pt] leading-none font-extrabold text-ink">{c.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9pt] font-bold tracking-[0.12em] text-ink-3 uppercase">Round 2 · Secret scenario</p>
                  <h2 className="text-[22pt] leading-tight font-extrabold text-ink">{c.title}</h2>
                </div>
                <p className="shrink-0 rounded-[2mm] border-[0.6mm] border-evidence px-[3mm] py-[1.5mm] text-[9pt] font-extrabold text-evidence uppercase">Do not show this card to your team</p>
              </div>
              <p className="text-[13pt] leading-snug text-ink">
                <strong>Act this out: </strong>
                {c.brief}
              </p>
              <p className="text-[11pt] leading-snug text-ink-2">
                <strong>Team task: </strong>
                {c.teamTask}
              </p>
              <p className="mt-auto text-[9pt] leading-snug text-ink-3">{game.content.r2.safetyNote}</p>
            </article>
          ))}
        </Paper>
      ))}
    </>
  );
}

const CELL = 'border border-ink-3 h-[11mm] text-center';
const TH = 'border border-ink-3 bg-ground px-[2mm] py-[1.5mm] text-[9pt] font-bold text-ink';

function Scoreboard({ game }: { game: AdminGame }) {
  const c = game.content;
  const max = roundMax(c);
  const heading = (t: string) => <h3 className="mt-[7mm] mb-[2mm] text-[12pt] font-extrabold text-ink">{t}</h3>;
  const teamCell = (t: AdminGame['teams'][number]) => (
    <th scope="row" className="border border-ink-3 px-[2mm] text-left text-[11pt] font-bold whitespace-nowrap text-ink">
      {t.emoji} {t.name}
    </th>
  );
  return (
    <Paper>
      <header className="flex items-end justify-between border-b-2 border-ink pb-[2mm]">
        <h2 className="text-[20pt] font-extrabold text-ink">{game.title}: host scoreboard</h2>
        <span className="font-mono text-[10pt] text-ink-3">Code {game.code}</span>
      </header>

      {heading('Scores')}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH} />
            {[`R1 / ${max.r1}`, `R2 / ${max.r2}`, `R3 / ${max.r3}`, `R4 / ${max.r4}`, `Total / ${max.total}`].map((h) => (
              <th key={h} className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {game.teams.map((t) => (
            <tr key={t.id}>
              {teamCell(t)}
              {[0, 1, 2, 3, 4].map((i) => (
                <td key={i} className={cn(CELL, i === 4 && 'bg-ground')} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {heading('Round 1: cards held up (write S, D or V)')}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH} />
            {c.r1.challenges.map((ch, i) => (
              <th key={ch.id} className={TH}>
                Challenge {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="border border-ink-3 bg-ground px-[2mm] text-left text-[9pt] font-bold text-ink-2">
              Answer key
            </th>
            {c.r1.challenges.map((ch) => (
              <td key={ch.id} className="border border-ink-3 bg-ground py-[1.5mm] text-center text-[10pt] font-bold text-ink-2">
                {CARD_LABELS[ch.answer]}
              </td>
            ))}
          </tr>
          {game.teams.map((t) => (
            <tr key={t.id}>
              {teamCell(t)}
              {c.r1.challenges.map((ch) => (
                <td key={ch.id} className={CELL} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {heading(`Round 3: Cyber Coins (budget ${c.r3.budget})`)}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={TH} />
            {c.r3.actions.map((a, i) => (
              <th key={a.id} className={cn(TH, 'max-w-[26mm] align-bottom text-[8pt]')}>
                {String.fromCharCode(65 + i)}. {a.label}
                <span className="block font-mono">{a.cost} coins</span>
              </th>
            ))}
            <th className={TH}>Spent</th>
          </tr>
        </thead>
        <tbody>
          {game.teams.map((t) => (
            <tr key={t.id}>
              {teamCell(t)}
              {c.r3.actions.map((a) => (
                <td key={a.id} className={CELL} />
              ))}
              <td className={cn(CELL, 'bg-ground')} />
            </tr>
          ))}
        </tbody>
      </table>
    </Paper>
  );
}

function Certificate({ game }: { game: AdminGame }) {
  const ranked = rankTeams(game.content, game.teams, game.scores);
  const win = champion(ranked);
  if (!win) {
    return (
      <Paper className="flex items-center justify-center">
        <p className="max-w-[40ch] text-center text-[14pt] font-semibold text-ink-2">Finish the game (and any tie-breaker) to print the certificate.</p>
      </Paper>
    );
  }
  const total = ranked.find((r) => r.team.id === win.id)?.totals.total ?? 0;
  const max = roundMax(game.content).total;
  return (
    <Paper landscape className="flex flex-col border-[1.5mm] border-ink p-0 print:p-0">
      <header className="flex items-center justify-between border-b border-line-strong px-[12mm] py-[7mm]">
        <HrrlLockup className="h-[16mm] w-auto" />
        <span className="text-center">
          <span className="block text-[13pt] font-bold text-ink">Certificate of achievement</span>
          <span className="block text-[10pt] text-ink-3">Cybersecurity Awareness</span>
        </span>
        <CisoLockup className="h-[12mm] w-auto" />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-[5mm] px-[16mm] text-center">
        <p className="text-[13pt] font-bold tracking-[0.12em] text-ink-3 uppercase">🏆 {game.content.championTitle}</p>
        <h1 className="text-[48pt] leading-none font-extrabold tracking-[-0.02em] text-ink">
          <span className="mr-[4mm]">{win.emoji}</span>
          {win.name}
        </h1>
        <p className="text-[18pt] font-semibold text-ink-2">
          {total} of {max} points
        </p>
      </div>
      <footer className="flex items-end justify-between border-t border-line-strong px-[12mm] py-[6mm] text-[10pt] text-ink-3">
        <span>
          <strong className="text-ink-2">{game.title}</strong> · Code <span className="font-mono">{game.code}</span>
        </span>
        <span>{formatDate(new Date().toISOString())}</span>
      </footer>
    </Paper>
  );
}
