import * as React from 'react';
import { cn } from '~/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-sm border border-input bg-surface px-3 py-1 text-sm text-ink transition-[border-color,box-shadow] outline-none',
        'placeholder:text-ink-3 selection:bg-marker-wash',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'hover:border-ink-3 focus-visible:border-graphite focus-visible:shadow-[0_0_0_1px_var(--graphite)]',
        'disabled:cursor-not-allowed disabled:bg-ground-2 disabled:opacity-60',
        'aria-invalid:border-evidence aria-invalid:shadow-[0_0_0_1px_var(--evidence-red)]',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
