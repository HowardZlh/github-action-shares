import { escapeXml, fmt, shade, svgDoc, theme } from './theme.js';

const A = 7.2; // half width of a tile on screen
const B = 4.2; // half height of a tile on screen
const FILL = 0.84; // tile size inside its slot, leaves a gap
const MAX_H = 46;

/** Bar height: sub-linear so one heavy day doesn't dwarf the year. */
export function barHeight(count, max) {
  if (count <= 0 || max <= 0) return 0;
  return 3 + (MAX_H - 3) * (count / max) ** 0.6;
}

/**
 * Isometric 3D skyline: weeks run down-right, weekdays down-left. Bars grow
 * from the floor one week after another, then stay put.
 */
export function renderSkyline(grid, { theme: themeName = 'light', label = 'contributions' } = {}) {
  const t = theme(themeName);
  const ox = 8 * A + 12;
  const oy = MAX_H + 64;
  const cols = grid.weeks.length;
  const width = Math.ceil(ox + cols * A + 16);
  const height = Math.ceil(oy + (cols + 7) * B + 12);
  const a = A * FILL;
  const b = B * FILL;

  const sorted = [...grid.cells].sort((p, q) => p.week + p.weekday - (q.week + q.weekday) || p.week - q.week);
  const bars = sorted.map((c) => {
    const x = +(ox + (c.week - c.weekday) * A).toFixed(2);
    const y = +(oy + (c.week + c.weekday) * B).toFixed(2);
    const h = +barHeight(c.count, grid.max).toFixed(2);
    const top = t.levels[c.level];
    const poly = (pts) => pts.map(([px, py]) => `${+px.toFixed(2)},${+py.toFixed(2)}`).join(' ');
    const lid = `<polygon points="${poly([[x, y - h], [x + a, y + b - h], [x, y + 2 * b - h], [x - a, y + b - h]])}" fill="${top}"/>`;
    if (h === 0) return lid;
    const leftFace = `<polygon points="${poly([[x - a, y + b - h], [x, y + 2 * b - h], [x, y + 2 * b], [x - a, y + b]])}" fill="${shade(top, 0.78)}"/>`;
    const rightFace = `<polygon points="${poly([[x, y + 2 * b - h], [x + a, y + b - h], [x + a, y + b], [x, y + 2 * b]])}" fill="${shade(top, 0.6)}"/>`;
    return `<g class="b" style="animation-delay:${c.week * 32}ms"><title>${c.count} on ${c.date}</title>${leftFace}${rightFace}${lid}</g>`;
  });

  const headline = `${fmt(grid.total)} ${label} · 3D`;
  const lines = [
    grid.busiest ? `Busiest day ${grid.busiest.date} (${fmt(grid.busiest.count)})` : 'No activity yet',
    `Longest streak ${grid.longest} days`,
    `Active on ${fmt(grid.activeDays)} of ${fmt(grid.cells.length)} days`,
  ];
  const statsY = height - 12 - (lines.length - 1) * 16;

  return svgDoc({
    width,
    height,
    title: headline,
    desc: `Isometric 3D chart of ${label} per day from ${grid.start} to ${grid.end}.`,
    style:
      '.b{transform-box:fill-box;transform-origin:50% 100%;animation:grow .7s cubic-bezier(.2,.9,.3,1.15) both}' +
      '@keyframes grow{from{transform:scaleY(0);opacity:.2}to{transform:scaleY(1);opacity:1}}',
    body: [
      `<text x="12" y="22" font-size="15" font-weight="600" fill="${t.text}">${escapeXml(headline)}</text>`,
      `<text x="12" y="40" font-size="11" fill="${t.muted}">${escapeXml(`${grid.start} → ${grid.end}`)}</text>`,
      ...bars,
      ...lines.map((l, i) => `<text x="12" y="${statsY + i * 16}" font-size="11" fill="${t.muted}">${escapeXml(l)}</text>`),
    ].join('\n'),
  });
}
