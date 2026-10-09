import { VENUE } from "./venue.js";
import { formatDate, taipeiNow, weekdayName, weekdayOf } from "./dates.js";
import { parseMessage } from "./parser.js";
import { hhmm, resolveSession, sessionLabel } from "./sessions.js";
import {
  cancelRegistration,
  findPlayerRegistrations,
  normalizeName,
  registerPlayer,
} from "./registrations.js";
import { buildRoster, rosterStart } from "./roster.js";

// 機器人的對話流程：收到一句話 → 回一句話
// 資訊不足時把目前進度存起來（pending），先問使用者，等回答後再繼續

const PENDING_MINUTES = 30; // 超過 30 分鐘沒回答，就當作放棄

export const HELP_TEXT = [
  `🏸 ${VENUE.name} 零打報名`,
  "",
  "報名範例：",
  "・我今天晚上要打球",
  "・我報名週五零打",
  "・阿哲報名週五一位",
  "・小明明天 18:30-20:30 兩位",
  "",
  "取消範例：",
  "・我要取消今天的報名",
  "・取消阿哲週五的報名",
  "",
  "查詢名單：",
  "・名單（今天起 7 天）",
  "",
  `📍 ${VENUE.address}`,
].join("\n");

function sessionLine(s) {
  const extra = [s.level, s.price != null ? `$${s.price}` : null].filter(Boolean).join(" ");
  return `${sessionLabel(s)}${extra ? ` ${extra}` : ""}`;
}

function optionsText(sessions) {
  return sessions.map((s, i) => `${i + 1}. ${sessionLine(s)}`).join("\n");
}

// ---- 主要入口 ----
// input: { text, userId, displayName, now }
// 回傳 { reply }；reply 為 null 代表這句話跟報名無關，不需要回覆
export async function handleMessage(repo, { text, userId = null, displayName = null, now = new Date() }) {
  const { date: today, time: nowTime } = taipeiNow(now);
  const ctx = { repo, userId, displayName, today, nowTime };
  const parsed = parseMessage(text, today);

  let pending = userId ? await repo.getPending(userId) : null;
  if (pending && now - new Date(pending.updatedAt) > PENDING_MINUTES * 60 * 1000) {
    await repo.clearPending(userId);
    pending = null;
  }

  if (parsed.intent === "help") return { reply: HELP_TEXT };

  if (pending && /^(算了|不用了|不要了|沒事|取消詢問)$/.test(parsed.text)) {
    await repo.clearPending(userId);
    return { reply: "好的，這次的操作已經取消 👌" };
  }

  // 正在等使用者回答，而且這句話不是一個新的指令 → 把回答補進去
  if (pending && parsed.intent === "unknown") {
    const state = fillAnswer(pending, parsed);
    if (!state) return { reply: `抱歉，我看不懂您的回答 🙏\n${pending.question}\n（不想繼續請輸入「算了」）` };
    return process(ctx, state);
  }

  if (parsed.intent === "unknown") return { reply: null };

  return process(ctx, {
    intent: parsed.intent,
    date: parsed.date,
    time: parsed.time,
    people: parsed.people,
    name: parsed.name,
    self: parsed.self,
    nameUnclear: parsed.nameUnclear,
    sessionId: null,
  });
}

// 把使用者對問題的回答，合併到原本的報名內容
function fillAnswer(pending, parsed) {
  const state = { ...pending };
  delete state.updatedAt;

  if (pending.awaiting === "session") {
    const n = parsed.text.match(/^(\d{1,2})$/);
    if (n && pending.optionIds[Number(n[1]) - 1] != null) {
      state.sessionId = pending.optionIds[Number(n[1]) - 1];
      return state;
    }
    if (parsed.time) return { ...state, time: parsed.time };
    return null;
  }

  if (pending.awaiting === "date") {
    if (!parsed.date) return null;
    return { ...state, date: parsed.date, time: parsed.time ?? state.time };
  }

  if (pending.awaiting === "name") {
    const name = normalizeName(parsed.text);
    if (!name || name.length > 20 || /和|跟|、/.test(name)) return null;
    return { ...state, name, self: false, nameUnclear: false };
  }

  return null;
}

async function ask(ctx, state, awaiting, question, extra = {}) {
  if (!ctx.userId) return { reply: question }; // 沒有使用者代號就無法記住對話
  await ctx.repo.setPending(ctx.userId, { ...state, ...extra, awaiting, question });
  return { reply: question };
}

async function done(ctx, reply) {
  if (ctx.userId) await ctx.repo.clearPending(ctx.userId);
  return { reply };
}

function resolveName(ctx, state) {
  if (state.name) return state.name;
  if (state.nameUnclear) return null;
  return ctx.displayName || null; // 說「我」或沒有特別寫名字 → 使用 LINE 名稱
}

async function process(ctx, state) {
  if (state.intent === "query") return handleQuery(ctx, state);
  if (state.intent === "cancel") return handleCancel(ctx, state);
  return handleRegister(ctx, state);
}

// ---- 報名 ----
async function handleRegister(ctx, state) {
  const { repo, today, nowTime } = ctx;

  if (!state.date) {
    return ask(ctx, state, "date", "請問要報名哪一天呢？\n（例如：今天、明天、週五、10/15）");
  }
  if (state.date < today) {
    return done(ctx, `${formatDate(state.date)} 已經過了，無法報名喔。`);
  }

  const weekday = weekdayOf(state.date);
  const sessions = await repo.listSessions(weekday);
  if (sessions.length === 0) {
    return done(ctx, `${formatDate(state.date)} 星期${weekdayName(weekday)}沒有零打喔 🙏\n輸入「說明」可以查看報名方式。`);
  }

  let session = state.sessionId ? sessions.find((s) => s.id === state.sessionId) : null;
  if (!session) {
    const result = resolveSession(sessions, state.time, { defaultFull: true });
    if (!result.session) {
      const prefix = result.noMatch ? "找不到您說的時段。" : "";
      return ask(
        ctx,
        { ...state, time: null },
        "session",
        `${prefix}${formatDate(state.date)} 有以下時段，請問要報名哪一個？\n${optionsText(result.options)}\n\n請回覆數字（例如：1）`,
        { optionIds: result.options.map((s) => s.id) }
      );
    }
    session = result.session;
  }

  if (state.date === today && hhmm(session.end_time) <= nowTime) {
    return done(ctx, `${formatDate(state.date)} ${sessionLabel(session)} 已經結束了，無法報名喔。`);
  }

  const name = resolveName(ctx, state);
  if (!name) {
    return ask(ctx, { ...state, sessionId: session.id }, "name", "請問報名者的名字是？\n（一次一位，例如：阿哲）");
  }

  const people = state.people ?? 1;
  const result = await registerPlayer(repo, {
    date: state.date,
    sessionId: session.id,
    name,
    people,
    lineUserId: ctx.userId,
    source: "line",
  });

  const where = `${formatDate(state.date)} ${sessionLabel(session)}`;
  const first =
    result.status === "duplicate"
      ? `${result.registration.name} 已經報名過 ${where} 囉，不會重複計算 😊`
      : `✅ ${name}${people > 1 ? ` x${people}` : ""} 報名成功：${where}`;
  return done(ctx, `${first}\n\n${await buildRoster(repo, rosterStart(today, state.date))}`);
}

// ---- 取消 ----
async function handleCancel(ctx, state) {
  const { repo } = ctx;

  if (!state.date) {
    return ask(ctx, state, "date", "請問要取消哪一天的報名呢？\n（例如：今天、明天、週五、10/15）");
  }

  const name = resolveName(ctx, state);
  if (!name) {
    return ask(ctx, state, "name", "請問要取消誰的報名？\n（一次一位，例如：阿哲）");
  }

  const regs = await findPlayerRegistrations(repo, state.date, name);
  if (regs.length === 0) {
    return done(ctx, `查不到 ${name} 在 ${formatDate(state.date)} 的報名紀錄喔。`);
  }

  const sessions = await repo.getSessionsByIds([...new Set(regs.map((r) => r.session_id))]);
  let target = null;
  if (state.sessionId) {
    target = regs.find((r) => r.session_id === state.sessionId) ?? null;
  } else {
    const result = resolveSession(sessions, state.time, { defaultFull: false });
    if (result.session) {
      target = regs.find((r) => r.session_id === result.session.id) ?? null;
    } else {
      return ask(
        ctx,
        { ...state, name, time: null },
        "session",
        `${name} 在 ${formatDate(state.date)} 報名了以下時段，請問要取消哪一個？\n${optionsText(result.options)}\n\n請回覆數字（例如：1）`,
        { optionIds: result.options.map((s) => s.id) }
      );
    }
  }

  if (!target) return done(ctx, `查不到 ${name} 在 ${formatDate(state.date)} 這個時段的報名紀錄喔。`);

  const session = sessions.find((s) => s.id === target.session_id);
  const result = await cancelRegistration(repo, target.id);
  if (!result.registration) return done(ctx, "這筆報名已經取消過了。");
  return done(
    ctx,
    `👌 已取消 ${target.name} ${formatDate(state.date)} ${sessionLabel(session)} 的報名\n\n${await buildRoster(repo, rosterStart(ctx.today, state.date))}`
  );
}

// ---- 查詢名單 ----
// 沒寫日期就從今天開始，顯示 7 天
async function handleQuery(ctx, state) {
  return done(ctx, await buildRoster(ctx.repo, rosterStart(ctx.today, state.date)));
}
