import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Matrix4,
  Rectangle,
  Transforms,
} from "cesium";

/**
 * The drone's operating bounding box: a 3D volume that planned flight paths must stay inside.
 * One box is generated around the selected building (see `boundingBoxAroundBuilding`).
 *
 * Coordinate conventions:
 * - `west`, `south`, `east`, `north` are WGS84 longitude/latitude in **degrees**.
 * - `minAltitude` and `maxAltitude` are **meters above ground level (AGL)**, measured from the
 *   terrain directly below the point. They are not ellipsoid or sea-level heights.
 * - Edges are inclusive. A point exactly on an edge, or exactly at the min or max altitude, is
 *   inside.
 * - The box cannot cross the antimeridian, so `west` must be less than `east`.
 *
 * The box is kept as plain numbers so the UI and a future backend payload can share it. Use
 * `toRectangle` to get the Cesium form.
 */
export type BoundingBox = {
  west: number; // degrees
  south: number; // degrees
  east: number; // degrees
  north: number; // degrees
  minAltitude: number; // meters AGL
  maxAltitude: number; // meters AGL
};

/** Space added around the building, in meters. */
export type BoundingBoxBuffer = {
  horizontal: number; // meters added on each of the four sides
  vertical: number; // meters added above the roof
};

/**
 * Highest allowed `maxAltitude`, in meters AGL. FAA Part 107 limits small drones to 400 ft
 * (121.92 m) AGL. We round down to 120 m to leave a small safety margin.
 */
export const MAX_ALTITUDE_AGL_M = 120;

/**
 * Assumed building width and depth, in meters, centered on the building's OSM centroid.
 * Cesium OSM Buildings features carry a centroid and height but no footprint, so the real size
 * isn't available. Long or large buildings can extend past this estimate.
 */
export const ESTIMATED_FOOTPRINT_M = 30;

/** Assumed building height, in meters, when the feature has no `cesium#estimatedHeight`. */
export const FALLBACK_BUILDING_HEIGHT_M = 10;

export const DEFAULT_BUFFER: BoundingBoxBuffer = { horizontal: 20, vertical: 10 };
export const BUFFER_STEP_M = 5;
export const MAX_HORIZONTAL_BUFFER_M = 200;

/** Converts the box's horizontal bounds to a Cesium `Rectangle` (radians). */
export function toRectangle(box: BoundingBox): Rectangle {
  return Rectangle.fromDegrees(box.west, box.south, box.east, box.north);
}

/**
 * Checks the box and returns one readable message per problem. An empty array means the box is
 * valid. Validate before passing a box to Cesium, since out-of-range values can break rendering.
 */
export function validateBoundingBox(box: BoundingBox): string[] {
  const errors: string[] = [];

  const fields: [keyof BoundingBox, string][] = [
    ["west", "West"],
    ["south", "South"],
    ["east", "East"],
    ["north", "North"],
    ["minAltitude", "Min altitude"],
    ["maxAltitude", "Max altitude"],
  ];
  for (const [key, label] of fields) {
    if (!Number.isFinite(box[key])) errors.push(`${label} must be a number.`);
  }
  // The range and ordering checks below are meaningless without numbers.
  if (errors.length > 0) return errors;

  for (const [value, label] of [
    [box.west, "West"],
    [box.east, "East"],
  ] as const) {
    if (value < -180 || value > 180) errors.push(`${label} must be between -180° and 180°.`);
  }
  for (const [value, label] of [
    [box.south, "South"],
    [box.north, "North"],
  ] as const) {
    if (value < -90 || value > 90) errors.push(`${label} must be between -90° and 90°.`);
  }

  if (box.south >= box.north) errors.push("South must be less than north.");
  if (box.west >= box.east) {
    errors.push("West must be less than east (boxes crossing the antimeridian aren't supported).");
  }

  if (box.minAltitude < 0) errors.push("Min altitude can't be below ground (0 m).");
  if (box.maxAltitude > MAX_ALTITUDE_AGL_M) {
    errors.push(`Max altitude can't exceed ${MAX_ALTITUDE_AGL_M} m AGL (FAA Part 107 limit).`);
  }
  if (box.minAltitude >= box.maxAltitude) {
    errors.push("Min altitude must be less than max altitude.");
  }

  return errors;
}

/** Checks a buffer and returns one readable message per problem. Empty means valid. */
export function validateBuffer(buffer: BoundingBoxBuffer): string[] {
  const errors: string[] = [];
  for (const [value, label] of [
    [buffer.horizontal, "Horizontal buffer"],
    [buffer.vertical, "Vertical buffer"],
  ] as const) {
    if (!Number.isFinite(value)) errors.push(`${label} must be a number.`);
    else if (value < 0) errors.push(`${label} can't be negative.`);
  }
  if (buffer.horizontal > MAX_HORIZONTAL_BUFFER_M) {
    errors.push(`Horizontal buffer can't exceed ${MAX_HORIZONTAL_BUFFER_M} m.`);
  }
  return errors;
}

/**
 * Returns the longitude and latitude, in degrees, of a point offset from an origin by a distance
 * in meters along the local east and north axes. Uses Cesium's east-north-up frame instead of
 * converting meters to degrees by hand.
 */
function offsetByMeters(
  longitude: number,
  latitude: number,
  eastMeters: number,
  northMeters: number,
): { longitude: number; latitude: number } {
  const enuToFixed = Transforms.eastNorthUpToFixedFrame(
    Cartesian3.fromDegrees(longitude, latitude),
  );
  const offset = Matrix4.multiplyByPoint(
    enuToFixed,
    new Cartesian3(eastMeters, northMeters, 0),
    new Cartesian3(),
  );
  const cartographic = Cartographic.fromCartesian(offset);
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
  };
}

/**
 * Builds the operating box around a building. It covers the estimated footprint
 * (`ESTIMATED_FOOTPRINT_M` square, centered on the building) plus `buffer.horizontal` on each
 * side. It runs from the ground (0 m AGL) to the roof plus `buffer.vertical`, capped at
 * `MAX_ALTITUDE_AGL_M`.
 *
 * Returns `box: null` when the result is invalid, with the reasons in `messages`. Otherwise
 * `messages` holds notes about estimates and caps, for display to the user.
 *
 * @param building Centroid in degrees and height in meters (AGL), as read from OSM Buildings.
 */
export function boundingBoxAroundBuilding(
  building: { longitude: number; latitude: number; height?: number },
  buffer: BoundingBoxBuffer,
): { box: BoundingBox | null; messages: string[] } {
  const messages: string[] = [];

  let buildingHeight = building.height;
  if (buildingHeight === undefined || !Number.isFinite(buildingHeight)) {
    buildingHeight = FALLBACK_BUILDING_HEIGHT_M;
    messages.push(`Building height unknown; assuming ${FALLBACK_BUILDING_HEIGHT_M} m.`);
  }

  // Measure each edge along the center lines through the building's centroid.
  const halfSize = ESTIMATED_FOOTPRINT_M / 2 + buffer.horizontal;
  const { longitude, latitude } = building;
  const east = offsetByMeters(longitude, latitude, halfSize, 0).longitude;
  const west = offsetByMeters(longitude, latitude, -halfSize, 0).longitude;
  const north = offsetByMeters(longitude, latitude, 0, halfSize).latitude;
  const south = offsetByMeters(longitude, latitude, 0, -halfSize).latitude;

  const top = buildingHeight + buffer.vertical;
  if (buildingHeight >= MAX_ALTITUDE_AGL_M) {
    messages.push(
      `Building is taller than the ${MAX_ALTITUDE_AGL_M} m limit; the box doesn't cover its top.`,
    );
  } else if (top > MAX_ALTITUDE_AGL_M) {
    messages.push(`Top capped at ${MAX_ALTITUDE_AGL_M} m AGL (FAA Part 107 limit).`);
  }

  const box: BoundingBox = {
    west,
    south,
    east,
    north,
    minAltitude: 0,
    maxAltitude: Math.min(top, MAX_ALTITUDE_AGL_M),
  };

  const errors = validateBoundingBox(box);
  if (errors.length > 0) return { box: null, messages: errors };
  return { box, messages };
}

/**
 * Returns whether a point is inside the box, edges included.
 *
 * @param longitude WGS84 longitude in degrees.
 * @param latitude WGS84 latitude in degrees.
 * @param height Height in meters above ground level (AGL), not ellipsoid height.
 */
export function isInsideBoundingBox(
  box: BoundingBox,
  longitude: number,
  latitude: number,
  height: number,
): boolean {
  return (
    Rectangle.contains(toRectangle(box), Cartographic.fromDegrees(longitude, latitude)) &&
    height >= box.minAltitude &&
    height <= box.maxAltitude
  );
}
