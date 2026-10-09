// Rewrites marked blocks in a README:
//   <!-- SHOWCASE:REPOS:START --> ... <!-- SHOWCASE:REPOS:END -->
//   <!-- SHOWCASE:ACTIVITY:START --> ... <!-- SHOWCASE:ACTIVITY:END -->
// Output carries no timestamps, so the file only changes when the data does.

export function replaceBlock(markdown, name, content) {
  const re = new RegExp(`(<!--\\s*SHOWCASE:${name}:START\\s*-->)[\\s\\S]*?(<!--\\s*SHOWCASE:${name}:END\\s*-->)`);
  if (!re.test(markdown)) throw new Error(`markers SHOWCASE:${name}:START / END not found`);
  return markdown.replace(re, (_, open, close) => `${open}\n${content}\n${close}`);
}

export const hasBlock = (markdown, name) => markdown.includes(`SHOWCASE:${name}:START`);

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const linkText = (s) => String(s).replace(/[[\]]/g, '');

/** Repos sorted by stars, with a live "Star" badge as the call to action. */
export function renderRepoTable(repos) {
  const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count || a.name.localeCompare(b.name));
  const total = sorted.reduce((s, r) => s + r.stargazers_count, 0);
  const rows = sorted.map((r) => {
    const name = `[**${linkText(r.name)}**](${r.html_url})`;
    const home = r.homepage ? ` · [live ↗](${r.homepage})` : '';
    const badge = `[![Stars of ${r.full_name}](https://img.shields.io/github/stars/${r.full_name}?style=social)](${r.html_url}/stargazers)`;
    return `| ${name}${home} | ${cell(r.description)} | ${cell(r.language ?? '—')} | ${badge} |`;
  });
  return [
    `<sub>⭐ ${total} stars across ${sorted.length} open-source projects</sub>`,
    '',
    '| Project | What it does | Stack | Stars |',
    '|:--|:--|:--|:--|',
    ...rows,
  ].join('\n');
}

const repoLink = (full) => `[${full.split('/')[1]}](https://github.com/${full})`;

/** One event -> one line, or null when it's noise. */
export function describeEvent(e, { stars = false } = {}) {
  const repo = e.repo?.name;
  const p = e.payload ?? {};
  const day = e.created_at?.slice(0, 10);
  const at = (s) => `${s} · <sub>${day}</sub>`;
  switch (e.type) {
    case 'ReleaseEvent':
      return p.action === 'published' ? at(`🚀 Released [${linkText(p.release?.tag_name)}](${p.release?.html_url}) in ${repoLink(repo)}`) : null;
    case 'PullRequestEvent': {
      const n = p.number ?? p.pull_request?.number;
      const url = p.pull_request?.html_url ?? `https://github.com/${repo}/pull/${n}`;
      const title = p.pull_request?.title ? ` ${linkText(p.pull_request.title)}` : '';
      const merged = p.action === 'merged' || (p.action === 'closed' && p.pull_request?.merged);
      if (merged) return at(`✅ Merged [#${n}${title}](${url}) in ${repoLink(repo)}`);
      if (p.action === 'opened') return at(`🔀 Opened [#${n}${title}](${url}) in ${repoLink(repo)}`);
      return null;
    }
    case 'IssuesEvent': {
      const i = p.issue ?? {};
      const url = i.html_url ?? `https://github.com/${repo}/issues/${i.number}`;
      const title = i.title ? ` ${linkText(i.title)}` : '';
      if (p.action === 'opened') return at(`🐛 Opened issue [#${i.number}${title}](${url}) in ${repoLink(repo)}`);
      if (p.action === 'closed') return at(`☑️ Closed issue [#${i.number}${title}](${url}) in ${repoLink(repo)}`);
      return null;
    }
    case 'CreateEvent':
      if (p.ref_type === 'repository') return at(`🆕 Created ${repoLink(repo)}`);
      if (p.ref_type === 'tag') return at(`🏷️ Tagged \`${p.ref}\` in ${repoLink(repo)}`);
      return null;
    case 'PushEvent': {
      const branch = String(p.ref ?? '').replace('refs/heads/', '');
      return at(`⬆️ Pushed to \`${branch}\` in ${repoLink(repo)}`);
    }
    case 'WatchEvent':
      return stars ? at(`⭐ [${e.actor.login}](https://github.com/${e.actor.login}) starred ${repoLink(repo)}`) : null;
    case 'ForkEvent':
      return stars ? at(`🍴 [${e.actor.login}](https://github.com/${e.actor.login}) forked ${repoLink(repo)}`) : null;
    default:
      return null;
  }
}

/** Newest first; consecutive identical lines (e.g. ten pushes on one day) collapse. */
export function renderActivity(events, { limit = 8, stars = false, skipRepos = [] } = {}) {
  const lines = [];
  for (const e of events) {
    if (skipRepos.includes(e.repo?.name)) continue;
    const line = describeEvent(e, { stars });
    if (!line || lines.at(-1) === line) continue;
    lines.push(line);
    if (lines.length >= limit) break;
  }
  if (lines.length === 0) return '_Nothing public in the last 90 days._';
  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}
