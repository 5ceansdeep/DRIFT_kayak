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
const SELECT_SCALE = 1.7; // 더 이상 카메라가 줌인하지 않으므로 크게 안 키움
const SCALE_LAMBDA = 10; // damp 계수 — 클수록 빠르게 반응
const SPIN_SPEED = 0.5; // LP판처럼 커버가 제자리에서 도는 속도

// 커버 URL을 three.js 텍스처로 로드하는 훅. drei의 useTexture(Suspense 기반)
// 대신 직접 로더를 써서, 실패(네트워크 오류·CORS 등)해도 앱 전체가 죽지
// 않고 그냥 커버 없는 카드(잉크 테두리만)로 조용히 폴백하게 한다.
function useCoverTexture(url: string | null): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      // url이 없어졌을 때(커버 없는 곡으로 바뀜)만 리셋 — 로더 콜백과 같은
      // "외부 리소스 로딩 결과 반영" 성격이라 동기 setState를 의도적으로 씀.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTexture(null);
      return;
    }
    const loader = new THREE.TextureLoader();
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
        if (!cancelled) setTexture(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

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
  const scaleRef = useRef(1);
  const [hovered, setHovered] = useState(false);

  const isSelected = useExploreStore((s) => s.selectedTrackId === node.trackId);
  const setHoveredTrackId = useExploreStore((s) => s.setHoveredTrackId);
  const setSelectedTrackId = useExploreStore((s) => s.setSelectedTrackId);

  const coverUrl = node.coverUrl ? iTunesCoverUrl(node.coverUrl, 200) : null;
  const cover = useCoverTexture(coverUrl);
  const layoutPos = useExploreStore((s) => s.waterLayout.get(node.trackId));
  const [wx, wy, wz] = layoutPos ?? waterPosition(node);

  useFrame(({ clock }, delta) => {
    const target = isSelected ? SELECT_SCALE : hovered ? HOVER_SCALE : 1;
    if (Math.abs(scaleRef.current - target) < 0.002) {
      scaleRef.current = target;
    } else {
      scaleRef.current = THREE.MathUtils.damp(scaleRef.current, target, SCALE_LAMBDA, delta);
    }
    groupRef.current?.scale.setScalar(scaleRef.current);

    const t = clock.getElapsedTime();
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
        {/* 코럴색 부표 프레임 — 커버가 없으면 이 원판만 보여 기존 마커와 동일하게 동작 */}
        <mesh>
          <circleGeometry args={[CARD_SIZE / 2 + RING_THICKNESS, 24]} />
          <meshToonMaterial color={OCEAN.coral} />
        </mesh>
        {cover && (
          <mesh ref={coverRef} position={[0, 0, 0.05]}>
            <planeGeometry args={[CARD_SIZE, CARD_SIZE]} />
            <meshBasicMaterial map={cover} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
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
