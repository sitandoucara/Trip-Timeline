/**
 * THE SLUG CATALOGUE — source of truth for the whole Lens.
 *
 * This is the hardcoded fallback set AND the boot state: the Lens always starts
 * on this data, with zero network. The Pass 12 live fetch may later overwrite
 * ONLY the volatile fields (openHour / closeHour / hoursText / description) for
 * slugs that already exist here. It can never introduce a slug, a colour, or a
 * duration — those are owned here so every thumbnail, colour and 3D model always
 * matches.
 *
 * Adding a city = adding one entry to CITIES. No code changes anywhere else.
 */

/** Build a colour from a #RRGGBB string. Keeps the data table readable. */
export function hex(h: string, a: number = 1.0): vec4 {
  const s = h.charAt(0) === "#" ? h.substring(1) : h;
  const r = parseInt(s.substring(0, 2), 16) / 255;
  const g = parseInt(s.substring(2, 4), 16) / 255;
  const b = parseInt(s.substring(4, 6), 16) / 255;
  return new vec4(r, g, b, a);
}

/**
 * The six identity hues, reused in the same order by every city. One shared
 * system means a block reads the same way wherever you are, and no hue ever
 * strays near the coral reserved for rejections.
 */
const HUE_BLUE = "#4A9EFF";
const HUE_AMBER = "#F5B13D";
const HUE_VIOLET = "#A98BF5";
const HUE_ORANGE = "#F5854A";
const HUE_PINK = "#F06CA8";
const HUE_GREEN = "#5FD08A";

export interface Activity {
  /** Stable id. The live fetch keys on this and may never invent a new one. */
  slug: string;
  name: string;
  /** PINNED. Drives block length, so it must not vary between runs. */
  durationMin: number;
  /** Identity colour — follows this activity across card, block and recap. */
  color: vec4;
  /** Numeric bounds drive the CLOSED rule. Fractional hours: 9.5 === 09:30. */
  openHour: number;
  closeHour: number;
  /** Human-readable, for the detail panel. Never parsed. */
  hoursText: string;
  /** One line, shown in the detail panel. */
  description: string;
  /** Free text — "17€", "Free", "~25€". Never parsed. */
  priceText: string;
  /** Single word, shown as a chip in the identity colour. */
  category: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  /** Three letters, shown on a placed block so its origin reads at a glance. */
  shortCode: string;
  /** Accent for this city's card on the home screen. */
  color: vec4;
  activities: Activity[];
}

const PARIS: City = {
  id: "paris",
  shortCode: "PAR",
  name: "Paris",
  country: "France",
  color: hex(HUE_AMBER),
  activities: [
    {
      slug: "eiffel_tower",
      name: "Eiffel Tower",
      durationMin: 90,
      color: hex(HUE_BLUE),
      openHour: 9.5,
      closeHour: 23.75,
      hoursText: "09:30 – 23:45",
      description: "Iron lattice tower on the Champ de Mars with panoramic city views.",
      priceText: "18,80 €",
      category: "Landmark",
    },
    {
      slug: "louvre",
      name: "Louvre Museum",
      durationMin: 120,
      color: hex(HUE_AMBER),
      openHour: 9,
      closeHour: 18,
      hoursText: "09:00 – 18:00 · Closed Tue",
      description: "The world's largest art museum, home of the Mona Lisa.",
      priceText: "22 €",
      category: "Culture",
    },
    {
      slug: "seine_cruise",
      name: "Seine Cruise",
      durationMin: 75,
      color: hex(HUE_VIOLET),
      openHour: 10,
      closeHour: 22,
      hoursText: "10:00 – 22:00",
      description: "A slow boat past the city's monuments from the water.",
      priceText: "16 €",
      category: "Discovery",
    },
    {
      slug: "montmartre",
      name: "Montmartre",
      durationMin: 150,
      color: hex(HUE_ORANGE),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "Hilltop village of steep streets, studios and the Sacré-Cœur.",
      priceText: "Free",
      category: "Quarter",
    },
    {
      slug: "orsay",
      name: "Musée d'Orsay",
      durationMin: 105,
      color: hex(HUE_PINK),
      openHour: 9.5,
      closeHour: 18,
      hoursText: "09:30 – 18:00 · Closed Mon",
      description: "Impressionist masterpieces inside a former railway station.",
      priceText: "16 €",
      category: "Culture",
    },
    {
      slug: "lunch",
      name: "Lunch",
      durationMin: 60,
      color: hex(HUE_GREEN),
      openHour: 12,
      closeHour: 14.5,
      hoursText: "12:00 – 14:30",
      description: "A long French lunch, because the day should have a middle.",
      priceText: "~25 €",
      category: "Food",
    },
  ],
};

const LONDON: City = {
  id: "london",
  shortCode: "LDN",
  name: "London",
  country: "United Kingdom",
  color: hex(HUE_BLUE),
  activities: [
    {
      slug: "tower_bridge",
      name: "Tower Bridge",
      durationMin: 60,
      color: hex(HUE_BLUE),
      openHour: 9.5,
      closeHour: 18,
      hoursText: "09:30 – 18:00",
      description: "Walk the high-level glass floor between the two Victorian towers.",
      priceText: "£12.30",
      category: "Landmark",
    },
    {
      slug: "british_museum",
      name: "British Museum",
      durationMin: 150,
      color: hex(HUE_AMBER),
      openHour: 10,
      closeHour: 17,
      hoursText: "10:00 – 17:00",
      description: "Two million years of human history, and free to enter.",
      priceText: "Free",
      category: "Culture",
    },
    {
      slug: "borough_market",
      name: "Borough Market",
      durationMin: 75,
      color: hex(HUE_VIOLET),
      openHour: 10,
      closeHour: 17,
      hoursText: "10:00 – 17:00 · Closed Sun",
      description: "London's oldest food market, under the railway arches.",
      priceText: "~£15",
      category: "Food",
    },
    {
      slug: "westminster",
      name: "Westminster Abbey",
      durationMin: 90,
      color: hex(HUE_ORANGE),
      openHour: 9.5,
      closeHour: 15.5,
      hoursText: "09:30 – 15:30 · Closed Sun",
      description: "A thousand years of coronations, weddings and poets' corner.",
      priceText: "£29",
      category: "Culture",
    },
    {
      slug: "hyde_park",
      name: "Hyde Park",
      durationMin: 90,
      color: hex(HUE_PINK),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "Boating on the Serpentine and a soapbox at Speakers' Corner.",
      priceText: "Free",
      category: "Quarter",
    },
    {
      slug: "pub_lunch",
      name: "Pub Lunch",
      durationMin: 60,
      color: hex(HUE_GREEN),
      openHour: 12,
      closeHour: 15,
      hoursText: "12:00 – 15:00",
      description: "A pie, a pint and a low ceiling somewhere very old.",
      priceText: "~£20",
      category: "Food",
    },
  ],
};

const LOS_ANGELES: City = {
  id: "los_angeles",
  shortCode: "LAX",
  name: "Los Angeles",
  country: "United States",
  color: hex(HUE_VIOLET),
  activities: [
    {
      slug: "griffith",
      name: "Griffith Observatory",
      durationMin: 105,
      color: hex(HUE_BLUE),
      openHour: 12,
      closeHour: 22,
      hoursText: "12:00 – 22:00 · Closed Mon",
      description: "Telescopes, planetarium shows and the whole basin below you.",
      priceText: "Free",
      category: "Discovery",
    },
    {
      slug: "getty",
      name: "Getty Center",
      durationMin: 150,
      color: hex(HUE_AMBER),
      openHour: 10,
      closeHour: 17.5,
      hoursText: "10:00 – 17:30 · Closed Mon",
      description: "Travertine pavilions, European painting and a garden on a hill.",
      priceText: "Free",
      category: "Culture",
    },
    {
      slug: "santa_monica",
      name: "Santa Monica Pier",
      durationMin: 90,
      color: hex(HUE_VIOLET),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "The Ferris wheel at the very end of Route 66.",
      priceText: "Free",
      category: "Landmark",
    },
    {
      slug: "walk_of_fame",
      name: "Walk of Fame",
      durationMin: 60,
      color: hex(HUE_ORANGE),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "Fifteen blocks of brass stars along Hollywood Boulevard.",
      priceText: "Free",
      category: "Landmark",
    },
    {
      slug: "venice_beach",
      name: "Venice Beach",
      durationMin: 90,
      color: hex(HUE_PINK),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "Skate park, muscle beach and the boardwalk at golden hour.",
      priceText: "Free",
      category: "Quarter",
    },
    {
      slug: "taco_lunch",
      name: "Taco Lunch",
      durationMin: 60,
      color: hex(HUE_GREEN),
      openHour: 11,
      closeHour: 15,
      hoursText: "11:00 – 15:00",
      description: "Al pastor from a truck, eaten standing up.",
      priceText: "~$15",
      category: "Food",
    },
  ],
};

const TOKYO: City = {
  id: "tokyo",
  shortCode: "TYO",
  name: "Tokyo",
  country: "Japan",
  color: hex(HUE_PINK),
  activities: [
    {
      slug: "teamlab",
      name: "teamLab Planets",
      durationMin: 120,
      color: hex(HUE_BLUE),
      openHour: 9,
      closeHour: 21,
      hoursText: "09:00 – 21:00",
      description: "Barefoot through knee-deep water and rooms made of light.",
      priceText: "¥3,800",
      category: "Discovery",
    },
    {
      slug: "senso_ji",
      name: "Sensō-ji Temple",
      durationMin: 75,
      color: hex(HUE_AMBER),
      openHour: 8,
      closeHour: 17,
      hoursText: "06:00 – 17:00",
      description: "Tokyo's oldest temple, reached through the Kaminarimon gate.",
      priceText: "Free",
      category: "Culture",
    },
    {
      slug: "shibuya",
      name: "Shibuya Crossing",
      durationMin: 45,
      color: hex(HUE_VIOLET),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "The world's busiest crossing, best watched from above.",
      priceText: "Free",
      category: "Landmark",
    },
    {
      slug: "meiji",
      name: "Meiji Shrine",
      durationMin: 90,
      color: hex(HUE_ORANGE),
      openHour: 8,
      closeHour: 17,
      hoursText: "Sunrise – sunset",
      description: "A forest of 100,000 trees in the middle of the city.",
      priceText: "Free",
      category: "Culture",
    },
    {
      slug: "tsukiji",
      name: "Tsukiji Outer Market",
      durationMin: 75,
      color: hex(HUE_PINK),
      openHour: 8,
      closeHour: 14,
      hoursText: "08:00 – 14:00",
      description: "Knife shops, tamagoyaki and very early seafood.",
      priceText: "~¥2,000",
      category: "Food",
    },
    {
      slug: "ramen_lunch",
      name: "Ramen Lunch",
      durationMin: 60,
      color: hex(HUE_GREEN),
      openHour: 11,
      closeHour: 15,
      hoursText: "11:00 – 15:00",
      description: "Queue, buy a ticket from the machine, sit, slurp, leave.",
      priceText: "~¥1,500",
      category: "Food",
    },
  ],
};

/**
 * PASS 19 — the fifth city, and the one that makes the carousel symmetric.
 *
 * Four cities gave the arc slots {-1, 0, +1, +2}: with an even count something
 * has to be lopsided. Five gives {-2, -1, 0, +1, +2}, two either side of the
 * centre, which is what the arc was drawn for.
 *
 * Hours below are the real ones. Two are worth stating because they are the kind
 * of thing that quietly goes wrong: the Koutoubia's interior is closed to
 * non-Muslims, so the visit priced here is the minaret and its gardens, not the
 * prayer hall; and Jemaa el-Fnaa is a public square with no opening time at all,
 * so it takes the same 08:00-22:00 bounds every "Open all day" entry in this
 * catalogue takes, which is what the two rejection rules need to work on it.
 */
const MARRAKECH: City = {
  id: "marrakech",
  shortCode: "RAK",
  name: "Marrakech",
  country: "Morocco",
  color: hex(HUE_ORANGE),
  activities: [
    {
      slug: "jemaa_el_fnaa",
      name: "Jemaa el-Fnaa",
      durationMin: 90,
      color: hex(HUE_BLUE),
      openHour: 8,
      closeHour: 22,
      hoursText: "Open all day",
      description: "The medina's great square, at its best once the sun goes down.",
      priceText: "Free",
      category: "Landmark",
    },
    {
      slug: "koutoubia",
      name: "Koutoubia Mosque",
      durationMin: 45,
      color: hex(HUE_AMBER),
      openHour: 8,
      closeHour: 20,
      hoursText: "08:00 – 20:00",
      description: "The 12th-century minaret every street in the medina points to.",
      priceText: "Free",
      category: "Culture",
    },
    {
      slug: "majorelle",
      name: "Jardin Majorelle",
      durationMin: 75,
      color: hex(HUE_VIOLET),
      openHour: 8,
      closeHour: 18,
      hoursText: "08:00 – 18:00",
      description: "Cobalt walls, cactus and bamboo in Yves Saint Laurent's garden.",
      priceText: "170 MAD",
      category: "Discovery",
    },
    {
      slug: "bahia_palace",
      name: "Bahia Palace",
      durationMin: 60,
      color: hex(HUE_ORANGE),
      openHour: 9,
      closeHour: 17,
      hoursText: "09:00 – 17:00",
      description: "Painted cedar ceilings and courtyards built for a grand vizier.",
      priceText: "100 MAD",
      category: "Culture",
    },
    {
      slug: "souks",
      name: "Medina Souks",
      durationMin: 120,
      color: hex(HUE_PINK),
      openHour: 9,
      closeHour: 20,
      hoursText: "09:00 – 20:00",
      description: "Lanterns, leather and spice, down alleys that all look alike.",
      priceText: "Free",
      category: "Quarter",
    },
    {
      slug: "tagine_lunch",
      name: "Tagine Lunch",
      durationMin: 60,
      color: hex(HUE_GREEN),
      openHour: 12,
      closeHour: 15,
      hoursText: "12:00 – 15:00",
      description: "Slow-cooked lamb under a clay lid, on a roof above the square.",
      priceText: "~120 MAD",
      category: "Food",
    },
  ],
};

/**
 * Order here is the order shown on the home screen. Marrakech sits after Tokyo
 * so Paris stays index 0 and stays centred on launch.
 */
export const CITIES: City[] = [PARIS, LONDON, LOS_ANGELES, TOKYO, MARRAKECH];

/** Find an activity anywhere in the catalogue. The agenda spans all cities. */
export function findActivity(cityId: string, slug: string): Activity {
  const city = getCity(cityId);
  if (!city) return null;
  for (let i = 0; i < city.activities.length; i++) {
    if (city.activities[i].slug === slug) return city.activities[i];
  }
  return null;
}

export function getCity(id: string): City {
  for (let i = 0; i < CITIES.length; i++) {
    if (CITIES[i].id === id) return CITIES[i];
  }
  return null;
}

/** Format fractional hours as HH:MM. 9.5 -> "09:30". */
export function formatHour(h: number): string {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
}

/** Format a duration in minutes as 2h00 / 1h15 / 45min. */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return m + "min";
  return h + "h" + (m < 10 ? "0" : "") + m;
}
