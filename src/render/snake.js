import { escapeXml, fmt, svgDoc, theme } from './theme.js';

const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;
const STEP_S = 0.055; // seconds per cell
const LENGTH = 5; // snake segments

/**
 * Serpentine walk: down column 0, up column 1, down column 2 ... Every move is
 * exactly one pitch, so `animateMotion values` with linear timing gives each
 * cell the same time slot and we can schedule "eaten" colour swaps exactly.
 */
export function serpentine(grid) {
  const path = [];
  grid.weeks.forEach((week, w) => {
    // the current week is partial; pad future days so every move stays one pitch
    const full = Array.from({ length: 7 }, (_, d) => week[d] ?? { week: w, weekday: d, level: 0, count: 0, virtual: true });
    for (const c of w % 2 === 0 ? full : full.reverse()) path.push(c);
  });
  return path;
}

export function renderSnake(grid, { theme: themeName = 'light', label = 'contributions' } = {}) {
  const t = theme(themeName);
  const left = 6;
  const top = 34;
  const cols = grid.weeks.length;
  const width = left + cols * PITCH + 6;
  const height = top + 7 * PITCH + 8;

  const path = serpentine(grid);
  const point = (c) => [left + c.week * PITCH, top + c.weekday * PITCH];
  const points = path.map(point);
  // leave through the right edge (clipped by the viewBox) before the loop restarts
  const [lx, ly] = points.at(-1);
  for (let i = 1; i <= LENGTH + 6; i += 1) points.push([lx + i * PITCH, ly]);

  const steps = points.length - 1;
  const dur = +(steps * STEP_S).toFixed(3);
  const values = points.map(([x, y]) => `${x},${y}`).join(';');

  const cells = path.map((c, i) => {
    const [x, y] = point(c);
    const base = `x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"`;
    if (c.virtual) return '';
    if (c.level === 0) return `<rect ${base} fill="${t.levels[0]}"/>`;
    const at = Math.max(i / steps, 0.0001).toFixed(5);
    return `<rect ${base} fill="${t.levels[c.level]}"><animate attributeName="fill" calcMode="discrete" values="${t.levels[c.level]};${t.levels[0]}" keyTimes="0;${at}" dur="${dur}s" repeatCount="indefinite"/></rect>`;
  });

  const segments = Array.from({ length: LENGTH }, (_, k) => {
    const size = CELL - k * 1.2;
    const inset = (CELL - size) / 2;
    const begin = k === 0 ? '0s' : `-${(dur - k * STEP_S).toFixed(3)}s`;
    return `<rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${size / 2.6}" fill="${t.snake}" opacity="${(1 - k * 0.13).toFixed(2)}"><animateMotion values="${values}" dur="${dur}s" begin="${begin}" repeatCount="indefinite" calcMode="linear"/></rect>`;
  }).reverse(); // head drawn last, on top

  const headline = `${fmt(grid.total)} ${label}, eaten one square at a time`;
  return svgDoc({
    width,
    height,
    title: headline,
    desc: `Animated snake walking the ${label} grid from ${grid.start} to ${grid.end}.`,
    body: [
      `<text x="${left}" y="20" font-size="13" font-weight="600" fill="${t.text}">${escapeXml(headline)}</text>`,
      ...cells.filter(Boolean),
      ...segments,
    ].join('\n'),
  });
}
