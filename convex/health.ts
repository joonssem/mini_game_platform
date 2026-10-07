import { query } from "./_generated/server";

// M0 연결 확인용. 화면에 서버 시각이 보이면 Convex 연결이 된 것이다.
export const ping = query({
  args: {},
  handler: async () => {
    return { ok: true, serverTime: Date.now() };
  },
});
