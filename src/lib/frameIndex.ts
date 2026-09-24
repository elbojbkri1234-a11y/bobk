/**
 * Pure scroll → frame math.
 *
 * The pinned section is longer than the film so each still owns many
 * pixels of scroll. Progress is linear (no ease curve) so a given scroll
 * position always maps to the same frame — down advances, up reverses.
 *
 * An intro hold keeps frame 0 on screen while the title is read. An outro
 * hold rests on the last frame before the pin releases. Between them, the
 * film progress is continuous.
 *
 * The committed index is the nearest frame (what the counter reports).
 * The canvas also crossfades the neighboring still by the fractional part,
 * which is the interpolation that keeps a 100-frame tour from stepping.
 * Blending is suppressed across hard cuts (gaps in the source numbering)
 * so two different rooms are never ghosted together.
 */

export const SEQUENCE_TIMING = {
  /** GSAP scrub catch-up, in seconds. Tight enough to feel locked, soft enough to kill trackpad jitter. */
  scrub: 0.35,
  /** Share of the pin spent holding frame 0 before the film moves. */
  introHold: 0.08,
  /** Share of the pin spent holding the final frame before release. */
  outroHold: 0.07,
  pixelsPerFrame: 56,
  /** 1:1 with the finger. Numeric scrub waits on rAF, which mobile Safari pauses during a swipe. */
  scrubTouch: true,
  pixelsPerFrameMobile: 44,
  minScreens: 4.6,
} as const;

export type FrameSample = {
  /** Nearest frame. Counter, chapters, and assistive text use this. */
  nearest: number;
  /** Floor frame drawn opaque. */
  base: number;
  /** Neighbor drawn at `blend` opacity. Equals `base` when there is no blend. */
  next: number;
  /** 0–1 opacity of `next`. */
  blend: number;
};

const HARD_BLEND_EPSILON = 0.004;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampIndex(value: number, count: number): number {
  if (count <= 0) return 0;
  return clamp(value, 0, count - 1);
}

/** 0 at the start of the film, 1 at the last frame. Holds map to the ends. */
export function tourProgress(scrollProgress: number): number {
  const span = 1 - SEQUENCE_TIMING.introHold - SEQUENCE_TIMING.outroHold;
  return clamp((scrollProgress - SEQUENCE_TIMING.introHold) / span, 0, 1);
}

/** Inverse of {@link tourProgress}, used to seek a chapter. */
export function tourToScroll(tour: number): number {
  const span = 1 - SEQUENCE_TIMING.introHold - SEQUENCE_TIMING.outroHold;
  return clamp(SEQUENCE_TIMING.introHold + clamp(tour, 0, 1) * span, 0, 1);
}

export function introVisible(scrollProgress: number): boolean {
  return scrollProgress < SEQUENCE_TIMING.introHold * 0.72;
}

/**
 * Nearest-frame sample plus a fractional blend toward the neighbor.
 * `hardCuts[i] === true` means frame i must not be blended into from i-1.
 */
export function sampleFrames(
  scrollProgress: number,
  count: number,
  hardCuts: readonly boolean[] = [],
): FrameSample {
  if (count <= 1) {
    return { nearest: 0, base: 0, next: 0, blend: 0 };
  }

  const exact = tourProgress(scrollProgress) * (count - 1);
  const nearest = clampIndex(Math.round(exact), count);
  let base = clampIndex(Math.floor(exact), count);
  let next = clampIndex(base + 1, count);
  let blend = exact - base;

  const crossesCut = next !== base && hardCuts[next] === true;
  if (crossesCut || next === base) {
    return { nearest, base: nearest, next: nearest, blend: 0 };
  }

  if (blend < HARD_BLEND_EPSILON) blend = 0;
  if (blend > 1 - HARD_BLEND_EPSILON) {
    base = next;
    blend = 0;
  }

  return { nearest, base, next, blend };
}

/**
 * Frames that must be decoded before scroll is unlocked.
 * The opening run keeps the first gestures smooth; the spread keyframes
 * give a fast flick somewhere real to land.
 */
export function criticalFrameIndices(count: number): number[] {
  if (count <= 0) return [];
  const set = new Set<number>();
  const opening = Math.min(count, 10);
  for (let i = 0; i < opening; i += 1) set.add(i);
  const samples = Math.min(count, 12);
  if (samples === 1) {
    set.add(0);
  } else {
    for (let s = 0; s < samples; s += 1) {
      set.add(Math.round((s / (samples - 1)) * (count - 1)));
    }
  }
  set.add(count - 1);
  return [...set].sort((a, b) => a - b);
}

/** Fetch priority: poster, then critical stills, then the film in order. */
export function loadOrder(count: number, critical: readonly number[]): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  const push = (index: number) => {
    if (index < 0 || index >= count || seen.has(index)) return;
    seen.add(index);
    order.push(index);
  };
  push(0);
  for (const index of critical) push(index);
  for (let index = 1; index < count; index += 1) push(index);
  return order;
}

export function keyframeIndices(count: number, stride: number): number[] {
  if (count <= 0) return [];
  const set = new Set<number>();
  set.add(0);
  set.add(count - 1);
  const step = Math.max(1, stride);
  for (let index = 0; index < count; index += step) set.add(index);
  return [...set].sort((a, b) => a - b);
}

export function padFrame(value: number, width = 3): string {
  return String(Math.max(0, value)).padStart(width, "0");
}

/** Pixel length of the pin. More pixels per frame means slow scrolls cannot skip a still. */
export function pinDistance(frameCount: number, viewportHeight: number, mobile: boolean): number {
  const per = mobile
    ? SEQUENCE_TIMING.pixelsPerFrameMobile
    : SEQUENCE_TIMING.pixelsPerFrame;
  const count = Math.max(frameCount, 1);
  return Math.round(Math.max(viewportHeight * SEQUENCE_TIMING.minScreens, count * per));
}
