// Contribution calendar: a GitHub-style 53 x 7 grid built from per-day counts.
// Sources (git log, REST commit_activity, GraphQL contributionCalendar) all reduce
// to a Map<'YYYY-MM-DD', number> first, so the renderers never care where data came from.

export const DAY_MS = 86_400_000;

export const isoDate = (d) => d.toISOString().slice(0, 10);

const utcMidnight = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Count ISO dates ("2026-10-09" or full timestamps) into a Map. */
export function countDates(dates) {
  const counts = new Map();
  for (const raw of dates) {
    const day = String(raw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

/** REST /repos/{o}/{r}/stats/commit_activity -> Map. `week` is a unix second at Sunday 00:00 UTC. */
export function fromCommitActivity(weeks) {
  const counts = new Map();
  for (const { week, days } of weeks ?? []) {
    days.forEach((n, i) => {
      if (n > 0) counts.set(isoDate(new Date(week * 1000 + i * DAY_MS)), n);
    });
  }
  return counts;
}

/** GraphQL user.contributionsCollection.contributionCalendar -> Map. */
export function fromContributionCalendar(calendar) {
  const counts = new Map();
  for (const week of calendar?.weeks ?? []) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > 0) counts.set(day.date, day.contributionCount);
    }
  }
  return counts;
}

/** Sum several Maps (an org = the sum of its repos). */
export function mergeCounts(...maps) {
  const out = new Map();
  for (const m of maps) for (const [k, v] of m) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

/**
 * Levels 1-4 follow GitHub's approach: quartiles of the non-zero days, so one
 * huge day doesn't flatten the rest of the year into level 1.
 */
export function assignLevels(cells) {
  const nonZero = cells.map((c) => c.count).filter((n) => n > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return;
  const q = (p) => nonZero[Math.floor(p * (nonZero.length - 1))];
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  for (const c of cells) {
    if (c.count === 0) c.level = 0;
    else if (c.count <= q1) c.level = 1;
    else if (c.count <= q2) c.level = 2;
    else if (c.count <= q3) c.level = 3;
    else c.level = 4;
  }
}

/** Longest and current (ending today or yesterday) streak of active days. */
export function streaks(cells) {
  let longest = 0;
  let run = 0;
  for (const c of cells) {
    run = c.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  let i = cells.length - 1;
  if (i >= 0 && cells[i].count === 0) i -= 1; // today may still be empty
  for (; i >= 0 && cells[i].count > 0; i -= 1) current += 1;
  return { longest, current };
}

/**
 * Build the grid ending at `today` (UTC). Column 0 starts on the Sunday 52 weeks
 * before the current week, so there are 53 columns and the last one is partial.
 */
export function buildGrid(counts, today = new Date()) {
  const end = utcMidnight(today);
  const start = new Date(end.getTime() - (52 * 7 + end.getUTCDay()) * DAY_MS);
  const weeks = [];
  const cells = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const w = Math.floor((t - start.getTime()) / DAY_MS / 7);
    const cell = { date: isoDate(d), count: counts.get(isoDate(d)) ?? 0, weekday: d.getUTCDay(), week: w, level: 0 };
    (weeks[w] ??= []).push(cell);
    cells.push(cell);
  }
  assignLevels(cells);
  const total = cells.reduce((s, c) => s + c.count, 0);
  const busiest = cells.reduce((best, c) => (c.count > best.count ? c : best), cells[0]);
  return {
    weeks,
    cells,
    start: isoDate(start),
    end: isoDate(end),
    total,
    max: busiest.count,
    busiest: busiest.count > 0 ? { date: busiest.date, count: busiest.count } : null,
    activeDays: cells.filter((c) => c.count > 0).length,
    ...streaks(cells),
  };
}
