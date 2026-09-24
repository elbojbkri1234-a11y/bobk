import { BRAND, MATERIALS } from "@/content/residence";

type StatementProps = {
  count: number;
};

export function Statement({ count }: StatementProps) {
  const stills = count > 0 ? String(count) : "—";

  return (
    <section id="residence" className="statement">
      <div className="wrap statement-grid">
        <p className="eyebrow">The residence</p>
        <h2>
          Furnished, filmed, <em>and left as it is.</em>
        </h2>
        <div className="statement-copy">
          <p>
            The appartement of {BRAND.owner}. No staging render — the salon after dark,
            the kitchen in the morning, saffron linen, oak, and the objects left on the walls.
          </p>
          <dl className="facts">
            <div>
              <dt>Owner</dt>
              <dd>{BRAND.owner}</dd>
            </div>
            <div>
              <dt>Tour</dt>
              <dd>{stills} stills</dd>
            </div>
            <div>
              <dt>Light</dt>
              <dd>Dusk to morning</dd>
            </div>
            <div>
              <dt>Rooms</dt>
              <dd>Six spaces</dd>
            </div>
            <div>
              <dt>State</dt>
              <dd>Fully furnished</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="wrap">
        <ul className="materials" aria-label="Materials in the apartment">
          {MATERIALS.map((material) => (
            <li key={material}>{material}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
