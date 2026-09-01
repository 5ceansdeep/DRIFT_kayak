import { create } from "zustand";
import { TrackNode } from "@/types";

// /explore 전용 스토어. Galaxy/Twin 스토어와 분리된 독립 우주.
interface ExploreState {
  nodes: TrackNode[];
  hoveredTrackId: string | null;
  selectedTrackId: string | null;
  // 카약이 지금 떠 있는 장르 구역(가장 가까운 장르 성단). KayakCharacter가
  // 매 프레임 갱신, HUD의 "Region: xxx" 슬라이드인 표시와 물색 틴트에 사용.
  currentRegion: string | null;

  setNodes: (nodes: TrackNode[]) => void;
  setHoveredTrackId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  setCurrentRegion: (region: string | null) => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  nodes: [],
  hoveredTrackId: null,
  selectedTrackId: null,
  currentRegion: null,

  setNodes: (nodes) => set({ nodes }),
  setHoveredTrackId: (id) => set({ hoveredTrackId: id }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setCurrentRegion: (region) => set({ currentRegion: region }),
}));
