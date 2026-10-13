import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import type { Route } from './+types/certificate';
import { Button } from '~/components/ui/button';
import { EvidenceMarker } from '~/components/evidence/marker';
import { PublicMessage } from '~/components/play/public-shell';
import { formatDate, formatPct } from '~/lib/format';
import { publicApi, publicKeys } from '~/lib/public-api';

export const meta: Route.MetaFunction = () => [{ title: 'Certificate · HRRL Activities' }];

export default function Certificate() {
  const { code = '' } = useParams();
  const cert = useQuery({ queryKey: publicKeys.certificate(code), queryFn: () => publicApi.certificate(code) });

  if (cert.error) {
    return <PublicMessage title="Certificate not found">This verification code does not match a certificate. Check the code and try again.</PublicMessage>;
  }
  if (!cert.data) return <div className="min-h-dvh bg-ground-2" aria-busy="true" />;
  const c = cert.data;
  const verifyUrl = typeof window === 'undefined' ? `/c/${c.code}` : `${window.location.origin}/c/${c.code}`;

  return (
    <div className="min-h-dvh bg-ground-2 px-4 py-8 print:bg-white print:p-0">
      <style>{`@page { size: A4 landscape; margin: 0; } @media print { html, body { background: #fff; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-[1000px] justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer /> Print or save as PDF
        </Button>
      </div>
      <article className="mx-auto flex aspect-[297/210] max-w-[1000px] flex-col bg-surface shadow-plate print:h-[210mm] print:w-[297mm] print:max-w-none print:shadow-none">
        <header className="flex items-center justify-between bg-graphite px-[5%] py-[2.4%] text-shell-fg">
          <span className="flex items-baseline gap-2.5">
            <span className="text-lg font-extrabold">HRRL</span>
            <span className="text-lg font-medium text-shell-muted">CISO Office</span>
          </span>
          <span className="text-sm font-semibold text-shell-muted">Certificate of completion · Cybersecurity Awareness</span>
        </header>
        <div className="flex flex-1 flex-col justify-center px-[7%]">
          <h1 className="text-[clamp(2rem,5.2vw,3.6rem)] leading-[1.05] font-extrabold tracking-[-0.02em] text-ink">{c.name}</h1>
          <p className="mt-[2.5%] max-w-[60ch] text-[clamp(1rem,1.7vw,1.25rem)] leading-relaxed text-ink-2">
            completed <strong className="text-ink">{c.activityTitle}</strong> on {formatDate(c.submittedAt)}, scoring <strong className="text-ink">{formatPct(c.pct)}</strong>.
          </p>
          {/* The row is printed from this employee's own answers: no two certificates match. */}
          <div className="mt-[4%] flex flex-wrap items-end gap-[3px]" aria-label="Answer record">
            {c.pattern.map((p, i) => (
              <EvidenceMarker key={i} n={c.pattern.length > 30 ? '' : i + 1} size={c.pattern.length > 30 ? 16 : 22} tone={p === true ? 'marker' : p === null ? 'outline' : 'muted'} />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-3">Each marker is one question: yellow where the red flag was spotted.</p>
        </div>
        <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-line px-[7%] py-[2.6%] text-xs text-ink-3">
          <span>
            Employee <span className="font-mono text-ink-2">{c.employeeIdMasked}</span> · Activity <span className="font-mono text-ink-2">{c.activityCode}</span>
          </span>
          <span>
            Verify at <span className="font-mono text-ink-2">{verifyUrl}</span> · Code <span className="font-mono font-bold text-ink">{c.code}</span>
          </span>
        </footer>
      </article>
    </div>
  );
}
