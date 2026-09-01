"use client";

import { useEffect } from "react";
import { useNebulaStore } from "@/store/useNebulaStore";
import { prefetchCovers } from "@/lib/itunesImage";
import { authHeader } from "@/lib/authClient";
import NebulaStars from "../objects/NebulaStars";
import NebulaZoneShells from "../objects/NebulaZoneShells";
import NebulaComet from "../objects/NebulaComet";
import type { TrackNode } from "@/types";

// /explore(바다/카약 컨셉)와 같은 /api/explore 데이터를 쓴다 —
// position3D(구면 좌표)를 그대로 쓰는 원래 우주 시각화.
export default function NebulaScene() {
  const setNodes = useNebulaStore((state) => state.setNodes);
  const nodeCount = useNebulaStore((state) => state.nodes.length);
  const nodes = useNebulaStore((state) => state.nodes);

  useEffect(() => {
    if (nodeCount > 0) return;
    fetch("/api/explore", { headers: authHeader() })
      .then((res) => res.json())
      .then((data) => {
        setNodes(data.nodes);
        prefetchCovers(data.nodes.map((n: TrackNode) => n.coverUrl));
      })
      .catch((err) => console.error("[NebulaScene] failed to load nodes:", err));
  }, [nodeCount, setNodes]);

  return (
    <>
      <NebulaZoneShells />
      <NebulaStars nodes={nodes} />
      <NebulaComet />
    </>
  );
}
