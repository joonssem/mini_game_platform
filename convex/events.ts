import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { EVENT_TTL_MS } from "./constants";

// 기록(로그). 학생 행동 관찰을 돕는 최소한의 이벤트만 남긴다. docs/PRD.md 8장(기록).
// 출석번호, sessionId, 그림은 남기지 않는다. 방 코드와 게임 id로만 묶는다.

export type EventType =
  | "room_created"
  | "player_joined"
  | "seat_taken_over"
  | "player_left"
  | "player_reconnected"
  | "game_started"
  | "topic_rerolled"
  | "turn_submitted"
  | "turn_skipped"
  | "game_revealed"
  | "back_to_lobby";

type EventData = Record<string, string | number | boolean>;

export async function logEvent(
  ctx: MutationCtx,
  type: EventType,
  refs: { roomId?: Id<"rooms">; gameId?: Id<"games"> },
  data: EventData = {},
) {
  await ctx.db.insert("events", { type, at: Date.now(), ...refs, data });
}

/** 매일 cron이 부른다. 30일 지난 기록을 지운다. */
export const deleteOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("events")
      .withIndex("by_at", (q) => q.lt("at", Date.now() - EVENT_TTL_MS))
      .take(1000);
    for (const event of old) await ctx.db.delete(event._id);
  },
});

/**
 * 관찰용 요약. 화면은 없고, 개발자가 실행한다:
 *   npx convex run events:summary '{"days": 7}' --prod
 */
export const summary = internalQuery({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 7 }) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_at", (q) => q.gt("at", Date.now() - days * 24 * 60 * 60 * 1000))
      .collect();
    const count = (type: EventType) => events.filter((e) => e.type === type).length;
    const revealed = events.filter((e) => e.type === "game_revealed");
    const turns = events.filter((e) => e.type === "turn_submitted");
    const avg = (values: number[]) =>
      values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length / 1000) : null;
    const num = (value: unknown) => (typeof value === "number" ? value : 0);

    return {
      days,
      rooms: count("room_created"),
      gamesStarted: count("game_started"),
      gamesFinished: revealed.length,
      rematches: events.filter((e) => e.type === "game_started" && e.data.rematch === true).length,
      avgGameSeconds: avg(revealed.map((e) => num(e.data.durationMs))),
      avgTurnSeconds: avg(turns.map((e) => num(e.data.durationMs))),
      turnsCompletedEarly: turns.filter((e) => e.data.reason === "complete").length,
      turnsTimedOut: turns.filter((e) => e.data.reason === "timeout").length,
      turnsSkipped: count("turn_skipped"),
      emptyPanels: turns.filter((e) => num(e.data.strokes) === 0).length,
      reconnects: count("player_reconnected"),
      seatTakeovers: count("seat_taken_over"),
      leftDuringGame: events.filter((e) => e.type === "player_left" && e.data.status !== "lobby").length,
    };
  },
});
