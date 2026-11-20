import { Color, HeightReference } from "cesium";
import { useMemo } from "react";
import { Entity } from "resium";
import { type BoundingBox, toRectangle, type ZoneKind } from "../boundingBox.ts";

/** Fill and outline colors per zone kind. Flight zones are green, no-flight zones red. */
const zoneColors: Record<ZoneKind, { fill: Color; outline: Color }> = {
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
 * Draws a flight zone or no-flight zone as a translucent volume on the globe. The operating
 * bounding box around the selected building is drawn as a flight zone.
 *
 * Only pass a box that has passed `validateBoundingBox`. Out-of-range bounds can break Cesium's
 * rendering.
 *
 * Both heights are RELATIVE_TO_GROUND to match the box's AGL altitudes. Cesium offsets a
 * RELATIVE_TO_GROUND rectangle by the terrain height at its center, so over sloped terrain the
 * drawn box is approximate. The containment checks in `boundingBox.ts` are exact.
 */
export default function BoundingBoxEntity({ box, kind = "flight", name }: Props) {
  const coordinates = useMemo(() => toRectangle(box), [box]);
  const colors = zoneColors[kind];

  return (
    <Entity
      name={name ?? defaultNames[kind]}
      rectangle={{
        coordinates,
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
