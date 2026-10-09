import { VENUE } from "@/lib/venue";
import { bookingApi } from "@/lib/booking";
import { taipeiNow } from "@/lib/dates";

export const dynamic = "force-dynamic";

// 健康檢查：打開 /api/health
// - ok: true 代表程式有正常運作
// - booking 顯示訂場網站的資料是否查得到
export async function GET() {
  let booking;
  try {
    const rows = await bookingApi.getDayAvailability(taipeiNow().date);
    booking = `已連線，今天共 ${rows.length} 筆場地時段`;
  } catch (e) {
    booking = e.message;
  }
  return Response.json({ ok: true, venue: VENUE.name, booking });
}
