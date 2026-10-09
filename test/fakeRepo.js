// 測試用的假資料庫：功能和 lib/repo.js 一樣，但資料放在記憶體裡

const SESSIONS = [
  ["週一 18:30-22:30", 1, "18:30", "22:30", "中高階", 380, null, 11],
  ["週一 18:30-20:30", 1, "18:30", "20:30", "中高階", 280, null, 12],
  ["週一 20:30-22:30", 1, "20:30", "22:30", "中高階", 280, null, 13],
  ["週三 09:00-12:00", 3, "09:00", "12:00", "新手友善", 250, 5, 31],
  ["週三 14:00-17:00", 3, "14:00", "17:00", "新手友善", 250, 5, 32],
  ["週三 18:30-22:30", 3, "18:30", "22:30", "新手友善", 300, null, 33],
  ["週五 18:30-22:30", 5, "18:30", "22:30", "初中～高階", 380, null, 51],
  ["週五 18:30-20:30", 5, "18:30", "20:30", "初中～高階", 280, null, 52],
  ["週五 20:30-22:30", 5, "20:30", "22:30", "初中～高階", 280, null, 53],
  ["週日 09:00-12:00", 0, "09:00", "12:00", "新手友善", 250, null, 71],
  ["週日 15:00-18:00", 0, "15:00", "18:00", "中高階", 300, null, 72],
].map(([name, weekday, start, end, level, price, min_people, sort_order], i) => ({
  id: i + 1,
  name,
  weekday,
  start_time: `${start}:00`,
  end_time: `${end}:00`,
  level,
  price,
  min_people,
  note: null,
  active: true,
  sort_order,
}));

export function createFakeRepo() {
  const registrations = [];
  const pending = new Map();
  let nextId = 1;

  return {
    registrations,
    async listSessions(weekday) {
      return SESSIONS.filter((s) => s.active && (weekday == null || s.weekday === weekday));
    },
    async getSessionsByIds(ids) {
      return SESSIONS.filter((s) => ids.includes(s.id));
    },
    async listActiveRegistrations(date) {
      return registrations.filter((r) => r.play_date === date && r.status === "registered");
    },
    async insertRegistration(row) {
      const dup = registrations.find(
        (r) =>
          r.status === "registered" &&
          r.play_date === row.play_date &&
          r.session_id === row.session_id &&
          r.name.trim().toLowerCase() === row.name.trim().toLowerCase()
      );
      if (dup) return { duplicate: true };
      const reg = { id: nextId++, status: "registered", created_at: new Date().toISOString(), ...row };
      registrations.push(reg);
      return { registration: reg };
    },
    async cancelRegistration(id) {
      const reg = registrations.find((r) => r.id === id && r.status === "registered");
      if (!reg) return null;
      reg.status = "cancelled";
      return reg;
    },
    async getPending(userId) {
      return pending.get(userId) ?? null;
    },
    async setPending(userId, p) {
      pending.set(userId, { ...structuredClone(p), updatedAt: new Date().toISOString() });
    },
    async clearPending(userId) {
      pending.delete(userId);
    },
  };
}
