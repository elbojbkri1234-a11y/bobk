/**
 * Copy and chapter map for Maison Noor.
 *
 * Chapter `frame` values are indices into the supplied 100-still tour
 * (salon → media wall → amber suite → hall → kitchen → lounge → primary).
 * They are scaled if the /clips folder ever contains a different count,
 * so the narration still walks the sequence in proportion.
 */

export const BRAND = {
  property: "Maison Noor",
  maison: "Maison",
  short: "Noor",
  name: "Maison Noor",
  category: "Appartement",
  owner: "Sir Lahoucine Elboubkri",
  ownerTitle: "Sir Lahoucine",
  ownerFamily: "Elboubkri",
} as const;

export const REFERENCE_FRAME_COUNT = 100;

export type Chapter = {
  id: string;
  /** Index in the original 100-still sequence where this chapter begins. */
  frame: number;
  index: string;
  name: string;
  title: string;
  body: string;
};

export const CHAPTERS: readonly Chapter[] = [
  {
    id: "salon",
    frame: 0,
    index: "01",
    name: "Salon",
    title: "Salon at dusk",
    body: "An L-shaped teal sofa, a timber table, and a looped light reflected in the night window.",
  },
  {
    id: "media",
    frame: 28,
    index: "02",
    name: "Media",
    title: "The media wall",
    body: "A floating oak console, a screen, and a stand of dark branches between you and the picture.",
  },
  {
    id: "suite",
    frame: 43,
    index: "03",
    name: "Suite",
    title: "The amber suite",
    body: "Two beds in saffron linen, oak wardrobes to the ceiling, a frosted door back to the hall.",
  },
  {
    id: "hall",
    frame: 58,
    index: "04",
    name: "Hall",
    title: "Along the hall",
    body: "Wardrobes, a painted ship, and the turn from evening rooms toward morning.",
  },
  {
    id: "kitchen",
    frame: 68,
    index: "05",
    name: "Kitchen",
    title: "Kitchen, morning",
    body: "White joinery, a gas range, stone counters, and daylight over the sink.",
  },
  {
    id: "lounge",
    frame: 86,
    index: "06",
    name: "Lounge",
    title: "The saffron lounge",
    body: "A channeled sofa, birds cut in metal, hats and baskets gathered on a fluted wall.",
  },
  {
    id: "primary",
    frame: 95,
    index: "07",
    name: "Primary",
    title: "The primary room",
    body: "Carved oak, navy linen, a sand quilt, and neighboring buildings at the window.",
  },
] as const;

export function chapterAt(nearestIndex: number, count: number): Chapter {
  const scale = count > 0 ? count / REFERENCE_FRAME_COUNT : 1;
  let current: Chapter = CHAPTERS[0];
  for (const chapter of CHAPTERS) {
    if (nearestIndex >= Math.round(chapter.frame * scale)) current = chapter;
  }
  return current;
}

/** Tour-progress (0–1 across the film, after the intro hold) where a chapter starts. */
export function chapterTourStart(chapter: Chapter, count: number): number {
  if (count <= 1) return 0;
  const scale = count / REFERENCE_FRAME_COUNT;
  const index = Math.min(count - 1, Math.round(chapter.frame * scale));
  return index / (count - 1);
}

export type Space = {
  id: string;
  index: string;
  name: string;
  title: string;
  /** Preferred filename number. Falls back to the nearest still. */
  frameNumber: number;
  summary: string;
  body: string;
};

export const SPACES: readonly Space[] = [
  {
    id: "salon",
    index: "01",
    name: "Salon",
    title: "Evening in teal",
    frameNumber: 8,
    summary: "Sectional, timber, night at the glass.",
    body: "The L-shaped sofa is teal, the table is oak, and the window has already gone dark. A metal dinosaur and a fringed straw hat share the long wall. A desk sits at the curtain.",
  },
  {
    id: "media",
    index: "02",
    name: "Media wall",
    title: "Picture and branches",
    frameNumber: 32,
    summary: "Screen, floating oak, a plant at the end.",
    body: "The television hangs between a shelf of bottles and a floating console. Dark branches stand in the foreground. Air conditioning above, a monstera where the sofa begins.",
  },
  {
    id: "suite",
    index: "03",
    name: "Amber suite",
    title: "Two beds, one calm",
    frameNumber: 50,
    summary: "Saffron linen, fitted oak, a safe.",
    body: "Twin beds dressed in saffron, charcoal throws folded at the foot. Wardrobes run to the ceiling. A frosted door centers the wall; a safe sits on the open shelf beside it.",
  },
  {
    id: "kitchen",
    index: "04",
    name: "Kitchen",
    title: "Daylight on stone",
    frameNumber: 78,
    summary: "Gas range, oven, window over the sink.",
    body: "White joinery, a gas cooktop, and an oven below. Stone counters, a mosaic splash, and a window of morning over the sink. A working kitchen, not a showroom.",
  },
  {
    id: "lounge",
    index: "05",
    name: "Lounge",
    title: "Collected, not decorated",
    frameNumber: 90,
    summary: "Saffron sofa, birds, a wall of hats.",
    body: "A channeled saffron sofa under four metal panels of birds on a branch. The opposite wall is fluted timber, hung with straw hats and a woven basket.",
  },
  {
    id: "primary",
    index: "06",
    name: "Primary bedroom",
    title: "Oak, navy, sand",
    frameNumber: 160,
    summary: "Carved headboard, linen, the buildings outside.",
    body: "A carved oak headboard, navy shams, shell-pattern pillows, and a sand quilt. Dark curtains. The neighboring buildings sit just outside the glass.",
  },
] as const;

export const MATERIALS = [
  "Teal upholstery",
  "Saffron linen",
  "Oak",
  "Straw",
  "Cut metal",
  "Stone",
] as const;

export type Amenity = {
  index: string;
  title: string;
  body: string;
};

export const AMENITIES: readonly Amenity[] = [
  {
    index: "01",
    title: "Furnished rooms",
    body: "Salon, lounge, and both bedrooms are dressed — sat in, not staged empty.",
  },
  {
    index: "02",
    title: "Fitted oak storage",
    body: "Wardrobes run floor to ceiling in the amber suite, with open shelving beside the door.",
  },
  {
    index: "03",
    title: "Working kitchen",
    body: "Gas range, oven, stone counters, and daylight over the sink.",
  },
  {
    index: "04",
    title: "Air conditioning",
    body: "A unit above the media wall for warm evenings in the salon.",
  },
  {
    index: "05",
    title: "In-suite safe",
    body: "Set on an open shelf between the wardrobes in the amber suite.",
  },
  {
    index: "06",
    title: "Blackout curtains",
    body: "Dark drapes in the salon and again in the primary bedroom.",
  },
  {
    index: "07",
    title: "A desk by the window",
    body: "A small work surface and chair beside the night glass in the salon.",
  },
  {
    index: "08",
    title: "Collected walls",
    body: "Metal panels, straw hats, and baskets, left where they hang.",
  },
] as const;
