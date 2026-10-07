// 게임 규칙 상수. 화면(src/)과 서버(convex/)가 함께 쓴다. 근거: docs/PRD.md

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MIN_NUMBER = 1;
export const MAX_NUMBER = 30;

export const TURN_SECONDS_OPTIONS = [30, 45, 60] as const;
export const DEFAULT_TURN_SECONDS = 45;

export const HEARTBEAT_MS = 10_000;
/** 같은 번호 자리를 새 기기가 이어받을 수 있는 무응답 시간 */
export const TAKEOVER_AFTER_MS = 20_000;
/** 대기실에서 목록에서 빠지는 무응답 시간, 게임 중에는 "자리 비움" 기준 */
export const AWAY_AFTER_MS = 60_000;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** 주제 공개 화면 시간. 방장이 주제를 다시 뽑으면 다시 이만큼 기다린다. */
export const INTRO_MS = 5_000;
/** 화면에 "다음은 너야!"를 띄우는 남은 시간 */
export const NEXT_UP_WARNING_MS = 5_000;

// 그림판. 좌표와 굵기는 그림판 너비에 대한 비율(0~1)이라 기기 크기가 달라도 똑같이 보인다.
export const PEN_COLORS = [
  { name: "검정", value: "#1d1d1f" },
  { name: "빨강", value: "#e03131" },
  { name: "파랑", value: "#1971c2" },
  { name: "초록", value: "#2f9e44" },
  { name: "노랑", value: "#fcc419" },
  { name: "갈색", value: "#8b5a2b" },
] as const;
export const ERASER_COLOR = "#ffffff";
export const PEN_WIDTHS = [
  { name: "가늘게", value: 0.006 },
  { name: "굵게", value: 0.016 },
] as const;
export const ERASER_WIDTH = 0.045;
/** 획 하나의 최대 점 개수. 넘으면 화면에서 획을 나눠 보낸다. */
export const MAX_STROKE_POINTS = 600;
/** 시간이 끝나는 순간 손을 떼서 늦게 도착한 획도 받아 주는 여유 시간 */
export const STROKE_GRACE_MS = 2_000;

// 교사 페이지
export const TEACHER_SESSION_MS = 12 * 60 * 60 * 1000;
export const TEACHER_MAX_FAILURES = 10;
export const TEACHER_LOCK_MS = 15 * 60 * 1000;

/** 기록(로그) 보관 기간. 그림과 번호는 기록에 없다. */
export const EVENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
