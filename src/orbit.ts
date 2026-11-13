import { Cartesian3, Cartographic, Math as CesiumMath, Matrix4, Transforms } from "cesium";
import {
  type BoundingBox,
  ESTIMATED_FOOTPRINT_M,
  isInsideBoundingBox,
  MAX_ALTITUDE_AGL_M,
  MAX_HORIZONTAL_BUFFER_M,
  validateBoundingBox,
} from "./boundingBox.ts";

/** Adapted from the demo branch's lat/lon/alt model; units and order are explicit. */
export type Waypoint = {
  sequence: number; // 1-based, clockwise starting north of the target
  longitude: number; // WGS84 degrees
  latitude: number; // WGS84 degrees
  altitude: number; // meters AGL at this waypoint
  heading: number; // degrees clockwise from local north, [0, 360)
  gimbalPitch: number; // degrees from the horizon; negative looks down
};

export type OrbitParameters = {
  radius: number; // meters in the target's local ENU plane
  altitude: number; // meters AGL
  waypointCount: number;
};

/** Aim at the centroid, halfway up the building, in meters AGL. */
export type OrbitTarget = Pick<Waypoint, "longitude" | "latitude" | "altitude">;

export type OrbitPath = {
  waypoints: Waypoint[];
  positions: Cartesian3[]; // ECEF, with terrain elevation already applied
  targetPosition: Cartesian3;
};

export type OrbitResult = { path: OrbitPath; messages: [] } | { path: null; messages: string[] };

/** No network requests during generation. Missing loaded terrain rejects the path. */
export type TerrainHeight = (longitude: number, latitude: number) => number | undefined;

export const MIN_ORBIT_RADIUS_M = 1;
export const MAX_ORBIT_RADIUS_M = ESTIMATED_FOOTPRINT_M / 2 + MAX_HORIZONTAL_BUFFER_M;
export const MIN_ORBIT_ALTITUDE_M = 1;
export const MIN_WAYPOINT_COUNT = 8;
export const MAX_WAYPOINT_COUNT = 50;
export const DEFAULT_ORBIT_PARAMETERS: OrbitParameters = {
  radius: 25,
  altitude: 15,
  waypointCount: 25,
};

export function validateOrbitParameters(parameters: OrbitParameters): string[] {
  const messages: string[] = [];
  for (const [value, label, min, max] of [
    [parameters.radius, "Radius", MIN_ORBIT_RADIUS_M, MAX_ORBIT_RADIUS_M],
    [parameters.altitude, "Altitude (AGL)", MIN_ORBIT_ALTITUDE_M, MAX_ALTITUDE_AGL_M],
    [parameters.waypointCount, "Waypoint count", MIN_WAYPOINT_COUNT, MAX_WAYPOINT_COUNT],
  ] as const) {
    if (!Number.isFinite(value) || value < min || value > max) {
      messages.push(`${label} must be between ${min} and ${max}.`);
    }
  }
  if (Number.isFinite(parameters.waypointCount) && !Number.isInteger(parameters.waypointCount)) {
    messages.push("Waypoint count must be a whole number.");
  }
  return messages;
}

/** Orient an ECEF position using its own local ENU frame, never degree differences. */
export function calculateDroneOrientation(drone: Cartesian3, target: Cartesian3) {
  const fixedToEnu = Matrix4.inverseTransformation(
    Transforms.eastNorthUpToFixedFrame(drone),
    new Matrix4(),
  );
  const direction = Matrix4.multiplyByPointAsVector(
    fixedToEnu,
    Cartesian3.subtract(target, drone, new Cartesian3()),
    new Cartesian3(),
  );
  return {
    heading:
      CesiumMath.toDegrees(CesiumMath.zeroToTwoPi(Math.atan2(direction.x, direction.y))) % 360,
    gimbalPitch: CesiumMath.toDegrees(
      Math.atan2(direction.z, Math.hypot(direction.x, direction.y)),
    ),
  };
}

/** Returns a complete orbit or a readable rejection; partial paths never reach the viewer. */
export function generateOrbit(
  target: OrbitTarget | null,
  box: BoundingBox | null,
  parameters: OrbitParameters,
  terrainHeight: TerrainHeight,
): OrbitResult {
  if (!target)
    return { path: null, messages: ["Select a target building before generating an orbit."] };
  if (!box) return { path: null, messages: ["A valid operating bounding box is required."] };

  const messages = [...validateOrbitParameters(parameters), ...validateBoundingBox(box)];
  if (
    !Number.isFinite(target.longitude) ||
    Math.abs(target.longitude) > 180 ||
    !Number.isFinite(target.latitude) ||
    Math.abs(target.latitude) >= 90 ||
    !Number.isFinite(target.altitude) ||
    target.altitude < 0
  ) {
    messages.push("Target coordinates and height must be valid; polar targets are not supported.");
  }
  if (messages.length) return { path: null, messages };

  const targetGround = terrainHeight(target.longitude, target.latitude);
  if (targetGround === undefined || !Number.isFinite(targetGround)) {
    return {
      path: null,
      messages: ["Target terrain is not loaded. Wait for terrain, then retry."],
    };
  }
  const targetPosition = Cartesian3.fromDegrees(
    target.longitude,
    target.latitude,
    targetGround + target.altitude,
  );
  const enuToFixed = Transforms.eastNorthUpToFixedFrame(targetPosition);
  const positions: Cartesian3[] = [];
  const waypoints: Waypoint[] = [];

  for (let index = 0; index < parameters.waypointCount; index++) {
    const angle = (index * CesiumMath.TWO_PI) / parameters.waypointCount;
    const offset = Matrix4.multiplyByPoint(
      enuToFixed,
      new Cartesian3(parameters.radius * Math.sin(angle), parameters.radius * Math.cos(angle), 0),
      new Cartesian3(),
    );
    const geographic = Cartographic.fromCartesian(offset);
    const longitude = CesiumMath.toDegrees(geographic.longitude);
    const latitude = CesiumMath.toDegrees(geographic.latitude);
    if (!isInsideBoundingBox(box, longitude, latitude, parameters.altitude)) {
      return {
        path: null,
        messages: [
          "Orbit does not fit inside the operating bounding box. Reduce the radius or altitude, or increase the box buffers.",
        ],
      };
    }
    const ground = terrainHeight(longitude, latitude);
    if (ground === undefined || !Number.isFinite(ground)) {
      return {
        path: null,
        messages: ["Orbit terrain is not loaded. Wait for terrain, then retry."],
      };
    }
    // AGL belongs to the terrain under EACH point, not the target's terrain or the ellipsoid.
    const position = Cartesian3.fromDegrees(longitude, latitude, ground + parameters.altitude);
    positions.push(position);
    waypoints.push({
      sequence: index + 1,
      longitude,
      latitude,
      altitude: parameters.altitude,
      ...calculateDroneOrientation(position, targetPosition),
    });
  }
  return { path: { waypoints, positions, targetPosition }, messages: [] };
}
