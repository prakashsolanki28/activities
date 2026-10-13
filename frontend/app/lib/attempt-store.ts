/**
 * The attempt token lives in localStorage so a closed tab resumes on the same device.
 * Every access is guarded: private windows and blocked storage must not break the player.
 */
export interface StoredAttempt {
  attemptId: string;
  token: string;
  employeeId: string;
  name: string;
}

const key = (slug: string) => `hrrl.attempt.${slug}`;
/** In-memory copy so the session survives even when storage throws. */
const memory = new Map<string, StoredAttempt>();

export function loadAttempt(slug: string): StoredAttempt | null {
  if (memory.has(slug)) return memory.get(slug)!;
  try {
    const raw = window.localStorage.getItem(key(slug));
    return raw ? (JSON.parse(raw) as StoredAttempt) : null;
  } catch {
    return null;
  }
}

export function saveAttempt(slug: string, value: StoredAttempt) {
  memory.set(slug, value);
  try {
    window.localStorage.setItem(key(slug), JSON.stringify(value));
  } catch {
    /* storage unavailable: the session still works until the tab closes */
  }
}

export function clearAttempt(slug: string) {
  memory.delete(slug);
  try {
    window.localStorage.removeItem(key(slug));
  } catch {
    /* ignore */
  }
}
