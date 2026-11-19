import { useEffect, useState } from "react";
import { Entity, useCesium } from "resium";
import { Cartographic, Color } from "cesium";
import { type BoundingBox, toRectangle } from "../boundingBox.ts";

export default function BoundingBoxEntity({ box }: { box: BoundingBox }) {
  const { viewer } = useCesium();
  const [terrainHeight, setTerrainHeight] = useState<number>(0);

  useEffect(() => {
    if (!viewer) return;
    const centerLat = (box.south + box.north) / 2;
    const centerLon = (box.west + box.east) / 2;

    const cartographic = Cartographic.fromDegrees(centerLon, centerLat);
    const height = viewer.scene.globe.getHeight(cartographic);
    setTerrainHeight(height !== undefined ? height : 0);
  }, [viewer, box]);

  const rectangle = toRectangle(box);
  const baseHeight = terrainHeight + box.minAltitude;
  const topHeight = terrainHeight + box.maxAltitude;

  return (
    <Entity
      name="Operating Bounding Box"
      rectangle={{
        coordinates: rectangle,
        height: baseHeight,
        extrudedHeight: topHeight,
        material: Color.YELLOW.withAlpha(0.25),
        outline: true,
        outlineColor: Color.YELLOW,
        outlineWidth: 2,
      }}
    />
  );
}
