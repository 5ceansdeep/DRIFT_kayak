import { NextResponse } from "next/server";
import type { TrackNode } from "@/types";
import { fetchRecommendCandidates } from "@/lib/driftBackend";
import { radiusForSimilarity } from "@/engine/SimilarityZones";

// 실 데이터 연동: backend GET /songs/recommend/full(코사인 유사도)를 우선 시도.
// 백엔드가 꺼져 있거나 후보곡이 없으면(아카이브 전, taste_vector 없음 등)
// mock으로 자동 폴백 — docs/tech-spec.md 2.3/3.6 참고.
// ponytail: 예전엔 600개였는데, 실 데이터 쪽을 이미 40개로 캡해놨어서(위 slice)
// 폴백만 600개면 개별 메시 600개(카드+텍스처+useFrame 600번)로 렌더가
// 사실상 멈춘 것처럼 느려진다 — 실 데이터와 같은 규모로 맞춤.
const GENRES = ["Noise Rock", "Free Jazz", "Drone", "IDM", "Field Recording", "Krautrock"];
const NODE_COUNT = 40;

function randomUnitVector(): [number, number, number] {
  // 구면상 균등 분포 (Marsaglia 방법)
  let x, y, z, d2;
  do {
    x = Math.random() * 2 - 1;
    y = Math.random() * 2 - 1;
    z = Math.random() * 2 - 1;
    d2 = x * x + y * y + z * z;
  } while (d2 === 0 || d2 > 1);
  const d = Math.sqrt(d2);
  return [x / d, y / d, z / d];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// 같은 장르 곡은 원점(내 라이브러리) 기준 같은 방향으로 몰아서 "장르별 성단"처럼
// 뭉치게 한다. 장르 문자열을 시드로 쓴 고정 방향 + 약간의 랜덤 지터.
function genreClusterDirection(genre: string): [number, number, number] {
  const h = hashString(genre);
  const theta = ((h % 1000) / 1000) * Math.PI * 2;
  const phi = (((h >>> 10) % 1000) / 1000) * Math.PI;
  const bx = Math.sin(phi) * Math.cos(theta);
  const by = Math.cos(phi);
  const bz = Math.sin(phi) * Math.sin(theta);

  const JITTER = 0.35;
  const [jx, jy, jz] = randomUnitVector();
  const x = bx + jx * JITTER;
  const y = by + jy * JITTER;
  const z = bz + jz * JITTER;
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / len, y / len, z / len];
}

function generateMockNodes(): TrackNode[] {
  const nodes: TrackNode[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const similarity = Math.random() * 2 - 1; // -1 ~ 1
    const radius = radiusForSimilarity(similarity);
    const genre = GENRES[i % GENRES.length];
    const [ux, uy, uz] = genreClusterDirection(genre);

    nodes.push({
      trackId: `exp-track-${i}`,
      title: `Explore Track ${i}`,
      artist: `Explore Artist ${i % 24}`,
      position3D: [ux * radius, uy * radius, uz * radius],
      similarity,
      lastPlayedAt: new Date(
        Date.now() - Math.random() * 180 * 24 * 3600 * 1000
      ).toISOString(),
      audioUrl: "/audio/sample.mp3",
      genre,
    });
  }
  return nodes;
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const overrideToken = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

  try {
    // recommendFull은 유사도순 정렬된 "아카이브 안 한 곡 전체"라 카탈로그가
    // 크면 화면이 앨범 카드로 뒤덮인다 — 상위 40개만 보여준다.
    const candidates = (await fetchRecommendCandidates(overrideToken)).slice(0, 40);
    if (candidates.length === 0) {
      throw new Error("추천 후보 없음 (아카이브 곡 없음 또는 taste_vector 미생성)");
    }

    const nodes: TrackNode[] = candidates.map((c) => {
      // recommend 결과엔 3D 위치가 없다 — 반지름은 실제 유사도, 방향은 장르 클러스터.
      const radius = radiusForSimilarity(Math.max(-1, Math.min(1, c.similarity)));
      const genre = c.genreTags[0] ?? "Unknown";
      const [ux, uy, uz] = genreClusterDirection(genre);

      return {
        trackId: c.id,
        title: c.title,
        artist: c.artist,
        position3D: [ux * radius, uy * radius, uz * radius],
        similarity: c.similarity,
        lastPlayedAt: new Date().toISOString(),
        audioUrl: c.previewUrl ?? "/audio/sample.mp3",
        genre,
        coverUrl: c.coverUrl,
      };
    });

    return NextResponse.json({ nodes, source: "backend" });
  } catch (err) {
    console.warn("[api/explore] backend 연동 실패, mock 데이터로 폴백:", err);
    return NextResponse.json({ nodes: generateMockNodes(), source: "mock" });
  }
}
