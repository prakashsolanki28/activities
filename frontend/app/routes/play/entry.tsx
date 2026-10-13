import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowRight, Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import type { AttemptState, PublicActivity } from '@hrrl/shared';
import type { Route } from './+types/entry';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Field, fieldError } from '~/components/field';
import { CodeChip, ExhibitTag } from '~/components/evidence/tags';
import { Prompt } from '~/components/evidence/prompt';
import { PublicMessage, PublicShell } from '~/components/play/public-shell';
import { ApiError, errorMessage } from '~/lib/api';
import { clearAttempt, loadAttempt, saveAttempt } from '~/lib/attempt-store';
import { formatDateTime, formatDuration, relativeFromNow } from '~/lib/format';
import { publicApi, publicKeys, useAttemptState, usePublicActivity } from '~/lib/public-api';

export const meta: Route.MetaFunction = () => [{ title: 'Start activity · HRRL Activities' }];

function feedbackCopy(a: PublicActivity): string {
  if (a.liveFeedback) return 'You see whether each answer is right, with its learning point, before you move on.';
  if (a.resultsStatus === 'visible') return 'Answer every question, then submit to see your score and what each exhibit was hiding.';
  if (a.resultsStatus === 'pending') return 'Your answers go to the CISO Office. You can see your score here once they publish the results.';
  return 'Your answers go to the CISO Office. Scores are not shown to participants.';
}

export default function Entry() {
  const { slug = '' } = useParams();
  const activity = usePublicActivity(slug);
  const [stored, setStored] = useState(() => (typeof window === 'undefined' ? null : loadAttempt(slug)));
  const existing = useAttemptState(stored?.attemptId, stored?.token);

  // A stale token (attempt reset by an admin, storage from an old session) falls back to the form.
  useEffect(() => {
    if (existing.error instanceof ApiError && existing.error.status === 401) {
      clearAttempt(slug);
      setStored(null);
    }
  }, [existing.error, slug]);

  if (activity.isPending || (stored && existing.isPending)) return <EntrySkeleton />;
  if (activity.error) {
    return (
      <PublicMessage title="This activity link is not available">
        Check that you opened the full link you were sent. If it still does not work, the activity may have been withdrawn — contact the CISO Office.
      </PublicMessage>
    );
  }

  const a = activity.data;
  return (
    <PublicShell>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
        <CaseFile activity={a} />
        <div className="lg:pt-8">
          {existing.data ? (
            <Briefing state={existing.data} slug={slug} />
          ) : (
            <EntryForm activity={a} slug={slug} onEntered={(s) => setStored(loadAttempt(slug) ?? { attemptId: s.attemptId, token: s.token!, employeeId: s.employeeId, name: s.name })} />
          )}
        </div>
      </div>
    </PublicShell>
  );
}

function CaseFile({ activity: a }: { activity: PublicActivity }) {
  const facts: [string, React.ReactNode][] = [
    ['Questions', `${a.questionCount}${a.sectionCount > 1 ? ` in ${a.sectionCount} parts` : ''}`],
    ['Time limit', a.timeLimitSec ? formatDuration(a.timeLimitSec) : 'None — take your time'],
    ['Results', feedbackCopy(a)],
  ];
  if (a.closesAt) facts.push(['Closes', `${formatDateTime(a.closesAt, true)} IST`]);
  return (
    <section>
      <h1 className="max-w-[22ch] text-3xl leading-[1.15] font-extrabold tracking-[-0.02em] text-ink sm:text-[2.5rem]">{a.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CodeChip>{a.code}</CodeChip>
        <StatusLine activity={a} />
      </div>
      {a.description ? <Prompt text={a.description} className="mt-5 max-w-[60ch] text-ink-2" /> : null}
      {a.outline.length > 1 ? (
        <div className="mt-7 hidden lg:block">
          <h2 className="text-[13px] font-bold text-ink-3">In this case</h2>
          <ol className="mt-2.5 flex max-w-[60ch] flex-wrap gap-1.5">
            {a.outline.map((t, i) => (
              <li key={i}>
                <ExhibitTag index={i} title={t || undefined} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <dl className="mt-8 max-w-[60ch] divide-y divide-line border-y border-line">
        {facts.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
            <dd className="text-[15px] leading-6 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StatusLine({ activity: a }: { activity: PublicActivity }) {
  if (a.status === 'scheduled' && a.opensAt) {
    return <span className="text-[13px] font-semibold text-manila-ink">Opens {relativeFromNow(a.opensAt)}</span>;
  }
  if (a.status === 'closed') return <span className="text-[13px] font-semibold text-red-ink">Closed</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-green-ink">
      <span className="size-1.5 rounded-full bg-ledger" aria-hidden />
      Open now
    </span>
  );
}

const entrySchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  employeeId: z.string().trim().min(1, 'Enter your employee ID'),
  resumeCode: z.string(),
});

function EntryForm({ activity, slug, onEntered }: { activity: PublicActivity; slug: string; onEntered: (s: AttemptState) => void }) {
  const qc = useQueryClient();
  const [needsCode, setNeedsCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const enter = useMutation({
    mutationFn: (v: z.infer<typeof entrySchema>) =>
      publicApi.enter(slug, { name: v.name, employeeId: v.employeeId, ...(needsCode && v.resumeCode ? { resumeCode: v.resumeCode } : {}) }),
    onSuccess: ({ state }) => {
      saveAttempt(slug, { attemptId: state.attemptId, token: state.token!, employeeId: state.employeeId, name: state.name });
      qc.setQueryData(publicKeys.attempt(state.attemptId), state);
      onEntered(state);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'resume_code_required') {
        setNeedsCode(true);
        setFormError(null);
        return;
      }
      setFormError(errorMessage(e));
    },
  });

  const form = useForm({
    defaultValues: { name: '', employeeId: '', resumeCode: '' },
    validators: { onSubmit: entrySchema },
    onSubmit: ({ value }) => {
      setFormError(null);
      if (needsCode && !value.resumeCode.trim()) {
        setFormError('Enter the resume code shown when you started.');
        return;
      }
      return enter.mutateAsync(value).catch(() => undefined);
    },
  });

  if (activity.status !== 'live') {
    return (
      <div className="rounded-xs border border-line-strong bg-surface p-6">
        <h2 className="text-lg font-bold text-ink">{activity.status === 'scheduled' ? 'Not open yet' : 'This activity has closed'}</h2>
        <p className="mt-2 text-[15px] leading-6 text-ink-2">
          {activity.status === 'scheduled' && activity.opensAt
            ? `It opens on ${formatDateTime(activity.opensAt, true)} IST. Come back to this link then.`
            : 'New entries are no longer accepted. If you already took part, use the same device to see your result.'}
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-xs border border-line-strong bg-surface p-6 sm:p-7"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2 className="text-lg font-bold text-ink">Who is taking part?</h2>
      <p className="mt-1 text-sm leading-6 text-ink-2">Use the details on your HRRL ID card. One attempt per employee ID.</p>
      <div className="mt-6 grid gap-5">
        <form.Field name="name">
          {(field) => (
            <Field label="Full name" error={fieldError(field.state.meta.errors)}>
              {(p) => (
                <Input
                  {...p}
                  autoComplete="name"
                  className="h-11 text-base"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </Field>
          )}
        </form.Field>
        <form.Field name="employeeId">
          {(field) => (
            <Field label="Employee ID" hint={activity.employeeIdHint || undefined} error={fieldError(field.state.meta.errors)}>
              {(p) => (
                <Input
                  {...p}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="h-11 font-mono text-base tracking-wide"
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    if (needsCode) setNeedsCode(false);
                  }}
                  onBlur={field.handleBlur}
                />
              )}
            </Field>
          )}
        </form.Field>
        {needsCode ? (
          <div className="animate-stamp-in grid gap-3 rounded-xs bg-manila-wash p-4">
            <p className="flex gap-2 text-sm leading-6 text-manila-ink">
              <KeyRound className="mt-1 size-4 shrink-0" aria-hidden />
              This ID already has the activity in progress on another device. Enter the resume code shown when it started.
            </p>
            <form.Field name="resumeCode">
              {(field) => (
                <Field label="Resume code">
                  {(p) => (
                    <Input
                      {...p}
                      autoFocus
                      autoComplete="one-time-code"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={6}
                      className="h-11 font-mono text-lg tracking-[0.3em] uppercase"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                    />
                  )}
                </Field>
              )}
            </form.Field>
            <p className="text-xs leading-5 text-manila-ink/90">Lost the code? Ask the CISO Office to reset your attempt.</p>
          </div>
        ) : null}
      </div>
      {formError ? (
        <p className="mt-5 rounded-xs bg-red-wash px-3 py-2.5 text-sm leading-6 font-semibold text-red-ink" role="alert">
          {formError}
        </p>
      ) : null}
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(submitting) => (
          <Button type="submit" size="xl" className="mt-6 w-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            {needsCode ? 'Resume activity' : 'Continue'}
            {!submitting ? <ArrowRight /> : null}
          </Button>
        )}
      </form.Subscribe>
      <p className="mt-4 text-xs leading-5 text-ink-3">Your name, employee ID and answers are shared with the HRRL CISO Office.</p>
    </form>
  );
}

function Briefing({ state, slug }: { state: AttemptState; slug: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const stored = loadAttempt(slug);

  useEffect(() => {
    if (state.status === 'submitted') navigate(`/a/${slug}/result`, { replace: true });
  }, [state.status, slug, navigate]);

  const start = useMutation({
    mutationFn: () => publicApi.start(state.attemptId, stored!.token),
    onSuccess: (s) => {
      qc.setQueryData(publicKeys.attempt(s.attemptId), s);
      navigate(`/a/${slug}/play`);
    },
  });

  const started = !!state.startedAt;
  const answered = Object.keys(state.answers).length;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.resumeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked; the code is on screen */
    }
  };

  return (
    <section className="rounded-xs border border-line-strong bg-surface p-6 sm:p-7">
      <h2 className="text-lg font-bold text-ink">{started ? 'Pick up where you left off' : 'Before you start'}</h2>
      <p className="mt-1 text-sm text-ink-2">
        Signed in as <span className="font-bold text-ink">{state.name}</span> · <span className="font-mono text-ink">{state.employeeId}</span>
      </p>

      <div className="mt-4 rounded-xs bg-manila-wash p-4">
        <p className="text-[13px] font-semibold text-manila-ink">Your resume code</p>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="font-mono text-[26px] leading-none font-bold tracking-[0.18em] text-ink">{state.resumeCode}</span>
          <Button type="button" variant="outline" size="sm" onClick={copy} aria-label="Copy resume code">
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-manila-ink">Note it down. You need it to continue on a different phone or computer.</p>
      </div>

      <ul className="mt-5 space-y-2.5 text-[15px] leading-6 text-ink-2">
        <li>{feedbackCopy(state.activity)}</li>
        {state.activity.timeLimitSec ? (
          <li>
            You have <strong className="text-ink">{formatDuration(state.activity.timeLimitSec)}</strong>. The clock starts when you press Start and keeps running if you close this page.
          </li>
        ) : null}
        {state.activity.navigation === 'linear' ? <li>Questions come one at a time. Once you move on, you cannot go back.</li> : <li>You can move between questions freely until you submit.</li>}
        {started ? <li>{answered} of {state.questions.length} answered so far.</li> : null}
      </ul>

      {start.error ? (
        <p className="mt-4 rounded-xs bg-red-wash px-3 py-2.5 text-sm font-semibold text-red-ink" role="alert">
          {errorMessage(start.error)}
        </p>
      ) : null}
      <Button size="xl" className="mt-6 w-full" disabled={start.isPending} onClick={() => (started ? navigate(`/a/${slug}/play`) : start.mutate())}>
        {start.isPending ? <Loader2 className="animate-spin" /> : null}
        {started ? 'Continue activity' : 'Start activity'}
        <ArrowRight />
      </Button>
    </section>
  );
}

function EntrySkeleton() {
  return (
    <PublicShell>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16" aria-busy="true">
        <div className="space-y-4">
          <div className="h-5 w-20 animate-pulse rounded-xs bg-ground-2" />
          <div className="h-10 w-4/5 animate-pulse rounded-xs bg-ground-2" />
          <div className="h-24 w-full max-w-[60ch] animate-pulse rounded-xs bg-ground-2" />
        </div>
        <div className="h-80 animate-pulse rounded-xs bg-ground-2 lg:mt-8" />
      </div>
    </PublicShell>
  );
}
