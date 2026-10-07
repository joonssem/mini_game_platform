import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  AWAY_AFTER_MS,
  DEFAULT_TURN_SECONDS,
  MAX_NUMBER,
  MAX_PLAYERS,
  MIN_NUMBER,
  MIN_PLAYERS,
  ROOM_TTL_MS,
  TAKEOVER_AFTER_MS,
  TURN_SECONDS_OPTIONS,
} from "./constants";

// 방 만들기, 입장, 대기실, 방장. 규칙은 docs/PRD.md 5장, 6장.
// 다른 학생의 sessionId는 절대 화면으로 내보내지 않는다 (알면 그 학생 행세를 할 수 있다).

function fail(message: string): never {
  throw new ConvexError(message);
}

function assertSessionId(sessionId: string) {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(sessionId)) fail("기기 정보가 올바르지 않아요. 새로고침해 주세요.");
}

function assertNumber(number: number) {
  if (!Number.isInteger(number) || number < MIN_NUMBER || number > MAX_NUMBER) {
    fail(`번호는 ${MIN_NUMBER}~${MAX_NUMBER} 사이로 입력해 주세요.`);
  }
}

async function roomPlayers(ctx: QueryCtx, roomId: Id<"rooms">) {
  const players = await ctx.db
    .query("players")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  return players.sort((a, b) => a.joinedAt - b.joinedAt);
}

/** 플레이어를 빼고, 방이 비면 방을 지우고, 방장이 나가면 가장 먼저 들어온 학생에게 넘긴다. */
async function removePlayer(ctx: MutationCtx, player: Doc<"players">) {
  await ctx.db.delete(player._id);
  const room = await ctx.db.get(player.roomId);
  if (!room) return;
  const rest = await roomPlayers(ctx, room._id);
  if (rest.length === 0) {
    await ctx.db.delete(room._id);
  } else if (room.hostSessionId === player.sessionId) {
    await ctx.db.patch(room._id, { hostSessionId: rest[0].sessionId });
  }
}

/** 한 기기는 한 방에만 있을 수 있다. */
async function detachSession(ctx: MutationCtx, sessionId: string, keepRoomId?: Id<"rooms">) {
  const mine = await ctx.db
    .query("players")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const player of mine) {
    if (player.roomId !== keepRoomId) await removePlayer(ctx, player);
  }
}

/** 대기실에서 오래 연결이 없는 학생을 목록에서 뺀다. 빈 자리가 입장을 막지 않게 하기 위해서다. */
async function pruneLobby(ctx: MutationCtx, room: Doc<"rooms">, now: number) {
  if (room.status !== "lobby") return;
  for (const player of await roomPlayers(ctx, room._id)) {
    if (now - player.lastSeenAt >= AWAY_AFTER_MS) await removePlayer(ctx, player);
  }
}

async function myPlayer(ctx: QueryCtx, sessionId: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .first();
}

async function requireHost(ctx: MutationCtx, sessionId: string) {
  assertSessionId(sessionId);
  const player = await myPlayer(ctx, sessionId);
  const room = player && (await ctx.db.get(player.roomId));
  if (!room) fail("방을 찾을 수 없어요.");
  if (room.hostSessionId !== sessionId) fail("방장만 할 수 있어요.");
  return room;
}

export const create = mutation({
  args: { sessionId: v.string(), number: v.number() },
  handler: async (ctx, { sessionId, number }) => {
    assertSessionId(sessionId);
    assertNumber(number);
    await detachSession(ctx, sessionId);

    let code = "";
    for (let i = 0; i < 20 && !code; i++) {
      const candidate = String(1000 + Math.floor(Math.random() * 9000));
      const taken = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", candidate))
        .first();
      if (!taken) code = candidate;
    }
    if (!code) fail("방을 만들지 못했어요. 다시 시도해 주세요.");

    const now = Date.now();
    const roomId = await ctx.db.insert("rooms", {
      code,
      status: "lobby",
      hostSessionId: sessionId,
      turnSeconds: DEFAULT_TURN_SECONDS,
      createdAt: now,
    });
    await ctx.db.insert("players", { roomId, sessionId, number, joinedAt: now, lastSeenAt: now });
    await ctx.scheduler.runAfter(ROOM_TTL_MS, internal.rooms.deleteRoom, { roomId });
    return { code };
  },
});

export const join = mutation({
  args: { sessionId: v.string(), code: v.string(), number: v.number() },
  handler: async (ctx, { sessionId, code, number }) => {
    assertSessionId(sessionId);
    assertNumber(number);
    if (!/^\d{4}$/.test(code)) fail("방 코드는 숫자 4자리예요.");

    const found = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!found) fail("방 코드를 다시 확인해 주세요.");

    const now = Date.now();
    await pruneLobby(ctx, found, now);
    const room = await ctx.db.get(found._id);
    if (!room) fail("방 코드를 다시 확인해 주세요.");
    const players = await roomPlayers(ctx, room._id);

    const mine = players.find((p) => p.sessionId === sessionId);
    const sameNumber = players.find((p) => p.number === number && p.sessionId !== sessionId);

    // 같은 번호 자리: 연결이 끊긴 지 오래면 새 기기가 이어받고, 아니면 막는다.
    if (sameNumber) {
      if (now - sameNumber.lastSeenAt < TAKEOVER_AFTER_MS) fail("이미 들어온 번호예요.");
      if (mine) await removePlayer(ctx, mine);
      await detachSession(ctx, sessionId, room._id);
      await ctx.db.patch(sameNumber._id, { sessionId, lastSeenAt: now });
      const fresh = await ctx.db.get(room._id);
      if (fresh?.hostSessionId === sameNumber.sessionId) {
        await ctx.db.patch(room._id, { hostSessionId: sessionId });
      }
      return { code };
    }

    // 이미 이 방에 있는 기기: 다시 들어오기 (대기실에서는 번호 바꾸기 허용)
    if (mine) {
      if (mine.number !== number && room.status !== "lobby") fail("게임 중에는 번호를 바꿀 수 없어요.");
      await ctx.db.patch(mine._id, { number, lastSeenAt: now });
      return { code };
    }

    if (room.status !== "lobby") fail("지금 게임 중이에요. 다음 판에 들어오세요.");
    if (players.length >= MAX_PLAYERS) fail(`방이 꽉 찼어요. (최대 ${MAX_PLAYERS}명)`);

    await detachSession(ctx, sessionId);
    await ctx.db.insert("players", { roomId: room._id, sessionId, number, joinedAt: now, lastSeenAt: now });
    return { code };
  },
});

export const leave = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    assertSessionId(sessionId);
    await detachSession(ctx, sessionId);
  },
});

export const heartbeat = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    assertSessionId(sessionId);
    const player = await myPlayer(ctx, sessionId);
    if (!player) return;
    const now = Date.now();
    await ctx.db.patch(player._id, { lastSeenAt: now });
    const room = await ctx.db.get(player.roomId);
    if (room) await pruneLobby(ctx, room, now);
  },
});

export const setTurnSeconds = mutation({
  args: { sessionId: v.string(), seconds: v.number() },
  handler: async (ctx, { sessionId, seconds }) => {
    const room = await requireHost(ctx, sessionId);
    if (!(TURN_SECONDS_OPTIONS as readonly number[]).includes(seconds)) fail("선택할 수 없는 시간이에요.");
    if (room.status !== "lobby") fail("대기실에서만 바꿀 수 있어요.");
    await ctx.db.patch(room._id, { turnSeconds: seconds });
  },
});

export const start = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const room = await requireHost(ctx, sessionId);
    if (room.status !== "lobby") fail("이미 시작했어요.");
    const now = Date.now();
    const active = (await roomPlayers(ctx, room._id)).filter(
      (p) => now - p.lastSeenAt < AWAY_AFTER_MS,
    );
    if (active.length < MIN_PLAYERS) fail(`${MIN_PLAYERS}명 이상 모여야 시작할 수 있어요.`);
    // M2에서 여기서 게임(games)을 만든다.
    await ctx.db.patch(room._id, { status: "playing" });
  },
});

/** M1 확인용 임시 기능. M4의 "한 판 더"가 생기면 지운다. */
export const backToLobby = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const room = await requireHost(ctx, sessionId);
    await ctx.db.patch(room._id, { status: "lobby" });
  },
});

export const myRoom = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(sessionId)) return null;
    const player = await myPlayer(ctx, sessionId);
    const room = player && (await ctx.db.get(player.roomId));
    if (!room) return null;

    const now = Date.now();
    const players = await roomPlayers(ctx, room._id);
    return {
      code: room.code,
      status: room.status,
      turnSeconds: room.turnSeconds,
      isHost: room.hostSessionId === sessionId,
      myNumber: player.number,
      players: players.map((p) => ({
        number: p.number,
        isHost: p.sessionId === room.hostSessionId,
        isMe: p.sessionId === sessionId,
        connected: now - p.lastSeenAt < TAKEOVER_AFTER_MS,
      })),
    };
  },
});

export const deleteRoom = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    for (const player of await roomPlayers(ctx, roomId)) await ctx.db.delete(player._id);
    if (await ctx.db.get(roomId)) await ctx.db.delete(roomId);
  },
});
