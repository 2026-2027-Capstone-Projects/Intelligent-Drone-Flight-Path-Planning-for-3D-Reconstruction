import {
  FLIGHT_PATTERNS,
  type FlightPatternType,
  type Waypoint,
} from "../flightPath.ts";

type Props = {
  pattern: FlightPatternType;
  onPatternChange: (pattern: FlightPatternType) => void;
  turns: number;
  onTurnsChange: (turns: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speedMps: number;
  onSpeedChange: (speed: number) => void;
  progress: number;
  onProgressChange: (progress: number) => void;
  waypoints: Waypoint[];
};

export default function FlightPathPanel({
  pattern,
  onPatternChange,
  turns,
  onTurnsChange,
  isPlaying,
  onTogglePlay,
  speedMps,
  onSpeedChange,
  progress,
  onProgressChange,
  waypoints,
}: Props) {
  const activeMeta = FLIGHT_PATTERNS.find((p) => p.id === pattern);

  return (
    <div className="absolute bottom-10 right-4 z-10 w-80 rounded-lg bg-white/95 p-4 text-sm text-gray-900 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Drone Flight Mission</h2>
        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          {waypoints.length} waypoints
        </span>
      </div>

      <label htmlFor="flight-pattern" className="block text-xs font-medium text-gray-500">
        Flight Pattern
      </label>
      <select
        id="flight-pattern"
        value={pattern}
        onChange={(e) => onPatternChange(e.target.value as FlightPatternType)}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
      >
        {FLIGHT_PATTERNS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      {activeMeta && (
        <p className="mt-1 text-xs text-gray-600">{activeMeta.description}</p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <label htmlFor="pattern-turns" className="text-xs text-gray-600">
          Loops / Tiers: <strong>{turns}</strong>
        </label>
        <input
          id="pattern-turns"
          type="range"
          min={1}
          max={8}
          value={turns}
          onChange={(e) => onTurnsChange(Number(e.target.value))}
          className="w-36"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <label htmlFor="drone-speed" className="text-xs text-gray-600">
          Speed: <strong>{speedMps} m/s</strong>
        </label>
        <input
          id="drone-speed"
          type="range"
          min={2}
          max={25}
          value={speedMps}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="w-36"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={onTogglePlay}
          className="rounded bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
        >
          {isPlaying ? "Pause" : "Fly"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={progress}
          onChange={(e) => onProgressChange(Number(e.target.value))}
          className="w-full"
          aria-label="Mission progress"
        />
      </div>
    </div>
  );
}
