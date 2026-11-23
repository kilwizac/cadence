import { expect, test } from "bun:test";
import { FOOTPRINT, GRID_SIZE } from "../model";
import { routeFlows, type FloorPoint } from "./flowRouting";

const edge = (from: string, to: string, id = `${from}-${to}`) => ({ id, from, to, label: "" });
const sites = (cells: Record<string, FloorPoint>) => new Map(Object.entries(cells).map(([id, [x, y]]) => [id, { x, y }]));
const center = ([x, z]: FloorPoint): FloorPoint => [x + (FOOTPRINT - GRID_SIZE) / 2, z + (FOOTPRINT - GRID_SIZE) / 2];
const span = (a: FloorPoint, b: FloorPoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function checkPath(points: FloorPoint[], from: FloorPoint, to: FloorPoint) {
  expect(points.length).toBeGreaterThanOrEqual(2);
  expect(points.flat().every(Number.isFinite)).toBe(true);
  points.slice(1).forEach((p, i) => {
    expect(Number(p[0] === points[i][0]) + Number(p[1] === points[i][1])).toBe(1);
    if (i) expect(points[i - 1][0] !== p[0] && points[i - 1][1] !== p[1]).toBe(true);
  });
  for (const [site, port, outside] of [[center(from), points[0], points[1]], [center(to), points.at(-1)!, points.at(-2)!]]) {
    const dx = port[0] - site[0], dz = port[1] - site[1];
    expect(Math.max(Math.abs(dx), Math.abs(dz))).toBeGreaterThan(0.7);
    expect(Math.max(Math.abs(dx), Math.abs(dz))).toBeLessThanOrEqual(FOOTPRINT / 2);
    expect(dx * (outside[0] - port[0]) + dz * (outside[1] - port[1])).toBeGreaterThan(0);
  }
}

function clears(points: FloorPoint[], site: FloorPoint, clearance: number) {
  const [x, z] = center(site);
  return points.slice(1).every((b, i) => {
    const a = points[i];
    return Math.max(Math.min(a[0], b[0]) - x, x - Math.max(a[0], b[0]), Math.min(a[1], b[1]) - z, z - Math.max(a[1], b[1])) >= clearance;
  });
}

test("clear, overlapping faces connect with one straight stroke from rim to rim", () => {
  const cells = { a: [1, 4], b: [9, 5] } satisfies Record<string, FloorPoint>;
  const [{ points }] = routeFlows([edge("a", "b")], sites(cells));
  checkPath(points, cells.a, cells.b);
  expect(points).toHaveLength(2);
  expect(Math.abs(points[0][0] - (center(cells.a)[0] + FOOTPRINT / 2))).toBeLessThan(0.1);
  expect(Math.abs(points[1][0] - (center(cells.b)[0] - FOOTPRINT / 2))).toBeLessThan(0.1);
  expect(points[0][1]).toBeCloseTo(-3.5);
});

test("a wall with an opening at each end is skirted with two bends, in both directions", () => {
  const cells = { a: [1, 6], b: [13, 6], north: [7, 4], middle: [7, 6], south: [7, 8] } satisfies Record<string, FloorPoint>;
  const outward = edge("a", "b"), back = edge("b", "a");
  const routes = routeFlows([outward, back], sites(cells));
  expect(routes).toHaveLength(2);
  for (const { flow, points } of routes) {
    checkPath(points, flow === outward ? cells.a : cells.b, flow === back ? cells.a : cells.b);
    expect(points).toHaveLength(4);
    for (const lot of [cells.north, cells.middle, cells.south]) expect(clears(points, lot, 1.25)).toBe(true);
  }
  expect(routes[0].points).not.toEqual([...routes[1].points].reverse());
  expect(routeFlows([back, outward], sites(cells))).toEqual(routes);
});

test("touching yards use an open exterior lane rather than putting a tiny arrow in the seam", () => {
  const cells = { a: [0, 0], b: [2, 0] } satisfies Record<string, FloorPoint>;
  const routes = routeFlows([edge("a", "b"), edge("b", "a"), edge("a", "b", "paperwork")], sites(cells));
  expect(routes).toHaveLength(3);
  for (const { flow, points } of routes) {
    const startsAtA = flow.from === "a";
    checkPath(points, startsAtA ? cells.a : cells.b, startsAtA ? cells.b : cells.a);
    expect(points).toHaveLength(4);
    expect(span(points.at(-1)!, points.at(-2)!)).toBeGreaterThan(0.29);
  }
  const aPorts = routes.map(({ flow, points }) => (flow.from === "a" ? points[0] : points.at(-1)!).join(","));
  expect(new Set(aPorts).size).toBe(3);
});

test("fully packed lots retain handoffs without running them through unrelated decks", () => {
  const cells: Record<string, FloorPoint> = {};
  for (let x = 0; x < GRID_SIZE; x += FOOTPRINT) {
    for (let z = 0; z < GRID_SIZE; z += FOOTPRINT) cells[`${x}:${z}`] = [x, z];
  }
  const routes = routeFlows([edge("6:6", "10:6"), edge("8:6", "10:6")], sites(cells));
  expect(routes).toHaveLength(2);
  for (const { flow, points } of routes) {
    checkPath(points, cells[flow.from], cells[flow.to]);
    for (const [id, lot] of Object.entries(cells)) {
      if (id !== flow.from && id !== flow.to) expect(clears(points, lot, 0.97)).toBe(true);
    }
  }
  const bridge = routes.find(({ flow }) => flow.from === "8:6")!.points;
  expect(bridge).toHaveLength(2);
  expect(span(bridge[0], bridge[1])).toBeGreaterThan(0.5);
});

test("drag previews use the supplied positions and skip unusable endpoints", () => {
  const cells = { a: [2, 3], b: [7, 3] } satisfies Record<string, FloorPoint>;
  const flows = [edge("a", "b"), edge("a", "missing"), edge("b", "b")];
  const before = routeFlows(flows, sites(cells));
  expect(before).toHaveLength(1);
  cells.b = [2.25, 12.5];
  const [{ points }] = routeFlows(flows, sites(cells));
  checkPath(points, cells.a, cells.b);
  expect(points.at(-1)).not.toEqual(before[0].points.at(-1));
  for (const invalid of [[2, 3], [3, 4], [-2, 7], [Infinity, 3], [NaN, 5]] satisfies FloorPoint[]) {
    expect(routeFlows(flows, sites({ ...cells, b: invalid }))).toEqual([]);
  }
});
