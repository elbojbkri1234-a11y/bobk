/**
 * Client-safe frame metadata. No filesystem access — the server detector
 * and the browser both import this module.
 */

const HARD_GAP = 3;

export type FrameAsset = {
  src: string;
  filename: string;
  /** 0-based index after numerical sort. This is the playback index. */
  index: number;
  /** First integer in the filename, used for still selection and cut detection. */
  number: number;
  /** True when this still does not continue from the previous file. */
  hardCut: boolean;
};

export function frameNumberFromName(filename: string): number | null {
  const match = filename.match(/(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function sortFrameNames(names: readonly string[]): string[] {
  return [...names].sort((a, b) => {
    const na = frameNumberFromName(a);
    const nb = frameNumberFromName(b);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na === null && nb !== null) return 1;
    if (na !== null && nb === null) return -1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });
}

export function toFrameAssets(filenames: readonly string[], srcFor: (filename: string) => string): FrameAsset[] {
  let previousNumber: number | null = null;
  return filenames.map((filename, index) => {
    const number = frameNumberFromName(filename) ?? index + 1;
    const hardCut = previousNumber !== null && number - previousNumber > HARD_GAP;
    previousNumber = number;
    return {
      src: srcFor(filename),
      filename,
      index,
      number,
      hardCut,
    };
  });
}

/** Prefer an exact filename number, then the nearest number, then a ratio. */
export function pickFrame(
  frames: readonly FrameAsset[],
  number: number,
  fallbackRatio = 0,
): FrameAsset | null {
  if (frames.length === 0) return null;
  const exact = frames.find((frame) => frame.number === number);
  if (exact) return exact;

  let best = frames[0];
  let bestDistance = Infinity;
  for (const frame of frames) {
    const distance = Math.abs(frame.number - number);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
  }
  if (bestDistance <= 40) return best;

  const index = Math.round(fallbackRatio * (frames.length - 1));
  return frames[index] ?? frames[0];
}
