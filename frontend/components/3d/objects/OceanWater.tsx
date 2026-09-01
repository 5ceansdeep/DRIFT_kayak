"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
// three/examples/jsm/objects/Water.js를 그대로 쓰지 않고 engine/DriftWater.js
// (한 줄만 고친 로컬 사본)를 쓴다 — 원본은 미러 반사용 WebGLRenderTarget을
// dispose할 방법을 안 줘서, 리마운트(StrictMode 이중 마운트/Fast Refresh)
// 때마다 GPU 렌더타겟이 새는 실제 버그(Context Lost)가 있었다. 자세한 설명은
// DriftWater.js 상단 주석 참고.
import { Water } from "@/engine/DriftWater.js";
import { useExploreStore } from "@/store/useExploreStore";
import { genreColor } from "@/engine/OceanLayout";
import { generateNormalMapTexture } from "@/lib/proceduralNormalMap";

const DEFAULT_COLOR = new THREE.Color("#0f5e82");

// 진짜 반사(Water — 미러 카메라로 씬을 렌더한 텍스처를 수면에 비춤).
// 노멀맵은 외부 텍스처 파일 없이 캔버스로 직접 생성(lib/proceduralNormalMap).
// ponytail: Water는 "평평한 거울" 기법이라 버텍스로 진짜 굴곡진 파도를 만들진
// 않는다 — 지오메트리 파도(KayakCharacter/ExploreStars가 쓰는 waveHeight)와는
// 시각적으로 분리돼 있음(둘 다 애니메이션은 되니 위화감은 적다). 완전히 하나로
// 합치려면 굴곡진 반사면(planar reflection이 아닌 스크린스페이스 반사)이
// 필요한데 그건 비용 대비 효과가 낮아 보류.
export default function OceanWater() {
  const waterRef = useRef<InstanceType<typeof Water> | null>(null);
  const { scene, camera } = useThree();
  const currentRegion = useExploreStore((s) => s.currentRegion);
  const targetColor = useRef(DEFAULT_COLOR.clone());

  useEffect(() => {
    const geometry = new THREE.PlaneGeometry(4000, 4000);
    const waterNormals = generateNormalMapTexture();

    const water = new Water(geometry, {
      // 반사 텍스처 해상도 — 512는 씬을 매 프레임 그만한 크기로 한 번 더
      // 그리는 비용. 256이면 그 4분의 1로, 육안 차이는 거의 없음.
      textureWidth: 256,
      textureHeight: 256,
      waterNormals,
      sunDirection: new THREE.Vector3(60, 100, 40).normalize(),
      sunColor: 0xffffff,
      waterColor: DEFAULT_COLOR.getHex(),
      distortionScale: 3.2,
      fog: !!scene.fog,
    });
    // 타입 없는 vendored JS라 material이 넓은 유니온 타입으로 잡힘 — 실제로는
    // 항상 ShaderMaterial(Water.js 내부에서 그렇게 생성)이라 단언해서 씀.
    const material = water.material as THREE.ShaderMaterial;
    water.rotation.x = -Math.PI / 2;
    material.transparent = true;
    material.uniforms.alpha.value = 0.92;
    scene.add(water);
    waterRef.current = water;

    return () => {
      scene.remove(water);
      geometry.dispose();
      waterNormals.dispose();
      material.dispose();
      // 이 dispose가 바로 그 GPU 렌더타겟 누수 수정의 핵심 — 원본 Water엔 없음.
      water._renderTarget?.dispose();
    };
  }, [scene]);

  useEffect(() => {
    targetColor.current = currentRegion ? new THREE.Color(genreColor(currentRegion)) : DEFAULT_COLOR.clone();
  }, [currentRegion]);

  useFrame((_, delta) => {
    const water = waterRef.current;
    if (!water) return;
    const material = water.material as THREE.ShaderMaterial;
    material.uniforms.time.value += delta * 0.6;
    (material.uniforms.eye.value as THREE.Vector3).copy(camera.position);
    (material.uniforms.waterColor.value as THREE.Color).lerp(targetColor.current, Math.min(1, delta * 1.2));
  });

  return null;
}
