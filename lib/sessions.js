// 依照使用者說的時段，從當天的場次中挑出正確的一場
// 回傳 { session } 代表確定；回傳 { options } 代表要請使用者選

function toMinutes(t) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function hhmm(t) {
  return t.slice(0, 5);
}

export function sessionLabel(s) {
  return `${hhmm(s.start_time)}–${hhmm(s.end_time)}`;
}

// 涵蓋當天其他所有時段的那一場（例如週一 18:30–22:30），沒有則 null
export function findFullSession(sessions) {
  if (sessions.length === 0) return null;
  if (sessions.length === 1) return sessions[0];
  return (
    sessions.find((s) =>
      sessions.every(
        (o) =>
          toMinutes(s.start_time) <= toMinutes(o.start_time) &&
          toMinutes(s.end_time) >= toMinutes(o.end_time)
      )
    ) ?? null
  );
}

function inPeriod(s, period) {
  const start = toMinutes(s.start_time);
  if (period === "morning") return start < 12 * 60;
  if (period === "afternoon") return start >= 12 * 60 && start < 17 * 60;
  return start >= 17 * 60; // evening
}

// time：parser 的時段結果（可能是 null）
// defaultFull：沒說時段時，是否直接選整場（報名 = true；取消 = false）
export function resolveSession(sessions, time, { defaultFull = true } = {}) {
  const sorted = [...sessions].sort((a, b) => a.sort_order - b.sort_order);
  // noMatch：使用者說的時段當天不存在（例如週一早上）
  const pick = (list) =>
    list.length === 1
      ? { session: list[0] }
      : list.length > 1
        ? { options: list }
        : { options: sorted, noMatch: true };

  if (sorted.length === 0) return { options: [] };

  if (!time) {
    if (sorted.length === 1) return { session: sorted[0] };
    const full = defaultFull ? findFullSession(sorted) : null;
    return full ? { session: full } : { options: sorted };
  }

  const full = findFullSession(sorted);
  const halves = sorted.filter((s) => s !== full);

  switch (time.kind) {
    case "range":
      return pick(sorted.filter((s) => hhmm(s.start_time) === time.start && hhmm(s.end_time) === time.end));
    case "start":
      return pick(sorted.filter((s) => hhmm(s.start_time) === time.start));
    case "full":
      return full ? { session: full } : { options: sorted };
    case "first":
    case "second": {
      if (!full || halves.length === 0) return { options: sorted };
      const byStart = [...halves].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
      return { session: time.kind === "first" ? byStart[0] : byStart[byStart.length - 1] };
    }
    case "period":
      return pick(sorted.filter((s) => inPeriod(s, time.period)));
    default:
      return { options: sorted };
  }
}
