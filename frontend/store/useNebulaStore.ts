import { create } from "zustand";
import { TrackNode } from "@/types";

// /nebula(우주 컨셉) 전용 스토어 — /explore(바다/카약 컨셉)와는 완전히
// 분리된 독립 상태. 둘 다 같은 /api/explore 데이터를 쓰지만 시각화가
// 다르므로 스토어도 따로 둔다.
interface NebulaState {
  nodes: TrackNode[];
  hoveredTrackId: string | null;
  selectedTrackId: string | null;
  // 블랙홀 워프: 대척점(안티포드) 존의 노드로 카메라를 급이동시키는 연출.
  isWarping: boolean;
  warpTargetId: string | null;

  setNodes: (nodes: TrackNode[]) => void;
  setHoveredTrackId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  startWarp: (nodeId: string) => void;
  endWarp: () => void;
}

export const useNebulaStore = create<NebulaState>((set) => ({
  nodes: [],
  hoveredTrackId: null,
  selectedTrackId: null,
  isWarping: false,
  warpTargetId: null,

  setNodes: (nodes) => set({ nodes }),
  setHoveredTrackId: (id) => set({ hoveredTrackId: id }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  startWarp: (nodeId) => set({ isWarping: true, warpTargetId: nodeId }),
  endWarp: () => set({ isWarping: false, warpTargetId: null }),
}));
