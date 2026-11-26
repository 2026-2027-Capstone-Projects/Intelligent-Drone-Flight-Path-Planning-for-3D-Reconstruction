import { Cartesian3, Cartographic, Math as CesiumMath, Matrix4, Transforms } from "cesium";

/**
 * A 3D box on the globe: the shape of every flight zone and no-flight zone (see `FlightZones`).
 * The user draws each zone's footprint on the terrain with the mouse (see `zoneSpecFromCorners`),
 * then sets its altitudes. Planned flight paths must stay inside the flight zones.
 *
 * The box can be rotated, so it's stored as a center, a size, and a heading rather than
 * west/south/east/north edges. Coordinate conventions:
 * - `centerLongitude` and `centerLatitude` are WGS84 longitude/latitude in **degrees**.
 * - `width` and `depth` are in **meters**, measured in the local east-north-up plane at the
 *   center. `depth` runs along the heading and `width` runs across it.
 * - `heading` is in **degrees clockwise from north**, in [0, 360). At heading 0, `depth` runs
 *   north-south and `width` east-west.
 * - `minAltitude` and `maxAltitude` are **meters above ground level (AGL)**, measured from the
 *   terrain directly below the point. They are not ellipsoid or sea-level heights.
 * - Edges are inclusive. A point exactly on an edge (to within 1 mm), or exactly at the min or max
 *   altitude, is inside.
 *
 * The box is kept as plain numbers so the UI and a future backend payload can share it. Use
 * `boxCorners` for the corners in degrees.
 */
export type BoundingBox = {
  centerLongitude: number; // degrees
  centerLatitude: number; // degrees
  width: number; // meters, across the heading
  depth: number; // meters, along the heading
  heading: number; // degrees clockwise from north, [0, 360)
  minAltitude: number; // meters AGL
  maxAltitude: number; // meters AGL
};

/** A point on the ground, in WGS84 degrees. */
export type GroundPoint = { longitude: number; latitude: number };

/**
 * Highest allowed `maxAltitude`, in meters AGL. FAA Part 107 limits small drones to 400 ft
 * (121.92 m) AGL. We round down to 120 m to leave a small safety margin.
 */
export const MAX_ALTITUDE_AGL_M = 120;

/** How far outside an edge, in meters, a point can be and still count as on the edge. */
const EDGE_TOLERANCE_M = 0.001;

/** A position in a local east-north-up plane, in meters (`x` east, `y` north). */
type LocalPoint = { x: number; y: number };

/** Wraps a heading in degrees into [0, 360). */
export function normalizeHeading(degrees: number): number {
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped === 360 ? 0 : wrapped;
}

/** The box's center as a `GroundPoint`. */
export function boxCenter(box: BoundingBox): GroundPoint {
  return { longitude: box.centerLongitude, latitude: box.centerLatitude };
}

/**
 * Returns the point offset from an origin by a distance in meters along the local east and north
 * axes. Uses Cesium's east-north-up frame instead of converting meters to degrees by hand.
 */
function offsetByMeters(origin: GroundPoint, east: number, north: number): GroundPoint {
  const enuToFixed = Transforms.eastNorthUpToFixedFrame(
    Cartesian3.fromDegrees(origin.longitude, origin.latitude),
  );
  const offset = Matrix4.multiplyByPoint(
    enuToFixed,
    new Cartesian3(east, north, 0),
    new Cartesian3(),
  );
  const cartographic = Cartographic.fromCartesian(offset);
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
  };
}

/**
 * Returns where a point lies in the origin's local east-north-up plane, in meters. The inverse of
 * `offsetByMeters` (to well under a millimeter at site scale).
 */
function toLocalMeters(origin: GroundPoint, point: GroundPoint): LocalPoint {
  const fixedToEnu = Matrix4.inverseTransformation(
    Transforms.eastNorthUpToFixedFrame(Cartesian3.fromDegrees(origin.longitude, origin.latitude)),
    new Matrix4(),
  );
  const local = Matrix4.multiplyByPoint(
    fixedToEnu,
    Cartesian3.fromDegrees(point.longitude, point.latitude),
    new Cartesian3(),
  );
  return { x: local.x, y: local.y };
}

/** Unit vectors in the local plane: `forward` along a heading, `right` across it. */
function headingAxes(headingDegrees: number): { forward: LocalPoint; right: LocalPoint } {
  const heading = CesiumMath.toRadians(headingDegrees);
  return {
    forward: { x: Math.sin(heading), y: Math.cos(heading) },
    right: { x: Math.cos(heading), y: -Math.sin(heading) },
  };
}

const dot = (a: LocalPoint, b: LocalPoint) => a.x * b.x + a.y * b.y;

/** The box's corners in its center's local plane, clockwise from the front-left corner. */
function localCorners(box: BoundingBox): LocalPoint[] {
  const { forward, right } = headingAxes(box.heading);
  const halfWidth = box.width / 2;
  const halfDepth = box.depth / 2;
  return [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ].map(([across, along]) => ({
    x: across * halfWidth * right.x + along * halfDepth * forward.x,
    y: across * halfWidth * right.y + along * halfDepth * forward.y,
  }));
}

/** The box's four corners in degrees, clockwise (seen from above). */
export function boxCorners(box: BoundingBox): GroundPoint[] {
  const center = boxCenter(box);
  return localCorners(box).map((corner) => offsetByMeters(center, corner.x, corner.y));
}

/** The box's corners in another point's local plane, in meters. */
function cornersIn(origin: GroundPoint, box: BoundingBox): LocalPoint[] {
  return boxCorners(box).map((corner) => toLocalMeters(origin, corner));
}

/**
 * Checks the box and returns one readable message per problem. An empty array means the box is
 * valid. Validate before passing a box to Cesium, since out-of-range values can break rendering.
 */
export function validateBoundingBox(box: BoundingBox): string[] {
  const errors: string[] = [];

  const fields: [keyof BoundingBox, string][] = [
    ["centerLongitude", "Center longitude"],
    ["centerLatitude", "Center latitude"],
    ["width", "Width"],
    ["depth", "Depth"],
    ["heading", "Rotation"],
    ["minAltitude", "Min altitude"],
    ["maxAltitude", "Max altitude"],
  ];
  for (const [key, label] of fields) {
    if (!Number.isFinite(box[key])) errors.push(`${label} must be a number.`);
  }
  // The range and ordering checks below are meaningless without numbers.
  if (errors.length > 0) return errors;

  if (box.centerLongitude < -180 || box.centerLongitude > 180) {
    errors.push("Center longitude must be between -180° and 180°.");
  }
  if (box.centerLatitude < -90 || box.centerLatitude > 90) {
    errors.push("Center latitude must be between -90° and 90°.");
  }
  if (box.width <= 0) errors.push("Width must be greater than 0 m.");
  if (box.depth <= 0) errors.push("Depth must be greater than 0 m.");

  if (box.minAltitude < 0) errors.push("Min altitude can't be below ground (0 m).");
  if (box.maxAltitude > MAX_ALTITUDE_AGL_M) {
    errors.push(`Max altitude can't exceed ${MAX_ALTITUDE_AGL_M} m AGL (FAA Part 107 limit).`);
  }
  if (box.minAltitude >= box.maxAltitude) {
    errors.push("Min altitude must be less than max altitude.");
  }

  return errors;
}

/**
 * Returns whether a point is inside the box, edges included. The point is moved into the box's
 * local plane and turned by the box's heading, then compared with the half width and half depth.
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
  if (height < box.minAltitude || height > box.maxAltitude) return false;
  const point = toLocalMeters(boxCenter(box), { longitude, latitude });
  const { forward, right } = headingAxes(box.heading);
  return (
    Math.abs(dot(point, right)) <= box.width / 2 + EDGE_TOLERANCE_M &&
    Math.abs(dot(point, forward)) <= box.depth / 2 + EDGE_TOLERANCE_M
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
 * A user-added zone as it's edited in the panel: a rotated rectangle in meters, placed relative
 * to an anchor point. The anchor is the center of the rectangle the user drew, so a freshly drawn
 * zone has zero offsets. The offsets let the user nudge the zone afterwards without redrawing it.
 * Use `zoneFromSpec` to get the zone's `BoundingBox`.
 */
export type ZoneSpec = {
  anchorLongitude: number; // degrees
  anchorLatitude: number; // degrees
  offsetEast: number; // meters from the anchor to the zone's center (east is positive)
  offsetNorth: number; // meters from the anchor to the zone's center (north is positive)
  width: number; // meters, across the heading
  depth: number; // meters, along the heading
  heading: number; // degrees clockwise from north
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

/** Altitudes given to a newly drawn zone, in meters AGL. The user can change them afterwards. */
export const DEFAULT_ZONE_ALTITUDE: Record<
  ZoneKind,
  Pick<ZoneShape, "minAltitude" | "maxAltitude">
> = {
  flight: { minAltitude: 0, maxAltitude: 60 },
  // A new no-flight zone blocks every altitude.
  noFlight: { minAltitude: 0, maxAltitude: MAX_ALTITUDE_AGL_M },
};

/**
 * Converts a zone entered in meters into a `BoundingBox`. The anchor is offset to the zone's
 * center in a local east-north-up frame, and the heading is wrapped into [0, 360).
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
    ["heading", "Rotation"],
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
    { longitude: spec.anchorLongitude, latitude: spec.anchorLatitude },
    spec.offsetEast,
    spec.offsetNorth,
  );
  const box: BoundingBox = {
    centerLongitude: center.longitude,
    centerLatitude: center.latitude,
    width: spec.width,
    depth: spec.depth,
    heading: normalizeHeading(spec.heading),
    minAltitude: spec.minAltitude,
    maxAltitude: spec.maxAltitude,
  };

  // Catches the altitude limits and any out-of-range coordinates.
  const boxErrors = validateBoundingBox(box);
  if (boxErrors.length > 0) return { box: null, messages: boxErrors };
  return { box, messages: [] };
}

// ---------------------------------------------------------------------------
// Drawing zones with the mouse (PBI-07)
// ---------------------------------------------------------------------------

/**
 * Smallest width or depth, in meters, that a drawn zone may have. Smaller drags are usually a
 * click or a slipped mouse rather than a real zone.
 */
export const MIN_DRAWN_ZONE_SIZE_M = 2;

/**
 * Splits a drag from corner `a` to corner `b` into its components along and across a heading,
 * measured in `a`'s local plane.
 */
function dragComponents(a: GroundPoint, b: GroundPoint, headingDegrees: number) {
  const diagonal = toLocalMeters(a, b);
  const { forward, right } = headingAxes(headingDegrees);
  return {
    diagonal,
    forward,
    right,
    along: dot(diagonal, forward),
    across: dot(diagonal, right),
  };
}

/**
 * The four corners of the rectangle dragged from corner `a` to the opposite corner `b`, with its
 * sides along and across `headingDegrees`. Used for the live preview while dragging.
 */
export function dragCorners(a: GroundPoint, b: GroundPoint, headingDegrees: number): GroundPoint[] {
  const { forward, right, along, across } = dragComponents(a, b, headingDegrees);
  return [
    a,
    offsetByMeters(a, across * right.x, across * right.y),
    b,
    offsetByMeters(a, along * forward.x, along * forward.y),
  ];
}

/** Rounds to two decimal places (centimeters, or hundredths of a degree). */
const roundToHundredths = (value: number) => Math.round(value * 100) / 100;

/**
 * Converts a rectangle dragged on the ground, from corner `a` to the opposite corner `b`, into a
 * zone spec. The rectangle's sides run along and across `headingDegrees`, which the drawing tool
 * sets to the camera's heading so the box lines up with the drag on screen. The corners can be in
 * any order (any drag direction), and `a` and `b` end up as opposite corners of the zone.
 *
 * The anchor is the rectangle's center, with zero offsets. The width and depth are rounded to the
 * centimeter and the heading to 0.01° so the editor's inputs show readable numbers. The altitudes
 * start at `DEFAULT_ZONE_ALTITUDE[kind]`.
 *
 * Returns `spec: null` when the drag is too small or the zone is invalid (for example larger than
 * `MAX_ZONE_SIZE_M`), with the reasons in `messages`.
 */
export function zoneSpecFromCorners(
  kind: ZoneKind,
  a: GroundPoint,
  b: GroundPoint,
  headingDegrees: number,
): { spec: ZoneSpec | null; messages: string[] } {
  for (const value of [a.longitude, a.latitude, b.longitude, b.latitude, headingDegrees]) {
    if (!Number.isFinite(value)) {
      return { spec: null, messages: ["The drawn corners aren't valid coordinates."] };
    }
  }

  const { diagonal, along, across } = dragComponents(a, b, headingDegrees);
  const width = Math.abs(across);
  const depth = Math.abs(along);
  if (width < MIN_DRAWN_ZONE_SIZE_M || depth < MIN_DRAWN_ZONE_SIZE_M) {
    return {
      spec: null,
      messages: [`Drag a larger area (at least ${MIN_DRAWN_ZONE_SIZE_M} m on each side).`],
    };
  }

  const center = offsetByMeters(a, diagonal.x / 2, diagonal.y / 2);
  const spec: ZoneSpec = {
    anchorLongitude: center.longitude,
    anchorLatitude: center.latitude,
    offsetEast: 0,
    offsetNorth: 0,
    width: roundToHundredths(width),
    depth: roundToHundredths(depth),
    heading: normalizeHeading(roundToHundredths(normalizeHeading(headingDegrees))),
    ...DEFAULT_ZONE_ALTITUDE[kind],
  };

  // Reuses the size limits and the box checks the editor applies.
  const { box, messages } = zoneFromSpec(spec);
  return box ? { spec, messages: [] } : { spec: null, messages };
}

// ---------------------------------------------------------------------------
// Workable area
// ---------------------------------------------------------------------------

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

const cross = (a: LocalPoint, b: LocalPoint) => a.x * b.y - a.y * b.x;
const minus = (a: LocalPoint, b: LocalPoint): LocalPoint => ({ x: a.x - b.x, y: a.y - b.y });

type Segment = [LocalPoint, LocalPoint];

/** The polygon's edges, each from one corner to the next. */
const edgesOf = (polygon: LocalPoint[]): Segment[] =>
  polygon.map((corner, i) => [corner, polygon[(i + 1) % polygon.length]]);

/** The x coordinate where two segments cross, or undefined when they don't (or are parallel). */
function crossingX([p1, p2]: Segment, [q1, q2]: Segment): number | undefined {
  const p = minus(p2, p1);
  const q = minus(q2, q1);
  const denominator = cross(p, q);
  // Parallel edges only meet at their endpoints, which are already breakpoints.
  if (Math.abs(denominator) < 1e-12) return undefined;
  const start = minus(q1, p1);
  const t = cross(start, q) / denominator;
  const u = cross(start, p) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return undefined;
  return p1.x + t * p.x;
}

/**
 * The y range a convex polygon covers on the vertical line at `x`, or null when the line misses
 * it. `x` must not be the x of a corner.
 */
function verticalSpan(polygon: LocalPoint[], x: number): Interval | null {
  const ys: number[] = [];
  for (const [p, q] of edgesOf(polygon)) {
    if ((p.x - x) * (q.x - x) < 0) ys.push(p.y + ((x - p.x) * (q.y - p.y)) / (q.x - p.x));
  }
  return ys.length >= 2 ? [Math.min(...ys), Math.max(...ys)] : null;
}

/**
 * Returns the workable ground area in square meters: the ground below which some altitude is
 * still workable. That is the union of the flight zones minus the no-flight zones. A no-flight
 * zone only removes ground where it blocks every altitude the flight zones allow there.
 *
 * Every zone's corners are placed in one local east-north-up plane, centered on the first flight
 * zone. The plane is cut into vertical slabs at every corner and at every point where two edges
 * cross. Inside a slab no edges cross, so along any vertical line the zones keep the same order
 * and the workable length changes linearly. Measuring that length at the slab's middle and
 * multiplying by the slab's width gives the slab's exact area. At site scale (up to a few
 * kilometers) the flat local plane is accurate to well under 0.1%.
 */
export function workableGroundArea(zones: FlightZones): number {
  if (zones.flight.length === 0) return 0;

  const origin = boxCenter(zones.flight[0]);
  const toLocal = (box: BoundingBox) => ({
    polygon: cornersIn(origin, box),
    band: [box.minAltitude, box.maxAltitude] as Interval,
  });
  const flight = zones.flight.map(toLocal);
  const noFlight = zones.noFlight.map(toLocal);

  const edges = [...flight, ...noFlight].flatMap(({ polygon }) => edgesOf(polygon));
  const breakpoints = edges.map(([start]) => start.x);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const x = crossingX(edges[i], edges[j]);
      if (x !== undefined) breakpoints.push(x);
    }
  }
  const xs = uniqueSorted(breakpoints);

  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const slabWidth = xs[i + 1] - xs[i];
    if (slabWidth <= 0) continue;
    const middleX = (xs[i] + xs[i + 1]) / 2;
    const spansAt = (list: typeof flight) =>
      list.flatMap(({ polygon, band }) => {
        const span = verticalSpan(polygon, middleX);
        return span ? [{ span, band }] : [];
      });

    const flightSpans = spansAt(flight);
    if (flightSpans.length === 0) continue;
    const noFlightSpans = spansAt(noFlight);

    // The same band logic as a 1-D problem along the line: split it at every span end, and keep
    // each piece whose flight bands, minus its no-flight bands, leave some height.
    const ys = uniqueSorted([...flightSpans, ...noFlightSpans].flatMap(({ span }) => span));
    let workableLength = 0;
    for (let j = 0; j < ys.length - 1; j++) {
      const middleY = (ys[j] + ys[j + 1]) / 2;
      const bandsCovering = (spans: typeof flightSpans) =>
        spans.filter(({ span }) => span[0] < middleY && middleY < span[1]).map(({ band }) => band);
      const flightBands = bandsCovering(flightSpans);
      if (flightBands.length === 0) continue;
      if (remainingLength(flightBands, bandsCovering(noFlightSpans)) <= 0) continue;
      workableLength += ys[j + 1] - ys[j];
    }
    area += workableLength * slabWidth;
  }
  return area;
}

/**
 * Whether two convex polygons share some area, by the separating axis test. Polygons that only
 * touch along an edge or at a corner don't count.
 */
function polygonsOverlap(a: LocalPoint[], b: LocalPoint[]): boolean {
  const project = (polygon: LocalPoint[], axis: LocalPoint) => {
    const values = polygon.map((corner) => dot(corner, axis));
    return [Math.min(...values), Math.max(...values)] as const;
  };
  for (const polygon of [a, b]) {
    for (const [p, q] of edgesOf(polygon)) {
      const axis = { x: p.y - q.y, y: q.x - p.x }; // perpendicular to the edge
      const [aMin, aMax] = project(a, axis);
      const [bMin, bMax] = project(b, axis);
      const tolerance = EDGE_TOLERANCE_M * Math.hypot(axis.x, axis.y);
      if (aMax <= bMin + tolerance || bMax <= aMin + tolerance) return false;
    }
  }
  return true;
}

/** Whether two boxes share some volume (touching edges or altitudes don't count). */
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  if (Math.min(a.maxAltitude, b.maxAltitude) <= Math.max(a.minAltitude, b.minAltitude)) {
    return false;
  }
  const origin = boxCenter(a);
  return polygonsOverlap(cornersIn(origin, a), cornersIn(origin, b));
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
