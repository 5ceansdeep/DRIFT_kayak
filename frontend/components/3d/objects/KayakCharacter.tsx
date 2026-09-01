"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useExploreStore } from "@/store/useExploreStore";
import { spatialAudioEngine } from "@/engine/SpatialAudioEngine";
import { waterPosition, genreCentroids, nearestGenre } from "@/engine/OceanLayout";
import { waveHeight } from "@/engine/OceanWaves";

const ACCEL = 34; // 노 젓는 가속도
const DRAG = 1.6; // 클수록 빨리 감속(마찰/저항) — 놓으면 관성으로 미끄러지다 멈춤
const MAX_SPEED = 22;
const CAMERA_OFFSET = new THREE.Vector3(0, 14, 22); // 뒤+위에서 따라가는 3인칭 카메라
const CAMERA_LERP = 4;
const PLAY_RADIUS = 34; // 이 안으로 들어오면 재생 시작
const STOP_RADIUS = 46; // 이 밖으로 나가면 정지 (히스테리시스로 경계 깜빡임 방지)
const SELECT_RADIUS = 40; // 스페이스바로 선택 가능한 최대 거리
const WAVE_SLOPE_EPS = 1.5;
const ANIM_FPS = 13; // 고무찰흙 스톱모션 느낌 — 자세(파도 흔들림/노젓기)만 이 속도로 갱신

// ponytail: 진짜 유체역학(부력/항력 시뮬레이션)은 안 씀 — 속도+가속+감쇠(drag)로
// "관성 있게 미끄러지는" 느낌만 흉내내고, 기울기는 파도 함수의 기울기(유한차분)를
// 그대로 읽어서 붙인다. 실제 파도 충돌/부표 충돌도 없음.
export default function KayakCharacter() {
  const groupRef = useRef<THREE.Group>(null!);
  const hullRef = useRef<THREE.Group>(null!); // 파도 흔들림(위치/롤/피치) — 스톱모션 프레임레이트로 갱신
  const paddleRef = useRef<THREE.Group>(null!);
  const velocity = useRef(new THREE.Vector3());
  const animAcc = useRef(0);
  const { pressed, selectPressedRef } = useKeyboard();
  const { camera } = useThree();
  const nodes = useExploreStore((s) => s.nodes);
  const setSelectedTrackId = useExploreStore((s) => s.setSelectedTrackId);
  const setCurrentRegion = useExploreStore((s) => s.setCurrentRegion);
  const nearby = useRef<Set<string>>(new Set());
  const centroids = useMemo(() => genreCentroids(nodes), [nodes]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.getElapsedTime();

    // ── 이동: 고정 월드축 기준 전후좌우 + 관성(가속/감쇠) ──
    const input = new THREE.Vector3(
      (pressed.current.right ? 1 : 0) - (pressed.current.left ? 1 : 0),
      0,
      (pressed.current.back ? 1 : 0) - (pressed.current.forward ? 1 : 0)
    );
    const moving = input.lengthSq() > 0;
    if (moving) velocity.current.addScaledVector(input.normalize(), ACCEL * delta);
    velocity.current.multiplyScalar(Math.max(0, 1 - DRAG * delta));
    if (velocity.current.length() > MAX_SPEED) velocity.current.setLength(MAX_SPEED);
    group.position.addScaledVector(velocity.current, delta);
    if (velocity.current.lengthSq() > 0.3) {
      const heading = Math.atan2(velocity.current.x, velocity.current.z);
      group.rotation.y = THREE.MathUtils.damp(group.rotation.y, heading, 6, delta);
    }

    // ── 자세(파도에 뜬 느낌)는 12~15fps로만 갱신 — 고무찰흙 스톱모션 미학 ──
    animAcc.current += delta;
    if (animAcc.current >= 1 / ANIM_FPS) {
      animAcc.current = 0;
      const gx = group.position.x;
      const gz = group.position.z;
      const h = waveHeight(gx, gz, t);
      const hx = waveHeight(gx + WAVE_SLOPE_EPS, gz, t);
      const hz = waveHeight(gx, gz + WAVE_SLOPE_EPS, t);
      if (hullRef.current) {
        hullRef.current.position.y = h * 0.5;
        hullRef.current.rotation.z = -((hx - h) / WAVE_SLOPE_EPS) * 1.5 - velocity.current.x * 0.01;
        hullRef.current.rotation.x = ((hz - h) / WAVE_SLOPE_EPS) * 1.5 + velocity.current.z * 0.01;
      }
      if (paddleRef.current) {
        paddleRef.current.rotation.z = moving ? Math.sin(t * 6) * 0.5 : Math.sin(t * 1.2) * 0.06;
      }
    }

    // ── 3인칭 추격 카메라 (부드럽게, 매 프레임) ──
    camera.position.lerp(group.position.clone().add(CAMERA_OFFSET), Math.min(1, CAMERA_LERP * delta));
    camera.lookAt(group.position.x, group.position.y + 2, group.position.z);

    // ── 지금 있는 장르 구역 갱신 ──
    setCurrentRegion(nearestGenre(group.position.x, group.position.z, centroids));

    // ── 리스너 위치 + 근접 시 자동 재생/정지 ──
    spatialAudioEngine.updateListenerPosition([group.position.x, group.position.y, group.position.z]);
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    nodes.forEach((n) => {
      const [nx, ny, nz] = waterPosition(n);
      const dist = Math.hypot(group.position.x - nx, group.position.z - nz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = n.trackId;
      }
      const isNear = nearby.current.has(n.trackId);
      // "/audio/sample.mp3"는 실제 파일이 없는 폴백 경로 — 미리듣기 없는 곡을
      // 근접할 때마다 헛 요청을 쏘지 않도록 건너뛴다.
      if (!isNear && dist < PLAY_RADIUS && n.audioUrl !== "/audio/sample.mp3") {
        spatialAudioEngine.registerAndPlay(n.trackId, n.audioUrl, [nx, ny, nz]);
        nearby.current.add(n.trackId);
      } else if (isNear && dist > STOP_RADIUS) {
        spatialAudioEngine.stop(n.trackId);
        nearby.current.delete(n.trackId);
      }
    });

    // ── 스페이스바: 사거리 안 가장 가까운 부표 선택 ──
    if (selectPressedRef.current) {
      selectPressedRef.current = false;
      if (nearestId && nearestDist < SELECT_RADIUS) setSelectedTrackId(nearestId);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 40]}>
      <group ref={hullRef}>
        {/* 카약 선체 */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[1.1, 5, 4, 8]} />
          <meshToonMaterial color="#ffb84d" />
        </mesh>

        {/* 사람 — 고무찰흙 느낌 (둥근 primitive만 사용) */}
        <group position={[0, 1.3, 0]}>
          <mesh>
            <capsuleGeometry args={[0.85, 1.4, 4, 8]} />
            <meshToonMaterial color="#ff8a65" />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshToonMaterial color="#ffd7b5" />
          </mesh>
          {/* 노 */}
          <group ref={paddleRef} position={[0, 0.5, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.08, 0.08, 4.4, 8]} />
              <meshToonMaterial color="#6b4a2f" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
