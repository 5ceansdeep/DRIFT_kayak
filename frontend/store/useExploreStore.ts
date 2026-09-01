import { create } from "zustand";
import { TrackNode } from "@/types";
import { computeWaterLayout } from "@/engine/OceanLayout";

// /explore 전용 스토어. Galaxy/Twin 스토어와 분리된 독립 우주.
interface ExploreState {
  nodes: TrackNode[];
  // 노드의 수면 좌표 — nodes 전체를 한 번에 봐야 장르별 최소 간격을
  // 보장할 수 있어서(engine/OceanLayout.computeWaterLayout), setNodes 때
  // 한 번만 계산해 여기 캐싱한다. 컴포넌트마다 따로 계산하지 않는다.
  waterLayout: Map<string, [number, number, number]>;
  hoveredTrackId: string | null;
  selectedTrackId: string | null;
  // 카약이 지금 떠 있는 장르 구역(가장 가까운 장르 성단). KayakCharacter가
  // 매 프레임 갱신, HUD의 "Region: xxx" 슬라이드인 표시와 물색 틴트에 사용.
  currentRegion: string | null;
  // 지금 재생 반경 안에 들어와서 실제로 소리가 나는 트랙들 — 소속이 바뀔
  // 때만(매 프레임이 아니라) 갱신, ExploreStars가 "들리고 있음" 연출에 씀.
  nearbyTrackIds: Set<string>;
  // 아카이브에 담긴 트랙 — ExploreNodeControls가 저장 성공 시 채우고,
  // ExploreStars가 부표를 "수집됨"으로 표시하는 데 씀.
  archivedTrackIds: Set<string>;
  // 가장 가까운(아직 안 들은) 부표를 화면에서 가리키는 방향 — 카메라 기준
  // 화면 좌표계에서 계산한 각도(도, 0=위쪽 기준 시계방향). HUD 화살표용.
  nextBuoyScreenAngle: number | null;
  // 개발자 모드: 카약 추격 카메라 대신 자유 궤도 카메라로 전체 지역을
  // 내려다볼 수 있게(M 키 토글). KayakCharacter/ExploreScene이 함께 본다.
  devMode: boolean;

  setNodes: (nodes: TrackNode[]) => void;
  setHoveredTrackId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  setCurrentRegion: (region: string | null) => void;
  setNearbyTrackIds: (ids: Set<string>) => void;
  addArchivedTrackId: (id: string) => void;
  setNextBuoyScreenAngle: (deg: number | null) => void;
  toggleDevMode: () => void;
}

export const useExploreStore = create<ExploreState>((set) => ({
  nodes: [],
  waterLayout: new Map(),
  hoveredTrackId: null,
  selectedTrackId: null,
  currentRegion: null,
  nearbyTrackIds: new Set(),
  archivedTrackIds: new Set(),
  nextBuoyScreenAngle: null,
  devMode: false,

  setNodes: (nodes) => set({ nodes, waterLayout: computeWaterLayout(nodes) }),
  setHoveredTrackId: (id) => set({ hoveredTrackId: id }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  setCurrentRegion: (region) => set({ currentRegion: region }),
  setNearbyTrackIds: (ids) => set({ nearbyTrackIds: ids }),
  addArchivedTrackId: (id) =>
    set((s) => ({ archivedTrackIds: new Set(s.archivedTrackIds).add(id) })),
  setNextBuoyScreenAngle: (deg) => set({ nextBuoyScreenAngle: deg }),
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
}));
