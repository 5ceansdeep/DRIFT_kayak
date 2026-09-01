// 파도 높이 함수 — 물 셰이더(GLSL, OceanWater.tsx)와 카약의 상하/롤/피치
// 흔들림(JS, KayakCharacter.tsx)이 "같은 파도"를 보고 있는 것처럼 같은 공식을
// 공유한다. Gerstner 파도 시뮬레이션 대신 사인파 2개를 합친 저비용 근사.
// ponytail: 진짜 유체역학 없음 — 물리 엔진(Cannon/Rapier) 없이 이 정도로
// "파도에 흔들리는" 느낌은 충분히 남. 필요해지면 그때 업그레이드.
export const WAVE = {
  a1: 1.1,
  k1: 0.045,
  s1: 0.9,
  a2: 0.6,
  k2: 0.07,
  s2: 1.3,
} as const;

export function waveHeight(x: number, z: number, t: number): number {
  return (
    WAVE.a1 * Math.sin(x * WAVE.k1 + t * WAVE.s1) +
    WAVE.a2 * Math.sin(z * WAVE.k2 - t * WAVE.s2 + x * 0.02)
  );
}

// 위 waveHeight()를 그대로 옮긴 GLSL. onBeforeCompile로 MeshStandardMaterial
// 버텍스 셰이더에 주입한다. 평면은 -90° X 회전으로 눕혀서 쓰므로 로컬
// (x, y) -> 월드 (x, -z) 매핑이고, 높이는 로컬 z에 더한다.
export const WAVE_GLSL = `
  float waveHeight(float x, float z, float t) {
    return ${WAVE.a1.toFixed(3)} * sin(x * ${WAVE.k1.toFixed(3)} + t * ${WAVE.s1.toFixed(3)})
         + ${WAVE.a2.toFixed(3)} * sin(z * ${WAVE.k2.toFixed(3)} - t * ${WAVE.s2.toFixed(3)} + x * 0.02);
  }
`;
