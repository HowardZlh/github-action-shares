import { period } from '../calendar.js';
import { escapeXml, fmt, svgDoc, textWidth, theme } from './theme.js';

/** Below this many active days a grid is mostly empty squares; show a sentence instead. */
export const MIN_ACTIVE_DAYS = 10;

/**
 * Two-line summary for a project too young for a chart:
 *   35 commits since 2026-09-21
 *   4 active days · last commit 2026-10-09
 * A square pulses next to the headline while the last commit is under a week old.
 */
export function renderCard(grid, { theme: themeName = 'light', label = 'commits' } = {}) {
  const t = theme(themeName);
  const one = label.replace(/s$/, '');
  const headline = grid.total > 0 ? `${fmt(grid.total)} ${grid.total === 1 ? one : label} ${period(grid)}` : `No ${label} ${period(grid)}`;
  const sub = grid.lastActive
    ? `${fmt(grid.activeDays)} active ${grid.activeDays === 1 ? 'day' : 'days'} · last ${one} ${grid.lastActive}`
    : 'Nothing to show yet';
  const fresh = grid.lastActive && (Date.parse(grid.end) - Date.parse(grid.lastActive)) / 86_400_000 < 7;
  const x = 24;
  const width = x + Math.max(textWidth(headline, 15), textWidth(sub, 11)) + 12;
  return svgDoc({
    width,
    height: 52,
    title: headline,
    desc: `${sub}. Period ${grid.start} to ${grid.end}.`,
    style: '.p{animation:pulse 2.4s ease-in-out infinite}@keyframes pulse{50%{opacity:.35}}',
    body: [
      `<rect${fresh ? ' class="p"' : ''} x="2" y="9" width="12" height="12" rx="3" fill="${t.levels[grid.lastActive ? 3 : 0]}"/>`,
      `<text x="${x}" y="20" font-size="15" font-weight="600" fill="${t.text}">${escapeXml(headline)}</text>`,
      `<text x="${x}" y="40" font-size="11" fill="${t.muted}">${escapeXml(sub)}</text>`,
    ].join('\n'),
  });
}
