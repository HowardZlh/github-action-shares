import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderAll } from '../bin/showcase.mjs';
import { buildGrid } from '../src/calendar.js';
import { renderHeatmap } from '../src/render/heatmap.js';
import { barHeight, renderSkyline } from '../src/render/skyline.js';
import { MIN_ACTIVE_DAYS, renderCard } from '../src/render/card.js';
import { planRoute, renderSnake, stepSeconds, walk } from '../src/render/snake.js';
import { escapeXml, shade, theme } from '../src/render/theme.js';

const TODAY = new Date('2026-10-09T00:00:00Z');
const counts = new Map();
for (let i = 0; i < 300; i += 3) counts.set(new Date(TODAY - i * 86_400_000).toISOString().slice(0, 10), (i % 7) + 1);
const grid = buildGrid(counts, TODAY);

/** Well-formedness without dependencies: xmllint when present, else a tag balance check. */
function assertWellFormed(svg) {
  const dir = mkdtempSync(join(tmpdir(), 'svg-'));
  const file = join(dir, 'x.svg');
  writeFileSync(file, svg);
  try {
    execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' });
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(String(err.stderr));
    const open = (svg.match(/<[a-z][^>]*[^/]>/g) ?? []).length;
    const close = (svg.match(/<\/[a-z]+>/g) ?? []).length;
    assert.equal(open, close);
  }
}

for (const [name, render] of [
  ['heatmap', renderHeatmap],
  ['snake', renderSnake],
  ['skyline', renderSkyline],
]) {
  for (const t of ['light', 'dark']) {
    test(`${name} (${t}) is well-formed, accessible and honours reduced motion`, () => {
      const svg = render(grid, { theme: t, label: 'commits' });
      assertWellFormed(svg);
      assert.match(svg, /role="img" aria-labelledby="t d"/);
      assert.match(svg, /<title id="t">[^<]*\d/);
      assert.match(svg, /prefers-reduced-motion/);
      assert.ok(svg.includes(theme(t).levels[0]));
    });
  }
}

test('heatmap labels months and highlights today', () => {
  const svg = renderHeatmap(grid, { label: 'commits' });
  assert.match(svg, />Oct</);
  assert.match(svg, /class="c today"/);
  assert.match(svg, /1 commit on|commits on/);
});

test('walk moves one cell at a time, horizontal first', () => {
  assert.deepEqual(walk({ week: 0, weekday: 0 }, { week: 2, weekday: 1 }), [{ week: 1, weekday: 0 }, { week: 2, weekday: 0 }, { week: 2, weekday: 1 }]);
  assert.deepEqual(walk({ week: 3, weekday: 4 }, { week: 3, weekday: 4 }), []);
});

test('snake route: one-cell steps, eats every active day once, always the nearest next', () => {
  const { points, eatenAt } = planRoute(grid);
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.abs(points[i].week - points[i - 1].week) + Math.abs(points[i].weekday - points[i - 1].weekday);
    assert.equal(d, 1, `jump at ${i}`);
  }
  assert.equal(eatenAt.size, grid.activeDays);
  const order = [...eatenAt].sort((a, b) => a[1] - b[1]);
  let head = points[0];
  const left = new Set(order.map(([c]) => c));
  for (const [cell, at] of order) {
    assert.equal(points[at].week, cell.week);
    assert.equal(points[at].weekday, cell.weekday);
    const nearest = Math.min(...[...left].map((c) => Math.abs(c.week - head.week) + Math.abs(c.weekday - head.weekday)));
    assert.equal(Math.abs(cell.week - head.week) + Math.abs(cell.weekday - head.weekday), nearest);
    left.delete(cell);
    head = cell;
  }
  // starts and ends outside the grid
  assert.ok(points[0].week < 0);
  assert.ok(points.at(-1).week < 0 || points.at(-1).week >= grid.weeks.length);
});

test('sparse grid: short route, far shorter than a full sweep', () => {
  const sparse = buildGrid(new Map([['2026-09-28', 13], ['2026-09-30', 2], ['2026-10-03', 5]]), TODAY);
  const { points, eatenAt } = planRoute(sparse);
  assert.equal(eatenAt.size, 3);
  assert.ok(points.length < 90, `route has ${points.length} points`);
  const svg = renderSnake(sparse);
  assert.equal((svg.match(/attributeName="fill"/g) ?? []).length, 3);
  const dur = Number(svg.match(/dur="([\d.]+)s"/)[1]);
  assert.ok(dur >= 8 && dur <= 32, `loop ${dur}s`);
});

test('empty grid: the snake just crosses once', () => {
  const empty = buildGrid(new Map(), TODAY);
  const { points, eatenAt } = planRoute(empty);
  assert.equal(eatenAt.size, 0);
  assert.equal(points.at(-1).weekday, 3);
  assert.match(renderSnake(empty), /<animateMotion/);
});

test('stepSeconds keeps the loop between 8 and 30 seconds', () => {
  assert.equal(stepSeconds(100), 0.1);
  assert.equal(stepSeconds(40), 0.2);
  assert.equal(stepSeconds(600), 0.05);
});

test('snake svg animates every active cell and five segments', () => {
  const svg = renderSnake(grid);
  assert.equal((svg.match(/attributeName="fill"/g) ?? []).length, grid.activeDays);
  assert.equal((svg.match(/<animateMotion/g) ?? []).length, 5);
});

test('skyline bars grow and stay sub-linear', () => {
  assert.equal(barHeight(0, 10), 0);
  assert.equal(barHeight(5, 0), 0);
  assert.ok(barHeight(10, 10) > barHeight(5, 10) * 1.2);
  const svg = renderSkyline(grid);
  assert.equal((svg.match(/class="b"/g) ?? []).length, grid.activeDays);
  assert.match(svg, /Busiest day/);
  // a 1-day "longest streak" reads as a weakness: left out below 3 days
  assert.doesNotMatch(renderSkyline(buildGrid(new Map([['2026-10-09', 1]]), TODAY)), /Longest streak/);
  assert.match(renderSkyline(buildGrid(new Map([['2026-10-07', 1], ['2026-10-08', 1], ['2026-10-09', 1]]), TODAY)), /Longest streak 3 days</);
  assert.match(renderSkyline(buildGrid(new Map(), TODAY)), /No activity yet/);
  // cropped: a sparse grid whose only bar is at the front is shorter than one with a tall bar at the back
  const front = renderSkyline(buildGrid(new Map([['2026-10-09', 9]]), TODAY));
  const back = renderSkyline(buildGrid(new Map([['2025-10-05', 9]]), TODAY));
  const h = (svg) => Number(svg.match(/height="(\d+)"/)[1]);
  assert.ok(h(back) > h(front) + 30, `${h(back)} vs ${h(front)}`);
});

test('theme helpers', () => {
  assert.throws(() => theme('pink'), /unknown theme/);
  assert.equal(shade('#808080', 0.5), '#404040');
  assert.equal(shade('#ffffff', 2), '#ffffff');
  assert.equal(escapeXml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
});

test('renderAll writes eight SVGs and stats.json; activity is the snake once there is enough data', () => {
  const out = mkdtempSync(join(tmpdir(), 'art-'));
  renderAll(grid, { out, label: 'commits' });
  assert.deepEqual(readdirSync(out).sort(), [
    'activity-dark.svg', 'activity.svg', 'heatmap-dark.svg', 'heatmap.svg', 'skyline-dark.svg', 'skyline.svg', 'snake-dark.svg', 'snake.svg', 'stats.json',
  ]);
  assert.equal(readFileSync(join(out, 'activity.svg'), 'utf8'), readFileSync(join(out, 'snake.svg'), 'utf8'));
  const stats = JSON.parse(readFileSync(join(out, 'stats.json'), 'utf8'));
  assert.equal(stats.total, grid.total);
  assert.equal(stats.weeks, undefined);
  assert.equal(stats.lastActive, '2026-10-09');

  const young = buildGrid(new Map([['2026-09-28', 20], ['2026-10-09', 1]]), TODAY, { window: 'auto' });
  const out2 = mkdtempSync(join(tmpdir(), 'art-'));
  renderAll(young, { out: out2, label: 'commits' });
  assert.match(readFileSync(join(out2, 'activity.svg'), 'utf8'), /21 commits since 2026-08-16/);
  assert.doesNotMatch(readFileSync(join(out2, 'activity.svg'), 'utf8'), /animateMotion/);
  renderAll(young, { out: out2, label: 'commits', minDays: 2 });
  assert.match(readFileSync(join(out2, 'activity.svg'), 'utf8'), /animateMotion/);
});

test('card: headline, last active day, pulse only while fresh', () => {
  assert.equal(MIN_ACTIVE_DAYS, 10);
  const fresh = renderCard(buildGrid(new Map([['2026-10-08', 1]]), TODAY, { window: 'auto' }), { label: 'commits' });
  assertWellFormed(fresh);
  assert.match(fresh, />1 commit since 2026-08-16</);
  assert.match(fresh, />1 active day · last commit 2026-10-08</);
  assert.match(fresh, /class="p"/);
  const stale = renderCard(buildGrid(new Map([['2026-01-05', 4]]), TODAY), { theme: 'dark', label: 'commits' });
  assert.match(stale, />4 commits in the last year</);
  assert.doesNotMatch(stale, /class="p"/);
  const none = renderCard(buildGrid(new Map(), TODAY, { window: 'auto' }));
  assert.match(none, />No commits since 2026-08-16</);
  assert.match(none, />Nothing to show yet</);
});

test('narrow auto grids grow the canvas to fit their own text, and the snake still leaves it', () => {
  const young = buildGrid(new Map([['2026-09-28', 20], ['2026-09-29', 3], ['2026-10-09', 1]]), TODAY, { window: 'auto' });
  assert.equal(young.weeks.length, 8);
  const w = (svg) => Number(svg.match(/width="(\d+)"/)[1]);
  const snake = renderSnake(young, { label: 'commits' });
  assert.match(snake, />24 commits since 2026-08-16</);
  assert.ok(w(snake) >= 6 + Math.ceil('24 commits since 2026-08-16'.length * 13 * 0.6));
  const { points } = planRoute(young, { visibleCols: Math.ceil((w(snake) - 6) / 14) });
  assert.ok(points.at(-1).week < 0 || (points.at(-1).week - 5) * 14 + 6 > w(snake), 'snake rests off canvas');
  assert.match(renderHeatmap(young, { label: 'commits' }), />24 commits since 2026-08-16</);
  assert.ok(w(renderHeatmap(young)) >= 182);
  const sky = renderSkyline(young);
  assertWellFormed(sky);
  // the stats block starts below every floor tile it shares columns with
  const firstStatY = Number(sky.match(/<text x="12" y="(\d+)" font-size="11" fill="[^"]+">Busiest/)[1]);
  const tileYs = [...sky.matchAll(/<polygon points="([\d.]+),([\d.]+) /g)].filter((m) => Number(m[1]) < 200).map((m) => Number(m[2]));
  assert.ok(firstStatY > Math.max(...tileYs), `${firstStatY} vs ${Math.max(...tileYs)}`);
});
