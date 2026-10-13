import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '~/lib/utils';

/** Sortable column header button shared by every admin table. */
export function SortHeader({
  label,
  sorted,
  onToggle,
  align = 'left',
}: {
  label: string;
  sorted: false | 'asc' | 'desc';
  onToggle?: () => void;
  align?: 'left' | 'right';
}) {
  if (!onToggle) return <span className={cn('block', align === 'right' && 'text-right')}>{label}</span>;
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn('-mx-1 inline-flex items-center gap-1 rounded-xs px-1 py-0.5 hover:bg-accent hover:text-ink', align === 'right' && 'ml-auto flex-row-reverse', sorted && 'text-ink')}
    >
      {label}
      <Icon className={cn('size-3', !sorted && 'opacity-50')} aria-hidden />
    </button>
  );
}

export const th = 'h-10 px-3 text-left text-xs font-semibold whitespace-nowrap text-ink-3 first:pl-4 last:pr-4';
export const td = 'px-3 py-2.5 align-middle first:pl-4 last:pr-4';
