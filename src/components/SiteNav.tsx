"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/content/residence";

export function SiteNav() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("tour");
    if (!hero) return;

    const apply = (overHero: boolean) => {
      setSolid(!overHero);
      const meta = document.querySelector('meta[name="theme-color"]');
      meta?.setAttribute("content", overHero ? "#120f0c" : "#f7f3ec");
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        apply(Boolean(entry?.isIntersecting && entry.intersectionRatio > 0.08));
      },
      { threshold: [0, 0.08, 0.2] },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <header className={`nav ${solid ? "is-solid" : "is-hero"}`}>
      <a className="skip" href="#residence">
        Skip to residence details
      </a>
      <a className="brand" href="#tour" aria-label={`${BRAND.owner}, owner of ${BRAND.property}`}>
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-text">
          <span className="brand-kicker">{BRAND.ownerTitle}</span>
          <span className="brand-name">{BRAND.ownerFamily}</span>
        </span>
      </a>
      <nav className="nav-links" aria-label="Primary">
        <a href="#tour">Tour</a>
        <a href="#spaces">Spaces</a>
        <a href="#visit">Visit</a>
      </nav>
    </header>
  );
}
