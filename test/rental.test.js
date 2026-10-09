import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../lib/rental.js";

// 2026-10-09 是星期五，台灣時間下午 3 點
const NOW = new Date("2026-10-09T07:00:00Z");
const COURTS = ["A場", "B場", "C場", "D場", "E場"];

// 假的訂場網站：09:00–22:00，每 30 分鐘一個開始時間，每段 1 小時
// booked：{ "日期 開始時間": ["A場", ...] } 已被預約的場地
function fakeApi({ booked = {}, closed = {}, weekend = [] } = {}) {
  return {
    async getDateStatus(date) {
      return closed[date] ? { date, status: "closed", holiday_name: closed[date] } : { date, status: "open", holiday_name: null };
    },
    async getDayAvailability(date) {
      const rows = [];
      for (let m = 9 * 60; m + 60 <= 22 * 60; m += 30) {
        const t = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}:00`;
        const holiday = weekend.includes(date);
        const price = holiday ? (m >= 12 * 60 && m < 14 * 60 ? 350 : 500) : m < 18 * 60 ? 350 : 500;
        COURTS.forEach((name, i) => {
          const start = t(m);
          const taken = (booked[`${date} ${start.slice(0, 5)}`] ?? []).includes(name);
          rows.push({ court_id: `c${i}`, court_name: name, sort_order: i, start_time: start, end_time: t(m + 60), status: taken ? "booked" : "available", price });
        });
      }
      return rows;
    },
    async getPricingRules() {
      return [
        { day_type: "weekday", start_time: "09:00:00", end_time: "18:00:00", price: 350 },
        { day_type: "weekday", start_time: "18:00:00", end_time: "22:00:00", price: 500 },
        { day_type: "holiday", start_time: "09:00:00", end_time: "12:00:00", price: 500 },
      ];
    },
  };
}

const say = (text, api = fakeApi()) => handleMessage(api, { text, now: NOW }).then((r) => r.reply);

test("「明天空場」→ 列出整天空場，相同的時段合併", async () => {
  const reply = await say("明天空場");
  assert.match(reply, /📅 10\/10（六） 空場狀況/);
  assert.match(reply, /09:00–18:00　5 面可租｜\$350\/小時/);
  assert.match(reply, /18:00–22:00　5 面可租｜\$500\/小時/);
  assert.match(reply, /jingfeng-booking\.vercel\.app\/booking/);
});

test("今天只顯示還沒開始的時段", async () => {
  const reply = await say("今天有場嗎");
  assert.match(reply, /15:00–18:00　5 面可租/);
  assert.doesNotMatch(reply, /09:00/);
});

test("已滿的時段顯示「已滿」", async () => {
  const booked = { "2026-10-12 19:00": COURTS, "2026-10-12 20:00": ["A場", "B場"] };
  const reply = await say("10/12", fakeApi({ booked }));
  assert.match(reply, /18:00–19:00　5 面可租/);
  assert.match(reply, /19:00–20:00　已滿/);
  assert.match(reply, /20:00–21:00　3 面可租/);
});

test("指定時間 → 列出整段都空著的場地和每面價格", async () => {
  const booked = { "2026-10-12 20:00": ["A場", "B場"] };
  const reply = await say("10/12 7點到9點", fakeApi({ booked }));
  assert.match(reply, /🔎 19:00–21:00：C場、D場、E場 可以租（每面 \$1,000）/);
});

test("指定時間全滿", async () => {
  const booked = { "2026-10-12 19:00": COURTS };
  const reply = await say("週一晚上7點有場嗎", fakeApi({ booked }));
  assert.match(reply, /🔎 19:00–20:00 已經沒有空場了/);
});

test("只問晚上 → 只列晚上的時段", async () => {
  const reply = await say("週日晚上有空場嗎");
  assert.match(reply, /空場狀況（晚上）/);
  assert.match(reply, /18:00–22:00/);
  assert.doesNotMatch(reply, /09:00/);
});

test("休館日", async () => {
  const reply = await say("10/10 空場", fakeApi({ closed: { "2026-10-10": "國慶日" } }));
  assert.match(reply, /10\/10（六） 國慶日 休館/);
});

test("過去的日期", async () => {
  assert.match(await say("10/5 空場"), /已經過了/);
});

test("想租場但沒說日期 → 詢問日期並附網址", async () => {
  const reply = await say("我想租場地");
  assert.match(reply, /請問想租哪一天/);
  assert.match(reply, /\/booking/);
});

test("價格", async () => {
  const reply = await say("租場多少錢");
  assert.match(reply, /【平日】\n09:00–18:00　\$350\n18:00–22:00　\$500/);
  assert.match(reply, /【假日：週六、週日、國定假日】\n09:00–12:00　\$500/);
});

test("查詢或取消預約 → 給查詢網址", async () => {
  assert.match(await say("我要取消 10/12 的預約"), /\/my-booking/);
  assert.match(await say("查詢預約"), /\/my-booking/);
});

test("說明", async () => {
  assert.match(await say("說明"), /租場地/);
});

test("跟租場無關的訊息不回覆", async () => {
  assert.equal(await say("大家好"), null);
  assert.equal(await say("今天好熱"), null);
});
