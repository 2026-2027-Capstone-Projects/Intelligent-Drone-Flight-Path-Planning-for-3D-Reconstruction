import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  EllipsoidGeodesic,
  Matrix4,
  Rectangle,
  Transforms,
} from "cesium";

/**
 * The drone's operating bounding box: a 3D volume that planned flight paths must stay inside.
 * One box is generated around the selected building (see `boundingBoxAroundBuilding`). The same
 * type describes each flight zone and no-flight zone (see `FlightZones`).
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
 * Builds a box centered on a point, extending `halfWidth` meters east and west and `halfDepth`
 * meters north and south. Each edge is measured along the center lines through the point. The
 * result isn't validated.
 */
function boxAroundPoint(
  longitude: number,
  latitude: number,
  halfWidth: number,
  halfDepth: number,
  minAltitude: number,
  maxAltitude: number,
): BoundingBox {
  return {
    west: offsetByMeters(longitude, latitude, -halfWidth, 0).longitude,
    south: offsetByMeters(longitude, latitude, 0, -halfDepth).latitude,
    east: offsetByMeters(longitude, latitude, halfWidth, 0).longitude,
    north: offsetByMeters(longitude, latitude, 0, halfDepth).latitude,
    minAltitude,
    maxAltitude,
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

  const top = buildingHeight + buffer.vertical;
  if (buildingHeight >= MAX_ALTITUDE_AGL_M) {
    messages.push(
      `Building is taller than the ${MAX_ALTITUDE_AGL_M} m limit; the box doesn't cover its top.`,
    );
  } else if (top > MAX_ALTITUDE_AGL_M) {
    messages.push(`Top capped at ${MAX_ALTITUDE_AGL_M} m AGL (FAA Part 107 limit).`);
  }

  const halfSize = ESTIMATED_FOOTPRINT_M / 2 + buffer.horizontal;
  const box = boxAroundPoint(
    building.longitude,
    building.latitude,
    halfSize,
    halfSize,
    0,
    Math.min(top, MAX_ALTITUDE_AGL_M),
  );

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

// ---------------------------------------------------------------------------
// Flight zones and no-flight zones (PBI-06)
// ---------------------------------------------------------------------------

/** `"flight"`: the drone may fly inside. `"noFlight"`: the drone must stay out. */
export type ZoneKind = "flight" | "noFlight";

/**
 * Every zone that constrains the drone. The **workable area** is the union of the flight zones
 * minus the union of the no-flight zones.
 *
 * Each zone is a `BoundingBox` with the same conventions (degrees, meters AGL, edges inclusive).
 * - No-flight zones are closed, the same as flight zones. A point on a no-flight edge, or exactly
 *   at a no-flight zone's min or max altitude, is inside that no-flight zone, so it isn't workable.
 * - A no-flight zone only blocks its own altitude band. A no-flight zone from 0 to 30 m inside a
 *   flight zone from 0 to 60 m still allows flight above 30 m.
 */
export type FlightZones = {
  flight: BoundingBox[];
  noFlight: BoundingBox[];
};

/**
 * A user-added zone as it's entered in the panel: a rectangle in meters, placed relative to an
 * anchor point. The anchor is the building that was selected when the zone was created. It's
 * stored with the zone so the zone stays in place when a different building is selected.
 * Use `zoneFromSpec` to get the zone's `BoundingBox`.
 */
export type ZoneSpec = {
  anchorLongitude: number; // degrees
  anchorLatitude: number; // degrees
  offsetEast: number; // meters from the anchor to the zone's center (east is positive)
  offsetNorth: number; // meters from the anchor to the zone's center (north is positive)
  width: number; // meters, east-west
  depth: number; // meters, north-south
  minAltitude: number; // meters AGL
  maxAltitude: number; // meters AGL
};

/** A user-added zone with a stable id for the UI. */
export type Zone = {
  id: string;
  kind: ZoneKind;
  spec: ZoneSpec;
};

/** Largest allowed zone width or depth, in meters. */
export const MAX_ZONE_SIZE_M = 2000;
/** Largest allowed distance from the anchor to a zone's center, east or north, in meters. */
export const MAX_ZONE_OFFSET_M = 2000;

/** The editable part of a `ZoneSpec` (everything except the anchor). */
export type ZoneShape = Omit<ZoneSpec, "anchorLongitude" | "anchorLatitude">;

/** Shape of a newly added zone, centered on the anchor. */
export const DEFAULT_ZONE: Record<ZoneKind, ZoneShape> = {
  flight: {
    offsetEast: 0,
    offsetNorth: 0,
    width: 100,
    depth: 100,
    minAltitude: 0,
    maxAltitude: 60,
  },
  // A new no-flight zone blocks every altitude.
  noFlight: {
    offsetEast: 0,
    offsetNorth: 0,
    width: 20,
    depth: 20,
    minAltitude: 0,
    maxAltitude: MAX_ALTITUDE_AGL_M,
  },
};

/**
 * Converts a zone entered in meters into a `BoundingBox`. The anchor is offset to the zone's
 * center in a local east-north-up frame, then the edges are measured from the center.
 *
 * Returns `box: null` when the spec or the resulting box is invalid, with the reasons in
 * `messages`.
 */
export function zoneFromSpec(spec: ZoneSpec): { box: BoundingBox | null; messages: string[] } {
  const errors: string[] = [];

  const fields: [keyof ZoneSpec, string][] = [
    ["anchorLongitude", "Anchor longitude"],
    ["anchorLatitude", "Anchor latitude"],
    ["offsetEast", "East offset"],
    ["offsetNorth", "North offset"],
    ["width", "Width"],
    ["depth", "Depth"],
    ["minAltitude", "Min altitude"],
    ["maxAltitude", "Max altitude"],
  ];
  for (const [key, label] of fields) {
    if (!Number.isFinite(spec[key])) errors.push(`${label} must be a number.`);
  }
  if (errors.length > 0) return { box: null, messages: errors };

  for (const [value, label] of [
    [spec.width, "Width"],
    [spec.depth, "Depth"],
  ] as const) {
    if (value <= 0) errors.push(`${label} must be greater than 0 m.`);
    else if (value > MAX_ZONE_SIZE_M) errors.push(`${label} can't exceed ${MAX_ZONE_SIZE_M} m.`);
  }
  for (const [value, label] of [
    [spec.offsetEast, "East offset"],
    [spec.offsetNorth, "North offset"],
  ] as const) {
    if (Math.abs(value) > MAX_ZONE_OFFSET_M) {
      errors.push(`${label} must be within ±${MAX_ZONE_OFFSET_M} m.`);
    }
  }
  if (errors.length > 0) return { box: null, messages: errors };

  const center = offsetByMeters(
    spec.anchorLongitude,
    spec.anchorLatitude,
    spec.offsetEast,
    spec.offsetNorth,
  );
  const box = boxAroundPoint(
    center.longitude,
    center.latitude,
    spec.width / 2,
    spec.depth / 2,
    spec.minAltitude,
    spec.maxAltitude,
  );

  // Catches the altitude limits and any out-of-range coordinates.
  const boxErrors = validateBoundingBox(box);
  if (boxErrors.length > 0) return { box: null, messages: boxErrors };
  return { box, messages: [] };
}

/**
 * Returns whether a point is inside the workable area: inside at least one flight zone and inside
 * no no-flight zone. Edges are inclusive for both kinds, so a point on a no-flight edge returns
 * false.
 *
 * @param longitude WGS84 longitude in degrees.
 * @param latitude WGS84 latitude in degrees.
 * @param height Height in meters above ground level (AGL), not ellipsoid height.
 */
export function isInsideWorkableArea(
  zones: FlightZones,
  longitude: number,
  latitude: number,
  height: number,
): boolean {
  const inside = (box: BoundingBox) => isInsideBoundingBox(box, longitude, latitude, height);
  return zones.flight.some(inside) && !zones.noFlight.some(inside);
}

type Interval = [number, number];

/** Merges overlapping or touching intervals into a sorted list of disjoint ones. */
function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const [low, high] of sorted) {
    const last = merged.at(-1);
    if (last && low <= last[1]) last[1] = Math.max(last[1], high);
    else merged.push([low, high]);
  }
  return merged;
}

/** Total length of `allowed` that isn't covered by `blocked`. */
function remainingLength(allowed: Interval[], blocked: Interval[]): number {
  const blockedMerged = mergeIntervals(blocked);
  let total = 0;
  for (const [low, high] of mergeIntervals(allowed)) {
    let covered = 0;
    // `blockedMerged` is disjoint, so the overlaps can be summed without double counting.
    for (const [blockedLow, blockedHigh] of blockedMerged) {
      covered += Math.max(0, Math.min(high, blockedHigh) - Math.max(low, blockedLow));
    }
    total += high - low - covered;
  }
  return total;
}

const uniqueSorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

/**
 * Returns the workable ground area in square meters: the ground below which some altitude is
 * still workable. That is the union of the flight zones minus the no-flight zones. A no-flight
 * zone only removes ground where it blocks every altitude the flight zones allow there.
 *
 * The zones' edges split the area into a grid of cells, and every zone either fully covers a cell
 * or doesn't touch it. A cell counts when its flight altitude bands, minus its no-flight bands,
 * leave some height. Each cell's width and height are measured on the WGS84 ellipsoid with
 * Cesium's `EllipsoidGeodesic`, along the cell's middle parallel and meridian. At site scale
 * (up to a few kilometers) the result is accurate to well under 0.1%.
 */
export function workableGroundArea(zones: FlightZones): number {
  if (zones.flight.length === 0) return 0;

  const all = [...zones.flight, ...zones.noFlight];
  const longitudes = uniqueSorted(all.flatMap((box) => [box.west, box.east]));
  const latitudes = uniqueSorted(all.flatMap((box) => [box.south, box.north]));
  const flight = zones.flight.map((box) => ({ box, rectangle: toRectangle(box) }));
  const noFlight = zones.noFlight.map((box) => ({ box, rectangle: toRectangle(box) }));

  const geodesic = new EllipsoidGeodesic();
  const distance = (lon1: number, lat1: number, lon2: number, lat2: number) => {
    geodesic.setEndPoints(
      Cartographic.fromDegrees(lon1, lat1),
      Cartographic.fromDegrees(lon2, lat2),
    );
    return geodesic.surfaceDistance;
  };

  let area = 0;
  for (let i = 0; i < longitudes.length - 1; i++) {
    for (let j = 0; j < latitudes.length - 1; j++) {
      const [west, east] = [longitudes[i], longitudes[i + 1]];
      const [south, north] = [latitudes[j], latitudes[j + 1]];
      // A cell's center is never on a zone edge, so testing it decides the whole cell.
      const center = Cartographic.fromDegrees((west + east) / 2, (south + north) / 2);
      const bandsCovering = (list: typeof flight): Interval[] =>
        list
          .filter(({ rectangle }) => Rectangle.contains(rectangle, center))
          .map(({ box }) => [box.minAltitude, box.maxAltitude]);

      const flightBands = bandsCovering(flight);
      if (flightBands.length === 0) continue;
      if (remainingLength(flightBands, bandsCovering(noFlight)) <= 0) continue;

      const middleLatitude = (south + north) / 2;
      const middleLongitude = (west + east) / 2;
      area +=
        distance(west, middleLatitude, east, middleLatitude) *
        distance(middleLongitude, south, middleLongitude, north);
    }
  }
  return area;
}

/** Whether two boxes share some volume (touching edges or altitudes don't count). */
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    Math.min(a.east, b.east) > Math.max(a.west, b.west) &&
    Math.min(a.north, b.north) > Math.max(a.south, b.south) &&
    Math.min(a.maxAltitude, b.maxAltitude) > Math.max(a.minAltitude, b.minAltitude)
  );
}

/**
 * Returns warnings about zones that are valid but probably not what the user meant. No-flight
 * zones are numbered from 1 in the order of `zones.noFlight`.
 *
 * @param workableArea The result of `workableGroundArea(zones)`.
 */
export function zoneWarnings(zones: FlightZones, workableArea: number): string[] {
  const warnings: string[] = [];
  zones.noFlight.forEach((noFlightZone, index) => {
    if (!zones.flight.some((flightZone) => boxesOverlap(flightZone, noFlightZone))) {
      warnings.push(
        `No-flight zone ${index + 1} doesn't overlap any flight zone, so it has no effect.`,
      );
    }
  });
  if (zones.flight.length > 0 && zones.noFlight.length > 0 && workableArea <= 0) {
    warnings.push("No-flight zones cover the whole workable area; there's nowhere left to fly.");
  }
  return warnings;
}
