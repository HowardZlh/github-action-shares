// Palettes match GitHub's own contribution graph so the SVGs sit naturally in a README.

export const THEMES = {
  light: {
    text: '#1f2328',
    muted: '#59636e',
    levels: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    snake: '#8250df',
  },
  dark: {
    text: '#e6edf3',
    muted: '#9198a1',
    levels: ['#21262d', '#0e4429', '#006d32', '#26a641', '#39d353'],
    snake: '#bc8cff',
  },
};

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";

export function theme(name) {
  const t = THEMES[name];
  if (!t) throw new Error(`unknown theme "${name}", expected one of ${Object.keys(THEMES).join(', ')}`);
  return t;
}

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/** Multiply each RGB channel; used for the shaded sides of the 3D bars. */
export function shade(hex, factor) {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

export const fmt = (n) => Number(n).toLocaleString('en-US');

/** Root <svg> with an accessible name; reduced-motion users get a static image. */
export function svgDoc({ width, height, title, desc, style = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
<title id="t">${escapeXml(title)}</title>
<desc id="d">${escapeXml(desc)}</desc>
<style>text{font-family:${FONT}}${style}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
${body}
</svg>
`;
}
