import { VENUE } from "./venue.js";

// 向訂場網站的資料庫查詢（只讀取公開資訊：空場狀況、價格）

async function call(path, { body } = {}) {
  const res = await fetch(`${VENUE.bookingApi}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      apikey: VENUE.bookingPublicKey,
      Authorization: `Bearer ${VENUE.bookingPublicKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`訂場網站查詢失敗 ${res.status}：${await res.text()}`);
  return res.json();
}

export const bookingApi = {
  // 某一天的狀態：open 可預約／closed 休館／past 已過／unavailable 超過可預約天數
  async getDateStatus(date) {
    const [row] = await call("rpc/get_date_statuses", { body: { p_from: date, p_to: date } });
    return row ?? null;
  },

  // 某一天每個場地、每個時段的狀態
  async getDayAvailability(date) {
    return call("rpc/get_day_availability", { body: { p_date: date } });
  },

  // 價格表
  async getPricingRules() {
    return call("pricing_rules?select=day_type,start_time,end_time,price&active=eq.true&order=start_time");
  },
};
