import { useEffect, useRef, useState } from 'react';
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { Hand, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { ImageRef, Region, SpotBox } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { EvidenceMarker, type MarkerTone } from './marker';
import { BoxFrame, SpotLayer } from './spot-layer';
import { cn } from '~/lib/utils';

export interface PlatePoint {
  x: number;
  y: number;
}

interface PlateProps {
  image: ImageRef;
  /** Red-flag regions to mark. Shown only when `revealed`. */
  highlights?: Region[];
  revealed?: boolean;
  /** Hotspot questions: where the employee tapped, and a handler to set it. */
  point?: PlatePoint | null;
  onPoint?: (p: PlatePoint) => void;
  /** Correct hotspot regions, shown after reveal (outlined, unnumbered). */
  answerRegions?: Region[];
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  caption?: React.ReactNode;
  className?: string;
  /** Cap the plate height and offer the full-screen viewer. */
  maxHeight?: string;
  /** Below `lg`, show a short tappable strip that opens the full-screen viewer instead of the full plate. */
  stripOnMobile?: boolean;
  /** Tone per region (e.g. by miss rate in admin insights). Defaults to marker yellow. */
  regionTone?: (region: Region, index: number) => MarkerTone;
  /** Number shown on a region's marker; defaults to its position in `highlights`. */
  regionNumber?: (region: Region, index: number) => number;
  /** Spot the red flags: drag a box, adjust it, confirm it. */
  onMark?: (b: SpotBox) => void;
  /** Label of the confirm button on a drawn box ("Check", or "Mark it" while results are held). */
  markLabel?: string;
  /** A box sent for judging, shown until the verdict comes back. */
  pendingMark?: SpotBox | null;
  /** Wrong boxes, kept visible in dashed red. */
  missMarks?: SpotBox[];
  /** Boxes recorded without a verdict (results held). */
  drawnMarks?: SpotBox[];
}

/**
 * The evidence plate: a screenshot on a white plate, zoomable (pinch, double-tap, +/−),
 * with red-flag regions and their numbered markers dropping in on reveal.
 */
export function EvidencePlate(props: PlateProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const strip = props.stripOnMobile;
  return (
    <figure className={cn('flex min-h-0 flex-col', props.className)}>
      {strip ? (
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="group/strip relative block h-36 w-full overflow-hidden rounded-xs border border-line-strong bg-surface text-left shadow-plate lg:hidden"
          aria-label={`Inspect the evidence full screen: ${props.image.alt || 'screenshot'}`}
        >
          <img src={props.image.url} alt="" width={props.image.w} height={props.image.h} className="h-full w-full object-cover object-top" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-graphite/90 px-3 py-2 text-[13px] font-semibold text-shell-fg">
            Tap to inspect the evidence
            <Maximize2 className="size-4 text-marker" aria-hidden />
          </span>
        </button>
      ) : null}
      <div className={cn(strip && 'hidden lg:block')}>
        <ZoomableEvidence {...props} onExpand={() => setFullscreen(true)} />
        {props.caption ? <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">{props.caption}</figcaption> : null}
      </div>
      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="flex h-[92dvh] w-[96vw] max-w-[96vw] flex-col gap-3 border-graphite-3 bg-graphite p-3 text-shell-fg sm:max-w-[96vw] [&>button]:text-shell-fg">
          <DialogTitle className="pr-10 text-sm font-semibold text-shell-fg">{props.image.alt || 'Evidence'}</DialogTitle>
          <ZoomableEvidence {...props} maxHeight={undefined} dark className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
    </figure>
  );
}

function ZoomableEvidence({
  image,
  highlights = [],
  revealed = false,
  point,
  onPoint,
  answerRegions = [],
  activeId,
  onActiveChange,
  maxHeight,
  regionTone,
  regionNumber,
  onMark,
  markLabel = 'Check',
  pendingMark = null,
  missMarks = [],
  drawnMarks = [],
  onExpand,
  dark,
  className,
}: PlateProps & { onExpand?: () => void; dark?: boolean }) {
  const ref = useRef<ReactZoomPanPinchContentRef>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [moveMode, setMoveMode] = useState(false);
  const [hint, setHint] = useState<{ text: string; at: number } | null>(null);
  const drawing = !!onMark && !moveMode;

  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 2600);
    return () => window.clearTimeout(t);
  }, [hint]);

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!onPoint || !down.current || !imgRef.current) return;
    const moved = Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y);
    down.current = null;
    if (moved > 6) return; // that was a pan, not a tap
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    onPoint({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  return (
    <div
      className={cn(
        'group/plate relative overflow-hidden rounded-xs border',
        dark ? 'border-graphite-3 bg-graphite-2' : 'border-line-strong bg-surface shadow-plate',
        className,
      )}
    >
      <TransformWrapper
        ref={ref}
        minScale={1}
        maxScale={5}
        centerOnInit
        doubleClick={{ mode: 'toggle', step: 1, disabled: drawing }}
        wheel={{ activationKeys: ['Control', 'Meta'], step: 0.12 }}
        panning={{ disabled: scale <= 1 || drawing, velocityDisabled: true }}
        onTransform={(_, state) => setScale(state.scale)}
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%', maxHeight }}
          wrapperClass={cn(dark && '!h-full')}
          contentStyle={{ width: '100%' }}
        >
          <div
            ref={imgRef}
            className={cn('relative w-full select-none', onPoint && 'cursor-crosshair')}
            style={{ aspectRatio: `${image.w} / ${image.h}`, '--inv': 1 / Math.max(scale, 1) } as React.CSSProperties}
            onPointerDown={(e) => {
              down.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={onMark ? undefined : handlePointerUp}
          >
            <img src={image.url} alt={image.alt} width={image.w} height={image.h} draggable={false} className="block h-full w-full" />
            {revealed &&
              answerRegions.map((r) => (
                <span
                  key={r.id}
                  aria-hidden
                  className="animate-region-draw absolute rounded-[1px] border-2 border-dashed border-ledger bg-ledger/10"
                  style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
                />
              ))}
            {revealed &&
              highlights.map((r, i) => (
                <RegionMark
                  key={r.id}
                  region={r}
                  n={regionNumber ? regionNumber(r, i) : i + 1}
                  delay={onMark ? 0 : i * 90}
                  active={activeId === r.id}
                  onHover={onActiveChange}
                  tone={regionTone?.(r, i)}
                />
              ))}
            {missMarks.map((m, i) => (
              <BoxFrame key={`m-${m.x}-${m.y}-${i}`} box={m} tone="miss" />
            ))}
            {drawnMarks.map((m, i) => (
              <BoxFrame key={`d-${m.x}-${m.y}-${i}`} box={m} tone="drawn" />
            ))}
            {onMark || pendingMark ? (
              <SpotLayer
                onMark={(b) => onMark?.(b)}
                pending={pendingMark}
                scale={scale}
                confirmLabel={markLabel}
                paused={moveMode || !onMark}
                onHint={(text) => setHint({ text, at: Date.now() })}
              />
            ) : null}
            {point ? (
              <span
                aria-hidden
                className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-graphite bg-marker shadow-[0_0_0_3px_rgb(255_255_255/0.9)]"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            ) : null}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {hint ? (
        <p key={hint.at} role="status" className="animate-stamp-in pointer-events-none absolute top-2 left-2 z-20 rounded-sm bg-graphite px-3 py-1.5 text-[13px] font-semibold text-shell-fg shadow-pop">
          {hint.text}
        </p>
      ) : null}
      <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-90 transition-opacity group-hover/plate:opacity-100">
        {onMark && scale > 1 ? (
          <PlateButton label={moveMode ? 'Back to drawing boxes' : 'Move the view'} onClick={() => setMoveMode((m) => !m)} dark={dark} pressed={moveMode}>
            <Hand />
          </PlateButton>
        ) : null}
        <PlateButton label="Zoom in" onClick={() => ref.current?.zoomIn(0.6)} dark={dark}>
          <Plus />
        </PlateButton>
        {scale > 1 ? (
          <>
            <PlateButton label="Zoom out" onClick={() => ref.current?.zoomOut(0.6)} dark={dark}>
              <Minus />
            </PlateButton>
            <PlateButton label="Reset view" onClick={() => ref.current?.resetTransform()} dark={dark}>
              <RotateCcw />
            </PlateButton>
          </>
        ) : null}
        {onExpand ? (
          <PlateButton label="Open full screen" onClick={onExpand} dark={dark}>
            <Maximize2 />
          </PlateButton>
        ) : null}
      </div>
    </div>
  );
}

function PlateButton({ label, onClick, children, dark, pressed }: { label: string; onClick: () => void; children: React.ReactNode; dark?: boolean; pressed?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant={dark ? 'shell' : 'outline'}
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className={cn(!dark && 'bg-surface/95 backdrop-blur-[2px]', pressed && 'bg-graphite text-shell-fg hover:bg-graphite-2')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RegionMark({ region, n, delay, active, onHover, tone = 'marker' }: { region: Region; n: number; delay: number; active: boolean; onHover?: (id: string | null) => void; tone?: MarkerTone }) {
  // Pin the marker above the region's top-left corner, or below it when the region hugs the top edge.
  const below = region.y < 7;
  return (
    <span
      className="absolute"
      style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
      onPointerEnter={() => onHover?.(region.id)}
      onPointerLeave={() => onHover?.(null)}
    >
      <span
        aria-hidden
        className={cn(
          'animate-region-draw absolute inset-0 rounded-[1px] border-2 border-marker shadow-[0_0_0_1px_rgb(26_28_30/0.85),inset_0_0_0_1px_rgb(26_28_30/0.5)] transition-colors',
          active ? 'bg-marker/30' : 'bg-marker/12',
        )}
        style={{ animationDelay: `${delay}ms` }}
      />
      <span
        className={cn('animate-marker-drop absolute left-0 drop-shadow-[0_2px_1px_rgb(0_0_0/0.25)]', below ? 'top-full mt-1' : 'bottom-full mb-1')}
        style={{ animationDelay: `${delay + 120}ms` }}
      >
        <EvidenceMarker n={n} size={active ? 26 : 22} tone={tone} title={`Marker ${n}: ${region.label}`} />
      </span>
    </span>
  );
}

/** The numbered list beside the plate: what each marker shows. */
export function EvidenceLog({
  regions,
  activeId,
  onActiveChange,
  className,
}: {
  regions: Region[];
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  className?: string;
}) {
  if (!regions.length) return null;
  return (
    <ol className={cn('space-y-1.5', className)} aria-label="Red flags marked on the evidence">
      {regions.map((r, i) => (
        <li
          key={r.id}
          className={cn(
            'animate-stamp-in flex items-start gap-2.5 rounded-xs px-1.5 py-1 text-sm leading-5 text-ink transition-colors',
            activeId === r.id && 'bg-marker-wash',
          )}
          style={{ animationDelay: `${i * 90 + 200}ms` }}
          onPointerEnter={() => onActiveChange?.(r.id)}
          onPointerLeave={() => onActiveChange?.(null)}
        >
          <EvidenceMarker n={i + 1} size={20} className="mt-px" />
          <span>{r.label || 'Red flag'}</span>
        </li>
      ))}
    </ol>
  );
}
