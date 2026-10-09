import { VENUE } from "@/lib/venue";

export default function HomePage() {
  return (
    <main className="container">
      <h1>🏸 {VENUE.name}</h1>
      <p className="subtitle">LINE 租場地機器人</p>

      <section className="card">
        <p>📍 地址：{VENUE.address}</p>
        <p>☎️ 電話：{VENUE.phone}</p>
        <p>💬 官方 LINE：{VENUE.lineId}</p>
        <p>
          👉 線上預約：<a href={`${VENUE.bookingSite}/booking`}>{VENUE.bookingSite}/booking</a>
        </p>
      </section>
    </main>
  );
}
