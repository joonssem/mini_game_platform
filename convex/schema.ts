import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// 초안은 docs/PRD.md 8장. strokes는 M3, events는 M5에서 추가한다.
export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    status: v.union(v.literal("lobby"), v.literal("playing"), v.literal("reveal")),
    hostSessionId: v.string(),
    turnSeconds: v.number(),
    createdAt: v.number(),
    currentGameId: v.optional(v.id("games")),
    /** 지금까지 시작한 판 수. 판마다 첫 순서를 한 칸씩 돌리는 데 쓴다. */
    gameCount: v.optional(v.number()),
  }).index("by_code", ["code"]),

  games: defineTable({
    roomId: v.id("rooms"),
    topic: v.string(),
    rerolled: v.boolean(),
    turnSeconds: v.number(),
    // 플레이어는 sessionId가 아니라 문서 id로 가리킨다. 다른 기기가 자리를 이어받아도 차례가 유지된다.
    turns: v.array(
      v.object({
        playerId: v.id("players"),
        number: v.number(),
        stage: v.string(),
        endedAt: v.optional(v.number()),
        /** 자리 비움이나 나감으로 건너뛴 칸 */
        skipped: v.optional(v.boolean()),
      }),
    ),
    /** intro: 주제 공개, drawing: 차례 진행, done: 다 그림 */
    phase: v.union(v.literal("intro"), v.literal("drawing"), v.literal("done")),
    currentTurn: v.number(),
    phaseEndsAt: v.number(),
    startedAt: v.number(),
  }).index("by_room", ["roomId"]),

  // 교사 페이지 로그인. 토큰 원문이 아니라 해시만 저장한다.
  teacherSessions: defineTable({
    tokenHash: v.string(),
    expiresAt: v.number(),
  }).index("by_hash", ["tokenHash"]),

  /** 교사 비밀번호 연속 실패 제한 (문서 하나만 쓴다) */
  teacherGuard: defineTable({
    failures: v.number(),
    lockedUntil: v.number(),
  }),

  // 기록(로그). 출석번호, sessionId, 그림은 넣지 않는다. 30일 보관.
  events: defineTable({
    type: v.string(),
    at: v.number(),
    roomId: v.optional(v.id("rooms")),
    gameId: v.optional(v.id("games")),
    data: v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
  }).index("by_at", ["at"]),

  // 획 하나가 문서 하나. 실시간 구경과 공개 화면이 같은 데이터를 쓴다.
  strokes: defineTable({
    gameId: v.id("games"),
    turn: v.number(),
    /** 화면이 보낸 임시 id. 화면은 이 값으로 "보낸 획이 서버에 도착했는지" 안다. */
    clientId: v.string(),
    color: v.string(),
    width: v.number(),
    /** [x0, y0, x1, y1, ...] 그림판 너비·높이에 대한 비율 */
    points: v.array(v.number()),
  }).index("by_game_turn", ["gameId", "turn"]),

  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    number: v.number(),
    joinedAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_session", ["sessionId"]),
});
