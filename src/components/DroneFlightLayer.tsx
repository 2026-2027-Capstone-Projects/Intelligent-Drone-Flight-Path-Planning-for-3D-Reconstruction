import {
  Cartesian2,
  Cartesian3,
  Color,
  HeightReference,
  LabelStyle,
  PolylineDashMaterialProperty,
  VerticalOrigin,
} from "cesium";
import { useEffect, useMemo } from "react";
import { Entity } from "resium";
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
    heading: a.heading + (b.heading - a.heading) * frac,
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
  const totalDistanceM = useMemo(() => {
    let dist = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const a = Cartesian3.fromDegrees(
        waypoints[i - 1].longitude,
        waypoints[i - 1].latitude,
        waypoints[i - 1].altitude,
      );
      const b = Cartesian3.fromDegrees(
        waypoints[i].longitude,
        waypoints[i].latitude,
        waypoints[i].altitude,
      );
      dist += Cartesian3.distance(a, b);
    }
    return Math.max(dist, 1);
  }, [waypoints]);

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
      waypoints.map((wp) => Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude)),
    [waypoints],
  );

  if (waypoints.length === 0) return null;

  const targetAimCartesian = Cartesian3.fromDegrees(
    targetBuilding.longitude,
    targetBuilding.latitude,
    (targetBuilding.height ?? 10) * 0.6,
  );

  return (
    <>
      {/* Dashed Flight Path Trajectory to prevent visual blending with the bounding box */}
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
        const pos = Cartesian3.fromDegrees(wp.longitude, wp.latitude, wp.altitude);

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
              heightReference: HeightReference.RELATIVE_TO_GROUND,
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
                    heightReference: HeightReference.RELATIVE_TO_GROUND,
                  }
                : undefined
            }
          />
        );
      })}

      {/* Active Drone & Gimbal Sightline */}
      {activeDrone && (
        <>
          <Entity
            name="Active Drone"
            position={Cartesian3.fromDegrees(
              activeDrone.longitude,
              activeDrone.latitude,
              activeDrone.altitude,
            )}
            point={{
              pixelSize: 16,
              color: Color.CYAN,
              outlineColor: Color.WHITE,
              outlineWidth: 3,
              heightReference: HeightReference.RELATIVE_TO_GROUND,
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
              heightReference: HeightReference.RELATIVE_TO_GROUND,
            }}
          />

          <Entity
            name="Drone Gimbal Sightline"
            polyline={{
              positions: [
                Cartesian3.fromDegrees(
                  activeDrone.longitude,
                  activeDrone.latitude,
                  activeDrone.altitude,
                ),
                targetAimCartesian,
              ],
              width: 2,
              material: Color.LIME.withAlpha(0.6),
            }}
          />
        </>
      )}
    </>
  );
}
