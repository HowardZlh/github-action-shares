import { period } from '../calendar.js';
import { escapeXml, fmt, svgDoc, textWidth, theme } from './theme.js';

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const LENGTH = 5; // snake segments
const BASE_STEP_S = 0.1; // seconds per cell
const MIN_LOOP_S = 8; // sparse grids shouldn't flash by
const MAX_LOOP_S = 30; // dense grids shouldn't drag on
const PAUSE_S = 1.5; // offscreen rest before the next loop

const dist = (a, b) => Math.abs(a.week - b.week) + Math.abs(a.weekday - b.weekday);

/** One-cell steps from `from` to `to`: horizontal first, then vertical. Excludes `from`. */
export function walk(from, to) {
  const steps = [];
  let { week, weekday } = from;
  while (week !== to.week) {
    week += Math.sign(to.week - week);
    steps.push({ week, weekday });
  }
  while (weekday !== to.weekday) {
    weekday += Math.sign(to.weekday - weekday);
    steps.push({ week, weekday });
  }
  return steps;
}

/**
 * Greedy nearest-target route, like Platane/snk on a profile: enter from the
 * top-left, always head for the closest uneaten square (ties: leftmost, then
 * topmost), leave through the nearer side. Every step moves exactly one cell,
 * so a step index is also a time slot.
 * `visibleCols` is how many columns the canvas shows (wider than the grid when a
 * narrow grid's headline needs the room), so the snake leaves the picture.
 * Returns { points, eatenAt: Map<cell, stepIndex> }.
 */
export function planRoute(grid, { visibleCols = grid.weeks.length } = {}) {
  const cols = grid.weeks.length;
  const offRight = Math.max(cols, visibleCols) + LENGTH + 1;
  const targets = grid.cells.filter((c) => c.count > 0);
  const start = { week: -2, weekday: 0 };
  const points = [start];
  const eatenAt = new Map();
  let head = start;

  if (targets.length === 0) {
    // nothing to eat: cross the middle row once
    points.push(...walk(head, { week: -2, weekday: 3 }), ...walk({ week: -2, weekday: 3 }, { week: offRight, weekday: 3 }));
    return { points, eatenAt };
  }

  const left = new Set(targets);
  while (left.size > 0) {
    let best = null;
    for (const c of left) {
      const d = dist(head, c);
      if (!best || d < best.d || (d === best.d && (c.week < best.c.week || (c.week === best.c.week && c.weekday < best.c.weekday)))) best = { c, d };
    }
    points.push(...walk(head, best.c));
    eatenAt.set(best.c, points.length - 1);
    left.delete(best.c);
    head = best.c;
  }

  const exit = head.week < cols / 2 ? { week: -LENGTH - 2, weekday: head.weekday } : { week: offRight, weekday: head.weekday };
  points.push(...walk(head, exit));
  return { points, eatenAt };
}

/** Seconds per step, so the moving part of the loop lands inside [MIN, MAX]. */
export function stepSeconds(moves) {
  const s = moves * BASE_STEP_S;
  if (s < MIN_LOOP_S) return MIN_LOOP_S / moves;
  if (s > MAX_LOOP_S) return MAX_LOOP_S / moves;
  return BASE_STEP_S;
}

export function renderSnake(grid, { theme: themeName = 'light', label = 'contributions' } = {}) {
  const t = theme(themeName);
  const left = 6;
  const top = 34;
  const cols = grid.weeks.length;
  const headline = grid.cropped ? `${fmt(grid.total)} ${label} ${period(grid)}` : `${fmt(grid.total)} ${label}, eaten one square at a time`;
  const width = Math.max(left + cols * PITCH + 6, left + textWidth(headline, 13) + 6);
  const height = top + 7 * PITCH + 8;

  const route = planRoute(grid, { visibleCols: Math.ceil((width - left) / PITCH) });
  const moves = route.points.length - 1;
  const stepS = stepSeconds(moves);
  // rest offscreen: repeat the exit point so the tail follows the head out
  const pause = Math.max(LENGTH + 1, Math.ceil(PAUSE_S / stepS));
  const points = [...route.points, ...Array(pause).fill(route.points.at(-1))];
  const steps = points.length - 1;
  const dur = +(steps * stepS).toFixed(3);
  const xy = (p) => [left + p.week * PITCH, top + p.weekday * PITCH];
  const values = points.map((p) => xy(p).join(',')).join(';');

  const cells = grid.cells.map((c) => {
    const [x, y] = xy(c);
    const base = `x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"`;
    const at = route.eatenAt.get(c);
    if (at === undefined) return `<rect ${base} fill="${t.levels[c.level]}"/>`;
    return `<rect ${base} fill="${t.levels[c.level]}"><animate attributeName="fill" calcMode="discrete" values="${t.levels[c.level]};${t.levels[0]}" keyTimes="0;${(at / steps).toFixed(5)}" dur="${dur}s" repeatCount="indefinite"/></rect>`;
  });

  const segments = Array.from({ length: LENGTH }, (_, k) => {
    const size = CELL - k * 1.2;
    const inset = (CELL - size) / 2;
    // segment k trails the head by k steps: start it k steps from the loop end
    const begin = k === 0 ? '0s' : `-${(dur - k * stepS).toFixed(3)}s`;
    return `<rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${size / 2.6}" fill="${t.snake}" opacity="${(1 - k * 0.13).toFixed(2)}"><animateMotion values="${values}" dur="${dur}s" begin="${begin}" repeatCount="indefinite" calcMode="linear"/></rect>`;
  }).reverse(); // head drawn last, on top

  return svgDoc({
    width,
    height,
    title: headline,
    desc: `Animated snake heading for the nearest active day on the ${label} grid from ${grid.start} to ${grid.end}.`,
    body: [`<text x="${left}" y="20" font-size="13" font-weight="600" fill="${t.text}">${escapeXml(headline)}</text>`, ...cells, ...segments].join('\n'),
  });
}
