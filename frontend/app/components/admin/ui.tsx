import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ActivityStatus } from '@hrrl/shared';
import { cn } from '~/lib/utils';

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        <h1 className="text-[28px] leading-9 font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-[70ch] text-sm leading-5 text-ink-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const STATUS: Record<ActivityStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Draft', className: 'bg-ground-2 text-ink-2', dot: 'bg-ink-3' },
  scheduled: { label: 'Scheduled', className: 'bg-warn-tint text-warn ring-1 ring-warn/30 ring-inset', dot: 'bg-warn' },
  live: { label: 'Open', className: 'bg-ok-tint text-ok ring-1 ring-ok/30 ring-inset', dot: 'bg-ok' },
  closed: { label: 'Closed', className: 'bg-ground-2 text-ink-2', dot: 'bg-ink-2' },
};

/** Status in plain words: Draft, Scheduled, Open, Closed. */
export function StatusBadge({ status, className }: { status: ActivityStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap', s.className, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

export function Card({ children, className, ...rest }: React.ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-lg bg-surface shadow-card', className)} {...rest}>
      {children}
    </section>
  );
}

export function Panel({ title, actions, children, className, bodyClassName }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={className}>
      {title ? (
        <header className="flex min-h-12 items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </Card>
  );
}

const BAR = {
  info: { icon: Info, className: 'bg-brand-tint text-ink [&_svg]:text-brand' },
  warning: { icon: TriangleAlert, className: 'bg-warn-tint text-ink [&_svg]:text-warn' },
  success: { icon: CircleCheck, className: 'bg-ok-tint text-ink [&_svg]:text-ok' },
  error: { icon: CircleAlert, className: 'bg-bad-tint text-ink [&_svg]:text-bad' },
} as const;

/** One-line notice in the Microsoft 365 message-bar pattern. */
export function MessageBar({ intent = 'info', children, action, className }: { intent?: keyof typeof BAR; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const { icon: Icon, className: tone } = BAR[intent];
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2.5 text-sm leading-5 ring-1 ring-black/5', tone, className)} role={intent === 'error' ? 'alert' : 'status'}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, action, className }: { title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-6 py-12 text-center', className)}>
      <p className="text-base font-semibold text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1.5 max-w-[48ch] text-sm leading-5 text-ink-3">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <MessageBar intent="error" className={className}>
      {children}
    </MessageBar>
  );
}

/** Rounded filter/view pills, the Microsoft 365 way of switching a list between views. */
export function Pills<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly (readonly [T, React.ReactNode])[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
            value === v ? 'bg-brand-tint text-brand ring-1 ring-brand ring-inset' : 'bg-surface text-ink-2 ring-1 ring-line-strong ring-inset hover:bg-ground-2',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
