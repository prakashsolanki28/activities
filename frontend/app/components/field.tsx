import { useId } from 'react';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';

/** Turns TanStack Form error entries (strings or Standard Schema issues) into text. */
export function fieldError(errors: unknown[]): string | undefined {
  for (const e of errors) {
    if (!e) continue;
    if (typeof e === 'string') return e;
    if (typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') return (e as { message: string }).message;
  }
  return undefined;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-3"> (optional)</span> : null}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs leading-5 font-semibold text-red-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
