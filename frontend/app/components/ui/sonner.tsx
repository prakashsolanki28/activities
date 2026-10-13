import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4 text-ledger" />,
      info: <InfoIcon className="size-4 text-slate" />,
      warning: <TriangleAlertIcon className="size-4 text-manila-ink" />,
      error: <OctagonXIcon className="size-4 text-evidence" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    style={
      {
        '--normal-bg': 'var(--graphite)',
        '--normal-text': 'var(--shell-fg)',
        '--normal-border': 'var(--graphite-3)',
        '--border-radius': '2px',
      } as React.CSSProperties
    }
    toastOptions={{ classNames: { description: '!text-shell-muted' } }}
    {...props}
  />
);

export { Toaster };
