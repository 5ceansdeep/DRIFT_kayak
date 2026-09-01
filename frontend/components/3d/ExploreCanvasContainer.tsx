"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import ExploreScene from "./scenes/ExploreScene";
import ExploreHud from "../ui/ExploreHud";
import ExploreIntro from "../ui/ExploreIntro";
import { OCEAN } from "@/lib/oceanTheme";

// 카약 컨셉: 더 이상 드래그-오빗 카메라가 아니라, KayakCharacter가 매 프레임
// 직접 camera.position/lookAt을 갱신하는 3인칭 추격 카메라다 — 그래서
// CameraControls/fly-to/워프 로직은 전부 뺐다(이동은 이제 WASD가 대신함).
export default function ExploreCanvasContainer() {
  return (
    <div
      className="relative h-full w-full"
      style={{ background: `linear-gradient(180deg, ${OCEAN.skyTop}, ${OCEAN.skyBottom})` }}
    >
      <ExploreHud />
      <ExploreIntro />

      <Canvas
        // Water가 매 프레임 반사 텍스처를 만들려고 씬을 통째로 한 번 더 렌더함
        // — dpr을 2까지 올리면 그 비용이 4배가 된다. 1~1.5로 캡.
        dpr={[1, 1.5]}
        camera={{ position: [0, 14, 62], fov: 60, near: 0.1, far: 3000 }}
        // Water 프래그먼트 셰이더가 이미 무거워서(노이즈 텍스처 4번 샘플링)
        // 안티앨리어싱까지 얹으면 부담이 커진다 — 꺼서 여유를 만듦.
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      >
        {/* 고무찰흙 느낌의 카툰 셰이딩(meshToonMaterial)엔 방향광이 있어야
            음영 단이 생긴다. */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[60, 100, 40]} intensity={0.8} />
        {/* 카약(KayakCharacter)만 RigidBody를 씀 — 부표/물은 물리 대상 아님 */}
        <Physics gravity={[0, -9.81, 0]}>
          <ExploreScene />
        </Physics>
      </Canvas>
    </div>
  );
}
