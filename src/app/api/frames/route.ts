import { NextResponse } from "next/server";
import { detectFrames } from "@/lib/detectFrames";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Manifest of every image in /clips, numerically sorted.
 * The page reads the folder on the server; this route exposes the same
 * detection for clients and for verification.
 */
export function GET() {
  const frames = detectFrames();
  return NextResponse.json(
    {
      count: frames.length,
      poster: frames[0]?.src ?? null,
      frames,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
