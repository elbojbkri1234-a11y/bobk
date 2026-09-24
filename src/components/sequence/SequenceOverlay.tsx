"use client";

import type { RefObject } from "react";
import {
  BRAND,
  CHAPTERS,
  chapterTourStart,
  type Chapter,
} from "@/content/residence";
import { padFrame } from "@/lib/frameIndex";

type SequenceOverlayProps = {
  count: number;
  chapter: Chapter;
  intro: boolean;
  reduced: boolean;
  counterRef: RefObject<HTMLSpanElement | null>;
  fillRef: RefObject<HTMLElement | null>;
  onSeek: (tour: number) => void;
};

export function SequenceOverlay({
  count,
  chapter,
  intro,
  reduced,
  counterRef,
  fillRef,
  onSeek,
}: SequenceOverlayProps) {
  const showIntro = intro || reduced;

  return (
    <div className="hero-overlay">
      <div className="hero-bottom">
        <div className="copy-card">
          {showIntro ? (
            <div className="opening">
              <span className="rule" aria-hidden="true" />
              <p className="kicker">Appartement · Owner</p>
              <h1 className="display-title">
                <span>Maison</span>
                <span>Noor</span>
              </h1>
              <p className="owner-line">{BRAND.owner}</p>
              <p className="lede">
                Scroll or swipe to walk from the salon at dusk to the bedroom in the morning.
                The stills stay with your hand — nothing plays on its own.
              </p>
              {reduced ? (
                <p className="reduced-note">
                  Animation paused to respect your motion settings. This still is the salon.
                </p>
              ) : (
                <p className="scroll-hint">
                  <span className="hint-line" aria-hidden="true" />
                  <span className="hint-word hint-word-scroll">Scroll</span>
                  <span className="hint-word hint-word-swipe">Swipe up</span>
                  {" "}to begin
                  <span className="hint-count">{count} stills</span>
                </p>
              )}
            </div>
          ) : (
            <div className="chapter" key={chapter.id}>
              <h1 className="sr-only">Maison Noor, the appartement of {BRAND.owner}</h1>
              <span className="rule" aria-hidden="true" />
              <p className="kicker">
                {chapter.index}
                <span className="kicker-gap"> / </span>
                {chapter.name}
              </p>
              <h2 className="chapter-title">{chapter.title}</h2>
              <p className="chapter-body">{chapter.body}</p>
            </div>
          )}
        </div>

        {!reduced ? (
          <div className="counter-chip" aria-hidden="true">
            <span className="counter-kicker">Frame</span>
            <span className="counter-value" ref={counterRef}>
              {padFrame(1)}
            </span>
            <span className="counter-track">
              <i ref={fillRef} />
            </span>
            <span className="counter-total">{padFrame(count)}</span>
          </div>
        ) : null}
      </div>

      {!reduced ? (
        <nav className="rail" aria-label="Tour chapters">
          {CHAPTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === chapter.id && !intro ? "true" : undefined}
              onClick={() => onSeek(chapterTourStart(item, count))}
            >
              <span>{item.index}</span>
              {item.name}
            </button>
          ))}
        </nav>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {reduced
          ? "Motion reduced. Showing a still of the salon at Maison Noor, owned by Sir Lahoucine Elboubkri."
          : intro
            ? ""
            : `${chapter.name}. ${chapter.title}. ${chapter.body}`}
      </p>
    </div>
  );
}
