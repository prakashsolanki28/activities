const TZ = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dateTimeYear = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' });

export function formatDateTime(iso: string | null | undefined, withYear = false): string {
  if (!iso) return '—';
  return (withYear ? dateTimeYear : dateTime).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateOnly.format(new Date(iso)) : '—';
}

export function formatDay(isoDate: string): string {
  return shortDay.format(new Date(`${isoDate}T12:00:00+05:30`));
}

/** 754 → "12m 34s"; 3700 → "1h 01m". */
export function formatDuration(totalSec: number | null | undefined): string {
  if (totalSec == null) return '—';
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** Countdown clock: 3600 → "60:00", 65 → "1:05". */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatPct(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

export function formatPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function relativeFromNow(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const value = minutes < 60 ? `${minutes} min` : hours < 48 ? `${hours} h` : `${days} days`;
  return diff >= 0 ? `in ${value}` : `${value} ago`;
}

/** ISO string → value for <input type="datetime-local"> in IST. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (read as IST) → ISO string. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}:00+05:30`).toISOString();
}
