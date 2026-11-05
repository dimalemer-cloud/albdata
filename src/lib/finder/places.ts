import { normalizeDomain } from "../utils";
import type { BusinessHit } from "./osm";

type Place = {
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text: string };
  location?: { latitude: number; longitude: number };
  addressComponents?: { longText: string; types: string[] }[];
};

const FIELDS = [
  "places.displayName", "places.formattedAddress", "places.nationalPhoneNumber", "places.internationalPhoneNumber",
  "places.websiteUri", "places.rating", "places.userRatingCount", "places.primaryTypeDisplayName", "places.location",
  "places.addressComponents", "nextPageToken",
].join(",");

/** Google Places API (New) Text Search — up to 60 results (3 pages). */
export async function searchPlaces(keyword: string, location: string, apiKey: string, maxPages = 3): Promise<BusinessHit[]> {
  const out: BusinessHit[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: `${keyword} in ${location}`, pageSize: 20, pageToken }),
    });
    const data = (await res.json()) as { places?: Place[]; nextPageToken?: string; error?: { message: string } };
    if (!res.ok) throw new Error(`Google Places: ${data.error?.message || res.status}`);
    for (const p of data.places || []) {
      const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText;
      out.push({
        name: p.displayName?.text || "Unknown",
        category: p.primaryTypeDisplayName?.text,
        address: p.formattedAddress,
        city: comp("locality") || comp("postal_town"),
        country: comp("country"),
        phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
        website: p.websiteUri,
        domain: normalizeDomain(p.websiteUri),
        rating: p.rating,
        reviews: p.userRatingCount,
        lat: p.location?.latitude,
        lng: p.location?.longitude,
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}
