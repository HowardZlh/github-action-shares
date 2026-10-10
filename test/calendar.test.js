import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignLevels, buildGrid, countDates, fromCommitActivity, fromContributionCalendar, gridStart, mergeCounts, period, streaks } from '../src/calendar.js';

const TODAY = new Date('2026-10-09T15:00:00Z'); // a Friday

test('countDates counts days and ignores junk', () => {
  const m = countDates(['2026-10-01', '2026-10-01T10:00:00Z', '', 'nope', '2026-10-02']);
  assert.deepEqual([...m], [['2026-10-01', 2], ['2026-10-02', 1]]);
});

test('fromCommitActivity maps week + weekday index to dates', () => {
  const sunday = Date.UTC(2026, 9, 4) / 1000;
  const m = fromCommitActivity([{ week: sunday, days: [1, 0, 0, 0, 0, 3, 0] }]);
  assert.deepEqual([...m], [['2026-10-04', 1], ['2026-10-09', 3]]);
  assert.equal(fromCommitActivity(undefined).size, 0);
});

test('fromContributionCalendar keeps non-zero days', () => {
  const m = fromContributionCalendar({ weeks: [{ contributionDays: [{ date: '2026-10-01', contributionCount: 0 }, { date: '2026-10-02', contributionCount: 5 }] }] });
  assert.deepEqual([...m], [['2026-10-02', 5]]);
  assert.equal(fromContributionCalendar(null).size, 0);
});

test('mergeCounts sums overlapping days', () => {
  const m = mergeCounts(new Map([['a', 1]]), new Map([['a', 2], ['b', 1]]));
  assert.deepEqual([...m], [['a', 3], ['b', 1]]);
});

test('assignLevels uses quartiles of non-zero days', () => {
  const cells = [0, 1, 2, 3, 4, 100].map((count) => ({ count, level: -1 }));
  assignLevels(cells);
  // non-zero [1,2,3,4,100] -> q1=2 q2=3 q3=4
  assert.deepEqual(cells.map((c) => c.level), [0, 1, 1, 2, 3, 4]);
  const empty = [{ count: 0, level: 0 }];
  assignLevels(empty);
  assert.equal(empty[0].level, 0);
});

test('streaks: current streak tolerates an empty today', () => {
  const s = streaks([1, 1, 0, 1, 1, 1, 0].map((count) => ({ count })));
  assert.deepEqual(s, { longest: 3, current: 3 });
  assert.equal(streaks([1, 0].map((count) => ({ count }))).current, 1);
  assert.deepEqual(streaks([]), { longest: 0, current: 0 });
});

test('buildGrid: 53 columns, starts on a Sunday, ends today', () => {
  const g = buildGrid(new Map([['2026-10-09', 4], ['2026-10-08', 2], ['2025-01-01', 9]]), TODAY);
  assert.equal(g.weeks.length, 53);
  assert.equal(new Date(`${g.start}T00:00:00Z`).getUTCDay(), 0);
  assert.equal(g.end, '2026-10-09');
  assert.equal(g.weeks.at(-1).length, 6); // Sun..Fri
  assert.equal(g.total, 6); // 2025-01-01 is outside the window
  assert.deepEqual(g.busiest, { date: '2026-10-09', count: 4 });
  assert.equal(g.current, 2);
  assert.equal(g.activeDays, 2);
});

test('buildGrid with no data has no busiest day', () => {
  const g = buildGrid(new Map(), TODAY);
  assert.equal(g.total, 0);
  assert.equal(g.busiest, null);
});

test('window=year keeps 53 columns and says "in the last year"', () => {
  const g = buildGrid(new Map([['2026-09-28', 2]]), TODAY);
  assert.equal(g.weeks.length, 53);
  assert.equal(g.cropped, false);
  assert.equal(g.window, 'year');
  assert.equal(period(g), 'in the last year');
});

test('window=auto starts at the first active week, never narrower than minWeeks', () => {
  // young project: first commit 2026-07-28 (a Tuesday) -> grid starts Sunday 2026-07-26
  const young = buildGrid(new Map([['2026-07-28', 22], ['2026-10-09', 1]]), TODAY, { window: 'auto' });
  assert.equal(young.start, '2026-07-26');
  assert.equal(young.weeks.length, 11);
  assert.equal(young.cropped, true);
  assert.equal(young.firstActive, '2026-07-28');
  assert.equal(young.lastActive, '2026-10-09');
  assert.equal(period(young), 'since 2026-07-26');
  // two weeks of history still gets the 8-week floor
  const baby = buildGrid(new Map([['2026-09-30', 1]]), TODAY, { window: 'auto', minWeeks: 8 });
  assert.equal(baby.weeks.length, 8);
  assert.equal(baby.start, '2026-08-16');
  // activity older than a year is ignored; a full year stays uncropped
  const old = buildGrid(new Map([['2024-01-01', 9], ['2025-10-06', 1]]), TODAY, { window: 'auto' });
  assert.equal(old.weeks.length, 53);
  assert.equal(old.cropped, false);
  // empty: the floor
  assert.equal(buildGrid(new Map(), TODAY, { window: 'auto', minWeeks: 4 }).weeks.length, 4);
});

test('gridStart validates its options', () => {
  const end = new Date('2026-10-09T00:00:00Z');
  assert.throws(() => gridStart(new Map(), end, { window: 'month' }), /window must be year or auto/);
  // minWeeks is clamped to 1..53
  assert.equal(gridStart(new Map(), end, { window: 'auto', minWeeks: 0 }).toISOString().slice(0, 10), '2026-10-04');
  assert.equal(gridStart(new Map(), end, { window: 'auto', minWeeks: 99 }).toISOString().slice(0, 10), '2025-10-05');
});
