import { normalizeDomain } from "../utils";

const UA = "albdata-leadfinder/1.0 (self-hosted)";

// Common business keywords → OSM tag filters.
const CATEGORY_TAGS: Record<string, string[]> = {
  dentist: ['["amenity"="dentist"]', '["healthcare"="dentist"]'],
  doctor: ['["amenity"="doctors"]', '["healthcare"="doctor"]'],
  clinic: ['["amenity"="clinic"]', '["healthcare"="clinic"]'],
  pharmacy: ['["amenity"="pharmacy"]'],
  vet: ['["amenity"="veterinary"]'],
  veterinary: ['["amenity"="veterinary"]'],
  restaurant: ['["amenity"="restaurant"]'],
  cafe: ['["amenity"="cafe"]'],
  coffee: ['["amenity"="cafe"]'],
  bar: ['["amenity"="bar"]', '["amenity"="pub"]'],
  hotel: ['["tourism"="hotel"]', '["tourism"="guest_house"]'],
  gym: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]'],
  fitness: ['["leisure"="fitness_centre"]'],
  yoga: ['["sport"="yoga"]', '["leisure"="fitness_centre"]["name"~"yoga",i]'],
  salon: ['["shop"="hairdresser"]', '["shop"="beauty"]'],
  hairdresser: ['["shop"="hairdresser"]'],
  barber: ['["shop"="hairdresser"]["hairdresser"="barber"]', '["shop"="hairdresser"]["name"~"barber",i]'],
  beauty: ['["shop"="beauty"]', '["shop"="cosmetics"]'],
  spa: ['["leisure"="spa"]', '["shop"="beauty"]["beauty"="spa"]'],
  lawyer: ['["office"="lawyer"]'],
  attorney: ['["office"="lawyer"]'],
  "law firm": ['["office"="lawyer"]'],
  accountant: ['["office"="accountant"]', '["office"="tax_advisor"]'],
  accounting: ['["office"="accountant"]'],
  "real estate": ['["office"="estate_agent"]', '["shop"="estate_agent"]'],
  realtor: ['["office"="estate_agent"]'],
  insurance: ['["office"="insurance"]'],
  "marketing agency": ['["office"="advertising_agency"]', '["office"="marketing"]'],
  agency: ['["office"="advertising_agency"]', '["office"="company"]["name"~"agency",i]'],
  architect: ['["office"="architect"]'],
  plumber: ['["craft"="plumber"]'],
  electrician: ['["craft"="electrician"]'],
  roofer: ['["craft"="roofer"]'],
  carpenter: ['["craft"="carpenter"]'],
  hvac: ['["craft"="hvac"]', '["craft"="heating_engineer"]'],
  painter: ['["craft"="painter"]'],
  photographer: ['["craft"="photographer"]', '["shop"="photo"]'],
  "car dealer": ['["shop"="car"]'],
  "auto repair": ['["shop"="car_repair"]'],
  mechanic: ['["shop"="car_repair"]'],
  florist: ['["shop"="florist"]'],
  bakery: ['["shop"="bakery"]'],
  jewelry: ['["shop"="jewelry"]'],
  furniture: ['["shop"="furniture"]'],
  clothing: ['["shop"="clothes"]'],
  boutique: ['["shop"="boutique"]', '["shop"="clothes"]'],
  optician: ['["shop"="optician"]', '["healthcare"="optometrist"]'],
  physiotherapy: ['["healthcare"="physiotherapist"]'],
  chiropractor: ['["healthcare"="chiropractor"]', '["healthcare:speciality"="chiropractic"]'],
  school: ['["amenity"="school"]'],
  "driving school": ['["amenity"="driving_school"]'],
  kindergarten: ['["amenity"="kindergarten"]'],
  "travel agency": ['["shop"="travel_agency"]'],
  "it services": ['["office"="it"]', '["office"="company"]["name"~"tech|software|IT",i]'],
  software: ['["office"="it"]', '["office"="software"]'],
  coworking: ['["amenity"="coworking_space"]', '["office"="coworking"]'],
};

function filtersFor(keyword: string) {
  const k = keyword.toLowerCase().trim().replace(/s$/, "");
  const direct = CATEGORY_TAGS[k] || CATEGORY_TAGS[keyword.toLowerCase().trim()];
  if (direct) return direct;
  const safe = k.replace(/[^a-z0-9 ]/gi, "");
  return [
    `[~"^(amenity|shop|craft|office|healthcare|leisure|tourism)$"~"${safe.replace(/ /g, "_")}",i]`,
    `["name"~"${safe}",i][~"^(amenity|shop|craft|office|healthcare|leisure|tourism)$"~"."]`,
  ];
}

export async function geocode(location: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(location)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { boundingbox: string[]; display_name: string; lat: string; lon: string }[];
  if (!data.length) throw new Error(`Location "${location}" not found`);
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return { south, west, north, east, name: data[0].display_name };
}

export type BusinessHit = {
  name: string;
  category?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string;
  domain?: string | null;
  email?: string;
  rating?: number;
  reviews?: number;
  lat?: number;
  lng?: number;
};

export async function searchOsm(keyword: string, location: string, limit = 200): Promise<BusinessHit[]> {
  const bb = await geocode(location);
  // Cap huge areas (countries) to keep Overpass responsive
  const box = `(${bb.south},${bb.west},${bb.north},${bb.east})`;
  const parts = filtersFor(keyword).map((f) => `nwr${f}${box};`).join("\n");
  const query = `[out:json][timeout:60];(\n${parts}\n);out center tags ${limit};`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`OpenStreetMap search failed (${res.status}). Try a smaller area.`);
  const data = (await res.json()) as {
    elements: { tags?: Record<string, string>; lat?: number; lon?: number; center?: { lat: number; lon: number } }[];
  };
  const seen = new Set<string>();
  const out: BusinessHit[] = [];
  for (const el of data.elements) {
    const t = el.tags || {};
    if (!t.name) continue;
    const key = `${t.name}|${t["addr:street"] || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const website = t.website || t["contact:website"] || t.url;
    const address = [t["addr:housenumber"], t["addr:street"], t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ");
    out.push({
      name: t.name,
      category: t.amenity || t.shop || t.craft || t.office || t.healthcare || t.leisure || t.tourism,
      address: address || undefined,
      city: t["addr:city"],
      country: t["addr:country"],
      phone: t.phone || t["contact:phone"],
      website,
      domain: normalizeDomain(website),
      email: t.email || t["contact:email"],
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
    });
  }
  return out;
}
