import { VENUE } from "./venue.js";

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

// 取得台灣時間的「今天日期」與「現在幾點幾分」
export function taipeiNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: VENUE.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function toUTC(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

function fromUTC(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr, days) {
  const d = toUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

// 0 = 星期日、1 = 星期一 … 6 = 星期六
export function weekdayOf(dateStr) {
  return toUTC(dateStr).getUTCDay();
}

export function weekdayName(weekday) {
  return WEEKDAY_NAMES[weekday];
}

// 顯示用：10/9（五）
export function formatDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}（${weekdayName(weekdayOf(dateStr))}）`;
}

export function isValidDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function makeDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
