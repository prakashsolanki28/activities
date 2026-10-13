import { Check, Clock3, Lightbulb, MapPin, X } from 'lucide-react';
import type { PublicQuestion, Reveal } from '@hrrl/shared';
import { Prompt } from '~/components/evidence/prompt';
import { formatPoints } from '~/lib/format';
import { cn } from '~/lib/utils';

export function Verdict({ reveal, className }: { reveal: Reveal; className?: string }) {
  if (reveal.needsReview) {
    return (
      <p className={cn('flex items-center gap-2 text-[15px] font-bold text-manila-ink', className)}>
        <Clock3 className="size-5" aria-hidden /> Recorded. The CISO Office will review this answer.
      </p>
    );
  }
  if (reveal.isCorrect === null) {
    return (
      <p className={cn('flex items-center gap-2 text-[15px] font-bold text-ink-2', className)}>
        <Check className="size-5" aria-hidden /> Answer recorded.
      </p>
    );
  }
  const flags = reveal.correct?.foundIndexes;
  if (flags && reveal.correct?.regions) {
    const total = reveal.correct.regions.length;
    const all = flags.length === total;
    return (
      <p className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-extrabold', all ? 'text-green-ink' : flags.length ? 'text-ink' : 'text-red-ink', className)}>
        <span className={cn('grid size-7 place-items-center rounded-full', all ? 'bg-ledger' : flags.length ? 'bg-marker' : 'bg-evidence')} aria-hidden>
          {all ? <Check className="size-4 text-white" strokeWidth={3} /> : flags.length ? <span className="text-xs font-extrabold text-marker-ink">{flags.length}</span> : <X className="size-4 text-white" strokeWidth={3} />}
        </span>
        {all ? `Every red flag found (${total} of ${total})` : `You found ${flags.length} of ${total} red flags`}
        <span className="text-sm font-semibold text-ink-3 tabular-nums">
          {formatPoints(reveal.points)} of {formatPoints(reveal.maxPoints)} {reveal.maxPoints === 1 ? 'point' : 'points'}
        </span>
      </p>
    );
  }
  const partial = !reveal.isCorrect && reveal.points > 0;
  return (
    <p className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-extrabold', reveal.isCorrect ? 'text-green-ink' : 'text-red-ink', className)}>
      <span className={cn('grid size-7 place-items-center rounded-full', reveal.isCorrect ? 'bg-ledger' : 'bg-evidence')} aria-hidden>
        {reveal.isCorrect ? <Check className="size-4 text-white" strokeWidth={3} /> : <X className="size-4 text-white" strokeWidth={3} />}
      </span>
      {reveal.isCorrect ? 'Correct' : partial ? 'Partly right' : 'Not quite'}
      {reveal.maxPoints > 0 || reveal.points > 0 ? (
        <span className="text-sm font-semibold text-ink-3 tabular-nums">
          {reveal.maxPoints > 0
            ? `${formatPoints(reveal.points)} of ${formatPoints(reveal.maxPoints)} ${reveal.maxPoints === 1 ? 'point' : 'points'}`
            : `+${formatPoints(reveal.points)} bonus`}
        </span>
      ) : null}
    </p>
  );
}

/** The key in words, for types whose input cannot show it inline. */
export function CorrectAnswerText({ question, reveal }: { question: PublicQuestion; reveal: Reveal }) {
  const c = reveal.correct;
  if (!c || reveal.isCorrect === true) return null;
  let body: React.ReactNode = null;
  switch (question.type) {
    case 'short_text':
      body = c.text?.length ? (
        <>
          Accepted answer{c.text.length > 1 ? 's' : ''}: <strong className="text-ink">{c.text.slice(0, 3).join(' · ')}</strong>
        </>
      ) : null;
      break;
    case 'number':
      body =
        c.number != null ? (
          <>
            Correct answer: <strong className="font-mono text-ink">{c.number}</strong>
            {c.tolerance ? ` (± ${c.tolerance})` : ''} {question.unit}
          </>
        ) : null;
      break;
    case 'ordering':
      body = c.order ? (
        <>
          Correct order: <strong className="text-ink">{c.order.map((o) => o.label).join(' → ')}</strong>
        </>
      ) : null;
      break;
    case 'list_text':
      body = c.groups ? (
        <span className="block">
          <span className="block">
            You named {c.groups.filter((g) => g.matched).length} of the {c.minGroups} needed. Red flags in this message:
          </span>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {c.groups.map((g) => (
              <li key={g.id} className="flex items-center gap-2 text-sm">
                {g.matched ? <Check className="size-4 text-ledger" strokeWidth={3} aria-label="You named this" /> : <span className="size-4 rounded-full border border-line-strong" aria-label="Not named" />}
                <span className={g.matched ? 'font-semibold text-ink' : 'text-ink-2'}>{g.label || g.keywords[0]}</span>
              </li>
            ))}
          </ul>
        </span>
      ) : null;
      break;
    default:
      return null;
  }
  return body ? <div className="text-[15px] leading-6 text-ink-2">{body}</div> : null;
}

export function LearningPoint({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="flex gap-3 rounded-xs bg-surface px-4 py-3.5 ring-1 ring-line">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-manila-ink" aria-hidden />
      <div>
        <p className="text-[13px] font-bold text-ink-3">Learning point</p>
        <Prompt text={text} size="sm" className="mt-0.5 text-[15px] leading-6" />
      </div>
    </div>
  );
}

/** The treasure-hunt clue: a manila card, because it is something you carry to the next place. */
export function NextClue({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="animate-stamp-in relative overflow-hidden rounded-xs bg-manila px-5 py-4 text-manila-ink">
      <p className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-[0.06em] uppercase">
        <MapPin className="size-4" aria-hidden /> Next clue
      </p>
      <Prompt text={text} size="sm" className="mt-1.5 text-[15px] leading-7 font-semibold text-graphite" />
    </div>
  );
}
