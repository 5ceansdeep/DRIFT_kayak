"use client";

import { Canvas } from "@react-three/fiber";
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
        // 성능 때문에 dpr/안티앨리어싱을 깎았었는데, 진짜 버벅임의 원인은
        // Rapier(제거됨)였다 — 화질을 다시 정상으로.
        dpr={[1, 2]}
        camera={{ position: [0, 14, 62], fov: 60, near: 0.1, far: 3000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        {/* 고무찰흙 느낌의 카툰 셰이딩(meshToonMaterial)엔 방향광이 있어야
            음영 단이 생긴다. */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[60, 100, 40]} intensity={0.8} />
        {/* @react-three/rapier(Physics)는 뺐다 — WebGL 컨텍스트를 죽이는
            버그가 있었음(KayakCharacter.tsx 상단 주석 참고). */}
        <ExploreScene />
      </Canvas>
    </div>
  );
}
