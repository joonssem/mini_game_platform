import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { ROOM_TTL_MS, TEACHER_LOCK_MS, TEACHER_MAX_FAILURES, TEACHER_SESSION_MS } from "./constants";

// 교사 페이지: 최근 24시간 안에 끝난 게임 목록과 만화 내려받기. docs/PRD.md 5장(교사 페이지).
// 비밀번호는 Convex 환경 변수 TEACHER_PASSCODE에만 있다. 저장소와 Vercel에는 넣지 않는다.

// Convex 서버에서는 process.env로 환경 변수를 읽는다. 화면 빌드(tsconfig.app)에는 node 타입이 없어서 여기서 선언한다.
declare const process: { env: Record<string, string | undefined> };

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 길이와 관계없이 끝까지 비교해서, 응답 시간으로 비밀번호를 추측하기 어렵게 한다. */
function sameText(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** 토큰이 맞으면 true. 잘못되었거나 만료되면 false (화면은 다시 로그인하게 한다). */
async function isTeacher(ctx: QueryCtx, token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return false;
  const tokenHash = await sha256(token);
  const session = await ctx.db
    .query("teacherSessions")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .first();
  return !!session && session.expiresAt > Date.now();
}

// 실패 횟수를 저장해야 하므로 오류를 던지지 않고 결과로 돌려준다 (오류를 던지면 저장도 취소된다).
export const login = mutation({
  args: { passcode: v.string() },
  handler: async (ctx, { passcode }) => {
    const expected = process.env.TEACHER_PASSCODE;
    if (!expected) {
      return { ok: false as const, message: "교사 비밀번호가 아직 설정되지 않았어요. (Convex 환경 변수 TEACHER_PASSCODE)" };
    }

    const now = Date.now();
    const guard = await ctx.db.query("teacherGuard").first();
    if (guard && guard.lockedUntil > now) {
      const minutes = Math.ceil((guard.lockedUntil - now) / 60000);
      return { ok: false as const, message: `여러 번 틀려서 잠겼어요. ${minutes}분 뒤에 다시 시도해 주세요.` };
    }

    if (!sameText(passcode, expected)) {
      const failures = (guard?.failures ?? 0) + 1;
      const locked = failures >= TEACHER_MAX_FAILURES;
      const next = { failures: locked ? 0 : failures, lockedUntil: locked ? now + TEACHER_LOCK_MS : 0 };
      if (guard) await ctx.db.patch(guard._id, next);
      else await ctx.db.insert("teacherGuard", next);
      return { ok: false as const, message: "비밀번호가 맞지 않아요." };
    }

    if (guard) await ctx.db.patch(guard._id, { failures: 0, lockedUntil: 0 });
    const token = randomToken();
    const expiresAt = now + TEACHER_SESSION_MS;
    const sessionId = await ctx.db.insert("teacherSessions", { tokenHash: await sha256(token), expiresAt });
    await ctx.scheduler.runAt(expiresAt, internal.teacher.deleteSession, { sessionId });
    return { ok: true as const, token };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256(token);
    const found = await ctx.db
      .query("teacherSessions")
      .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (found) await ctx.db.delete(found._id);
  },
});

export const deleteSession = internalMutation({
  args: { sessionId: v.id("teacherSessions") },
  handler: async (ctx, { sessionId }) => {
    if (await ctx.db.get(sessionId)) await ctx.db.delete(sessionId);
  },
});

/** 최근 24시간 안에 끝난 게임. 토큰이 잘못되면 null. */
export const games = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!(await isTeacher(ctx, token))) return null;
    const since = Date.now() - ROOM_TTL_MS;
    const all = await ctx.db.query("games").collect();
    return all
      .filter((g) => g.phase === "done" && g.startedAt > since)
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((g) => ({
        id: g._id,
        topic: g.topic,
        startedAt: g.startedAt,
        turns: g.turns.map((t) => ({ number: t.number, stage: t.stage, skipped: !!t.skipped })),
      }));
  },
});

/** 한 게임의 모든 칸과 획. 토큰이 잘못되면 null. */
export const comic = query({
  args: { token: v.string(), gameId: v.id("games") },
  handler: async (ctx, { token, gameId }) => {
    if (!(await isTeacher(ctx, token))) return null;
    const game = await ctx.db.get(gameId);
    if (!game) return null;
    const strokes = await ctx.db
      .query("strokes")
      .withIndex("by_game_turn", (q) => q.eq("gameId", game._id))
      .collect();
    return {
      topic: game.topic,
      startedAt: game.startedAt,
      panels: game.turns.map((t, i) => ({
        number: t.number,
        stage: t.stage,
        strokes: strokes
          .filter((s) => s.turn === i)
          .map((s) => ({ clientId: s.clientId, color: s.color, width: s.width, points: s.points })),
      })),
    };
  },
});
