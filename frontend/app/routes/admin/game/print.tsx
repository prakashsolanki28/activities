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
  { id: 'scoreboard', label: 'Host scoreboard' },
  { id: 'certificate', label: 'Certificate' },
] as const;
type SheetId = (typeof SHEETS)[number]['id'];

const PAGE = 'break-after-page break-inside-avoid last:break-after-auto';

/** Printable answer cards, blank scoreboard and the champion certificate. Sits outside the admin layout so it prints clean. */
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

const CELL = 'border border-ink-3 h-[8mm] text-center';
const TH = 'border border-ink-3 bg-ground px-[2mm] py-[1.5mm] text-[9pt] font-bold text-ink';

function Scoreboard({ game }: { game: AdminGame }) {
  const c = game.content;
  const max = roundMax(c);
  const heading = (t: string) => <h3 className="mt-[5mm] mb-[2mm] text-[12pt] font-extrabold text-ink">{t}</h3>;
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
              <th key={ch.id} className={cn(TH, 'px-[1mm]')}>
                {c.r1.challenges.length > 8 ? i + 1 : `Challenge ${i + 1}`}
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
              <td key={ch.id} className="border border-ink-3 bg-ground px-[1mm] py-[1.5mm] text-center text-[9pt] font-bold text-ink-2">
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

      {heading(`Round 2: ${c.r2.title} marks (out of ${c.r2.maxMarks})`)}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {game.teams.map((t) => (
              <th key={t.id} className={cn(TH, 'px-[1mm]')}>
                {t.emoji}
                <span className="block text-[8pt]">{t.name.replace(/^Team /, '')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {game.teams.map((t) => (
              <td key={t.id} className="h-[8mm] border border-ink-3" />
            ))}
          </tr>
        </tbody>
      </table>

      {heading(`Round 3: Cyber Coins (budget ${c.r3.budget})`)}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(TH, 'text-left')}>Action</th>
            <th className={TH}>Cost</th>
            {game.teams.map((t) => (
              <th key={t.id} className={cn(TH, 'px-[1mm]')}>
                {t.emoji}
                <span className="block text-[8pt]">{t.name.replace(/^Team /, '')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.r3.actions.map((a, i) => (
            <tr key={a.id}>
              <th scope="row" className="border border-ink-3 px-[2mm] py-[1mm] text-left text-[8.5pt] leading-tight font-semibold text-ink">
                {String.fromCharCode(65 + i)}. {a.label}
              </th>
              <td className="border border-ink-3 bg-ground px-[2mm] text-center font-mono text-[9pt]">{a.cost}</td>
              {game.teams.map((t) => (
                <td key={t.id} className="h-[7mm] border border-ink-3 text-center" />
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="border border-ink-3 bg-ground px-[2mm] py-[1mm] text-left text-[9pt] font-bold text-ink">
              Coins spent (of {c.r3.budget})
            </th>
            <td className="border border-ink-3 bg-ground" />
            {game.teams.map((t) => (
              <td key={t.id} className="h-[7mm] border border-ink-3 bg-ground" />
            ))}
          </tr>
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
      // Landscape like the certificate itself: a portrait sheet would spill onto a second page.
      <Paper landscape className="flex items-center justify-center">
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
