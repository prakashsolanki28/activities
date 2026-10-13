import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { clampSpotBox, SPOT_MAX_H, SPOT_MAX_W, SPOT_MIN_SIDE, type SpotBox } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

type Corner = 'nw' | 'ne' | 'sw' | 'se';
type Gesture =
  | { kind: 'draw'; ox: number; oy: number; cx: number; cy: number }
  | { kind: 'move'; start: SpotBox; px: number; py: number }
  | { kind: 'resize'; start: SpotBox; corner: Corner; px: number; py: number };

/** Below this many screen pixels a press is a tap, not a drag. */
const TAP_PX = 6;
const STEP = 0.5;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const round = (n: number) => Math.round(n * 10) / 10;
export const isTooBig = (b: SpotBox) => b.w > SPOT_MAX_W + 0.05 || b.h > SPOT_MAX_H + 0.05;

/** Box spanned by two points, kept on the image. */
function span(ax: number, ay: number, bx: number, by: number): SpotBox {
  const x1 = clamp(Math.min(ax, bx), 0, 100);
  const y1 = clamp(Math.min(ay, by), 0, 100);
  const x2 = clamp(Math.max(ax, bx), 0, 100);
  const y2 = clamp(Math.max(ay, by), 0, 100);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Grow a sliver of a box to the smallest allowed size around its centre. */
function atLeastMin(b: SpotBox): SpotBox {
  if (b.w >= SPOT_MIN_SIDE && b.h >= SPOT_MIN_SIDE) return b;
  const w = Math.max(b.w, SPOT_MIN_SIDE * 1.5);
  const h = Math.max(b.h, SPOT_MIN_SIDE * 1.5);
  return { x: clamp(b.x + b.w / 2 - w / 2, 0, 100 - w), y: clamp(b.y + b.h / 2 - h / 2, 0, 100 - h), w, h };
}

/**
 * Spot the red flags, drawing layer: drag a box around something suspicious, adjust it with the
 * corner handles or by moving it, then confirm. A plain tap marks nothing. Sits inside the zoomed
 * content, so handles and the action bar are counter-scaled to keep their on-screen size.
 */
export function SpotLayer({
  onMark,
  pending,
  scale,
  confirmLabel,
  paused,
  onHint,
}: {
  onMark: (b: SpotBox) => void;
  /** A box sent for judging, shown until the verdict comes back. */
  pending: SpotBox | null;
  scale: number;
  confirmLabel: string;
  /** "Move the view" is on: let the pan through, keep the draft visible. */
  paused?: boolean;
  onHint: (text: string) => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState<SpotBox | null>(null);
  const [drawing, setDrawing] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Set<number>());
  const start = useRef<{ x: number; y: number } | null>(null);
  const inv = 1 / Math.max(scale, 1);

  // Hand the keyboard to the action bar once a box is drawn, so Enter checks it.
  useEffect(() => {
    if (draft && !drawing) (confirmRef.current ?? discardRef.current)?.focus({ preventScroll: true });
  }, [draft, drawing]);

  const toPct = (clientX: number, clientY: number) => {
    const r = layer.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };

  const begin = (e: React.PointerEvent, g: Gesture) => {
    e.stopPropagation();
    pointers.current.add(e.pointerId);
    if (pointers.current.size > 1) {
      // A second finger means pinch-zoom, not drawing.
      gesture.current = null;
      setDrawing(false);
      return;
    }
    gesture.current = g;
    start.current = { x: e.clientX, y: e.clientY };
    layer.current?.setPointerCapture(e.pointerId);
  };

  const onDown = (e: React.PointerEvent) => {
    if (pending || e.button > 0) return;
    const p = toPct(e.clientX, e.clientY);
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return;
    begin(e, { kind: 'draw', ox: p.x, oy: p.y, cx: p.x, cy: p.y });
  };

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || !layer.current) return;
    const p = toPct(e.clientX, e.clientY);
    if (g.kind === 'draw') {
      const moved = start.current ? Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) : 0;
      if (moved < TAP_PX && !drawing) return;
      g.cx = p.x;
      g.cy = p.y;
      setDrawing(true);
      setDraft(span(g.ox, g.oy, p.x, p.y));
    } else if (g.kind === 'move') {
      const dx = p.x - g.px;
      const dy = p.y - g.py;
      setDraft({ ...g.start, x: clamp(g.start.x + dx, 0, 100 - g.start.w), y: clamp(g.start.y + dy, 0, 100 - g.start.h) });
    } else {
      const s = g.start;
      const fixedX = g.corner.endsWith('w') ? s.x + s.w : s.x;
      const fixedY = g.corner.startsWith('n') ? s.y + s.h : s.y;
      setDraft(span(fixedX, fixedY, p.x, p.y));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'draw') {
      const moved = start.current ? Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) : 0;
      setDrawing(false);
      if (moved < TAP_PX) {
        onHint('Drag to draw a box around the red flag.');
        return;
      }
      setDraft((d) => (d ? atLeastMin(d) : d));
    } else {
      setDraft((d) => (d ? atLeastMin(d) : d));
    }
  };

  const onCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.kind === 'draw') setDraft(null);
    gesture.current = null;
    setDrawing(false);
  };

  const confirm = () => {
    if (!draft || isTooBig(draft) || pending) return;
    onMark(clampSpotBox({ x: round(draft.x), y: round(draft.y), w: round(draft.w), h: round(draft.h) }));
    setDraft(null);
  };
  const discard = () => setDraft(null);

  const onKey = (e: React.KeyboardEvent) => {
    if (!draft) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      discard();
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir) return;
    e.preventDefault();
    const [dx, dy] = dir.map((d) => d * STEP);
    setDraft((d) => {
      if (!d) return d;
      if (e.shiftKey) {
        // Shift + arrows resize from the bottom-right corner.
        const w = clamp(d.w + dx, SPOT_MIN_SIDE, 100 - d.x);
        const h = clamp(d.h + dy, SPOT_MIN_SIDE, 100 - d.y);
        return { ...d, w, h };
      }
      return { ...d, x: clamp(d.x + dx, 0, 100 - d.w), y: clamp(d.y + dy, 0, 100 - d.h) };
    });
  };

  const tooBig = !!draft && isTooBig(draft);
  const below = !draft || draft.y + draft.h < 78;
  // Keep the action bar on the plate: hug the box's near edge when it sits by a side.
  const centre = draft ? draft.x + draft.w / 2 : 50;
  const align: 'left' | 'centre' | 'right' = centre < 22 ? 'left' : centre > 78 ? 'right' : 'centre';

  return (
    <div
      ref={layer}
      className={cn('absolute inset-0 z-10 touch-pinch-zoom', paused ? 'pointer-events-none' : pending ? 'cursor-progress' : 'cursor-crosshair')}
      style={{ '--inv': inv } as React.CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
      onKeyDown={onKey}
    >
      {pending ? <BoxFrame box={pending} tone="pending" /> : null}

      {draft ? (
        <div
          role="group"
          tabIndex={-1}
          aria-label={`Your box. Arrow keys move it, Shift with arrow keys resizes it, Enter ${confirmLabel.toLowerCase()}s it, Escape removes it.`}
          className={cn('absolute outline-none', !drawing && !paused && 'cursor-move')}
          style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }}
          onPointerDown={(e) => {
            if (drawing || pending) return;
            const p = toPct(e.clientX, e.clientY);
            begin(e, { kind: 'move', start: draft, px: p.x, py: p.y });
          }}
        >
          <BoxFrame box={null} tone={tooBig ? 'bad' : 'draft'} />
          {tooBig ? (
            <span
              className="absolute top-0 left-0 origin-top-left bg-evidence px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-white"
              style={{ transform: 'scale(var(--inv))' }}
            >
              Too big
            </span>
          ) : null}
          {!drawing
            ? (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                <span
                  key={c}
                  aria-hidden
                  className={cn(
                    'absolute grid size-7 place-items-center',
                    c === 'nw' && 'cursor-nwse-resize',
                    c === 'se' && 'cursor-nwse-resize',
                    c === 'ne' && 'cursor-nesw-resize',
                    c === 'sw' && 'cursor-nesw-resize',
                  )}
                  style={{
                    [c.startsWith('n') ? 'top' : 'bottom']: 0,
                    [c.endsWith('w') ? 'left' : 'right']: 0,
                    transform: `translate(${c.endsWith('w') ? '-50%' : '50%'}, ${c.startsWith('n') ? '-50%' : '50%'}) scale(var(--inv))`,
                  }}
                  onPointerDown={(e) => {
                    if (pending) return;
                    const p = toPct(e.clientX, e.clientY);
                    begin(e, { kind: 'resize', start: draft, corner: c, px: p.x, py: p.y });
                  }}
                >
                  <span className="size-3 rounded-[1px] border-2 border-graphite bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.3)]" />
                </span>
              ))
            : null}
          {!drawing ? (
            <div
              className={cn(
                'pointer-events-auto absolute flex items-center gap-1 rounded-sm bg-graphite p-1 shadow-pop',
                below ? 'top-full' : 'bottom-full',
                align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2',
              )}
              style={{
                transform: `${align === 'centre' ? 'translateX(-50%) ' : ''}translateY(${below ? '8px' : '-8px'}) scale(var(--inv))`,
                transformOrigin: `${below ? 'top' : 'bottom'} ${align === 'centre' ? 'center' : align}`,
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {tooBig ? (
                <span className="px-2 text-xs font-semibold whitespace-nowrap text-shell-fg">Box one thing at a time</span>
              ) : (
                <Button ref={confirmRef} type="button" size="sm" className="h-8" onClick={confirm}>
                  <Check strokeWidth={3} /> {confirmLabel}
                </Button>
              )}
              <Button ref={discardRef} type="button" size="icon-sm" variant="shell" className="size-8" aria-label="Remove this box" onClick={discard}>
                <X />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The drawn rectangle: marker yellow with a graphite hairline, like the flags it hunts for. */
export function BoxFrame({ box, tone }: { box: SpotBox | null; tone: 'draft' | 'pending' | 'bad' | 'miss' | 'drawn' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute rounded-[1px]',
        box ? '' : 'inset-0',
        tone === 'draft' && 'bg-marker/15',
        tone === 'pending' && 'animate-pulse bg-marker/25',
        tone === 'bad' && 'bg-evidence/10',
        tone === 'miss' && 'animate-miss grid place-items-center bg-evidence/10',
        tone === 'drawn' && 'animate-stamp-in bg-graphite/10',
      )}
      style={{
        ...(box ? { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` } : null),
        borderStyle: tone === 'miss' || tone === 'bad' ? 'dashed' : 'solid',
        borderWidth: 'calc(2px * var(--inv, 1))',
        borderColor: tone === 'miss' || tone === 'bad' ? 'var(--evidence-red)' : tone === 'drawn' ? 'var(--graphite)' : 'var(--marker)',
        boxShadow:
          tone === 'drawn'
            ? '0 0 0 calc(1.5px * var(--inv, 1)) rgb(255 255 255 / 0.9)'
            : tone === 'miss' || tone === 'bad'
              ? '0 0 0 calc(1px * var(--inv, 1)) rgb(255 255 255 / 0.85)'
              : '0 0 0 calc(1px * var(--inv, 1)) rgb(26 28 30 / 0.85), inset 0 0 0 calc(1px * var(--inv, 1)) rgb(26 28 30 / 0.5)',
      }}
    >
      {tone === 'miss' ? <X className="size-3.5 text-evidence" strokeWidth={3} style={{ transform: 'scale(var(--inv, 1))' }} /> : null}
    </span>
  );
}
