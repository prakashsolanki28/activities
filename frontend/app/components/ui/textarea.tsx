import * as React from 'react';
import { cn } from '~/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-20 w-full rounded-sm border border-input bg-surface px-3 py-2 text-sm leading-6 text-ink transition-[border-color,box-shadow] outline-none',
        'placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-graphite focus-visible:shadow-[0_0_0_1px_var(--graphite)]',
        'disabled:cursor-not-allowed disabled:bg-ground-2 disabled:opacity-60',
        'aria-invalid:border-evidence aria-invalid:shadow-[0_0_0_1px_var(--evidence-red)]',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
