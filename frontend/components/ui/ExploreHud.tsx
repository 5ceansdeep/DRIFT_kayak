"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useExploreStore } from "@/store/useExploreStore";
import { iTunesCoverUrl } from "@/lib/itunesImage";

// 카약 컨셉 HUD. 이동은 이제 WASD/방향키로 직접 하므로 클릭식 존 이동
// 패널(COMPASS)은 뺐고, 조작 힌트만 노 젓기 안내로 바꿨다.
const BOTTOM_STACK_HEIGHT = 68; // 마퀴(28px) + 힌트바(40px)
const REGION_TOAST_MS = 2500;

// currentRegion이 바뀔 때만 잠깐 슬라이드인했다가 사라지는 토스트.
function useRegionToast(region: string | null) {
  const [visible, setVisible] = useState(false);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (region && region !== prev.current) {
      // region prop 변화에 반응해 토스트를 잠깐 띄우는 전형적 패턴이라 동기 setState 의도적으로 씀.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), REGION_TOAST_MS);
      prev.current = region;
      return () => clearTimeout(timer);
    }
    prev.current = region;
  }, [region]);

  return visible;
}

export default function ExploreHud() {
  const nodes = useExploreStore((state) => state.nodes);
  const hoveredTrackId = useExploreStore((state) => state.hoveredTrackId);
  const selectedTrackId = useExploreStore((state) => state.selectedTrackId);
  const currentRegion = useExploreStore((state) => state.currentRegion);
  const showRegionToast = useRegionToast(currentRegion);

  // 선택된 곡은 3D 씬 안(ExploreNodeControls)이 카드 바로 아래에 컨트롤을
  // 붙여서 담당 — 여기선 hover만 가볍게 표시.
  const hoveredNode = selectedTrackId
    ? undefined
    : nodes.find((n) => n.trackId === hoveredTrackId);

  const marqueeText =
    nodes.length > 0 ? nodes.map((n) => `${n.title} — ${n.artist}`).join(" · ") : "SCANNING···";

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-[#0d2b3e]">
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-1 text-[11px]">
        <Link href="/galaxy" className="w-fit opacity-60 hover:opacity-100">
          ← GALAXY
        </Link>
        <Link href="/twin" className="w-fit opacity-40 hover:opacity-100">
          TWIN →
        </Link>
        <div className="opacity-40">{nodes.length > 0 ? nodes.length : "···"}</div>
      </div>

      {showRegionToast && currentRegion && (
        <div className="drift-panel-in pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-[#0d2b3e] bg-[#eef7fa]/90 px-4 py-1.5 text-[11px] tracking-[0.08em]">
          Region: <span className="font-bold">{currentRegion}</span>
        </div>
      )}

      {hoveredNode && (
        <div
          className="drift-panel-in pointer-events-none absolute right-4 flex max-w-xs items-center gap-2 rounded-2xl border border-[#0d2b3e] bg-[#eef7fa]/90 px-3 py-2 text-[11px]"
          style={{ bottom: BOTTOM_STACK_HEIGHT + 16 }}
        >
          {hoveredNode.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- 외부(iTunes) 원격 이미지, 썸네일 크기로 요청해 로딩 가볍게
            <img
              src={iTunesCoverUrl(hoveredNode.coverUrl, 80)!}
              alt=""
              decoding="async"
              className="h-10 w-10 rounded-full border border-[#0d2b3e] object-cover"
            />
          )}
          <div>
            <div className="font-bold">{hoveredNode.title}</div>
            <div className="opacity-70">{hoveredNode.artist}</div>
            <div className="opacity-50">{Math.round(hoveredNode.similarity * 100)}%</div>
          </div>
        </div>
      )}

      {/* 최하단 스택: 마퀴 티커 + 조작 힌트 바 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex h-7 items-center overflow-hidden border-y border-[#0d2b3e]/40 bg-[#eef7fa] text-[10px] tracking-[0.16em] opacity-70">
        <div className="drift-marquee-track">
          <span className="mx-[18px]">{marqueeText}</span>
          <span className="mx-[18px]">{marqueeText}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-10 items-center gap-5 border-t border-[#0d2b3e]/40 bg-[#eef7fa] px-4 text-[11px] tracking-[0.06em] opacity-70">
        <span>
          <span className="mr-1 rounded-full border border-[#0d2b3e]/40 px-1 text-[9px]">W A S D</span>Paddle
        </span>
        <span>
          <span className="mr-1 rounded-full border border-[#0d2b3e]/40 px-1 text-[9px]">↑↓←→</span>도 가능
        </span>
        <span>
          <span className="mr-1 rounded-full border border-[#0d2b3e]/40 px-1 text-[9px]">CLICK</span>Board
        </span>
      </div>
    </div>
  );
}
