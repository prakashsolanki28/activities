import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDown, ArrowUp, Check, CircleCheck, CloudOff, Copy, Eye, Loader2, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { questionIssues, sectionSchema, type AdminActivity, type Question, type QuestionType, type Section } from '@hrrl/shared';
import type { Route } from './+types/builder';
import { useActivityContext } from './layout';
import { QuestionEditor } from '~/components/admin/question-editor';
import { ImageField } from '~/components/admin/image-field';
import { Card, EmptyState, MessageBar } from '~/components/admin/ui';
import { promptText } from '~/components/evidence/prompt';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { ApiError, errorMessage } from '~/lib/api';
import { adminApi, adminKeys } from '~/lib/admin-api';
import { newId } from '~/lib/ids';
import { TYPE_META, TYPE_ORDER, newQuestion } from '~/lib/question-types';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Questions · HRRL Activities' }];

type SaveState = { kind: 'saved'; at?: Date } | { kind: 'pending' } | { kind: 'saving' } | { kind: 'error'; message: string } | { kind: 'conflict' };
interface Draft {
  title: string;
  description: string;
  sections: Section[];
}

export default function Builder() {
  const { activity, openPreview } = useActivityContext();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const structureLocked = activity.attemptCount > 0;
  const liveFeedback = activity.settings.resultsRelease === 'immediate' && activity.settings.feedbackMode === 'instant';

  // The form owns the draft; defaults are captured once so cache updates never clobber edits.
  const [initial] = useState<Draft>(() => ({ title: activity.title, description: activity.description, sections: activity.sections }));
  const form = useForm({ defaultValues: initial });
  const draft = useStore(form.store, (s) => s.values);
  const sections = draft.sections;
  const setSections = useCallback((fn: (prev: Section[]) => Section[]) => form.setFieldValue('sections', fn), [form]);

  /* ---------------- autosave ---------------- */
  const version = useRef(activity.version);
  const lastSaved = useRef(JSON.stringify(initial));
  const inflight = useRef(false);
  const queued = useRef<Draft | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'saved' });

  const persist = useCallback(
    async (d: Draft) => {
      if (inflight.current) {
        queued.current = d;
        return;
      }
      inflight.current = true;
      setSave({ kind: 'saving' });
      const json = JSON.stringify(d);
      try {
        const res = await adminApi.update(activity._id, { version: version.current, title: d.title.trim() || 'Untitled activity', description: d.description, sections: d.sections });
        version.current = res.version;
        lastSaved.current = json;
        qc.setQueryData(adminKeys.activity(activity._id), res);
        void qc.invalidateQueries({ queryKey: adminKeys.activities });
        setSave({ kind: 'saved', at: new Date() });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'version_conflict') setSave({ kind: 'conflict' });
        else if (e instanceof ApiError && e.code === 'structure_locked') {
          toast.error(e.message);
          const server = qc.getQueryData<AdminActivity>(adminKeys.activity(activity._id));
          if (server) {
            const restored = { title: server.title, description: server.description, sections: server.sections };
            lastSaved.current = JSON.stringify(restored);
            form.setFieldValue('sections', server.sections);
          }
          setSave({ kind: 'saved' });
        } else setSave({ kind: 'error', message: errorMessage(e) });
      } finally {
        inflight.current = false;
        const next = queued.current;
        queued.current = null;
        if (next && JSON.stringify(next) !== lastSaved.current) void persist(next);
      }
    },
    [activity._id, form, qc],
  );

  useEffect(() => {
    if (JSON.stringify(draft) === lastSaved.current) return;
    setSave({ kind: 'pending' });
    const t = window.setTimeout(() => void persist(draft), 900);
    return () => window.clearTimeout(t);
  }, [draft, persist]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(form.state.values) !== lastSaved.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [form]);

  /* ---------------- selection: one open card at a time ---------------- */
  const active = params.get('q');
  const setActive = (qid: string | null) => {
    const next = new URLSearchParams(params);
    if (qid) next.set('q', qid);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  // Questions are numbered straight through, like a form.
  const numbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const s of sections) for (const q of s.questions) m.set(q.id, ++n);
    return m;
  }, [sections]);

  /* ---------------- edits ---------------- */
  const updateQuestion = (si: number, q: Question) => setSections((prev) => prev.map((s, i) => (i === si ? { ...s, questions: s.questions.map((x) => (x.id === q.id ? q : x)) } : s)));
  const updateSection = (si: number, s: Section) => setSections((prev) => prev.map((x, i) => (i === si ? s : x)));
  const addQuestion = (si: number, type: QuestionType) => {
    const q = newQuestion(type);
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, questions: [...s.questions, q] } : s)));
    setActive(q.id);
  };
  const duplicateQuestion = (si: number, q: Question) => {
    const copy: Question = {
      ...q,
      id: newId(),
      options: q.options.map((o) => ({ ...o, id: newId() })),
      orderItems: q.orderItems.map((o) => ({ ...o, id: newId() })),
      keywordGroups: q.keywordGroups.map((g) => ({ ...g, id: newId() })),
      highlights: q.highlights.map((r) => ({ ...r, id: newId() })),
      regions: q.regions.map((r) => ({ ...r, id: newId() })),
    };
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const at = s.questions.findIndex((x) => x.id === q.id);
        const questions = [...s.questions];
        questions.splice(at + 1, 0, copy);
        return { ...s, questions };
      }),
    );
    setActive(copy.id);
  };
  const deleteQuestion = (si: number, qid: string) => {
    setSections((prev) => prev.map((s, i) => (i === si ? { ...s, questions: s.questions.filter((x) => x.id !== qid) } : s)));
    setActive(null);
  };
  const moveQuestion = (si: number, qid: string, by: -1 | 1) =>
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const at = s.questions.findIndex((x) => x.id === qid);
        const to = at + by;
        if (at < 0 || to < 0 || to >= s.questions.length) return s;
        const questions = [...s.questions];
        [questions[at], questions[to]] = [questions[to], questions[at]];
        return { ...s, questions };
      }),
    );
  const addSection = () => setSections((prev) => [...prev, sectionSchema.parse({ id: newId(), title: '' })]);
  const deleteSection = (si: number) => setSections((prev) => prev.filter((_, i) => i !== si));
  const moveSection = (si: number, by: -1 | 1) =>
    setSections((prev) => {
      const to = si + by;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[si], next[to]] = [next[to], next[si]];
      return next;
    });

  return (
    <main className="mx-auto max-w-[800px] px-4 pt-5 pb-24 sm:px-6">
      <div className="mb-4 flex min-h-6 items-center justify-end gap-3">
        <SaveIndicator state={save} onRetry={() => void persist(draft)} />
      </div>

      {save.kind === 'conflict' ? (
        <MessageBar
          intent="error"
          className="mb-4"
          action={
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Load latest
            </Button>
          }
        >
          Someone else saved this activity while you were editing, so your latest changes were not saved.
        </MessageBar>
      ) : null}
      {structureLocked ? (
        <MessageBar intent="info" className="mb-4">
          {activity.attemptCount === 1 ? '1 person has' : `${activity.attemptCount} people have`} started this activity, so you can fix wording and answers but not add, remove or change question types. Make a copy of the activity for bigger changes.
        </MessageBar>
      ) : null}

      {/* Title card */}
      <Card className="overflow-hidden">
        <div className="h-2 bg-brand" aria-hidden />
        <div className="grid gap-2 px-6 pt-5 pb-6">
          <form.Field name="title">
            {(f) => (
              <Textarea
                aria-label="Activity title"
                rows={1}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value.replace(/\n/g, ' '))}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="Untitled activity"
                maxLength={200}
                className="field-sizing-content min-h-0 resize-none border-0 border-b border-transparent bg-transparent px-0 py-1 text-2xl leading-8 font-semibold shadow-none hover:border-line-strong focus-visible:border-brand focus-visible:shadow-none sm:text-[28px] sm:leading-9"
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(f) => (
              <Textarea
                aria-label="Description"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                placeholder="Description: what employees should know before they start"
                className="min-h-10 border-0 border-b border-transparent bg-transparent px-0 text-[15px] text-ink-2 shadow-none hover:border-line-strong focus-visible:border-brand focus-visible:shadow-none"
              />
            )}
          </form.Field>
        </div>
      </Card>

      {sections.map((section, si) => (
        <div key={section.id} className="mt-6">
          <SectionCard
            section={section}
            index={si}
            total={sections.length}
            locked={structureLocked}
            onChange={(s) => updateSection(si, s)}
            onMove={(by) => moveSection(si, by)}
            onDelete={() => deleteSection(si)}
          />
          <ol className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            {section.questions.map((q, qi) => (
              <li key={q.id}>
                <QuestionCard
                  question={q}
                  section={section}
                  number={numbers.get(q.id) ?? qi + 1}
                  open={active === q.id}
                  locked={structureLocked}
                  liveFeedback={liveFeedback}
                  first={qi === 0}
                  last={qi === section.questions.length - 1}
                  onOpen={() => setActive(q.id)}
                  onChange={(nq) => updateQuestion(si, nq)}
                  onMove={(by) => moveQuestion(si, q.id, by)}
                  onDuplicate={() => duplicateQuestion(si, q)}
                  onDelete={() => deleteQuestion(si, q.id)}
                  onPreview={() => openPreview(q.id)}
                />
              </li>
            ))}
          </ol>
          {!structureLocked ? <AddQuestion onAdd={(t) => addQuestion(si, t)} /> : null}
        </div>
      ))}

      {!sections.length ? (
        <Card className="mt-6">
          <EmptyState
            title="Add your first section"
            action={
              <Button onClick={addSection}>
                <Plus /> Add section
              </Button>
            }
          >
            A section groups questions about one screenshot or one challenge.
          </EmptyState>
        </Card>
      ) : !structureLocked ? (
        <div className="mt-6 flex justify-center">
          <Button variant="ghost" onClick={addSection}>
            <Plus /> Add section
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state.kind === 'saving' || state.kind === 'pending') {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-ink-3" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (state.kind === 'error') {
    return (
      <button type="button" onClick={onRetry} className="flex items-center gap-1.5 text-[13px] font-semibold text-bad underline underline-offset-2" title={state.message}>
        <CloudOff className="size-3.5" /> Not saved. Try again
      </button>
    );
  }
  if (state.kind === 'conflict') {
    return (
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-bad">
        <AlertTriangle className="size-3.5" /> Not saved
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-ink-3" aria-live="polite">
      <CircleCheck className="size-3.5 text-ok" /> All changes saved
    </span>
  );
}

function SectionCard({
  section,
  index,
  total,
  locked,
  onChange,
  onMove,
  onDelete,
}: {
  section: Section;
  index: number;
  total: number;
  locked: boolean;
  onChange: (s: Section) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const set = <K extends keyof Section>(key: K, value: Section[K]) => onChange({ ...section, [key]: value });
  const [showNote, setShowNote] = useState(!!section.intro);
  return (
    <Card>
      <div className="flex items-center gap-2 rounded-t-lg bg-ground-2 px-5 py-2">
        <span className="text-[13px] font-semibold text-ink-2">
          Section {index + 1} of {total}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label={`Section ${index + 1} options`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp /> Move section up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === total - 1} onSelect={() => onMove(1)}>
              <ArrowDown /> Move section down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={locked || total <= 1} onSelect={onDelete}>
              <Trash2 /> Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid gap-4 px-5 pt-3 pb-5">
        <Input
          aria-label={`Section ${index + 1} title`}
          value={section.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Section title, e.g. The account-suspension email"
          maxLength={200}
          className="h-auto border-0 border-b border-transparent bg-transparent px-0 py-1 text-lg font-semibold shadow-none hover:border-line-strong focus-visible:border-brand focus-visible:shadow-none"
        />
        <div className="grid gap-1.5">
          <p className="text-[13px] font-semibold text-ink">Screenshot</p>
          <ImageField value={section.image} onChange={(v) => set('image', v)} label="screenshot" hint="The email, page or message every question in this section is about. PNG, JPEG or WebP, up to 8 MB." />
        </div>
        {showNote || section.intro ? (
          <div className="grid gap-1.5">
            <p className="text-[13px] font-semibold text-ink">Introduction</p>
            <Textarea value={section.intro} onChange={(e) => set('intro', e.target.value)} placeholder="Context shown with the screenshot, or the riddle for a treasure-hunt challenge." className="min-h-20" />
          </div>
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className="w-fit text-[13px] font-semibold text-brand hover:underline">
            Add an introduction
          </button>
        )}
      </div>
    </Card>
  );
}

/** Short read-only view of a question for the collapsed card. */
function AnswerPreview({ q }: { q: Question }) {
  switch (q.type) {
    case 'single':
    case 'multi':
      return (
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1.5">
          {q.options.map((o) => (
            <li key={o.id} className="flex items-center gap-2.5 text-sm text-ink-2">
              <span className={cn('grid size-4 shrink-0 place-items-center border', q.type === 'multi' ? 'rounded-[3px]' : 'rounded-full', o.correct ? 'border-ok bg-ok text-white' : 'border-ink-3')}>
                {o.correct ? <Check className="size-3" strokeWidth={3} /> : null}
              </span>
              <span className={cn('min-w-0 truncate', o.correct && 'font-semibold text-ink')}>{promptText(o.label) || '(picture)'}</span>
            </li>
          ))}
        </ul>
      );
    case 'boolean':
      return (
        <p className="mt-3 text-sm text-ink-2">
          {q.trueLabel} / {q.falseLabel}
          {q.correctBoolean != null ? <span className="ml-2 font-semibold text-ok">Correct: {q.correctBoolean ? q.trueLabel : q.falseLabel}</span> : null}
        </p>
      );
    case 'spot_flags':
      return <p className="mt-3 text-sm text-ink-2">{q.regions.length ? `${q.regions.length} red flags marked on the screenshot` : 'No red flags marked yet'}</p>;
    case 'short_text':
      return <p className="mt-3 text-sm text-ink-2">Accepts: {q.acceptedAnswers.slice(0, 4).join(', ') || 'nothing yet'}</p>;
    default:
      return <p className="mt-3 text-sm text-ink-3">{TYPE_META[q.type].label}</p>;
  }
}

function QuestionCard(props: {
  question: Question;
  section: Section;
  number: number;
  open: boolean;
  locked: boolean;
  liveFeedback: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onChange: (q: Question) => void;
  onMove: (by: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const { question: q, section, number, open } = props;
  const issues = questionIssues(q, section);
  const Icon = TYPE_META[q.type].icon;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  if (!open) {
    return (
      <Card className="transition-shadow hover:shadow-[0_0_2px_rgb(0_0_0/0.12),0_4px_8px_rgb(0_0_0/0.14)]">
        <button type="button" onClick={props.onOpen} className="block w-full rounded-lg px-5 py-5 text-left break-words sm:px-6">
          <span className="flex items-start gap-2">
            <span className="text-[15px] font-semibold text-ink">{number}.</span>
            <span className="min-w-0 flex-1 text-[15px] leading-6 text-ink">
              {promptText(q.prompt) || <span className="text-ink-3 italic">Question</span>}
              {q.required ? <span className="text-bad" aria-label="required"> *</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">
              <Icon className="size-3.5" aria-hidden />
              <span className="sr-only sm:not-sr-only">{TYPE_META[q.type].label}</span>
            </span>
          </span>
          <AnswerPreview q={q} />
          {issues.length ? <span className="mt-3 block text-xs font-semibold text-warn">Needs attention: {issues[0]}</span> : null}
        </button>
      </Card>
    );
  }

  return (
    <div ref={ref}>
      <Card className="ring-2 ring-brand">
        <div className="flex items-center gap-2 px-6 pt-4 text-[13px] font-semibold text-ink-3">Question {number}</div>
        <div className="px-6 pt-3 pb-5">
          <QuestionEditor question={q} section={section} onChange={props.onChange} structureLocked={props.locked} liveFeedback={props.liveFeedback} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-6 py-3">
          {q.type !== 'rating' ? (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Points
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={q.points}
                onChange={(e) => props.onChange({ ...q, points: Math.max(0, Number(e.target.value) || 0) })}
                className="h-8 w-16"
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <Switch checked={q.required} onCheckedChange={(v) => props.onChange({ ...q, required: v })} />
            Required
          </label>
          <div className="ml-auto flex items-center gap-0.5">
            <IconAction label="Preview this question" onClick={props.onPreview}>
              <Eye />
            </IconAction>
            <IconAction label="Move up" onClick={() => props.onMove(-1)} disabled={props.first}>
              <ArrowUp />
            </IconAction>
            <IconAction label="Move down" onClick={() => props.onMove(1)} disabled={props.last}>
              <ArrowDown />
            </IconAction>
            <IconAction label="Duplicate" onClick={props.onDuplicate} disabled={props.locked}>
              <Copy />
            </IconAction>
            <IconAction label="Delete" onClick={props.onDelete} disabled={props.locked}>
              <Trash2 />
            </IconAction>
          </div>
        </div>
      </Card>
    </div>
  );
}

function IconAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** "Add new question" opens a row of plainly named types, like a form builder. */
function AddQuestion({ onAdd }: { onAdd: (t: QuestionType) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>
        <Plus /> Add new question
      </Button>
    );
  }
  return (
    <Card className="mt-3 p-3">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-[13px] font-semibold text-ink">Choose a question type</p>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {TYPE_ORDER.map((t) => {
          const M = TYPE_META[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
              className="flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left ring-1 ring-line hover:bg-brand-tint hover:ring-brand"
            >
              <M.icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-ink">{M.label}</span>
                <span className="block text-xs text-ink-3">{M.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
