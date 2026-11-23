import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, MapControls, useGLTF } from "@react-three/drei";
import { Box3, Group, Quaternion, Vector3, type Mesh, type OrthographicCamera } from "three";
import { ActionIcon, Paper, Tooltip } from "@mantine/core";
import { IconFocusCentered, IconMinus, IconPlus } from "@tabler/icons-react";
import type { Area, AreaKind, Flow } from "../../shared/types";
import { FOOTPRINT, GRID_SIZE, canPlace, openNotes } from "../model";
import { ALL_MODELS, KIND_MODELS, modelUrl } from "./assets";

const CENTER = GRID_SIZE / 2;
const CAMERA_OFFSET = 20;
const HERO_SIZE = 1.05;
const PROP_SIZE = 0.5;
const PROP_SLOTS: [number, number, number][] = [
  [0.52, -0.5, 0],
  [0.52, 0.08, 0],
  [0.5, 0.6, Math.PI / 2],
  [-0.04, 0.58, 0],
  [-0.56, 0.58, Math.PI / 2],
];
const ACCENT = "#2f6fed";
const FLOW_COLOR = "#55657e";

useGLTF.preload(ALL_MODELS.map(modelUrl), false, false);

export type Placement = { name: string; hue: number; kind: AreaKind };
export interface MapHandle {
  zoomBy(factor: number): void;
  recenter(): void;
}
type Cell = { x: number; y: number };
type Controls = { target: Vector3; enabled: boolean; update(): void };

interface Props {
  areas: Area[];
  flows: Flow[];
  selectedId: string | null;
  placement: Placement | null;
  onSelect: (id: string | null) => void;
  onPlace: (cell: Cell) => void;
  onMove: (id: string, cell: Cell) => void;
}

const padColor = (hue: number, lightness: number) => `hsl(${hue}, 50%, ${lightness}%)`;
const cellAt = (point: Vector3): Cell => ({
  x: Math.round(point.x + CENTER - FOOTPRINT / 2),
  y: Math.round(point.z + CENTER - FOOTPRINT / 2),
});
const lotCenter = (x: number, y: number) => new Vector3(x + FOOTPRINT / 2 - CENTER, 0, y + FOOTPRINT / 2 - CENTER);

export function MapScene(props: Props) {
  const handle = useRef<MapHandle | null>(null);
  return (
    <div className="canvas">
      <Canvas orthographic shadows flat dpr={[1, 2]} camera={{ position: [CAMERA_OFFSET, CAMERA_OFFSET, CAMERA_OFFSET], zoom: 40, near: 0.1, far: 200 }}>
        <color attach="background" args={["#eceef2"]} />
        <Scene {...props} handle={handle} />
      </Canvas>
      <Paper className="zoom-controls" shadow="sm" withBorder p={4}>
        <Tooltip label="Zoom out">
          <ActionIcon variant="subtle" color="gray" aria-label="Zoom out" onClick={() => handle.current?.zoomBy(1 / 1.25)}>
            <IconMinus size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Zoom in">
          <ActionIcon variant="subtle" color="gray" aria-label="Zoom in" onClick={() => handle.current?.zoomBy(1.25)}>
            <IconPlus size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Recenter map">
          <ActionIcon variant="subtle" color="gray" aria-label="Recenter map" onClick={() => handle.current?.recenter()}>
            <IconFocusCentered size={16} />
          </ActionIcon>
        </Tooltip>
      </Paper>
    </div>
  );
}

function Scene({ areas, flows, selectedId, placement, onSelect, onPlace, onMove, handle }: Props & { handle: RefObject<MapHandle | null> }) {
  const controls = useThree((state) => state.controls) as unknown as Controls | null;
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const size = useThree((state) => state.size);
  const canvas = useThree((state) => state.gl.domElement);
  const [hover, setHover] = useState<Cell | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const hoverRef = useRef<Cell | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const recenter = () => {
      camera.position.set(CAMERA_OFFSET, CAMERA_OFFSET, CAMERA_OFFSET);
      camera.zoom = Math.min(size.width, size.height * 1.7) / (GRID_SIZE * 1.3);
      camera.updateProjectionMatrix();
      if (!controls) return;
      controls.target.set(0, 0, 0);
      controls.update();
    };
    handle.current = {
      recenter,
      zoomBy: (factor) => {
        camera.zoom = Math.min(220, Math.max(12, camera.zoom * factor));
        camera.updateProjectionMatrix();
        controls?.update();
      },
    };
  });

  const centered = useRef(false);
  useEffect(() => {
    if (!controls || centered.current) return;
    centered.current = true;
    handle.current?.recenter();
  }, [controls, handle]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (current && !current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 4) {
        current.moved = true;
        setDraggingId(current.id);
      }
    };
    const up = () => {
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      if (controls) controls.enabled = true;
      setDraggingId(null);
      if (!current.moved) {
        onSelect(current.id);
        return;
      }
      const cell = hoverRef.current;
      if (cell && canPlace(areas, cell.x, cell.y, current.id)) onMove(current.id, cell);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [areas, controls, onMove, onSelect]);

  const ghostValid = Boolean(placement && hover && canPlace(areas, hover.x, hover.y));
  useEffect(() => {
    canvas.style.cursor = placement ? (ghostValid ? "copy" : "not-allowed") : draggingId ? "grabbing" : "";
  }, [canvas, placement, ghostValid, draggingId]);

  const trackHover = (event: ThreeEvent<PointerEvent>) => {
    const cell = cellAt(event.point);
    hoverRef.current = cell;
    setHover((current) => (current && current.x === cell.x && current.y === cell.y ? current : cell));
  };

  const startDrag = (event: ThreeEvent<PointerEvent>, id: string) => {
    if (placement || event.button !== 0) return;
    event.stopPropagation();
    drag.current = { id, x: event.clientX, y: event.clientY, moved: false };
    if (controls) controls.enabled = false;
  };

  const positions = new Map(
    areas.map((area) => {
      const moving = area.id === draggingId && hover;
      return [area.id, moving ? hover : { x: area.x, y: area.y }] as const;
    }),
  );

  return (
    <>
      <MapControls makeDefault enableRotate={false} screenSpacePanning zoomToCursor minZoom={12} maxZoom={220} />
      <hemisphereLight args={["#ffffff", "#aeb6c4", 1.5]} />
      <directionalLight
        position={[10, 18, 5]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0006}
      />

      <Board />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} onPointerMove={trackHover} onClick={(event) => {
        if (event.delta > 4) return;
        if (!placement) return onSelect(null);
        const cell = cellAt(event.point);
        if (canPlace(areas, cell.x, cell.y)) onPlace(cell);
      }}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Suspense fallback={null}>
        {flows.map((flow) => {
          const from = positions.get(flow.from);
          const to = positions.get(flow.to);
          if (!from || !to) return null;
          return <FlowLine key={flow.id} from={lotCenter(from.x, from.y)} to={lotCenter(to.x, to.y)} label={flow.label} />;
        })}

        {areas.map((area) => {
          const position = positions.get(area.id)!;
          const dragging = area.id === draggingId;
          return (
            <Lot
              key={area.id}
              kind={area.kind}
              hue={area.hue}
              x={position.x}
              y={position.y}
              props={area.processes.length}
              selected={area.id === selectedId}
              invalid={dragging && !canPlace(areas, position.x, position.y, area.id)}
              onPointerDown={(event) => startDrag(event, area.id)}
            >
              <MapLabel
                name={area.name || "Untitled area"}
                open={openNotes(area).length}
                processes={area.processes.length}
                selected={area.id === selectedId}
                interactive={!placement}
                onClick={() => onSelect(area.id)}
              />
            </Lot>
          );
        })}

        {placement && hover && (
          <Lot kind={placement.kind} hue={placement.hue} x={hover.x} y={hover.y} props={0} selected={false} invalid={!ghostValid} ghost>
            <MapLabel name={placement.name} open={0} processes={0} selected={false} interactive={false} />
          </Lot>
        )}
      </Suspense>
    </>
  );
}

function Board() {
  const lines = useMemo(() => {
    const points: number[] = [];
    for (let i = 0; i <= GRID_SIZE; i++) {
      const p = i - CENTER;
      points.push(p, 0, -CENTER, p, 0, CENTER, -CENTER, 0, p, CENTER, 0, p);
    }
    return new Float32Array(points);
  }, []);
  return (
    <group>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[GRID_SIZE, 0.4, GRID_SIZE]} />
        <meshStandardMaterial color="#f7f8fa" />
      </mesh>
      <lineSegments position={[0, 0.004, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#dde1e8" />
      </lineSegments>
    </group>
  );
}

function Lot({
  kind,
  hue,
  x,
  y,
  props,
  selected,
  invalid,
  ghost,
  onPointerDown,
  children,
}: {
  kind: AreaKind;
  hue: number;
  x: number;
  y: number;
  props: number;
  selected: boolean;
  invalid: boolean;
  ghost?: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  children: React.ReactNode;
}) {
  const models = KIND_MODELS[kind];
  const center = lotCenter(x, y);
  const [heroHeight, setHeroHeight] = useState(1);
  return (
    <group position={center} onPointerDown={onPointerDown} onClick={(event) => onPointerDown && event.stopPropagation()}>
      {selected && (
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[2.06, 0.04, 2.06]} />
          <meshStandardMaterial color={ACCENT} />
        </mesh>
      )}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.9, 0.08, 1.9]} />
        <meshStandardMaterial color={invalid ? "#e8857a" : padColor(hue, 80)} transparent={ghost} opacity={ghost ? 0.75 : 1} />
      </mesh>
      <Fitted id={models.hero} size={HERO_SIZE} maxHeight={1.5} position={[-0.42, 0.08, -0.42]} onHeight={setHeroHeight} />
      {PROP_SLOTS.slice(0, Math.min(props, PROP_SLOTS.length)).map(([px, pz, rotation], index) => (
        <Fitted key={index} id={models.props[index % models.props.length]} size={PROP_SIZE} maxHeight={0.65} position={[px, 0.08, pz]} rotation={rotation} />
      ))}
      <group position={[-0.42, heroHeight + 0.45, -0.42]}>{children}</group>
    </group>
  );
}

function Fitted({
  id,
  size,
  maxHeight,
  position,
  rotation = 0,
  onHeight,
}: {
  id: string;
  size: number;
  maxHeight: number;
  position: [number, number, number];
  rotation?: number;
  onHeight?: (height: number) => void;
}) {
  const { scene } = useGLTF(modelUrl(id), false, false);
  const object = useMemo(() => {
    const model = scene.clone(true);
    model.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const bounds = new Box3().setFromObject(model);
    const dims = bounds.getSize(new Vector3());
    const middle = bounds.getCenter(new Vector3());
    const scale = Math.min(size / Math.max(dims.x, dims.z), maxHeight / dims.y);
    model.scale.setScalar(scale);
    model.position.set(-middle.x * scale, -bounds.min.y * scale, -middle.z * scale);
    const wrapper = new Group();
    wrapper.add(model);
    wrapper.userData.height = dims.y * scale;
    return wrapper;
  }, [scene, size, maxHeight]);
  useEffect(() => onHeight?.(object.userData.height as number), [object, onHeight]);
  return <primitive object={object} position={position} rotation-y={rotation} />;
}

function MapLabel({
  name,
  open,
  processes,
  selected,
  interactive,
  onClick,
}: {
  name: string;
  open: number;
  processes: number;
  selected: boolean;
  interactive: boolean;
  onClick?: () => void;
}) {
  return (
    <Html center zIndexRange={[20, 0]} style={{ pointerEvents: interactive ? "auto" : "none" }}>
      <button type="button" className={`map-label${selected ? " selected" : ""}`} onClick={onClick} tabIndex={interactive ? 0 : -1}>
        <span className="map-label-name">{name}</span>
        {processes > 0 && <span className="map-label-count">{processes}</span>}
        {open > 0 && (
          <span className="map-label-badge" aria-label={`${open} open notes`}>
            {open}
          </span>
        )}
      </button>
    </Html>
  );
}

function FlowLine({ from, to, label }: { from: Vector3; to: Vector3; label: string }) {
  const line = useRef<{ material: { dashOffset: number } } | null>(null);
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * 0.8;
  });
  const a = from.clone().setY(0.12);
  const b = to.clone().setY(0.12);
  const middle = a.clone().add(b).multiplyScalar(0.5);
  const direction = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()), [a.x, a.z, b.x, b.z]);
  return (
    <group>
      <Line ref={line as never} points={[a, b]} color={FLOW_COLOR} lineWidth={2.5} dashed dashSize={0.25} gapSize={0.16} />
      <mesh position={middle} quaternion={direction}>
        <coneGeometry args={[0.15, 0.34, 20]} />
        <meshStandardMaterial color={FLOW_COLOR} />
      </mesh>
      {label && (
        <Html position={[middle.x, 0.35, middle.z]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <span className="flow-tag">{label}</span>
        </Html>
      )}
    </group>
  );
}
