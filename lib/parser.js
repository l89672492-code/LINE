import { addDays, isValidDate, makeDate, weekdayOf } from "./dates.js";

// 從訊息裡找出日期和時間，只負責「看懂文字」，不碰資料庫。看不懂的部分一律回傳 null。

const CN_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const NUM = "(?:\\d{1,2}|[零〇一二兩三四五六七八九十]{1,3})";

// 中文數字或阿拉伯數字 → 數字（支援到 99）
export function toNumber(s) {
  if (s == null) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (s === "十") return 10;
  const m = s.match(/^([一二兩三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) return (m[1] ? CN_DIGITS[m[1]] : 1) * 10 + (m[2] ? CN_DIGITS[m[2]] : 0);
  if (s.length === 1 && s in CN_DIGITS) return CN_DIGITS[s];
  return null;
}

// 全形轉半形，方便後續比對
export function normalize(text) {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/[～〜]/g, "~")
    .replace(/[－—–]/g, "-")
    .trim();
}

const WEEKDAY_CHAR = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 0 };

// 找出日期，回傳 { date, matched }，沒有則 null
export function parseDate(text, today) {
  let m;

  // 10/12、10月12日、10月12號
  m = text.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*[日號]?/);
  if (m) {
    const [ty, tm] = today.split("-").map(Number);
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = month < tm - 6 ? ty + 1 : ty; // 例如 12 月時說 1/5，代表明年
    if (isValidDate(year, month, day)) return { date: makeDate(year, month, day), matched: m[0] };
  }

  // 今天 / 明天 / 後天
  m = text.match(/今天|今日|今晚|明天|明日|明晚|後天/);
  if (m) {
    const offset = /^今/.test(m[0]) ? 0 : /^明/.test(m[0]) ? 1 : 2;
    return { date: addDays(today, offset), matched: m[0] };
  }

  // 週五、星期五、禮拜五、下週五、下下週五
  m = text.match(/(下下|下)?\s*(?:週|周|星期|禮拜)\s*([日天一二三四五六1-7])/);
  if (m) {
    const target = WEEKDAY_CHAR[m[2]];
    const todayWd = weekdayOf(today);
    if (!m[1]) {
      // 這週還沒到的那一天（說「週五」當天就是今天）
      return { date: addDays(today, (target - todayWd + 7) % 7), matched: m[0] };
    }
    // 下週：以星期一為一週的開始
    const monday = addDays(today, -((todayWd + 6) % 7));
    const weeks = m[1] === "下下" ? 2 : 1;
    return { date: addDays(monday, weeks * 7 + ((target + 6) % 7)), matched: m[0] };
  }

  // 12號、十二號（本月；如果已經過了，就是下個月）
  m = text.match(new RegExp(`(${NUM})\\s*[號日]`));
  if (m) {
    const day = toNumber(m[1]);
    let [y, mo, d] = today.split("-").map(Number);
    if (day && day < d) {
      mo += 1;
      if (mo > 12) {
        mo = 1;
        y += 1;
      }
    }
    if (day && isValidDate(y, mo, day)) return { date: makeDate(y, mo, day), matched: m[0] };
  }

  return null;
}

// 把「6點半」、「18:30」等轉成 "18:30"
function toHHMM(hour, minute, period) {
  let h = hour;
  if (period === "pm" && h < 12) h += 12;
  else if (!period && h >= 1 && h <= 8) h += 12; // 沒講上下午時，1～8 點視為下午/晚上
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TIME_POINT = `(${NUM})\\s*(?:[:：.]\\s*(\\d{2})|點\\s*(半|${NUM}\\s*分?)?)`;

function readTimePoint(m, offset, period) {
  const hour = toNumber(m[offset]);
  if (hour == null || hour > 24) return null;
  let minute = 0;
  if (m[offset + 1]) minute = Number(m[offset + 1]);
  else if (m[offset + 2] === "半") minute = 30;
  else if (m[offset + 2]) minute = toNumber(m[offset + 2].replace(/\s*分$/, "")) ?? 0;
  return toHHMM(hour, minute, period);
}

// 找出時段，回傳 { kind, ... }
// kind: "range"（18:30-20:30）、"start"（18:30）、"period"（早上/下午/晚上）
// periodText：用來判斷早上/晚上的完整文字（「今晚」會在日期那一步被拿掉，所以另外傳）
export function parseTime(text, periodText = text) {
  const period = /早上|上午/.test(periodText)
    ? "am"
    : /下午|晚上|今晚|明晚|傍晚|夜/.test(periodText)
      ? "pm"
      : null;

  const range = text.match(new RegExp(`${TIME_POINT}\\s*(?:-|~|到|至)\\s*${TIME_POINT}`));
  if (range) {
    const start = readTimePoint(range, 1, period);
    const end = readTimePoint(range, 4, period ?? (start && start >= "12:00" ? "pm" : null));
    if (start && end) return { kind: "range", start, end, matched: range[0] };
  }

  const point = text.match(new RegExp(TIME_POINT));
  if (point) {
    const start = readTimePoint(point, 1, period);
    if (start) return { kind: "start", start, matched: point[0] };
  }

  if (period === "am") return { kind: "period", period: "morning" };
  if (/下午/.test(periodText)) return { kind: "period", period: "afternoon" };
  if (period === "pm") return { kind: "period", period: "evening" };
  return null;
}
