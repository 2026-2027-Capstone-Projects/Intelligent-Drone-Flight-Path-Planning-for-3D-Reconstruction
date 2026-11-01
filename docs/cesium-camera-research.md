# CesiumJS Camera Position and Coordinate Research

## 1. Purpose

Understand how CesiumJS represents geographic positions and camera orientation to support the development of a simulated drone camera for our 3D reconstruction project.

## 2. Position representations

CesiumJS provides two relevant representations:

- `Cesium.Cartographic`: Represents a position using longitude, latitude, and height. Angular coordinates are in radians when working directly with the object.
- `Cesium.Cartesian3`: Represents a position or vector using three Cartesian components (X, Y, Z).

CesiumJS provides conversion methods, including `Cartographic.fromCartesian()` and `Cartographic.fromDegrees()`. These may be useful when converting between geographic coordinates and positions used.

## 3. Camera position and orientation

The viewer camera exposes its current position and orientation through properties such as:

- `viewer.camera.position`
- `viewer.camera.positionCartographic`
- `viewer.camera.heading`
- `viewer.camera.pitch`
- `viewer.camera.roll`
- `viewer.camera.direction`

Heading, pitch, and roll are expressed in radians. The camera's direction, up, and right properties provide Cartesian vectors describing its current orientation.

**Important distinction:** These properties describe the viewer's camera. A drone camera may need its own position and orientation rather than relying on the viewer camera's state.

## 4. Preliminary conclusion

CesiumJS provides position conversion utilities and camera orientation properties relevant to the drone-camera prototype. The next step is to verify how these APIs can support a separate simulated camera and determine a consistent representation for drone position and orientation.

## 5. References

- CesiumJS `Cartographic` API: https://cesium.com/learn/cesiumjs/ref-doc/Cartographic.html
- CesiumJS `Camera` API: https://cesium.com/learn/cesiumjs/ref-doc/Camera.html
