// Sends a request to Nominatim API
// Returns the top5 most relevant search results
// Works in tandem with OpenStreetMap (OSM)

// Building parameters
export type NominatimResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export async function searchBuildings(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) {
    return [];
  }

  const url = new URL(NOMINATIM_URL);

  // Search query
  url.searchParams.set("q", query);

  // Request JSON results
  url.searchParams.set("format", "jsonv2");

  // Return up to 5 matches
  url.searchParams.set("limit", "5");

  // Include address information
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status}`);
  }

  const results: NominatimResult[] = await response.json();

  return results;
}
