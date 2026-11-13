import {
  Color,
  Material,
  PointPrimitiveCollection,
  PolylineCollection,
  PrimitiveCollection,
  type Scene,
} from "cesium";
import type { OrbitPath } from "./orbit.ts";

/** Own only the orbit overlay, so replacing it never removes buildings or the operating box. */
export class OrbitDisplay {
  private readonly primitives = new PrimitiveCollection();

  constructor(private readonly scene: Scene) {
    scene.primitives.add(this.primitives);
  }

  clear() {
    this.primitives.removeAll(); // also destroys the previous GPU resources
    this.scene.requestRender();
  }

  replace(path: OrbitPath) {
    this.clear();
    const points = this.primitives.add(new PointPrimitiveCollection());
    const lines = this.primitives.add(new PolylineCollection());
    path.positions.forEach((position, index) => {
      points.add({
        position,
        pixelSize: 9,
        color: index === 0 ? Color.YELLOW : Color.LIME,
        outlineColor: Color.BLACK,
        outlineWidth: 1,
      });
    });
    lines.add({
      positions: [...path.positions, path.positions[0]],
      width: 3,
      material: Material.fromType("Color", { color: Color.LIME }),
    });
    this.scene.requestRender();
  }

  destroy() {
    if (!this.scene.isDestroyed()) this.scene.primitives.remove(this.primitives);
  }
}
