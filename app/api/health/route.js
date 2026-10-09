import { VENUE } from "@/lib/venue";

// 健康檢查：部署後打開 /api/health，看到 ok 代表程式有正常運作
export async function GET() {
  return Response.json({ ok: true, venue: VENUE.name, time: new Date().toISOString() });
}
