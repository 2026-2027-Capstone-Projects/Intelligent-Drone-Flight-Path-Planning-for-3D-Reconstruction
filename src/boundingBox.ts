import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Matrix4,
  Rectangle,
  Transforms,
} from "cesium";

export type BoundingBox = {
  west: number; // degrees
  south: number; // degrees
  east: number; // degrees
  north: number; // degrees
  minAltitude: number; // meters AGL
  maxAltitude: number; // meters AGL
};

export type BoundingBoxBuffer = {
  horizontal: number; // meters added on each of the four sides
  vertical: number; // meters added above the roof
};

export const MAX_ALTITUDE_AGL_M = 120;
export const ESTIMATED_FOOTPRINT_M = 30; // Preserved for imports
export const FALLBACK_BUILDING_HEIGHT_M = 10;

export const DEFAULT_BUFFER: BoundingBoxBuffer = { horizontal: 35, vertical: 15 };
export const BUFFER_STEP_M = 5;
export const MAX_HORIZONTAL_BUFFER_M = 200;

export function toRectangle(box: BoundingBox): Rectangle {
  return Rectangle.fromDegrees(box.west, box.south, box.east, box.north);
}

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
  if (errors.length > 0) return errors;

  if (box.west < -180 || box.west > 180) errors.push("West must be between -180° and 180°.");
  if (box.east < -180 || box.east > 180) errors.push("East must be between -180° and 180°.");
  if (box.south < -90 || box.south > 90) errors.push("South must be between -90° and 90°.");
  if (box.north < -90 || box.north > 90) errors.push("North must be between -90° and 90°.");

  if (box.south >= box.north) errors.push("South must be less than north.");
  if (box.west >= box.east) errors.push("West must be less than east.");

  if (box.minAltitude < 0) errors.push("Min altitude can't be below ground (0 m).");
  if (box.maxAltitude > MAX_ALTITUDE_AGL_M) {
    errors.push(`Max altitude can't exceed ${MAX_ALTITUDE_AGL_M} m AGL.`);
  }
  if (box.minAltitude >= box.maxAltitude) {
    errors.push("Min altitude must be less than max altitude.");
  }

  return errors;
}

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

  const dynamicFootprint = Math.max(ESTIMATED_FOOTPRINT_M, Math.min(80, buildingHeight * 1.4));
  const halfSize = (dynamicFootprint / 2) + buffer.horizontal;

  const { longitude, latitude } = building;
  const east = offsetByMeters(longitude, latitude, halfSize, 0).longitude;
  const west = offsetByMeters(longitude, latitude, -halfSize, 0).longitude;
  const north = offsetByMeters(longitude, latitude, 0, halfSize).latitude;
  const south = offsetByMeters(longitude, latitude, 0, -halfSize).latitude;

  const top = buildingHeight + buffer.vertical;
  if (top > MAX_ALTITUDE_AGL_M) {
    messages.push(`Top capped at ${MAX_ALTITUDE_AGL_M} m AGL (FAA limit).`);
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
