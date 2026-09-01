"use client";

import { useEffect, useRef } from "react";

type Dir = "forward" | "back" | "left" | "right";

const KEY_MAP: Record<string, Dir> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

// WASD/방향키 눌림 상태 + 스페이스바(선택) "방금 눌림" 엣지 트리거.
// re-render를 유발하지 않도록 ref로 보관 — useFrame 안에서 매 프레임
// 읽기만 하면 되는 값이라 state가 아니어야 한다.
export function useKeyboard() {
  const pressed = useRef({ forward: false, back: false, left: false, right: false });
  const selectPressedRef = useRef(false); // 스페이스바 — 프레임 루프에서 소비 후 false로 리셋

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.code];
      if (dir) pressed.current[dir] = true;
      if (e.code === "Space") {
        e.preventDefault(); // 페이지 스크롤 방지
        selectPressedRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = KEY_MAP[e.code];
      if (dir) pressed.current[dir] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return { pressed, selectPressedRef };
}
