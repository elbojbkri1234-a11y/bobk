import fs from "node:fs";
import path from "node:path";
import { sortFrameNames, toFrameAssets, type FrameAsset } from "@/lib/frames";

/**
 * Discovers the image sequence in /clips (public/clips on disk).
 *
 * Files are sorted numerically, not lexicographically, so frame 2 never
 * lands after frame 10. Gaps in the source numbering — this tour jumps
 * from 095 to 156 — are preserved as hard cuts: the player will not
 * crossfade across a missing run of frames.
 *
 * The total count is whatever is in the folder. Nothing is hardcoded.
 * This module is server-only. Client code should import types and
 * pickFrame from `@/lib/frames`.
 */

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export type { FrameAsset };

export function clipsDirectory(): string {
  return path.join(process.cwd(), "public", "clips");
}

export function detectFrames(dir: string = clipsDirectory()): FrameAsset[] {
  if (!fs.existsSync(dir)) return [];

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const images = entries.filter((name) => {
    if (name.startsWith(".")) return false;
    return IMAGE_EXT.has(path.extname(name).toLowerCase());
  });

  return toFrameAssets(sortFrameNames(images), (filename) => `/clips/${encodeURIComponent(filename)}`);
}
