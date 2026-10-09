import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDate, parseTime } from "../lib/parser.js";

const TODAY = "2026-10-09"; // 星期五
const d = (t) => parseDate(t, TODAY)?.date ?? null;

test("日期換算", () => {
  assert.equal(d("今天"), "2026-10-09");
  assert.equal(d("明晚"), "2026-10-10");
  assert.equal(d("後天"), "2026-10-11");
  assert.equal(d("週五"), "2026-10-09"); // 今天就是週五
  assert.equal(d("星期日"), "2026-10-11");
  assert.equal(d("禮拜一"), "2026-10-12");
  assert.equal(d("下週五"), "2026-10-16");
  assert.equal(d("下下週一"), "2026-10-19");
  assert.equal(d("10/15"), "2026-10-15");
  assert.equal(d("10月20號"), "2026-10-20");
  assert.equal(d("12號"), "2026-10-12");
  assert.equal(d("5號"), "2026-11-05"); // 這個月的 5 號已過 → 下個月
  assert.equal(d("1/3"), "2027-01-03");
  assert.equal(d("價格"), null);
});

test("時段", () => {
  assert.deepEqual(parseTime("6點半到8點半"), { kind: "range", start: "18:30", end: "20:30", matched: "6點半到8點半" });
  assert.deepEqual(parseTime("7點到9點"), { kind: "range", start: "19:00", end: "21:00", matched: "7點到9點" });
  assert.equal(parseTime("10點到12點").end, "12:00");
  assert.equal(parseTime("20:30").start, "20:30");
  assert.equal(parseTime("早上9點").start, "09:00");
  assert.equal(parseTime("早上").period, "morning");
  assert.equal(parseTime("下午").period, "afternoon");
  assert.equal(parseTime(" ", "今晚").period, "evening");
  assert.equal(parseTime("空場"), null);
});
