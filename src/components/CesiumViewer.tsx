import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";

interface Waypoint {
  id: string;
  lat: number;
  lon: number;
  alt: number;
}

class DroneTrajectoryManager {
  viewer: Cesium.Viewer;
  waypoints: Waypoint[] = [];
  waypointEntities: Cesium.Entity[] = [];
  dropLineEntities: Cesium.Entity[] = [];
  cameraVectorEntities: Cesium.Entity[] = [];
  trajectoryEntity: Cesium.Entity | null = null;
  targetEntity: Cesium.Entity | null = null;
  droneEntity: Cesium.Entity | null = null;

  constructor(cesiumViewer: Cesium.Viewer) {
    this.viewer = cesiumViewer;
    this._initTrajectoryPolyline();
  }

  private _initTrajectoryPolyline() {
    const dynamicPositions = new Cesium.CallbackProperty(() => {
      return this.waypoints.map((wp) =>
        Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      );
    }, false);

    this.trajectoryEntity = this.viewer.entities.add({
      name: "Drone Flight Trajectory",
      polyline: {
        positions: dynamicPositions,
        width: 8,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.CYAN),
      },
    });
  }

  setTarget(cartesian: Cesium.Cartesian3) {
    if (this.targetEntity) {
      this.viewer.entities.remove(this.targetEntity);
    }

    this.targetEntity = this.viewer.entities.add({
      name: "Acquisition Target",
      position: cartesian,
      point: {
        pixelSize: 16,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
      },
      label: {
        text: "TARGET",
        font: "14px sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  }

  loadTrajectory(waypointArray: Waypoint[], targetCartesian?: Cesium.Cartesian3) {
    this.clearWaypoints();
    this.waypoints = structuredClone(waypointArray);

    if (targetCartesian) {
      this.setTarget(targetCartesian);
    }

    this.waypoints.forEach((wp, index) => {
      this._createWaypointEntity(wp, index);
    });

    // Start the animated drone simulation along the loaded trajectory
    this.startDroneSimulation(this.waypoints);
  }

  addWaypoint(wp: Waypoint) {
    const index = this.waypoints.length;
    this.waypoints.push(structuredClone(wp));
    this._createWaypointEntity(this.waypoints[index], index);
    
    // Refresh drone animation with updated waypoints
    this.startDroneSimulation(this.waypoints);
  }

  offsetAllAltitudes(deltaMeters: number) {
    this.waypoints.forEach((wp, idx) => {
      wp.alt = Math.max(10, wp.alt + deltaMeters);
      this._updateEntityDescription(this.waypointEntities[idx], wp, idx);
    });
    this.startDroneSimulation(this.waypoints);
  }

  offsetWaypointAltitude(index: number, deltaMeters: number) {
    const wp = this.waypoints[index];
    if (!wp) return false;
    wp.alt = Math.max(10, wp.alt + deltaMeters);
    this._updateEntityDescription(this.waypointEntities[index], wp, index);
    this.startDroneSimulation(this.waypoints);
    return true;
  }

  startDroneSimulation(waypointArray: Waypoint[]) {
    if (waypointArray.length === 0) return;

    if (this.droneEntity) {
      this.viewer.entities.remove(this.droneEntity);
    }

    const property = new Cesium.SampledPositionProperty();
    const startTime = Cesium.JulianDate.now();

    waypointArray.forEach((wp, index) => {
      const time = Cesium.JulianDate.addSeconds(startTime, index * 4, new Cesium.JulianDate());
      const position = Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt);
      property.addSample(time, position);
    });

    const stopTime = Cesium.JulianDate.addSeconds(startTime, (waypointArray.length - 1) * 4, new Cesium.JulianDate());

    this.viewer.clock.startTime = startTime.clone();
    this.viewer.clock.stopTime = stopTime.clone();
    this.viewer.clock.currentTime = startTime.clone();
    this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    this.viewer.clock.multiplier = 1.0;
    this.viewer.clock.shouldAnimate = true;

    this.droneEntity = this.viewer.entities.add({
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start: startTime, stop: stopTime })
      ]),
      position: property,
      orientation: new Cesium.VelocityOrientationProperty(property),
      point: {
        pixelSize: 18,
        color: Cesium.Color.MAGENTA,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
      },
      label: {
        text: "DRONE-01",
        font: "12px sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      path: new Cesium.PathGraphics({
        width: 2,
        material: Cesium.Color.MAGENTA.withAlpha(0.6),
      }),
    });
  }

  private _createWaypointEntity(wp: Waypoint, index: number) {
    const positionCallback = new Cesium.CallbackProperty(() => {
      const current = this.waypoints[index];
      return current
        ? Cesium.Cartesian3.fromDegrees(current.lon, current.lat, current.alt)
        : Cesium.Cartesian3.ZERO;
    }, false);

    const labelCallback = new Cesium.CallbackProperty(() => {
      const current = this.waypoints[index];
      return current
        ? `${current.id}\nLat: ${current.lat.toFixed(6)}°, Lon: ${current.lon.toFixed(6)}°\nAlt: ${current.alt}m`
        : "";
    }, false);

    const wpEntity = this.viewer.entities.add({
      name: `Waypoint ${wp.id}`,
      position: positionCallback,
      point: {
        pixelSize: 12,
        color: index === 0 ? Cesium.Color.LIME : Cesium.Color.ORANGE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: labelCallback,
        font: "12px sans-serif",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    this._updateEntityDescription(wpEntity, wp, index);
    this.waypointEntities.push(wpEntity);

    const dropLinePositions = new Cesium.CallbackProperty(() => {
      const current = this.waypoints[index];
      if (!current) return [];
      return [
        Cesium.Cartesian3.fromDegrees(current.lon, current.lat, 0),
        Cesium.Cartesian3.fromDegrees(current.lon, current.lat, current.alt),
      ];
    }, false);

    const dropLineEntity = this.viewer.entities.add({
      polyline: {
        positions: dropLinePositions,
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.WHITE.withAlpha(0.6),
          dashLength: 12.0,
        }),
      },
    });
    this.dropLineEntities.push(dropLineEntity);

    if (this.targetEntity) {
      const cameraVectorPositions = new Cesium.CallbackProperty(() => {
        const current = this.waypoints[index];
        if (!current || !this.targetEntity) return [];
        const wpPos = Cesium.Cartesian3.fromDegrees(current.lon, current.lat, current.alt);
        const targetPos = this.targetEntity.position?.getValue(Cesium.JulianDate.now());
        return targetPos ? [wpPos, targetPos] : [];
      }, false);

      const cameraVectorEntity = this.viewer.entities.add({
        polyline: {
          positions: cameraVectorPositions,
          width: 1.5,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.YELLOW.withAlpha(0.7),
            dashLength: 8.0,
          }),
        },
      });
      this.cameraVectorEntities.push(cameraVectorEntity);
    }
  }

  private _updateEntityDescription(entity: Cesium.Entity, wp: Waypoint, index: number) {
    entity.description = new Cesium.ConstantProperty(`
      <table class="cesium-infoBox-defaultTable">
        <tbody>
          <tr><th>Waypoint ID</th><td>${wp.id} (Sequence #${index + 1})</td></tr>
          <tr><th>Latitude</th><td>${wp.lat.toFixed(6)}°</td></tr>
          <tr><th>Longitude</th><td>${wp.lon.toFixed(6)}°</td></tr>
          <tr><th>Altitude</th><td><strong>${wp.alt} meters</strong></td></tr>
        </tbody>
      </table>
    `);
  }

  clearWaypoints() {
    if (this.waypointEntities.includes(this.viewer.selectedEntity as Cesium.Entity)) {
      this.viewer.selectedEntity = undefined;
    }
    this.waypointEntities.forEach((e) => this.viewer.entities.remove(e));
    this.dropLineEntities.forEach((e) => this.viewer.entities.remove(e));
    this.cameraVectorEntities.forEach((e) => this.viewer.entities.remove(e));
    if (this.droneEntity) {
      this.viewer.entities.remove(this.droneEntity);
      this.droneEntity = null;
    }
    this.waypointEntities = [];
    this.dropLineEntities = [];
    this.cameraVectorEntities = [];
    this.waypoints = [];
  }

  flyToTrajectory(duration = 1.5) {
    if (this.waypoints.length > 0) {
      const positions = this.waypoints.map((wp) =>
        Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      );
      const bounds = Cesium.BoundingSphere.fromPoints(positions);
      this.viewer.camera.flyToBoundingSphere(bounds, {
        offset: new Cesium.HeadingPitchRange(
          Cesium.Math.toRadians(20),
          Cesium.Math.toRadians(-35),
          Math.max(800, bounds.radius * 3)
        ),
        duration,
      });
    }
  }
}

const INITIAL_WAYPOINTS: Waypoint[] = [
  { id: "WP-01", lat: 44.5646, lon: -123.262, alt: 60 },
  { id: "WP-02", lat: 44.5665, lon: -123.262, alt: 100 },
  { id: "WP-03", lat: 44.5665, lon: -123.2595, alt: 100 },
  { id: "WP-04", lat: 44.5646, lon: -123.2595, alt: 140 },
  { id: "WP-05", lat: 44.5646, lon: -123.257, alt: 140 },
  { id: "WP-06", lat: 44.5665, lon: -123.257, alt: 80 },
];

export default function CesiumViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<DroneTrajectoryManager | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const [statusText, setStatusText] = useState("Waypoints: 6 | Mode: Predefined Grid");
  const [selectedWaypoint, setSelectedWaypoint] = useState<Waypoint | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    if (!containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      geocoder: false,
      timeline: true, // Enabled timeline/animation so flight simulation playback is visible
      animation: true,
      infoBox: false,
      selectionIndicator: true,
    });

    viewerRef.current = viewer;
    viewer.scene.globe.show = true;
    viewer.scene.globe.baseColor = Cesium.Color.DARKSLATEGRAY;

    const manager = new DroneTrajectoryManager(viewer);
    managerRef.current = manager;

    const defaultTarget = Cesium.Cartesian3.fromDegrees(-123.2595, 44.5655, 0);
    manager.loadTrajectory(INITIAL_WAYPOINTS, defaultTarget);
    manager.flyToTrajectory(0);

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const pickedObjects = viewer.scene.drillPick(click.position);
      const pickedWaypoint = pickedObjects.find((pick) =>
        manager.waypointEntities.includes(pick.id)
      );

      if (pickedWaypoint) {
        viewer.selectedEntity = pickedWaypoint.id;
        const idx = manager.waypointEntities.indexOf(pickedWaypoint.id);
        setSelectedIndex(idx);
        setSelectedWaypoint(manager.waypoints[idx]);
      } else {
        const ray = viewer.camera.getPickRay(click.position);
        if (ray) {
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const targetLat = Cesium.Math.toDegrees(cartographic.latitude);
            const targetLon = Cesium.Math.toDegrees(cartographic.longitude);

            manager.setTarget(cartesian);

            const orbitPath: Waypoint[] = [];
            for (let i = 0; i < 8; i++) {
              const angle = i * (Math.PI / 4);
              const radius = 0.0012;
              orbitPath.push({
                id: `ORBIT-${i + 1}`,
                lat: targetLat + Math.sin(angle) * radius,
                lon: targetLon + Math.cos(angle) * radius,
                alt: 80 + (i % 2) * 20,
              });
            }

            manager.loadTrajectory(orbitPath);
            setStatusText(`Target Selected (${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}°)`);
            setSelectedWaypoint(null);
            setSelectedIndex(-1);
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      handler.destroy();
      viewer.destroy();
    };
  }, []);

  const handleAdjustAltitude = (delta: number) => {
    if (!managerRef.current) return;
    managerRef.current.offsetAllAltitudes(delta);
    setStatusText(`Altitude Shifted (${delta > 0 ? "+" : ""}${delta}m)`);
  };

  const handleAdjustSelectedAltitude = (delta: number) => {
    if (!managerRef.current || selectedIndex === -1) return;
    if (managerRef.current.offsetWaypointAltitude(selectedIndex, delta)) {
      const updatedWp = managerRef.current.waypoints[selectedIndex];
      setSelectedWaypoint({ ...updatedWp });
      setStatusText(`${updatedWp.id} Altitude: ${updatedWp.alt}m`);
    }
  };

  const handleAddWaypoint = () => {
    if (!managerRef.current) return;
    const lastWp = managerRef.current.waypoints[managerRef.current.waypoints.length - 1] || {
      lat: 44.5655,
      lon: -123.2595,
      alt: 80,
    };
    const nextNum = managerRef.current.waypoints.length + 1;
    const newWp: Waypoint = {
      id: `WP-0${nextNum}`,
      lat: lastWp.lat + (Math.random() - 0.3) * 0.0018,
      lon: lastWp.lon + 0.0015,
      alt: Math.round(60 + Math.random() * 100),
    };
    managerRef.current.addWaypoint(newWp);
    setStatusText("Dynamic Waypoint Added");
  };

  const handleSimulatePlanner = () => {
    if (!managerRef.current) return;
    const centerLat = 44.5655;
    const centerLon = -123.2595;
    const plannedPath: Waypoint[] = [];

    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI / 3);
      const radius = 0.0008 + i * 0.00025;
      plannedPath.push({
        id: `PLAN-${i + 1}`,
        lat: centerLat + Math.sin(angle) * radius,
        lon: centerLon + Math.cos(angle) * radius,
        alt: 50 + i * 25,
      });
    }

    const targetPos = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 0);
    managerRef.current.loadTrajectory(plannedPath, targetPos);
    setStatusText("Automated Spiral Planner");
    setSelectedWaypoint(null);
    setSelectedIndex(-1);
  };

  const handleReset = () => {
    if (!managerRef.current) return;
    const defaultTarget = Cesium.Cartesian3.fromDegrees(-123.2595, 44.5655, 0);
    managerRef.current.loadTrajectory(INITIAL_WAYPOINTS, defaultTarget);
    managerRef.current.flyToTrajectory();
    setStatusText("Predefined Grid");
    setSelectedWaypoint(null);
    setSelectedIndex(-1);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Control Panel Overlay */}
      <div className="absolute top-3 left-3 z-10 w-72 rounded-lg border border-white/15 bg-[#191c22]/90 p-4 text-white shadow-xl backdrop-blur-sm">
        <h3 className="mb-1 text-base font-bold text-sky-400">Drone Trajectory Controller</h3>
        <p className="mb-3 text-xs leading-relaxed text-slate-300">
          Click anywhere on terrain to set a <strong>Target</strong> and orbit, or click any waypoint to inspect it.
        </p>

        <div className="flex flex-col gap-2 text-xs">
          <button
            onClick={() => handleAdjustAltitude(40)}
            className="rounded bg-sky-600 px-3 py-2 font-medium text-white transition hover:bg-sky-700"
          >
            ▲ Raise Trajectory Altitude (+40m)
          </button>
          <button
            onClick={() => handleAdjustAltitude(-40)}
            className="rounded bg-sky-600 px-3 py-2 font-medium text-white transition hover:bg-sky-700"
          >
            ▼ Lower Trajectory Altitude (-40m)
          </button>
          <button
            onClick={handleAddWaypoint}
            className="rounded bg-slate-700 px-3 py-2 font-medium text-white transition hover:bg-slate-600"
          >
            + Append Dynamic Waypoint
          </button>
          <button
            onClick={handleSimulatePlanner}
            className="rounded bg-slate-700 px-3 py-2 font-medium text-white transition hover:bg-slate-600"
          >
            ⟳ Simulate Path-Planner Update (Spiral)
          </button>
          <button
            onClick={handleReset}
            className="rounded bg-slate-700 px-3 py-2 font-medium text-white transition hover:bg-slate-600"
          >
            ↺ Reset to Default Grid
          </button>
        </div>

        <div className="mt-3 border-t border-white/15 pt-2 text-xs text-slate-400">
          {statusText}
        </div>
      </div>

      {/* Selected Waypoint InfoBox Overlay */}
      {selectedWaypoint && (
        <div className="absolute top-3 right-3 z-20 w-80 rounded-lg border border-white/20 bg-[#191c22]/95 p-4 text-white shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
            <h3 className="text-base font-bold text-sky-400">Waypoint {selectedWaypoint.id}</h3>
            <button
              onClick={() => {
                setSelectedWaypoint(null);
                setSelectedIndex(-1);
                if (viewerRef.current) viewerRef.current.selectedEntity = undefined;
              }}
              className="text-lg font-bold text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <table className="mt-3 w-full text-left text-xs">
            <tbody>
              <tr className="border-b border-slate-700">
                <th className="py-1 text-slate-400">Sequence</th>
                <td className="py-1">{selectedIndex + 1}</td>
              </tr>
              <tr className="border-b border-slate-700">
                <th className="py-1 text-slate-400">Latitude</th>
                <td className="py-1">{selectedWaypoint.lat.toFixed(6)}°</td>
              </tr>
              <tr className="border-b border-slate-700">
                <th className="py-1 text-slate-400">Longitude</th>
                <td className="py-1">{selectedWaypoint.lon.toFixed(6)}°</td>
              </tr>
              <tr className="border-b border-slate-700">
                <th className="py-1 text-slate-400">Altitude</th>
                <td className="py-1 font-semibold text-sky-300">{selectedWaypoint.alt} meters</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleAdjustSelectedAltitude(10)}
              className="flex-1 rounded bg-sky-600 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
            >
              ▲ Raise (+10m)
            </button>
            <button
              onClick={() => handleAdjustSelectedAltitude(-10)}
              className="flex-1 rounded bg-sky-600 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
            >
              ▼ Lower (−10m)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
