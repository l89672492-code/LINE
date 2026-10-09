import crypto from "node:crypto";

// 跟 LINE 溝通的小工具：驗證訊息真的來自 LINE、取得使用者名稱、回覆訊息

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

// 取得 LINE 名稱（群組裡要用群組成員的 API）
export async function getDisplayName(source) {
  if (!source?.userId) return null;
  const url =
    source.type === "group"
      ? `${API}/group/${source.groupId}/member/${source.userId}`
      : source.type === "room"
        ? `${API}/room/${source.roomId}/member/${source.userId}`
        : `${API}/profile/${source.userId}`;
  try {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.displayName ?? null;
  } catch {
    return null;
  }
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
