"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { useExploreStore } from "@/store/useExploreStore";
import { iTunesCoverUrl } from "@/lib/itunesImage";
import { OCEAN } from "@/lib/oceanTheme";
import { waterPosition } from "@/engine/OceanLayout";
import { waveHeight } from "@/engine/OceanWaves";
import type { TrackNode } from "@/types";

const CARD_SIZE = 5;
const RING_THICKNESS = 0.9; // 부표 프레임(코럴 테두리) 두께
const HOVER_SCALE = 1.4;
const AUDIBLE_SCALE = 2.0; // 들리는 반경 안 — 호버보다 확실히 커 보이게
const SELECT_SCALE = 1.7; // 더 이상 카메라가 줌인하지 않으므로 크게 안 키움
const SCALE_LAMBDA = 10; // damp 계수 — 클수록 빠르게 반응
const SPIN_SPEED = 0.5; // LP판처럼 커버가 제자리에서 도는 속도
const HOLOGRAM_HEIGHT = 4.2; // 커버가 부표 위에 떠 있는 높이
const PULSE_SPEED = 4;
const PULSE_AMOUNT = 0.08; // 들리는 동안 숨쉬듯 커졌다 작아졌다
const PUNCH_DURATION = 0.6; // 아카이빙 순간 한 번 튀어오르는 연출 길이(초)
const PUNCH_AMOUNT = 0.5;
const ARCHIVED_COLOR = "#ffd700";

// 커버 URL을 three.js 텍스처로 로드하는 훅. drei의 useTexture(Suspense 기반)
// 대신 직접 로더를 써서, 실패(네트워크 오류·CORS 등)해도 앱 전체가 죽지
// 않고 그냥 커버 없는 카드(잉크 테두리만)로 조용히 폴백하게 한다.
//
// 부표가 한꺼번에(십수~수십 개) 뜨면 iTunes CDN 한 origin에 그만큼 동시
// CORS 이미지 요청이 몰려서, 하나하나는 금방 끝나도 브라우저의 origin당
// 동시 연결 제한 때문에 전체는 몇 초~십수 초씩 걸린다("커버가 안 뜬다"는
// 건 사실 이 대기시간이었다 — 실제론 다 뜨긴 함). lowUrl(80px, 이미 HUD용
// prefetchCovers가 브라우저 캐시에 데워둔 크기)을 먼저 걸어서 거의 즉시
// 뭔가 보이게 하고, highUrl(200px, 선명한 버전)이 나중에 도착하면 덮어쓴다.
function useCoverTexture(lowUrl: string | null, highUrl: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!lowUrl && !highUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 리소스 로딩 결과 반영과 같은 성격
      setTexture(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    const load = (url: string) => {
      loader.load(
        url,
        (tex) => {
          if (cancelled) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          setTexture(tex);
        },
        undefined,
        () => {
          /* 실패해도 조용히 무시 — 이미 뜬 저해상도가 있으면 그대로 유지 */
        }
      );
    };
    if (lowUrl) load(lowUrl);
    if (highUrl) load(highUrl);
    return () => {
      cancelled = true;
    };
  }, [lowUrl, highUrl]);

  return texture;
}

// 노드 하나 = 실제 앨범 커버 사진이 붙은 부표. 항상 카메라를 바라보도록
// Billboard로 감싸고, 호버/선택 시 부드럽게 확대되며 잔잔하게 위아래로
// 흔들린다. 노드마다 텍스처가 달라서(InstancedMesh는 인스턴스별 텍스처를
// 못 씀) 개별 메시로 렌더링한다 — Explore 후보곡 수(수십 개)에선 문제 없음.
function TrackCard({ node }: { node: TrackNode }) {
  const billboardRef = useRef<THREE.Group>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const coverRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const scaleRef = useRef(1);
  const wasArchivedRef = useRef(false);
  const punchStartRef = useRef<number | null>(null); // 아카이빙 순간의 clock 시각 — null이면 재생 중 아님
  const [hovered, setHovered] = useState(false);

  const isSelected = useExploreStore((s) => s.selectedTrackId === node.trackId);
  const isAudible = useExploreStore((s) => s.nearbyTrackIds.has(node.trackId));
  const isArchived = useExploreStore((s) => s.archivedTrackIds.has(node.trackId));
  const setHoveredTrackId = useExploreStore((s) => s.setHoveredTrackId);
  const setSelectedTrackId = useExploreStore((s) => s.setSelectedTrackId);

  const lowCoverUrl = node.coverUrl ? iTunesCoverUrl(node.coverUrl, 80) : null;
  const highCoverUrl = node.coverUrl ? iTunesCoverUrl(node.coverUrl, 200) : null;
  const cover = useCoverTexture(lowCoverUrl, highCoverUrl);
  const layoutPos = useExploreStore((s) => s.waterLayout.get(node.trackId));
  const [wx, wy, wz] = layoutPos ?? waterPosition(node);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    // 방금 아카이빙됐으면(false→true 전환 순간) 한 번 튀어오르는 펀치 애니메이션 시작
    if (isArchived && !wasArchivedRef.current) punchStartRef.current = t;
    wasArchivedRef.current = isArchived;

    const target = isSelected ? SELECT_SCALE : isAudible ? AUDIBLE_SCALE : hovered ? HOVER_SCALE : 1;
    if (Math.abs(scaleRef.current - target) < 0.002) {
      scaleRef.current = target;
    } else {
      scaleRef.current = THREE.MathUtils.damp(scaleRef.current, target, SCALE_LAMBDA, delta);
    }
    // 들리는 반경 안에선 숨쉬듯 살짝 펄스
    const pulse = isAudible ? 1 + Math.sin(t * PULSE_SPEED) * PULSE_AMOUNT : 1;
    // 아카이빙 펀치 — 지속시간 지나면 자동으로 꺼짐(ease-out)
    let punch = 1;
    if (punchStartRef.current !== null) {
      const elapsed = t - punchStartRef.current;
      if (elapsed < PUNCH_DURATION) {
        const progress = elapsed / PUNCH_DURATION;
        punch = 1 + Math.sin(progress * Math.PI) * PUNCH_AMOUNT * (1 - progress);
      } else {
        punchStartRef.current = null;
      }
    }
    groupRef.current?.scale.setScalar(scaleRef.current * pulse * punch);

    const bob = waveHeight(wx, wz, t) * 0.6; // 부표도 물과 같은 파도 공식을 탄다
    billboardRef.current?.position.set(wx, wy + bob, wz);
    if (coverRef.current) coverRef.current.rotation.z += delta * SPIN_SPEED;
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    setHoveredTrackId(node.trackId);
  };
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    setHoveredTrackId(null);
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedTrackId(node.trackId);
  };

  return (
    <Billboard ref={billboardRef} position={[wx, wy, wz]}>
      <group
        ref={groupRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        {/* 부표 프레임 — 실사 톤(PBR). 아카이빙되면 금색으로 바뀜 */}
        <mesh ref={ringRef}>
          <circleGeometry args={[CARD_SIZE / 2 + RING_THICKNESS, 24]} />
          <meshStandardMaterial
            color={isArchived ? ARCHIVED_COLOR : OCEAN.coral}
            roughness={isArchived ? 0.25 : 0.5}
            metalness={isArchived ? 0.6 : 0.1}
          />
        </mesh>
        {cover && (
          <>
            {/* 부표↔커버를 잇는 홀로그램 빔 */}
            <mesh position={[0, HOLOGRAM_HEIGHT / 2, 0]}>
              <cylinderGeometry args={[0.04, 0.04, HOLOGRAM_HEIGHT, 8]} />
              <meshBasicMaterial color={OCEAN.coral} transparent opacity={0.35} depthWrite={false} />
            </mesh>
            {/* 앨범 커버 — 부표에 붙어있지 않고 위에 홀로그램처럼 떠 있음 */}
            <mesh ref={coverRef} position={[0, HOLOGRAM_HEIGHT, 0]}>
              <planeGeometry args={[CARD_SIZE, CARD_SIZE]} />
              <meshBasicMaterial map={cover} toneMapped={false} transparent opacity={0.88} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </>
        )}
      </group>
    </Billboard>
  );
}

export default function ExploreStars({ nodes }: { nodes: TrackNode[] }) {
  return (
    <>
      {nodes.map((node) => (
        <TrackCard key={node.trackId} node={node} />
      ))}
    </>
  );
}
