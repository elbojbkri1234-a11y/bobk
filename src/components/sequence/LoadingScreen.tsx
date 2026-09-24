"use client";

import { BRAND } from "@/content/residence";

type LoadingScreenProps = {
  visible: boolean;
  leaving: boolean;
  percent: number;
  poster: string | null;
  error: string | null;
  onRetry: () => void;
};

/**
 * Full-viewport gate. The percentage is the real fetch progress; scroll
 * stays locked until the critical stills have decoded, which is when this
 * overlay is allowed to leave.
 */
export function LoadingScreen({
  visible,
  leaving,
  percent,
  poster,
  error,
  onRetry,
}: LoadingScreenProps) {
  if (!visible) return null;

  const announced = Math.min(100, Math.round(percent / 10) * 10);

  return (
    <div
      className={`loader ${leaving ? "is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy={!error && percent < 100}
    >
      {poster ? (
        <img className="loader-bg" src={poster} alt="" width={1280} height={720} />
      ) : null}
      <div className="loader-veil" />
      <div className="loader-card">
        <p className="loader-brand">
          <span>{BRAND.ownerTitle}</span>
          {BRAND.ownerFamily}
        </p>
        <p className="loader-property">{BRAND.property}</p>
        {error ? (
          <>
            <p className="loader-label">{error}</p>
            <button type="button" className="btn btn-light" onClick={onRetry}>
              Try again
            </button>
          </>
        ) : (
          <>
            <p className="loader-label">Preparing the tour</p>
            <p className="loader-percent" aria-hidden="true">
              {percent}
              <span>%</span>
            </p>
            <div className="loader-track" aria-hidden="true">
              <span style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
            <p className="sr-only">Loading the tour, {announced} percent.</p>
          </>
        )}
      </div>
    </div>
  );
}
