"use client";

import Link from "next/link";
import { useExploreStore } from "@/store/useExploreStore";
import { iTunesCoverUrl } from "@/lib/itunesImage";
import { zoneForSimilarity } from "@/engine/SimilarityZones";

// 바다 컨셉 HUD — 게임처럼 가볍게. 잉크/좌표계측 톤 대신 항해 은유로:
//  - 좌하단: "COMPASS" 패널 — 실제 존으로 배를 이동시키는 버튼 3개
//    (Calm/Open은 fly-to, Storm Edge는 기존 블랙홀 워프 재사용)
//  - 최하단: 트랙 마퀴 티커 + 조작 힌트 바
const BOTTOM_STACK_HEIGHT = 68; // 마퀴(28px) + 힌트바(40px)

export default function ExploreHud() {
  const nodes = useExploreStore((state) => state.nodes);
  const hoveredTrackId = useExploreStore((state) => state.hoveredTrackId);
  const selectedTrackId = useExploreStore((state) => state.selectedTrackId);
  const setSelectedTrackId = useExploreStore((state) => state.setSelectedTrackId);
  const isWarping = useExploreStore((state) => state.isWarping);
  const startWarp = useExploreStore((state) => state.startWarp);

  // 선택된 곡은 3D 씬 안(ExploreNodeControls)이 카드 바로 아래에 컨트롤을
  // 붙여서 담당 — 여기선 hover만 가볍게 표시.
  const hoveredNode = selectedTrackId
    ? undefined
    : nodes.find((n) => n.trackId === hoveredTrackId);

  const focusZone = (zone: "HIGH" | "MID") => {
    if (nodes.length === 0) return;
    const candidates = nodes.filter((n) => zoneForSimilarity(n.similarity) === zone);
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setSelectedTrackId(pick.trackId);
  };

  const handleWarp = () => {
    if (nodes.length === 0) return;
    // 절대 임계값(-0.7) 대신 "가장 유사도가 낮은 쪽 10%"에서 뽑는다 — mock 데이터는
    // -1~1 범위라 절대 임계값도 맞지만, 실 데이터(코사인 유사도, 태그가 전부
    // 0 이상 가중치라 사실상 0~1 범위)엔 음수가 거의 없어 대척점이 안 잡힌다.
    const sorted = [...nodes].sort((a, b) => a.similarity - b.similarity);
    const pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.1)));
    const target = pool[Math.floor(Math.random() * pool.length)];
    startWarp(target.trackId);
  };

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

      {/* 좌하단: COMPASS 패널 — 존 이동 (하단 마퀴+힌트 바 위로 띄움) */}
      <div
        className="pointer-events-auto absolute left-4 w-[190px] rounded-2xl border border-[#0d2b3e] bg-[#eef7fa]/90 px-4 py-3"
        style={{ bottom: BOTTOM_STACK_HEIGHT + 16 }}
      >
        <div className="mb-2 text-[7px] tracking-[0.12em] opacity-60">COMPASS</div>
        <button
          onClick={() => focusZone("HIGH")}
          className="block w-full py-1.5 text-left text-[10px] tracking-[0.06em] opacity-70 transition-opacity hover:opacity-100"
        >
          ⛵ Calm Waters
        </button>
        <button
          onClick={() => focusZone("MID")}
          className="block w-full py-1.5 text-left text-[10px] tracking-[0.06em] opacity-70 transition-opacity hover:opacity-100"
        >
          🌊 Open Sea
        </button>
        <button
          onClick={handleWarp}
          disabled={isWarping}
          className={`block w-full rounded-full py-1.5 text-left text-[10px] tracking-[0.06em] transition-colors ${
            isWarping ? "bg-[#0d2b3e] pl-2 text-[#eef7fa]" : "opacity-70 hover:opacity-100"
          }`}
        >
          ⛈️ Storm Edge{isWarping ? " ···" : ""}
        </button>
      </div>

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
          <span className="mr-1 rounded-full border border-[#0d2b3e]/40 px-1 text-[9px]">DRAG</span>Steer
        </span>
        <span>
          <span className="mr-1 rounded-full border border-[#0d2b3e]/40 px-1 text-[9px]">SCROLL</span>Zoom
        </span>
        <span>
          <span className="mr-1 rounded-full border border-[#0d2b3e]/40 px-1 text-[9px]">CLICK</span>Board
        </span>
      </div>
    </div>
  );
}
