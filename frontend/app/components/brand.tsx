import { cn } from '~/lib/utils';

/** Wordmark: no HRRL logo file was provided, so the product sets its name in type. */
export function Wordmark({ className, sub }: { className?: string; sub?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-2 text-shell-fg', className)}>
      <span className="text-[15px] leading-none font-extrabold tracking-[-0.01em]">HRRL</span>
      <span className="text-[15px] leading-none font-medium text-shell-muted">{sub ?? 'Activities'}</span>
    </span>
  );
}
