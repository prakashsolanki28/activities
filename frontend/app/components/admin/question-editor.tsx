import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { questionIssues, type Option, type Question, type QuestionType, type Section } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Switch } from '~/components/ui/switch';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Field } from '~/components/field';
import { ChipsInput } from './chips-input';
import { ImageField } from './image-field';
import { RegionEditor } from './region-editor';
import { MessageBar } from './ui';
import { TYPE_META, TYPE_ORDER, withTypeDefaults } from '~/lib/question-types';
import { newId } from '~/lib/ids';
import { cn } from '~/lib/utils';

interface Props {
  question: Question;
  section: Section;
  onChange: (q: Question) => void;
  structureLocked: boolean;
  /** Right/wrong shown while answering, so "tries" means something. */
  liveFeedback: boolean;
}

const ANSWER_HEADING: Record<QuestionType, string> = {
  single: 'Answers: select the correct one',
  multi: 'Answers: tick every correct one',
  boolean: 'Correct answer',
  short_text: 'Accepted answers',
  list_text: 'What counts as a correct answer',
  long_text: 'Marking',
  number: 'Correct number',
  ordering: 'Steps, in the correct order',
  hotspot: 'Correct area on the picture',
  rating: 'Scale',
  spot_flags: 'Red flags on the screenshot',
};

/** Edits one question inside its card: text, type, answers, then "More options". */
export function QuestionEditor({ question: q, section, onChange, structureLocked, liveFeedback }: Props) {
  const set = <K extends keyof Question>(key: K, value: Question[K]) => onChange({ ...q, [key]: value });
  const issues = questionIssues(q, section);
  const evidence = q.image ?? section.image ?? null;
  const [showPicture, setShowPicture] = useState(!!q.image);
  const usesSectionPicture = q.type === 'hotspot' || q.type === 'spot_flags';

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Textarea
          aria-label="Question"
          value={q.prompt}
          onChange={(e) => set('prompt', e.target.value)}
          className="min-h-12 flex-1 border-0 border-b border-line-strong bg-ground px-3 py-2.5 text-[15px] shadow-none focus-visible:border-brand focus-visible:shadow-[0_1px_0_0_var(--brand)]"
          placeholder="Question"
          rows={1}
        />
        <Select value={q.type} onValueChange={(t) => onChange(withTypeDefaults(q, t as QuestionType))} disabled={structureLocked}>
          <SelectTrigger className="h-10 w-full sm:w-56" aria-label="Question type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_ORDER.map((t) => {
              const M = TYPE_META[t];
              return (
                <SelectItem key={t} value={t}>
                  <M.icon className="size-4" />
                  {M.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {showPicture || q.image ? (
        <Field label={usesSectionPicture ? 'Picture to use (optional)' : 'Picture'} hint={usesSectionPicture ? 'Leave empty to use the section screenshot.' : 'Shown with this question instead of the section screenshot.'}>
          {() => <ImageField value={q.image} onChange={(v) => set('image', v)} label="picture" />}
        </Field>
      ) : (
        <button type="button" onClick={() => setShowPicture(true)} className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
          <ImagePlus className="size-4" aria-hidden /> Add a picture to this question
        </button>
      )}

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-ink">{ANSWER_HEADING[q.type]}</h3>
        <AnswerKey q={q} set={set} onChange={onChange} evidence={evidence} />
      </section>

      {issues.length ? (
        <MessageBar intent="warning">
          <span className="font-semibold">Before you share: </span>
          {issues.join(' ')}
        </MessageBar>
      ) : null}

      <details className="group/more rounded-md bg-ground">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[13px] font-semibold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 transition-transform group-open/more:rotate-90" aria-hidden />
          More options
          <span className="font-normal text-ink-3">explanation, next clue{liveFeedback ? ', tries' : ''}, bonus</span>
        </summary>
        <div className="grid gap-4 px-3 pt-1 pb-4">
          <Field label="Explanation" optional hint="Shown with the correct answer when results are visible.">
            {(p) => <Textarea {...p} value={q.explanation} onChange={(e) => set('explanation', e.target.value)} placeholder="Why this is the answer, in a sentence or two." />}
          </Field>
          <Field label="Next clue" optional hint="Treasure hunts: shown after the employee answers, even while results are held.">
            {(p) => <Textarea {...p} value={q.revealText} onChange={(e) => set('revealText', e.target.value)} className="min-h-16" />}
          </Field>
          {liveFeedback && q.type !== 'spot_flags' ? (
            <Field label="Tries" hint="How many attempts before the answer locks.">
              {(p) => (
                <Select value={String(q.maxTries)} onValueChange={(v) => set('maxTries', Number(v))}>
                  <SelectTrigger {...p} className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? 'try' : 'tries'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          ) : null}
          <Toggle label="Bonus question" hint="Adds to the score but not to the maximum." checked={q.bonus} onChange={(v) => set('bonus', v)} />
          {section.image && !usesSectionPicture ? (
            <Field label="Highlight red flags on the screenshot" optional hint="Numbered markers appear on these spots when results are shown.">
              {() => <RegionEditor image={section.image!} regions={q.highlights} onChange={(r) => set('highlights', r)} emptyHint="Drag on the screenshot to box a red flag." />}
            </Field>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        {hint ? <span className="block text-xs leading-5 text-ink-3">{hint}</span> : null}
      </span>
    </label>
  );
}

type Setter = <K extends keyof Question>(key: K, value: Question[K]) => void;

function AnswerKey({ q, set, onChange, evidence }: { q: Question; set: Setter; onChange: (q: Question) => void; evidence: Question['image'] }) {
  switch (q.type) {
    case 'single':
    case 'multi':
      return <OptionsEditor q={q} set={set} />;
    case 'boolean':
      return (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="First button">{(p) => <Input {...p} value={q.trueLabel} onChange={(e) => set('trueLabel', e.target.value)} className="w-36" maxLength={40} />}</Field>
            <Field label="Second button">{(p) => <Input {...p} value={q.falseLabel} onChange={(e) => set('falseLabel', e.target.value)} className="w-36" maxLength={40} />}</Field>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...q, trueLabel: 'True', falseLabel: 'False' })}>
              Use True / False
            </Button>
          </div>
          <div>
            <Label className="text-[13px] font-semibold text-ink">Correct answer</Label>
            <div className="mt-1.5 flex gap-2" role="radiogroup">
              {[true, false].map((v) => (
                <Button key={String(v)} type="button" role="radio" aria-checked={q.correctBoolean === v} variant={q.correctBoolean === v ? 'ink' : 'outline'} onClick={() => set('correctBoolean', v)}>
                  {q.correctBoolean === v ? <Check /> : null}
                  {v ? q.trueLabel : q.falseLabel}
                </Button>
              ))}
            </div>
          </div>
        </div>
      );
    case 'short_text':
      return (
        <div className="grid gap-3">
          <Field label="Accepted answers" hint="Press Enter after each. Matching ignores case, punctuation and “a/an/the”; a short answer can sit inside a sentence (“It is MFA”).">
            {(p) => <ChipsInput id={p.id} value={q.acceptedAnswers} onChange={(v) => set('acceptedAnswers', v)} placeholder="e.g. MFA, Multi-factor authentication" />}
          </Field>
          <Toggle label="Allow small typos" hint="Never for answers of 4 letters or fewer. Turn off for codes and ciphers." checked={q.allowTypos} onChange={(v) => set('allowTypos', v)} />
        </div>
      );
    case 'list_text':
      return <KeywordGroupsEditor q={q} set={set} />;
    case 'long_text':
      return (
        <Toggle
          label="Mark by hand"
          hint="On: worth points, and each answer waits in Responses for you to grade. Off: collected but not scored."
          checked={q.manualReview}
          onChange={(v) => set('manualReview', v)}
        />
      );
    case 'number':
      return (
        <div className="flex flex-wrap gap-3">
          <Field label="Correct number">
            {(p) => <Input {...p} type="number" value={q.correctNumber ?? ''} onChange={(e) => set('correctNumber', e.target.value === '' ? null : Number(e.target.value))} className="w-36 font-mono" />}
          </Field>
          <Field label="Accept within ±">
            {(p) => <Input {...p} type="number" min={0} value={q.tolerance} onChange={(e) => set('tolerance', Math.max(0, Number(e.target.value) || 0))} className="w-28 font-mono" />}
          </Field>
          <Field label="Unit" optional>{(p) => <Input {...p} value={q.unit} onChange={(e) => set('unit', e.target.value)} className="w-28" maxLength={20} />}</Field>
        </div>
      );
    case 'ordering':
      return <OrderEditor q={q} set={set} />;
    case 'spot_flags':
      return evidence ? (
        <div className="grid gap-3">
          <p className="text-xs leading-5 text-ink-3">
            Draw a box around every red flag and name it. Employees draw boxes around what they think is wrong; each flag they find drops its numbered marker and shows its name. Points are shared equally between the flags.
          </p>
          <RegionEditor image={evidence} regions={q.regions} onChange={(r) => set('regions', r)} emptyHint="Drag on the screenshot to box the first red flag." />
          <Field label="Wrong guesses allowed" hint="Boxes that miss every flag. When they run out, the rest are revealed. Used when results show right away.">
            {(p) => (
              <Select value={String(q.maxMisses)} onValueChange={(v) => set('maxMisses', Number(v))}>
                <SelectTrigger {...p} className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 7, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? 'guess' : 'guesses'}
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Unlimited</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      ) : (
        <p className="text-sm text-ink-3">Add a screenshot above, or as the section’s evidence, then box each red flag on it.</p>
      );
    case 'hotspot':
      return evidence ? (
        <RegionEditor image={evidence} regions={q.regions} onChange={(r) => set('regions', r)} variant="answer" emptyHint="Drag on the image to outline the correct area. A tap anywhere inside it counts." />
      ) : (
        <p className="text-sm text-ink-3">Add an image above, or evidence on the section, then outline the correct area.</p>
      );
    case 'rating':
      return (
        <div className="flex flex-wrap gap-3">
          <Field label="Scale">
            {(p) => (
              <Select value={String(q.scaleMax)} onValueChange={(v) => set('scaleMax', Number(v))}>
                <SelectTrigger {...p} size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 7, 10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      1 – {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Low end label" optional>{(p) => <Input {...p} value={q.minLabel} onChange={(e) => set('minLabel', e.target.value)} placeholder="Not useful" maxLength={60} />}</Field>
          <Field label="High end label" optional>{(p) => <Input {...p} value={q.maxLabel} onChange={(e) => set('maxLabel', e.target.value)} placeholder="Very useful" maxLength={60} />}</Field>
        </div>
      );
  }
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function OptionsEditor({ q, set }: { q: Question; set: Setter }) {
  const multi = q.type === 'multi';
  const update = (id: string, patch: Partial<Option>) => set('options', q.options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const markCorrect = (id: string) =>
    set(
      'options',
      q.options.map((o) => (multi ? (o.id === id ? { ...o, correct: !o.correct } : o) : { ...o, correct: o.id === id })),
    );
  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-3">{multi ? 'Tick every correct option.' : 'Select the one correct option.'}</p>
      <ol className="grid gap-1.5">
        {q.options.map((o, i) => (
          <li key={o.id} className={cn('flex items-center gap-1.5 rounded-xs p-1', o.correct && 'bg-green-wash')}>
            <button
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={o.correct}
              aria-label={`Mark option ${i + 1} correct`}
              onClick={() => markCorrect(o.id)}
              className={cn(
                'grid size-7 shrink-0 place-items-center border-[1.5px] transition-colors',
                multi ? 'rounded-[2px]' : 'rounded-full',
                o.correct ? 'border-ok bg-ok text-white' : 'border-line-strong bg-surface text-transparent hover:border-ink-3',
              )}
            >
              <Check className="size-4" strokeWidth={3} />
            </button>
            <Input aria-label={`Option ${i + 1}`} value={o.label} onChange={(e) => update(o.id, { label: e.target.value })} placeholder={`Option ${i + 1}`} className="h-9" maxLength={500} />
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant={o.image ? 'secondary' : 'ghost'} size="icon-sm" aria-label={`Image for option ${i + 1}`}>
                  {o.image ? <img src={o.image.url} alt="" className="size-6 rounded-[1px] object-cover" /> : <ImagePlus />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <ImageField value={o.image} onChange={(v) => update(o.id, { image: v })} label="option image" />
              </PopoverContent>
            </Popover>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => set('options', move(q.options, i, i - 1))}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === q.options.length - 1} onClick={() => set('options', move(q.options, i, i + 1))}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove option ${i + 1}`} disabled={q.options.length <= 2} onClick={() => set('options', q.options.filter((x) => x.id !== o.id))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={q.options.length >= 12} onClick={() => set('options', [...q.options, { id: newId(), label: '', image: null, correct: false }])}>
          <Plus /> Add option
        </Button>
        {multi ? (
          <Select value={q.multiScoring} onValueChange={(v) => set('multiScoring', v as Question['multiScoring'])}>
            <SelectTrigger size="sm" aria-label="Scoring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_or_nothing">All or nothing</SelectItem>
              <SelectItem value="partial">Partial credit (wrong picks subtract)</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}

function KeywordGroupsEditor({ q, set }: { q: Question; set: Setter }) {
  const update = (id: string, patch: Partial<Question['keywordGroups'][number]>) => set('keywordGroups', q.keywordGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <Field label="Answer boxes">
          {(p) => <Input {...p} type="number" min={1} max={12} value={q.inputCount} onChange={(e) => set('inputCount', Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="w-24" />}
        </Field>
        <Field label="Needed for full marks">
          {(p) => <Input {...p} type="number" min={1} max={12} value={q.minGroups} onChange={(e) => set('minGroups', Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="w-24" />}
        </Field>
      </div>
      <p className="text-xs leading-5 text-ink-3">
        Each group is one red flag with the words that count for it. Each box can match one group and each group counts once, so pasting every keyword into one box earns one point.
      </p>
      <ol className="grid gap-2">
        {q.keywordGroups.map((g, i) => (
          <li key={g.id} className="grid gap-1.5 rounded-xs p-2.5 ring-1 ring-line sm:grid-cols-[12rem_1fr_auto] sm:items-start">
            <Input aria-label={`Group ${i + 1} name`} value={g.label} onChange={(e) => update(g.id, { label: e.target.value })} placeholder={`Red flag ${i + 1}`} className="h-9" />
            <ChipsInput value={g.keywords} onChange={(k) => update(g.id, { keywords: k })} placeholder="Words that count, e.g. urgent, hurry" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove group ${i + 1}`} onClick={() => set('keywordGroups', q.keywordGroups.filter((x) => x.id !== g.id))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => set('keywordGroups', [...q.keywordGroups, { id: newId(), label: '', keywords: [] }])}>
        <Plus /> Add red flag
      </Button>
    </div>
  );
}

function OrderEditor({ q, set }: { q: Question; set: Setter }) {
  const [draft, setDraft] = useState('');
  return (
    <div className="grid gap-3">
      <p className="text-xs text-ink-3">List the steps in the correct order. Employees get them shuffled.</p>
      <ol className="grid gap-1.5">
        {q.orderItems.map((item, i) => (
          <li key={item.id} className="flex items-center gap-1.5">
            <span className="w-6 text-center text-sm font-semibold text-ink-3 tabular-nums">{i + 1}</span>
            <Input value={item.label} aria-label={`Step ${i + 1}`} onChange={(e) => set('orderItems', q.orderItems.map((x) => (x.id === item.id ? { ...x, label: e.target.value } : x)))} className="h-9" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => set('orderItems', move(q.orderItems, i, i - 1))}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === q.orderItems.length - 1} onClick={() => set('orderItems', move(q.orderItems, i, i + 1))}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove step ${i + 1}`} disabled={q.orderItems.length <= 2} onClick={() => set('orderItems', q.orderItems.filter((x) => x.id !== item.id))}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          set('orderItems', [...q.orderItems, { id: newId(), label: draft.trim() }]);
          setDraft('');
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a step" className="h-9 max-w-xs" />
        <Button type="submit" variant="outline" size="sm" disabled={!draft.trim() || q.orderItems.length >= 12}>
          <Plus /> Add
        </Button>
      </form>
    </div>
  );
}
