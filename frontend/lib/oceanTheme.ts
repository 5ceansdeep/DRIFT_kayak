// Explore 전용 "바다" 컨셉 팔레트. Galaxy/Twin은 그대로 --color-paper 등 잉크
// 팔레트를 씀 — 이 상수들은 Explore 쪽 컴포넌트에서만 참조한다.
export const OCEAN = {
  skyTop: "#bfe3f0",
  skyBottom: "#2f6f9c",
  foam: "#eef7fa",
  water: "#8fd0de",
  ink: "#0d2b3e", // HUD 텍스트/테두리용 남색 (잉크 검정 대신)
  coral: "#ff8a65", // 부표(노드) 프레임
  teal: "#4fb3c9", // 유사도 경계 와이어프레임
  ship: "#e8553d", // 내 배(원점 앵커)
} as const;
