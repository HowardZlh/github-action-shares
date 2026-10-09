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
  assert.match(renderSkyline(buildGrid(new Map([['2026-10-09', 1]]), TODAY)), /Longest streak 1 day</);
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

test('renderAll writes six SVGs and stats.json', () => {
  const out = mkdtempSync(join(tmpdir(), 'art-'));
  renderAll(grid, { out, label: 'commits' });
  assert.deepEqual(readdirSync(out).sort(), ['heatmap-dark.svg', 'heatmap.svg', 'skyline-dark.svg', 'skyline.svg', 'snake-dark.svg', 'snake.svg', 'stats.json']);
  const stats = JSON.parse(readFileSync(join(out, 'stats.json'), 'utf8'));
  assert.equal(stats.total, grid.total);
  assert.equal(stats.weeks, undefined);
});
