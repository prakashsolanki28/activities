import { cn } from '~/lib/utils';

/**
 * Brand marks. The source files (public/logo/hrrl.png, ciso-office.png) are full colour with black
 * lettering on transparency, so every mark sits on white. The emblem cut has its frame filled white,
 * which is the one form that may also sit on graphite (the player bar).
 */
type MarkProps = { className?: string; alt?: string };

const markProps = { decoding: 'async', draggable: false } as const;

/** The HRRL arch emblem on its own: bars, the sign-in card, the player bar. */
export function HrrlEmblem({ className, alt = 'HPCL Rajasthan Refinery Limited' }: MarkProps) {
  return <img src="/logo/hrrl-emblem.png" width={211} height={260} alt={alt} className={cn('h-9 w-auto shrink-0', className)} {...markProps} />;
}

/** Emblem with the bilingual name. Only where it can stand at least 72px tall. */
export function HrrlLockup({ className, alt = 'HPCL Rajasthan Refinery Limited' }: MarkProps) {
  return <img src="/logo/hrrl-lockup.png" width={942} height={260} alt={alt} className={cn('h-18 w-auto shrink-0', className)} {...markProps} />;
}

export function CisoLockup({ className, alt = 'CISO Office' }: MarkProps) {
  return <img src="/logo/ciso-office-lockup.png" width={527} height={167} alt={alt} className={cn('h-9 w-auto shrink-0', className)} {...markProps} />;
}

/**
 * The full HRRL logo, a hairline, then the CISO Office lockup: the parent organisation and the programme that runs it.
 * HRRL stands one step taller as the parent. About 256px wide on phones and 325px from 640px.
 */
export function CoBrand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-3', className)}>
      <HrrlLockup className="h-9 sm:h-12" />
      <span className="h-6 w-px bg-line-strong sm:h-8" aria-hidden />
      <CisoLockup className="h-8 sm:h-10" />
    </span>
  );
}
