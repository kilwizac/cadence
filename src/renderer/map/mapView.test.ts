import { expect, test } from "bun:test";
import { OrthographicCamera, Vector3 } from "three";
import { FOOTPRINT, GRID_SIZE } from "../model";
import { cellAt, frameMap, lotCenter, SITE_WIDTH, viewpoint } from "./mapView";

test("lot centers pick the original placement cell across the whole site", () => {
  for (let x = 0; x <= GRID_SIZE - FOOTPRINT; x++) {
    for (let y = 0; y <= GRID_SIZE - FOOTPRINT; y++) {
      expect(cellAt(lotCenter({ x, y }))).toEqual({ x, y });
    }
  }
});

test.each([0, 1, 2, 3])("frames the whole model and occupied lots from quarter turn %i", (turn) => {
  const width = 540, height = 588;
  const { sin, cos } = viewpoint(turn);
  for (const cells of [[], [{ x: 16, y: 1 }], [{ x: 0, y: 0 }, { x: 15, y: 12 }, { x: 0, y: 16 }]]) {
    const frame = frameMap(cells, turn, width, height);
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 200);
    camera.zoom = frame.zoom;
    camera.position.set(frame.x + sin * Math.SQRT2 * 20, 20, frame.z + cos * Math.SQRT2 * 20);
    camera.lookAt(frame.x, 0, frame.z);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const half = cells.length ? FOOTPRINT / 2 : SITE_WIDTH / 2;
    for (const { x, z } of cells.length ? cells.map(lotCenter) : [{ x: 0, z: 0 }]) {
      for (const dx of [-half, half]) for (const dz of [-half, half]) for (const y of cells.length ? [0, 2] : [-0.6, 0]) {
        const projected = new Vector3(x + dx, y, z + dz).project(camera);
        expect(Math.abs(projected.x)).toBeLessThan(0.9);
        expect(Math.abs(projected.y)).toBeLessThan(0.9);
      }
    }
  }
});
