import type { Flow } from "../../shared/types";
import { FOOTPRINT, GRID_SIZE } from "../model";

export type FloorPoint = [x: number, z: number];
export type LotPositions = ReadonlyMap<string, { x: number; y: number }>;
export type FlowRoute = { flow: Flow; points: FloorPoint[] };

const HALF = FOOTPRINT / 2;
const RIM = HALF - 0.04;
const AISLE = 0.46;
const SIDE = GRID_SIZE * 2 + 1;
const DIRECTIONS: FloorPoint[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const distance = (a: FloorPoint, b: FloorPoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const cellPoint = (index: number): FloorPoint => [(index % SIDE) / 2, Math.floor(index / SIDE) / 2];

function streetGrid(lots: FloorPoint[]) {
  const grid = new Uint8Array(SIDE * SIDE);
  for (const [cx, cz] of lots) {
    const extent = HALF + AISLE;
    for (let z = Math.max(0, Math.ceil((cz - extent) * 2)); z <= Math.min(SIDE - 1, (cz + extent) * 2); z++) {
      for (let x = Math.max(0, Math.ceil((cx - extent) * 2)); x <= Math.min(SIDE - 1, (cx + extent) * 2); x++) {
        const i = z * SIDE + x;
        const reach = Math.max(Math.abs(x / 2 - cx), Math.abs(z / 2 - cz));
        grid[i] = Math.max(grid[i], reach < HALF ? 2 : 1);
      }
    }
  }
  return grid;
}

function clearSegment(a: FloorPoint, b: FloorPoint, obstacles: FloorPoint[], margin: number) {
  const reach = HALF + margin;
  const left = Math.min(a[0], b[0]) - reach, right = Math.max(a[0], b[0]) + reach;
  const top = Math.min(a[1], b[1]) - reach, bottom = Math.max(a[1], b[1]) + reach;
  return obstacles.every(([x, z]) => x <= left || x >= right || z <= top || z >= bottom);
}

function facingPorts(a: FloorPoint, b: FloorPoint, obstacles: FloorPoint[]) {
  const axis = Math.abs(b[0] - a[0]) >= FOOTPRINT ? 0 : 1;
  const cross = 1 - axis;
  const span = Math.abs(b[axis] - a[axis]);
  if (span < FOOTPRINT || Math.abs(a[cross] - b[cross]) > FOOTPRINT - 0.8) return null;
  const direction = Math.sign(b[axis] - a[axis]);
  const radius = Math.min(RIM, (span - 0.52) / 2);
  const start: FloorPoint = [...a];
  const end: FloorPoint = [...b];
  start[axis] += direction * radius;
  end[axis] -= direction * radius;
  start[cross] = end[cross] = (a[cross] + b[cross]) / 2;
  return clearSegment(start, end, obstacles, AISLE) ? [start, end] : null;
}

function ports(center: FloorPoint, grid: Uint8Array, tight: boolean, obstacles: FloorPoint[]) {
  return DIRECTIONS.flatMap(([dx, dz], direction) => {
    const edge = HALF + (tight ? 0 : AISLE);
    const snap = (c: number, d: number) => d ? d * Math.ceil((d * c + edge) * 2) : Math.round(c * 2);
    const x = snap(center[0], dx);
    const z = snap(center[1], dz);
    const index = z * SIDE + x;
    if (x < 0 || x >= SIDE || z < 0 || z >= SIDE || grid[index] > Number(tight)) return [];
    const rim = tight ? HALF - 0.2 : RIM;
    const point: FloorPoint = [dx ? center[0] + dx * rim : x / 2, dz ? center[1] + dz * rim : z / 2];
    return clearSegment(point, cellPoint(index), obstacles, 0) ? [{ index, point, direction }] : [];
  });
}

function streetPath(a: FloorPoint, b: FloorPoint, grid: Uint8Array, otherLots: FloorPoint[], tight: boolean) {
  const starts = ports(a, grid, tight, [...otherLots, b]).sort((p, q) => distance(p.point, b) - distance(q.point, b));
  const ends = new Map(ports(b, grid, tight, [...otherLots, a]).map((p) => [p.index, p]));
  if (!starts.length || !ends.size) return null;
  const steps = new Int16Array(grid.length).fill(-1);
  const turns = new Uint16Array(grid.length * 4).fill(65535);
  const onward = new Uint8Array(grid.length * 4);
  const queue = [...ends.keys()];
  for (const { index, direction } of ends.values()) {
    steps[index] = 0;
    for (let incoming = 0; incoming < 4; incoming++) turns[index * 4 + incoming] = Number(incoming !== (direction + 2) % 4);
  }
  const startNodes = new Set(starts.map((p) => p.index));
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head];
    if (startNodes.has(node)) break;
    for (let side = 0; side < 4; side++) {
      const [dx, dz] = DIRECTIONS[side];
      const x = node % SIDE + dx, neighbor = node + dx + dz * SIDE;
      if (x < 0 || x >= SIDE || neighbor < 0 || neighbor >= grid.length || grid[neighbor] > Number(tight)) continue;
      if (steps[neighbor] === -1) {
        steps[neighbor] = steps[node] + 1;
        queue.push(neighbor);
      }
      if (steps[neighbor] !== steps[node] + 1) continue;
      const toward = (side + 2) % 4;
      for (let incoming = 0; incoming < 4; incoming++) {
        const state = neighbor * 4 + incoming;
        const bends = turns[node * 4 + toward] + Number(incoming !== toward);
        if (bends >= turns[state]) continue;
        turns[state] = bends;
        onward[state] = toward;
      }
    }
  }
  const start = starts.filter((p) => steps[p.index] >= 0).sort((p, q) =>
    steps[p.index] - steps[q.index] || turns[p.index * 4 + p.direction] - turns[q.index * 4 + q.direction],
  )[0];
  if (!start) return null;
  let { index, direction } = start;
  const path = [start.point, cellPoint(index)];
  while (steps[index] > 0) {
    direction = onward[index * 4 + direction];
    index += DIRECTIONS[direction][0] + DIRECTIONS[direction][1] * SIDE;
    path.push(cellPoint(index));
  }
  path.push(ends.get(index)!.point);
  return path.filter((p, i) => {
    if (i === 0 || i === path.length - 1) return true;
    const before = path[i - 1], after = path[i + 1];
    return !(before[0] === p[0] && p[0] === after[0]) && !(before[1] === p[1] && p[1] === after[1]);
  });
}

export function offsetPath(points: FloorPoint[], by: number): FloorPoint[] {
  return points.map(([x, z], i) => {
    const before = points[Math.max(i - 1, 0)], after = points[Math.min(i + 1, points.length - 1)];
    return [x - Math.sign(after[1] - before[1]) * by, z + Math.sign(after[0] - before[0]) * by];
  });
}

export function routeFlows(flows: Flow[], positions: LotPositions): FlowRoute[] {
  if (!flows.length) return [];
  const centers = new Map<string, FloorPoint>();
  for (const [id, { x, y }] of positions) {
    if (Number.isFinite(x) && Number.isFinite(y)) centers.set(id, [x + HALF, y + HALF]);
  }
  const pairs = new Map<string, Flow[]>();
  for (const flow of flows) {
    if (flow.from === flow.to || !centers.has(flow.from) || !centers.has(flow.to)) continue;
    const key = JSON.stringify([flow.from, flow.to].sort());
    const pair = pairs.get(key);
    if (pair) pair.push(flow);
    else pairs.set(key, [flow]);
  }
  const lots = [...centers.values()];
  const grid = streetGrid(lots);
  const routes: FlowRoute[] = [];
  for (const pair of pairs.values()) {
    const [from, to] = [pair[0].from, pair[0].to].sort();
    const a = centers.get(from)!, b = centers.get(to)!;
    if ([...a, ...b].some((v) => v < HALF || v > GRID_SIZE - HALF)) continue;
    if (Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) < FOOTPRINT) continue;
    const obstacles = lots.filter((p) => p !== a && p !== b);
    const facing = facingPorts(a, b, obstacles);
    let path = facing && distance(facing[0], facing[1]) >= 0.65 ? facing : streetPath(a, b, grid, obstacles, false);
    let laneLimit = 0.24;
    if (!path) {
      path = facing ?? streetPath(a, b, grid, obstacles, true);
      if (!path) continue;
      if (!facing) laneLimit = 0.025;
    }
    pair.sort((p, q) => p.from.localeCompare(q.from) || p.id.localeCompare(q.id));
    const spacing = Math.min(0.32, 2 * laneLimit / Math.max(1, pair.length - 1));
    for (const [i, flow] of pair.entries()) {
      const points = offsetPath(path, (i - (pair.length - 1) / 2) * spacing);
      for (const p of points) {
        p[0] -= GRID_SIZE / 2;
        p[1] -= GRID_SIZE / 2;
      }
      routes.push({ flow, points: flow.from === from ? points : points.reverse() });
    }
  }
  return routes;
}
