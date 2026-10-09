import { VENUE } from "@/lib/venue";

export default function HomePage() {
  return (
    <main className="container">
      <h1>🏸 {VENUE.name}</h1>
      <p className="subtitle">LINE 零打報名機器人</p>

      <section className="card">
        <p>📍 地址：{VENUE.address}</p>
        <p>💬 官方 LINE：{VENUE.lineId}</p>
      </section>

      <section className="card">
        <h2>目前進度</h2>
        <ul>
          <li>✅ 第一步：建立專案</li>
          <li>⬜ 第二步：建立 Supabase 資料庫</li>
          <li>⬜ 第三步：報名及取消功能</li>
          <li>⬜ 第四步：管理後台</li>
          <li>⬜ 第五步：串接 LINE</li>
          <li>⬜ 第六步：部署到 Vercel</li>
        </ul>
      </section>
    </main>
  );
}
