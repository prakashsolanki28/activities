import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { FEEDBACK_MODES, LEADERBOARD_MODES, NAVIGATION_MODES, RESULTS_RELEASE, REVIEW_AVAILABILITY, type AdminActivity, type ResultsRelease } from '@hrrl/shared';
import type { Route } from './+types/settings';
import { useActivityContext } from './layout';
import { Field, fieldError } from '~/components/field';
import { Card, MessageBar } from '~/components/admin/ui';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Switch } from '~/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { ApiError, errorMessage } from '~/lib/api';
import { adminApi, adminKeys } from '~/lib/admin-api';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Settings · HRRL Activities' }];

const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, 'At least 3 characters')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single dashes'),
  completionMessage: z.string().max(4000),
  timeLimitOn: z.boolean(),
  timeLimitMin: z.number().int().min(1, 'At least 1 minute').max(360, 'At most 6 hours'),
  settings: z.object({
    feedbackMode: z.enum(FEEDBACK_MODES),
    resultsRelease: z.enum(RESULTS_RELEASE),
    reviewAvailable: z.enum(REVIEW_AVAILABILITY),
    showScore: z.boolean(),
    navigation: z.enum(NAVIGATION_MODES),
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    leaderboard: z.enum(LEADERBOARD_MODES),
    certificateEnabled: z.boolean(),
    certificateMinPct: z.number().min(0).max(100),
    passingPct: z.number().min(0).max(100),
    employeeIdPattern: z.string().max(200),
    employeeIdHint: z.string().max(120),
  }),
});
type Values = z.infer<typeof schema>;

const RELEASE: { value: ResultsRelease; title: string; body: string }[] = [
  { value: 'manual', title: 'After I publish them (recommended)', body: 'Employees see “Submitted”. You choose when to show scores, from the Responses tab.' },
  { value: 'immediate', title: 'Right away', body: 'Each person sees their result as soon as they submit.' },
  { value: 'never', title: 'Never', body: 'Only admins see results. Employees just see a thank-you.' },
];

/**
 * Older activities stored "hidden" feedback and "instant" feedback with held results.
 * Both are expressed here in today's terms so the form shows what employees actually get.
 */
function initialValues(a: AdminActivity): Values {
  const { timeLimitSec, ...s } = a.settings;
  const settings = { ...s };
  if (settings.feedbackMode === 'hidden') {
    settings.feedbackMode = 'end';
    settings.resultsRelease = 'never';
  }
  if (settings.resultsRelease !== 'immediate' && settings.feedbackMode === 'instant') {
    settings.feedbackMode = 'end';
    settings.navigation = 'linear';
  }
  return {
    slug: a.slug,
    completionMessage: a.completionMessage,
    timeLimitOn: !!timeLimitSec,
    timeLimitMin: timeLimitSec ? Math.max(1, Math.round(timeLimitSec / 60)) : 10,
    settings,
  };
}

type IdCheck = 'any' | 'digits' | 'exact' | 'custom';
function idCheckOf(pattern: string): { mode: IdCheck; digits: number } {
  if (!pattern) return { mode: 'any', digits: 8 };
  if (pattern === '^[0-9]+$' || pattern === '^\\d+$') return { mode: 'digits', digits: 8 };
  const m = /^\^\[0-9\]\{(\d+)\}\$$/.exec(pattern) ?? /^\^\\d\{(\d+)\}\$$/.exec(pattern);
  if (m) return { mode: 'exact', digits: Number(m[1]) };
  return { mode: 'custom', digits: 8 };
}

export default function Settings() {
  const { activity } = useActivityContext();
  const qc = useQueryClient();
  const [idCheck, setIdCheck] = useState(() => idCheckOf(activity.settings.employeeIdPattern));

  const form = useForm({
    defaultValues: initialValues(activity),
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (value.settings.employeeIdPattern) {
        try {
          new RegExp(value.settings.employeeIdPattern);
        } catch {
          toast.error('The ID pattern is not valid. Check it, or choose another option.');
          return;
        }
      }
      try {
        const current = qc.getQueryData<AdminActivity>(adminKeys.activity(activity._id)) ?? activity;
        const res = await adminApi.update(activity._id, {
          version: current.version,
          slug: value.slug.trim(),
          completionMessage: value.completionMessage,
          settings: { ...value.settings, timeLimitSec: value.timeLimitOn ? value.timeLimitMin * 60 : null },
        });
        qc.setQueryData(adminKeys.activity(activity._id), res);
        void qc.invalidateQueries({ queryKey: adminKeys.activities });
        formApi.reset({ ...value, slug: res.slug });
        toast.success(res.slug !== value.slug ? `Saved. The link is now /a/${res.slug}` : 'Settings saved');
      } catch (e) {
        toast.error(e instanceof ApiError && e.code === 'version_conflict' ? 'Someone else changed this activity. Reload the page to get the latest version.' : errorMessage(e));
      }
    },
  });

  const setIdMode = (mode: IdCheck, digits = idCheck.digits) => {
    setIdCheck({ mode, digits });
    if (mode === 'any') form.setFieldValue('settings.employeeIdPattern', '');
    if (mode === 'digits') form.setFieldValue('settings.employeeIdPattern', '^[0-9]+$');
    if (mode === 'exact') form.setFieldValue('settings.employeeIdPattern', `^[0-9]{${digits}}$`);
  };

  return (
    <form
      noValidate
      className="mx-auto grid max-w-[760px] gap-5 px-4 pt-6 sm:px-8"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {/* ------------------------------------------------ Results */}
      <Section title="Results">
        <form.Field name="settings.resultsRelease">
          {(f) => (
            <fieldset className="py-4">
              <legend className="text-sm font-semibold text-ink">When can employees see their results?</legend>
              <RadioGroup
                value={f.state.value}
                onValueChange={(v) => {
                  f.handleChange(v as ResultsRelease);
                  // Right-or-wrong after each question only exists when results are shown right away.
                  if (v !== 'immediate' && form.getFieldValue('settings.feedbackMode') === 'instant') {
                    form.setFieldValue('settings.feedbackMode', 'end');
                    form.setFieldValue('settings.navigation', 'linear');
                  }
                }}
                className="mt-3 gap-2"
              >
                {RELEASE.map((r) => (
                  <label
                    key={r.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 ring-1 ring-inset transition-colors',
                      f.state.value === r.value ? 'bg-brand-tint ring-brand' : 'ring-line-strong hover:bg-ground',
                    )}
                  >
                    <RadioGroupItem value={r.value} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-semibold text-ink">{r.title}</span>
                      <span className="block text-[13px] leading-5 text-ink-3">{r.body}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {activity.settings.resultsRelease === 'manual' && activity.resultsPublishedAt ? (
                <p className="mt-2 text-[13px] text-ink-3">You have already published results for this activity.</p>
              ) : null}
            </fieldset>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => ({ release: s.values.settings.resultsRelease, mode: s.values.settings.feedbackMode })}>
          {({ release, mode }) =>
            release === 'never' ? null : (
              <>
                {release === 'immediate' ? (
                  <form.Field name="settings.feedbackMode">
                    {(f) => (
                      <SwitchRow
                        label="Show right or wrong after every question"
                        hint="With the learning point and the next clue. Questions come one at a time. Good for treasure hunts and drills."
                        checked={f.state.value === 'instant'}
                        onChange={(on) => f.handleChange(on ? 'instant' : 'end')}
                      />
                    )}
                  </form.Field>
                ) : null}
                {release === 'immediate' && mode !== 'instant' ? (
                  <form.Field name="settings.reviewAvailable">
                    {(f) => (
                      <Row label="Show the correct answers" hint="Waiting until the activity closes stops answers being passed around.">
                        <SelectBox
                          value={f.state.value}
                          onChange={(v) => f.handleChange(v as typeof f.state.value)}
                          options={[
                            ['after_submit', 'As soon as they submit'],
                            ['after_close', 'After the activity closes'],
                          ]}
                        />
                      </Row>
                    )}
                  </form.Field>
                ) : null}
                <form.Field name="settings.showScore">
                  {(f) => <SwitchRow label="Show their score" hint="Turn off to show only which answers were right. The leaderboard needs scores." checked={f.state.value} onChange={f.handleChange} />}
                </form.Field>
              </>
            )
          }
        </form.Subscribe>

        <form.Field name="completionMessage">
          {(f) => (
            <div className="py-4">
              <Field label="Thank-you message" optional hint="Shown after they submit, e.g. your campaign line and how to report a suspicious message.">
                {(p) => <Textarea {...p} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} className="min-h-20" />}
              </Field>
            </div>
          )}
        </form.Field>
      </Section>

      {/* ------------------------------------------------ Questions */}
      <Section title="Questions">
        <form.Subscribe selector={(s) => s.values.settings.feedbackMode === 'instant'}>
          {(instant) => (
            <form.Field name="settings.navigation">
              {(f) => (
                <SwitchRow
                  label="One question at a time, no going back"
                  hint={instant ? 'Always on when right or wrong is shown after every question.' : 'When off, people can move between questions and check their answers before submitting.'}
                  checked={instant || f.state.value === 'linear'}
                  disabled={instant}
                  onChange={(on) => f.handleChange(on ? 'linear' : 'free')}
                />
              )}
            </form.Field>
          )}
        </form.Subscribe>
        <form.Field name="settings.shuffleQuestions">
          {(f) => <SwitchRow label="Shuffle question order" hint="Each person gets the questions in a different order. Sections stay in order." checked={f.state.value} onChange={f.handleChange} />}
        </form.Field>
        <form.Field name="settings.shuffleOptions">
          {(f) => <SwitchRow label="Shuffle answer choices" hint="Leave off if a choice says “All of the above”." checked={f.state.value} onChange={f.handleChange} />}
        </form.Field>
        <form.Field name="timeLimitOn">
          {(f) => <SwitchRow label="Time limit" hint="The clock starts when they press Start. Answers are sent automatically when time runs out." checked={f.state.value} onChange={f.handleChange} />}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.timeLimitOn}>
          {(on) =>
            on ? (
              <form.Field name="timeLimitMin">
                {(f) => (
                  <Row label="Minutes allowed" error={fieldError(f.state.meta.errors)} nested>
                    <NumberBox value={f.state.value} min={1} max={360} suffix="minutes" label="Minutes allowed" onChange={f.handleChange} />
                  </Row>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>
      </Section>

      {/* ------------------------------------------------ Scores */}
      <Section title="Scores">
        <form.Field name="settings.passingPct">
          {(f) => (
            <Row label="Pass mark" hint="Used for the pass rate on the Responses tab.">
              <NumberBox value={f.state.value} min={0} max={100} suffix="%" label="Pass mark" onChange={f.handleChange} />
            </Row>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => ({ release: s.values.settings.resultsRelease, score: s.values.settings.showScore })}>
          {({ release, score }) => (
            <form.Field name="settings.leaderboard">
              {(f) => (
                <Row
                  label="Leaderboard"
                  hint={
                    release === 'never' || !score
                      ? 'Not shown while results or scores are hidden from employees.'
                      : release === 'manual' && !activity.resultsPublishedAt
                        ? 'Appears once you publish results. Employee IDs are partly hidden.'
                        : 'Employee IDs are partly hidden.'
                  }
                >
                  <SelectBox
                    value={f.state.value}
                    onChange={(v) => f.handleChange(v as typeof f.state.value)}
                    options={[
                      ['off', 'Off'],
                      ['after_submit', 'Show to people who have submitted'],
                      ['always', 'Show to everyone, including on a projector'],
                    ]}
                  />
                </Row>
              )}
            </form.Field>
          )}
        </form.Subscribe>
        <form.Field name="settings.certificateEnabled">
          {(f) => <SwitchRow label="Certificate" hint="A printable certificate with a number anyone can check." checked={f.state.value} onChange={f.handleChange} />}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.settings.certificateEnabled}>
          {(on) =>
            on ? (
              <form.Field name="settings.certificateMinPct">
                {(f) => (
                  <Row label="For scores of at least" nested>
                    <NumberBox value={f.state.value} min={0} max={100} suffix="%" label="Certificate minimum score" onChange={f.handleChange} />
                  </Row>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>
      </Section>

      {/* ------------------------------------------------ Link and sign-in */}
      <Section title="Link and sign-in">
        <form.Field name="slug">
          {(f) => (
            <div className="py-4">
              <Field
                label="Link"
                hint={activity.status !== 'draft' ? 'Changing this breaks links and QR codes you have already shared.' : 'The web address employees open.'}
                error={fieldError(f.state.meta.errors)}
              >
                {(p) => (
                  <div className="flex items-center rounded-sm border border-input bg-surface hover:border-ink-3 focus-within:border-brand focus-within:shadow-[0_0_0_1px_var(--brand)]">
                    <span className="pl-3 text-sm text-ink-3">{typeof window === 'undefined' ? '' : window.location.host}/a/</span>
                    <input {...p} value={f.state.value} onChange={(e) => f.handleChange(e.target.value.toLowerCase())} className="h-9 min-w-0 flex-1 bg-transparent pr-3 text-sm text-ink outline-none" spellCheck={false} />
                  </div>
                )}
              </Field>
            </div>
          )}
        </form.Field>
        <Row label="Check employee IDs" hint="Catches typing mistakes and made-up IDs when people sign in.">
          <SelectBox
            value={idCheck.mode}
            onChange={(v) => setIdMode(v as IdCheck)}
            options={[
              ['any', 'Accept any ID'],
              ['digits', 'Numbers only'],
              ['exact', 'An exact number of digits'],
              ['custom', 'Custom pattern (advanced)'],
            ]}
          />
        </Row>
        {idCheck.mode === 'exact' ? (
          <Row label="Digits" nested>
            <NumberBox value={idCheck.digits} min={1} max={20} suffix="digits" label="Number of digits" onChange={(n) => setIdMode('exact', n)} />
          </Row>
        ) : null}
        {idCheck.mode === 'custom' ? (
          <form.Field name="settings.employeeIdPattern">
            {(f) => (
              <div className="py-4 pl-6">
                <Field label="Pattern" hint="A regular expression. For example, ^HR[0-9]{5}$ means HR followed by 5 digits.">
                  {(p) => <Input {...p} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} className="font-mono text-[13px]" spellCheck={false} />}
                </Field>
              </div>
            )}
          </form.Field>
        ) : null}
        <form.Field name="settings.employeeIdHint">
          {(f) => (
            <div className="py-4">
              <Field label="Help text under the ID box" optional>
                {(p) => <Input {...p} value={f.state.value} onChange={(e) => f.handleChange(e.target.value)} placeholder="e.g. 8 digits, printed on your ID card" maxLength={120} />}
              </Field>
            </div>
          )}
        </form.Field>
      </Section>

      <form.Subscribe selector={(s) => ({ dirty: s.isDirty, busy: s.isSubmitting, errors: s.errors })}>
        {({ dirty, busy, errors }) =>
          !dirty && !errors.length ? (
            <div className="h-6" />
          ) : (
            <div className="sticky bottom-0 -mx-4 mt-1 flex flex-wrap items-center gap-3 border-t border-line bg-surface px-4 py-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)] sm:-mx-8 sm:px-8">
              {errors.length ? (
                <MessageBar intent="error" className="py-1.5">
                  Some settings need attention.
                </MessageBar>
              ) : (
                <span className="text-sm font-semibold text-ink">You have unsaved changes</span>
              )}
              <Button
                type="button"
                variant="outline"
                className="ml-auto"
                disabled={!dirty || busy}
                onClick={() => {
                  form.reset();
                  setIdCheck(idCheckOf(activity.settings.employeeIdPattern));
                }}
              >
                Discard
              </Button>
              <Button type="submit" disabled={!dirty || busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          )
        }
      </form.Subscribe>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="px-5 pt-4 pb-1">
      <h2 className="pb-1 text-base font-semibold text-ink">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

/** A setting: what it is on the left, the control on the right. */
function Row({ label, hint, error, nested, children }: { label: string; hint?: string; error?: string; nested?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4', nested && 'pl-6')}>
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {hint ? <p className="mt-0.5 text-[13px] leading-5 text-ink-3">{hint}</p> : null}
        {error ? (
          <p className="mt-0.5 text-[13px] font-semibold text-bad" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SwitchRow({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn('flex items-center justify-between gap-6 py-4', disabled ? 'cursor-default' : 'cursor-pointer')}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[13px] leading-5 text-ink-3">{hint}</span> : null}
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

function SelectBox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumberBox({ value, min, max, suffix, label, onChange }: { value: number; min: number; max: number; suffix: string; label: string; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center gap-2">
      <Input type="number" aria-label={label} min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="w-24" />
      <span className="text-sm text-ink-2">{suffix}</span>
    </span>
  );
}
