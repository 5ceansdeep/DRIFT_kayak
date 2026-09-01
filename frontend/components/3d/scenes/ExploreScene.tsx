"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Grid, Html } from "@react-three/drei";
import { useExploreStore } from "@/store/useExploreStore";
import { prefetchCovers } from "@/lib/itunesImage";
import { authHeader } from "@/lib/authClient";
import { OCEAN } from "@/lib/oceanTheme";
import ExploreStars from "../objects/ExploreStars";
import ExploreNodeControls from "../objects/ExploreNodeControls";
import SimilarityZoneShells from "../objects/SimilarityZoneShells";
import SerendipityComet from "../objects/SerendipityComet";
import type { TrackNode } from "@/types";

const FLOOR_Y = 0;
const SELF_LINK_COUNT = 5; // 원점(나)에서 뻗어나가는 연결선을 그릴 상위 유사도 곡 개수

// 각 노드 → 바닥 격자로 내려가는 짧은 수직 지시선. 등각 카메라에서
// "이 점이 바닥 어디 위에 떠 있는가"를 즉시 읽게 해주는 로피팝 차트 기법.
function useStemGeometry(nodes: TrackNode[]) {
  return useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(nodes.length * 6);
    nodes.forEach((n, i) => {
      const [x, y, z] = n.position3D;
      positions.set([x, FLOOR_Y, z, x, y, z], i * 6);
    });
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [nodes]);
}

// 원점(내 라이브러리) → 유사도 상위 곡들로 뻗는 연결선.
function useSelfLinkGeometry(nodes: TrackNode[]) {
  return useMemo(() => {
    const top = [...nodes].sort((a, b) => b.similarity - a.similarity).slice(0, SELF_LINK_COUNT);
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(top.length * 6);
    top.forEach((n, i) => {
      const [x, y, z] = n.position3D;
      positions.set([0, 0, 0, x, y, z], i * 6);
    });
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [nodes]);
}

// 장르별 무게중심 — "각 해변마다 다른 장르" 라벨을 붙일 위치.
// /api/explore가 같은 장르를 같은 방향으로 몰아 배치해주므로(genreClusterDirection)
// 여기선 평균만 내면 자연스럽게 그 성단 한가운데가 나온다.
function useGenreCentroids(nodes: TrackNode[]) {
  return useMemo(() => {
    const groups = new Map<string, [number, number, number][]>();
    nodes.forEach((n) => {
      const list = groups.get(n.genre) ?? [];
      list.push(n.position3D);
      groups.set(n.genre, list);
    });
    return Array.from(groups.entries()).map(([genre, positions]) => {
      const sum = positions.reduce(
        (acc, [x, y, z]) => [acc[0] + x, acc[1] + y, acc[2] + z] as [number, number, number],
        [0, 0, 0] as [number, number, number]
      );
      const n = positions.length;
      return { genre, position: [sum[0] / n, sum[1] / n, sum[2] / n] as [number, number, number] };
    });
  }, [nodes]);
}

export default function ExploreScene() {
  const setNodes = useExploreStore((state) => state.setNodes);
  const nodeCount = useExploreStore((state) => state.nodes.length);
  const nodes = useExploreStore((state) => state.nodes);
  const selectedTrackId = useExploreStore((state) => state.selectedTrackId);
  const selectedNode = nodes.find((n) => n.trackId === selectedTrackId) ?? null;

  const stemGeometry = useStemGeometry(nodes);
  const selfLinkGeometry = useSelfLinkGeometry(nodes);
  const genreCentroids = useGenreCentroids(nodes);

  useEffect(() => {
    if (nodeCount > 0) return;
    fetch("/api/explore", { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        setNodes(data.nodes);
        prefetchCovers(data.nodes.map((n: TrackNode) => n.coverUrl));
      })
      .catch((err) => console.error("[ExploreScene] failed to load nodes:", err));
  }, [nodeCount, setNodes]);

  return (
    <>
      {/* 바다 컨셉: 해수면 기준 격자. 원점(=내 라이브러리, 유사도 1.0 지점)과
          같은 높이에 깔아, 노드 구름을 가로지르는 "수면"처럼 보이게 한다. */}
      <Grid
        args={[500, 500]}
        position={[0, FLOOR_Y, 0]}
        cellColor={OCEAN.water}
        sectionColor={OCEAN.teal}
        cellThickness={0.4}
        sectionThickness={0.7}
        cellSize={10}
        sectionSize={50}
        fadeDistance={350}
        fadeStrength={1.5}
        infiniteGrid
        followCamera={false}
      />

      {/* 노드 → 수면 지시선 */}
      <lineSegments raycast={() => null}>
        <primitive object={stemGeometry} attach="geometry" />
        <lineBasicMaterial color={OCEAN.teal} transparent opacity={0.35} />
      </lineSegments>

      {/* 원점 → 상위 유사도 곡 연결선(항로) */}
      <lineSegments raycast={() => null}>
        <primitive object={selfLinkGeometry} attach="geometry" />
        <lineBasicMaterial color={OCEAN.coral} transparent opacity={0.3} />
      </lineSegments>

      {/* 장르별 성단 라벨 — 해변/구역 이름표 */}
      {genreCentroids.map(({ genre, position }) => (
        <Html key={genre} position={position} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-full border border-[#0d2b3e] bg-white/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#0d2b3e] opacity-70">
            {genre}
          </div>
        </Html>
      ))}

      <SimilarityZoneShells />

      {/* YOUR SHIP 앵커 — radiusForSimilarity(1) = 0, 즉 원점이 "나와 100%
          같은 지점"이라 여기가 곧 자기 자신의 위치다. 배 모양(선체+돛)으로 표시. */}
      <group position={[0, FLOOR_Y, 0]} raycast={() => null}>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[6, 1.6, 3]} />
          <meshToonMaterial color={OCEAN.ship} />
        </mesh>
        <mesh position={[0, 3, 0]}>
          <coneGeometry args={[2.2, 4.5, 4]} />
          <meshToonMaterial color="#ffffff" />
        </mesh>
        <Html position={[0, -3, 0]} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-full border border-[#0d2b3e] bg-white/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#0d2b3e] opacity-70">
            Your Ship
          </div>
        </Html>
      </group>

      <ExploreStars nodes={nodes} />
      <SerendipityComet />
      {selectedNode && <ExploreNodeControls node={selectedNode} />}
    </>
  );
}
