
import { useState } from "react";
import {
  type NominatimResult,
  searchBuildings,
} from "../services/nominatim_API";

type BuildingSearchProps = {
  onSelectBuilding: (building: NominatimResult) => void;
};

export default function BuildingSearch({
  onSelectBuilding,
}: BuildingSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const data = await searchBuildings(query);
      setResults(data);
    } catch (err) {
      setError("Unable to search for buildings. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute top-4 left-4 z-50 w-80 rounded-lg bg-white p-4 shadow-lg">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        Building Search
      </h2>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter building name or address..."
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {!loading && results.length === 0 && !error && (
        <p className="mt-3 text-sm text-gray-500">
          Search for a building to see results.
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {results.map((result) => (
            <button
              type="button"
              key={`${result.osm_type}-${result.osm_id}`}
              onClick={() => onSelectBuilding(result)}
              className="block w-full rounded border border-gray-200 p-2 text-left hover:bg-gray-100"
            >
              <p className="text-sm font-medium text-gray-900">
                {result.name || result.display_name}
              </p>

              <p className="mt-1 text-xs text-gray-500">
                {result.display_name}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
