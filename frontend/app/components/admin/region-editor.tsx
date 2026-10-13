import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ImageRef, Region } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { EvidenceMarker } from '~/components/evidence/marker';
import { newId } from '~/lib/ids';
import { cn } from '~/lib/utils';

type Drag =
  | { kind: 'draw'; x0: number; y0: number; id: string }
  | { kind: 'move'; id: string; dx: number; dy: number }
  | { kind: 'resize'; id: string };

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round = (v: number) => Math.round(v * 10) / 10;

/**
 * Draw rectangles on a screenshot: drag on empty space to add, drag a box to move it,
 * drag its corner to resize. Coordinates are stored in percent of the image.
 */
export function RegionEditor({
  image,
  regions,
  onChange,
  variant = 'flags',
  emptyHint,
}: {
  image: ImageRef;
  regions: Region[];
  onChange: (r: Region[]) => void;
  variant?: 'flags' | 'answer';
  emptyHint?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const toPct = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  };

  const update = (id: string, patch: Partial<Region>) => onChange(regions.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const regionId = target.closest<HTMLElement>('[data-region]')?.dataset.region;
    const p = toPct(e);
    box.current!.setPointerCapture(e.pointerId);
    if (target.dataset.handle && regionId) {
      setDrag({ kind: 'resize', id: regionId });
      setSelected(regionId);
    } else if (regionId) {
      const r = regions.find((x) => x.id === regionId)!;
      setDrag({ kind: 'move', id: regionId, dx: p.x - r.x, dy: p.y - r.y });
      setSelected(regionId);
    } else {
      const id = newId();
      onChange([...regions, { id, x: round(p.x), y: round(p.y), w: 0.5, h: 0.5, label: '' }]);
      setDrag({ kind: 'draw', x0: p.x, y0: p.y, id });
      setSelected(id);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toPct(e);
    if (drag.kind === 'draw') {
      update(drag.id, {
        x: round(Math.min(drag.x0, p.x)),
        y: round(Math.min(drag.y0, p.y)),
        w: round(Math.max(0.5, Math.abs(p.x - drag.x0))),
        h: round(Math.max(0.5, Math.abs(p.y - drag.y0))),
      });
    } else if (drag.kind === 'move') {
      const r = regions.find((x) => x.id === drag.id)!;
      update(drag.id, { x: round(clamp(p.x - drag.dx, 0, 100 - r.w)), y: round(clamp(p.y - drag.dy, 0, 100 - r.h)) });
    } else {
      const r = regions.find((x) => x.id === drag.id)!;
      update(drag.id, { w: round(Math.max(0.5, p.x - r.x)), h: round(Math.max(0.5, p.y - r.y)) });
    }
  };

  const onUp = () => {
    if (drag?.kind === 'draw') {
      const r = regions.find((x) => x.id === drag.id);
      // A click without a drag is not a region.
      if (r && r.w < 1 && r.h < 1) {
        onChange(regions.filter((x) => x.id !== drag.id));
        setSelected(null);
      }
    }
    setDrag(null);
  };

  const remove = (id: string) => {
    onChange(regions.filter((r) => r.id !== id));
    if (selected === id) setSelected(null);
  };

  return (
    <div className="grid gap-3">
      <div
        ref={box}
        data-region-editor
        className="relative cursor-crosshair touch-none overflow-hidden rounded-xs border border-line-strong select-none"
        style={{ aspectRatio: `${image.w} / ${image.h}` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img src={image.url} alt={image.alt} draggable={false} className="pointer-events-none block h-full w-full" />
        {regions.map((r, i) => (
          <div
            key={r.id}
            data-region={r.id}
            className={cn(
              'absolute cursor-move rounded-[1px] border-2',
              variant === 'flags' ? 'border-marker bg-marker/15 shadow-[0_0_0_1px_rgb(26_28_30/0.85)]' : 'border-dashed border-ledger bg-ledger/15',
              selected === r.id && 'bg-marker/30 outline-2 outline-offset-2 outline-graphite',
            )}
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
          >
            {variant === 'flags' ? (
              <span className="pointer-events-none absolute bottom-full left-0 mb-0.5">
                <EvidenceMarker n={i + 1} size={18} />
              </span>
            ) : null}
            <span data-handle="1" className="absolute -right-1.5 -bottom-1.5 size-3 cursor-nwse-resize rounded-[1px] border border-graphite bg-surface" />
          </div>
        ))}
      </div>
      {regions.length ? (
        <ol className="grid gap-1.5">
          {regions.map((r, i) => (
            <li key={r.id} className={cn('flex items-center gap-2 rounded-xs px-1 py-0.5', selected === r.id && 'bg-marker-wash')} onFocus={() => setSelected(r.id)}>
              {variant === 'flags' ? <EvidenceMarker n={i + 1} size={18} /> : <span className="w-[18px] text-center text-xs font-bold text-green-ink">{i + 1}</span>}
              <Input
                aria-label={`Label for ${variant === 'flags' ? 'marker' : 'area'} ${i + 1}`}
                value={r.label}
                placeholder={variant === 'flags' ? 'What this red flag is, e.g. Look-alike sender domain' : 'Optional note for reviewers'}
                maxLength={200}
                onChange={(e) => update(r.id, { label: e.target.value })}
                className="h-8 text-[13px]"
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${i + 1}`} onClick={() => remove(r.id)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs leading-5 text-ink-3">{emptyHint ?? 'Drag on the image to draw a box.'}</p>
      )}
    </div>
  );
}
