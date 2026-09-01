// 바다 컨셉 전용 2D(수면) 좌표 매핑. 기존 3D 구면 좌표(SimilarityZones.radiusForSimilarity)
// 공식은 그대로 재사용하되, Y(고도)를 버리고 X/Z(수면) 평면에만 투영한다.
// 백엔드/API(/api/explore)는 그대로 — 이 파일은 순수 프론트엔드 재해석이다.
import { radiusForSimilarity, MAX_RADIUS as SPHERE_MAX_RADIUS } from "./SimilarityZones";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const START_CLEARANCE = 14; // 배 출발지점 바로 앞이 곡으로 꽉 차지 않도록 두는 여백
const RADIUS_SCALE = 1.9;
// 같은 장르 안에서 곡이 하나씩 늘어날 때마다 반지름이 이만큼씩 커진다 —
// 유사도값이 서로 비슷해 자연 반지름 차이가 거의 없어도, 이 스텝이 최소
// 간격을 강제로 보장한다("노 저어서 다음 부표까지" 가는 느낌을 위해).
const RING_STEP = 30;
const SECTOR_FAN = 0.22; // 같은 장르 안에서도 완전히 일직선이 되지 않도록 살짝 부채꼴로 벌림

type LayoutNode = { trackId: string; genre: string; similarity: number };

// 노드 전체를 한 번에 받아서 장르별로 묶고, 그 안에서 유사도 높은 순으로
// 안쪽부터 바깥쪽으로 늘어놓는다 — 각 곡마다 최소 RING_STEP만큼 떨어지는
// 게 보장돼서, 비슷한 유사도 곡들이 붙어 보이는 문제가 안 생긴다.
export function computeWaterLayout(nodes: LayoutNode[]): Map<string, [number, number, number]> {
  const byGenre = new Map<string, LayoutNode[]>();
  nodes.forEach((n) => {
    const list = byGenre.get(n.genre) ?? [];
    list.push(n);
    byGenre.set(n.genre, list);
  });

  const layout = new Map<string, [number, number, number]>();
  byGenre.forEach((list, genre) => {
    const sectorAngle = ((hashString(genre) % 1000) / 1000) * Math.PI * 2;
    const sorted = [...list].sort((a, b) => b.similarity - a.similarity);
    sorted.forEach((n, i) => {
      const fan = ((hashString(n.trackId) % 1000) / 1000 - 0.5) * SECTOR_FAN;
      const angle = sectorAngle + fan;
      const radius = radiusForSimilarity(n.similarity) * RADIUS_SCALE + START_CLEARANCE + i * RING_STEP;
      layout.set(n.trackId, [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
    });
  });
  return layout;
}

// 레이아웃 맵에 없는 노드(엣지 케이스 대비)용 단독 계산 폴백 — 최소 간격 보장은
// 안 되지만 죽지는 않는다.
export function waterPosition(node: LayoutNode): [number, number, number] {
  const genreAngle = ((hashString(node.genre) % 1000) / 1000) * Math.PI * 2;
  const jitter = ((hashString(node.trackId) % 1000) / 1000 - 0.5) * 0.9;
  const angle = genreAngle + jitter;
  const radialJitter = (hashString(node.trackId + "r") % 1000) / 1000;
  const radius = radiusForSimilarity(node.similarity) * RADIUS_SCALE + START_CLEARANCE + radialJitter * 18;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

export const WATER_RING_RADII = {
  calm: radiusForSimilarity(1 / 3) * RADIUS_SCALE + START_CLEARANCE,
  storm: radiusForSimilarity(-1 / 3) * RADIUS_SCALE + START_CLEARANCE,
};

export const WATER_MAX_RADIUS = SPHERE_MAX_RADIUS * RADIUS_SCALE + START_CLEARANCE;

// 장르 하나 = 색상 하나(해시 기반 hue). 임의의 장르 문자열에도 항상 같은
// 색이 나오므로 룩업 테이블을 따로 관리할 필요가 없다.
export function genreColor(genre: string): string {
  const hue = hashString(genre) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

// 장르별 무게중심 — "각 해변마다 다른 장르" 라벨 위치 + 카약이 지금 어느
// 구역에 있는지 판정할 때 공용으로 쓴다. layout이 있으면 그걸 우선 쓰고,
// 없는 노드만 waterPosition으로 폴백.
export function genreCentroids<T extends LayoutNode>(
  nodes: T[],
  layout?: Map<string, [number, number, number]>
): { genre: string; position: [number, number, number] }[] {
  const groups = new Map<string, [number, number, number][]>();
  nodes.forEach((n) => {
    const list = groups.get(n.genre) ?? [];
    list.push(layout?.get(n.trackId) ?? waterPosition(n));
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
}

// 주어진 위치에서 가장 가까운 장르 성단 = "지금 있는 구역".
export function nearestGenre(
  x: number,
  z: number,
  centroids: { genre: string; position: [number, number, number] }[]
): string | null {
  if (centroids.length === 0) return null;
  let best = centroids[0];
  let bestDist = Infinity;
  for (const c of centroids) {
    const d = Math.hypot(x - c.position[0], z - c.position[2]);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.genre;
}
