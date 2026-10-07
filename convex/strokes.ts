import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  ERASER_COLOR,
  ERASER_WIDTH,
  MAX_STROKE_POINTS,
  PEN_COLORS,
  PEN_WIDTHS,
  STROKE_GRACE_MS,
} from "./constants";

// 그림판 획 저장과 실시간 구경. 규칙은 docs/PRD.md 5장(그리기, 구경), 7장(장난 방지).

const COLORS: string[] = [...PEN_COLORS.map((c) => c.value), ERASER_COLOR];
const WIDTHS: number[] = [...PEN_WIDTHS.map((w) => w.value), ERASER_WIDTH];

async function currentGame(ctx: QueryCtx, sessionId: string) {
  const player = await ctx.db
    .query("players")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
  const room = player && (await ctx.db.get(player.roomId));
  const game = room?.currentGameId && (await ctx.db.get(room.currentGameId));
  if (!player || !game) return null;
  return { player, game };
}

/** 이 기기가 지금 이 칸에 그릴 수 있는가. 시간이 막 끝난 칸은 잠깐 더 받아 준다. */
async function drawableGame(ctx: MutationCtx, sessionId: string, turn: number) {
  const found = await currentGame(ctx, sessionId);
  if (!found) return null;
  const { player, game } = found;
  const target = game.turns[turn];
  if (!target || target.playerId !== player._id) return null;
  const isCurrent = game.phase === "drawing" && game.currentTurn === turn;
  const justEnded = !target.skipped && target.endedAt !== undefined && Date.now() - target.endedAt < STROKE_GRACE_MS;
  return isCurrent || justEnded ? game : null;
}

function validPoints(points: number[]) {
  return (
    points.length >= 2 &&
    points.length % 2 === 0 &&
    points.length <= MAX_STROKE_POINTS * 2 &&
    points.every((p) => Number.isFinite(p) && p >= 0 && p <= 1)
  );
}

export const add = mutation({
  args: {
    sessionId: v.string(),
    turn: v.number(),
    clientId: v.string(),
    color: v.string(),
    width: v.number(),
    points: v.array(v.number()),
  },
  handler: async (ctx, { sessionId, turn, clientId, color, width, points }) => {
    const game = await drawableGame(ctx, sessionId, turn);
    // 차례가 아니거나 잘못된 값이면 조용히 무시한다 (장난이나 늦게 도착한 요청).
    if (!game || !COLORS.includes(color) || !WIDTHS.includes(width) || !validPoints(points)) return;
    if (clientId.length > 64) return;
    await ctx.db.insert("strokes", { gameId: game._id, turn, clientId, color, width, points });
  },
});

/** 되돌리기: 이 칸의 마지막 획을 지운다. */
export const undo = mutation({
  args: { sessionId: v.string(), turn: v.number() },
  handler: async (ctx, { sessionId, turn }) => {
    const game = await drawableGame(ctx, sessionId, turn);
    if (!game) return;
    const last = await ctx.db
      .query("strokes")
      .withIndex("by_game_turn", (q) => q.eq("gameId", game._id).eq("turn", turn))
      .order("desc")
      .first();
    if (last) await ctx.db.delete(last._id);
  },
});

/** 한 칸의 획. 칸마다 따로 구독해서, 다 그린 칸은 다시 내려받지 않게 한다. */
export const panel = query({
  args: { sessionId: v.string(), turn: v.number() },
  handler: async (ctx, { sessionId, turn }) => {
    const found = await currentGame(ctx, sessionId);
    if (!found) return [];
    const strokes = await ctx.db
      .query("strokes")
      .withIndex("by_game_turn", (q) => q.eq("gameId", found.game._id).eq("turn", turn))
      .collect();
    return strokes.map((s) => ({ clientId: s.clientId, color: s.color, width: s.width, points: s.points }));
  },
});
