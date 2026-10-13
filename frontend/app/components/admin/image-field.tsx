import { useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { ImageRef } from '@hrrl/shared';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { errorMessage } from '~/lib/api';
import { adminApi } from '~/lib/admin-api';
import { cn } from '~/lib/utils';

/** Upload, replace or remove an image, with alt text. Uploads are re-encoded server-side. */
export function ImageField({
  value,
  onChange,
  label = 'Image',
  hint,
  disabled,
  compact,
}: {
  value: ImageRef | null | undefined;
  onChange: (v: ImageRef | null) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > 8 * 1024 * 1024) {
      setError('That image is over 8 MB. Use a smaller screenshot.');
      return;
    }
    setBusy(true);
    try {
      onChange(await adminApi.upload(file, value?.alt ?? ''));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const picker = (
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} />
  );

  if (!value) {
    return (
      <div>
        {picker}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-xs border border-dashed px-4 text-left transition-colors disabled:opacity-50',
            compact ? 'h-11' : 'h-20',
            dragging ? 'border-graphite bg-marker-wash' : 'border-line-strong bg-surface hover:border-ink-3 hover:bg-[#fafaf8]',
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-ink-3" /> : <ImagePlus className="size-5 text-ink-3" aria-hidden />}
          <span>
            <span className="block text-sm font-semibold text-ink">{busy ? 'Uploading…' : `Add ${label.toLowerCase()}`}</span>
            {!compact ? <span className="block text-xs text-ink-3">{hint ?? 'Drop a PNG, JPEG or WebP here, or browse. Up to 8 MB.'}</span> : null}
          </span>
        </button>
        {error ? <p className="mt-1.5 text-xs font-semibold text-red-ink">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {picker}
      <div className={cn('flex gap-3', compact ? 'items-center' : 'items-start')}>
        <img src={value.url} alt={value.alt} className={cn('shrink-0 rounded-xs border border-line object-cover object-top', compact ? 'h-11 w-16' : 'h-24 w-36')} />
        <div className="min-w-0 flex-1">
          {!compact ? (
            <p className="text-xs text-ink-3 tabular-nums">
              {value.w} × {value.h}px
            </p>
          ) : null}
          <div className={cn('flex flex-wrap gap-1.5', !compact && 'mt-1.5')}>
            <Button type="button" variant="outline" size="xs" disabled={disabled || busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Replace
            </Button>
            <Button type="button" variant="ghost" size="xs" disabled={disabled || busy} onClick={() => onChange(null)}>
              <Trash2 /> Remove
            </Button>
          </div>
        </div>
      </div>
      {!compact ? (
        <Input
          aria-label="Image description for screen readers"
          placeholder="Describe the image for screen readers"
          value={value.alt}
          maxLength={300}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          className="h-8 text-[13px]"
        />
      ) : null}
      {error ? <p className="text-xs font-semibold text-red-ink">{error}</p> : null}
    </div>
  );
}
