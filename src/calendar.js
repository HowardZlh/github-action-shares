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

export const WINDOWS = ['year', 'auto'];

/**
 * First column of the grid. `year`: the Sunday 52 weeks before the current week
 * (53 columns, GitHub's layout). `auto`: the Sunday of the first active day in
 * that year, but never fewer than `minWeeks` columns, so a two-month-old project
 * isn't drawn as a year of empty squares.
 */
export function gridStart(counts, end, { window = 'year', minWeeks = 8 } = {}) {
  if (!WINDOWS.includes(window)) throw new Error(`window must be ${WINDOWS.join(' or ')} (got "${window}")`);
  const weeks = Math.max(1, Math.min(53, Math.floor(Number(minWeeks)) || 1));
  const thisSunday = end.getTime() - end.getUTCDay() * DAY_MS;
  const yearStart = thisSunday - 52 * 7 * DAY_MS;
  if (window === 'year') return new Date(yearStart);
  const floor = thisSunday - (weeks - 1) * 7 * DAY_MS;
  const first = [...counts.keys()].filter((d) => counts.get(d) > 0 && d >= isoDate(new Date(yearStart)) && d <= isoDate(end)).sort()[0];
  if (!first) return new Date(floor);
  const f = new Date(`${first}T00:00:00Z`);
  const firstSunday = f.getTime() - f.getUTCDay() * DAY_MS;
  return new Date(Math.max(yearStart, Math.min(firstSunday, floor)));
}

/**
 * Build the grid ending at `today` (UTC); see `gridStart` for where it begins.
 * The last column is partial.
 */
export function buildGrid(counts, today = new Date(), { window = 'year', minWeeks = 8 } = {}) {
  const end = utcMidnight(today);
  const start = gridStart(counts, end, { window, minWeeks });
  const cropped = end.getTime() - start.getTime() < (52 * 7 + end.getUTCDay()) * DAY_MS;
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
  const active = cells.filter((c) => c.count > 0);
  return {
    weeks,
    cells,
    start: isoDate(start),
    end: isoDate(end),
    window,
    cropped,
    firstActive: active[0]?.date ?? null,
    lastActive: active.at(-1)?.date ?? null,
    total,
    max: busiest.count,
    busiest: busiest.count > 0 ? { date: busiest.date, count: busiest.count } : null,
    activeDays: active.length,
    ...streaks(cells),
  };
}

/** "in the last year" for a full grid, "since 2026-07-26" for a cropped one. */
export const period = (grid) => (grid.cropped ? `since ${grid.start}` : 'in the last year');

/** A one-day "longest streak" reads as a weakness, not a fact worth showing. */
export const MIN_STREAK_TO_SHOW = 3;
