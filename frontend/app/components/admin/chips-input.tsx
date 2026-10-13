import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '~/lib/utils';

/** Free-text list: Enter or comma adds, Backspace on empty removes the last. */
export function ChipsInput({
  value,
  onChange,
  placeholder,
  id,
  className,
  max = 50,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase()) && next.length < max) next.push(p.slice(0, 200));
    onChange(next);
    setDraft('');
  };
  return (
    <div
      className={cn(
        'flex min-h-9 flex-wrap items-center gap-1.5 rounded-sm border border-input bg-surface px-1.5 py-1 focus-within:border-graphite focus-within:shadow-[0_0_0_1px_var(--graphite)]',
        className,
      )}
    >
      {value.map((v, i) => (
        <span key={`${v}-${i}`} className="inline-flex h-6 items-center gap-1 rounded-xs bg-ground-2 pr-0.5 pl-2 text-[13px] text-ink">
          {v}
          <button type="button" className="grid size-5 place-items-center rounded-xs text-ink-3 hover:bg-line hover:text-ink" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={value.length ? undefined : placeholder}
        onChange={(e) => {
          if (e.target.value.includes(',')) add(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        className="h-6 min-w-32 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-3"
      />
    </div>
  );
}
