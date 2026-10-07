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
