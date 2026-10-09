import { VENUE } from "./venue.js";
import { formatDate, taipeiNow } from "./dates.js";
import { normalize, parseDate, parseTime } from "./parser.js";

// 租場地機器人：收到一句話 → 回一句話
// 空場和價格都即時向訂場網站查詢；要預約時請客人到網站完成

const BOOK_URL = `${VENUE.bookingSite}/booking`;
const MY_URL = `${VENUE.bookingSite}/my-booking`;
const BOOK_LINE = `👉 線上預約：${BOOK_URL}`;

export const HELP_TEXT = [
  `🏸 ${VENUE.name} 租場地`,
  "",
  "查空場，例如：",
  "・明天空場",
  "・週六晚上有場嗎",
  "・10/15 7點到9點",
  "",
  "看價格：輸入「價格」",
  "查詢／取消預約：輸入「查詢預約」",
  "",
  BOOK_LINE,
  `📍 ${VENUE.address}`,
  `☎️ ${VENUE.phone}`,
].join("\n");

function toMinutes(t) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(n) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}

const hhmm = (t) => t.slice(0, 5);
const money = (n) => `$${n.toLocaleString("en-US")}`;

// ---- 主要入口 ----
// api：訂場網站的查詢（正式環境用 lib/booking.js，測試時用假的）
// 回傳 { reply }；reply 為 null 代表這句話跟租場無關，不需要回覆
export async function handleMessage(api, { text, now = new Date() }) {
  const { date: today, time: nowTime } = taipeiNow(now);
  const t = normalize(text);

  if (/^(說明|使用說明|幫助|help|功能|\?)$/i.test(t)) return { reply: HELP_TEXT };
  if (/查詢預約|查預約|我的預約|預約編號|取消|改期|改時間|退訂/.test(t)) return { reply: myBookingText() };
  if (/價格|價錢|價目|多少錢|收費|費用|租金/.test(t)) return { reply: await priceText(api) };

  const date = parseDate(t, today);
  const withoutDate = date ? t.replace(date.matched, " ") : t;
  const time = parseTime(withoutDate, t);

  if (date) {
    // 只傳日期（例如「10/15」）或日期加上租場相關的字，就查空場
    const rest = (time?.matched ? withoutDate.replace(time.matched, " ") : withoutDate)
      .replace(/早上|上午|中午|下午|晚上|傍晚|[的嗎呢喔，,。?!~\s]/g, "");
    if (!rest || /空|租|訂|預約|場|有沒有|可以|還有|時段|打球/.test(rest)) {
      return { reply: await availabilityText(api, date.date, time, today, nowTime) };
    }
    return { reply: null };
  }

  if (/租|訂場|預約|空場|包場|有場|場地/.test(t)) {
    return {
      reply: `請問想租哪一天呢？\n例如：「明天空場」「週六晚上」「10/15 7點到9點」\n\n${BOOK_LINE}`,
    };
  }

  return { reply: null };
}

function myBookingText() {
  return [
    "查詢或取消預約，請到這裡輸入「預約編號」和「手機號碼」：",
    MY_URL,
    "",
    `有問題請洽館方 ☎️ ${VENUE.phone}`,
  ].join("\n");
}

// ---- 價格 ----
async function priceText(api) {
  const rules = await api.getPricingRules();
  const block = (type, title) => {
    const rows = rules.filter((r) => r.day_type === type);
    if (rows.length === 0) return [];
    return [title, ...rows.map((r) => `${hhmm(r.start_time)}–${hhmm(r.end_time)}　${money(r.price)}`), ""];
  };
  return [
    "💰 租場價格（每面／每小時）",
    "",
    ...block("weekday", "【平日】"),
    ...block("holiday", "【假日：週六、週日、國定假日】"),
    `季繳及長期租借優惠，請洽館方 ☎️ ${VENUE.phone}`,
    BOOK_LINE,
  ].join("\n");
}

// ---- 空場 ----
const PERIOD_LABEL = { morning: "早上", afternoon: "下午", evening: "晚上" };

function inPeriod(start, period) {
  const m = toMinutes(start);
  if (period === "morning") return m < 12 * 60;
  if (period === "afternoon") return m >= 12 * 60 && m < 18 * 60;
  return m >= 18 * 60;
}

async function availabilityText(api, date, time, today, nowTime) {
  const day = formatDate(date);
  if (date < today) return `${day} 已經過了喔。`;

  const status = await api.getDateStatus(date);
  if (status?.status === "closed") {
    return `${day}${status.holiday_name ? ` ${status.holiday_name}` : ""} 休館，無法租場 🙏`;
  }
  if (status?.status === "unavailable") {
    return `${day} 還沒開放預約喔，請晚一點再查詢 🙏\n${BOOK_LINE}`;
  }

  // 依時段整理：每個開始時間 → 還有哪些場地可以租
  const slots = new Map();
  for (const row of await api.getDayAvailability(date)) {
    if (row.status === "past") continue;
    const start = hhmm(row.start_time);
    if (date === today && start < nowTime) continue;
    if (!slots.has(start)) slots.set(start, { start, end: hhmm(row.end_time), price: row.price, free: [] });
    if (row.status === "available") slots.get(start).free.push(row);
  }
  if (slots.size === 0) return `${day} 已經沒有可以租的時段了 🙏\n${BOOK_LINE}`;

  const lines = [`📅 ${day} 空場狀況${time?.kind === "period" ? `（${PERIOD_LABEL[time.period]}）` : ""}`];

  if (time?.kind === "start" || time?.kind === "range") {
    lines.push("", rangeText(slots, time.start, time.kind === "range" ? time.end : fromMinutes(toMinutes(time.start) + 60)));
  }

  // 整點的時段，相鄰且空場數、價格都一樣的合併成一行
  let hourly = [...slots.values()].filter((s) => s.start.endsWith(":00")).sort((a, b) => (a.start < b.start ? -1 : 1));
  if (time?.kind === "period") hourly = hourly.filter((s) => inPeriod(s.start, time.period));

  const groups = [];
  for (const s of hourly) {
    const last = groups.at(-1);
    if (last && last.end === s.start && last.count === s.free.length && last.price === s.price) last.end = s.end;
    else groups.push({ start: s.start, end: s.end, count: s.free.length, price: s.price });
  }
  if (groups.length) {
    lines.push("");
    for (const g of groups) {
      lines.push(`${g.start}–${g.end}　${g.count ? `${g.count} 面可租｜${money(g.price)}/小時` : "已滿"}`);
    }
  } else if (time?.kind === "period") {
    lines.push("", `${PERIOD_LABEL[time.period]}沒有可以租的時段。`);
  }

  lines.push("", BOOK_LINE, "（也可以從半點開始租，例如 18:30，請在網站上選）");
  return lines.join("\n");
}

// 指定時間（例如 19:00–21:00）：哪些場地整段都空著、每面多少錢
function rangeText(slots, start, end) {
  const label = `${start}–${end}`;
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (endMin <= startMin) return `🔎 ${label} 的時間怪怪的，請再確認一次喔。`;

  const parts = [];
  for (let m = startMin; m < endMin; m += 60) {
    const slot = slots.get(fromMinutes(m));
    if (!slot || toMinutes(slot.end) > endMin) return `🔎 ${label} 不在可以租的時段內，請參考下面的空場狀況。`;
    parts.push(slot);
  }

  const free = parts[0].free.filter((c) => parts.every((p) => p.free.some((f) => f.court_id === c.court_id)));
  if (free.length === 0) return `🔎 ${label} 已經沒有空場了 😢`;
  const total = parts.reduce((sum, p) => sum + p.price, 0);
  return `🔎 ${label}：${free.map((c) => c.court_name).join("、")} 可以租（每面 ${money(total)}）`;
}
