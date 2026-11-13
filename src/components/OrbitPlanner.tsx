import { Cartographic } from "cesium";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useCesium } from "resium";
import {
  type BoundingBox,
  FALLBACK_BUILDING_HEIGHT_M,
  MAX_ALTITUDE_AGL_M,
} from "../boundingBox.ts";
import {
  DEFAULT_ORBIT_PARAMETERS,
  generateOrbit,
  MAX_ORBIT_RADIUS_M,
  MAX_WAYPOINT_COUNT,
  MIN_ORBIT_ALTITUDE_M,
  MIN_ORBIT_RADIUS_M,
  MIN_WAYPOINT_COUNT,
  type OrbitParameters,
  type OrbitPath,
} from "../orbit.ts";
import { OrbitDisplay } from "../orbitDisplay.ts";
import type { SelectedBuilding } from "./BuildingInfoPanel.tsx";

const inputs = [
  { key: "radius", label: "Orbit radius (m)", min: MIN_ORBIT_RADIUS_M, max: MAX_ORBIT_RADIUS_M },
  {
    key: "altitude",
    label: "Orbit altitude (m AGL)",
    min: MIN_ORBIT_ALTITUDE_M,
    max: MAX_ALTITUDE_AGL_M,
  },
  {
    key: "waypointCount",
    label: "Waypoint count",
    min: MIN_WAYPOINT_COUNT,
    max: MAX_WAYPOINT_COUNT,
  },
] as const;

export default function OrbitPlanner({
  building,
  box,
}: {
  building: SelectedBuilding | null;
  box: BoundingBox | null;
}) {
  const { viewer } = useCesium();
  const display = useRef<OrbitDisplay | null>(null);
  const cancelRender = useRef<(() => void) | null>(null);
  const [draft, setDraft] = useState(() => ({
    radius: String(DEFAULT_ORBIT_PARAMETERS.radius),
    altitude: String(DEFAULT_ORBIT_PARAMETERS.altitude),
    waypointCount: String(DEFAULT_ORBIT_PARAMETERS.waypointCount),
  }));
  const [path, setPath] = useState<OrbitPath | null>(null);
  const [status, setStatus] = useState("Select a target building, then generate an orbit.");

  useEffect(() => {
    if (!viewer) return;
    const overlay = new OrbitDisplay(viewer.scene);
    display.current = overlay;
    return () => {
      cancelRender.current?.();
      overlay.destroy();
      display.current = null;
    };
  }, [viewer]);

  // A path is valid only for the target and box it was generated against.
  useEffect(() => {
    cancelRender.current?.();
    display.current?.clear();
    setPath(null);
    setStatus(
      building
        ? box
          ? "Target or box changed. Generate an orbit for the current bounds."
          : "A valid operating bounding box is required."
        : "Select a target building before generating an orbit.",
    );
  }, [building, box]);

  const generate = (event: FormEvent) => {
    event.preventDefault();
    const started = performance.now();
    cancelRender.current?.();
    display.current?.clear();
    setPath(null);
    if (!viewer || !display.current) {
      setStatus("The viewer is loading. Please retry.");
      return;
    }
    const parameters: OrbitParameters = {
      radius: draft.radius.trim() ? Number(draft.radius) : Number.NaN,
      altitude: draft.altitude.trim() ? Number(draft.altitude) : Number.NaN,
      waypointCount: draft.waypointCount.trim() ? Number(draft.waypointCount) : Number.NaN,
    };
    const buildingHeight = building?.height;
    const target = building && {
      longitude: building.longitude,
      latitude: building.latitude,
      altitude:
        (buildingHeight !== undefined && Number.isFinite(buildingHeight)
          ? Math.max(0, buildingHeight)
          : FALLBACK_BUILDING_HEIGHT_M) / 2,
    };
    const result = generateOrbit(target, box, parameters, (longitude, latitude) =>
      viewer.scene.globe.getHeight(Cartographic.fromDegrees(longitude, latitude)),
    );
    if (!result.path) {
      setStatus(result.messages.join(" "));
      return;
    }
    const nextPath = result.path;
    display.current.replace(nextPath);
    setPath(nextPath);
    setStatus(`Displaying ${nextPath.waypoints.length} waypoints…`);
    // Collections update synchronously in the next frame. Include the frame in NFR1 timing.
    const removeListener = viewer.scene.postRender.addEventListener(() => {
      removeListener();
      cancelRender.current = null;
      const elapsed = performance.now() - started;
      setStatus(
        `Generated and displayed ${nextPath.waypoints.length} waypoints in ${elapsed.toFixed(1)} ms.${elapsed >= 500 ? " Exceeds the 500 ms target on this device." : ""}`,
      );
    });
    cancelRender.current = removeListener;
    viewer.scene.requestRender();
  };

  return (
    <section className="absolute bottom-10 right-4 z-10 max-h-[55vh] w-80 overflow-y-auto rounded-lg bg-white/90 p-4 text-sm text-gray-900 shadow-lg">
      <h2 className="mb-2 font-semibold">Orbital flight path</h2>
      <form onSubmit={generate} noValidate className="space-y-2">
        {inputs.map(({ key, label, min, max }) => (
          <div key={key}>
            <label htmlFor={`orbit-${key}`} className="block text-gray-600">
              {label}
            </label>
            <input
              id={`orbit-${key}`}
              type="number"
              min={min}
              max={max}
              step={key === "waypointCount" ? 1 : "any"}
              value={draft[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1"
            />
          </div>
        ))}
        <p className="text-xs text-gray-600">
          Clockwise from north; waypoint 1 is yellow. Camera aims halfway up the building.
        </p>
        <button
          type="submit"
          className="w-full rounded bg-blue-700 px-3 py-2 font-medium text-white hover:bg-blue-800"
        >
          Generate orbit
        </button>
      </form>
      <p role="status" aria-live="polite" className="mt-2">
        {status}
      </p>
      {path && (
        <details className="mt-3">
          <summary className="cursor-pointer">Waypoint coordinates and camera angles</summary>
          <ol className="mt-2 space-y-2 font-mono text-xs">
            {path.waypoints.map((waypoint) => (
              <li key={waypoint.sequence}>
                #{waypoint.sequence}: {waypoint.longitude.toFixed(6)}°,{" "}
                {waypoint.latitude.toFixed(6)}°
                <br />
                {waypoint.altitude.toFixed(1)} m AGL · heading {waypoint.heading.toFixed(2)}° ·
                pitch {waypoint.gimbalPitch.toFixed(2)}°
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
