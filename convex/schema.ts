import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// 초안은 docs/PRD.md 8장. games, strokes, events는 M2부터 추가한다.
export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    status: v.union(v.literal("lobby"), v.literal("playing"), v.literal("reveal")),
    hostSessionId: v.string(),
    turnSeconds: v.number(),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

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
