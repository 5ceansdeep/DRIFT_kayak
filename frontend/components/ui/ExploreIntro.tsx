"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const SEEN_KEY = "drift_explore_intro_seen";

// 3단계 인트로: 헤드폰 안내 -> 조작법 안내 -> 페이드아웃. 클릭/스페이스로
// 언제든 건너뛸 수 있고, 세션당 한 번만(sessionStorage) 보여준다.
// ponytail: 카메라가 수면에서 배 뒤로 줌인하는 시네마틱 전환은 생략 —
// 이미 KayakCharacter가 첫 프레임부터 3인칭 추격 카메라 위치를 잡아주므로,
// 오버레이만 걷히면 결과적으로 비슷하게 보인다.
export default function ExploreIntro() {
  const [step, setStep] = useState<0 | 1 | 2>(() => {
    if (typeof window === "undefined") return 0;
    return sessionStorage.getItem(SEEN_KEY) ? 2 : 0;
  });

  useEffect(() => {
    if (step === 2) {
      sessionStorage.setItem(SEEN_KEY, "1");
      return;
    }
    const timer = setTimeout(() => setStep((s) => (s === 0 ? 1 : 2) as 0 | 1 | 2), 2600);
    return () => clearTimeout(timer);
  }, [step]);

  if (step === 2 || typeof document === "undefined") return null;

  const skip = () => setStep(2);

  // 드레이(drei)의 <Html>(장르 라벨 등)은 document.body로 직접 포탈되기 때문에,
  // 이 오버레이도 같은 레벨(body)로 포탈하고 z-index를 확실히 높게 줘야
  // 그 라벨들이 인트로 화면을 비집고 새어 보이지 않는다.
  return createPortal(
    <div
      className="fixed inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 bg-[#0d2b3e] font-mono text-white"
      style={{ zIndex: 9999 }}
      onClick={skip}
      onKeyDown={skip}
      role="button"
      tabIndex={0}
    >
      {step === 0 ? (
        <>
          <div className="text-5xl">🎧</div>
          <div className="text-center text-[13px] leading-relaxed opacity-90">
            몰입감 있는 항해를 위해 헤드폰 착용을 권장합니다
            <br />
            <span className="opacity-60">Headphones recommended for the best experience</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 text-2xl">
            <span className="animate-pulse rounded border border-white/40 px-3 py-1">W A S D</span>
            <span className="opacity-40">or</span>
            <span className="animate-pulse rounded border border-white/40 px-3 py-1">↑ ↓ ← →</span>
          </div>
          <div className="text-center text-[13px] leading-relaxed opacity-90">
            방향키로 노를 저어 부표를 찾아가세요
            <br />
            <span className="opacity-60">Paddle with the arrow keys to find each buoy</span>
          </div>
          <div className="mt-2 text-[11px] opacity-50">SPACE / CLICK — 곡 선택</div>
        </>
      )}
      <div className="absolute bottom-6 text-[10px] tracking-[0.2em] opacity-40">CLICK TO SKIP</div>
    </div>,
    document.body
  );
}
