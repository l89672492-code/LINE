import { addDays, isValidDate, makeDate, weekdayOf } from "./dates.js";

// 把報名訊息拆解成：要做什麼、哪一天、哪個時段、誰、幾位
// 只負責「看懂文字」，不碰資料庫。看不懂的部分一律回傳 null，交給後面詢問使用者。

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
function normalize(text) {
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
// kind: "range"（18:30-20:30）、"start"（18:30）、"full"（整場）、
//       "first"（前半場）、"second"（後半場）、"period"（早上/下午/晚上）
// periodText：用來判斷早上/晚上的完整文字（「今晚」會在日期那一步被拿掉，所以另外傳）
export function parseTime(text, periodText = text) {
  const period = /早上|上午|早場/.test(periodText)
    ? "am"
    : /下午|晚上|今晚|明晚|傍晚|晚場|夜/.test(periodText)
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

  if (/全場|整場|全時段|整個時段|全程|打全/.test(text)) return { kind: "full" };
  if (/前半|前場|上半/.test(text)) return { kind: "first" };
  if (/後半|後場|下半場/.test(text)) return { kind: "second" };
  if (period === "am") return { kind: "period", period: "morning" };
  if (/下午/.test(periodText)) return { kind: "period", period: "afternoon" };
  if (period === "pm") return { kind: "period", period: "evening" };
  return null;
}

// 人數：一位、2位、兩個人、+1
export function parsePeople(text) {
  let m = text.match(new RegExp(`(${NUM})\\s*(?:位|個人|人|個)`));
  if (m) return { people: toNumber(m[1]), matched: m[0] };
  m = text.match(/[+＋]\s*(\d{1,2})/);
  if (m) return { people: Number(m[1]), matched: m[0] };
  return null;
}

const SELF_WORDS = /^(我|我們|本人|自己|俺|偶)$/;
const NOT_NAME =
  /報名|取消|名單|查詢|打球|零打|要|想|今天|今晚|今日|明天|明晚|明日|後天|週|周|星期|禮拜|早上|上午|中午|下午|晚上|全場|整場|全時段|前半|後半|點|位|人|\d/;
const AFTER_NAME =
  "(?:今天|今晚|今日|明天|明晚|明日|後天|下下?\\s*(?:週|周|星期|禮拜)|週|周|星期|禮拜|早上|上午|中午|下午|晚上|全場|整場|前半|後半|\\d|報名|要|想|也|取消|登記|\\+|加一|來|參加|打|不去|不打|[一二兩三四五六七八九十]位)";
// 拿掉這些字之後，剩下的通常就是名字
const FILLER =
  /報名|零打|打球|參加|登記|取消|名單|查詢|謝謝|感謝|麻煩|一下|請|晚上|早上|上午|中午|下午|全場|整場|全時段|前半場?|後半場?|不去了?|不打了?|[的了喔哦囉唷呢吧嗎也要想打去場幫替]|[，,。!！?？~、:：]/g;

// 姓名：「阿哲報名一位」→ 阿哲；「幫小明報名」→ 小明；「我今天要打」→ 本人
// 回傳 { name, self, unclear }：unclear = 有疑似名字但無法確定，要詢問使用者
// text 是已經拿掉日期、時間、人數的文字
export function parseName(text) {
  const t = text.replace(/\s+/g, " ").trim();

  // 「我和阿哲」這種一次好幾個名字的，請使用者分開報名
  if (/和|跟|還有|以及|、/.test(t)) return { name: null, self: false, unclear: true };

  let m = t.match(/(?:幫|替)\s*([^\s，,。!！?？]{1,10}?)\s*(?:報名|取消|登記|\+|加|也要|要|$)/);
  if (m && !SELF_WORDS.test(m[1]) && !NOT_NAME.test(m[1])) return { name: m[1], self: false };

  m = t.match(new RegExp(`^([^\\s，,。!！?？\\d+]{1,10}?)\\s*${AFTER_NAME}`));
  if (m) {
    if (SELF_WORDS.test(m[1]) || /^我/.test(m[1])) return { name: null, self: true };
    if (!NOT_NAME.test(m[1])) return { name: m[1], self: false };
  }

  // 例如「報名 阿哲」：把常用字拿掉，看剩下什麼
  const tokens = t.replace(FILLER, " ").replace(/[+＋]?\d+/g, " ").split(" ").filter(Boolean);
  if (tokens.length === 0) return { name: null, self: false };
  if (tokens.length === 1) {
    if (SELF_WORDS.test(tokens[0]) || /^我/.test(tokens[0])) return { name: null, self: true };
    if (tokens[0].length <= 10) return { name: tokens[0], self: false };
  }
  return { name: null, self: false, unclear: true };
}

export function parseIntent(text) {
  if (/^(說明|使用說明|幫助|help|功能|怎麼報名|\?|？)$/i.test(text)) return "help";
  if (/取消|不去了|不打了|不去|退出|退報/.test(text)) return "cancel";
  if (/名單|有誰|幾個人|幾人|多少人|查詢|查一下|人數|報名狀況/.test(text)) return "query";
  if (/報名|要打|打球|零打|參加|要去|想打|算我|登記|加一|[+＋]\s*\d/.test(text)) return "register";
  return "unknown";
}

// 主要入口
export function parseMessage(rawText, today) {
  const text = normalize(rawText);
  const intent = parseIntent(text);

  const dateResult = parseDate(text, today);
  // 先把日期文字拿掉，避免「10/12」被誤認成時間
  const withoutDate = dateResult ? text.replace(dateResult.matched, " ") : text;
  const time = parseTime(withoutDate, text);
  const withoutTime = time?.matched ? withoutDate.replace(time.matched, " ") : withoutDate;
  const peopleResult = parsePeople(withoutTime);
  const withoutPeople = peopleResult ? withoutTime.replace(peopleResult.matched, " ") : withoutTime;
  const { name, self, unclear = false } = parseName(withoutPeople);

  // 「小明明天晚上2位」沒有「報名」兩個字，但有日期/名字 + 人數，也當作報名
  const finalIntent =
    intent === "unknown" && peopleResult && (dateResult || name || self) ? "register" : intent;

  return {
    text,
    intent: finalIntent,
    date: dateResult?.date ?? null,
    time,
    people: peopleResult?.people ?? null,
    name,
    self,
    nameUnclear: unclear,
  };
}
