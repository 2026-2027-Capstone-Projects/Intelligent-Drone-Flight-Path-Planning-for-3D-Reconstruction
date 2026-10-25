export type SelectedBuilding = {
  elementId: number; // OSM element id
  name?: string;
  latitude: number; // degrees
  longitude: number; // degrees
  height?: number; // meters
};

type Props = {
  building: SelectedBuilding;
  onClose: () => void;
};

export default function BuildingInfoPanel({ building, onClose }: Props) {
  return (
    <div className="absolute top-4 left-4 z-10 w-64 rounded-lg bg-white/90 p-4 text-sm text-gray-900 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="font-semibold">{building.name ?? "Unnamed building"}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-900"
          aria-label="Clear selection"
        >
          ✕
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-gray-500">OSM id</dt>
        <dd>{building.elementId}</dd>
        <dt className="text-gray-500">Latitude</dt>
        <dd>{building.latitude.toFixed(6)}°</dd>
        <dt className="text-gray-500">Longitude</dt>
        <dd>{building.longitude.toFixed(6)}°</dd>
        {building.height !== undefined && (
          <>
            <dt className="text-gray-500">Height</dt>
            <dd>{building.height.toFixed(1)} m</dd>
          </>
        )}
      </dl>
    </div>
  );
}
