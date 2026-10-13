import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ChevronRight, CircleAlert, Loader2, Send } from 'lucide-react';
import { isAnswered, type AnswerValue, type AttemptState, type Reveal, type SpotBox, type SpotState } from '@hrrl/shared';
import type { Route } from './+types/player';
import { Button } from '~/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Wordmark } from '~/components/brand';
import { EvidenceLog, EvidencePlate } from '~/components/evidence/plate';
import { CodeChip, ExhibitTag } from '~/components/evidence/tags';
import { Prompt } from '~/components/evidence/prompt';
import { AnswerInput } from '~/components/play/answer-input';
import { CorrectAnswerText, LearningPoint, NextClue, Verdict } from '~/components/play/reveal-panel';
import { Countdown } from '~/components/play/timer';
import { SpotPanel, type SpotNote } from '~/components/play/spot-panel';
import { ApiError, errorMessage } from '~/lib/api';
import { clearAttempt, loadAttempt } from '~/lib/attempt-store';
import { clockOffset, publicApi, publicKeys, useAttemptState } from '~/lib/public-api';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Activity · HRRL Activities' }];

export default function Player() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const [stored] = useState(() => (typeof window === 'undefined' ? null : loadAttempt(slug)));
  const attempt = useAttemptState(stored?.attemptId, stored?.token);

  useEffect(() => {
    if (!stored) navigate(`/a/${slug}`, { replace: true });
  }, [stored, slug, navigate]);

  useEffect(() => {
    const s = attempt.data;
    if (s?.status === 'submitted') navigate(`/a/${slug}/result`, { replace: true });
    else if (s && !s.startedAt) navigate(`/a/${slug}`, { replace: true });
  }, [attempt.data, slug, navigate]);

  useEffect(() => {
    if (attempt.error instanceof ApiError && attempt.error.status === 401) {
      clearAttempt(slug);
      navigate(`/a/${slug}`, { replace: true });
    }
  }, [attempt.error, slug, navigate]);

  if (attempt.error && !(attempt.error instanceof ApiError && attempt.error.status === 401)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ground px-6">
        <div className="max-w-md">
          <h1 className="text-xl font-bold text-ink">Could not load the activity</h1>
          <p className="mt-2 text-ink-2">{errorMessage(attempt.error)}</p>
          <Button className="mt-5" onClick={() => attempt.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (!stored || !attempt.data || attempt.data.status !== 'in_progress' || !attempt.data.startedAt) return <PlayerSkeleton />;
  return <PlayerView state={attempt.data} token={stored.token} slug={slug} />;
}

type SaveStatus = 'saving' | 'saved' | 'error';

/** How much a box overlaps a found flag, to name the flag in the "already found" note. */
function overlapWith(region: { x: number; y: number; w: number; h: number }, b: SpotBox): number {
  const w = Math.min(region.x + region.w, b.x + b.w) - Math.max(region.x, b.x);
  const h = Math.min(region.y + region.h, b.y + b.h) - Math.max(region.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function initialDrafts(state: AttemptState): Record<string, AnswerValue> {
  const drafts: Record<string, AnswerValue> = {};
  for (const q of state.questions) {
    const a = state.answers[q.id];
    if (a) drafts[q.id] = a.value;
    else if (q.type === 'ordering') drafts[q.id] = (q.orderItems ?? []).map((i) => i.id);
  }
  return drafts;
}

function PlayerView({ state, token, slug }: { state: AttemptState; token: string; slug: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { questions, sections, activity } = state;
  const linear = activity.navigation === 'linear';
  const instant = activity.liveFeedback;
  const offset = useMemo(() => clockOffset(state.serverNow), [state.serverNow]);

  const [drafts, setDrafts] = useState(() => initialDrafts(state));
  const [locked, setLocked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.entries(state.answers).map(([id, a]) => [id, a.locked])),
  );
  const [reveals, setReveals] = useState<Record<string, Reveal>>(state.reveals);
  const [clues, setClues] = useState<Record<string, string>>(state.revealTexts);
  const [tries, setTries] = useState<Record<string, number>>({});
  const [saves, setSaves] = useState<Record<string, SaveStatus>>({});
  const [busy, setBusy] = useState(false);
  const [spots, setSpots] = useState<Record<string, SpotState>>(state.spot ?? {});
  const [pendingMark, setPendingMark] = useState<SpotBox | null>(null);
  const [spotNote, setSpotNote] = useState<SpotNote>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const seq = useRef(Math.max(0, ...Object.values(state.answers).map((a) => a.seq)) + 1);
  const timers = useRef<Record<string, number>>({});

  const [pos, setPos] = useState(() => {
    const i = questions.findIndex((q) => (linear ? !state.answers[q.id]?.locked : !state.answers[q.id]));
    return i === -1 ? (linear ? questions.length - 1 : questions.length) : i;
  });
  const reviewing = pos >= questions.length;
  const question = questions[Math.min(pos, questions.length - 1)];
  const section = sections.find((s) => s.id === question.sectionId)!;
  const evidence = question.image ?? section.image ?? null;
  const reveal = reveals[question.id];
  const isLocked = !!locked[question.id];
  const value = drafts[question.id];
  const isSpot = question.type === 'spot_flags';
  const spot = spots[question.id];
  const spotTouched = (qid: string) => {
    const s = spots[qid];
    return !!s && s.found.length + s.misses > 0;
  };
  const answered = isSpot ? spotTouched(question.id) : isAnswered(question.type, value);
  const promptId = `prompt-${question.id}`;
  const firstInSection = section.questionIds[0] === question.id;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setActionError(null);
    setActiveMarker(null);
    setSpotNote(null);
  }, [pos]);

  const submit = useMutation({
    mutationFn: () => publicApi.submit(state.attemptId, token),
    onSuccess: (s) => {
      qc.setQueryData(publicKeys.attempt(s.attemptId), s);
      navigate(`/a/${slug}/result`, { replace: true });
    },
    onError: (e) => setActionError(errorMessage(e)),
  });

  const finishBecause = useCallback(() => {
    if (!submit.isPending) submit.mutate();
  }, [submit]);

  const persist = useCallback(
    async (qid: string, v: AnswerValue, check = false) => {
      const s = seq.current++;
      setSaves((m) => ({ ...m, [qid]: 'saving' }));
      try {
        const res = await publicApi.save(state.attemptId, token, qid, { value: v, seq: s, check });
        setSaves((m) => ({ ...m, [qid]: 'saved' }));
        if (res.answer.locked) setLocked((m) => ({ ...m, [qid]: true }));
        if (res.reveal) setReveals((m) => ({ ...m, [qid]: res.reveal! }));
        if (res.revealText) setClues((m) => ({ ...m, [qid]: res.revealText! }));
        if (res.tryResult) setTries((m) => ({ ...m, [qid]: res.tryResult!.triesLeft }));
        return res;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'stale') {
          setSaves((m) => ({ ...m, [qid]: 'saved' }));
          return null;
        }
        if (e instanceof ApiError && (e.code === 'submitted' || e.code === 'time_up')) {
          finishBecause();
          return null;
        }
        if (e instanceof ApiError && e.code === 'locked') {
          setLocked((m) => ({ ...m, [qid]: true }));
          return null;
        }
        setSaves((m) => ({ ...m, [qid]: 'error' }));
        throw e;
      }
    },
    [state.attemptId, token, finishBecause],
  );

  const change = (v: AnswerValue) => {
    if (isLocked) return;
    const qid = question.id;
    setDrafts((m) => ({ ...m, [qid]: v }));
    // Editing after a wrong try clears the "not quite" note until the next check.
    if (tries[qid] !== undefined) setTries(({ [qid]: _gone, ...rest }) => rest);
    if (linear) return; // linear modes save when the answer is checked or confirmed
    window.clearTimeout(timers.current[qid]);
    const delay = ['short_text', 'long_text', 'list_text', 'number'].includes(question.type) ? 600 : 0;
    timers.current[qid] = window.setTimeout(() => void persist(qid, v).catch(() => undefined), delay);
  };

  const flushPending = async () => {
    const pending = Object.entries(timers.current);
    for (const [qid, t] of pending) {
      window.clearTimeout(t);
      delete timers.current[qid];
      if (drafts[qid] !== undefined && saves[qid] !== 'saved') await persist(qid, drafts[qid]).catch(() => undefined);
    }
  };

  const go = async (next: number) => {
    await flushPending();
    setPos(Math.max(0, Math.min(questions.length, next)));
  };

  /** One box at a time: judged by the server, so the key never leaves it. */
  const markSpot = async (b: SpotBox) => {
    if (pendingMark || isLocked) return;
    const qid = question.id;
    setPendingMark(b);
    setActionError(null);
    try {
      const res = await publicApi.spotMark(state.attemptId, token, qid, { ...b, seq: seq.current++ });
      setSpots((m) => ({ ...m, [qid]: res.spot }));
      if (res.outcome === 'recorded') setSpotNote({ kind: 'recorded', left: res.spot.maxMarks - res.spot.drawn.length });
      else if (res.outcome === 'hit' && res.hit) setSpotNote({ kind: 'hit', label: res.hit.region.label, n: res.hit.index + 1 });
      else if (res.outcome === 'repeat') {
        const near = [...(spots[qid]?.found ?? [])].sort((f, g) => overlapWith(g.region, b) - overlapWith(f.region, b))[0];
        setSpotNote({ kind: 'repeat', n: (near?.index ?? 0) + 1 });
      }
      else setSpotNote({ kind: 'miss', left: res.spot.maxMisses > 0 ? Math.max(0, res.spot.maxMisses - res.spot.misses) : null });
      if (res.answer.locked) setLocked((m) => ({ ...m, [qid]: true }));
      if (res.reveal) setReveals((m) => ({ ...m, [qid]: res.reveal! }));
      if (res.revealText) setClues((m) => ({ ...m, [qid]: res.revealText! }));
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'submitted' || e.code === 'time_up')) finishBecause();
      else if (e instanceof ApiError && e.code === 'locked') setLocked((m) => ({ ...m, [qid]: true }));
      else setActionError(errorMessage(e));
    } finally {
      setPendingMark(null);
    }
  };

  /** "I'm done": lock the spot question and reveal what was missed. */
  const finishSpot = async () => {
    if (busy || isLocked) return;
    setBusy(true);
    try {
      await persist(question.id, null, true);
      setSpots((m) => (m[question.id] ? { ...m, [question.id]: { ...m[question.id], locked: true } } : m));
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const primary = async () => {
    if (busy) return;
    setActionError(null);
    // Already settled: move on.
    if (isLocked) {
      if (pos >= questions.length - 1) return linear ? submit.mutate() : go(questions.length);
      return go(pos + 1);
    }
    if (!linear) return go(pos + 1);
    if (isSpot) return finishSpot();
    if (!answered) {
      setActionError(question.required ? 'Answer this question to continue.' : 'Answer this question, or it will be marked unanswered.');
      return;
    }
    setBusy(true);
    try {
      const res = await persist(question.id, value!, true);
      // Linear without instant feedback: confirming moves straight on.
      // Without live feedback, confirming moves straight on, unless there is a clue to read first.
      if (res && !instant && res.answer.locked && !res.revealText) {
        if (pos >= questions.length - 1) submit.mutate();
        else await go(pos + 1);
      }
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Keyboard: 1–9 choose, Enter runs the primary action (outside text fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (reviewing || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable], [role="dialog"]')) return;
      if (e.key === 'Enter' && !target.closest('button, a') && !(isSpot && !isLocked)) {
        e.preventDefault();
        void primary();
        return;
      }
      const n = Number(e.key);
      if (!n || isLocked) return;
      if ((question.type === 'single' || question.type === 'multi') && question.options?.[n - 1]) {
        const id = question.options[n - 1].id;
        if (question.type === 'single') change(id);
        else {
          const cur = Array.isArray(value) ? value : [];
          change(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
        }
      } else if (question.type === 'boolean' && n <= 2) change(n === 1);
      else if (question.type === 'rating' && n <= (question.scaleMax ?? 5)) change(n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const triesLeft = tries[question.id];
  const isLast = pos >= questions.length - 1;
  const primaryLabel = isLocked
    ? isLast
      ? linear
        ? 'Finish'
        : 'Review answers'
      : 'Continue'
    : !linear
      ? isLast
        ? 'Review answers'
        : 'Next'
      : isSpot
        ? 'I’m done'
        : instant
          ? 'Check answer'
          : isLast
            ? 'Finish'
            : 'Confirm and continue';

  const sectionCodes = section.questionIds.map((id) => questions.find((q) => q.id === id)!.code);
  const guide = sectionCodes.length > 1 ? `${sectionCodes[0]}–${sectionCodes[sectionCodes.length - 1].split('·')[1]}` : sectionCodes[0];
  const isDone = (qid: string, type: string) => !!locked[qid] || (type === 'spot_flags' ? spotTouched(qid) : isAnswered(type as never, drafts[qid]));
  const doneIds = new Set(questions.filter((q) => (linear ? locked[q.id] : isDone(q.id, q.type))).map((q) => q.id));
  const answeredCount = doneIds.size;

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <header className="on-shell sticky top-0 z-30 bg-graphite">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <Link to={`/a/${slug}`} className="hidden shrink-0 rounded-xs sm:block" aria-label="Activity details">
            <Wordmark sub="" />
          </Link>
          {reviewing ? (
            <span className="text-sm font-bold text-shell-fg">Review</span>
          ) : (
            <ExhibitTag index={section.index} title={evidence ? section.title || undefined : undefined} tone="shell" className="min-w-0 max-w-[55vw] sm:max-w-md" />
          )}
          {!reviewing ? <span className="hidden font-mono text-xs text-shell-muted md:inline">{guide}</span> : null}
          <span className="ml-auto text-xs font-semibold text-shell-muted tabular-nums">
            {answeredCount}/{questions.length}
          </span>
          {state.deadlineAt ? <Countdown deadlineAt={state.deadlineAt} offsetMs={offset} onExpire={finishBecause} /> : null}
        </div>
        <ProgressTrack
          state={state}
          pos={pos}
          locked={locked}
          doneIds={doneIds}
          reveals={reveals}
          onJump={linear ? undefined : (i) => void go(i)}
        />
      </header>

      {reviewing ? (
        <ReviewScreen
          state={state}
          doneIds={doneIds}
          onJump={(i) => void go(i)}
          onSubmit={() => submit.mutate()}
          submitting={submit.isPending}
          error={actionError}
        />
      ) : (
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:pt-8 lg:pb-12">
          <div className={cn('grid gap-6 lg:gap-10', evidence ? 'lg:grid-cols-[minmax(0,1.6fr)_minmax(380px,1fr)]' : 'mx-auto max-w-2xl')}>
            {evidence ? (
              <section aria-label="Evidence" className="lg:sticky lg:top-[88px] lg:self-start">
                <EvidencePlate
                  image={evidence}
                  highlights={isSpot && spot && !reveal ? spot.found.map((f) => f.region) : reveal?.highlights}
                  revealed={!!reveal || (isSpot && !!spot && spot.found.length > 0)}
                  answerRegions={question.type === 'hotspot' ? reveal?.correct?.regions : undefined}
                  point={question.type === 'hotspot' && value && typeof value === 'object' && !Array.isArray(value) && 'x' in value ? value : null}
                  onPoint={question.type === 'hotspot' && !isLocked ? (p) => change(p) : undefined}
                  {...(isSpot && spot
                    ? {
                        onMark: !isLocked ? (b: SpotBox) => void markSpot(b) : undefined,
                        markLabel: spot.silent ? 'Mark it' : 'Check',
                        pendingMark,
                        missMarks: spot.missMarks,
                        drawnMarks: spot.silent ? spot.drawn : undefined,
                        regionNumber: reveal ? undefined : (_r: unknown, i: number) => spot.found[i].index + 1,
                        regionTone: reveal ? (_r: unknown, i: number) => (spot.found.some((f) => f.index === i) ? 'correct' : 'missed') : undefined,
                      }
                    : {})}
                  activeId={activeMarker}
                  onActiveChange={setActiveMarker}
                  maxHeight="min(70vh, 760px)"
                  stripOnMobile={!reveal && question.type !== 'hotspot' && !isSpot}
                  caption={
                    <>
                      <span className="font-semibold text-ink-2">{evidence.alt || section.title}</span>
                      <span>Zoom with + or a double-click; pinch on touch screens.</span>
                    </>
                  }
                />
                {section.intro ? <CaseNote text={section.intro} open={firstInSection} className="mt-4" /> : null}
              </section>
            ) : null}

            <section aria-labelledby={promptId} className="min-w-0">
              {!evidence ? (
                <div className="mb-6">
                  <h1 className="text-2xl leading-tight font-extrabold tracking-[-0.015em] text-ink sm:text-[1.625rem]">{section.title}</h1>
                  {section.intro ? (
                    <div className="mt-4 rounded-xs bg-surface px-5 py-4 ring-1 ring-line">
                      <Prompt text={section.intro} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <h2 id={promptId}>
                <Prompt text={question.prompt} size="lg" className="text-[1.3rem] leading-[1.45]" />
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
                <CodeChip>{question.code}</CodeChip>
                <span>
                  {pos + 1} of {questions.length}
                </span>
                {question.bonus ? <span className="font-bold text-manila-ink">Bonus</span> : question.points !== 1 ? <span>{question.points} points</span> : null}
                {!linear ? <SaveIndicator status={saves[question.id]} onRetry={() => void persist(question.id, value!).catch(() => undefined)} /> : null}
              </div>

              <div className="mt-5">
                {isSpot && spot ? (
                  <SpotPanel spot={spot} reveal={reveal} note={spotNote} onDone={!linear ? () => void finishSpot() : undefined} busy={busy} />
                ) : (
                  <AnswerInput question={question} value={value} onChange={change} locked={isLocked} reveal={reveal} onEnter={() => void primary()} labelledBy={promptId} />
                )}
              </div>

              {triesLeft !== undefined && !isLocked ? (
                <p className="animate-stamp-in mt-4 flex items-center gap-2 rounded-xs bg-red-wash px-3.5 py-2.5 text-[15px] font-semibold text-red-ink" role="status">
                  <CircleAlert className="size-4 shrink-0" aria-hidden />
                  Not quite. {triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left.
                </p>
              ) : null}

              {reveal ? (
                <div className="mt-6 grid gap-4" aria-live="polite">
                  <Verdict reveal={reveal} />
                  {!isSpot ? <CorrectAnswerText question={question} reveal={reveal} /> : null}
                  {reveal.highlights.length && !isSpot ? (
                    <div>
                      <p className="mb-2 text-[13px] font-bold text-ink-3">Marked on the evidence</p>
                      <EvidenceLog regions={reveal.highlights} activeId={activeMarker} onActiveChange={setActiveMarker} />
                    </div>
                  ) : null}
                  <LearningPoint text={reveal.explanation} />
                </div>
              ) : null}
              {clues[question.id] && isLocked ? (
                <div className="mt-4">
                  <NextClue text={clues[question.id]} />
                </div>
              ) : null}

              {actionError ? (
                <p className="mt-4 rounded-xs bg-red-wash px-3.5 py-2.5 text-sm font-semibold text-red-ink" role="alert">
                  {actionError}
                </p>
              ) : null}

              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ground/95 px-4 py-3 backdrop-blur-sm sm:px-6 lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <div className="mx-auto flex max-w-[1440px] items-center gap-3">
                  {!linear && pos > 0 ? (
                    <Button variant="outline" size="lg" onClick={() => void go(pos - 1)}>
                      <ArrowLeft /> Previous
                    </Button>
                  ) : null}
                  <Button
                    size="lg"
                    variant={isLocked || !linear || !instant ? 'ink' : 'default'}
                    className="ml-auto min-w-40 flex-1 sm:flex-none lg:ml-0"
                    disabled={busy || submit.isPending || (linear && !isLocked && !answered && !isSpot)}
                    onClick={() => void primary()}
                  >
                    {busy || submit.isPending ? <Loader2 className="animate-spin" /> : null}
                    {primaryLabel}
                    {!busy && !submit.isPending ? <ArrowRight /> : null}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}

/** The section's case note: open on its first question, folded away after that. */
function CaseNote({ text, open, className }: { text: string; open: boolean; className?: string }) {
  return (
    <details key={String(open)} open={open} className={cn('group/note max-w-[65ch]', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open/note:rotate-90" aria-hidden />
        Case note
      </summary>
      <Prompt text={text} size="sm" className="mt-2 text-[15px] text-ink-2" />
    </details>
  );
}

function SaveIndicator({ status, onRetry }: { status?: SaveStatus; onRetry: () => void }) {
  if (!status) return null;
  if (status === 'error') {
    return (
      <button type="button" onClick={onRetry} className="font-semibold text-red-ink underline underline-offset-2">
        Not saved — retry
      </button>
    );
  }
  return <span aria-live="polite">{status === 'saving' ? 'Saving…' : 'Saved'}</span>;
}

function ProgressTrack({
  state,
  pos,
  locked,
  doneIds,
  reveals,
  onJump,
}: {
  state: AttemptState;
  pos: number;
  locked: Record<string, boolean>;
  doneIds: Set<string>;
  reveals: Record<string, Reveal>;
  onJump?: (i: number) => void;
}) {
  const index = new Map(state.questions.map((q, i) => [q.id, i]));
  return (
    <nav aria-label="Progress" className="mx-auto flex max-w-[1440px] gap-2 px-4 pb-2.5 sm:px-6">
      {state.sections.map((s) => (
        <div key={s.id} className="flex min-w-0 gap-[3px]" style={{ flexGrow: s.questionIds.length, flexBasis: 0 }}>
          {s.questionIds.map((qid) => {
            const i = index.get(qid)!;
            const q = state.questions[i];
            const r = reveals[qid];
            const done = locked[qid] || doneIds.has(qid);
            const tone =
              i === pos
                ? 'bg-marker'
                : r?.isCorrect === true
                  ? 'bg-ledger'
                  : r?.isCorrect === false
                    ? 'bg-evidence'
                    : done
                      ? 'bg-shell-muted'
                      : 'bg-graphite-3';
            const verdict = r?.isCorrect === true ? ', correct' : r?.isCorrect === false ? ', wrong' : done ? ', answered' : '';
            const label = `${q.code}${verdict}${i === pos ? ', current' : ''}`;
            return onJump ? (
              <button key={qid} type="button" aria-label={label} aria-current={i === pos ? 'step' : undefined} onClick={() => onJump(i)} className="group/cell flex h-4 min-w-1 flex-1 items-center">
                <span className={cn('h-1.5 w-full rounded-[1px] transition-colors group-hover/cell:h-2.5', tone)} />
              </button>
            ) : (
              <span key={qid} aria-label={label} className="flex h-4 min-w-1 flex-1 items-center">
                <span className={cn('h-1.5 w-full rounded-[1px]', tone)} />
              </span>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function ReviewScreen({
  state,
  doneIds,
  onJump,
  onSubmit,
  submitting,
  error,
}: {
  state: AttemptState;
  doneIds: Set<string>;
  onJump: (i: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const unanswered = state.questions.filter((q) => !doneIds.has(q.id));
  const byId = new Map(state.questions.map((q, i) => [q.id, { q, i }]));
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-[1.625rem] leading-tight font-extrabold tracking-[-0.015em] text-ink">Review before you submit</h1>
      <p className="mt-2 text-[17px] leading-7 text-ink-2">
        {unanswered.length
          ? `${unanswered.length} question${unanswered.length === 1 ? ' is' : 's are'} still unanswered. Select any question to go back to it.`
          : 'Every question has an answer. Select any question to change it, or submit.'}
      </p>
      <div className="mt-8 grid gap-6">
        {state.sections.map((s) => (
          <section key={s.id}>
            <ExhibitTag index={s.index} title={s.title || undefined} />
            <ol className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
              {s.questionIds.map((qid) => {
                const { q, i } = byId.get(qid)!;
                const done = doneIds.has(qid);
                return (
                  <li key={qid}>
                    <button
                      type="button"
                      onClick={() => onJump(i)}
                      className={cn(
                        'flex h-11 w-full items-center justify-center gap-1.5 rounded-xs border font-mono text-xs font-bold transition-colors',
                        done ? 'border-graphite bg-graphite text-shell-fg hover:bg-graphite-2' : 'border-dashed border-line-strong bg-surface text-ink-3 hover:border-ink-3 hover:text-ink',
                      )}
                      aria-label={`${q.code}${done ? ', answered' : ', not answered'}`}
                    >
                      {q.code.split('·')[1]}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {error ? (
        <p className="mt-6 rounded-xs bg-red-wash px-3.5 py-2.5 text-sm font-semibold text-red-ink" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Button variant="outline" size="lg" onClick={() => onJump(state.questions.length - 1)}>
          <ArrowLeft /> Back to questions
        </Button>
        <Button size="lg" className="ml-auto" onClick={() => setConfirm(true)} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}
          Submit answers
        </Button>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription>
              You cannot change them afterwards.
              {unanswered.length ? ` ${unanswered.length} unanswered question${unanswered.length === 1 ? '' : 's'} will score zero.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmit}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function PlayerSkeleton() {
  return (
    <div className="min-h-dvh bg-ground" aria-busy="true">
      <div className="h-[74px] bg-graphite" />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 pt-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(380px,1fr)]">
        <div className="aspect-[3/2] animate-pulse rounded-xs bg-ground-2" />
        <div className="space-y-4">
          <div className="h-5 w-24 animate-pulse rounded-xs bg-ground-2" />
          <div className="h-16 animate-pulse rounded-xs bg-ground-2" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xs bg-ground-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
