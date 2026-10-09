import crypto from "node:crypto";

// 跟 LINE 溝通的小工具：驗證訊息真的來自 LINE、回覆訊息

const API = "https://api.line.me/v2/bot";

// 檢查 LINE 傳來的簽章，避免別人假冒 LINE 呼叫我們的網址
export function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let given;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

export async function replyText(replyToken, text) {
  const res = await fetch(`${API}/message/reply`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
  });
  if (!res.ok) console.error("LINE 回覆失敗", res.status, await res.text());
  else console.log("[webhook] 已回覆");
}
