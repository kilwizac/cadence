import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import { Vector3, type OrthographicCamera } from "three";
import { ActionIcon, Paper, Tooltip } from "@mantine/core";
import { IconFocusCentered, IconGrid4x4, IconMinus, IconPlus, IconRotate2, IconRotateClockwise2, IconTags } from "@tabler/icons-react";
import type { Area, AreaKind, Flow } from "../../shared/types";
import { canPlace, openNotes } from "../model";
import { FlowRoutes } from "./FlowRoutes";
import { MapLot } from "./MapLot";
import { SiteBoard } from "./SiteBoard";
import { cellAt, frameMap, lotCenter, MAX_ZOOM, MIN_ZOOM, viewpoint, type Cell } from "./mapView";

export type Placement = { name: string; hue: number; kind: AreaKind };
type MapHandle = { zoomBy(factor: number): void; fit(wholeSite?: boolean): void };
type Controls = { target: Vector3; enabled: boolean; update(): void };
const bearings = ["SE", "NE", "NW", "SW"];

interface Props {
  areas: Area[];
  flows: Flow[];
  selectedId: string | null;
  placement: Placement | null;
  onSelect: (id: string | null) => void;
  onPlace: (cell: Cell) => void;
  onMove: (id: string, cell: Cell) => void;
}

export function MapScene(props: Props) {
  const handle = useRef<MapHandle | null>(null);
  const [turn, setTurn] = useState(0);
  const [labels, setLabels] = useState(true);
  return (
    <div className={labels ? "canvas" : "canvas labels-hidden"}>
      <Canvas orthographic shadows="percentage" flat frameloop="demand" dpr={[1, 2]}
        camera={{ position: [20, 20, 20], zoom: 40, near: 0.1, far: 200 }}>
        <Scene {...props} handle={handle} turn={turn} />
      </Canvas>
      <Paper className="zoom-controls" withBorder p={4} role="group" aria-label="Map framing">
        <MapButton label="Zoom out" onClick={() => handle.current?.zoomBy(1 / 1.25)}><IconMinus /></MapButton>
        <MapButton label="Zoom in" onClick={() => handle.current?.zoomBy(1.25)}><IconPlus /></MapButton>
        <span className="map-tool-divider" />
        <MapButton label="Frame areas" onClick={() => handle.current?.fit()}><IconFocusCentered /></MapButton>
        <MapButton label="Show whole site" onClick={() => handle.current?.fit(true)}><IconGrid4x4 /></MapButton>
        <span className="map-tool-divider" />
        <MapButton label="Map labels" pressed={labels} onClick={() => setLabels((shown) => !shown)}><IconTags /></MapButton>
      </Paper>
      <Paper className="bearing-controls" withBorder p={4} role="group" aria-label="Map orientation">
        <MapButton label="Rotate view left" onClick={() => setTurn((n) => (n + 3) % 4)}><IconRotate2 /></MapButton>
        <span className="bearing" aria-label={`View from ${bearings[turn]}`} title={`View from ${bearings[turn]}`}>
          <svg width="21" height="21" viewBox="-11 -11 22 22" aria-hidden="true">
            <g transform={`rotate(${viewpoint(turn).northAngle})`}>
              <path d="M0-10 3.5 0 0 2-3.5 0Z" fill="#a65236" />
              <path d="M0 9.5 3.5 0 0 1-3.5 0Z" fill="#8b9c96" />
            </g>
          </svg>
          {bearings[turn]}
        </span>
        <MapButton label="Rotate view right" onClick={() => setTurn((n) => (n + 1) % 4)}><IconRotateClockwise2 /></MapButton>
      </Paper>
    </div>
  );
}

function MapButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant={pressed ? "light" : "subtle"} color="gray" aria-label={label} aria-pressed={pressed} onClick={onClick}>{children}</ActionIcon>
    </Tooltip>
  );
}

function CameraRig({ handle, turn, areas, selectedId }: Pick<Props, "areas" | "selectedId"> & { handle: RefObject<MapHandle | null>; turn: number }) {
  const controls = useThree((state) => state.controls) as unknown as Controls | null;
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const { width, height } = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const orient = useCallback(() => {
    if (!controls) return;
    const { sin, cos } = viewpoint(turn);
    camera.position.set(sin * Math.SQRT2 * 20, 20, cos * Math.SQRT2 * 20).add(controls.target);
    controls.update();
    invalidate();
  }, [camera, controls, invalidate, turn]);
  useLayoutEffect(orient, [orient]);

  const fit = useCallback((wholeSite = false) => {
    if (!controls || !width || !height) return;
    const frame = frameMap(wholeSite ? [] : areas, turn, width, height);
    controls.target.set(frame.x, 0, frame.z);
    camera.zoom = frame.zoom;
    camera.updateProjectionMatrix();
    orient();
  }, [areas, camera, controls, height, orient, turn, width]);
  useImperativeHandle(handle, () => ({
    fit,
    zoomBy: (factor) => {
      camera.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * factor));
      camera.updateProjectionMatrix();
      controls?.update();
      invalidate();
    },
  }), [camera, controls, fit, invalidate]);

  const framed = useRef<boolean | null>(null);
  const populated = areas.length > 0;
  useLayoutEffect(() => {
    if (!controls || !width || !height || framed.current === populated) return;
    framed.current = populated;
    fit();
  }, [controls, fit, populated, width, height]);

  const selected = areas.find((area) => area.id === selectedId);
  const selectedX = selected?.x, selectedY = selected?.y;
  useLayoutEffect(() => {
    if (!controls || selectedX === undefined || selectedY === undefined || !width || !height) return;
    const { x, z } = lotCenter({ x: selectedX, y: selectedY });
    const target = new Vector3(x, 0.5, z);
    const point = target.clone().project(camera);
    if (Math.abs(point.x) < 0.78 && Math.abs(point.y) < 0.78) return;
    camera.position.sub(controls.target).add(target);
    controls.target.copy(target);
    controls.update();
    invalidate();
  }, [camera, controls, height, invalidate, selectedX, selectedY, width]);
  return <MapControls makeDefault enableRotate={false} enableDamping={false} screenSpacePanning={false} zoomToCursor minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} />;
}

function Scene({ areas, flows, selectedId, placement, onSelect, onPlace, onMove, handle, turn }: Props & { handle: RefObject<MapHandle | null>; turn: number }) {
  const controls = useThree((state) => state.controls) as unknown as Controls | null;
  const canvas = useThree((state) => state.gl.domElement);
  const surface = useThree((state) => state.events.connected);
  const [hover, setHover] = useState<Cell | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const hoverRef = useRef<Cell | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    hoverRef.current = null;
    setHover(null);
  }, [placement]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const current = drag.current;
      if (current && !current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 4) {
        current.moved = true;
        setDraggingId(current.id);
      }
    };
    const endDrag = () => {
      drag.current = null;
      if (controls) controls.enabled = true;
      setDraggingId(null);
    };
    const up = () => {
      const current = drag.current;
      if (!current) return;
      endDrag();
      if (!current.moved) return onSelect(current.id);
      const cell = hoverRef.current;
      if (cell && canPlace(areas, cell.x, cell.y, current.id)) onMove(current.id, cell);
    };
    const leave = () => {
      hoverRef.current = null;
      setHover(null);
    };
    surface?.addEventListener("pointerleave", leave);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", endDrag);
    return () => {
      surface?.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", endDrag);
    };
  }, [areas, surface, controls, onMove, onSelect]);

  const ghostValid = Boolean(placement && hover && canPlace(areas, hover.x, hover.y));
  useEffect(() => {
    canvas.style.cursor = placement ? (ghostValid ? "copy" : "not-allowed") : draggingId ? "grabbing" : "grab";
  }, [canvas, placement, ghostValid, draggingId]);

  const trackHover = (event: ThreeEvent<PointerEvent>) => {
    if (!placement && !drag.current) return;
    const cell = cellAt(event.point);
    hoverRef.current = cell;
    setHover((current) => (current && current.x === cell.x && current.y === cell.y ? current : cell));
  };
  const startDrag = (event: ThreeEvent<PointerEvent>, area: Area) => {
    if (placement || event.button !== 0) return;
    event.stopPropagation();
    drag.current = { id: area.id, x: event.clientX, y: event.clientY, moved: false };
    hoverRef.current = { x: area.x, y: area.y };
    setHover(hoverRef.current);
    if (controls) controls.enabled = false;
  };
  const dragCell = draggingId ? hover : null;
  const positions = useMemo(() => new Map(
    areas.map((area) => [area.id, (draggingId === area.id && dragCell) || { x: area.x, y: area.y }]),
  ), [areas, dragCell, draggingId]);

  if (!surface) return null;
  return (
    <>
      <CameraRig handle={handle} turn={turn} areas={areas} selectedId={selectedId} />
      <hemisphereLight args={["#f1f5ff", "#a8a38c", 1.48]} />
      <directionalLight position={[-9, 14, 6]} color="#fff1d7" intensity={2.65} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15}
        shadow-camera-far={42} shadow-normalBias={0.012} shadow-bias={-0.0002} shadow-radius={2.5} />
      <directionalLight position={[5, 6, -10]} color="#e2edf8" intensity={0.62} />
      <SiteBoard />
      <mesh rotation-x={-Math.PI / 2} onPointerMove={trackHover} onClick={(event) => {
        if (event.delta > 4) return;
        if (!placement) return onSelect(null);
        const cell = cellAt(event.point);
        if (canPlace(areas, cell.x, cell.y)) onPlace(cell);
      }}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <FlowRoutes flows={flows} positions={positions} selectedId={selectedId} />
      {areas.map((area) => {
        const cell = positions.get(area.id)!;
        const moving = draggingId === area.id;
        return (
          <MapLot key={area.id} cell={cell} kind={area.kind} hue={area.hue} name={area.name || "Untitled area"}
            processes={area.processes.length} openNotes={openNotes(area).length} selected={area.id === selectedId}
            preview={moving ? "move" : undefined} invalid={moving && !canPlace(areas, cell.x, cell.y, area.id)}
            onPointerDown={placement ? undefined : (event) => startDrag(event, area)}
            onSelect={placement ? undefined : () => onSelect(area.id)} />
        );
      })}
      {placement && hover && <MapLot {...placement} cell={hover} processes={0} preview="place" invalid={!ghostValid} />}
    </>
  );
}
