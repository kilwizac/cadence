import { FOOTPRINT, GRID_SIZE } from "../model";

export type Cell = { x: number; y: number };
export const SITE_RIM = 0.48;
export const SITE_WIDTH = GRID_SIZE + SITE_RIM * 2;
export const MIN_ZOOM = 12;
export const MAX_ZOOM = 220;

export const lotCenter = ({ x, y }: Cell) => ({
  x: x + (FOOTPRINT - GRID_SIZE) / 2,
  z: y + (FOOTPRINT - GRID_SIZE) / 2,
});

export const cellAt = ({ x, z }: { x: number; z: number }): Cell => ({
  x: Math.round(x + (GRID_SIZE - FOOTPRINT) / 2),
  y: Math.round(z + (GRID_SIZE - FOOTPRINT) / 2),
});

export function viewpoint(turn: number) {
  const angle = Math.PI / 4 + turn * Math.PI / 2;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return { sin, cos, northAngle: Math.atan2(sin, cos / Math.sqrt(3)) * 180 / Math.PI };
}

export function frameMap(cells: Cell[], turn: number, width: number, height: number) {
  const { sin, cos } = viewpoint(turn);
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  const occupied = cells.length > 0;
  const radius = occupied ? FOOTPRINT / 2 : SITE_WIDTH / 2;
  for (const center of occupied ? cells.map(lotCenter) : [{ x: 0, z: 0 }]) {
    for (const x of [center.x - radius, center.x + radius]) {
      for (const z of [center.z - radius, center.z + radius]) {
        const across = x * cos - z * sin;
        const up = -(x * sin + z * cos) / Math.sqrt(3);
        left = Math.min(left, across);
        right = Math.max(right, across);
        bottom = Math.min(bottom, up - (occupied ? 0 : 0.6) * Math.sqrt(2 / 3));
        top = Math.max(top, up + (occupied ? 2 : 0) * Math.sqrt(2 / 3));
      }
    }
  }
  const across = (left + right) / 2;
  const along = -(top + bottom) / 2 * Math.sqrt(3);
  const roomX = width - Math.min(width * 0.32, occupied ? 200 : 80);
  const roomY = height - Math.min(height * 0.24, occupied ? 112 : 76);
  return {
    x: across * cos + along * sin,
    z: -across * sin + along * cos,
    zoom: Math.max(MIN_ZOOM, Math.min(145, roomX / (right - left), roomY / (top - bottom))),
  };
}
