import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySignature } from "../lib/line.js";

test("LINE 簽章驗證", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ events: [] });
  const good = crypto.createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifySignature(body, good, secret), true);
  assert.equal(verifySignature(body + " ", good, secret), false);
  assert.equal(verifySignature(body, good, "wrong-secret"), false);
  assert.equal(verifySignature(body, null, secret), false);
  assert.equal(verifySignature(body, "abc", secret), false);
});
