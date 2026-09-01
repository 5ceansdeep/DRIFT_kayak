"use client";

import dynamic from "next/dynamic";

// 원래 "우주" 컨셉의 탐험 화면 — 코사인 유사도 High/Mid/Low 존 분리 +
// 세렌디피티 혜성 + 대척점 블랙홀 워프. /explore가 바다/카약 컨셉으로
// 넘어가면서 별도 라우트로 분리했다.
const NebulaCanvasContainer = dynamic(
  () => import("@/components/3d/NebulaCanvasContainer"),
  {
    ssr: false,
    loading: () => (
      <main className="flex h-screen w-screen items-center justify-center bg-paper font-mono text-black">
        LOADING NEBULA UNIVERSE...
      </main>
    ),
  }
);

export default function NebulaPage() {
  return (
    <main className="h-screen w-screen bg-paper">
      <NebulaCanvasContainer />
    </main>
  );
}
