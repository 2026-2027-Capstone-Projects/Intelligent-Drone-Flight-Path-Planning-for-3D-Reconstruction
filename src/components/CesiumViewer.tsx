import {
  Cartesian3,
  Cartographic,
  Cesium3DTileFeature,
  Cesium3DTileStyle,
  Math as CesiumMath,
  type Viewer as CesiumViewerInstance,
  ImageryLayer,
  IonResource,
  OpenStreetMapImageryProvider,
  Terrain,
} from "cesium";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  CameraFlyTo,
  Cesium3DTileset,
  type CesiumComponentRef,
  type CesiumMovementEvent,
  type RootEventTarget,
  Viewer,
} from "resium";
import BuildingInfoPanel, { type SelectedBuilding } from "./BuildingInfoPanel.tsx";

// Created once so Resium doesn't see new instances on every render.
const osmLayer = new ImageryLayer(
  new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
);
// Buildings are placed at real ground elevation, so they need terrain to sit on.
const worldTerrain = Terrain.fromWorldTerrain();
const osmBuildingsUrl = IonResource.fromAssetId(96188); // Cesium OSM Buildings

export default function CesiumViewer() {
  const viewerRef = useRef<CesiumComponentRef<CesiumViewerInstance>>(null);
  const [selected, setSelected] = useState<SelectedBuilding | null>(null);

  const handleClick = useCallback((movement: CesiumMovementEvent, target: RootEventTarget) => {
    if (!(target instanceof Cesium3DTileFeature)) {
      setSelected(null);
      return;
    }

    let latitude: number | undefined = target.getProperty("cesium#latitude");
    let longitude: number | undefined = target.getProperty("cesium#longitude");
    // OSM Buildings carries a centroid per feature; fall back to the clicked surface point.
    if (latitude === undefined || longitude === undefined) {
      const scene = viewerRef.current?.cesiumElement?.scene;
      const position = movement.position && scene?.pickPosition(movement.position);
      if (!position) return;
      const cartographic = Cartographic.fromCartesian(position);
      latitude = CesiumMath.toDegrees(cartographic.latitude);
      longitude = CesiumMath.toDegrees(cartographic.longitude);
    }

    setSelected({
      elementId: target.getProperty("elementId"),
      name: target.getProperty("name"),
      latitude,
      longitude,
      height: target.getProperty("cesium#estimatedHeight"),
    });
  }, []);

  // Styling by id (rather than setting feature.color) keeps the highlight when tiles reload.
  const selectedId = selected?.elementId;
  const tilesetStyle = useMemo(
    () =>
      selectedId === undefined
        ? undefined
        : new Cesium3DTileStyle({
            color: {
              conditions: [
                [`\${elementId} === ${selectedId}`, "color('yellow')"],
                ["true", "color('white')"],
              ],
            },
          }),
    [selectedId],
  );

  return (
    <>
      <Viewer
        ref={viewerRef}
        full
        baseLayer={osmLayer}
        terrain={worldTerrain}
        baseLayerPicker={false}
        geocoder={false} // requires ion
        timeline={false}
        animation={false}
        infoBox={false} // replaced by BuildingInfoPanel
        selectionIndicator={false}
        onClick={handleClick}
      >
        <Cesium3DTileset url={osmBuildingsUrl} style={tilesetStyle} />
        {/* Oblique view looking north over downtown Corvallis, Oregon */}
        <CameraFlyTo
          destination={Cartesian3.fromDegrees(-123.262, 44.554, 600)}
          orientation={{ heading: 0, pitch: CesiumMath.toRadians(-30), roll: 0 }}
          once
        />
      </Viewer>
      {selected && <BuildingInfoPanel building={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
