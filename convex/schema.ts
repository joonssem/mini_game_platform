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
