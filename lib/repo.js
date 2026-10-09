import { getSupabase } from "./supabase.js";

// 正式環境的資料庫操作（Supabase）
// 測試用的假資料庫在 test/fakeRepo.js，兩邊提供一樣的功能

function check(error) {
  if (error) throw new Error(`資料庫錯誤：${error.message}`);
}

export const supabaseRepo = {
  // 某個星期幾開放的場次；weekday 不給則回傳全部
  async listSessions(weekday) {
    let q = getSupabase().from("sessions").select("*").eq("active", true).order("sort_order");
    if (weekday != null) q = q.eq("weekday", weekday);
    const { data, error } = await q;
    check(error);
    return data;
  },

  async getSessionsByIds(ids) {
    const { data, error } = await getSupabase().from("sessions").select("*").in("id", ids);
    check(error);
    return data;
  },

  // 某一天所有「已報名」的紀錄（依報名時間排序）
  async listActiveRegistrations(date) {
    const { data, error } = await getSupabase()
      .from("registrations")
      .select("*")
      .eq("play_date", date)
      .eq("status", "registered")
      .order("created_at");
    check(error);
    return data;
  },

  async insertRegistration(row) {
    const { data, error } = await getSupabase().from("registrations").insert(row).select().single();
    if (error?.code === "23505") return { duplicate: true };
    check(error);
    return { registration: data };
  },

  async cancelRegistration(id) {
    const now = new Date().toISOString();
    const { data, error } = await getSupabase()
      .from("registrations")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("id", id)
      .eq("status", "registered")
      .select()
      .maybeSingle();
    check(error);
    return data;
  },

  // 機器人詢問中的對話
  async getPending(lineUserId) {
    const { data, error } = await getSupabase()
      .from("conversation_state")
      .select("pending, updated_at")
      .eq("line_user_id", lineUserId)
      .maybeSingle();
    check(error);
    return data ? { ...data.pending, updatedAt: data.updated_at } : null;
  },

  async setPending(lineUserId, pending) {
    const { error } = await getSupabase()
      .from("conversation_state")
      .upsert({ line_user_id: lineUserId, pending, updated_at: new Date().toISOString() });
    check(error);
  },

  async clearPending(lineUserId) {
    const { error } = await getSupabase().from("conversation_state").delete().eq("line_user_id", lineUserId);
    check(error);
  },
};
