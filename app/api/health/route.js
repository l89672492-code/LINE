import { VENUE } from "@/lib/venue";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// 健康檢查：打開 /api/health
// - ok: true 代表程式有正常運作
// - database 顯示資料庫是否連得上、目前有幾個場次
export async function GET() {
  let database;
  try {
    const { count, error } = await getSupabase()
      .from("sessions")
      .select("*", { count: "exact", head: true });
    database = error ? `連線失敗：${error.message}` : `已連線，共 ${count} 個場次`;
  } catch (e) {
    database = e.message;
  }

  return Response.json({ ok: true, venue: VENUE.name, database });
}
