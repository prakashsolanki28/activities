import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Phone, Quote } from 'lucide-react';
import type { Route } from './+types/home';
import { EvidenceMarker } from '~/components/evidence/marker';
import { PaperTag } from '~/components/evidence/tags';
import { PublicFooter, PublicHeader } from '~/components/play/public-shell';
import { Button } from '~/components/ui/button';
import {
  firstWeekday,
  formatLessonDay,
  LESSONS,
  MONTH,
  monthState,
  STEPS,
  stepNumber,
  type Lesson,
  type MonthState,
} from '~/lib/awareness-month';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [
  { title: 'Cyber Security Awareness Month 2026 · HRRL Activities' },
  { name: 'description', content: 'National Cyber Security Awareness Month, October 2026: one lesson a day from the HRRL CISO Office.' },
];

const DAYS = Array.from({ length: MONTH.days }, (_, i) => i + 1);
const WEEKDAYS = [
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
  ['Sun', 'Sunday'],
] as const;
const WEEKS: (number | null)[][] = (() => {
  const cells = [...Array<null>(firstWeekday).fill(null), ...DAYS];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
})();

/** Today in India time, re-checked every minute so a lobby screen rolls over at midnight. */
function useMonthState(): MonthState {
  const [state, setState] = useState(() => monthState());
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = monthState();
      setState((s) => (s.phase === next.phase && s.today === next.today ? s : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return state;
}

export default function Home() {
  const month = useMonthState();
  const [picked, setPicked] = useState<number | null>(null);
  const day = picked !== null && picked <= month.today ? picked : Math.max(1, month.today);

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <PublicHeader />
      <main className="flex-1">
        <section aria-labelledby="month-title" className="on-shell relative isolate overflow-hidden bg-graphite text-shell-fg">
          <img
            src="/campaign/refinery-1600.webp"
            srcSet="/campaign/refinery-960.webp 960w, /campaign/refinery-1600.webp 1600w, /campaign/refinery-2560.webp 2560w"
            sizes="100vw"
            width={2560}
            height={1440}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-20 size-full object-cover object-[60%_38%]"
          />
          {/* Graphite scrim: dense behind the heading, thinning so the refinery stays in view on the right. */}
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(26_28_30/0.9)_0%,rgb(26_28_30/0.74)_48%,rgb(26_28_30/0.4)_100%)]" />
          <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-28 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-12 lg:pt-20 lg:pb-36">
            <div className="min-w-0">
              <h1
                id="month-title"
                className="max-w-[16ch] text-[2rem] leading-[1.08] font-extrabold tracking-[-0.02em] text-balance text-white sm:text-5xl lg:text-[3.5rem]"
              >
                National Cyber Security Awareness Month
              </h1>
              <p className="mt-4 text-[17px] leading-7 text-shell-fg">October 2026 · HRRL CISO Office</p>
              <MonthTrack month={month} />
            </div>
            <DayCount month={month} />
          </div>
        </section>

        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <section
            aria-label="Lessons of the month"
            className="relative -mt-20 grid rounded-xs bg-surface shadow-plate ring-1 ring-line-strong lg:-mt-24 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
          >
            <LessonPanel day={day} month={month} onPick={setPicked} />
            <MonthGrid day={day} month={month} onPick={setPicked} />
          </section>

          <section aria-labelledby="steps-title" className="mt-16 sm:mt-20">
            <h2 id="steps-title" className="text-[1.625rem] leading-tight font-extrabold tracking-[-0.015em] text-ink">
              Four steps for every message
            </h2>
            <p className="mt-2 max-w-[60ch] text-[15px] leading-6 text-ink-2">Every tip this month practises one of them.</p>
            <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.id} className="border-t border-ink pt-4">
                  <div className="flex items-center gap-3">
                    <EvidenceMarker n={i + 1} size={26} />
                    <h3 className="text-lg leading-6 font-bold text-ink">{s.label}</h3>
                  </div>
                  <p className="mt-3 text-[15px] leading-6 text-ink-2">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-16 grid gap-8 pb-16 sm:mt-20 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
            <div>
              <h2 className="text-[1.625rem] leading-tight font-extrabold tracking-[-0.015em] text-ink">Take part in this month’s activities</h2>
              <p className="mt-3 max-w-[56ch] text-[17px] leading-7 text-ink-2">
                Activities open from the link or QR code the CISO Office shares with you by email, Teams, WhatsApp and on printed posters. Open it on
                your phone or computer, enter your name and employee ID, and start.
              </p>
            </div>
            <aside aria-labelledby="report-title" className="on-shell rounded-xs bg-graphite p-6 text-shell-fg sm:p-8">
              <h2 id="report-title" className="text-lg leading-6 font-bold">
                Something wrong? Report it.
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-shell-fg">Anything suspicious at work goes to the CISO Office through the approved channel.</p>
              <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-graphite-3 pt-5">
                <a href="tel:1930" className="group inline-flex items-center gap-3 rounded-xs">
                  <Phone className="size-5 text-marker" aria-hidden />
                  <span className="font-mono text-4xl leading-none font-bold tracking-[0.04em] text-marker tabular-nums">1930</span>
                </a>
                <p className="min-w-0 flex-1 basis-56 text-sm leading-5 text-shell-muted">
                  Lost money to a cyber fraud? Call the national cyber-crime helpline at once, or report at{' '}
                  <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="font-mono text-shell-fg underline underline-offset-4">
                    cybercrime.gov.in
                  </a>
                  .
                </p>
              </div>
            </aside>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

/** The month as the player's progress track: one cell per day, today lit. */
function MonthTrack({ month }: { month: MonthState }) {
  return (
    <div className="mt-8 max-w-xl" aria-hidden>
      <div className="flex gap-[3px]">
        {DAYS.map((d) => (
          <span
            key={d}
            className={cn(
              'h-1.5 flex-1 rounded-[1px]',
              d < month.today && 'animate-track-fill bg-shell-fg/75',
              d === month.today && 'animate-track-fill bg-marker',
              d > month.today && 'bg-white/20',
            )}
            style={d <= month.today ? { animationDelay: `${d * 22}ms` } : undefined}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-shell-muted">
        <span>1 Oct</span>
        <span>31 Oct</span>
      </div>
    </div>
  );
}

function DayCount({ month }: { month: MonthState }) {
  const caption =
    month.phase === 'before'
      ? 'of 31 lessons open. The first opens on Thursday 1 October.'
      : month.phase === 'after'
        ? 'of 31 lessons. The month is over; every lesson stays open.'
        : `of ${MONTH.days} lessons open`;
  return (
    <p className="flex items-baseline gap-3 lg:flex-col lg:items-end lg:gap-1 lg:text-right">
      <span className="text-[3.5rem] leading-none font-extrabold tracking-[-0.03em] text-marker tabular-nums lg:text-[6.5rem]">{month.today}</span>
      <span className="max-w-[24ch] text-[15px] leading-6 font-semibold text-shell-fg">{caption}</span>
    </p>
  );
}

function LessonPanel({ day, month, onPick }: { day: number; month: MonthState; onPick: (d: number | null) => void }) {
  const lesson = LESSONS[day - 1];
  const open = day <= month.today;
  const isToday = month.phase === 'during' && day === month.today;
  return (
    <article aria-labelledby="lesson-day" className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="lesson-day" className="text-lg leading-6 font-bold text-ink">
            {isToday ? 'Today' : `Lesson ${day}`} · {formatLessonDay(day)}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-3">
            {lesson.kind === 'tip' ? (
              <PaperTag lead={`Step ${stepNumber(lesson.step)}`} title={STEPS[stepNumber(lesson.step) - 1].label} />
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink-2">
                <Quote className="size-3.5" aria-hidden /> Expert quote
              </span>
            )}
            <span className="tabular-nums">
              Lesson {day} of {MONTH.days}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="icon-lg" aria-label="Previous day" disabled={day <= 1 || !open} onClick={() => onPick(day - 1)}>
            <ArrowLeft />
          </Button>
          <Button variant="outline" size="icon-lg" aria-label="Next day" disabled={day >= month.today} onClick={() => onPick(day + 1)}>
            <ArrowRight />
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="mt-8 flex-1">
        <div key={day} className="animate-stamp-in">
          {!open ? (
            <p className="max-w-[44ch] text-[17px] leading-7 text-ink-2">The first lesson opens on Thursday 1 October. Come back then, and every day after.</p>
          ) : lesson.kind === 'quote' ? (
            <QuoteLesson lesson={lesson} />
          ) : (
            <TipLesson lesson={lesson} />
          )}
        </div>
      </div>

      {month.phase === 'during' && !isToday ? (
        <button
          type="button"
          onClick={() => onPick(null)}
          className="mt-8 self-start rounded-xs text-sm font-semibold text-slate underline underline-offset-4 hover:text-ink"
        >
          Back to today’s lesson
        </button>
      ) : null}
    </article>
  );
}

function QuoteLesson({ lesson }: { lesson: Extract<Lesson, { kind: 'quote' }> }) {
  return (
    <figure>
      <blockquote className="max-w-[30ch] text-[1.5rem] leading-[1.28] font-bold tracking-[-0.015em] text-pretty text-ink sm:text-[1.875rem] lg:text-[2.125rem]">
        <p className="-indent-[0.42em]">“{lesson.text}”</p>
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span aria-hidden className="h-px w-8 shrink-0 bg-line-strong" />
        <span className="min-w-0">
          <span className="block text-[15px] leading-6 font-semibold text-ink">{lesson.author}</span>
          <span className="block text-[13px] leading-5 text-ink-3">{lesson.source}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Helpline numbers and addresses read character by character, so they set in mono. */
const MONO = /(1930|cybercrime\.gov\.in)/;

function TipLesson({ lesson }: { lesson: Extract<Lesson, { kind: 'tip' }> }) {
  return (
    <div>
      <h3 className="max-w-[22ch] text-[1.625rem] leading-[1.18] font-extrabold tracking-[-0.015em] text-balance text-ink sm:text-[2rem] lg:text-[2.25rem]">
        {lesson.title}
      </h3>
      <p className="mt-4 max-w-[52ch] text-[17px] leading-7 text-ink-2">
        {lesson.text.split(MONO).map((part, i) =>
          MONO.test(part) ? (
            <span key={i} className="font-mono text-[0.95em] font-semibold text-ink">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </p>
    </div>
  );
}

function MonthGrid({ day, month, onPick }: { day: number; month: MonthState; onPick: (d: number | null) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const go = (to: number) => {
    const d = Math.min(Math.max(1, to), month.today);
    if (d < 1) return;
    onPick(d);
    refs.current[d - 1]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) go(day + step);
    else if (e.key === 'Home') go(1);
    else if (e.key === 'End') go(month.today);
    else return;
    e.preventDefault();
  };

  return (
    <div className="min-w-0 border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
      <h2 id="calendar-title" className="text-sm leading-5 font-bold text-ink">
        October 2026
      </h2>
      <div role="grid" aria-labelledby="calendar-title" className="mt-5 grid gap-1.5">
        <div role="row" className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map(([short, long]) => (
            <span key={short} role="columnheader" aria-label={long} className="text-center text-xs leading-5 font-semibold text-ink-3">
              {short}
            </span>
          ))}
        </div>
        {WEEKS.map((week, w) => (
          <div key={w} role="row" className="grid grid-cols-7 gap-1.5">
            {week.map((d, i) => {
              if (d === null) return <span key={`blank-${i}`} role="gridcell" />;
              const open = d <= month.today;
              const isToday = month.phase === 'during' && d === month.today;
              const selected = open && d === day;
              const quote = LESSONS[d - 1].kind === 'quote';
              return (
                <span key={d} role="gridcell" aria-selected={selected}>
                  <button
                    ref={(el) => {
                      refs.current[d - 1] = el;
                    }}
                    type="button"
                    tabIndex={selected ? 0 : -1}
                    disabled={!open}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${formatLessonDay(d)}${isToday ? ', today' : ''}${!open ? ', opens on the day' : quote ? ', expert quote' : ''}`}
                    onClick={() => onPick(d)}
                    onKeyDown={onKeyDown}
                    className={cn(
                      'relative flex h-12 w-full items-center justify-center rounded-xs border text-[15px] font-semibold tabular-nums transition-colors duration-150',
                      open ? 'border-line-strong bg-surface text-ink hover:border-ink-3' : 'cursor-default border-dashed border-line-strong text-ink-3',
                      selected && !isToday && 'border-graphite bg-marker-wash shadow-[inset_0_0_0_1px_var(--graphite)] hover:border-graphite',
                      isToday && 'border-marker-hover bg-marker text-marker-ink hover:border-graphite',
                      isToday && selected && 'border-graphite shadow-[inset_0_0_0_1px_var(--graphite)]',
                    )}
                  >
                    {d}
                    {quote && open ? <Quote aria-hidden className="absolute top-1 right-1 size-2.5 opacity-60" /> : null}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs leading-5 text-ink-3">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[1px] bg-marker" /> Today
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[1px] border border-line-strong" /> Open
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-[1px] border border-dashed border-line-strong" /> Opens on the day
        </li>
        <li className="inline-flex items-center gap-1.5">
          <Quote aria-hidden className="size-3" /> Expert quote
        </li>
      </ul>
      <p className="mt-3 text-xs leading-5 text-ink-3">
        {month.phase === 'after' ? 'Every lesson stays open.' : 'A new lesson opens every day at midnight, India time.'}
      </p>
    </div>
  );
}
