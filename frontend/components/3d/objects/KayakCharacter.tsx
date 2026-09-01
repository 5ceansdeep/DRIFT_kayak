"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useExploreStore } from "@/store/useExploreStore";
import { spatialAudioEngine } from "@/engine/SpatialAudioEngine";
import { waterPosition, genreCentroids, nearestGenre } from "@/engine/OceanLayout";
import { waveHeight } from "@/engine/OceanWaves";
import { generateNormalMapTexture } from "@/lib/proceduralNormalMap";

const THRUST = 30; // 노 젓는 힘(임펄스) — 관성/감쇠는 RigidBody의 linearDamping이 담당
const BUOYANCY_K = 7; // 부력 스프링 계수 — 잠긴 깊이에 비례해 밀어 올림
const CAMERA_OFFSET = new THREE.Vector3(0, 20, 11); // 뒤+위에서 따라가는 3인칭 카메라 — 위쪽 비중을 키워 더 둔각으로, 전체 거리는 더 가깝게
const CAMERA_LERP = 4;
// OceanLayout의 RING_STEP(같은 장르 내 최소 간격, 30)보다 작게 잡아야
// 인접한 두 부표 사거리가 겹쳐서 동시에 재생되는 일이 없다.
const PLAY_RADIUS = 20; // 이 안으로 들어오면 재생 시작
const STOP_RADIUS = 28; // 이 밖으로 나가면 정지 (히스테리시스로 경계 깜빡임 방지)
const SELECT_RADIUS = 24; // 스페이스바로 선택 가능한 최대 거리
const ANIM_FPS = 13; // 고무찰흙 스톱모션 느낌 — 화면에 보이는 메시만 이 속도로 갱신

// 뱃머리/고물/좌현/우현 4점에서 각각 부력을 재서 자연스럽게 피치/롤이 생기게 함.
const FLOAT_POINTS: [number, number, number][] = [
  [0, 0, -2.5],
  [0, 0, 2.5],
  [-0.9, 0, 0],
  [0.9, 0, 0],
];

// ponytail: Cannon/Rapier 급 완전한 유체 시뮬레이션은 아님 — 4점 부력 스프링 +
// 감쇠로 "물에 뜬 것 같은" 반응을 흉내내는 수준. 파도 함수(OceanWaves)는
// 물 셰이더와 공유해서 시각적으로는 "같은 파도"를 보는 것처럼 맞춘다.
export default function KayakCharacter() {
  const bodyRef = useRef<RapierRigidBody>(null!);
  const visualRef = useRef<THREE.Group>(null!); // 실제 렌더되는 메시 — 물리 바디와 분리해서 스톱모션 프레임레이트로만 갱신
  const paddleRef = useRef<THREE.Group>(null!);
  const animAcc = useRef(0);
  const tmpPoint = useRef(new THREE.Vector3());
  const tmpQuat = useRef(new THREE.Quaternion());
  const tmpEuler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));

  const { pressed, selectPressedRef } = useKeyboard();
  const { camera } = useThree();
  const nodes = useExploreStore((s) => s.nodes);
  const waterLayout = useExploreStore((s) => s.waterLayout);
  const setSelectedTrackId = useExploreStore((s) => s.setSelectedTrackId);
  const setCurrentRegion = useExploreStore((s) => s.setCurrentRegion);
  const nearby = useRef<Set<string>>(new Set());
  const centroids = useMemo(() => genreCentroids(nodes, waterLayout), [nodes, waterLayout]);
  // 점토 표면의 "지문/뭉툭함" 느낌을 내는 범프 노멀맵 — 물결용과 같은 생성기,
  // 돌기를 더 작고 촘촘하게. 리마운트 때마다 새로 생기니 언마운트 시 dispose.
  const clayNormal = useMemo(() => generateNormalMapTexture(128, 50, 3, 8, 0.35), []);
  useEffect(() => () => clayNormal.dispose(), [clayNormal]);

  useFrame(({ clock }, delta) => {
    const body = bodyRef.current;
    if (!body) return;
    const t = clock.getElapsedTime();
    const pos = body.translation();
    const rot = body.rotation();

    // ── 추진력: WASD/방향키 → 임펄스 ──
    const input = new THREE.Vector3(
      (pressed.current.right ? 1 : 0) - (pressed.current.left ? 1 : 0),
      0,
      (pressed.current.back ? 1 : 0) - (pressed.current.forward ? 1 : 0)
    );
    const moving = input.lengthSq() > 0;
    if (moving) {
      input.normalize().multiplyScalar(THRUST * delta);
      body.applyImpulse({ x: input.x, y: 0, z: input.z }, true);
    }

    // ── 부력: 4점에서 각각 수면 아래로 잠긴 만큼 위로 미는 힘 → 자연스러운 피치/롤 ──
    const bodyQuat = tmpQuat.current.set(rot.x, rot.y, rot.z, rot.w);
    FLOAT_POINTS.forEach(([lx, ly, lz]) => {
      const world = tmpPoint.current.set(lx, ly, lz).applyQuaternion(bodyQuat);
      world.x += pos.x;
      world.y += pos.y;
      world.z += pos.z;
      const waterY = waveHeight(world.x, world.z, t);
      const submersion = waterY - world.y;
      if (submersion > 0) {
        body.applyImpulseAtPoint(
          { x: 0, y: submersion * BUOYANCY_K * delta, z: 0 },
          { x: world.x, y: world.y, z: world.z },
          true
        );
      }
    });

    // ── 3인칭 추격 카메라 (실제 물리 위치를 매 프레임 부드럽게 따라감) ──
    camera.position.lerp(
      new THREE.Vector3(pos.x, pos.y, pos.z).add(CAMERA_OFFSET),
      Math.min(1, CAMERA_LERP * delta)
    );
    camera.lookAt(pos.x, pos.y + 2, pos.z);

    // ── 화면에 보이는 메시는 12~15fps로만 물리 결과를 복사 — 고무찰흙 스톱모션 ──
    animAcc.current += delta;
    if (animAcc.current >= 1 / ANIM_FPS && visualRef.current) {
      animAcc.current = 0;
      const euler = tmpEuler.current.setFromQuaternion(bodyQuat, "YXZ");
      const lv = body.linvel();
      if (lv.x * lv.x + lv.z * lv.z > 0.3) euler.y = Math.atan2(lv.x, lv.z);
      visualRef.current.position.set(pos.x, pos.y, pos.z);
      visualRef.current.quaternion.setFromEuler(euler);
      if (paddleRef.current) {
        paddleRef.current.rotation.z = moving ? Math.sin(t * 6) * 0.5 : Math.sin(t * 1.2) * 0.06;
      }
    }

    // ── 지금 있는 장르 구역 갱신 ──
    setCurrentRegion(nearestGenre(pos.x, pos.z, centroids));

    // ── 리스너 위치 + 근접 시 자동 재생/정지 ──
    spatialAudioEngine.updateListenerPosition([pos.x, pos.y, pos.z]);
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    nodes.forEach((n) => {
      const [nx, ny, nz] = waterLayout.get(n.trackId) ?? waterPosition(n);
      const dist = Math.hypot(pos.x - nx, pos.z - nz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = n.trackId;
      }
      const isNear = nearby.current.has(n.trackId);
      // "/audio/sample.mp3"는 실제 파일이 없는 폴백 경로 — 헛 요청 방지.
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
    <>
      {/* 물리 전용 — 보이지 않음. 요(yaw)는 잠가서 부력 토크로 계속 빙빙 도는 걸 방지 */}
      <RigidBody
        ref={bodyRef}
        colliders={false}
        position={[0, 1, 40]}
        linearDamping={2.2}
        angularDamping={2.8}
        enabledRotations={[true, false, true]}
      >
        <CapsuleCollider args={[2.5, 1.1]} rotation={[Math.PI / 2, 0, 0]} />
      </RigidBody>

      {/* 실제로 보이는 부분 — 위 물리 바디와 분리, 스톱모션 프레임레이트로만 따라감 */}
      <group ref={visualRef} position={[0, 1, 40]}>
        {/* 카약 선체 */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[1.1, 5, 4, 8]} />
          <meshToonMaterial color="#ffb84d" normalMap={clayNormal} normalScale={new THREE.Vector2(0.6, 0.6)} />
        </mesh>

        {/* 사람 — 고무찰흙 느낌 (둥근 primitive + 클레이 범프 노멀맵) */}
        <group position={[0, 1.3, 0]}>
          <mesh>
            <capsuleGeometry args={[0.85, 1.4, 4, 8]} />
            <meshToonMaterial color="#ff8a65" normalMap={clayNormal} normalScale={new THREE.Vector2(0.5, 0.5)} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.7, 16, 16]} />
            <meshToonMaterial color="#ffd7b5" normalMap={clayNormal} normalScale={new THREE.Vector2(0.5, 0.5)} />
          </mesh>
          {/* 팔 (양쪽) */}
          <mesh position={[-0.75, 0.3, 0]} rotation={[0, 0, Math.PI / 5]}>
            <capsuleGeometry args={[0.22, 0.8, 4, 6]} />
            <meshToonMaterial color="#ff8a65" normalMap={clayNormal} />
          </mesh>
          <mesh position={[0.75, 0.3, 0]} rotation={[0, 0, -Math.PI / 5]}>
            <capsuleGeometry args={[0.22, 0.8, 4, 6]} />
            <meshToonMaterial color="#ff8a65" normalMap={clayNormal} />
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
    </>
  );
}
