import { Color, HeightReference } from "cesium";
import { useMemo } from "react";
import { Entity } from "resium";
import { type BoundingBox, toRectangle } from "../boundingBox.ts";

const fillColor = Color.CYAN.withAlpha(0.2);
const outlineColor = Color.CYAN;

/**
 * Draws the operating bounding box as a translucent volume on the globe.
 *
 * Only pass a box that has passed `validateBoundingBox`. Out-of-range bounds can break Cesium's
 * rendering.
 *
 * Both heights are RELATIVE_TO_GROUND to match the box's AGL altitudes. Cesium offsets a
 * RELATIVE_TO_GROUND rectangle by the terrain height at its center, so over sloped terrain the
 * drawn box is approximate. The containment check in `boundingBox.ts` is exact.
 */
export default function BoundingBoxEntity({ box }: { box: BoundingBox }) {
  const coordinates = useMemo(() => toRectangle(box), [box]);

  return (
    <Entity
      name="Operating bounding box"
      rectangle={{
        coordinates,
        height: box.minAltitude,
        extrudedHeight: box.maxAltitude,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
        material: fillColor,
        outline: true,
        outlineColor,
      }}
    />
  );
}
