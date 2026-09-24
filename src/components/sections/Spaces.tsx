"use client";

import { useMemo, useState } from "react";
import { SPACES, type Space } from "@/content/residence";
import { pickFrame, type FrameAsset } from "@/lib/frames";

type SpacesProps = {
  frames: FrameAsset[];
};

type ResolvedSpace = Space & { src: string | null; alt: string };

export function Spaces({ frames }: SpacesProps) {
  const spaces = useMemo<ResolvedSpace[]>(() => {
    return SPACES.map((space) => {
      const frame = pickFrame(frames, space.frameNumber, 0);
      return {
        ...space,
        src: frame?.src ?? null,
        alt: `${space.name} at Maison Noor, the appartement of Sir Lahoucine Elboubkri. ${space.summary}`,
      };
    });
  }, [frames]);

  const [activeId, setActiveId] = useState(spaces[0]?.id ?? "");
  const active = spaces.find((space) => space.id === activeId) ?? spaces[0];

  if (!active) return null;

  return (
    <section id="spaces" className="spaces">
      <div className="wrap spaces-head">
        <p className="eyebrow">The plan</p>
        <h2>Six rooms, in the order you walk them.</h2>
      </div>
      <div className="wrap spaces-layout">
        <ol className="space-list">
          {spaces.map((space) => {
            const selected = space.id === active.id;
            return (
              <li key={space.id}>
                <button
                  type="button"
                  className={`space-btn ${selected ? "is-active" : ""}`}
                  aria-pressed={selected}
                  onMouseEnter={() => setActiveId(space.id)}
                  onFocus={() => setActiveId(space.id)}
                  onClick={() => setActiveId(space.id)}
                >
                  <span className="space-index">{space.index}</span>
                  <span className="space-copy">
                    <span className="space-name">{space.name}</span>
                    <span className="space-title">{space.title}</span>
                    <span className="space-desc">{space.body}</span>
                  </span>
                </button>
                {space.src ? (
                  <img
                    className="space-inline"
                    src={space.src}
                    alt={space.alt}
                    width={1280}
                    height={720}
                    loading="lazy"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <figure className="spaces-preview">
          {active.src ? (
            <img
              key={active.src}
              src={active.src}
              alt=""
              width={1280}
              height={720}
            />
          ) : (
            <div className="preview-empty">Still unavailable</div>
          )}
          <figcaption>
            <span>{active.index}</span>
            {active.name}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
