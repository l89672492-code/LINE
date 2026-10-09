import { createClient } from "@supabase/supabase-js";

let client = null;

// 取得資料庫連線（只在伺服器端使用，金鑰不會傳到使用者的瀏覽器）
export function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("尚未設定 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
