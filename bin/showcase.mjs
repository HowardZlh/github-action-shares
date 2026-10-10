#!/usr/bin/env node
// Usage:
//   showcase.mjs art    --source repo|org|user --target <owner/repo|org|user> [--git <dir>] [--out dist] [--label commits]
//                       [--window year|auto] [--min-weeks 8] [--min-days 10]
//   showcase.mjs readme --file README.md [--repos a/b,c/d] [--org <org>] [--activity users:<login>|orgs:<org>] [--limit 8]
// Token: GITHUB_TOKEN or GH_TOKEN.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildGrid, countDates, fromCommitActivity, fromContributionCalendar, mergeCounts } from '../src/calendar.js';
import { createClient } from '../src/github.js';
import { hasBlock, renderActivity, renderRepoTable, replaceBlock } from '../src/readme.js';
import { MIN_ACTIVE_DAYS, renderCard } from '../src/render/card.js';
import { renderHeatmap } from '../src/render/heatmap.js';
import { renderSkyline } from '../src/render/skyline.js';
import { renderSnake } from '../src/render/snake.js';

const list = (s) => (s ? s.split(/[\s,]+/).filter(Boolean) : []);

export async function loadCounts({ source, target, git, client }) {
  if (source === 'repo' && git) {
    const since = new Date(Date.now() - 380 * 86_400_000).toISOString().slice(0, 10);
    const out = execFileSync('git', ['-C', git, 'log', `--since=${since}`, '--format=%as'], { encoding: 'utf8' });
    return countDates(out.split('\n'));
  }
  if (source === 'repo') return fromCommitActivity(await client.commitActivity(target));
  if (source === 'org') {
    // `.github` holds the org profile and bot commits, not project work
    const repos = (await client.ownerRepos(target, 'orgs')).filter((r) => r.name !== '.github');
    const maps = [];
    const failed = [];
    for (const r of repos) {
      try {
        maps.push(fromCommitActivity(await client.commitActivity(r.full_name)));
      } catch (err) {
        // one repo whose stats are still warming up shouldn't blank the whole chart
        failed.push(r.full_name);
        console.warn(`::warning::skipped ${r.full_name}: ${err.message}`);
      }
    }
    if (repos.length > 0 && maps.length === 0) throw new Error(`no commit stats for any repo in ${target} (${failed.join(', ')})`);
    return mergeCounts(...maps);
  }
  if (source === 'user') return fromContributionCalendar(await client.contributionCalendar(target));
  throw new Error(`--source must be repo, org or user (got "${source}")`);
}

/**
 * Writes heatmap / snake / skyline, plus `activity`: the snake once the grid has
 * `minDays` active days, a two-line text card before that. A README that points
 * at activity.svg never shows a near-empty grid and never needs editing.
 */
export function renderAll(grid, { out, label, minDays = MIN_ACTIVE_DAYS }) {
  mkdirSync(out, { recursive: true });
  const files = [];
  for (const [name, render] of [
    ['heatmap', renderHeatmap],
    ['snake', renderSnake],
    ['skyline', renderSkyline],
    ['activity', grid.activeDays >= minDays ? renderSnake : renderCard],
  ]) {
    for (const theme of ['light', 'dark']) {
      const file = join(out, theme === 'light' ? `${name}.svg` : `${name}-dark.svg`);
      writeFileSync(file, render(grid, { theme, label }));
      files.push(file);
    }
  }
  const { weeks, cells, ...stats } = grid;
  writeFileSync(join(out, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);
  files.push(join(out, 'stats.json'));
  return files;
}

async function art(opts, client) {
  if (!opts.target) throw new Error('--target is required');
  const counts = await loadCounts({ ...opts, client });
  const label = opts.label || (opts.source === 'user' ? 'contributions' : 'commits');
  const minDays = Number(opts['min-days']);
  if (!Number.isInteger(minDays) || minDays < 0) throw new Error(`--min-days must be a whole number (got "${opts['min-days']}")`);
  const grid = buildGrid(counts, new Date(), { window: opts.window, minWeeks: Number(opts['min-weeks']) });
  const files = renderAll(grid, { out: opts.out, label, minDays });
  const shown = grid.activeDays >= minDays ? 'snake' : 'card';
  console.log(`${opts.source} ${opts.target}: ${grid.total} ${label}, ${grid.activeDays} active days, ${grid.weeks.length} weeks from ${grid.start}, activity=${shown} -> ${files.length} files in ${opts.out}/`);
}

async function readme(opts, client) {
  let md = readFileSync(opts.file, 'utf8');
  if (hasBlock(md, 'REPOS')) {
    const repos = opts.org ? await client.ownerRepos(opts.org, 'orgs') : [];
    for (const full of list(opts.repos)) repos.push(await client.repo(full));
    md = replaceBlock(md, 'REPOS', renderRepoTable(repos, { skip: list(opts['skip-repos']) }));
  }
  if (hasBlock(md, 'ACTIVITY')) {
    const [kind, name] = String(opts.activity).split(':');
    if (!name) throw new Error('--activity must look like users:<login> or orgs:<org>');
    const events = await client.withPullTitles(await client.events(name, kind));
    md = replaceBlock(md, 'ACTIVITY', renderActivity(events, { limit: Number(opts.limit), stars: kind === 'orgs', skipRepos: list(opts['skip-repos']) }));
  }
  writeFileSync(opts.file, md);
  console.log(`updated ${opts.file}`);
}

async function main(argv) {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest,
    options: {
      source: { type: 'string', default: 'repo' },
      target: { type: 'string', default: '' },
      git: { type: 'string', default: '' },
      out: { type: 'string', default: 'dist' },
      label: { type: 'string', default: '' },
      file: { type: 'string', default: 'README.md' },
      repos: { type: 'string', default: '' },
      org: { type: 'string', default: '' },
      activity: { type: 'string', default: '' },
      limit: { type: 'string', default: '8' },
      'skip-repos': { type: 'string', default: '' },
      window: { type: 'string', default: 'year' },
      'min-weeks': { type: 'string', default: '8' },
      'min-days': { type: 'string', default: String(MIN_ACTIVE_DAYS) },
    },
  });
  const client = createClient({ token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '' });
  if (command === 'art') return art(values, client);
  if (command === 'readme') return readme(values, client);
  throw new Error('first argument must be "art" or "readme"');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
