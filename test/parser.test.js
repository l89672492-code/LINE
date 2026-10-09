import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMessage } from "../lib/parser.js";

const TODAY = "2026-10-09"; // 星期五
const p = (t) => parseMessage(t, TODAY);

test("日期換算", () => {
  assert.equal(p("今天").date, "2026-10-09");
  assert.equal(p("明晚").date, "2026-10-10");
  assert.equal(p("後天").date, "2026-10-11");
  assert.equal(p("週五").date, "2026-10-09"); // 今天就是週五
  assert.equal(p("星期日").date, "2026-10-11");
  assert.equal(p("禮拜一").date, "2026-10-12");
  assert.equal(p("下週五").date, "2026-10-16");
  assert.equal(p("下下週一").date, "2026-10-19");
  assert.equal(p("10/15").date, "2026-10-15");
  assert.equal(p("10月20號").date, "2026-10-20");
  assert.equal(p("12號").date, "2026-10-12");
  assert.equal(p("5號").date, "2026-11-05"); // 這個月的 5 號已過 → 下個月
  assert.equal(p("1/3").date, "2027-01-03");
});

test("時段", () => {
  assert.deepEqual(p("6點半到8點半").time, { kind: "range", start: "18:30", end: "20:30", matched: "6點半到8點半" });
  assert.equal(p("20:30").time.start, "20:30");
  assert.equal(p("八點半").time.start, "20:30");
  assert.equal(p("早上").time.period, "morning");
  assert.equal(p("今晚").time.period, "evening");
  assert.equal(p("後半場").time.kind, "second");
  assert.equal(p("我報名週五零打").time, null);
});

test("姓名與人數", () => {
  assert.deepEqual([p("阿哲報名一位").name, p("阿哲報名一位").people], ["阿哲", 1]);
  assert.equal(p("幫小美報名明天").name, "小美");
  assert.equal(p("報名週五 老王").name, "老王");
  assert.equal(p("我今天晚上要打球").self, true);
  assert.equal(p("小明明天晚上2位").name, "小明");
  assert.equal(p("小明明天晚上2位").people, 2);
  assert.equal(p("今天 +3").people, 3);
  assert.equal(p("今天整場報名兩位").name, null);
});

test("意圖", () => {
  assert.equal(p("我要取消今天的報名").intent, "cancel");
  assert.equal(p("週五名單").intent, "query");
  assert.equal(p("我報名週五零打").intent, "register");
  assert.equal(p("說明").intent, "help");
  assert.equal(p("大家晚安").intent, "unknown");
});
