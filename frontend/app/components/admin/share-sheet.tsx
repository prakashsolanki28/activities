import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { Copy, Download, ExternalLink, Loader2, MonitorPlay } from 'lucide-react';
import type { AdminActivity } from '@hrrl/shared';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '~/components/ui/sheet';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Field } from '~/components/field';
import { MessageBar, StatusBadge } from './ui';
import { errorMessage } from '~/lib/api';
import { adminApi, adminKeys, useActivityAction } from '~/lib/admin-api';
import { formatDateTime, fromLocalInput, toLocalInput } from '~/lib/format';

/** "Share": open the activity now or on a date, then hand out the link or QR code. */
export function ShareSheet({ activity: a, open, onOpenChange }: { activity: AdminActivity; open: boolean; onOpenChange: (o: boolean) => void }) {
  const issues = useQuery({ queryKey: [...adminKeys.issues(a._id), a.version], queryFn: () => adminApi.issues(a._id), enabled: open });
  const [opensAt, setOpensAt] = useState(toLocalInput(a.opensAt));
  const [closesAt, setClosesAt] = useState(toLocalInput(a.closesAt));
  const [error, setError] = useState<string | null>(null);
  const qr = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setOpensAt(toLocalInput(a.opensAt));
      setClosesAt(toLocalInput(a.closesAt));
      setError(null);
    }
  }, [open, a.opensAt, a.closesAt]);

  const publish = useActivityAction(a._id, (o: string | null, c: string | null) => adminApi.publish(a._id, { opensAt: o, closesAt: c }));
  const unpublish = useActivityAction(a._id, () => adminApi.unpublish(a._id));
  const close = useActivityAction(a._id, () => adminApi.close(a._id));
  const reopen = useActivityAction(a._id, () => adminApi.reopen(a._id));
  const url = typeof window === 'undefined' ? `/a/${a.slug}` : `${window.location.origin}/a/${a.slug}`;
  const problems = issues.data?.issues ?? [];
  const published = a.status !== 'draft';

  const save = () => {
    setError(null);
    const o = fromLocalInput(opensAt);
    const c = fromLocalInput(closesAt);
    if (o && c && new Date(o) >= new Date(c)) return setError('The closing time must be after the opening time.');
    publish.mutate([o, c], {
      onSuccess: (res) => toast.success(res.status === 'scheduled' ? `Scheduled to open ${formatDateTime(res.opensAt)}` : published ? 'Dates saved' : 'Open. Share the link with employees.'),
      onError: (e) => setError(errorMessage(e)),
    });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Copy was blocked. Select the link and copy it.');
    }
  };
  const download = () => {
    const canvas = qr.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${a.slug}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[440px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="border-b border-line px-6 py-5">
          <SheetTitle className="text-xl font-semibold text-ink">Share</SheetTitle>
          <SheetDescription className="flex items-center gap-2 text-sm text-ink-3">
            <StatusBadge status={a.status} />
            {a.status === 'draft' && 'Only admins can see this activity.'}
            {a.status === 'scheduled' && a.opensAt && `Opens ${formatDateTime(a.opensAt, true)}`}
            {a.status === 'live' && (a.closesAt ? `Open until ${formatDateTime(a.closesAt, true)}` : 'Employees can take part now.')}
            {a.status === 'closed' && 'No new responses are accepted.'}
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 px-6 py-5">
          {problems.length ? (
            <MessageBar intent="warning">
              <p className="font-semibold">Finish {problems.length} {problems.length === 1 ? 'thing' : 'things'} before sharing:</p>
              <ul className="mt-1 list-disc pl-4">
                {problems.slice(0, 5).map((p, i) => (
                  <li key={i}>
                    {p.message}{' '}
                    {p.questionId ? (
                      <Link to={`/admin/activities/${a._id}?q=${p.questionId}`} className="font-semibold text-brand underline" onClick={() => onOpenChange(false)}>
                        Fix
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </MessageBar>
          ) : null}

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold text-ink">When can people take part?</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Opens" optional hint="Empty: open straight away.">
                {(p) => <Input {...p} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />}
              </Field>
              <Field label="Closes" optional hint="Empty: until you close it.">
                {(p) => <Input {...p} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />}
              </Field>
            </div>
            <p className="text-xs text-ink-3">Times are India Standard Time.</p>
            {error ? <MessageBar intent="error">{error}</MessageBar> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={publish.isPending || problems.length > 0}>
                {publish.isPending ? <Loader2 className="animate-spin" /> : null}
                {published ? 'Save dates' : opensAt ? 'Schedule' : 'Open now'}
              </Button>
              {a.status === 'live' ? (
                <Button variant="outline" onClick={() => close.mutate([], { onSuccess: () => toast.success('Closed. Anyone still answering was submitted.') })} disabled={close.isPending}>
                  Close now
                </Button>
              ) : null}
              {a.status === 'closed' ? (
                <Button variant="outline" onClick={() => reopen.mutate([], { onSuccess: () => toast.success('Reopened') })} disabled={reopen.isPending}>
                  Reopen
                </Button>
              ) : null}
              {published ? (
                <Button variant="ghost" onClick={() => unpublish.mutate([], { onSuccess: () => toast.success('Back to draft. The link no longer works.') })} disabled={unpublish.isPending}>
                  Back to draft
                </Button>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Link</h3>
            {!published ? <p className="text-xs text-ink-3">The link works once the activity is open.</p> : null}
            <div className="flex gap-2">
              <Input readOnly value={url} className="text-[13px]" onFocus={(e) => e.currentTarget.select()} aria-label="Employee link" />
              <Button variant="outline" onClick={copy}>
                <Copy /> Copy
              </Button>
            </div>
            <div ref={qr} className="grid justify-items-center gap-2 rounded-md bg-ground p-5">
              <QRCodeCanvas value={url} size={512} level="M" marginSize={2} bgColor="#ffffff" fgColor="#242424" style={{ width: 168, height: 168 }} />
              <p className="text-center text-xs text-ink-3">For posters and treasure-hunt clue cards.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={download}>
                <Download /> Download QR code
              </Button>
              {published ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={url} target="_blank" rel="noopener">
                    <ExternalLink /> Open as employee
                  </a>
                </Button>
              ) : null}
              {published && a.settings.leaderboard === 'always' ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={`/a/${a.slug}/leaderboard?display=1`} target="_blank" rel="noopener">
                    <MonitorPlay /> Leaderboard for a projector
                  </a>
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
