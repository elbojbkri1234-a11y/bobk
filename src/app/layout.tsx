import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";

const fraunces = localFont({
  variable: "--font-fraunces",
  display: "swap",
  src: [
    { path: "../fonts/fraunces-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/fraunces-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/fraunces-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/fraunces-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/fraunces-500-italic.woff2", weight: "500", style: "italic" },
  ],
});

const outfit = localFont({
  variable: "--font-outfit",
  display: "swap",
  src: [
    { path: "../fonts/outfit-300.woff2", weight: "300", style: "normal" },
    { path: "../fonts/outfit-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/outfit-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/outfit-600.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "Maison Noor — Sir Lahoucine Elboubkri",
    template: "%s · Maison Noor",
  },
  description:
    "The appartement of Sir Lahoucine Elboubkri, walked frame by frame. Scroll or swipe through the salon, amber suite, kitchen, and primary bedroom of Maison Noor.",
  applicationName: "Maison Noor",
  authors: [{ name: "Sir Lahoucine Elboubkri" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#120f0c",
};

const BOOT = `
try {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    document.documentElement.dataset.motion = "reduce";
  } else {
    document.documentElement.classList.add("is-locked");
  }
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body>
        <Script id="motion-lock" strategy="beforeInteractive">
          {BOOT}
        </Script>
        <noscript>
          <style>{`html.is-locked{overflow:auto!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
