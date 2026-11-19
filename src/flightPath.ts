import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Matrix4,
  Transforms,
} from "cesium";
import {
  type BoundingBox,
  ESTIMATED_FOOTPRINT_M,
  FALLBACK_BUILDING_HEIGHT_M,
} from "./boundingBox.ts";

export type FlightPatternType =
  | "helix"
  | "sphere"
  | "box_perimeter"
  | "orbit"
  | "grid"
  | "facade_scan";

export type Waypoint = {
  index: number;
  longitude: number; // degrees
  latitude: number; // degrees
  altitude: number; // meters AGL
  heading: number; // degrees (pointing at building)
  pitch: number; // degrees
};

export type FlightPatternMeta = {
  id: FlightPatternType;
  label: string;
  description: string;
};

export const FLIGHT_PATTERNS: FlightPatternMeta[] = [
  {
    id: "helix",
    label: "Helix Spiral",
    description: "Ascending corkscrew around the building for 3D facade capture.",
  },
  {
    id: "sphere",
    label: "Spherical Dome",
    description: "Hemispherical rings arching over the structure from side to zenith.",
  },
  {
    id: "box_perimeter",
    label: "Bounding Box Perimeter",
    description: "Multi-tier rectangular loop tracing the outer safety boundary.",
  },
  {
    id: "orbit",
    label: "Circular Orbit (POI)",
    description: "Constant-altitude 360° orbit centered on the building.",
  },
  {
    id: "grid",
    label: "Roof Grid (Lawnmower)",
    description: "Parallel sweep lines across the top plane for orthomosaic mapping.",
  },
  {
    id: "facade_scan",
    label: "Vertical Facade Zig-Zag",
    description: "Vertical sweeps across all four sides of the building.",
  },
];

function enuToGeodetic(
  originLon: number,
  originLat: number,
  eastM: number,
  northM: number,
  upM: number,
): { longitude: number; latitude: number; altitude: number } {
  const enuToFixed = Transforms.eastNorthUpToFixedFrame(
    Cartesian3.fromDegrees(originLon, originLat, 0),
  );
  const worldPos = Matrix4.multiplyByPoint(
    enuToFixed,
    new Cartesian3(eastM, northM, upM),
    new Cartesian3(),
  );
  const carto = Cartographic.fromCartesian(worldPos);
  return {
    longitude: CesiumMath.toDegrees(carto.longitude),
    latitude: CesiumMath.toDegrees(carto.latitude),
    altitude: upM,
  };
}

function clampToBox(
  lon: number,
  lat: number,
  alt: number,
  box: BoundingBox,
): { longitude: number; latitude: number; altitude: number } {
  // Small inset (1e-6 deg ~ 0.1m) keeps points strictly inside boundary checks
  const eps = 1e-6;
  return {
    longitude: Math.min(box.east - eps, Math.max(box.west + eps, lon)),
    latitude: Math.min(box.north - eps, Math.max(box.south + eps, lat)),
    altitude: Math.min(box.maxAltitude, Math.max(box.minAltitude + 2, alt)),
  };
}

function computeGimbalAngles(
  wp: { longitude: number; latitude: number; altitude: number },
  target: { longitude: number; latitude: number; altitude: number },
): { heading: number; pitch: number } {
  // Approximate meter deltas near target latitude for gimbal pointing
  const latRad = CesiumMath.toRadians(target.latitude);
  const dx = (target.longitude - wp.longitude) * 111_320 * Math.cos(latRad);
  const dy = (target.latitude - wp.latitude) * 110_540;
  const dz = target.altitude - wp.altitude;

  const heading = CesiumMath.toDegrees(Math.atan2(dx, dy));
  const horizontalDist = Math.hypot(dx, dy);
  const pitch = CesiumMath.toDegrees(Math.atan2(dz, horizontalDist));

  return { heading, pitch };
}

export function generateFlightPath(
  pattern: FlightPatternType,
  building: { longitude: number; latitude: number; height?: number },
  box: BoundingBox,
  options: { turns?: number; pointsPerTurn?: number } = {},
): Waypoint[] {
  const bHeight = building.height ?? FALLBACK_BUILDING_HEIGHT_M;
  const turns = options.turns ?? 3;
  const pointsPerTurn = options.pointsPerTurn ?? 16;

  // Compute safe horizontal radius in meters from the bounding box center to its edges
  const centerLon = (box.west + box.east) / 2;
  const centerLat = (box.south + box.north) / 2;
  const latRad = CesiumMath.toRadians(centerLat);
  const halfWidthM = ((box.east - box.west) / 2) * 111_320 * Math.cos(latRad);
  const halfDepthM = ((box.north - box.south) / 2) * 110_540;
  const maxSafeRadius = Math.max(10, Math.min(halfWidthM, halfDepthM) * 0.9);
  const minClearanceRadius = Math.min(maxSafeRadius * 0.85, ESTIMATED_FOOTPRINT_M * 0.65);

  const minAlt = Math.max(box.minAltitude + 5, 8);
  const maxAlt = Math.max(minAlt + 5, box.maxAltitude - 2);
  const targetPoint = {
    longitude: building.longitude,
    latitude: building.latitude,
    altitude: Math.min(bHeight * 0.6, maxAlt),
  };

  const rawPoints: { longitude: number; latitude: number; altitude: number }[] = [];

  switch (pattern) {
    case "helix": {
      const totalSteps = turns * pointsPerTurn;
      for (let i = 0; i <= totalSteps; i++) {
        const t = i / totalSteps;
        const angle = t * turns * Math.PI * 2;
        const east = Math.cos(angle) * maxSafeRadius;
        const north = Math.sin(angle) * maxSafeRadius;
        const alt = minAlt + t * (maxAlt - minAlt);
        rawPoints.push(enuToGeodetic(centerLon, centerLat, east, north, alt));
      }
      break;
    }

    case "sphere": {
      // Elevation angles from 15 deg (low oblique) up to 82 deg (near zenith)
      const rings = Math.max(3, turns + 1);
      const minElev = CesiumMath.toRadians(15);
      const maxElev = CesiumMath.toRadians(82);
      const sphereRadius = Math.min(maxSafeRadius, maxAlt - minAlt);

      for (let r = 0; r < rings; r++) {
        const elev = minElev + (r / (rings - 1)) * (maxElev - minElev);
        const ringRadius = Math.cos(elev) * sphereRadius;
        const alt = minAlt + Math.sin(elev) * (maxAlt - minAlt);

        for (let p = 0; p < pointsPerTurn; p++) {
          const az = (p / pointsPerTurn) * Math.PI * 2;
          const east = Math.cos(az) * ringRadius;
          const north = Math.sin(az) * ringRadius;
          rawPoints.push(enuToGeodetic(centerLon, centerLat, east, north, alt));
        }
      }
      break;
    }

    case "box_perimeter": {
      const tiers = Math.max(2, turns);
      const insetLon = (box.east - box.west) * 0.08;
      const insetLat = (box.north - box.south) * 0.08;
      const corners = [
        [box.west + insetLon, box.south + insetLat],
        [box.east - insetLon, box.south + insetLat],
        [box.east - insetLon, box.north - insetLat],
        [box.west + insetLon, box.north - insetLat],
      ];

      for (let tier = 0; tier < tiers; tier++) {
        const alt = minAlt + (tier / Math.max(1, tiers - 1)) * (maxAlt - minAlt);
        for (let c = 0; c <= corners.length; c++) {
          const [lon, lat] = corners[c % corners.length];
          rawPoints.push({ longitude: lon, latitude: lat, altitude: alt });
        }
      }
      break;
    }

    case "orbit": {
      const orbitAlt = Math.min(maxAlt, Math.max(minAlt, bHeight * 0.85));
      const steps = pointsPerTurn * 2;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const east = Math.cos(angle) * maxSafeRadius;
        const north = Math.sin(angle) * maxSafeRadius;
        rawPoints.push(enuToGeodetic(centerLon, centerLat, east, north, orbitAlt));
      }
      break;
    }

    case "grid": {
      const passes = Math.max(4, turns * 2);
      const gridAlt = maxAlt;
      const spanE = halfWidthM * 0.85;
      const spanN = halfDepthM * 0.85;

      for (let i = 0; i < passes; i++) {
        const frac = passes === 1 ? 0 : -1 + (2 * i) / (passes - 1);
        const east = frac * spanE;
        const northStart = i % 2 === 0 ? -spanN : spanN;
        const northEnd = i % 2 === 0 ? spanN : -spanN;
        rawPoints.push(enuToGeodetic(centerLon, centerLat, east, northStart, gridAlt));
        rawPoints.push(enuToGeodetic(centerLon, centerLat, east, northEnd, gridAlt));
      }
      break;
    }

    case "facade_scan": {
      // 4 faces around the building perimeter with vertical zig-zags
      const faces: [number, number, number, number][] = [
        [-maxSafeRadius, -maxSafeRadius, maxSafeRadius, -maxSafeRadius], // South face
        [maxSafeRadius, -maxSafeRadius, maxSafeRadius, maxSafeRadius], // East face
        [maxSafeRadius, maxSafeRadius, -maxSafeRadius, maxSafeRadius], // North face
        [-maxSafeRadius, maxSafeRadius, -maxSafeRadius, -maxSafeRadius], // West face
      ];
      const verticalCols = 3;
      for (const [e1, n1, e2, n2] of faces) {
        for (let c = 0; c < verticalCols; c++) {
          const frac = c / (verticalCols - 1);
          const east = e1 + (e2 - e1) * frac;
          const north = n1 + (n2 - n1) * frac;
          const goingUp = c % 2 === 0;
          rawPoints.push(
            enuToGeodetic(centerLon, centerLat, east, north, goingUp ? minAlt : maxAlt),
          );
          rawPoints.push(
            enuToGeodetic(centerLon, centerLat, east, north, goingUp ? maxAlt : minAlt),
          );
        }
      }
      break;
    }
  }

  return rawPoints.map((pt, index) => {
    const clamped = clampToBox(pt.longitude, pt.latitude, pt.altitude, box);
    const { heading, pitch } = computeGimbalAngles(clamped, targetPoint);
    return {
      index,
      ...clamped,
      heading,
      pitch,
    };
  });
}
