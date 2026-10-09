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
import { renderSnake, serpentine } from '../src/render/snake.js';
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

test('snake walks every slot exactly once, one pitch per move', () => {
  const path = serpentine(grid);
  assert.equal(path.length, grid.weeks.length * 7);
  for (let i = 1; i < path.length; i += 1) {
    const d = Math.abs(path[i].week - path[i - 1].week) + Math.abs(path[i].weekday - path[i - 1].weekday);
    assert.equal(d, 1, `jump at ${i}`);
  }
  const svg = renderSnake(grid);
  const eaten = (svg.match(/attributeName="fill"/g) ?? []).length;
  assert.equal(eaten, grid.activeDays);
  assert.equal((svg.match(/<animateMotion/g) ?? []).length, 5);
});

test('skyline bars grow and stay sub-linear', () => {
  assert.equal(barHeight(0, 10), 0);
  assert.equal(barHeight(5, 0), 0);
  assert.ok(barHeight(10, 10) > barHeight(5, 10) * 1.2);
  const svg = renderSkyline(grid);
  assert.equal((svg.match(/class="b"/g) ?? []).length, grid.activeDays);
  assert.match(svg, /Busiest day/);
  assert.match(renderSkyline(buildGrid(new Map(), TODAY)), /No activity yet/);
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
