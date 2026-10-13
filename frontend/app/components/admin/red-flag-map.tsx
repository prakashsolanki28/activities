import { useMemo, useState } from 'react';
import type { QuestionInsight, Region, Section } from '@hrrl/shared';
import { EvidencePlate } from '~/components/evidence/plate';
import { EvidenceMarker, type MarkerTone } from '~/components/evidence/marker';
import { formatPct } from '~/lib/format';
import { cn } from '~/lib/utils';
import { Card } from './ui';

interface Flag {
  region: Region;
  /** Question numbers (as shown in the builder) that teach this flag. */
  questions: number[];
  /** Share of answers that missed it; null before anyone answers. */
  missPct: number | null;
}

function toneFor(miss: number | null): MarkerTone {
  if (miss == null) return 'muted';
  if (miss >= 50) return 'missed';
  if (miss >= 25) return 'marker';
  return 'correct';
}

/**
 * Each screenshot with its red flags coloured by how often people missed them:
 * the admin side of the product's thesis.
 */
export function RedFlagMap({ sections, questions }: { sections: Section[]; questions: QuestionInsight[] }) {
  const byId = useMemo(() => new Map(questions.map((q) => [q.questionId, q])), [questions]);
  const screens = useMemo(() => {
    let n = 0;
    return sections
      .map((section, si) => {
        const flags = new Map<string, Flag>();
        for (const q of section.questions) {
          if (q.archived) continue;
          n += 1;
          const insight = byId.get(q.id);
          if (q.type === 'spot_flags') {
            // Spot questions measure each flag directly: the share of people who boxed it.
            q.regions.forEach((r, ri) => {
              const f = flags.get(r.id) ?? { region: r, questions: [], missPct: null };
              f.questions.push(n);
              const stat = insight?.flags?.find((x) => x.index === ri);
              if (stat && insight?.answered) {
                const miss = 100 - (stat.found / insight.answered) * 100;
                f.missPct = f.missPct == null ? miss : Math.max(f.missPct, miss);
              }
              flags.set(r.id, f);
            });
            continue;
          }
          for (const r of q.highlights) {
            const f = flags.get(r.id) ?? { region: r, questions: [], missPct: null };
            f.questions.push(n);
            if (insight?.pctCorrect != null) {
              const miss = 100 - insight.pctCorrect;
              f.missPct = f.missPct == null ? miss : Math.max(f.missPct, miss);
            }
            flags.set(r.id, f);
          }
        }
        return { section, index: si, flags: [...flags.values()] };
      })
      .filter((e) => e.section.image && e.flags.length);
  }, [sections, byId]);
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  if (!screens.length) return null;
  const sc = screens[Math.min(current, screens.length - 1)];
  const worst = [...sc.flags].sort((a, b) => (b.missPct ?? -1) - (a.missPct ?? -1))[0];

  return (
    <Card className="px-5 pt-4 pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Which red flags people missed</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Point at a flag to find it on the screenshot.</p>
        </div>
        {screens.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Screenshot">
            {screens.map((e, i) => (
              <button
                key={e.section.id}
                type="button"
                aria-pressed={i === current}
                title={e.section.title}
                onClick={() => {
                  setCurrent(i);
                  setActive(null);
                }}
                className={cn(
                  'h-8 rounded-full px-3 text-[13px] font-semibold',
                  i === current ? 'bg-brand-tint text-brand ring-1 ring-brand ring-inset' : 'bg-surface text-ink-2 ring-1 ring-line-strong ring-inset hover:bg-ground-2',
                )}
              >
                Section {e.index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,1fr)]">
        <EvidencePlate
          key={sc.section.id}
          image={sc.section.image!}
          highlights={sc.flags.map((f) => f.region)}
          revealed
          regionTone={(_, i) => toneFor(sc.flags[i].missPct)}
          activeId={active}
          onActiveChange={setActive}
          maxHeight="560px"
        />
        <div>
          <p className="text-sm font-semibold text-ink">{sc.section.title || `Section ${sc.index + 1}`}</p>
          {worst?.missPct != null ? (
            <p className="mt-1 text-[13px] leading-5 text-ink-2">
              Most missed: <span className="font-semibold text-ink">{worst.region.label || 'unnamed flag'}</span>, missed by {formatPct(Math.round(worst.missPct))}.
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-ink-3">No answers yet for this section.</p>
          )}
          <ol className="mt-4 grid gap-1">
            {sc.flags.map((f, i) => (
              <li
                key={f.region.id}
                className={cn('flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm leading-5', active === f.region.id && 'bg-brand-tint')}
                onPointerEnter={() => setActive(f.region.id)}
                onPointerLeave={() => setActive(null)}
              >
                <EvidenceMarker n={i + 1} size={20} tone={toneFor(f.missPct)} className="mt-px" />
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{f.region.label || 'Red flag'}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {f.missPct == null ? 'No answers yet' : `Missed by ${formatPct(Math.round(f.missPct))}`}
                    {' · '}
                    {f.questions.length === 1 ? `Question ${f.questions[0]}` : `Questions ${f.questions.join(', ')}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-3">
            <span className="inline-flex items-center gap-1">
              <EvidenceMarker n="" tone="missed" size={12} /> Missed by half or more
            </span>
            <span className="inline-flex items-center gap-1">
              <EvidenceMarker n="" tone="marker" size={12} /> A quarter to a half
            </span>
            <span className="inline-flex items-center gap-1">
              <EvidenceMarker n="" tone="correct" size={12} /> Under a quarter
            </span>
          </p>
        </div>
      </div>
    </Card>
  );
}
