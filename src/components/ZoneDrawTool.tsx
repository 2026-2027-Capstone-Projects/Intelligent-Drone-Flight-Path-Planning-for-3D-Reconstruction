import {
  CallbackProperty,
  type Cartesian2,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  type Viewer as CesiumViewerInstance,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";
import { useEffect, useMemo, useRef, useState } from "react";
import { Entity, useCesium } from "resium";
import { dragCorners, type GroundPoint, type ZoneKind } from "../boundingBox.ts";
import { zoneColors } from "./BoundingBoxEntity.tsx";

type Props = {
  // The kind of zone being drawn, or null when draw mode is off.
  kind: ZoneKind | null;
  // Called when a drag ends with both corners on the ground. The corners can be in any order.
  // `heading` is the camera heading in degrees clockwise from north when the drag started; the
  // zone's sides run along and across it so the box lines up with the drag on screen.
  onComplete: (kind: ZoneKind, start: GroundPoint, end: GroundPoint, heading: number) => void;
  // Called when drawing stops without a zone (Escape, or a drag off the globe), with an optional
  // message for the user.
  onCancel: (message?: string) => void;
};

/**
 * Returns the point on the terrain under a screen position, in degrees, or `undefined` when the
 * position is off the globe (for example on the sky). Picks the globe only, so buildings and the
 * translucent zone volumes don't get in the way.
 */
function pickGround(viewer: CesiumViewerInstance, position: Cartesian2): GroundPoint | undefined {
  const ray = viewer.camera.getPickRay(position);
  const cartesian = ray && viewer.scene.globe.pick(ray, viewer.scene);
  const cartographic = cartesian && Cartographic.fromCartesian(cartesian);
  if (!cartographic) return undefined;
  return {
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    latitude: CesiumMath.toDegrees(cartographic.latitude),
  };
}

/**
 * Lets the user draw a zone's footprint on the terrain: press at one corner, drag to the opposite
 * corner, and release. Must be rendered inside the Resium `Viewer`.
 *
 * The rectangle's sides run along and across the camera's heading, so its near and far edges run
 * left to right on screen, like the drag. Looking straight down, it matches the dragged screen
 * rectangle exactly.
 *
 * While `kind` is set, left-drag draws instead of rotating or panning the camera. Zooming and
 * tilting still work. Camera controls and the cursor are restored when drawing ends, is
 * cancelled, or the component unmounts.
 */
export default function ZoneDrawTool({ kind, onComplete, onCancel }: Props) {
  const { viewer } = useCesium();

  // The latest callbacks, so a parent re-render doesn't restart drawing in the middle of a drag.
  const onCompleteRef = useRef(onComplete);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onCancelRef.current = onCancel;
  }, [onComplete, onCancel]);

  // The preview outline is read by Cesium every frame through a CallbackProperty, so moving the
  // mouse doesn't re-render React. Only showing or hiding the preview does.
  const previewRef = useRef<PolygonHierarchy | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewHierarchy = useMemo(
    () => new CallbackProperty(() => previewRef.current ?? undefined, false),
    [],
  );

  useEffect(() => {
    if (!viewer || !kind) return;
    const { scene, camera } = viewer;
    const controller = scene.screenSpaceCameraController;
    const savedControls = {
      enableRotate: controller.enableRotate,
      enableTranslate: controller.enableTranslate,
    };
    // In 3D, left-drag rotates the globe; in 2D and Columbus view it pans. Turn off both.
    controller.enableRotate = false;
    controller.enableTranslate = false;
    const savedCursor = scene.canvas.style.cursor;
    scene.canvas.style.cursor = "crosshair";

    let pressed = false;
    let start: GroundPoint | undefined;
    let heading = 0;
    const clearPreview = () => {
      previewRef.current = null;
      setPreviewVisible(false);
    };

    const handler = new ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      pressed = true;
      start = pickGround(viewer, event.position);
      // Rotation is off while drawing, so the heading can't change during the drag.
      heading = CesiumMath.toDegrees(camera.heading);
      clearPreview();
    }, ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((event: ScreenSpaceEventHandler.MotionEvent) => {
      if (!pressed || !start) return;
      const current = pickGround(viewer, event.endPosition);
      // Off the globe, keep showing the last rectangle that was on the ground.
      if (!current) return;
      previewRef.current = new PolygonHierarchy(
        dragCorners(start, current, heading).map((corner) =>
          Cartesian3.fromDegrees(corner.longitude, corner.latitude),
        ),
      );
      setPreviewVisible(true);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      // Ignore a release whose press happened before draw mode started.
      if (!pressed) return;
      pressed = false;
      const end = pickGround(viewer, event.position);
      clearPreview();
      if (!start || !end) {
        onCancelRef.current("Start and end the drag on the ground, not the sky.");
        return;
      }
      onCompleteRef.current(kind, start, end, heading);
    }, ScreenSpaceEventType.LEFT_UP);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancelRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      handler.destroy();
      window.removeEventListener("keydown", handleKeyDown);
      controller.enableRotate = savedControls.enableRotate;
      controller.enableTranslate = savedControls.enableTranslate;
      scene.canvas.style.cursor = savedCursor;
      clearPreview();
    };
  }, [viewer, kind]);

  if (!kind || !previewVisible) return null;
  // No height, so Cesium clamps the preview to the terrain.
  return (
    <Entity
      name="Zone being drawn"
      polygon={{ hierarchy: previewHierarchy, material: zoneColors[kind].fill }}
    />
  );
}
