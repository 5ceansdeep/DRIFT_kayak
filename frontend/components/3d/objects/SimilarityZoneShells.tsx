"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, type Mesh, type MeshBasicMaterial } from "three";
import { Html } from "@react-three/drei";
import { useExploreStore } from "@/store/useExploreStore";
import { zoneForSimilarity } from "@/engine/SimilarityZones";
import { WATER_RING_RADII, WATER_MAX_RADIUS } from "@/engine/OceanLayout";
import { OCEAN } from "@/lib/oceanTheme";

const IDLE_OPACITY = 0.12;
const ACTIVE_OPACITY = 0.4;
const LAMBDA = 8; // 목표 opacity로 damp되는 속도
const RING_WIDTH = 1.2;

// HIGH/MID/LOW 존 경계를 수면 위 동심원으로 표시. 배가 그 존의 곡에
// 가까워지면(호버/선택) 해당 원이 살짝 밝아진다.
export default function SimilarityZoneShells() {
  const calmRef = useRef<Mesh>(null!);
  const stormRef = useRef<Mesh>(null!);

  const nodes = useExploreStore((state) => state.nodes);
  const hoveredTrackId = useExploreStore((state) => state.hoveredTrackId);
  const selectedTrackId = useExploreStore((state) => state.selectedTrackId);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const focusId = hoveredTrackId ?? selectedTrackId;
    const focusNode = focusId ? nodes.find((n) => n.trackId === focusId) : undefined;
    const activeZone = focusNode ? zoneForSimilarity(focusNode.similarity) : null;

    const calmMat = calmRef.current?.material as MeshBasicMaterial | undefined;
    const stormMat = stormRef.current?.material as MeshBasicMaterial | undefined;

    const calmTarget =
      activeZone === "HIGH" || activeZone === "MID"
        ? ACTIVE_OPACITY
        : IDLE_OPACITY + Math.sin(t * 0.6) * 0.03;
    const stormTarget =
      activeZone === "MID" || activeZone === "LOW"
        ? ACTIVE_OPACITY
        : IDLE_OPACITY + Math.sin(t * 0.4 + 1.5) * 0.03;

    if (calmMat) calmMat.opacity += (calmTarget - calmMat.opacity) * Math.min(1, LAMBDA * delta);
    if (stormMat) stormMat.opacity += (stormTarget - stormMat.opacity) * Math.min(1, LAMBDA * delta);
  });

  return (
    <group>
      <mesh ref={calmRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} raycast={() => null}>
        <ringGeometry args={[WATER_RING_RADII.calm - RING_WIDTH, WATER_RING_RADII.calm, 48]} />
        <meshBasicMaterial color={OCEAN.teal} transparent opacity={IDLE_OPACITY} side={DoubleSide} />
      </mesh>
      <mesh ref={stormRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} raycast={() => null}>
        <ringGeometry args={[WATER_RING_RADII.storm - RING_WIDTH, WATER_RING_RADII.storm, 48]} />
        <meshBasicMaterial color={OCEAN.teal} transparent opacity={IDLE_OPACITY} side={DoubleSide} />
      </mesh>

      <Html position={[WATER_RING_RADII.calm * 0.6, 0.5, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-full border border-[#0d2b3e]/50 bg-white/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#0d2b3e] opacity-70">
          Calm Waters
        </div>
      </Html>
      <Html position={[WATER_RING_RADII.storm * 0.75, 0.5, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-full border border-[#0d2b3e]/50 bg-white/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#0d2b3e] opacity-70">
          Open Sea
        </div>
      </Html>
      <Html position={[WATER_MAX_RADIUS * 0.95, 0.5, 0]} center style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-full border border-[#0d2b3e]/50 bg-white/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[#0d2b3e] opacity-70">
          Storm Edge
        </div>
      </Html>
    </group>
  );
}
