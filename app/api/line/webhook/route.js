import { handleMessage, HELP_TEXT } from "@/lib/bot";
import { getDisplayName, replyText, verifySignature } from "@/lib/line";
import { supabaseRepo } from "@/lib/repo";
import { VENUE } from "@/lib/venue";

export const dynamic = "force-dynamic";

// LINE 收到訊息後，會把訊息送到這個網址：/api/line/webhook
export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature, process.env.LINE_CHANNEL_SECRET)) {
    return new Response("簽章錯誤", { status: 401 });
  }

  const { events = [] } = JSON.parse(rawBody);
  await Promise.all(events.map(handleEvent));

  // 一律回 200，讓 LINE 知道我們收到了
  return Response.json({ ok: true });
}

async function handleEvent(event) {
  try {
    // 有人加官方帳號好友 → 傳送使用說明
    if (event.type === "follow") {
      await replyText(event.replyToken, `歡迎加入 ${VENUE.name}！\n\n${HELP_TEXT}`);
      return;
    }

    if (event.type !== "message" || event.message.type !== "text") return;

    const displayName = await getDisplayName(event.source);
    const { reply } = await handleMessage(supabaseRepo, {
      text: event.message.text,
      userId: event.source.userId ?? null,
      displayName,
    });
    if (reply) await replyText(event.replyToken, reply);
  } catch (error) {
    console.error("處理 LINE 訊息失敗", error);
    if (event.replyToken) {
      await replyText(event.replyToken, "抱歉，系統暫時有點問題，請稍後再試一次 🙏").catch(() => {});
    }
  }
}

// 用瀏覽器打開這個網址時顯示，方便確認有部署成功
export async function GET() {
  return Response.json({ ok: true, message: "LINE webhook 已就緒，請在 LINE Developers 設定此網址" });
}
