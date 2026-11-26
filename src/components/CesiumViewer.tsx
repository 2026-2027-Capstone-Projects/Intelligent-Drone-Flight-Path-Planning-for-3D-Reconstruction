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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CameraFlyTo,
  Cesium3DTileset,
  type CesiumComponentRef,
  type CesiumMovementEvent,
  type RootEventTarget,
  useCesium,
  Viewer,
} from "resium";
import {
  type BoundingBoxBuffer,
  boundingBoxAroundBuilding,
  DEFAULT_BUFFER,
} from "../boundingBox.ts";
import {
  type FlightPatternType,
  generateFlightPath,
  type Waypoint,
} from "../flightPath.ts";
import BoundingBoxEntity from "./BoundingBoxEntity.tsx";
import BoundingBoxPanel from "./BoundingBoxPanel.tsx";
import BuildingInfoPanel, { type SelectedBuilding } from "./BuildingInfoPanel.tsx";
import DroneFlightLayer from "./DroneFlightLayer.tsx";
import FlightPathPanel from "./FlightPathPanel.tsx";

type CameraPosition = {
  longitude: number;
  latitude: number;
  height: number; // meters AGL
};

const osmLayer = new ImageryLayer(
  new OpenStreetMapImageryProvider({ url: "https://tile.openstreetmap.org/" }),
);
const worldTerrain = Terrain.fromWorldTerrain();
const osmBuildingsUrl = IonResource.fromAssetId(96188);

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
    return () => viewer.camera.changed.removeEventListener(updatePosition);
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
    return () => viewer.camera.changed.removeEventListener(updateOrientation);
  }, [viewer, onChange]);
  return null;
}

function DroneCameraTracker({
  position,
  orientation,
  active,
}: {
  position: { longitude: number; latitude: number; height: number };
  orientation: { heading: number; pitch: number; roll: number };
  active: boolean;
}) {
  const { viewer } = useCesium();

  useEffect(() => {
    if (!viewer || !active) return;

    const carto = Cartographic.fromDegrees(position.longitude, position.latitude);
    const groundHeight = viewer.scene.globe.getHeight(carto) ?? 0;
    const cartesianPos = Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      groundHeight + position.height,
    );

    viewer.camera.setView({
      destination: cartesianPos,
      orientation: {
        heading: CesiumMath.toRadians(orientation.heading),
        pitch: CesiumMath.toRadians(orientation.pitch),
        roll: CesiumMath.toRadians(orientation.roll),
      },
    });
  }, [viewer, position, orientation, active]);

  return null;
}

export default function CesiumViewer() {
  const viewerRef = useRef<CesiumComponentRef<CesiumViewerInstance>>(null);
  const [selected, setSelected] = useState<SelectedBuilding | null>(null);
  const [buffer, setBuffer] = useState<BoundingBoxBuffer>(DEFAULT_BUFFER);

  const [cameraPosition, setCameraPosition] = useState<CameraPosition | null>(null);
  const [cameraOrientation, setCameraOrientation] = useState({
    heading: 0,
    pitch: -30,
    roll: 0,
  });

  const [pattern, setPattern] = useState<FlightPatternType>("helix");
  const [turns, setTurns] = useState<number>(3);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speedMps, setSpeedMps] = useState<number>(8);
  const [progress, setProgress] = useState<number>(0);
  const [isFpvMode, setIsFpvMode] = useState<boolean>(false);

  const [dronePosition, setDronePosition] = useState<CameraPosition>({
    longitude: -123.27185,
    latitude: 44.56437,
    height: 100,
  });

  const [droneOrientation, setDroneOrientation] = useState({
    heading: 0,
    pitch: -45,
    roll: 0,
  });

  useEffect(() => {
    const buildingHeight = selected?.height ?? 15;
    const heightFactor = Math.max(1, buildingHeight / 15);

    let baseH = 30;
    let baseV = 15;

    switch (pattern) {
      case "sphere":
        baseH = 45;
        baseV = 20;
        break;
      case "box_perimeter":
        baseH = 40;
        baseV = 15;
        break;
      case "grid":
        baseH = 35;
        baseV = 25;
        break;
      case "facade_scan":
        baseH = 35;
        baseV = 15;
        break;
      case "helix":
      case "orbit":
      default:
        baseH = 30;
        baseV = 12;
        break;
    }

    setBuffer({
      horizontal: Math.round(baseH * Math.min(heightFactor, 1.5)),
      vertical: Math.round(baseV * Math.min(heightFactor, 1.4)),
    });
  }, [selected?.elementId, selected?.height, pattern]);

  const handleClick = useCallback(
    (movement: CesiumMovementEvent, pickedTarget: RootEventTarget) => {
      const scene = viewerRef.current?.cesiumElement?.scene;
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
      if (latitude === undefined || longitude === undefined) {
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
      setProgress(0);
    },
    [],
  );

  const boundingBoxResult = useMemo(
    () => (selected ? boundingBoxAroundBuilding(selected, buffer) : null),
    [selected, buffer],
  );
  const boundingBox = boundingBoxResult?.box ?? null;

  const waypoints = useMemo(() => {
    if (!selected || !boundingBox) return [];
    return generateFlightPath(pattern, selected, boundingBox, { turns });
  }, [selected, boundingBox, pattern, turns]);

  const handleDroneTelemetry = useCallback((wp: Waypoint) => {
    setDronePosition({
      longitude: wp.longitude,
      latitude: wp.latitude,
      height: wp.altitude,
    });
    setDroneOrientation({
      heading: wp.heading,
      pitch: wp.pitch,
      roll: 0,
    });
  }, []);

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
        geocoder={false}
        timeline={false}
        animation={false}
        infoBox={false}
        selectionIndicator={false}
        onClick={handleClick}
      >
        <CameraPositionTracker onChange={setCameraPosition} />
        <CameraOrientationTracker onChange={setCameraOrientation} />

        <Cesium3DTileset url={osmBuildingsUrl} style={tilesetStyle} />
        {boundingBox && <BoundingBoxEntity box={boundingBox} />}

        {selected && waypoints.length > 0 && (
          <DroneFlightLayer
            waypoints={waypoints}
            targetBuilding={selected}
            isPlaying={isPlaying}
            speedMps={speedMps}
            progress={progress}
            onProgressChange={setProgress}
            onDroneTelemetry={handleDroneTelemetry}
          />
        )}

        {isFpvMode && (
          <DroneCameraTracker
            position={dronePosition}
            orientation={droneOrientation}
            active={isFpvMode}
          />
        )}

        {!isFpvMode && (
          <CameraFlyTo
            destination={Cartesian3.fromDegrees(-123.262, 44.554, 600)}
            orientation={{ heading: 0, pitch: CesiumMath.toRadians(-30), roll: 0 }}
            once
          />
        )}
      </Viewer>

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
          <div>Height (AGL): {cameraPosition.height.toFixed(2)} m</div>
          <br />
          <strong>Camera Orientation</strong>
          <div>Heading: {cameraOrientation.heading.toFixed(3)}°</div>
          <div>Pitch: {cameraOrientation.pitch.toFixed(3)}°</div>
          <div>Roll: {cameraOrientation.roll.toFixed(3)}°</div>
          <br />
          <strong>Drone Telemetry</strong>
          <div>Longitude: {dronePosition.longitude.toFixed(6)}°</div>
          <div>Latitude: {dronePosition.latitude.toFixed(6)}°</div>
          <div>Height (AGL): {dronePosition.height.toFixed(2)} m</div>
          <div>Heading: {droneOrientation.heading.toFixed(3)}°</div>
          <div>Pitch: {droneOrientation.pitch.toFixed(3)}°</div>
          <div>Roll: {droneOrientation.roll.toFixed(3)}°</div>
        </div>
      )}

      {selected && <BuildingInfoPanel building={selected} onClose={() => setSelected(null)} />}

      {/* Bottom-Left Corner: Operating Volume Panel */}
      {selected && (
        <BoundingBoxPanel
          buffer={buffer}
          onBufferChange={setBuffer}
          box={boundingBox}
          messages={boundingBoxResult?.messages ?? []}
        />
      )}

      {/* Bottom-Right Corner: Flight Mission Panel */}
      {selected && (
        <FlightPathPanel
          pattern={pattern}
          onPatternChange={(next) => {
            setPattern(next);
            setProgress(0);
          }}
          turns={turns}
          onTurnsChange={setTurns}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          speedMps={speedMps}
          onSpeedChange={setSpeedMps}
          progress={progress}
          onProgressChange={setProgress}
          waypoints={waypoints}
          isFpvMode={isFpvMode}
          onToggleFpv={() => setIsFpvMode((prev) => !prev)}
        />
      )}
    </>
  );
}
