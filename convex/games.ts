import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { AWAY_AFTER_MS, INTRO_MS } from "./constants";
import { TOPICS } from "./topics";

// 차례 진행과 서버 타이머. 규칙은 docs/PRD.md 4장, 6장.
// 타이머의 기준은 서버다: phaseEndsAt에 맞춰 예약 실행(advance)이 다음 단계로 넘긴다.

const STAGE_HINTS: Record<string, string> = {
  처음: "이야기가 시작돼요. 누가, 어디에 있나요?",
  발단: "이야기가 시작돼요. 누가, 어디에 있나요?",
  가운데: "무슨 일이 생겼어요!",
  전개: "무슨 일이 생겼어요!",
  절정: "가장 큰 사건이 일어나요!",
  끝: "이야기를 마무리해요.",
  결말: "이야기를 마무리해요.",
};

function stagesFor(playerCount: number) {
  return playerCount === 3 ? ["처음", "가운데", "끝"] : ["발단", "전개", "절정", "결말"];
}

function randomTopic(except?: string) {
  const pool = TOPICS.filter((t) => t !== except);
  return pool[Math.floor(Math.random() * pool.length)];
}

async function schedule(ctx: MutationCtx, game: Pick<Doc<"games">, "_id" | "phaseEndsAt">) {
  // endsAt를 함께 넘겨서, 그사이 [완료]나 주제 다시 뽑기로 단계가 바뀌었으면 이 예약은 아무것도 하지 않게 한다.
  await ctx.scheduler.runAt(game.phaseEndsAt, internal.games.advance, {
    gameId: game._id,
    endsAt: game.phaseEndsAt,
  });
}

/** 방장이 [시작]을 누르면 rooms.start가 부른다. players는 지금 연결된 학생, 들어온 순서대로. */
export async function startGame(ctx: MutationCtx, room: Doc<"rooms">, players: Doc<"players">[]) {
  const gameCount = room.gameCount ?? 0;
  const shift = gameCount % players.length;
  const order = [...players.slice(shift), ...players.slice(0, shift)];
  const now = Date.now();

  const gameId = await ctx.db.insert("games", {
    roomId: room._id,
    topic: randomTopic(),
    rerolled: false,
    turnSeconds: room.turnSeconds,
    turns: stagesFor(order.length).map((stage, i) => {
      const player = order[i % order.length];
      return { playerId: player._id, number: player.number, stage };
    }),
    phase: "intro",
    currentTurn: 0,
    phaseEndsAt: now + INTRO_MS,
    startedAt: now,
  });
  await ctx.db.patch(room._id, { status: "playing", currentGameId: gameId, gameCount: gameCount + 1 });
  await schedule(ctx, { _id: gameId, phaseEndsAt: now + INTRO_MS });
}

/** 다음 차례로 넘긴다. 자리 비움이거나 나간 학생의 차례는 건너뛰고, 한 명만 남으면 끝낸다. */
async function moveOn(ctx: MutationCtx, game: Doc<"games">) {
  const room = await ctx.db.get(game.roomId);
  if (!room || room.currentGameId !== game._id || game.phase === "done") return;

  const now = Date.now();
  const turns = [...game.turns];
  let next = 0;
  if (game.phase === "drawing") {
    turns[game.currentTurn] = { ...turns[game.currentTurn], endedAt: now };
    next = game.currentTurn + 1;
  }

  const inRoom = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", room._id))
    .collect();
  const enoughPlayers = inRoom.length >= 2;

  while (next < turns.length) {
    const drawer = inRoom.find((p) => p._id === turns[next].playerId);
    if (enoughPlayers && drawer && now - drawer.lastSeenAt < AWAY_AFTER_MS) break;
    turns[next] = { ...turns[next], skipped: true, endedAt: now };
    next++;
  }

  if (next >= turns.length) {
    await ctx.db.patch(game._id, { turns, phase: "done", phaseEndsAt: now });
    await ctx.db.patch(room._id, { status: "reveal" });
    return;
  }

  const phaseEndsAt = now + game.turnSeconds * 1000;
  await ctx.db.patch(game._id, { turns, phase: "drawing", currentTurn: next, phaseEndsAt });
  await schedule(ctx, { _id: game._id, phaseEndsAt });
}

async function myContext(ctx: MutationCtx, sessionId: string) {
  const player = await ctx.db
    .query("players")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
  const room = player && (await ctx.db.get(player.roomId));
  const game = room?.currentGameId && (await ctx.db.get(room.currentGameId));
  if (!player || !room || !game) return null;
  return { player, room, game };
}

export const advance = internalMutation({
  args: { gameId: v.id("games"), endsAt: v.number() },
  handler: async (ctx, { gameId, endsAt }) => {
    const game = await ctx.db.get(gameId);
    if (!game || game.phaseEndsAt !== endsAt) return;
    await moveOn(ctx, game);
  },
});

/** 그리던 학생의 [완료]. 연타하거나 이미 넘어간 차례면 아무것도 하지 않는다. */
export const complete = mutation({
  args: { sessionId: v.string(), turn: v.number() },
  handler: async (ctx, { sessionId, turn }) => {
    const found = await myContext(ctx, sessionId);
    if (!found) return;
    const { player, game } = found;
    if (game.phase !== "drawing" || game.currentTurn !== turn) return;
    if (game.turns[turn].playerId !== player._id) return;
    await moveOn(ctx, game);
  },
});

/** 방장은 주제 공개 화면에서 한 번 다시 뽑을 수 있다. */
export const reroll = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const found = await myContext(ctx, sessionId);
    if (!found) return;
    const { room, game } = found;
    if (room.hostSessionId !== sessionId) throw new ConvexError("방장만 할 수 있어요.");
    if (game.phase !== "intro" || game.rerolled) return;
    const phaseEndsAt = Date.now() + INTRO_MS;
    await ctx.db.patch(game._id, { topic: randomTopic(game.topic), rerolled: true, phaseEndsAt });
    await schedule(ctx, { _id: game._id, phaseEndsAt });
  },
});

export const myGame = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    const room = player && (await ctx.db.get(player.roomId));
    if (!player || !room || room.status === "lobby" || !room.currentGameId) return null;
    const game = await ctx.db.get(room.currentGameId);
    if (!game) return null;

    return {
      phase: game.phase,
      topic: game.topic,
      canReroll: room.hostSessionId === sessionId && game.phase === "intro" && !game.rerolled,
      phaseEndsAt: game.phaseEndsAt,
      turnSeconds: game.turnSeconds,
      currentTurn: game.currentTurn,
      turns: game.turns.map((t, i) => ({
        number: t.number,
        stage: t.stage,
        hint: STAGE_HINTS[t.stage] ?? "",
        isMe: t.playerId === player._id,
        state: t.skipped
          ? ("skipped" as const)
          : game.phase === "done" || (game.phase === "drawing" && i < game.currentTurn)
            ? ("done" as const)
            : game.phase === "drawing" && i === game.currentTurn
              ? ("current" as const)
              : ("upcoming" as const),
      })),
    };
  },
});
