import { VENUE } from "./venue.js";
import { addDays, formatDate, weekdayOf } from "./dates.js";
import { getDaySummary } from "./registrations.js";
import { findFullSession, hhmm, inPeriod } from "./sessions.js";

// 整週名單：報名、取消、查名單時，機器人都回這份（今天起 7 天）

export const ROSTER_DAYS = 7;

const PERIODS = [
  { key: "morning", label: "早場", showHours: true },
  { key: "afternoon", label: "午場", showHours: true },
  { key: "evening", label: "晚場", showHours: false },
];

// 09:00 → 9、18:30 → 18:30
function shortTime(t) {
  const [h, m] = hhmm(t).split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
}

// 18:30 → 1830
function compactTime(t) {
  return hhmm(t).replace(":", "");
}

// 名單從哪一天開始：一般從今天；查詢或報名超過 7 天後的日期，就從那天開始
export function rosterStart(today, date) {
  return date && date > addDays(today, ROSTER_DAYS - 1) ? date : today;
}

function formatPeriod(period, groups) {
  const sessions = groups.map((g) => g.session);
  const full = findFullSession(sessions);
  const label = period.showHours
    ? `${period.label}(${shortTime(full?.start_time ?? sessions[0].start_time)}-${shortTime(full?.end_time ?? sessions[0].end_time)})`
    : period.label;

  // 同一個早／午／晚場有好幾個時段時，非整場的人在名字後面標時間，例如：文傑(2030-2230)
  const entries = groups
    .flatMap(({ session, registrations }) =>
      registrations.map((r) => ({
        id: r.id,
        text:
          r.name +
          (r.people > 1 ? `x${r.people}` : "") +
          (sessions.length > 1 && session !== full
            ? `(${compactTime(session.start_time)}-${compactTime(session.end_time)})`
            : ""),
      }))
    )
    .sort((a, b) => a.id - b.id)
    .map((e) => e.text);

  const notes = groups
    .filter(({ session, total }) => session.min_people && total < session.min_people)
    .map(({ session, total }) => `（${session.min_people} 人開團，還差 ${session.min_people - total} 人）`);

  return `${label}：${entries.length ? entries.join("，") : "（尚無）"}${notes[0] ?? ""}`;
}

export function formatRoster(days) {
  const blocks = days
    .filter(({ summary }) => summary.length > 0)
    .map(({ date, summary }) => {
      const lines = PERIODS.map((period) => {
        const groups = summary.filter(({ session }) => inPeriod(session, period.key));
        return groups.length ? formatPeriod(period, groups) : null;
      }).filter(Boolean);
      return `${formatDate(date)}\n${lines.join("\n")}`;
    });

  return [VENUE.rosterTitle, VENUE.rosterHours, "", blocks.join("\n\n"), "", ...VENUE.rosterFooter].join("\n");
}

export async function buildRoster(repo, startDate) {
  const dates = Array.from({ length: ROSTER_DAYS }, (_, i) => addDays(startDate, i));
  const summaries = await Promise.all(dates.map((d) => getDaySummary(repo, d, weekdayOf(d))));
  return formatRoster(dates.map((date, i) => ({ date, summary: summaries[i] })));
}
