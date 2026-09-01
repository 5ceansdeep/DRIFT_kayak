"use client";

import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useExploreStore } from "@/store/useExploreStore";
import { spatialAudioEngine } from "@/engine/SpatialAudioEngine";
import { getToken, authHeader } from "@/lib/authClient";
import { waterPosition } from "@/engine/OceanLayout";
import type { TrackNode } from "@/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// 노드 클릭 시 뜨는 최소 컨트롤 — 화면 어딘가에 따로 뜨는 패널이 아니라,
// 확대된 앨범 커버 카드 바로 아래에 재생바 + 아카이브 버튼만 붙는다.
// 드리이 Html은 매 프레임 노드의 3D 위치를 화면 좌표로 재투영해주므로,
// 카메라가 fly-to 애니메이션 중이어도 항상 카드 바로 아래를 따라간다.
export default function ExploreNodeControls({ node }: { node: TrackNode }) {
  const setSelectedTrackId = useExploreStore((s) => s.setSelectedTrackId);
  const layoutPos = useExploreStore((s) => s.waterLayout.get(node.trackId));
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0, paused: true });
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const trackId = node.trackId;
  const token = getToken();

  useEffect(() => {
    setArchived(false);
    const tick = () => {
      const state = spatialAudioEngine.getPlaybackState(trackId);
      if (state) setPlayback(state);
    };
    tick();
    const interval = setInterval(tick, 200);
    return () => clearInterval(interval);
  }, [trackId]);

  const progress = playback.duration > 0 ? playback.currentTime / playback.duration : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || playback.duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    spatialAudioEngine.seek(trackId, ratio * playback.duration);
  };

  const handleArchive = async () => {
    if (archiving || archived) return;
    setArchiving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/songs/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          title: node.title,
          artist: node.artist,
          coverUrl: node.coverUrl,
          previewUrl: node.audioUrl,
          source: "recommend",
        }),
      });
      if (res.ok) setArchived(true);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Html position={layoutPos ?? waterPosition(node)} center style={{ pointerEvents: "none" }}>
      <div
        className="drift-panel-in pointer-events-auto flex w-56 flex-col items-center gap-2 rounded-2xl border border-[#0d2b3e] bg-[#eef7fa]/90 px-3 py-2 font-mono text-[#0d2b3e] backdrop-blur-sm"
        // ponytail: 부표 카드 크기(CARD_SIZE*SELECT_SCALE, ExploreStars.tsx)에 맞춘
        // 고정 오프셋. 그 값들이 커지면 여기도 같이 늘려야 함 — 동적 계산은 과함.
        style={{ transform: "translateY(70px)" }}
      >
        <div className="flex w-full items-center gap-2">
          <button
            onClick={() => spatialAudioEngine.togglePlay(trackId)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#0d2b3e] text-[10px]"
          >
            {playback.paused ? "▶" : "❚❚"}
          </button>
          <div
            ref={barRef}
            onClick={handleSeek}
            className="relative h-1 flex-1 cursor-pointer rounded-full bg-[#0d2b3e]/15"
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#ff8a65]" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="w-14 shrink-0 text-right text-[9px] opacity-50">
            {formatTime(playback.currentTime)} / {formatTime(playback.duration)}
          </div>
        </div>

        <div className="flex w-full items-center gap-2">
          {token && (
            <button
              onClick={handleArchive}
              disabled={archiving || archived}
              className="flex-1 rounded-full border border-[#0d2b3e] py-1 text-[9px] tracking-[0.06em] disabled:opacity-50"
            >
              {archived ? "✓ ARCHIVED" : archiving ? "···" : "+ ARCHIVE"}
            </button>
          )}
          <button
            onClick={() => setSelectedTrackId(null)}
            className="rounded-full border border-[#0d2b3e] px-2 py-1 text-[9px] opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      </div>
    </Html>
  );
}
