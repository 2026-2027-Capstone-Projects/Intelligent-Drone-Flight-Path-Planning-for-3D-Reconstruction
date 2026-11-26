import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  LabelStyle,
  PolylineDashMaterialProperty,
  VerticalOrigin,
} from "cesium";
import { useCallback, useEffect, useMemo } from "react";
import { Entity, useCesium } from "resium";
import type { Waypoint } from "../flightPath.ts";

type Props = {
  waypoints: Waypoint[];
  targetBuilding: { longitude: number; latitude: number; height?: number };
  isPlaying: boolean;
  speedMps: number;
  progress: number; // 0 to 1
  onProgressChange: (next: number | ((prev: number) => number)) => void;
  onDroneTelemetry: (wp: Waypoint) => void;
};

function interpolateAngleDeg(a: number, b: number, t: number): number {
  const start = ((a % 360) + 360) % 360;
  const end = ((b % 360) + 360) % 360;
  const delta = ((((end - start) % 360) + 540) % 360) - 180;
  return (((start + delta * t) % 360) + 360) % 360;
}

function interpolateWaypoints(waypoints: Waypoint[], progress: number): Waypoint | null {
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1 || progress <= 0) return waypoints[0];
  if (progress >= 1) return waypoints[waypoints.length - 1];

  const scaled = progress * (waypoints.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  const a = waypoints[idx];
  const b = waypoints[Math.min(idx + 1, waypoints.length - 1)];

  return {
    index: idx,
    longitude: a.longitude + (b.longitude - a.longitude) * frac,
    latitude: a.latitude + (b.latitude - a.latitude) * frac,
    altitude: a.altitude + (b.altitude - a.altitude) * frac,
    heading: interpolateAngleDeg(a.heading, b.heading, frac),
    pitch: a.pitch + (b.pitch - a.pitch) * frac,
  };
}

export default function DroneFlightLayer({
  waypoints,
  targetBuilding,
  isPlaying,
  speedMps,
  progress,
  onProgressChange,
  onDroneTelemetry,
}: Props) {
  const { viewer } = useCesium();

  const toTerrainCartesian = useCallback(
    (longitude: number, latitude: number, aglAltitude: number) => {
      const groundHeight =
        viewer?.scene.globe.getHeight(Cartographic.fromDegrees(longitude, latitude)) ?? 0;
      return Cartesian3.fromDegrees(longitude, latitude, groundHeight + aglAltitude);
    },
    [viewer],
  );

  const totalDistanceM = useMemo(() => {
    let dist = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const a = toTerrainCartesian(
        waypoints[i - 1].longitude,
        waypoints[i - 1].latitude,
        waypoints[i - 1].altitude,
      );
      const b = toTerrainCartesian(
        waypoints[i].longitude,
        waypoints[i].latitude,
        waypoints[i].altitude,
      );
      dist += Cartesian3.distance(a, b);
    }
    return Math.max(dist, 1);
  }, [waypoints, toTerrainCartesian]);

  useEffect(() => {
    if (!isPlaying || waypoints.length < 2) return;
    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const dtSec = (now - lastTime) / 1000;
      lastTime = now;
      const deltaProgress = (speedMps * dtSec) / totalDistanceM;

      onProgressChange((prev) => {
        const next = prev + deltaProgress;
        return next >= 1 ? 0 : next;
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, speedMps, totalDistanceM, waypoints.length, onProgressChange]);

  const activeDrone = useMemo(
    () => interpolateWaypoints(waypoints, progress),
    [waypoints, progress],
  );

  useEffect(() => {
    if (activeDrone) onDroneTelemetry(activeDrone);
  }, [activeDrone, onDroneTelemetry]);

  const pathPositions = useMemo(
    () =>
      waypoints.map((wp) => toTerrainCartesian(wp.longitude, wp.latitude, wp.altitude)),
    [waypoints, toTerrainCartesian],
  );

  if (waypoints.length === 0) return null;

  const targetAimCartesian = toTerrainCartesian(
    targetBuilding.longitude,
    targetBuilding.latitude,
    (targetBuilding.height ?? 10) * 0.6,
  );

  const activeDroneCartesian = activeDrone
    ? toTerrainCartesian(activeDrone.longitude, activeDrone.latitude, activeDrone.altitude)
    : null;

  return (
    <>
      {/* Dashed Flight Path Trajectory */}
      <Entity
        name="Drone Flight Path"
        polyline={{
          positions: pathPositions,
          width: 4,
          material: new PolylineDashMaterialProperty({
            color: Color.YELLOW,
            dashLength: 18.0,
            dashPattern: 255,
          }),
        }}
      />

      {/* Waypoint Nodes */}
      {waypoints.map((wp, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === waypoints.length - 1;
        const color = isStart ? Color.LIME : isEnd ? Color.RED : Color.ORANGE;
        const pos = toTerrainCartesian(wp.longitude, wp.latitude, wp.altitude);

        return (
          <Entity
            key={`wp-${wp.index}`}
            name={`Waypoint ${wp.index + 1}`}
            position={pos}
            point={{
              pixelSize: isStart || isEnd ? 10 : 6,
              color,
              outlineColor: Color.BLACK,
              outlineWidth: 1.5,
            }}
            label={
              isStart || isEnd || idx % 4 === 0
                ? {
                    text: isStart ? "START" : isEnd ? "END" : `W${wp.index + 1}`,
                    font: "11px monospace",
                    fillColor: Color.WHITE,
                    outlineColor: Color.BLACK,
                    outlineWidth: 2,
                    style: LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: VerticalOrigin.BOTTOM,
                    pixelOffset: new Cartesian2(0, -10),
                  }
                : undefined
            }
          />
        );
      })}

      {/* Active Drone & Gimbal Sightline */}
      {activeDrone && activeDroneCartesian && (
        <>
          <Entity
            name="Active Drone"
            position={activeDroneCartesian}
            point={{
              pixelSize: 16,
              color: Color.CYAN,
              outlineColor: Color.WHITE,
              outlineWidth: 3,
            }}
            label={{
              text: `DRONE (${activeDrone.altitude.toFixed(1)}m)`,
              font: "bold 12px monospace",
              fillColor: Color.CYAN,
              outlineColor: Color.BLACK,
              outlineWidth: 3,
              style: LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: VerticalOrigin.BOTTOM,
              pixelOffset: new Cartesian2(0, -14),
            }}
          />

          <Entity
            name="Drone Gimbal Sightline"
            polyline={{
              positions: [activeDroneCartesian, targetAimCartesian],
              width: 2,
              material: Color.LIME.withAlpha(0.6),
            }}
          />
        </>
      )}
    </>
  );
}
