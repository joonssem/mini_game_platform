import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 방·게임·그림은 방마다 24시간 뒤 예약 삭제된다 (rooms.deleteRoom). 기록은 30일 뒤 매일 정리한다.
crons.daily("delete old events", { hourUTC: 18, minuteUTC: 0 }, internal.events.deleteOld);

export default crons;
