/**
 * Progressive frame loader.
 *
 * Network and decode are separate on purpose. The JPEGs are small; the
 * decoded bitmaps are not (a 1280×720 frame is ~3.5 MB uncompressed).
 * Holding all 100 decoded would be roughly 350 MB, which is enough to
 * jank or kill a phone tab.
 *
 * So:
 *   - Every file is fetched (blobs stay compressed, ~2.5 MB total).
 *   - Decode is windowed around the playhead, plus a sparse set of
 *     keyframes so a fast flick still lands on a real still.
 *   - Evicted bitmaps are closed. Blobs are kept so a still can be
 *     decoded again without another request.
 *   - Scroll stays locked until the critical set (opening run + spread
 *     keyframes) has settled — decoded or failed — so the first gesture
 *     never reveals an empty canvas.
 */

import {
  criticalFrameIndices,
  keyframeIndices,
  loadOrder,
} from "@/lib/frameIndex";

const AMBIENT_W = 96;
const AMBIENT_H = 54;
const DECODE_CONCURRENCY = 3;

export type FrameTicket = {
  source: CanvasImageSource;
  ambient: HTMLCanvasElement;
  width: number;
  height: number;
  close: () => void;
};

export type LibraryProgress = {
  ratio: number;
  loaded: number;
  total: number;
  criticalReady: boolean;
};

export type FrameLibrary = {
  readonly total: number;
  get(index: number): FrameTicket | null;
  /**
   * Keep a window around `index` decoded. Direction biases the window
   * forward so the next stills exist before the scroll arrives.
   * Safe to call every frame — it no-ops when the window is already hot.
   */
  touch(index: number, direction: -1 | 0 | 1): void;
  hasAny(): boolean;
  dispose(): void;
};

type LoadOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: LibraryProgress) => void;
  /** Fired when a bitmap becomes available, so the canvas can redraw. */
  onDecoded?: (index: number) => void;
  windowed?: boolean;
};

type ConnectionInfo = {
  saveData?: boolean;
  effectiveType?: string;
};

function connectionInfo(): ConnectionInfo | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: ConnectionInfo }).connection;
}

export function shouldWindowDecode(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number };
  // Full decode is ~350 MB. Only skip the window on machines that report
  // plenty of memory; everyone else keeps a sliding set of bitmaps.
  if (
    typeof nav.deviceMemory === "number" &&
    nav.deviceMemory >= 8 &&
    window.innerWidth >= 1100 &&
    !window.matchMedia("(pointer: coarse)").matches
  ) {
    return false;
  }
  return true;
}

function chooseFetchConcurrency(): number {
  const connection = connectionInfo();
  if (connection?.saveData) return 2;
  const type = connection?.effectiveType;
  if (type === "slow-2g" || type === "2g") return 2;
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches) return 4;
  return 6;
}

function makeAmbient(source: CanvasImageSource): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = AMBIENT_W;
  canvas.height = AMBIENT_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, AMBIENT_W, AMBIENT_H);
  }
  return canvas;
}

async function decodeBlob(blob: Blob): Promise<{ source: CanvasImageSource; close: () => void; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    const ready = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image decode failed"));
    });
    image.src = url;
    await ready;
    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch {
        // decode() can reject after onload on some browsers; the pixels are still usable.
      }
    }
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      close: () => {
        image.src = "";
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadFrameLibrary(
  urls: readonly string[],
  options: LoadOptions = {},
): { library: FrameLibrary; critical: Promise<void> } {
  const total = urls.length;
  const windowed = options.windowed ?? true;
  const signal = options.signal;

  const blobs: Array<Blob | null> = Array.from({ length: total }, () => null);
  const tickets: Array<FrameTicket | null> = Array.from({ length: total }, () => null);
  const failed = new Set<number>();
  const decoding = new Set<number>();
  const decodeQueue: number[] = [];

  const stride = windowed
    ? window.matchMedia("(max-width: 720px)").matches
      ? 8
      : 5
    : Math.max(1, total);
  const keyframes = new Set(keyframeIndices(total, stride));
  const criticalList = criticalFrameIndices(total);
  const critical = new Set(criticalList);
  const criticalSettled = new Set<number>();

  const radius = windowed
    ? window.matchMedia("(max-width: 720px)").matches
      ? 5
      : 12
    : total;

  let fetched = 0;
  let disposed = false;
  let activeDecodes = 0;
  let criticalReady = false;
  let resolveCritical: () => void = () => {};
  let rejectCritical: (reason?: unknown) => void = () => {};

  const criticalPromise = new Promise<void>((resolve, reject) => {
    resolveCritical = resolve;
    rejectCritical = reject;
  });

  // Avoid an unhandled rejection if the caller has already gone away.
  criticalPromise.catch(() => {});

  const emit = () => {
    if (disposed) return;
    const ratio = total === 0 ? 1 : fetched / total;
    options.onProgress?.({
      ratio: criticalReady ? 1 : Math.min(0.99, ratio),
      loaded: fetched,
      total,
      criticalReady,
    });
  };

  const noteCritical = (index: number) => {
    if (!critical.has(index) || criticalSettled.has(index)) return;
    criticalSettled.add(index);
    if (criticalSettled.size >= critical.size && !criticalReady) {
      criticalReady = true;
      emit();
      resolveCritical();
    }
  };

  const enqueueDecode = (index: number, front = false) => {
    if (disposed || index < 0 || index >= total) return;
    if (!blobs[index] || tickets[index] || decoding.has(index) || failed.has(index)) return;
    if (decodeQueue.includes(index)) {
      if (front) {
        const at = decodeQueue.indexOf(index);
        if (at > 0) {
          decodeQueue.splice(at, 1);
          decodeQueue.unshift(index);
        }
      }
      return;
    }
    if (front) decodeQueue.unshift(index);
    else decodeQueue.push(index);
    pumpDecode();
  };

  const pumpDecode = () => {
    if (disposed) return;
    while (activeDecodes < DECODE_CONCURRENCY && decodeQueue.length > 0) {
      const index = decodeQueue.shift();
      if (index === undefined) return;
      const blob = blobs[index];
      if (!blob || tickets[index] || decoding.has(index)) continue;
      decoding.add(index);
      activeDecodes += 1;
      decodeBlob(blob)
        .then((decoded) => {
          activeDecodes -= 1;
          decoding.delete(index);
          if (disposed || signal?.aborted) {
            decoded.close();
            pumpDecode();
            return;
          }
          tickets[index] = {
            source: decoded.source,
            ambient: makeAmbient(decoded.source),
            width: decoded.width,
            height: decoded.height,
            close: decoded.close,
          };
          noteCritical(index);
          options.onDecoded?.(index);
          pumpDecode();
        })
        .catch(() => {
          activeDecodes -= 1;
          decoding.delete(index);
          failed.add(index);
          noteCritical(index);
          pumpDecode();
        });
    }
  };

  const shouldDecodeImmediately = (index: number) => {
    if (!windowed) return true;
    // Critical stills must decode during preload, or the ready gate never opens.
    if (critical.has(index)) return true;
    if (keyframes.has(index)) return true;
    return index < Math.min(total, 10);
  };

  const evictOutside = (keep: Set<number>) => {
    if (!windowed) return;
    for (let index = 0; index < total; index += 1) {
      if (keep.has(index)) continue;
      const ticket = tickets[index];
      if (!ticket) continue;
      ticket.close();
      tickets[index] = null;
    }
  };

  const library: FrameLibrary = {
    total,
    get(index) {
      if (index < 0 || index >= total) return null;
      return tickets[index];
    },
    hasAny() {
      return tickets.some((ticket) => ticket !== null);
    },
    touch(index, direction) {
      if (disposed || total === 0) return;
      const center = Math.max(0, Math.min(total - 1, index));
      const ahead = direction === 0 ? radius : radius + 6;
      const behind = direction === 0 ? radius : Math.max(2, Math.floor(radius * 0.45));
      const start = Math.max(0, center - (direction < 0 ? ahead : behind));
      const end = Math.min(total - 1, center + (direction > 0 ? ahead : behind));

      const keep = new Set<number>();
      for (const keyframe of keyframes) keep.add(keyframe);
      for (let i = start; i <= end; i += 1) keep.add(i);
      keep.add(0);

      evictOutside(keep);

      const missing: number[] = [];
      for (const i of keep) {
        if (blobs[i] && !tickets[i] && !decoding.has(i) && !failed.has(i)) missing.push(i);
      }
      missing.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
      for (const i of missing) enqueueDecode(i, Math.abs(i - center) <= 2);
    },
    dispose() {
      disposed = true;
      decodeQueue.length = 0;
      for (const ticket of tickets) ticket?.close();
      tickets.fill(null);
      if (!criticalReady) {
        rejectCritical(new DOMException("Frame load aborted", "AbortError"));
      }
    },
  };

  if (total === 0) {
    criticalReady = true;
    queueMicrotask(() => {
      emit();
      resolveCritical();
    });
    return { library, critical: criticalPromise };
  }

  const order = loadOrder(total, criticalList);
  let cursor = 0;
  const workers = Math.min(chooseFetchConcurrency(), total);

  const worker = async () => {
    while (!disposed && !signal?.aborted) {
      const slot = cursor;
      cursor += 1;
      if (slot >= order.length) return;
      const index = order[slot];
      try {
        const response = await fetch(urls[index], { signal, cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blobs[index] = await response.blob();
      } catch (error) {
        if (disposed || signal?.aborted) return;
        failed.add(index);
        if (critical.has(index)) noteCritical(index);
      }
      fetched += 1;
      emit();
      if (blobs[index] && shouldDecodeImmediately(index)) enqueueDecode(index, critical.has(index));
    }
  };

  for (let i = 0; i < workers; i += 1) {
    void worker();
  }

  const onAbort = () => {
    library.dispose();
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  return { library, critical: criticalPromise };
}
