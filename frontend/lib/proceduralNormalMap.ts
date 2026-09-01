import * as THREE from "three";

// 외부 텍스처 파일 없이(에셋 파이프라인 없음) tangent-space 노멀맵을 캔버스에
// 직접 그린다 — 반구형 "돌기"를 잔뜩 겹쳐서 물결/점토 범프 느낌을 흉내낸다.
// 타일링 시 이음새가 보이지 않도록 경계 근처 돌기는 반대편에도 복제해서 그린다.
export function generateNormalMapTexture(
  size = 256,
  blobCount = 60,
  minR = 8,
  maxR = 26,
  strength = 0.55
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  // 평평한 노멀(0,0,1) = RGB(128,128,255)로 초기화
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128;
    img.data[i + 1] = 128;
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }

  const drawBlob = (cx: number, cy: number, r: number) => {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(size, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(size, Math.ceil(cy + r));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= r) continue;
        const falloff = 1 - dist / r; // 가장자리로 갈수록 평평해지게
        const nx = (dx / r) * strength * falloff;
        const ny = (dy / r) * strength * falloff;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const idx = (y * size + x) * 4;
        img.data[idx] = (nx * 0.5 + 0.5) * 255;
        img.data[idx + 1] = (ny * 0.5 + 0.5) * 255;
        img.data[idx + 2] = nz * 255;
      }
    }
  };

  for (let b = 0; b < blobCount; b++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = minR + Math.random() * (maxR - minR);
    drawBlob(cx, cy, r);
    // 타일 경계에 걸치면 반대편에도 그려서 이음새를 덜 보이게 함
    if (cx - r < 0) drawBlob(cx + size, cy, r);
    if (cx + r > size) drawBlob(cx - size, cy, r);
    if (cy - r < 0) drawBlob(cx, cy + size, r);
    if (cy + r > size) drawBlob(cx, cy - size, r);
  }

  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
