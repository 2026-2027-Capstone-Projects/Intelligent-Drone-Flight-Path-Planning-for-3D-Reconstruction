import { Cartesian3, ImageryLayer, OpenStreetMapImageryProvider } from "cesium";
import { CameraFlyTo, Viewer } from "resium";

const osmLayer = new ImageryLayer(
  new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
);

export default function CesiumViewer() {
  return (
    <Viewer
      full
      baseLayer={osmLayer}
      baseLayerPicker={false}
      geocoder={false}
      timeline={false}
      animation={false}
    >

      <CameraFlyTo destination={Cartesian3.fromDegrees(-123.262, 44.5646, 3000)} once />
    </Viewer>
  );
}
