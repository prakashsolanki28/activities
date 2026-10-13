import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { ActivityInsights, AdminActivity, QuestionInsight } from '@hrrl/shared';
import { ColumnChart } from './charts';
import { RedFlagMap } from './red-flag-map';
import { Card, MessageBar } from './ui';
import { promptText } from '~/components/evidence/prompt';
import { formatPct } from '~/lib/format';
import { TYPE_META } from '~/lib/question-types';
import { cn } from '~/lib/utils';

/** Forms-style summary: score spread, the red-flag map, then one card per question. */
export function ResponsesSummary({ activity, data }: { activity: AdminActivity; data: ActivityInsights }) {
  const [order, setOrder] = useState<'sequence' | 'missed'>('sequence');
  const pass = activity.settings.passingPct;
  const numbered = useMemo(() => data.questions.map((q, i) => ({ q, n: i + 1 })), [data.questions]);
  const questions = useMemo(
    () => (order === 'sequence' ? numbered : [...numbered].sort((a, b) => (a.q.pctCorrect ?? 101) - (b.q.pctCorrect ?? 101))),
    [numbered, order],
  );

  return (
    <div className="grid gap-5">
      {data.sharedIpFlags.length ? (
        <MessageBar intent="warning">
          Many different employee IDs came from one network address ({data.sharedIpFlags.map((f) => `${f.ip}: ${f.attempts}`).join(', ')}). That is normal in an office, but check the individual responses if someone may be guessing IDs.
        </MessageBar>
      ) : null}

      <RedFlagMap sections={activity.sections} questions={data.questions} />

      <Card className="px-5 pt-4 pb-5">
        <h2 className="text-base font-semibold text-ink">Scores</h2>
        <p className="mt-0.5 text-[13px] text-ink-3">
          How many people scored in each range. Grey bars are below the {pass}% pass mark.
        </p>
        <div className="mt-4">
          <ColumnChart
            label="Number of people in each score range"
            height={150}
            data={data.histogram.map((b) => ({
              key: b.bucket,
              label: `${b.from}%`,
              value: b.count,
              tone: b.from + 10 <= pass ? 'muted' : 'data',
              detail: `${b.bucket}%: ${b.count} ${b.count === 1 ? 'person' : 'people'}`,
            }))}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-base font-semibold text-ink">Questions</h2>
        <div className="flex gap-1.5" role="group" aria-label="Order">
          {(
            [
              ['sequence', 'In order'],
              ['missed', 'Hardest first'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={order === v}
              onClick={() => setOrder(v)}
              className={cn(
                'h-8 rounded-full px-3.5 text-[13px] font-semibold',
                order === v ? 'bg-brand-tint text-brand ring-1 ring-brand ring-inset' : 'bg-surface text-ink-2 ring-1 ring-line-strong ring-inset hover:bg-ground-2',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {questions.map(({ q, n }) => (
        <QuestionSummary key={q.questionId} q={q} n={n} />
      ))}
    </div>
  );
}

function QuestionSummary({ q, n }: { q: QuestionInsight; n: number }) {
  const Icon = TYPE_META[q.type].icon;
  const scored = q.pctCorrect != null;
  return (
    <Card className="px-5 pt-4 pb-5">
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 text-[15px] leading-6 font-semibold text-ink">
          {n}. {promptText(q.prompt)}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
          <Icon className="size-3.5" aria-hidden />
          {q.answered} {q.answered === 1 ? 'response' : 'responses'}
        </span>
      </div>
      {scored ? (
        <p className="mt-1 text-[13px] text-ink-2">
          <span className={cn('font-semibold', q.pctCorrect! >= 70 ? 'text-ok' : q.pctCorrect! >= 40 ? 'text-warn' : 'text-bad')}>{formatPct(q.pctCorrect)}</span> answered correctly
        </p>
      ) : null}
      <div className="mt-4 grid gap-4">
        {q.options?.length ? <Bars rows={q.options.map((o) => ({ key: o.id, label: o.label, count: o.count, correct: o.correct }))} total={q.answered} /> : null}
        {q.flags?.length ? <Bars rows={q.flags.map((f) => ({ key: String(f.index), label: `${f.index + 1}. ${f.label}`, count: f.found }))} total={q.answered} caption="People who found each red flag" /> : null}
        {q.groups?.length ? <Bars rows={q.groups.map((g) => ({ key: g.id, label: g.label, count: g.count }))} total={q.answered} caption="People who named each red flag" /> : null}
        {q.topWrong?.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-3">Most common wrong answers</p>
            <ul className="flex flex-wrap gap-1.5">
              {q.topWrong.map((w) => (
                <li key={w.text} className="rounded-full bg-ground px-2.5 py-1 text-[13px] text-ink-2 ring-1 ring-line">
                  {w.text} <span className="text-ink-3 tabular-nums">×{w.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!q.options?.length && !q.flags?.length && !q.groups?.length && !q.topWrong?.length && !scored ? (
          <p className="text-[13px] text-ink-3">{q.answered ? 'Open Individual responses to read the answers.' : 'No answers yet.'}</p>
        ) : null}
      </div>
    </Card>
  );
}

/** One bar per answer; the correct one carries a check and the words "Correct answer". */
function Bars({ rows, total, caption }: { rows: { key: string; label: string; count: number; correct?: boolean }[]; total: number; caption?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      {caption ? <p className="mb-2 text-xs font-semibold text-ink-3">{caption}</p> : null}
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[13px] sm:grid-cols-[minmax(0,1fr)_minmax(6rem,16rem)_5.5rem]">
            <span className={cn('flex min-w-0 items-center gap-1.5', r.correct ? 'font-semibold text-ink' : 'text-ink-2')}>
              {r.correct ? <Check className="size-3.5 shrink-0 text-ok" strokeWidth={3} aria-hidden /> : <span className="w-3.5 shrink-0" />}
              <span className="min-w-0 sm:truncate">{promptText(r.label) || '(picture)'}</span>
              {r.correct ? <span className="sr-only">(correct answer)</span> : null}
            </span>
            <span className="relative order-last col-span-2 h-2.5 rounded-r-[4px] bg-ground-2 sm:order-none sm:col-span-1">
              <span className={cn('absolute inset-y-0 left-0 rounded-r-[4px]', r.correct ? 'bg-ok' : 'bg-brand')} style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="text-right text-ink-2 tabular-nums">
              {r.count}
              {total ? <span className="text-ink-3"> · {Math.round((r.count / total) * 100)}%</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
