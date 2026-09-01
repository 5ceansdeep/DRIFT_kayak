"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useExploreStore } from "@/store/useExploreStore";
import { WAVE_GLSL } from "@/engine/OceanWaves";
import { genreColor } from "@/engine/OceanLayout";

// 프랙탈 노이즈 SVG를 범프맵으로 써서 잔물결(고주파)을 흉내낸다 — 기존
// 코드베이스의 .drift-grain(app/drift-theme.css)과 같은 트릭.
const RIPPLE_DATA_URL =
  "data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.02' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

const DEFAULT_COLOR = new THREE.Color("#0f5e82");

// ponytail: THREE.Water(진짜 반사/굴절 SSR)까진 안 씀 — MeshStandardMaterial의
// onBeforeCompile로 저주파 파도(WAVE_GLSL, KayakCharacter와 공유하는 수식)를
// 버텍스에 얹고, 범프맵(고주파 잔물결)+낮은 roughness로 "그럴듯한 반짝임"만
// 흉내낸다. 진짜 리얼하게 필요해지면 three/addons/objects/Water.js로 교체.
export default function OceanWater() {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);
  const textureRef = useRef<THREE.Texture | null>(null);
  const uniformsRef = useRef<{ uTime: { value: number } } | null>(null);
  const currentRegion = useExploreStore((s) => s.currentRegion);
  const targetColor = useRef(DEFAULT_COLOR.clone());

  useEffect(() => {
    const tex = new THREE.TextureLoader().load(RIPPLE_DATA_URL);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    textureRef.current = tex;

    const mat = materialRef.current;
    if (!mat) return;
    mat.bumpMap = tex;
    mat.onBeforeCompile = (shader) => {
      const uniforms = { uTime: { value: 0 } };
      uniformsRef.current = uniforms;
      shader.uniforms.uTime = uniforms.uTime;
      shader.vertexShader =
        `uniform float uTime;\n${WAVE_GLSL}\n` +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n\ttransformed.z += waveHeight(transformed.x, -transformed.y, uTime);"
        );
    };
    mat.needsUpdate = true;
  }, []);

  useEffect(() => {
    targetColor.current = currentRegion ? new THREE.Color(genreColor(currentRegion)) : DEFAULT_COLOR.clone();
  }, [currentRegion]);

  useFrame((_, delta) => {
    if (uniformsRef.current) uniformsRef.current.uTime.value += delta;
    const tex = textureRef.current;
    if (tex) {
      tex.offset.x += delta * 0.015;
      tex.offset.y += delta * 0.01;
    }
    materialRef.current?.color.lerp(targetColor.current, Math.min(1, delta * 1.2));
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[3000, 3000, 180, 180]} />
      <meshStandardMaterial
        ref={materialRef}
        color={DEFAULT_COLOR}
        roughness={0.2}
        metalness={0.25}
        bumpScale={0.6}
        transparent
        opacity={0.94}
      />
    </mesh>
  );
}
