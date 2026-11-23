import { useMemo, type ComponentProps } from "react";
import { Html } from "@react-three/drei";
import { Shape, Vector2, Vector3 } from "three";
import type { Flow } from "../../shared/types";
import { offsetPath, routeFlows, type FloorPoint, type FlowRoute, type LotPositions } from "./flowRouting";

type ProjectLabel = NonNullable<ComponentProps<typeof Html>["calculatePosition"]>;
const floorShape = (contour: FloorPoint[]) => new Shape(contour.map(([x, z]) => new Vector2(x, -z)));

function marking(points: FloorPoint[], active: boolean) {
  const end = points[points.length - 1], before = points[points.length - 2];
  const dx = Math.sign(end[0] - before[0]), dz = Math.sign(end[1] - before[1]);
  const length = Math.abs(end[0] - before[0]) + Math.abs(end[1] - before[1]);
  const head = Math.min(active ? 0.50 : 0.44, length * 0.66);
  const wing = Math.min(active ? 0.225 : 0.20, head * 0.49);
  const halfStroke = Math.min(active ? 0.094 : 0.078, wing * 0.57);
  const neck: FloorPoint = [end[0] - dx * head, end[1] - dz * head];
  const shaft = [...points.slice(0, -1), neck];

  function outline(inset: number) {
    const base: FloorPoint = [neck[0] + dx * inset, neck[1] + dz * inset];
    const tip: FloorPoint = [end[0] - dx * inset * 2, end[1] - dz * inset * 2];
    const tipWidth = wing - inset * 1.5;
    const left: FloorPoint = [base[0] - dz * tipWidth, base[1] + dx * tipWidth];
    const right: FloorPoint = [base[0] + dz * tipWidth, base[1] - dx * tipWidth];
    const spine = [...points.slice(0, -1), base];
    spine[0] = [spine[0][0] + Math.sign(spine[1][0] - spine[0][0]) * inset, spine[0][1] + Math.sign(spine[1][1] - spine[0][1]) * inset];
    const contour = [...offsetPath(spine, halfStroke - inset), left, tip, right, ...offsetPath(spine, inset - halfStroke).reverse()];
    return floorShape(contour);
  }

  let start = shaft[0], finish = shaft[1], longest = 0;
  for (let i = 1; i < shaft.length; i++) {
    const a = shaft[i - 1], b = shaft[i];
    const span = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    if (span <= longest) continue;
    longest = span;
    start = a;
    finish = b;
  }
  const along = (t: number): FloorPoint => [start[0] + (finish[0] - start[0]) * t, start[1] + (finish[1] - start[1]) * t];
  const casing = [outline(0)], ink = [outline(Math.min(0.032, halfStroke * 0.4))];
  const cues: FloorPoint[][] = [[end, [neck[0] - dz * wing, neck[1] + dx * wing], [neck[0] + dz * wing, neck[1] - dx * wing]]];
  const hasChevron = longest >= 1.35;
  const anchor = along(hasChevron ? 0.34 : 0.40);
  if (hasChevron) {
    const [x, z] = along(0.55);
    const ux = Math.sign(finish[0] - start[0]), uz = Math.sign(finish[1] - start[1]);
    const chevron = (inset: number): FloorPoint[] => {
      const reach = (active ? 0.155 : 0.14) - inset * Math.SQRT1_2;
      const n = ((active ? 0.058 : 0.052) - inset) * Math.SQRT1_2;
      return [[-reach + n, reach + n], [2 * n, 0], [-reach + n, -reach - n],
        [-reach - n, -reach + n], [-2 * n, 0], [-reach - n, reach - n]].map(([u, v]) => [x + ux * u - uz * v, z + uz * u + ux * v]);
    };
    const outer = chevron(0);
    casing.push(floorShape(outer));
    ink.push(floorShape(chevron(0.022)));
    cues.push(outer);
  }
  const markers = cues.map((cue) => cue.map(([x, z]) => new Vector3(x - anchor[0], 0, z - anchor[1])));
  const screen = new Vector3();
  const projectLabel: ProjectLabel = (object, camera, { width, height }) => {
    screen.setFromMatrixPosition(object.matrixWorld).project(camera);
    const x = (screen.x + 1) * width / 2, y = (1 - screen.y) * height / 2;
    const bands = markers.map((marker) => {
      let top = Infinity, bottom = -Infinity;
      for (const vertex of marker) {
        const edge = (1 - screen.copy(vertex).applyMatrix4(object.matrixWorld).project(camera).y) * height / 2;
        top = Math.min(top, edge);
        bottom = Math.max(bottom, edge);
      }
      return [top - 14, bottom + 14];
    });
    const preferred = y < (bands[0][0] + bands[0][1]) / 2 ? y - 14 : y + 14;
    bands.push([y - 14, y + 14]);
    let nearest = Infinity;
    for (const band of bands) {
      for (const pos of band) {
        if (Math.abs(pos - preferred) < Math.abs(nearest - preferred) && !bands.some(([top, bottom]) => top < pos && pos < bottom)) nearest = pos;
      }
    }
    return [x, nearest];
  };
  return { casing, ink, anchor, projectLabel };
}

function Route({ route: { flow, points }, active, dim, order }: { route: FlowRoute; active: boolean; dim: boolean; order: number }) {
  const { casing, ink, anchor, projectLabel } = useMemo(() => marking(points, active), [points, active]);
  return (
    <group position-y={0.166}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={order}>
        <shapeGeometry args={[casing]} />
        <meshBasicMaterial color={dim ? "#d9e1d4" : "#f7f4e6"} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} renderOrder={order + 1}>
        <shapeGeometry args={[ink]} />
        <meshBasicMaterial color={active ? "#075952" : dim ? "#667b75" : "#3d6460"} depthWrite={false} toneMapped={false} />
      </mesh>
      {!dim && Boolean(flow.label?.trim()) && (
        <Html center position={[anchor[0], 0, anchor[1]]} calculatePosition={projectLabel} zIndexRange={[9, 1]} style={{ pointerEvents: "none" }}>
          <span className={active ? "flow-tag selected" : "flow-tag"}>{flow.label}</span>
        </Html>
      )}
    </group>
  );
}

export function FlowRoutes({ flows, positions, selectedId }: { flows: Flow[]; positions: LotPositions; selectedId: string | null }) {
  const routes = useMemo(() => routeFlows(flows, positions), [flows, positions]);
  return routes.map((route, i) => {
    const active = route.flow.from === selectedId || route.flow.to === selectedId;
    return <Route key={route.flow.id} route={route} active={active} dim={selectedId !== null && !active} order={2 + 2 * (i + (active ? routes.length : 0))} />;
  });
}
