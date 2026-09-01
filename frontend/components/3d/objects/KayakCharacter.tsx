"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useExploreStore } from "@/store/useExploreStore";
import { spatialAudioEngine } from "@/engine/SpatialAudioEngine";
import { waterPosition, genreCentroids, nearestGenre } from "@/engine/OceanLayout";
import { waveHeight } from "@/engine/OceanWaves";
import { generateNormalMapTexture } from "@/lib/proceduralNormalMap";

const ACCEL = 34; // 노 젓는 가속도
const DRAG = 1.6; // 클수록 빨리 감속(마찰/저항) — 놓으면 관성으로 미끄러지다 멈춤
const MAX_SPEED = 22;
const CAMERA_OFFSET = new THREE.Vector3(0, 20, 11); // 뒤+위에서 따라가는 3인칭 카메라 — 위쪽 비중을 키워 더 둔각으로, 전체 거리는 더 가깝게
const CAMERA_LERP = 4;
// OceanLayout의 RING_STEP(같은 장르 내 최소 간격, 30)보다 작게 잡아야
// 인접한 두 부표 사거리가 겹쳐서 동시에 재생되는 일이 없다.
const PLAY_RADIUS = 20; // 이 안으로 들어오면 재생 시작
const STOP_RADIUS = 28; // 이 밖으로 나가면 정지 (히스테리시스로 경계 깜빡임 방지)
const SELECT_RADIUS = 24; // 스페이스바로 선택 가능한 최대 거리
const WAVE_SLOPE_EPS = 1.5;
const ANIM_FPS = 13; // 고무찰흙 스톱모션 느낌 — 자세(파도 흔들림/노젓기)만 이 속도로 갱신

// ponytail: @react-three/rapier(진짜 물리 엔진)를 한 번 붙여봤는데, Physics
// 프로바이더를 마운트하는 것만으로(RigidBody 하나도 없이) WebGL 컨텍스트가
// 죽는 버그가 있었다(격리 테스트로 확인 — Physics 빼면 멀쩡, 넣으면 항상
// 죽음. rapier_wasm3d.js의 wasm-bindgen init 호출 방식이 deprecated라는
// 경고가 같이 뜨는 걸로 봐서 @react-three/rapier <-> rapier3d-compat 버전
// 궁합 문제로 보인다). 그래서 진짜 유체역학 대신 속도+가속+감쇠(drag)로
// "관성 있게 미끄러지는" 느낌만 흉내내고, 기울기는 파도 함수의 기울기
// (유한차분)를 그대로 읽어서 붙이는 이전 방식으로 되돌렸다 — 안정적이고
// 체감상 차이도 크지 않음. 실제 파도 충돌/부표 충돌도 없음.
export default function KayakCharacter() {
  const groupRef = useRef<THREE.Group>(null!);
  const hullRef = useRef<THREE.Group>(null!); // 파도 흔들림(위치/롤/피치) — 스톱모션 프레임레이트로 갱신
  const paddleRef = useRef<THREE.Group>(null!);
  const velocity = useRef(new THREE.Vector3());
  const animAcc = useRef(0);
  const { pressed, selectPressedRef } = useKeyboard();
  const { camera } = useThree();
  const nodes = useExploreStore((s) => s.nodes);
  const waterLayout = useExploreStore((s) => s.waterLayout);
  const setSelectedTrackId = useExploreStore((s) => s.setSelectedTrackId);
  const setCurrentRegion = useExploreStore((s) => s.setCurrentRegion);
  const setNearbyTrackIds = useExploreStore((s) => s.setNearbyTrackIds);
  const setNextBuoyScreenAngle = useExploreStore((s) => s.setNextBuoyScreenAngle);
  const devMode = useExploreStore((s) => s.devMode);
  const toggleDevMode = useExploreStore((s) => s.toggleDevMode);
  const nearby = useRef<Set<string>>(new Set());
  const tmpKayakNDC = useRef(new THREE.Vector3());
  const tmpTargetNDC = useRef(new THREE.Vector3());
  const centroids = useMemo(() => genreCentroids(nodes, waterLayout), [nodes, waterLayout]);
  // 점토 표면의 "지문/뭉툭함" 느낌을 내는 범프 노멀맵 — 물결용과 같은 생성기,
  // 돌기를 더 작고 촘촘하게. 리마운트 때마다 새로 생기니 언마운트 시 dispose.
  const clayNormal = useMemo(() => generateNormalMapTexture(128, 50, 3, 8, 0.35), []);
  useEffect(() => () => clayNormal.dispose(), [clayNormal]);

  // M: 개발자 모드(전체 지역 조망용 자유 궤도 카메라) 토글.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyM") toggleDevMode();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleDevMode]);

  // 켜지는 순간 한 번 전체가 내려다보이는 위치로 점프 — 이후는 OrbitControls(ExploreScene)가 맡는다.
  // y축 바로 위(0,h,0)로 두면 lookAt이 up벡터와 겹쳐 흔들리므로 z를 살짝 줌.
  useEffect(() => {
    if (devMode) camera.position.set(0, 650, 300);
  }, [devMode, camera]);

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
    const throttledTick = animAcc.current >= 1 / ANIM_FPS;
    if (throttledTick) {
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

    // ── 3인칭 추격 카메라 (부드럽게, 매 프레임) — 개발자 모드에선 OrbitControls가 대신 소유 ──
    if (!devMode) {
      camera.position.lerp(group.position.clone().add(CAMERA_OFFSET), Math.min(1, CAMERA_LERP * delta));
      camera.lookAt(group.position.x, group.position.y + 2, group.position.z);
    }

    // ── 지금 있는 장르 구역 갱신 ──
    setCurrentRegion(nearestGenre(group.position.x, group.position.z, centroids));

    // ── 리스너 위치 + 근접 시 자동 재생/정지 ──
    spatialAudioEngine.updateListenerPosition([group.position.x, group.position.y, group.position.z]);
    let nearestId: string | null = null;
    let nearestDist = Infinity;
    let nearestPos: [number, number, number] | null = null;
    let nearbyChanged = false;
    nodes.forEach((n) => {
      const [nx, ny, nz] = waterLayout.get(n.trackId) ?? waterPosition(n);
      const dist = Math.hypot(group.position.x - nx, group.position.z - nz);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = n.trackId;
        nearestPos = [nx, ny, nz];
      }
      const isNear = nearby.current.has(n.trackId);
      // "/audio/sample.mp3"는 실제 파일이 없는 폴백 경로 — 미리듣기 없는 곡을
      // 근접할 때마다 헛 요청을 쏘지 않도록 건너뛴다.
      if (!isNear && dist < PLAY_RADIUS && n.audioUrl !== "/audio/sample.mp3") {
        spatialAudioEngine.registerAndPlay(n.trackId, n.audioUrl, [nx, ny, nz]);
        nearby.current.add(n.trackId);
        nearbyChanged = true;
      } else if (isNear && dist > STOP_RADIUS) {
        spatialAudioEngine.stop(n.trackId);
        nearby.current.delete(n.trackId);
        nearbyChanged = true;
      }
    });
    // 실제로 드나든 트랙이 있을 때만 스토어에 반영 — 매 프레임 새 Set을
    // 만들어 리렌더를 유발하지 않게.
    if (nearbyChanged) setNearbyTrackIds(new Set(nearby.current));

    // ── 가장 가까운 부표를 가리키는 화면 각도(HUD 화살표용), 12~15fps로만 ──
    if (throttledTick) {
      if (nearestPos) {
        const kayakNDC = tmpKayakNDC.current.set(group.position.x, group.position.y, group.position.z).project(camera);
        const targetNDC = tmpTargetNDC.current.set(nearestPos[0], nearestPos[1], nearestPos[2]).project(camera);
        const dx = targetNDC.x - kayakNDC.x;
        const dy = targetNDC.y - kayakNDC.y;
        setNextBuoyScreenAngle((Math.atan2(dx, dy) * 180) / Math.PI);
      } else {
        setNextBuoyScreenAngle(null);
      }
    }

    // ── 스페이스바: 사거리 안 가장 가까운 부표 선택 ──
    if (selectPressedRef.current) {
      selectPressedRef.current = false;
      if (nearestId && nearestDist < SELECT_RADIUS) setSelectedTrackId(nearestId);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 40]}>
      <group ref={hullRef}>
        {/* 카약 선체 — 사람만 클레이로 남기고 배는 실사 톤(PBR, 카툰 셰이딩/범프 뺌) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[1.1, 5, 4, 8]} />
          <meshStandardMaterial color="#ffb84d" roughness={0.4} metalness={0.05} />
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
    </group>
  );
}
