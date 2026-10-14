import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Award, ChevronDown, Clock3, ListOrdered, TimerOff } from 'lucide-react';
import type { AttemptState, PublicQuestion, Reveal } from '@hrrl/shared';
import type { Route } from './+types/result';
import { Button } from '~/components/ui/button';
import { EvidenceMarker } from '~/components/evidence/marker';
import { EvidenceLog, EvidencePlate } from '~/components/evidence/plate';
import { CodeChip, ExhibitTag } from '~/components/evidence/tags';
import { Prompt } from '~/components/evidence/prompt';
import { CorrectAnswerText, LearningPoint, NextClue, Verdict } from '~/components/play/reveal-panel';
import { PublicMessage, PublicShell } from '~/components/play/public-shell';
import { ApiError } from '~/lib/api';
import { clearAttempt, loadAttempt } from '~/lib/attempt-store';
import { describeValue, ordinal, plain } from '~/lib/describe';
import { formatDuration, formatPct, formatPoints } from '~/lib/format';
import { useAttemptState } from '~/lib/public-api';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Your result · HRRL Activities' }];

export default function Result() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [stored] = useState(() => (typeof window === 'undefined' ? null : loadAttempt(slug)));
  const attempt = useAttemptState(stored?.attemptId, stored?.token);

  useEffect(() => {
    if (!stored) navigate(`/a/${slug}`, { replace: true });
  }, [stored, slug, navigate]);
  useEffect(() => {
    if (attempt.data?.status === 'in_progress') navigate(`/a/${slug}`, { replace: true });
  }, [attempt.data, slug, navigate]);
  useEffect(() => {
    if (attempt.error instanceof ApiError && attempt.error.status === 401) {
      clearAttempt(slug);
      navigate(`/a/${slug}`, { replace: true });
    }
  }, [attempt.error, slug, navigate]);

  if (attempt.error && !(attempt.error instanceof ApiError && attempt.error.status === 401)) {
    return <PublicMessage title="Could not load your result">Check your connection and reload this page.</PublicMessage>;
  }
  if (attempt.data?.status === 'submitted' && attempt.data.activity.resultsStatus !== 'visible') {
    return <ResultsHeld state={attempt.data} />;
  }
  if (!attempt.data?.result) {
    return (
      <PublicShell>
        <div className="h-48 max-w-2xl animate-pulse rounded-xs bg-ground-2" aria-busy="true" />
      </PublicShell>
    );
  }
  return <ResultView state={attempt.data} slug={slug} />;
}

type Outcome = 'correct' | 'wrong' | 'pending' | 'unscored' | 'unknown';

function outcomeOf(reveal: Reveal | undefined): Outcome {
  if (!reveal) return 'unknown';
  if (reveal.needsReview) return 'pending';
  if (reveal.isCorrect === null) return 'unscored';
  return reveal.isCorrect ? 'correct' : 'wrong';
}

function ResultView({ state, slug }: { state: AttemptState; slug: string }) {
  const r = state.result!;
  const a = state.activity;
  const showScore = a.showScore;
  const firstName = state.name.split(' ')[0];
  const qById = useMemo(() => new Map(state.questions.map((q) => [q.id, q])), [state.questions]);
  const outcomes = state.questions.map((q) => outcomeOf(state.reveals[q.id]));
  const scored = outcomes.filter((o) => o === 'correct' || o === 'wrong');
  const correct = outcomes.filter((o) => o === 'correct').length;
  const leaderboardVisible = a.leaderboard !== 'off' && showScore;

  return (
    <PublicShell
      right={
        leaderboardVisible ? (
          <Button asChild variant="outline" size="sm">
            <Link to={`/a/${slug}/leaderboard`}>
              <ListOrdered /> <span className="sr-only sm:not-sr-only">Leaderboard</span>
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="max-w-3xl">
        <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.02em] text-ink sm:text-[2.5rem]">Case closed, {firstName}.</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <CodeChip>{a.code}</CodeChip>
          <span>{a.title}</span>
        </div>

        {r.submitReason === 'timeout' || r.submitReason === 'closed' ? (
          <p className="mt-4 flex items-center gap-2 text-[15px] font-semibold text-manila-ink">
            <TimerOff className="size-4" aria-hidden />
            {r.submitReason === 'timeout' ? 'Time ran out, so your answers were submitted automatically.' : 'The activity closed, so your answers were submitted automatically.'}
          </p>
        ) : null}

        {showScore ? (
          <p className="mt-4 max-w-[60ch] text-xl leading-8 text-ink-2">
            You scored <strong className="text-ink">{formatPct(r.pct)}</strong> ({formatPoints(r.score)} of {formatPoints(r.maxScore)} points)
            {scored.length && state.reviewAvailable ? (
              <>
                , with <strong className="text-ink">{correct} of {scored.length}</strong> questions fully right,
              </>
            ) : null}{' '}
            in {formatDuration(r.durationSec)}.
            {r.rank && r.rankOf ? (
              <>
                {' '}
                That puts you <strong className="text-ink">{ordinal(r.rank)}</strong> of {r.rankOf} so far.
              </>
            ) : null}
          </p>
        ) : (
          <p className="mt-4 max-w-[60ch] text-xl leading-8 text-ink-2">Your answers have been submitted to the CISO Office. Thank you for taking part.</p>
        )}

        {r.pendingReview ? (
          <p className="mt-3 flex items-center gap-2 text-[15px] text-manila-ink">
            <Clock3 className="size-4 shrink-0" aria-hidden /> Some written answers are waiting for review. Your score may go up once they are marked.
          </p>
        ) : null}

        {state.reviewAvailable ? <EvidenceBoard state={state} outcomes={outcomes} /> : null}

        {state.completionMessage ? (
          <div className="mt-8 rounded-xs bg-graphite px-6 py-5 text-shell-fg">
            <Prompt text={state.completionMessage} className="text-shell-fg [&_strong]:text-marker" />
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {r.certificateCode ? (
            <Button asChild size="lg">
              <Link to={`/c/${r.certificateCode}`}>
                <Award /> View certificate
              </Link>
            </Button>
          ) : a.certificateEnabled && showScore && !r.pendingReview ? (
            <p className="text-sm text-ink-3">No certificate this time: certificates start at {a.certificateMinPct}%.</p>
          ) : null}
          {leaderboardVisible ? (
            <Button asChild variant="outline" size="lg">
              <Link to={`/a/${slug}/leaderboard`}>
                <ListOrdered /> See the leaderboard
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {state.reviewAvailable ? (
        <section className="mt-14" aria-labelledby="review-heading">
          <h2 id="review-heading" className="text-xl font-extrabold text-ink">
            What each exhibit was hiding
          </h2>
          <p className="mt-1 text-[15px] text-ink-2">Open an exhibit to see the red flags marked on it and the answer to every question.</p>
          <div className="mt-6 grid gap-3">
            {state.sections.map((s, i) => (
              <ExhibitReview key={s.id} state={state} sectionIndex={i} questions={s.questionIds.map((id) => qById.get(id)!)} defaultOpen={i === 0} />
            ))}
          </div>
        </section>
      ) : null}
    </PublicShell>
  );
}

/** One marker per question, grouped by exhibit: the result at a glance. */
function EvidenceBoard({ state, outcomes }: { state: AttemptState; outcomes: Outcome[] }) {
  const index = new Map(state.questions.map((q, i) => [q.id, i]));
  const tone = (o: Outcome) => (o === 'correct' ? 'correct' : o === 'wrong' ? 'missed' : o === 'pending' ? 'outline' : 'muted');
  return (
    <div className="mt-8 grid gap-4 rounded-xs bg-surface p-5 ring-1 ring-line">
      {state.sections.map((s) => (
        <div key={s.id} className="grid gap-2 sm:grid-cols-[max-content_1fr] sm:items-center sm:gap-4">
          <ExhibitTag index={s.index} title={s.title || undefined} className="max-w-full justify-self-start" />
          <ol className="flex flex-wrap gap-1">
            {s.questionIds.map((qid) => {
              const i = index.get(qid)!;
              const q = state.questions[i];
              const o = outcomes[i];
              return (
                <li key={qid}>
                  <EvidenceMarker n={q.code.split('Q')[1]?.replace(/^0/, '') ?? i + 1} tone={tone(o)} size={22} title={`${q.code}: ${o === 'correct' ? 'correct' : o === 'wrong' ? 'missed' : o === 'pending' ? 'awaiting review' : 'not scored'}`} />
                </li>
              );
            })}
          </ol>
        </div>
      ))}
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <EvidenceMarker n="" tone="correct" size={12} /> Correct
        </span>
        <span className="inline-flex items-center gap-1.5">
          <EvidenceMarker n="" tone="missed" size={12} /> Missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <EvidenceMarker n="" tone="muted" size={12} /> Not scored
        </span>
      </p>
    </div>
  );
}

function ExhibitReview({ state, sectionIndex, questions, defaultOpen }: { state: AttemptState; sectionIndex: number; questions: PublicQuestion[]; defaultOpen: boolean }) {
  const s = state.sections[sectionIndex];
  const [active, setActive] = useState<string | null>(null);
  const highlights = questions.flatMap((q) => state.reveals[q.id]?.highlights ?? []);
  const unique = [...new Map(highlights.map((h) => [h.id, h])).values()];
  // Spot-the-flags questions tone each flag found (green) or missed (red).
  const spotTone = new Map<string, 'correct' | 'missed'>();
  for (const q of questions) {
    const c = state.reveals[q.id]?.correct;
    if (q.type !== 'spot_flags' || !c?.regions) continue;
    c.regions.forEach((r, i) => spotTone.set(r.id, c.foundIndexes?.includes(i) ? 'correct' : 'missed'));
  }
  const right = questions.filter((q) => state.reveals[q.id]?.isCorrect === true).length;
  const scoredCount = questions.filter((q) => state.reveals[q.id]?.isCorrect != null).length;
  return (
    <details open={defaultOpen} className="group/ex rounded-xs bg-surface ring-1 ring-line open:ring-line-strong">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <ExhibitTag index={s.index} title={s.title || undefined} className="min-w-0" />
        {scoredCount ? (
          <span className="ml-auto shrink-0 text-sm font-semibold text-ink-2 tabular-nums">
            {right}/{scoredCount}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform group-open/ex:rotate-180" aria-hidden />
      </summary>
      <div className={cn('grid gap-8 border-t border-line px-4 py-6 sm:px-6', s.image && 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]')}>
        {s.image ? (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <EvidencePlate
              image={s.image}
              highlights={unique}
              revealed
              activeId={active}
              onActiveChange={setActive}
              maxHeight="70vh"
              regionTone={spotTone.size ? (r) => spotTone.get(r.id) ?? 'marker' : undefined}
            />
            <EvidenceLog regions={unique} activeId={active} onActiveChange={setActive} className="mt-4" />
          </div>
        ) : null}
        <ol className="grid gap-6">
          {questions.map((q) => {
            const reveal = state.reveals[q.id];
            const answer = describeValue(q, state.answers[q.id]?.value);
            return (
              <li key={q.id} className="grid gap-2.5">
                <Prompt text={q.prompt} size="sm" className="text-[15px] leading-6 font-semibold" />
                <div className="flex items-center gap-2">
                  <CodeChip>{q.code}</CodeChip>
                  {q.bonus ? <span className="text-xs font-bold text-manila-ink">Bonus</span> : null}
                </div>
                <p className="text-sm text-ink-2">
                  Your answer: <span className="font-semibold text-ink">{answer || 'No answer'}</span>
                </p>
                {reveal ? (
                  <>
                    <Verdict reveal={reveal} className="text-base" />
                    {q.type === 'single' || q.type === 'multi' ? (
                      reveal.isCorrect ? null : (
                        <p className="text-sm text-ink-2">
                          Correct: <span className="font-semibold text-ink">{(reveal.correct?.optionIds ?? []).map((id) => plain(q.options?.find((o) => o.id === id)?.label ?? '')).join(' · ')}</span>
                        </p>
                      )
                    ) : q.type === 'boolean' && !reveal.isCorrect && reveal.correct?.boolean !== undefined ? (
                      <p className="text-sm text-ink-2">
                        Correct: <span className="font-semibold text-ink">{reveal.correct.boolean ? q.trueLabel : q.falseLabel}</span>
                      </p>
                    ) : q.type === 'spot_flags' ? null : (
                      <CorrectAnswerText question={q} reveal={reveal} />
                    )}
                    <LearningPoint text={reveal.explanation} />
                  </>
                ) : null}
                {state.revealTexts[q.id] ? <NextClue text={state.revealTexts[q.id]} /> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </details>
  );
}

/** Submitted, but results are held for the CISO Office (or never shown). */
function ResultsHeld({ state }: { state: AttemptState }) {
  const pending = state.activity.resultsStatus === 'pending';
  return (
    <PublicShell>
      <div className="max-w-2xl">
        <h1 className="text-3xl leading-tight font-extrabold tracking-[-0.02em] text-ink sm:text-[2.5rem]">Submitted. Thank you, {state.name.split(' ')[0]}.</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-ink-3">
          <CodeChip>{state.activity.code}</CodeChip>
          <span>{state.activity.title}</span>
        </div>
        <p className="mt-5 max-w-[60ch] text-xl leading-8 text-ink-2">
          {pending
            ? 'Your answers are with the CISO Office. Your score and the answers will appear on this page once they publish the results. Open this link again on the same device to check.'
            : 'Your answers are with the CISO Office. Scores for this activity are seen only by the organisers.'}
        </p>
        {state.result === null && state.answers ? (
          <p className="mt-3 text-sm text-ink-3">
            {Object.keys(state.answers).length} of {state.questions.length} questions answered.
          </p>
        ) : null}
        {state.completionMessage ? (
          <div className="mt-8 rounded-xs bg-graphite px-6 py-5 text-shell-fg">
            <Prompt text={state.completionMessage} className="text-shell-fg [&_strong]:text-marker" />
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}
