/**
 * Shipped thumbnails, resolved by slug.
 *
 * These are project assets, never fetched at runtime — an LLM cannot be trusted
 * to return a working image URL, and a broken thumbnail is the most visible way
 * a demo can fail. Generated once, reviewed by eye, shipped.
 *
 * All five cities now have a photograph per activity, reviewed by eye before
 * shipping. The city image remains the fallback for any slug without one.
 */
const CITY_IMAGES: { [id: string]: Texture } = {
  paris: requireAsset("../Generated Textures/cityparis.png") as Texture,
  london: requireAsset("../Generated Textures/citylondon.png") as Texture,
  los_angeles: requireAsset("../Generated Textures/citylosangelesv2.png") as Texture,
  tokyo: requireAsset("../Generated Textures/citytokyo.png") as Texture,
  marrakech: requireAsset("../Generated Textures/citymarrakech.png") as Texture,
};

const PARIS_IMAGES: { [slug: string]: Texture } = {
  eiffel_tower: requireAsset("../Generated Textures/pariseiffeltower.png") as Texture,
  louvre: requireAsset("../Generated Textures/parislouvre.png") as Texture,
  seine_cruise: requireAsset("../Generated Textures/parisseinecruise.png") as Texture,
  montmartre: requireAsset("../Generated Textures/parismontmartrev2.png") as Texture,
  orsay: requireAsset("../Generated Textures/parisorsay.png") as Texture,
  lunch: requireAsset("../Generated Textures/parislunch.png") as Texture,
};

const LONDON_IMAGES: { [slug: string]: Texture } = {
  tower_bridge: requireAsset("../Generated Textures/londontowerbridge.png") as Texture,
  british_museum: requireAsset("../Generated Textures/londonbritishmuseum.png") as Texture,
  borough_market: requireAsset("../Generated Textures/londonboroughmarket.png") as Texture,
  westminster: requireAsset("../Generated Textures/londonwestminster.png") as Texture,
  hyde_park: requireAsset("../Generated Textures/londonhydepark.png") as Texture,
  pub_lunch: requireAsset("../Generated Textures/londonpublunch.png") as Texture,
};

const LA_IMAGES: { [slug: string]: Texture } = {
  griffith: requireAsset("../Generated Textures/lagriffith.png") as Texture,
  getty: requireAsset("../Generated Textures/lagettyv2.png") as Texture,
  santa_monica: requireAsset("../Generated Textures/lasantamonica.png") as Texture,
  walk_of_fame: requireAsset("../Generated Textures/lawalkoffame.png") as Texture,
  venice_beach: requireAsset("../Generated Textures/lavenicebeach.png") as Texture,
  taco_lunch: requireAsset("../Generated Textures/latacolunch.png") as Texture,
};

const TOKYO_IMAGES: { [slug: string]: Texture } = {
  teamlab: requireAsset("../Generated Textures/tokyoteamlab.png") as Texture,
  senso_ji: requireAsset("../Generated Textures/tokyosensoji.png") as Texture,
  shibuya: requireAsset("../Generated Textures/tokyoshibuya.png") as Texture,
  meiji: requireAsset("../Generated Textures/tokyomeijiv2.png") as Texture,
  tsukiji: requireAsset("../Generated Textures/tokyotsukiji.png") as Texture,
  ramen_lunch: requireAsset("../Generated Textures/tokyoramenlunch.png") as Texture,
};

const MARRAKECH_IMAGES: { [slug: string]: Texture } = {
  jemaa_el_fnaa: requireAsset("../Generated Textures/rakjemaa.png") as Texture,
  koutoubia: requireAsset("../Generated Textures/rakkoutoubia.png") as Texture,
  majorelle: requireAsset("../Generated Textures/rakmajorelle.png") as Texture,
  bahia_palace: requireAsset("../Generated Textures/rakbahia.png") as Texture,
  souks: requireAsset("../Generated Textures/raksouks.png") as Texture,
  tagine_lunch: requireAsset("../Generated Textures/raktagine.png") as Texture,
};

const BY_CITY: { [cityId: string]: { [slug: string]: Texture } } = {
  paris: PARIS_IMAGES,
  london: LONDON_IMAGES,
  los_angeles: LA_IMAGES,
  tokyo: TOKYO_IMAGES,
  marrakech: MARRAKECH_IMAGES,
};

export function cityThumb(cityId: string): Texture {
  return CITY_IMAGES[cityId] ?? null;
}

/** Every city now has a photograph per activity; the city shot is the fallback. */
export function activityThumb(cityId: string, slug: string): Texture {
  const set = BY_CITY[cityId];
  if (set) {
    const tex = set[slug];
    if (tex) return tex;
  }
  return cityThumb(cityId);
}
