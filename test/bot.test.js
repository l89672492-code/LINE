import { test } from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../lib/bot.js";
import { createFakeRepo } from "./fakeRepo.js";

// 2026-10-09 是星期五，台灣時間下午 3 點
const NOW = new Date("2026-10-09T07:00:00Z");

function chat(repo, userId = "U1", displayName = "小明") {
  return async (text) => (await handleMessage(repo, { text, userId, displayName, now: NOW })).reply;
}

test("「我今天晚上要打球」→ 週五晚上有三個時段，先詢問", async () => {
  const repo = createFakeRepo();
  const say = chat(repo);
  const reply = await say("我今天晚上要打球");
  assert.match(reply, /請問要報名哪一個/);
  assert.match(reply, /1\. 18:30–22:30/);
  assert.equal(repo.registrations.length, 0);

  const reply2 = await say("2");
  assert.match(reply2, /報名成功/);
  assert.match(reply2, /18:30–20:30/);
  assert.match(reply2, /小明 × 1 位/);
});

test("「我報名週五零打」→ 沒寫時段，報名整場", async () => {
  const repo = createFakeRepo();
  const reply = await chat(repo)("我報名週五零打");
  assert.match(reply, /報名成功/);
  assert.match(reply, /18:30–22:30/);
});

test("「阿哲報名一位」→ 沒有日期，先詢問日期", async () => {
  const repo = createFakeRepo();
  const say = chat(repo);
  assert.match(await say("阿哲報名一位"), /請問要報名哪一天/);
  const reply = await say("下週一");
  assert.match(reply, /報名成功/);
  assert.match(reply, /10\/12（一）/);
  assert.match(reply, /阿哲 × 1 位/);
});

test("同一個人重複報名不會重複計算", async () => {
  const repo = createFakeRepo();
  const say = chat(repo);
  await say("我報名週五零打");
  const reply = await say("我報名今天全場");
  assert.match(reply, /已經報名過/);
  assert.match(reply, /共 1 人/);
  assert.equal(repo.registrations.length, 1);
});

test("人數會自動加總", async () => {
  const repo = createFakeRepo();
  await chat(repo, "U1", "小明")("我報名週五零打");
  const reply = await chat(repo, "U2", "阿華")("阿華今天整場兩位");
  assert.match(reply, /共 3 人/);
});

test("「我要取消今天的報名」→ 取消並更新人數", async () => {
  const repo = createFakeRepo();
  await chat(repo, "U2", "阿華")("今天整場報名兩位");
  const say = chat(repo);
  await say("我報名週五零打");
  const reply = await say("我要取消今天的報名");
  assert.match(reply, /已取消報名/);
  assert.match(reply, /剩 2 人/);
});

test("取消時報了兩個時段，要先問取消哪一個", async () => {
  const repo = createFakeRepo();
  const say = chat(repo);
  await say("我報名今天 18:30-20:30");
  await say("我報名今天 20:30-22:30");
  assert.match(await say("我要取消今天的報名"), /請問要取消哪一個/);
  const reply = await say("2");
  assert.match(reply, /已取消報名/);
  assert.match(reply, /20:30–22:30/);
});

test("查不到報名時告知", async () => {
  const reply = await chat(createFakeRepo())("取消阿哲週五的報名");
  assert.match(reply, /查不到 阿哲/);
});

test("星期六沒有零打", async () => {
  const reply = await chat(createFakeRepo())("我明天要打球");
  assert.match(reply, /星期六沒有零打/);
});

test("週三沒寫時段 → 沒有整場可選，要詢問", async () => {
  const reply = await chat(createFakeRepo())("我報名週三");
  assert.match(reply, /請問要報名哪一個/);
  assert.match(reply, /09:00–12:00/);
});

test("週三早上 → 只有一個早上時段，直接報名，並顯示開團人數", async () => {
  const reply = await chat(createFakeRepo())("我報名週三早上");
  assert.match(reply, /報名成功/);
  assert.match(reply, /09:00–12:00/);
  assert.match(reply, /還差 4 人/);
});

test("沒有 LINE 名稱又沒寫名字時，詢問名字", async () => {
  const repo = createFakeRepo();
  const say = chat(repo, "U3", null);
  assert.match(await say("我報名週五零打"), /請問報名者的名字/);
  assert.match(await say("阿哲"), /阿哲 × 1 位/);
});

test("一次報好幾個名字 → 詢問名字", async () => {
  const reply = await chat(createFakeRepo())("我和阿哲週五報名");
  assert.match(reply, /請問報名者的名字/);
});

test("查詢名單", async () => {
  const repo = createFakeRepo();
  await chat(repo, "U1", "小明")("我報名週五零打");
  await chat(repo, "U2", "阿華")("阿華今天 20:30-22:30 兩位");
  const reply = await chat(repo, "U9", "老闆")("今天名單");
  assert.match(reply, /10\/9（五） 零打名單/);
  assert.match(reply, /18:30–22:30 初中～高階 \$380｜共 1 人/);
  assert.match(reply, /阿華 × 2/);
});

test("已經過去的日期不能報名", async () => {
  const reply = await chat(createFakeRepo())("我報名 10/5");
  assert.match(reply, /已經過了/);
});

test("跟報名無關的訊息不回覆", async () => {
  assert.equal(await chat(createFakeRepo())("大家好"), null);
});

test("詢問中輸入「算了」可以放棄", async () => {
  const repo = createFakeRepo();
  const say = chat(repo);
  await say("我今天晚上要打球");
  assert.match(await say("算了"), /已經取消/);
  assert.equal(await say("1"), null);
});
