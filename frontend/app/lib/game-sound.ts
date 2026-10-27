/* Projector sounds: Web Audio only, no files. Browsers block audio until a gesture, so everything is a no-op until unlock(). */

export interface GameSound {
  unlock(): void;
  tick(): void;
  buzzer(): void;
  sting(): void;
  fanfare(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  readonly unlocked: boolean;
}

type Wave = OscillatorType;

export function createGameSound(): GameSound {
  let ctx: AudioContext | null = null;
  let muted = false;

  const tone = (freq: number, start: number, dur: number, type: Wave = 'sine', gain = 0.18, slideTo?: number) => {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  };

  return {
    unlock() {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx ??= new AC();
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        ctx = null;
      }
    },
    tick() {
      tone(1100, 0, 0.07, 'square', 0.08);
    },
    buzzer() {
      tone(150, 0, 0.9, 'sawtooth', 0.22);
      tone(155, 0, 0.9, 'square', 0.12);
    },
    sting() {
      tone(392, 0, 0.18, 'triangle');
      tone(523, 0.14, 0.18, 'triangle');
      tone(784, 0.28, 0.45, 'triangle');
    },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.16, 0.3, 'triangle', 0.2));
      tone(1047, 0.7, 0.9, 'triangle', 0.22);
      tone(784, 0.7, 0.9, 'sine', 0.14);
      tone(523, 0.7, 0.9, 'sine', 0.14);
    },
    setMuted(m) {
      muted = m;
    },
    get muted() {
      return muted;
    },
    get unlocked() {
      return ctx !== null;
    },
  };
}
