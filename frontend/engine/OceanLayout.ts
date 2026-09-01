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
const RADIUS_SCALE = 1.9; // 부표 간격이 좁아 보여서 전체적으로 더 밀어냄

export function waterPosition(node: {
  trackId: string;
  genre: string;
  similarity: number;
}): [number, number, number] {
  const genreAngle = ((hashString(node.genre) % 1000) / 1000) * Math.PI * 2;
  const jitter = ((hashString(node.trackId) % 1000) / 1000 - 0.5) * 0.9; // 같은 장르 안에서도 퍼지게
  const angle = genreAngle + jitter;
  // 유사도가 비슷한 곡끼리 반지름이 겹쳐 붙어 보이지 않도록 트랙별로 약간의
  // 반지름 지터도 섞는다(장르 각도 지터만으론 반지름 방향 겹침을 못 막음).
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
// 구역에 있는지 판정할 때 공용으로 쓴다.
export function genreCentroids<T extends { genre: string; similarity: number; trackId: string }>(
  nodes: T[]
): { genre: string; position: [number, number, number] }[] {
  const groups = new Map<string, [number, number, number][]>();
  nodes.forEach((n) => {
    const list = groups.get(n.genre) ?? [];
    list.push(waterPosition(n));
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
