import { Suspense, useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { Html, Line, useGLTF, useTexture } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { IconBan, IconCheck, IconFlag3 } from "@tabler/icons-react";
import { Box3, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, SRGBColorSpace, Vector3, type Mesh } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { AreaKind } from "../../shared/types";
import { plural } from "../model";
import { KIND_MODELS, modelUrl } from "./assets";
import courtyardPaint from "./courtyard.svg";
import yardPaint from "./loading-yard.svg";
import { lotCenter, type Cell } from "./mapView";

const DECK = 0.15;
const plinth = new RoundedBoxGeometry(1.94, DECK, 1.94, 1, 0.035);
const slots = [
  [0.60, -0.55, 0], [0.60, 0.04, 0], [0.60, 0.62, Math.PI / 2],
  [0.02, 0.62, 0], [-0.57, 0.62, Math.PI / 2],
];
const corners: [number, number, number][] = [];
for (const x of [-1, 1]) for (const z of [-1, 1]) {
  corners.push([x * 0.72, DECK + 0.025, z], [x, DECK + 0.025, z], [x, DECK + 0.025, z], [x, DECK + 0.025, z * 0.72]);
}

function siteFurniture(courtyard: boolean) {
  const parts: BufferGeometry[] = [];
  const part = (geometry: BufferGeometry, color: string, x: number, y: number, z: number) => {
    const shape = geometry.index ? geometry.toNonIndexed() : geometry;
    shape.translate(x, y, z);
    shape.deleteAttribute("uv");
    const colors = new Float32Array(shape.getAttribute("position").count * 3);
    const paint = new Color(color);
    for (let i = 0; i < colors.length; i += 3) paint.toArray(colors, i);
    shape.setAttribute("color", new Float32BufferAttribute(colors, 3));
    parts.push(shape);
  };
  if (courtyard) {
    part(new BoxGeometry(0.24, 0.065, 0.25), "#b2ad95", 0.34, 0.0325, -0.78);
    part(new CylinderGeometry(0.022, 0.029, 0.3, 6), "#856b50", 0.34, 0.18, -0.78);
    part(new IcosahedronGeometry(0.20).scale(0.88, 1.16, 0.9), "#708b60", 0.34, 0.42, -0.78);
    part(new IcosahedronGeometry(0.14).rotateY(0.6), "#92a673", 0.38, 0.54, -0.78);
  } else {
    part(new BoxGeometry(0.11, 0.06, 0.11), "#bec1ae", 0.34, 0.03, -0.80);
    part(new CylinderGeometry(0.015, 0.022, 0.60, 6), "#546465", 0.34, 0.34, -0.80);
    part(new BoxGeometry(0.18, 0.026, 0.03), "#546465", 0.42, 0.63, -0.80);
    part(new BoxGeometry(0.11, 0.037, 0.063), "#e0d8b6", 0.50, 0.622, -0.80);
    for (const x of [-0.84, 0.28]) {
      part(new CylinderGeometry(0.024, 0.027, 0.13, 6), "#d4a243", x, 0.065, 0.30);
      part(new CylinderGeometry(0.025, 0.025, 0.028, 6), "#474c49", x, 0.09, 0.30);
    }
  }
  return mergeGeometries(parts);
}

const yardFurniture = siteFurniture(false);
const gardenFurniture = siteFurniture(true);

function Pavement({ courtyard }: { courtyard: boolean }) {
  const paint = useTexture(courtyard ? courtyardPaint : yardPaint);
  useLayoutEffect(() => {
    if (paint.colorSpace === SRGBColorSpace && paint.anisotropy === 8) return;
    paint.colorSpace = SRGBColorSpace;
    paint.anisotropy = 8;
    paint.needsUpdate = true;
  }, [paint]);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={DECK + 0.002} receiveShadow>
      <planeGeometry args={[1.80, 1.80]} />
      <meshStandardMaterial map={paint} roughness={0.93} />
    </mesh>
  );
}

interface LotProps {
  cell: Cell;
  kind: AreaKind;
  hue: number;
  name: string;
  processes: number;
  openNotes?: number;
  selected?: boolean;
  preview?: "place" | "move";
  invalid?: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onSelect?: () => void;
}

export function MapLot({ cell, kind, hue, name, processes, openNotes = 0, selected, preview, invalid, onPointerDown, onSelect }: LotProps) {
  const center = lotCenter(cell);
  const models = KIND_MODELS[kind];
  const courtyard = kind === "purchasing" || kind === "sales" || kind === "engineering" || kind === "office";
  const [heroHeight, setHeroHeight] = useState(0.7);
  const address = String.fromCharCode(65 + cell.y) + String(cell.x + 1).padStart(2, "0");
  const details = [name, address, plural(processes, "process", "processes"), plural(openNotes, "open note")].join(", ");
  return (
    <group position={[center.x, invalid ? 0.03 : 0, center.z]} onPointerDown={onPointerDown} onClick={onPointerDown && ((event) => event.stopPropagation())}>
      {invalid ? (
        <mesh position-y={DECK + 0.004} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[1.94, 1.94]} />
          <meshBasicMaterial color="#b34731" transparent opacity={0.40} depthWrite={false} />
        </mesh>
      ) : (
        <>
          <mesh geometry={plinth} position-y={DECK / 2} castShadow receiveShadow>
            <meshStandardMaterial color={`hsl(${hue}, 49%, 56%)`} />
          </mesh>
          <Suspense fallback={null}><Pavement courtyard={courtyard} /></Suspense>
          <mesh geometry={courtyard ? gardenFurniture : yardFurniture} position-y={DECK} castShadow receiveShadow>
            <meshStandardMaterial vertexColors flatShading />
          </mesh>
          <Suspense fallback={null}>
            <Fitted id={models.hero} size={1.16} maxHeight={1.52} position={[-0.32, DECK, -0.32]} onHeight={setHeroHeight} />
            {slots.slice(0, processes).map(([x, z, rotation], index) => (
              <Fitted key={index} id={models.props[index % models.props.length]} size={0.49} maxHeight={0.68} position={[x, DECK, z]} rotation={rotation} />
            ))}
          </Suspense>
        </>
      )}
      {(selected || preview) && <Line points={corners} segments lineWidth={3} color={invalid ? "#b43227" : "#2468c1"} />}
      <Html position={invalid ? [0, DECK + 0.52, 0] : [-0.32, DECK + heroHeight + 0.48, -0.32]} center zIndexRange={selected || preview ? [26, 22] : [20, 12]} style={{ pointerEvents: onSelect && !preview ? "auto" : "none" }}>
        {preview ? (
          <span className={`map-preview${invalid ? " blocked" : ""}`}>
            {invalid ? <IconBan size={14} /> : <IconCheck size={14} />}
            {invalid ? "Can't place here" : preview === "move" ? "Drop here" : name}
            {!invalid && <span className="preview-address">{address}</span>}
          </span>
        ) : (
          <button type="button" className={`map-label${selected ? " selected" : ""}`} style={{ "--lot-accent": `hsl(${hue} 58% 48%)` } as CSSProperties}
            onClick={onSelect} disabled={!onSelect} aria-label={details} title={details} aria-expanded={Boolean(selected)}>
            <span className="map-label-name">{name}</span>
            {processes > 0 && <span className="map-label-count">{processes}</span>}
            {openNotes > 0 && <span className="map-label-badge"><IconFlag3 size={10} stroke={2} />{openNotes}</span>}
          </button>
        )}
      </Html>
    </group>
  );
}

function Fitted({ id, size, maxHeight, position, rotation = 0, onHeight }: {
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
      if ((child as Mesh).isMesh) child.castShadow = child.receiveShadow = true;
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
