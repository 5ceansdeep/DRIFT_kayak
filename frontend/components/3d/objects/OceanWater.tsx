"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { useExploreStore } from "@/store/useExploreStore";
import { genreColor } from "@/engine/OceanLayout";
import { generateNormalMapTexture } from "@/lib/proceduralNormalMap";

const DEFAULT_COLOR = new THREE.Color("#0f5e82");

// 진짜 반사(THREE.Water — 미러 카메라로 씬을 렌더한 텍스처를 수면에 비춤).
// 노멀맵은 외부 텍스처 파일 없이 캔버스로 직접 생성(lib/proceduralNormalMap).
// ponytail: Water는 "평평한 거울" 기법이라 버텍스로 진짜 굴곡진 파도를 만들진
// 않는다 — 지오메트리 파도(KayakCharacter/ExploreStars가 쓰는 waveHeight)와는
// 시각적으로 분리돼 있음(둘 다 애니메이션은 되니 위화감은 적다). 완전히 하나로
// 합치려면 굴곡진 반사면(planar reflection이 아닌 스크린스페이스 반사)이
// 필요한데 그건 비용 대비 효과가 낮아 보류.
export default function OceanWater() {
  const waterRef = useRef<Water | null>(null);
  const { scene, camera } = useThree();
  const currentRegion = useExploreStore((s) => s.currentRegion);
  const targetColor = useRef(DEFAULT_COLOR.clone());

  useEffect(() => {
    const geometry = new THREE.PlaneGeometry(4000, 4000);
    const waterNormals = generateNormalMapTexture();

    const water = new Water(geometry, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(60, 100, 40).normalize(),
      sunColor: 0xffffff,
      waterColor: DEFAULT_COLOR.getHex(),
      distortionScale: 3.2,
      fog: !!scene.fog,
    });
    water.rotation.x = -Math.PI / 2;
    water.material.transparent = true;
    water.material.uniforms.alpha.value = 0.92;
    scene.add(water);
    waterRef.current = water;

    return () => {
      scene.remove(water);
      geometry.dispose();
      waterNormals.dispose();
      water.material.dispose();
    };
  }, [scene]);

  useEffect(() => {
    targetColor.current = currentRegion ? new THREE.Color(genreColor(currentRegion)) : DEFAULT_COLOR.clone();
  }, [currentRegion]);

  useFrame((_, delta) => {
    const water = waterRef.current;
    if (!water) return;
    water.material.uniforms.time.value += delta * 0.6;
    (water.material.uniforms.eye.value as THREE.Vector3).copy(camera.position);
    (water.material.uniforms.waterColor.value as THREE.Color).lerp(targetColor.current, Math.min(1, delta * 1.2));
  });

  return null;
}
