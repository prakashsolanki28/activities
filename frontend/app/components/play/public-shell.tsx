import { Wordmark } from '~/components/brand';
import { cn } from '~/lib/utils';

/** Graphite strip + concrete ground for the employee pages around the player. */
export function PublicShell({ children, right, className }: { children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <header className="on-shell bg-graphite">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Wordmark sub="CISO Office" />
          {right}
        </div>
      </header>
      <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12', className)}>{children}</main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-ink-3 sm:px-6">
        STOP → THINK → VERIFY → REPORT · Report suspicious messages to the CISO Office.
      </footer>
    </div>
  );
}

export function PublicMessage({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <PublicShell>
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <div className="mt-3 text-[17px] leading-7 text-ink-2">{children}</div>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </PublicShell>
  );
}
