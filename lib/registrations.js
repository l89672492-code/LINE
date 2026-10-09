// 報名、取消、查詢名單：LINE 機器人和管理後台共用這裡的邏輯
// repo 是資料庫操作（正式環境用 lib/repo.js 的 Supabase 版本，測試時用假的）

export function normalizeName(name) {
  return (name ?? "").replace(/\s+/g, " ").trim();
}

export function sameName(a, b) {
  return normalizeName(a).toLowerCase() === normalizeName(b).toLowerCase();
}

// 某一天某一場的總人數
export async function countPeople(repo, date, sessionId) {
  const regs = await repo.listActiveRegistrations(date);
  return regs.filter((r) => r.session_id === sessionId).reduce((sum, r) => sum + r.people, 0);
}

// 報名：同一天、同一場、同一個名字已經報過就不會再算一次
// 回傳 { status: "created" | "duplicate", registration, total }
export async function registerPlayer(repo, { date, sessionId, name, people = 1, lineUserId = null, source = "line" }) {
  const cleanName = normalizeName(name);
  if (!cleanName) throw new Error("缺少姓名");
  if (!Number.isInteger(people) || people < 1 || people > 20) throw new Error("人數需介於 1～20");

  const existing = (await repo.listActiveRegistrations(date)).find(
    (r) => r.session_id === sessionId && sameName(r.name, cleanName)
  );
  if (existing) {
    return { status: "duplicate", registration: existing, total: await countPeople(repo, date, sessionId) };
  }

  const result = await repo.insertRegistration({
    play_date: date,
    session_id: sessionId,
    name: cleanName,
    people,
    line_user_id: lineUserId,
    source,
  });
  // 兩個人同時送出時，由資料庫的唯一限制擋下第二筆
  if (result.duplicate) {
    const again = (await repo.listActiveRegistrations(date)).find(
      (r) => r.session_id === sessionId && sameName(r.name, cleanName)
    );
    return { status: "duplicate", registration: again, total: await countPeople(repo, date, sessionId) };
  }
  return { status: "created", registration: result.registration, total: await countPeople(repo, date, sessionId) };
}

// 取消：回傳 { registration, total }，找不到或已取消則 registration 為 null
export async function cancelRegistration(repo, id) {
  const registration = await repo.cancelRegistration(id);
  if (!registration) return { registration: null, total: null };
  return { registration, total: await countPeople(repo, registration.play_date, registration.session_id) };
}

// 找出某人某天的有效報名
export async function findPlayerRegistrations(repo, date, name) {
  return (await repo.listActiveRegistrations(date)).filter((r) => sameName(r.name, name));
}

// 某一天的完整名單，依場次分組
// 回傳 [{ session, registrations, total }]，包含當天沒人報名的場次
export async function getDaySummary(repo, date, weekday) {
  const [sessions, regs] = await Promise.all([repo.listSessions(weekday), repo.listActiveRegistrations(date)]);
  const map = new Map(sessions.map((s) => [s.id, { session: s, registrations: [], total: 0 }]));

  for (const r of regs) {
    if (!map.has(r.session_id)) {
      // 場次後來被停用，但當天仍有人報名，照樣列出
      const [s] = await repo.getSessionsByIds([r.session_id]);
      if (s) map.set(s.id, { session: s, registrations: [], total: 0 });
    }
    const group = map.get(r.session_id);
    if (!group) continue;
    group.registrations.push(r);
    group.total += r.people;
  }

  return [...map.values()].sort((a, b) => a.session.sort_order - b.session.sort_order);
}
