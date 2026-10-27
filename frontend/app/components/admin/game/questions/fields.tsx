import { useId, useRef } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { CARD_CHOICES, CARD_LABELS, type CardChoice } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import { CARD_TONE } from '../bits';
import { useEditor } from './editor-context';

const focusRing = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
/** Locked fields stay fully legible: read-only, not faded. */
const lockedField = 'disabled:cursor-default disabled:opacity-100 disabled:text-ink-2';

const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

/** A character counter that appears near the limit. */
export function Counter({ id, length, max }: { id?: string; length: number; max: number }) {
  if (length < max * 0.8) return null;
  return (
    <p id={id} className={cn('text-right text-xs leading-5 tabular-nums', length >= max ? 'font-semibold text-ink' : 'text-ink-3')} aria-live="off">
      {length} / {max}
    </p>
  );
}

export function ErrorText({ id, children, anchor }: { id?: string; children: React.ReactNode; anchor?: boolean }) {
  return (
    <p
      id={id}
      className="rounded-sm text-xs leading-5 font-semibold text-red-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      {...(anchor ? { 'data-issue-anchor': '', tabIndex: -1 } : {})}
    >
      {children}
    </p>
  );
}

function FieldLabel({ htmlFor, id, label, srSuffix, optional }: { htmlFor?: string; id?: string; label: string; srSuffix?: string; optional?: boolean }) {
  return (
    <Label htmlFor={htmlFor} id={id} className="text-[13px] font-semibold text-ink">
      <span>
        {label}
        {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
        {optional ? <span className="font-normal text-ink-3"> (optional)</span> : null}
      </span>
    </Label>
  );
}

/** A labelled text box or text area tied to one path in the questions. */
export function TextField({
  path,
  label,
  srSuffix,
  value,
  onChange,
  multiline,
  maxLength,
  placeholder,
  hint,
  optional,
  focusKey,
  className,
}: {
  path: string;
  label: string;
  /** Read after the label by screen readers only, e.g. "for situation 3". */
  srSuffix?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  /** Marks the field that Add puts the cursor in. */
  focusKey?: string;
  className?: string;
}) {
  const { locked, issue, touch } = useEditor();
  const id = useId();
  const error = issue(path);
  const common = {
    id,
    value,
    maxLength,
    disabled: locked,
    placeholder: locked ? undefined : placeholder,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy(hint && !error && `${id}-hint`, error && `${id}-error`),
    'data-focus': focusKey,
    onBlur: () => touch(path),
  };
  return (
    <div className={cn('grid gap-1.5', className)}>
      <FieldLabel htmlFor={id} label={label} srSuffix={srSuffix} optional={optional} />
      {multiline ? (
        <Textarea {...common} onChange={(e) => onChange(e.target.value)} className={cn('min-h-16', lockedField)} />
      ) : (
        <Input {...common} onChange={(e) => onChange(e.target.value)} className={cn('h-11', lockedField)} />
      )}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-ink-3">
          {hint}
        </p>
      ) : null}
      {!locked ? <Counter length={value.length} max={maxLength} /> : null}
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
    </div>
  );
}

/** The main text of an item, as a filled prompt field (like a form question), named by the item's heading. */
export function PromptField({
  path,
  labelledBy,
  value,
  onChange,
  maxLength,
  placeholder,
  focusKey,
}: {
  path: string;
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder: string;
  focusKey?: string;
}) {
  const { locked, issue, touch } = useEditor();
  const id = useId();
  const error = issue(path);
  return (
    <div className="grid gap-1.5">
      <Textarea
        id={id}
        rows={1}
        value={value}
        maxLength={maxLength}
        disabled={locked}
        placeholder={locked ? undefined : placeholder}
        aria-labelledby={labelledBy}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        data-focus={focusKey}
        onBlur={() => touch(path)}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'min-h-12 border-0 border-b border-line-strong bg-ground px-3 py-2.5 text-[15px] shadow-none focus-visible:border-brand focus-visible:shadow-[0_1px_0_0_var(--brand)]',
          lockedField,
        )}
      />
      {!locked ? <Counter length={value.length} max={maxLength} /> : null}
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
    </div>
  );
}

/** A whole-number box. An empty box is kept as NaN so validation can say so. */
export function NumberField({
  path,
  label,
  srSuffix,
  value,
  onChange,
  min,
  max,
  hint,
  allowNegative,
  after,
  className,
}: {
  path: string;
  label: string;
  srSuffix?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: React.ReactNode;
  /** Negative numbers need the full keyboard on phones (the numeric pad has no minus key). */
  allowNegative?: boolean;
  /** Shown beside the box, e.g. what the value means. */
  after?: React.ReactNode;
  className?: string;
}) {
  const { locked, issue, touch } = useEditor();
  const id = useId();
  const error = issue(path);
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <FieldLabel htmlFor={id} label={label} srSuffix={srSuffix} />
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type="number"
          inputMode={allowNegative ? undefined : 'numeric'}
          step={1}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          disabled={locked}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint != null && !error && `${id}-hint`, error && `${id}-error`)}
          onBlur={() => touch(path)}
          onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
          className={cn('h-11 w-24 tabular-nums', lockedField)}
        />
        {after}
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? <ErrorText id={`${id}-error`}>{error}</ErrorText> : null}
    </div>
  );
}

/** Safe / Danger / Verify first, as three pressed-or-not buttons. */
export function CardChoiceField({ label, srSuffix, value, onChange }: { label: string; srSuffix: string; value: CardChoice; onChange: (value: CardChoice) => void }) {
  const { locked } = useEditor();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <p id={id} className="text-[13px] font-semibold text-ink">
        {label}
        <span className="sr-only"> {srSuffix}</span>
      </p>
      <div role="group" aria-labelledby={id} className="grid grid-cols-3 gap-2 sm:flex">
        {CARD_CHOICES.map((c) => {
          const on = value === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              disabled={locked}
              onClick={() => !on && onChange(c)}
              className={cn(
                'inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-semibold whitespace-nowrap ring-1 ring-inset transition-colors sm:min-w-32 sm:px-3',
                focusRing,
                on ? CARD_TONE[c].on : 'bg-surface text-ink-2 ring-line-strong hover:bg-ground',
                'disabled:cursor-default',
                !on && 'disabled:opacity-60 disabled:hover:bg-surface',
              )}
            >
              {on ? <Check className="hidden size-4 shrink-0 sm:block" strokeWidth={2.5} aria-hidden /> : null}
              {CARD_LABELS[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A ghost icon button with a tooltip. With `blockedHint` it stays focusable but does nothing, and the tooltip says why. */
export function IconAction({
  label,
  tip,
  onClick,
  disabled,
  blockedHint,
  buttonRef,
  children,
}: {
  label: string;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  blockedHint?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  const blocked = !!blockedHint;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={label}
          aria-disabled={blocked || undefined}
          disabled={disabled}
          onClick={blocked ? undefined : onClick}
          className={cn(blocked && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-ink-2 active:translate-y-0')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{blockedHint ?? tip}</TooltipContent>
    </Tooltip>
  );
}

/** A short list of one-line answers (warning signs, safe responses, expected answers), min to max lines. */
export function LinesField({
  path,
  legend,
  srSuffix,
  itemLabel,
  values,
  onChange,
  min,
  max,
  maxLength,
  addLabel,
  minHint,
  hint,
}: {
  path: string;
  legend: string;
  srSuffix?: string;
  /** "Warning sign": each box is "Warning sign 2 on card A". */
  itemLabel: string;
  values: string[];
  onChange: (values: string[]) => void;
  min: number;
  max: number;
  maxLength: number;
  addLabel: string;
  minHint: string;
  hint?: string;
}) {
  const { locked, issue, touch } = useEditor();
  const uid = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const suffix = srSuffix ? ` ${srSuffix}` : '';
  const listError = issue(path);
  const focusBox = (i: number) =>
    requestAnimationFrame(() => {
      const box = listRef.current?.querySelectorAll('textarea')[i];
      box?.focus({ preventScroll: true });
      box?.scrollIntoView({ block: 'nearest' });
    });

  return (
    <fieldset className="min-w-0">
      <legend className="text-[13px] font-semibold text-ink">
        {legend}
        {srSuffix ? <span className="sr-only">{suffix}</span> : null}
      </legend>
      {hint ? (
        <p id={`${uid}-hint`} className="mt-0.5 text-xs leading-5 text-ink-3">
          {hint}
        </p>
      ) : null}
      <ol ref={listRef} className="mt-2 grid gap-2">
        {values.map((v, i) => {
          const p = `${path}.${i}`;
          const err = issue(p);
          const errId = `${uid}-${i}-error`;
          return (
            <li key={i} className="flex items-start gap-1.5">
              <span aria-hidden className="mt-3 w-5 shrink-0 text-right text-[13px] leading-5 text-ink-3 tabular-nums">
                {i + 1}.
              </span>
              <div className="grid min-w-0 flex-1 gap-1">
                <Textarea
                  rows={1}
                  value={v}
                  maxLength={maxLength}
                  disabled={locked}
                  aria-label={`${itemLabel} ${i + 1}${suffix}`}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={describedBy(err && errId, hint && `${uid}-hint`)}
                  onBlur={() => touch(p)}
                  // One line each: Enter never adds a line break, and pasted breaks become spaces.
                  onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value.replace(/\s*\n\s*/g, ' ') : x)))}
                  className={cn('min-h-11 resize-none py-[9px]', lockedField)}
                />
                {!locked ? <Counter length={v.length} max={maxLength} /> : null}
                {err ? <ErrorText id={errId}>{err}</ErrorText> : null}
              </div>
              {!locked ? (
                <IconAction
                  label={`Remove ${itemLabel.toLowerCase()} ${i + 1}${suffix}`}
                  tip="Remove"
                  blockedHint={values.length <= min ? minHint : undefined}
                  onClick={() => {
                    onChange(values.filter((_, j) => j !== i));
                    focusBox(Math.min(i, values.length - 2));
                  }}
                >
                  <X />
                </IconAction>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!locked ? (
        values.length < max ? (
          <Button
            type="button"
            variant="ghost"
            className="mt-1 ml-6.5 h-11"
            onClick={() => {
              onChange([...values, '']);
              focusBox(values.length);
            }}
          >
            <Plus /> {addLabel}
            {srSuffix ? <span className="sr-only">{suffix}</span> : null}
          </Button>
        ) : (
          <p className="mt-2 ml-6.5 text-xs leading-5 text-ink-3">Up to {max}. Remove one to add another.</p>
        )
      ) : null}
      {listError ? (
        <div className="mt-1 ml-6.5">
          <ErrorText anchor>{listError}</ErrorText>
        </div>
      ) : null}
    </fieldset>
  );
}
