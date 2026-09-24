import { BRAND } from "@/content/residence";

type SiteFooterProps = {
  count: number;
};

export function SiteFooter({ count }: SiteFooterProps) {
  const stills = count === 1 ? "1 still" : `${count} stills`;

  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <p className="footer-brand">
            <span>{BRAND.ownerTitle}</span>
            {BRAND.ownerFamily}
          </p>
          <p className="footer-note">Owner of {BRAND.property}, a private appartement walked frame by frame.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="#tour">Tour</a>
          <a href="#spaces">Spaces</a>
          <a href="#residence">Residence</a>
          <a href="#visit">Visit</a>
        </nav>
        <p className="footer-colophon">
          Pinned to the scroll. {stills}. No reel, no autoplay — the sequence moves only when you do.
        </p>
      </div>
      <div className="wrap footer-base">
        <span>© {new Date().getFullYear()} {BRAND.owner}</span>
        <span>Stills from the residence tour</span>
      </div>
    </footer>
  );
}
