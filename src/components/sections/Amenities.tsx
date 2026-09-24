import { AMENITIES } from "@/content/residence";

export function Amenities() {
  return (
    <section id="amenities" className="amenities" aria-labelledby="amenities-title">
      <div className="wrap amenities-head">
        <p className="eyebrow">In the rooms</p>
        <h2 id="amenities-title">What the tour actually shows.</h2>
        <p className="amenities-lede">
          No invented square metres, no invented view. These are the things you can see
          as the frames move.
        </p>
      </div>
      <ul className="wrap amenity-grid">
        {AMENITIES.map((amenity) => (
          <li key={amenity.index}>
            <span className="amenity-index">{amenity.index}</span>
            <h3>{amenity.title}</h3>
            <p>{amenity.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
