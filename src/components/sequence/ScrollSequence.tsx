"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FrameAsset } from "@/lib/frames";
import { CHAPTERS, chapterAt } from "@/content/residence";
import {
  introVisible,
  padFrame,
  pinDistance,
  SEQUENCE_TIMING,
  tourToScroll,
} from "@/lib/frameIndex";
import { loadFrameLibrary, shouldWindowDecode, type FrameLibrary } from "@/lib/frameLoader";
import { SequenceEngine } from "@/lib/sequenceEngine";
import { LoadingScreen } from "@/components/sequence/LoadingScreen";
import { SequenceOverlay } from "@/components/sequence/SequenceOverlay";

type Phase = "loading" | "ready" | "reduced" | "error";

type ScrollSequenceProps = {
  frames: FrameAsset[];
};

const LOADER_MIN_MS = 320;
const LOADER_FADE_MS = 680;
const RESIZE_DEBOUNCE_MS = 150;

export function ScrollSequence({ frames }: ScrollSequenceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const engineRef = useRef<SequenceEngine | null>(null);
  const libraryRef = useRef<FrameLibrary | null>(null);
  const triggerRef = useRef<{ start: number; end: number; scroll: (position: number) => void } | null>(
    null,
  );
  const chapterIdRef = useRef(CHAPTERS[0].id);
  const introRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("loading");
  const [percent, setPercent] = useState(0);
  const [chapterId, setChapterId] = useState(CHAPTERS[0].id);
  const [intro, setIntro] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [loaderLeaving, setLoaderLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const poster = frames[0]?.src ?? null;
  const count = frames.length;
  const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0];

  const syncDom = useCallback(
    (nearest: number, progress: number) => {
      if (counterRef.current) {
        const label = padFrame(nearest + 1);
        if (counterRef.current.textContent !== label) counterRef.current.textContent = label;
      }
      const scale = `scaleX(${progress})`;
      if (fillRef.current) fillRef.current.style.transform = scale;
      if (barRef.current) barRef.current.style.transform = scale;

      const nextIntro = introVisible(progress);
      if (nextIntro !== introRef.current) {
        introRef.current = nextIntro;
        setIntro(nextIntro);
      }
      const nextChapter = chapterAt(nearest, count);
      if (nextChapter.id !== chapterIdRef.current) {
        chapterIdRef.current = nextChapter.id;
        setChapterId(nextChapter.id);
      }
    },
    [count],
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);

    if (mq.matches) {
      setReduced(true);
      setPhase("reduced");
      setError(null);
      document.documentElement.classList.remove("is-locked");
      return () => mq.removeEventListener("change", onChange);
    }

    setReduced(false);

    if (count === 0) {
      setPhase("error");
      setError("No stills were found in /clips.");
      document.documentElement.classList.remove("is-locked");
      return () => mq.removeEventListener("change", onChange);
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => mq.removeEventListener("change", onChange);
    }

    document.documentElement.classList.add("is-locked");
    setPhase("loading");
    setError(null);
    setPercent(0);
    setLoaderVisible(true);
    setLoaderLeaving(false);

    const engine = new SequenceEngine(canvas);
    engineRef.current = engine;
    engine.setCount(count);
    engine.setHardCuts(frames.map((frame) => frame.hardCut));
    engine.setListener((sample, progress) => {
      syncDom(sample.nearest, progress);
    });
    engine.resize();
    engine.start();

    const controller = new AbortController();
    const startedAt = performance.now();
    let cancelled = false;
    let percentShown = 0;

    const { library, critical } = loadFrameLibrary(
      frames.map((frame) => frame.src),
      {
        signal: controller.signal,
        windowed: shouldWindowDecode(),
        onProgress: (progress) => {
          if (cancelled) return;
          const next = progress.criticalReady ? 100 : Math.round(progress.ratio * 100);
          if (next !== percentShown) {
            percentShown = next;
            setPercent(next);
          }
        },
        onDecoded: () => engine.requestDraw(),
      },
    );
    libraryRef.current = library;
    engine.setResolver((index) => library.get(index));
    engine.setPrefetch((index, direction) => library.touch(index, direction));
    library.touch(0, 1);

    critical
      .then(async () => {
        if (cancelled) return;
        const wait = Math.max(0, LOADER_MIN_MS - (performance.now() - startedAt));
        if (wait) await delay(wait);
        if (cancelled) return;
        if (!library.hasAny()) {
          setError("The tour stills could not be loaded.");
          setPhase("error");
          document.documentElement.classList.remove("is-locked");
          return;
        }
        setPercent(100);
        setPhase("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setError("The tour stills could not be loaded.");
        setPhase("error");
        document.documentElement.classList.remove("is-locked");
      });

    // Canvas backing-store updates are coalesced on a frame. The heavier
    // ScrollTrigger measurement is debounced below, once the pin exists.
    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        engine.resize();
      });
    };
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      mq.removeEventListener("change", onChange);
      controller.abort();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      engine.dispose();
      library.dispose();
      engineRef.current = null;
      libraryRef.current = null;
    };
  }, [attempt, count, frames, reduced, syncDom]);

  useEffect(() => {
    if (phase !== "ready" || reduced) return;
    const section = sectionRef.current;
    const engine = engineRef.current;
    if (!section || !engine) return;

    let killed = false;
    let revert: (() => void) | undefined;
    let debounceTimer = 0;

    (async () => {
      try {
        const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (killed) return;

        gsap.registerPlugin(ScrollTrigger);
        // URL-bar show/hide must not rebuild the pin. That jump is what
        // freezes or detaches the tour on phones.
        ScrollTrigger.config({ ignoreMobileResize: true });

        const coarse =
          window.matchMedia("(pointer: coarse)").matches || ScrollTrigger.isTouch === 1;
        if (coarse) {
          document.documentElement.dataset.pointer = "coarse";
          // Puts touch scrolling on the JS thread so position:fixed pin and
          // the canvas stay locked to the finger on iOS and Android.
          ScrollTrigger.normalizeScroll({ allowNestedScroll: true, lockAxis: true });
        }

        if ("scrollRestoration" in history) history.scrollRestoration = "manual";
        window.scrollTo(0, 0);
        lockHeroHeight();
        void section.offsetHeight;
        engine.resize();

        const mobileQuery = window.matchMedia("(max-width: 720px)");
        const distance = () =>
          pinDistance(count, window.innerHeight, mobileQuery.matches || coarse);

        const ctx = gsap.context(() => {
          const trigger = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            pinSpacing: true,
            // fixed, not transform: transform pins drop frames inside iOS overflow.
            pinType: "fixed",
            scrub: coarse ? SEQUENCE_TIMING.scrubTouch : SEQUENCE_TIMING.scrub,
            anticipatePin: coarse ? 0 : 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              engine.setProgress(self.progress);
            },
            onToggle: (self) => {
              if (self.isActive) engine.start();
              else engine.stop();
            },
          });

          triggerRef.current = {
            get start() {
              return trigger.start;
            },
            get end() {
              return trigger.end;
            },
            scroll: (position: number) => {
              trigger.scroll(position);
            },
          };

          engine.setProgress(trigger.progress);
        }, section);
        revert = () => ctx.revert();

        document.documentElement.classList.remove("is-locked");
        ScrollTrigger.refresh();

        let lastWidth = window.innerWidth;
        const onResize = () => {
          const width = window.innerWidth;
          const widthChanged = Math.abs(width - lastWidth) > 48;
          // Keyboard and the mobile URL bar change height only. Refreshing
          // the pin then makes the sequence jump or stop tracking the finger.
          if (coarse && !widthChanged) return;
          lastWidth = width;
          window.clearTimeout(debounceTimer);
          debounceTimer = window.setTimeout(() => {
            if (widthChanged) lockHeroHeight();
            engine.resize();
            ScrollTrigger.refresh();
          }, RESIZE_DEBOUNCE_MS);
        };
        window.addEventListener("resize", onResize, { passive: true });
        window.addEventListener("orientationchange", onResize);

        // Backup for browsers that deliver touch-scroll without a GSAP tick.
        const onFingerScroll = () => {
          const pin = triggerRef.current;
          if (!pin) return;
          const span = pin.end - pin.start;
          if (span <= 1) return;
          const progress = (window.scrollY - pin.start) / span;
          engine.setProgress(Math.min(1, Math.max(0, progress)));
        };
        if (coarse) window.addEventListener("scroll", onFingerScroll, { passive: true });

        const previousRevert = revert;
        revert = () => {
          window.removeEventListener("resize", onResize);
          window.removeEventListener("orientationchange", onResize);
          window.removeEventListener("scroll", onFingerScroll);
          window.clearTimeout(debounceTimer);
          if (coarse) ScrollTrigger.normalizeScroll(false);
          previousRevert();
        };
      } catch {
        if (killed) return;
        setError("Scroll synchronization could not start.");
        setPhase("error");
        document.documentElement.classList.remove("is-locked");
      }
    })();

    return () => {
      killed = true;
      triggerRef.current = null;
      revert?.();
    };
  }, [count, phase, reduced]);

  useEffect(() => {
    if (phase !== "ready" && phase !== "reduced") return;
    setLoaderLeaving(true);
    const timeout = window.setTimeout(
      () => setLoaderVisible(false),
      phase === "reduced" ? 0 : LOADER_FADE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [phase]);

  const seek = useCallback((tour: number) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    // Chapter marks are in film space. Convert before mapping onto the pin,
    // and step slightly inside the chapter so rounding doesn't land on the previous still.
    const progress = tourToScroll(Math.min(1, tour + 0.012));
    const y = trigger.start + (trigger.end - trigger.start) * progress;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  if (count === 0) {
    return (
      <section id="tour" className="hero is-empty" aria-label="Maison Noor, Sir Lahoucine Elboubkri">
        <div className="empty-state">
          <span className="rule" aria-hidden="true" />
          <p className="kicker">Sir Lahoucine Elboubkri</p>
          <h1 className="display-title">Maison Noor</h1>
          <p className="lede">No stills were found in /clips. Add a numbered image sequence and reload.</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="tour-progress" ref={barRef} aria-hidden="true" />
      <section
        id="tour"
        ref={sectionRef}
        className={`hero ${reduced ? "is-reduced" : ""} ${phase === "ready" ? "is-ready" : ""}`}
        aria-label="Scroll tour of Maison Noor, the appartement of Sir Lahoucine Elboubkri"
      >
        <img
          className="hero-fallback"
          src={poster ?? ""}
          alt={
            reduced
              ? "Salon of Maison Noor at dusk, the appartement of Sir Lahoucine Elboubkri. Opening still of the tour."
              : ""
          }
          width={1280}
          height={720}
          fetchPriority="high"
          aria-hidden={reduced ? undefined : true}
        />
        <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true" />
        <div className="hero-scrim" aria-hidden="true" />
        <SequenceOverlay
          count={count}
          chapter={chapter}
          intro={intro || phase !== "ready"}
          reduced={reduced}
          counterRef={counterRef}
          fillRef={fillRef}
          onSeek={seek}
        />
      </section>
      <LoadingScreen
        visible={loaderVisible && !reduced}
        leaving={loaderLeaving}
        percent={percent}
        poster={poster}
        error={phase === "error" ? error : null}
        onRetry={retry}
      />
    </>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Freeze the hero to the visible viewport so the address bar cannot resize the pin. */
function lockHeroHeight(): void {
  const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
  if (height > 200) {
    document.documentElement.style.setProperty("--hero-h", `${height}px`);
  }
}
