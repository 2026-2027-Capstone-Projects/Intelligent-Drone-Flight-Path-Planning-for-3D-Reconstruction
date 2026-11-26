import {
  Cartesian3,
  Cartographic,
  Cesium3DTileFeature,
  Cesium3DTileStyle,
  Math as CesiumMath,
  type Viewer as CesiumViewerInstance,
  Color,
  ImageryLayer,
  IonResource,
  OpenStreetMapImageryProvider,
  Terrain,
} from "cesium";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CameraFlyTo,
  Cesium3DTileset,
  type CesiumComponentRef,
  type CesiumMovementEvent,
  Entity,
  type RootEventTarget,
  useCesium,
  Viewer,
} from "resium";
import {
  type FlightZones,
  type GroundPoint,
  workableGroundArea,
  type Zone,
  type ZoneKind,
  type ZoneSpec,
  zoneFromSpec,
  zoneSpecFromCorners,
  zoneWarnings,
} from "../boundingBox.ts";
import BoundingBoxEntity from "./BoundingBoxEntity.tsx";
import BoundingBoxPanel from "./BoundingBoxPanel.tsx";
import BuildingInfoPanel, { type SelectedBuilding } from "./BuildingInfoPanel.tsx";
import ZoneDrawTool from "./ZoneDrawTool.tsx";

type CameraPosition = {
  longitude: number;
  latitude: number;
  height: number;
};

// Created once so Resium doesn't see new instances on every render.
const osmLayer = new ImageryLayer(
  new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
);
// Buildings are placed at real ground elevation, so they need terrain to sit on.
const worldTerrain = Terrain.fromWorldTerrain();
const osmBuildingsUrl = IonResource.fromAssetId(96188); // Cesium OSM Buildings

function CameraPositionTracker({ onChange }: { onChange: (position: CameraPosition) => void }) {
  const { viewer } = useCesium();

  useEffect(() => {
    if (!viewer) return;

    const updatePosition = () => {
      const position = viewer.camera.positionCartographic;
      const terrainHeight = viewer.scene.globe.getHeight(position);

      onChange({
        longitude: CesiumMath.toDegrees(position.longitude),
        latitude: CesiumMath.toDegrees(position.latitude),
        height: terrainHeight !== undefined ? position.height - terrainHeight : position.height,
      });
    };

    viewer.camera.changed.addEventListener(updatePosition);
    updatePosition();

    return () => {
      viewer.camera.changed.removeEventListener(updatePosition);
    };
  }, [viewer, onChange]);

  return null;
}

function CameraOrientationTracker({
  onChange,
}: {
  onChange: (orientation: { heading: number; pitch: number; roll: number }) => void;
}) {
  const { viewer } = useCesium();

  useEffect(() => {
    if (!viewer) return;

    const updateOrientation = () => {
      const camera = viewer.camera;

      onChange({
        heading: CesiumMath.toDegrees(camera.heading),
        pitch: CesiumMath.toDegrees(camera.pitch),
        roll: CesiumMath.toDegrees(camera.roll),
      });
    };

    viewer.camera.changed.addEventListener(updateOrientation);
    updateOrientation();

    return () => {
      viewer.camera.changed.removeEventListener(updateOrientation);
    };
  }, [viewer, onChange]);

  return null;
}

function calculateDroneOrientation(drone: CameraPosition, target: CameraPosition) {
  const dx = target.longitude - drone.longitude;
  const dy = target.latitude - drone.latitude;
  const dz = target.height - drone.height;

  const heading = Math.atan2(dx, dy);

  const horizontalDistance = Math.sqrt(dx * dx + dy * dy);

  const pitch = Math.atan2(dz, horizontalDistance);

  return {
    heading: CesiumMath.toDegrees(heading),
    pitch: CesiumMath.toDegrees(pitch),
    roll: 0,
  };
}

export default function CesiumViewer() {
  const viewerRef = useRef<CesiumComponentRef<CesiumViewerInstance>>(null);
  const [selected, setSelected] = useState<SelectedBuilding | null>(null);
  // Flight zones and no-flight zones drawn by the user. They don't depend on the selected
  // building, so they stay in place when the selection changes.
  const [zones, setZones] = useState<Zone[]>([]);
  const nextZoneId = useRef(1);
  // The kind of zone being drawn with the mouse, or null when draw mode is off.
  const [drawKind, setDrawKind] = useState<ZoneKind | null>(null);
  // Why the last drawing attempt didn't create a zone (e.g. the drag ended on the sky).
  const [drawMessages, setDrawMessages] = useState<string[]>([]);
  // Camera Position
  const [cameraPosition, setCameraPosition] = useState<CameraPosition | null>(null);
  // Camera Orientation
  const [cameraOrientation, setCameraOrientation] = useState({
    heading: 0,
    pitch: -30,
    roll: 0,
  });

  const [dronePosition, _setDronePosition] = useState<CameraPosition>({
    longitude: -123.27185,
    latitude: 44.56437,
    height: 100,
  });

  const [droneOrientation, setDroneOrientation] = useState({
    heading: 0,
    pitch: -45,
    roll: 0,
  });
  /*
  const orientation = {
    heading: CesiumMath.toRadians(cameraOrientation.heading),
    pitch: CesiumMath.toRadians(cameraOrientation.pitch),
    roll: CesiumMath.toRadians(cameraOrientation.roll),
  };*/

  const handleClick = useCallback(
    (movement: CesiumMovementEvent, pickedTarget: RootEventTarget) => {
      const scene = viewerRef.current?.cesiumElement?.scene;
      // Resium passes only the frontmost pick, which may be the translucent bounding box.
      // Look underneath it so buildings inside the box stay clickable.
      const target =
        pickedTarget instanceof Cesium3DTileFeature
          ? pickedTarget
          : movement.position &&
            scene
              ?.drillPick(movement.position)
              .find(
                (picked): picked is Cesium3DTileFeature => picked instanceof Cesium3DTileFeature,
              );
      if (!(target instanceof Cesium3DTileFeature)) {
        setSelected(null);
        return;
      }

      let latitude: number | undefined = target.getProperty("cesium#latitude");
      let longitude: number | undefined = target.getProperty("cesium#longitude");
      // OSM Buildings carries a centroid per feature; fall back to the clicked surface point.
      if (latitude === undefined || longitude === undefined) {
        const position = movement.position && scene?.pickPosition(movement.position);
        if (!position) return;
        const cartographic = Cartographic.fromCartesian(position);
        latitude = CesiumMath.toDegrees(cartographic.latitude);
        longitude = CesiumMath.toDegrees(cartographic.longitude);
      }

      const building = {
        elementId: target.getProperty("elementId"),
        name: target.getProperty("name"),
        latitude,
        longitude,
        height: target.getProperty("cesium#estimatedHeight"),
      };

      setSelected(building);

      setDroneOrientation(
        calculateDroneOrientation(dronePosition, {
          longitude: building.longitude,
          latitude: building.latitude,
          height: building.height ?? 0,
        }),
      );
    },
    [dronePosition],
  );

  const startDrawing = useCallback((kind: ZoneKind) => {
    setDrawMessages([]);
    setDrawKind(kind);
  }, []);
  const cancelDrawing = useCallback((message?: string) => {
    setDrawKind(null);
    setDrawMessages(message ? [message] : []);
  }, []);
  // Each drag creates at most one zone, then draw mode ends. The zone is turned to the camera
  // heading the drag started with, so it lines up with the drag on screen.
  const finishDrawing = useCallback(
    (kind: ZoneKind, start: GroundPoint, end: GroundPoint, heading: number) => {
      setDrawKind(null);
      const { spec, messages } = zoneSpecFromCorners(kind, start, end, heading);
      setDrawMessages(messages);
      if (!spec) {
        console.warn("Drawn zone rejected.", messages);
        return;
      }
      const id = `zone-${nextZoneId.current++}`;
      setZones((prev) => [...prev, { id, kind, spec }]);
    },
    [],
  );
  const updateZone = useCallback((id: string, spec: ZoneSpec) => {
    setZones((prev) => prev.map((zone) => (zone.id === id ? { ...zone, spec } : zone)));
  }, []);
  const removeZone = useCallback((id: string) => {
    setZones((prev) => prev.filter((zone) => zone.id !== id));
  }, []);

  // Only valid specs are stored (the editor rejects the rest), so every `box` here is non-null.
  const zoneBoxes = useMemo(
    () => zones.map((zone) => ({ ...zone, box: zoneFromSpec(zone.spec).box })),
    [zones],
  );
  const flightZones = useMemo<FlightZones>(() => {
    const boxesOf = (kind: ZoneKind) =>
      zoneBoxes.flatMap((zone) => (zone.kind === kind && zone.box ? [zone.box] : []));
    return { flight: boxesOf("flight"), noFlight: boxesOf("noFlight") };
  }, [zoneBoxes]);
  const workableArea = useMemo(() => workableGroundArea(flightZones), [flightZones]);
  const zoneMessages = useMemo(
    () => zoneWarnings(flightZones, workableArea),
    [flightZones, workableArea],
  );

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
        <CameraPositionTracker onChange={setCameraPosition} />
        <CameraOrientationTracker onChange={setCameraOrientation} />
        {selected && (
          <Entity
            polyline={{
              positions: [
                Cartesian3.fromDegrees(
                  dronePosition.longitude,
                  dronePosition.latitude,
                  dronePosition.height,
                ),
                Cartesian3.fromDegrees(selected.longitude, selected.latitude, 50),
              ],
              width: 3,
              material: Color.LIME,
            }}
          />
        )}

        <Cesium3DTileset url={osmBuildingsUrl} style={tilesetStyle} />
        {zoneBoxes.map(
          (zone) => zone.box && <BoundingBoxEntity key={zone.id} box={zone.box} kind={zone.kind} />,
        )}
        <ZoneDrawTool kind={drawKind} onComplete={finishDrawing} onCancel={cancelDrawing} />
        {/* Oblique view looking north over downtown Corvallis, Oregon */}
        <CameraFlyTo
          destination={Cartesian3.fromDegrees(-123.262, 44.554, 600)}
          orientation={{ heading: 0, pitch: CesiumMath.toRadians(-30), roll: 0 }}
          once
        />
      </Viewer>

      {/* The camera position panel on the top right of the Cesium Viewer */}
      {cameraPosition && (
        <div
          style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            zIndex: 1000,
            padding: "12px 16px",
            background: "rgba(20, 25, 35, 0.9)",
            color: "white",
            borderRadius: "8px",
            fontFamily: "monospace",
          }}
        >
          <strong>Camera Position</strong>
          <div>Longitude: {cameraPosition.longitude.toFixed(6)}°</div>
          <div>Latitude: {cameraPosition.latitude.toFixed(6)}°</div>
          <div>Height: {cameraPosition.height.toFixed(2)} m</div>
          <br></br>
          <strong>Camera Orientation</strong>
          <div>Heading: {cameraOrientation.heading.toFixed(3)}°</div>
          <div>Pitch: {cameraOrientation.pitch.toFixed(3)}°</div>
          <div>Roll: {cameraOrientation.roll.toFixed(3)}°</div>
          <br />
          <strong>Drone Camera</strong>
          <div>Longitude: {dronePosition.longitude.toFixed(6)}°</div>
          <div>Latitude: {dronePosition.latitude.toFixed(6)}°</div>
          <div>Height: {dronePosition.height.toFixed(2)} m</div>
          <div>Heading: {droneOrientation.heading.toFixed(3)}°</div>
          <div>Pitch: {droneOrientation.pitch.toFixed(3)}°</div>
          <div>Roll: {droneOrientation.roll.toFixed(3)}°</div>
        </div>
      )}

      {selected && <BuildingInfoPanel building={selected} onClose={() => setSelected(null)} />}
      <BoundingBoxPanel
        zones={zones}
        drawingKind={drawKind}
        onStartDrawing={startDrawing}
        onCancelDrawing={cancelDrawing}
        drawMessages={drawMessages}
        onUpdateZone={updateZone}
        onRemoveZone={removeZone}
        workableArea={workableArea}
        zoneMessages={zoneMessages}
      />
    </>
  );
}
