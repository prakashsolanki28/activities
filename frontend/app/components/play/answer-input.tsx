import { useId } from 'react';
import { Check, ChevronDown, ChevronUp, GripVertical, MousePointerClick, X } from 'lucide-react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AnswerValue, PublicQuestion, Reveal } from '@hrrl/shared';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Prompt } from '~/components/evidence/prompt';
import { EvidenceMarker } from '~/components/evidence/marker';
import { cn } from '~/lib/utils';

export interface AnswerInputProps {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  /** Answer is locked (checked, submitted, or review mode). */
  locked: boolean;
  reveal?: Reveal | null;
  /** Enter pressed in a single-line input. */
  onEnter?: () => void;
  labelledBy: string;
}

export function AnswerInput(props: AnswerInputProps) {
  switch (props.question.type) {
    case 'single':
    case 'multi':
      return <Choices {...props} />;
    case 'boolean':
      return <BooleanChoice {...props} />;
    case 'short_text':
      return <ShortText {...props} />;
    case 'list_text':
      return <ListText {...props} />;
    case 'long_text':
      return <LongText {...props} />;
    case 'number':
      return <NumberInput {...props} />;
    case 'ordering':
      return <Ordering {...props} />;
    case 'hotspot':
      return <HotspotHint {...props} />;
    case 'rating':
      return <Rating {...props} />;
  }
}

/* ------------------------------------------------------------------ */

type OptionState = 'idle' | 'selected' | 'right' | 'wrong' | 'missed' | 'dim';

function optionState(id: string, selected: boolean, reveal?: Reveal | null): OptionState {
  const correct = reveal?.correct?.optionIds;
  if (!correct) return selected ? 'selected' : 'idle';
  const isRight = correct.includes(id);
  if (selected && isRight) return 'right';
  if (selected && !isRight) return 'wrong';
  if (!selected && isRight) return 'missed';
  return 'dim';
}

const OPTION_STYLES: Record<OptionState, string> = {
  idle: 'border-line-strong bg-surface hover:border-ink-3 hover:bg-[#fbfbf9]',
  selected: 'border-graphite bg-marker-wash shadow-[inset_0_0_0_1px_var(--graphite)]',
  right: 'border-ledger bg-green-wash shadow-[inset_0_0_0_1px_var(--ledger-green)]',
  wrong: 'border-evidence bg-red-wash shadow-[inset_0_0_0_1px_var(--evidence-red)]',
  missed: 'border-dashed border-ledger bg-surface',
  dim: 'border-line bg-surface opacity-60',
};

function Choices({ question, value, onChange, locked, reveal, labelledBy }: AnswerInputProps) {
  const multi = question.type === 'multi';
  const name = useId();
  const picked = new Set(multi ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? [value] : []);
  const toggle = (id: string) => {
    if (locked) return;
    if (!multi) return onChange(id);
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  return (
    <fieldset aria-labelledby={labelledBy} className="grid gap-2">
      {multi ? <legend className="mb-1 text-[13px] font-semibold text-ink-3">Select all that apply</legend> : null}
      {(question.options ?? []).map((o, i) => {
        const state = optionState(o.id, picked.has(o.id), reveal);
        return (
          <label
            key={o.id}
            className={cn(
              'group/opt relative flex min-h-12 cursor-pointer items-start gap-3 rounded-xs border px-3.5 py-3 transition-[background-color,border-color,box-shadow] duration-150',
              OPTION_STYLES[state],
              locked && 'cursor-default',
            )}
          >
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={name}
              className="peer sr-only"
              checked={picked.has(o.id)}
              disabled={locked}
              onChange={() => toggle(o.id)}
            />
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-5 shrink-0 place-items-center border-[1.5px] border-ink-3 bg-surface transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-graphite',
                multi ? 'rounded-[2px]' : 'rounded-full',
                state === 'selected' && 'border-graphite bg-graphite',
                state === 'right' && 'border-ledger bg-ledger',
                state === 'wrong' && 'border-evidence bg-evidence',
                state === 'missed' && 'border-ledger',
              )}
            >
              {state === 'selected' ? multi ? <Check className="size-3.5 text-marker" strokeWidth={3} /> : <span className="size-2 rounded-full bg-marker" /> : null}
              {state === 'right' ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
              {state === 'wrong' ? <X className="size-3.5 text-white" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1">
              {o.image ? <img src={o.image.url} alt={o.image.alt} width={o.image.w} height={o.image.h} className="mb-2 max-h-40 w-auto rounded-xs border border-line" /> : null}
              {o.label ? <Prompt text={o.label} size="sm" className="text-[15px] leading-6" /> : null}
              {state === 'missed' ? <span className="mt-1 block text-xs font-semibold text-green-ink">Correct answer</span> : null}
            </span>
            {!locked && i < 9 ? (
              <kbd className="mt-0.5 hidden rounded-xs border border-line px-1.5 font-mono text-[11px] text-ink-3 sm:inline-block">{i + 1}</kbd>
            ) : null}
          </label>
        );
      })}
    </fieldset>
  );
}

function BooleanChoice({ question, value, onChange, locked, reveal, labelledBy }: AnswerInputProps) {
  const correct = reveal?.correct?.boolean;
  const choices: [boolean, string][] = [
    [true, question.trueLabel ?? 'Yes'],
    [false, question.falseLabel ?? 'No'],
  ];
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-3">
      {choices.map(([v, label], i) => {
        const selected = value === v;
        const state: OptionState = correct === undefined ? (selected ? 'selected' : 'idle') : optionState(String(v), selected, { correct: { optionIds: [String(correct)] } } as Reveal);
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={locked}
            onClick={() => onChange(v)}
            className={cn(
              'flex h-16 items-center justify-center gap-2 rounded-xs border text-lg font-bold text-ink transition-[background-color,border-color,box-shadow] duration-150 disabled:cursor-default',
              OPTION_STYLES[state],
            )}
          >
            {state === 'right' ? <Check className="size-5 text-ledger" strokeWidth={3} /> : null}
            {state === 'wrong' ? <X className="size-5 text-evidence" strokeWidth={3} /> : null}
            {label}
            {!locked ? <kbd className="ml-1 hidden rounded-xs border border-line px-1.5 font-mono text-[11px] font-normal text-ink-3 sm:inline-block">{i + 1}</kbd> : null}
          </button>
        );
      })}
    </div>
  );
}

function ShortText({ value, onChange, locked, onEnter, labelledBy, reveal }: AnswerInputProps) {
  return (
    <Input
      aria-labelledby={labelledBy}
      className={cn(
        'h-12 text-lg',
        reveal?.isCorrect === true && 'border-ledger bg-green-wash',
        reveal?.isCorrect === false && 'border-evidence bg-red-wash',
      )}
      placeholder="Type your answer"
      autoComplete="off"
      spellCheck={false}
      value={typeof value === 'string' ? value : ''}
      disabled={locked}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter?.();
        }
      }}
      maxLength={200}
    />
  );
}

function ListText({ question, value, onChange, locked, labelledBy }: AnswerInputProps) {
  const count = question.inputCount ?? 5;
  const items = Array.from({ length: count }, (_, i) => (Array.isArray(value) ? (value[i] ?? '') : ''));
  return (
    <ol aria-labelledby={labelledBy} className="grid gap-2">
      {items.map((v, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <EvidenceMarker n={i + 1} size={22} tone={v.trim() ? 'marker' : 'muted'} />
          <Input
            aria-label={`Red flag ${i + 1}`}
            className="h-11 text-base"
            value={v}
            disabled={locked}
            maxLength={200}
            placeholder={i === 0 ? 'e.g. Urgent language' : undefined}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
        </li>
      ))}
    </ol>
  );
}

function LongText({ value, onChange, locked, labelledBy }: AnswerInputProps) {
  const text = typeof value === 'string' ? value : '';
  return (
    <div className="grid gap-1.5">
      <Textarea
        aria-labelledby={labelledBy}
        className="min-h-36 text-base leading-7"
        value={text}
        disabled={locked}
        maxLength={5000}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer"
      />
      <span className="text-right text-xs text-ink-3 tabular-nums">{text.length} / 5000</span>
    </div>
  );
}

function NumberInput({ question, value, onChange, locked, onEnter, labelledBy, reveal }: AnswerInputProps) {
  return (
    <div className="flex items-center gap-3">
      <Input
        aria-labelledby={labelledBy}
        inputMode="decimal"
        className={cn('h-12 max-w-56 font-mono text-lg', reveal?.isCorrect === true && 'border-ledger bg-green-wash', reveal?.isCorrect === false && 'border-evidence bg-red-wash')}
        value={value == null ? '' : String(value)}
        disabled={locked}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter?.();
          }
        }}
      />
      {question.unit ? <span className="text-base font-semibold text-ink-2">{question.unit}</span> : null}
    </div>
  );
}

function Ordering({ question, value, onChange, locked, labelledBy, reveal }: AnswerInputProps) {
  const items = question.orderItems ?? [];
  const order = Array.isArray(value) && value.length === items.length ? value : items.map((i) => i.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const correctOrder = reveal?.correct?.order?.map((i) => i.id);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    onChange(arrayMove(order, from, to));
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    move(order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol aria-labelledby={labelledBy} className="grid gap-2">
          {order.map((id, i) => (
            <SortableRow
              key={id}
              id={id}
              index={i}
              label={byId.get(id)?.label ?? ''}
              locked={locked}
              total={order.length}
              onMove={move}
              status={correctOrder ? (correctOrder[i] === id ? 'right' : 'wrong') : undefined}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, index, label, locked, total, onMove, status }: { id: string; index: number; label: string; locked: boolean; total: number; onMove: (from: number, to: number) => void; status?: 'right' | 'wrong' }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex min-h-12 items-center gap-2 rounded-xs border bg-surface px-2 py-1.5',
        isDragging ? 'z-10 border-graphite shadow-pop' : 'border-line-strong',
        status === 'right' && 'border-ledger bg-green-wash',
        status === 'wrong' && 'border-evidence bg-red-wash',
      )}
    >
      {!locked ? (
        <button type="button" className="grid size-8 cursor-grab touch-none place-items-center rounded-xs text-ink-3 hover:bg-accent active:cursor-grabbing" aria-label={`Drag ${label}`} {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
      ) : null}
      <span className="w-6 text-center font-mono text-sm font-bold text-ink-3 tabular-nums">{index + 1}</span>
      <span className="flex-1 text-[15px] font-semibold text-ink">{label}</span>
      {!locked ? (
        <span className="flex">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
            <ChevronUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${label} down`} disabled={index === total - 1} onClick={() => onMove(index, index + 1)}>
            <ChevronDown />
          </Button>
        </span>
      ) : null}
    </li>
  );
}

function HotspotHint({ value, reveal }: AnswerInputProps) {
  const point = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  return (
    <div className={cn('flex items-start gap-3 rounded-xs border border-dashed px-4 py-3.5', point ? 'border-graphite bg-marker-wash' : 'border-line-strong bg-surface')}>
      <MousePointerClick className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden />
      <p className="text-[15px] leading-6 text-ink-2">
        {reveal
          ? reveal.isCorrect
            ? 'You marked the right spot.'
            : 'The correct area is outlined in green on the evidence.'
          : point
            ? 'Marked. Tap somewhere else on the evidence to move your mark.'
            : 'Tap the suspicious part of the evidence to mark it. Zoom in first if you need to.'}
      </p>
    </div>
  );
}

function Rating({ question, value, onChange, locked, labelledBy }: AnswerInputProps) {
  const max = question.scaleMax ?? 5;
  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={locked}
            onClick={() => onChange(n)}
            className={cn(
              'grid size-12 place-items-center rounded-xs border text-lg font-bold tabular-nums transition-colors disabled:cursor-default',
              value === n ? 'border-graphite bg-marker text-marker-ink' : 'border-line-strong bg-surface text-ink hover:border-ink-3',
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {question.minLabel || question.maxLabel ? (
        <div className="flex justify-between text-xs text-ink-3" style={{ maxWidth: `${max * 3.5}rem` }}>
          <span>{question.minLabel}</span>
          <span>{question.maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}
