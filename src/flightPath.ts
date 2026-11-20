import {
  Math as CesiumMath,
} from "cesium";
import {
  type BoundingBox,
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
  pitch: number; // degrees (pointing at building center)
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
    description: "Corkscrew ascent around building with active POI gimbal tracking.",
  },
  {
    id: "sphere",
    label: "Spherical Dome",
    description: "Hemispherical arc scan over structure.",
  },
  {
    id: "box_perimeter",
    label: "Bounding Box Perimeter",
    description: "Multi-tier rectangular loop along outer safety boundary.",
  },
  {
    id: "orbit",
    label: "Circular Orbit (POI)",
    description: "Constant-altitude 360° orbit looking at building center.",
  },
  {
    id: "grid",
    label: "Roof Grid (Lawnmower)",
    description: "Parallel sweep lines looking down at roof.",
  },
  {
    id: "facade_scan",
    label: "Vertical Facade Zig-Zag",
    description: "Vertical wall scans looking directly at facades.",
  },
];

function clampToBox(
  lon: number,
  lat: number,
  alt: number,
  box: BoundingBox,
): { longitude: number; latitude: number; altitude: number } {
  const eps = 1e-6;
  return {
    longitude: Math.min(box.east - eps, Math.max(box.west + eps, lon)),
    latitude: Math.min(box.north - eps, Math.max(box.south + eps, lat)),
    altitude: Math.min(box.maxAltitude, Math.max(box.minAltitude, alt)),
  };
}

function avoidBuildingObstacle(
  wp: { longitude: number; latitude: number; altitude: number },
  building: { longitude: number; latitude: number },
  minRadiusMeters: number,
): { longitude: number; latitude: number; altitude: number } {
  const latRad = CesiumMath.toRadians(building.latitude);
  const cosLat = Math.cos(latRad);
  if (Math.abs(cosLat) < 1e-6) return wp;

  const dx = (wp.longitude - building.longitude) * 111_320 * cosLat;
  const dy = (wp.latitude - building.latitude) * 110_540;
  const dist = Math.hypot(dx, dy);

  if (dist < minRadiusMeters && dist > 0) {
    const scale = minRadiusMeters / dist;
    const newLon = building.longitude + (dx * scale) / (111_320 * cosLat);
    const newLat = building.latitude + (dy * scale) / 110_540;
    return { longitude: newLon, latitude: newLat, altitude: wp.altitude };
  }

  return wp;
}

/** Computes accurate heading and pitch so the drone camera is always aimed at the target building */
function computeGimbalAngles(
  wp: { longitude: number; latitude: number; altitude: number },
  target: { longitude: number; latitude: number; altitude: number },
): { heading: number; pitch: number } {
  const latRad = CesiumMath.toRadians(target.latitude);
  const cosLat = Math.cos(latRad);
  const dx = (target.longitude - wp.longitude) * 111_320 * cosLat;
  const dy = (target.latitude - wp.latitude) * 110_540;
  const dz = target.altitude - wp.altitude;

  // Heading from North (clockwise)
  const heading = CesiumMath.toDegrees(Math.atan2(dx, dy));
  
  // Pitch angle relative to horizontal plane
  const horizontalDist = Math.hypot(dx, dy);
  const pitch = CesiumMath.toDegrees(Math.atan2(dz, horizontalDist));

  return { 
    heading: (heading + 360) % 360, 
    pitch: Math.max(-85, Math.min(85, pitch)) // Clamp pitch to safe gimbal bounds
  };
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

  const latRad = CesiumMath.toRadians(building.latitude);
  const cosLat = Math.cos(latRad);
  const halfWidthM = ((box.east - box.west) / 2) * 111_320 * cosLat;
  const halfDepthM = ((box.north - box.south) / 2) * 110_540;

  const boxSpan = Math.min(halfWidthM, halfDepthM);
  const exclusionRadius = Math.max(15, boxSpan * 0.4);
  const operationalRadius = Math.max(exclusionRadius + 5, boxSpan * 0.8);

  const minAlt = Math.max(box.minAltitude + 3, 5);
  const maxAlt = Math.max(minAlt + 5, box.maxAltitude - 2);
  
  // Target point is set to the middle height of the building
  const targetPoint = {
    longitude: building.longitude,
    latitude: building.latitude,
    altitude: Math.min(bHeight * 0.5, maxAlt * 0.8),
  };

  const rawPoints: { longitude: number; latitude: number; altitude: number }[] = [];

  switch (pattern) {
    case "helix": {
      const totalSteps = turns * pointsPerTurn;
      for (let i = 0; i <= totalSteps; i++) {
        const t = i / totalSteps;
        const angle = t * turns * Math.PI * 2;
        const east = Math.cos(angle) * operationalRadius;
        const north = Math.sin(angle) * operationalRadius;
        const alt = minAlt + t * (maxAlt - minAlt);
        
        const lon = building.longitude + east / (111_320 * cosLat);
        const lat = building.latitude + north / 110_540;
        rawPoints.push({ longitude: lon, latitude: lat, altitude: alt });
      }
      break;
    }

    case "sphere": {
      const rings = Math.max(3, turns + 1);
      const minElev = CesiumMath.toRadians(15);
      const maxElev = CesiumMath.toRadians(82);
      const sphereRadius = Math.min(operationalRadius, maxAlt - minAlt);

      for (let r = 0; r < rings; r++) {
        const elev = minElev + (r / (rings - 1)) * (maxElev - minElev);
        const ringRadius = Math.max(exclusionRadius, Math.cos(elev) * sphereRadius);
        const alt = minAlt + Math.sin(elev) * (maxAlt - minAlt);

        for (let p = 0; p < pointsPerTurn; p++) {
          const az = (p / pointsPerTurn) * Math.PI * 2;
          const east = Math.cos(az) * ringRadius;
          const north = Math.sin(az) * ringRadius;
          const lon = building.longitude + east / (111_320 * cosLat);
          const lat = building.latitude + north / 110_540;
          rawPoints.push({ longitude: lon, latitude: lat, altitude: alt });
        }
      }
      break;
    }

    case "box_perimeter": {
      const tiers = Math.max(2, turns);
      const insetLon = (box.east - box.west) * 0.1;
      const insetLat = (box.north - box.south) * 0.1;
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
        const east = Math.cos(angle) * operationalRadius;
        const north = Math.sin(angle) * operationalRadius;
        const lon = building.longitude + east / (111_320 * cosLat);
        const lat = building.latitude + north / 110_540;
        rawPoints.push({ longitude: lon, latitude: lat, altitude: orbitAlt });
      }
      break;
    }

    case "grid": {
      const passes = Math.max(4, turns * 2);
      const gridAlt = maxAlt;
      const spanE = halfWidthM * 0.75;
      const spanN = halfDepthM * 0.75;

      for (let i = 0; i < passes; i++) {
        const frac = passes === 1 ? 0 : -1 + (2 * i) / (passes - 1);
        const east = frac * spanE;
        const northStart = i % 2 === 0 ? -spanN : spanN;
        const northEnd = i % 2 === 0 ? spanN : -spanN;

        const lonStart = building.longitude + east / (111_320 * cosLat);
        rawPoints.push({
          longitude: lonStart,
          latitude: building.latitude + northStart / 110_540,
          altitude: gridAlt,
        });
        rawPoints.push({
          longitude: lonStart,
          latitude: building.latitude + northEnd / 110_540,
          altitude: gridAlt,
        });
      }
      break;
    }

    case "facade_scan": {
      const scanRadius = Math.max(exclusionRadius, operationalRadius * 0.75);
      const faces: [number, number, number, number][] = [
        [-scanRadius, -scanRadius, scanRadius, -scanRadius],
        [scanRadius, -scanRadius, scanRadius, scanRadius],
        [scanRadius, scanRadius, -scanRadius, scanRadius],
        [-scanRadius, scanRadius, -scanRadius, -scanRadius],
      ];
      const verticalCols = 3;
      for (const [e1, n1, e2, n2] of faces) {
        for (let c = 0; c < verticalCols; c++) {
          const frac = c / (verticalCols - 1);
          const east = e1 + (e2 - e1) * frac;
          const north = n1 + (n2 - n1) * frac;
          const goingUp = c % 2 === 0;

          const lon = building.longitude + east / (111_320 * cosLat);
          const lat = building.latitude + north / 110_540;
          rawPoints.push({ longitude: lon, latitude: lat, altitude: goingUp ? minAlt : maxAlt });
          rawPoints.push({ longitude: lon, latitude: lat, altitude: goingUp ? maxAlt : minAlt });
        }
      }
      break;
    }
  }

  if (rawPoints.length === 0) return [];

  const clearedPoints = rawPoints.map((pt) =>
    avoidBuildingObstacle(pt, building, exclusionRadius),
  );

  const firstPt = clearedPoints[0];
  const takeoffPoint = {
    longitude: firstPt.longitude,
    latitude: firstPt.latitude,
    altitude: box.minAltitude,
  };

  const lastPt = clearedPoints[clearedPoints.length - 1];
  const landingPoint = {
    longitude: lastPt.longitude,
    latitude: lastPt.latitude,
    altitude: box.minAltitude,
  };

  const fullMission = [takeoffPoint, ...clearedPoints, landingPoint];

  return fullMission.map((pt, index) => {
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
