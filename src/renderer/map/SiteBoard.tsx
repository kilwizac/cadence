import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { SRGBColorSpace } from "three";
import { GRID_SIZE } from "../model";
import { SITE_RIM, SITE_WIDTH } from "./mapView";

function drawSitePlan() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext("2d")!;
  const unit = canvas.width / SITE_WIDTH;
  ctx.scale(unit, unit);
  ctx.fillStyle = "#465c59";
  ctx.fillRect(0, 0, SITE_WIDTH, SITE_WIDTH);
  ctx.translate(SITE_RIM, SITE_RIM);
  ctx.fillStyle = "#becfc1";
  ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);

  for (let i = 0; i <= GRID_SIZE; i++) {
    ctx.strokeStyle = i % 3 === 0 ? "#8da69a" : "#a7bcaf";
    ctx.lineWidth = i % 3 === 0 ? 0.014 : 0.009;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, GRID_SIZE);
    ctx.moveTo(0, i);
    ctx.lineTo(GRID_SIZE, i);
    ctx.stroke();
  }
  ctx.strokeStyle = "#eef1df";
  ctx.lineWidth = 0.021;
  ctx.beginPath();
  for (let x = 3; x < GRID_SIZE; x += 3) {
    for (let z = 3; z < GRID_SIZE; z += 3) {
      ctx.moveTo(x - 0.10, z);
      ctx.lineTo(x + 0.10, z);
      ctx.moveTo(x, z - 0.10);
      ctx.lineTo(x, z + 0.10);
    }
  }
  ctx.stroke();
  ctx.strokeStyle = "#ebecd5";
  ctx.lineWidth = 0.023;
  ctx.strokeRect(-0.035, -0.035, GRID_SIZE + 0.07, GRID_SIZE + 0.07);

  ctx.translate(GRID_SIZE / 2, GRID_SIZE / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 20px monospace";
  for (let side = 0; side < 4; side++) {
    ctx.save();
    ctx.translate(-GRID_SIZE / 2, -GRID_SIZE / 2);
    ctx.fillStyle = "#d6e1cf";
    for (let i = 0; i < GRID_SIZE; i++) {
      const index = side < 2 ? i : GRID_SIZE - i - 1;
      const label = side % 2 === 0 ? String(index + 1).padStart(2, "0") : String.fromCharCode(65 + index);
      ctx.save();
      ctx.translate(i + 0.5, -0.26);
      ctx.scale(0.0095, 0.0095);
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.fillRect(i - 0.009, i % 3 === 0 ? -0.23 : -0.15, 0.018, i % 3 === 0 ? 0.18 : 0.10);
    }
    ctx.fillStyle = "#deb578";
    ctx.fillRect(-0.36, -0.36, 0.22, 0.038);
    ctx.fillRect(-0.36, -0.36, 0.038, 0.22);
    ctx.fillStyle = "#82928b";
    ctx.beginPath();
    ctx.arc(-0.21, -0.21, 0.074, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#334843";
    ctx.lineWidth = 0.018;
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.24);
    ctx.lineTo(-0.17, -0.18);
    ctx.stroke();
    ctx.restore();
    ctx.rotate(Math.PI / 2);
  }
  return canvas;
}

export function SiteBoard() {
  const artwork = useMemo(drawSitePlan, []);
  const contact = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = ctx.shadowColor = "#303e36";
    ctx.shadowBlur = 9;
    ctx.fillRect(16, 16, 224, 224);
    return canvas;
  }, []);
  return (
    <group>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position-y={-0.56}>
        <planeGeometry args={[300, 300]} />
        <shadowMaterial transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.558}>
        <planeGeometry args={[SITE_WIDTH * 8 / 7, SITE_WIDTH * 8 / 7]} />
        <meshBasicMaterial transparent opacity={0.28} depthWrite={false}>
          <canvasTexture attach="map" args={[contact]} colorSpace={SRGBColorSpace} />
        </meshBasicMaterial>
      </mesh>
      <RoundedBox args={[SITE_WIDTH - 0.12, 0.26, SITE_WIDTH - 0.12]} position-y={-0.42} radius={0.05} smoothness={1} bevelSegments={1} castShadow>
        <meshStandardMaterial color="#3b4b49" />
      </RoundedBox>
      <RoundedBox args={[SITE_WIDTH + 0.04, 0.075, SITE_WIDTH + 0.04]} position-y={-0.29} radius={0.025} smoothness={1} bevelSegments={1}>
        <meshStandardMaterial color="#b4a889" metalness={0.28} roughness={0.56} />
      </RoundedBox>
      <RoundedBox args={[SITE_WIDTH + 0.08, 0.26, SITE_WIDTH + 0.08]} position-y={-0.13} radius={0.04} smoothness={1} bevelSegments={1} castShadow receiveShadow>
        <meshStandardMaterial color="#526663" />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position-y={0.002} receiveShadow>
        <planeGeometry args={[SITE_WIDTH, SITE_WIDTH]} />
        <meshStandardMaterial roughness={0.92}>
          <canvasTexture attach="map" args={[artwork]} colorSpace={SRGBColorSpace} anisotropy={8} />
        </meshStandardMaterial>
      </mesh>
    </group>
  );
}
