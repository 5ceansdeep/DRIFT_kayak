"use client";

import { useEffect, useMemo } from "react";
import { Html } from "@react-three/drei";
import { useExploreStore } from "@/store/useExploreStore";
import { prefetchCovers } from "@/lib/itunesImage";
import { authHeader } from "@/lib/authClient";
import { genreCentroids as computeGenreCentroids } from "@/engine/OceanLayout";
import ExploreStars from "../objects/ExploreStars";
import ExploreNodeControls from "../objects/ExploreNodeControls";
import SimilarityZoneShells from "../objects/SimilarityZoneShells";
import SerendipityComet from "../objects/SerendipityComet";
import OceanWater from "../objects/OceanWater";
import KayakCharacter from "../objects/KayakCharacter";
import type { TrackNode } from "@/types";

export default function ExploreScene() {
  const setNodes = useExploreStore((state) => state.setNodes);
  const nodeCount = useExploreStore((state) => state.nodes.length);
  const nodes = useExploreStore((state) => state.nodes);
  const selectedTrackId = useExploreStore((state) => state.selectedTrackId);
  const selectedNode = nodes.find((n) => n.trackId === selectedTrackId) ?? null;

  // 장르별 무게중심 — "각 해변마다 다른 장르" 라벨 위치. KayakCharacter도
  // 같은 함수(engine/OceanLayout)로 "지금 있는 구역"을 판정한다.
  const genreCentroids = useMemo(() => computeGenreCentroids(nodes), [nodes]);

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
      <OceanWater />

      {/* 장르별 성단 라벨 — 해변/구역 이름표 */}
      {genreCentroids.map(({ genre, position }) => (
        <Html key={genre} position={position} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-full border border-[#0d2b3e] bg-white/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#0d2b3e] opacity-70">
            {genre}
          </div>
        </Html>
      ))}

      <SimilarityZoneShells />
      <KayakCharacter />
      <ExploreStars nodes={nodes} />
      <SerendipityComet />
      {selectedNode && <ExploreNodeControls node={selectedNode} />}
    </>
  );
}
