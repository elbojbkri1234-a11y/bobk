/**
 * Canvas playback engine for the scroll tour.
 *
 * ScrollTrigger never draws. It only pushes a 0–1 progress value.
 * A requestAnimationFrame loop reads that progress, picks the nearest
 * frame, and paints. The loop parks itself after a few idle frames so a
 * resting page does not burn a 60 Hz timer; the next progress change
 * wakes it.
 *
 * Drawing rules:
 *   - Backing store uses devicePixelRatio, capped so a 4K / 5K screen
 *     does not allocate an 8K buffer for a 720p source.
 *   - The sharp still is object-fit: contain, aligned to integer device
 *     pixels, with high-quality smoothing. That is the sharpness path.
 *   - Letterboxing is filled with a tiny cover-scaled copy of the same
 *     still (the "ambient" field) so portrait and ultrawide viewports
 *     do not show empty bars. The contained image is never cropped.
 *   - Adjacent frames are crossfaded by the fractional progress. Hard
 *     cuts skip the blend.
 */

import { sampleFrames, type FrameSample } from "@/lib/frameIndex";
import type { FrameTicket } from "@/lib/frameLoader";

const MAX_DPR = 2;
const MAX_PIXELS = 3840 * 2160;
const IDLE_FRAMES_BEFORE_PARK = 6;

type Resolver = (index: number) => FrameTicket | null;
type Prefetch = (index: number, direction: -1 | 0 | 1) => void;
type SampleListener = (sample: FrameSample, progress: number) => void;

export class SequenceEngine {
  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private running = false;
  private idleFrames = 0;
  private changed = true;
  private force = true;

  private progress = 0;
  private direction: -1 | 0 | 1 = 0;
  private count = 0;
  private hardCuts: boolean[] = [];

  private resolve: Resolver | null = null;
  private prefetch: Prefetch | null = null;
  private listener: SampleListener | null = null;

  private lastEmitKey = "";
  private lastPrefetchIndex = -1;
  private lastPrefetchAt = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // desynchronized reduces input lag, but a few browsers reject the option.
    this.ctx =
      canvas.getContext("2d", { alpha: false, desynchronized: true }) ??
      canvas.getContext("2d", { alpha: false });
  }

  setCount(count: number): void {
    this.count = count;
    this.changed = true;
    this.force = true;
  }

  setHardCuts(cuts: readonly boolean[]): void {
    this.hardCuts = cuts.slice();
  }

  setResolver(resolve: Resolver | null): void {
    this.resolve = resolve;
    this.force = true;
    this.wake();
  }

  setPrefetch(prefetch: Prefetch | null): void {
    this.prefetch = prefetch;
  }

  setListener(listener: SampleListener | null): void {
    this.listener = listener;
  }

  getProgress(): number {
    return this.progress;
  }

  setProgress(progress: number): void {
    if (this.disposed) return;
    const next = clamp01(progress);
    if (next !== this.progress) {
      this.direction = next > this.progress ? 1 : -1;
      this.progress = next;
      this.changed = true;
    }
    // Paint in the scroll turn. Phones pause requestAnimationFrame while a
    // finger is down, so a loop-only draw leaves the tour frozen mid-swipe.
    this.render();
    this.wake();
  }

  /** A bitmap arrived or the viewport changed — paint on the next frame. */
  requestDraw(): void {
    if (this.disposed) return;
    this.force = true;
    this.changed = true;
    this.wake();
  }

  start(): void {
    this.wake();
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /**
   * Resize is cheap (one buffer realloc + one paint). Callers should still
   * debounce the *burst* — ScrollTrigger.refresh is the expensive half —
   * but the backing store itself updates immediately so the image never
   * sits stretched between events.
   */
  resize(): void {
    if (this.disposed || !this.ctx) return;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    if (cssW < 2 || cssH < 2) return;

    const dpr = this.computeDpr(cssW, cssH);
    const nextW = Math.max(1, Math.round(cssW * dpr));
    const nextH = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== nextW || this.canvas.height !== nextH) {
      this.canvas.width = nextW;
      this.canvas.height = nextH;
    }
    this.force = true;
    this.changed = true;
    this.wake();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.resolve = null;
    this.prefetch = null;
    this.listener = null;
    this.ctx = null;
  }

  private wake(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.idleFrames = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (): void => {
    if (!this.running || this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const drew = this.render();
    if (drew) {
      this.idleFrames = 0;
      return;
    }
    this.idleFrames += 1;
    if (this.idleFrames > IDLE_FRAMES_BEFORE_PARK) {
      this.stop();
    }
  };

  private render(): boolean {
    if (!this.ctx || this.count <= 0) return false;
    if (this.canvas.width < 2 || this.canvas.height < 2) {
      this.resize();
      if (this.canvas.width < 2) return false;
    }

    const sample = sampleFrames(this.progress, this.count, this.hardCuts);
    this.emit(sample);

    const drawKey = `${sample.base}:${sample.next}:${sample.blend.toFixed(3)}:${this.canvas.width}x${this.canvas.height}`;
    if (!this.changed && !this.force) return false;
    this.changed = false;

    const primary = this.resolve?.(sample.base) ?? this.nearestTicket(sample.base);
    if (!primary) {
      this.prefetch?.(sample.base, this.direction);
      this.force = true;
      return true;
    }

    let secondary: FrameTicket | null = null;
    if (sample.blend > 0 && sample.next !== sample.base) {
      secondary = this.resolve?.(sample.next) ?? null;
      if (!secondary) {
        // Paint the sharp nearest still rather than a half-empty blend,
        // and ask again next frame once the neighbor decodes.
        this.paint(primary, null, 0);
        this.prefetch?.(sample.next, this.direction);
        this.force = true;
        return true;
      }
    }

    this.paint(primary, secondary, secondary ? sample.blend : 0);
    this.force = false;
    this.maybePrefetch(sample.nearest);
    void drawKey;
    return true;
  }

  private emit(sample: FrameSample): void {
    const key = `${sample.nearest}:${this.progress.toFixed(4)}`;
    if (key === this.lastEmitKey) return;
    this.lastEmitKey = key;
    this.listener?.(sample, this.progress);
  }

  private maybePrefetch(index: number): void {
    const now = performance.now();
    if (index === this.lastPrefetchIndex && now - this.lastPrefetchAt < 160) return;
    this.lastPrefetchIndex = index;
    this.lastPrefetchAt = now;
    this.prefetch?.(index, this.direction);
  }

  private nearestTicket(index: number): FrameTicket | null {
    const resolve = this.resolve;
    if (!resolve || this.count <= 0) return null;
    const direct = resolve(index);
    if (direct) return direct;
    const span = this.count;
    for (let distance = 1; distance < span; distance += 1) {
      const before = resolve(index - distance);
      if (before) return before;
      const after = resolve(index + distance);
      if (after) return after;
    }
    return null;
  }

  private paint(primary: FrameTicket, secondary: FrameTicket | null, blend: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#120f0c";
    ctx.fillRect(0, 0, width, height);

    this.paintAmbient(ctx, primary, 1, width, height);
    if (secondary && blend > 0) this.paintAmbient(ctx, secondary, blend, width, height);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#120f0c";
    ctx.fillRect(0, 0, width, height);

    this.paintSharp(ctx, primary, 1, width, height);
    if (secondary && blend > 0) this.paintSharp(ctx, secondary, blend, width, height);

    this.paintVignette(ctx, width, height);
    ctx.globalAlpha = 1;
  }

  private paintAmbient(
    ctx: CanvasRenderingContext2D,
    ticket: FrameTicket,
    alpha: number,
    width: number,
    height: number,
  ): void {
    const scale = Math.max(width / 96, height / 54);
    const dw = 96 * scale;
    const dh = 54 * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.globalAlpha = alpha;
    try {
      ctx.drawImage(ticket.ambient, dx, dy, dw, dh);
    } catch {
      this.force = true;
    }
  }

  private paintSharp(
    ctx: CanvasRenderingContext2D,
    ticket: FrameTicket,
    alpha: number,
    width: number,
    height: number,
  ): void {
    if (ticket.width < 1 || ticket.height < 1) return;
    const scale = Math.min(width / ticket.width, height / ticket.height);
    const dw = Math.max(1, Math.round(ticket.width * scale));
    const dh = Math.max(1, Math.round(ticket.height * scale));
    const dx = Math.round((width - dw) / 2);
    const dy = Math.round((height - dh) / 2);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    try {
      ctx.drawImage(ticket.source, dx, dy, dw, dh);
    } catch {
      this.force = true;
    }
  }

  private paintVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const radial = ctx.createRadialGradient(
      width * 0.5,
      height * 0.46,
      width * 0.18,
      width * 0.5,
      height * 0.46,
      width * 0.72,
    );
    radial.addColorStop(0, "rgba(0,0,0,0)");
    radial.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, width, height);

    const linear = ctx.createLinearGradient(0, height * 0.58, 0, height);
    linear.addColorStop(0, "rgba(0,0,0,0)");
    linear.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = linear;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * devicePixelRatio, capped at 2 and at a 4K backing store.
   * A 720p source does not gain detail past that, and an uncapped 5K
   * framebuffer would miss frames.
   */
  private computeDpr(cssW: number, cssH: number): number {
    const raw = window.devicePixelRatio || 1;
    let dpr = Math.min(Math.max(raw, 1), MAX_DPR);
    const pixels = cssW * cssH * dpr * dpr;
    if (pixels > MAX_PIXELS) {
      dpr = Math.max(1, Math.sqrt(MAX_PIXELS / (cssW * cssH)));
    }
    return dpr;
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
