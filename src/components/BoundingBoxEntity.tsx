import { Cartesian3, Color, HeightReference, PolygonHierarchy } from "cesium";
import { useMemo } from "react";
import { Entity } from "resium";
import { type BoundingBox, boxCorners, type ZoneKind } from "../boundingBox.ts";

/** Fill and outline colors per zone kind. Flight zones are green, no-flight zones red. */
export const zoneColors: Record<ZoneKind, { fill: Color; outline: Color }> = {
  flight: { fill: Color.LIME.withAlpha(0.2), outline: Color.LIME },
  noFlight: { fill: Color.RED.withAlpha(0.3), outline: Color.RED },
};

const defaultNames: Record<ZoneKind, string> = {
  flight: "Flight zone",
  noFlight: "No-flight zone",
};

type Props = {
  box: BoundingBox;
  kind?: ZoneKind;
  name?: string;
};

/**
 * Draws a flight zone or no-flight zone as a translucent volume on the globe. The box can be
 * rotated, so it's drawn as an extruded polygon through its four corners.
 *
 * Only pass a box that has passed `validateBoundingBox`. Out-of-range bounds can break Cesium's
 * rendering.
 *
 * Both heights are RELATIVE_TO_GROUND to match the box's AGL altitudes. Cesium offsets the whole
 * volume by the terrain height at its center, so over sloped terrain the drawn box is
 * approximate. The containment checks in `boundingBox.ts` are exact.
 */
export default function BoundingBoxEntity({ box, kind = "flight", name }: Props) {
  const hierarchy = useMemo(
    () =>
      new PolygonHierarchy(
        boxCorners(box).map((corner) => Cartesian3.fromDegrees(corner.longitude, corner.latitude)),
      ),
    [box],
  );
  const colors = zoneColors[kind];

  return (
    <Entity
      name={name ?? defaultNames[kind]}
      polygon={{
        hierarchy,
        height: box.minAltitude,
        extrudedHeight: box.maxAltitude,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
        material: colors.fill,
        outline: true,
        outlineColor: colors.outline,
      }}
    />
  );
}
