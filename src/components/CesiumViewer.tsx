import {
  Cartesian3,
  IonResource,
  ImageryLayer,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  Terrain,
} from "cesium";
import { CameraFlyTo, Cesium3DTileset, Viewer } from "resium";

// Created once so Resium doesn't see new instances on every render.
const osmLayer = new ImageryLayer(
  new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
);
// Buildings are placed at real ground elevation, so they need terrain to sit on.
const worldTerrain = Terrain.fromWorldTerrain();
const osmBuildingsUrl = IonResource.fromAssetId(96188); // Cesium OSM Buildings

export default function CesiumViewer() {
  return (
    <Viewer
      full
      baseLayer={osmLayer}
      terrain={worldTerrain}
      baseLayerPicker={false}
      geocoder={false} // requires ion
      timeline={false}
      animation={false}
    >
      <Cesium3DTileset url={osmBuildingsUrl} />
      {/* Oblique view looking north over downtown Corvallis, Oregon */}
      <CameraFlyTo
        destination={Cartesian3.fromDegrees(-123.262, 44.554, 600)}
        orientation={{ heading: 0, pitch: CesiumMath.toRadians(-30), roll: 0 }}
        once
      />
    </Viewer>
  );
}
