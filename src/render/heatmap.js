import { escapeXml, fmt, svgDoc, theme } from './theme.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL = 11;
const GAP = 3;
const PITCH = CELL + GAP;

/**
 * Heatmap: cells pop in column by column (left to right, ~1.5 s), then today's
 * cell keeps a slow pulse so the eye lands on "still active".
 */
export function renderHeatmap(grid, { theme: themeName = 'light', label = 'contributions' } = {}) {
  const t = theme(themeName);
  const left = 34;
  const top = 58;
  const width = left + grid.weeks.length * PITCH + 12;
  const height = top + 7 * PITCH + 34;

  const months = [];
  grid.weeks.forEach((week, w) => {
    const first = week[0];
    const day = Number(first.date.slice(8, 10));
    if (day <= 7 && w < grid.weeks.length - 1) {
      months.push(`<text x="${left + w * PITCH}" y="${top - 8}" font-size="10" fill="${t.muted}">${MONTHS[Number(first.date.slice(5, 7)) - 1]}</text>`);
    }
  });

  const weekdays = [
    [1, 'Mon'],
    [3, 'Wed'],
    [5, 'Fri'],
  ].map(([d, name]) => `<text x="0" y="${top + d * PITCH + 9}" font-size="10" fill="${t.muted}">${name}</text>`);

  const cells = grid.cells.map((c) => {
    const isToday = c.date === grid.end;
    const cls = isToday ? 'c today' : 'c';
    const unit = c.count === 1 ? label.replace(/s$/, '') : label;
    return `<rect class="${cls}" x="${left + c.week * PITCH}" y="${top + c.weekday * PITCH}" width="${CELL}" height="${CELL}" rx="2" fill="${t.levels[c.level]}" style="animation-delay:${c.week * 28}ms"><title>${c.count} ${escapeXml(unit)} on ${c.date}</title></rect>`;
  });

  const legendX = width - 12 - 5 * PITCH - 60;
  const legendY = top + 7 * PITCH + 14;
  const legend = [
    `<text x="${legendX}" y="${legendY + 9}" font-size="10" fill="${t.muted}">Less</text>`,
    ...t.levels.map((color, i) => `<rect x="${legendX + 28 + i * PITCH}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"/>`),
    `<text x="${legendX + 32 + 5 * PITCH}" y="${legendY + 9}" font-size="10" fill="${t.muted}">More</text>`,
  ];

  const headline = `${fmt(grid.total)} ${label} in the last year`;
  const sub = [
    `${fmt(grid.activeDays)} active days`,
    `longest streak ${grid.longest}d`,
    grid.current > 0 ? `current streak ${grid.current}d` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return svgDoc({
    width,
    height,
    title: headline,
    desc: `Contribution heatmap from ${grid.start} to ${grid.end}. ${sub}.`,
    style:
      '.c{transform-box:fill-box;transform-origin:center;animation:pop .45s cubic-bezier(.3,1.4,.6,1) both}' +
      '.today{animation:pop .45s cubic-bezier(.3,1.4,.6,1) both,pulse 2.4s ease-in-out 2s infinite}' +
      '@keyframes pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}' +
      '@keyframes pulse{50%{opacity:.45}}',
    body: [
      `<text x="0" y="18" font-size="15" font-weight="600" fill="${t.text}">${escapeXml(headline)}</text>`,
      `<text x="0" y="36" font-size="11" fill="${t.muted}">${escapeXml(sub)}</text>`,
      ...months,
      ...weekdays,
      ...cells,
      ...legend,
    ].join('\n'),
  });
}
