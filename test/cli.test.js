import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCounts } from '../bin/showcase.mjs';

const BIN = fileURLToPath(new URL('../bin/showcase.mjs', import.meta.url));

function gitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'repo-'));
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  git('init', '-q');
  const today = new Date().toISOString().slice(0, 10);
  for (const date of [today, today, '2001-01-01']) git('commit', '-q', '--allow-empty', '-m', 'x', `--date=${date}T12:00:00Z`);
  return { dir, today };
}

test('loadCounts reads local git history inside the window', async () => {
  const { dir, today } = gitRepo();
  const counts = await loadCounts({ source: 'repo', target: 'x', git: dir });
  assert.equal(counts.get(today), 2); // --since filters by committer date; buildGrid drops the rest
});

test('loadCounts routes repo / org / user to the right API', async () => {
  const calls = [];
  const client = {
    commitActivity: async (r) => (calls.push(r), [{ week: 0, days: [1, 0, 0, 0, 0, 0, 0] }]),
    ownerRepos: async () => [{ full_name: 'o/a' }, { full_name: 'o/b' }],
    contributionCalendar: async () => ({ weeks: [{ contributionDays: [{ date: '2026-01-01', contributionCount: 2 }] }] }),
  };
  assert.deepEqual([...(await loadCounts({ source: 'repo', target: 'o/r', client }))], [['1970-01-01', 1]]);
  assert.deepEqual([...(await loadCounts({ source: 'org', target: 'o', client }))], [['1970-01-01', 2]]);
  assert.deepEqual(calls, ['o/r', 'o/a', 'o/b']);
  assert.deepEqual([...(await loadCounts({ source: 'user', target: 'u', client }))], [['2026-01-01', 2]]);
  await assert.rejects(loadCounts({ source: 'team', client }), /--source must be/);
});

test('CLI art end to end on a local repo', () => {
  const { dir } = gitRepo();
  const out = join(dir, 'dist');
  const log = execFileSync('node', [BIN, 'art', '--source', 'repo', '--target', 'o/r', '--git', dir, '--out', out], { encoding: 'utf8' });
  assert.match(log, /repo o\/r: 2 commits, 1 active days -> 7 files/);
  assert.equal(readdirSync(out).length, 7);
});

test('CLI fails loudly with a GitHub Actions error annotation', () => {
  assert.throws(() => execFileSync('node', [BIN, 'dance'], { stdio: 'pipe' }), (err) => String(err.stderr).includes('::error::first argument must be'));
  assert.throws(() => execFileSync('node', [BIN, 'art'], { stdio: 'pipe' }), (err) => String(err.stderr).includes('--target is required'));
});

test('CLI readme leaves files without markers untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'md-'));
  const file = join(dir, 'README.md');
  writeFileSync(file, '# hi\n');
  execFileSync('node', [BIN, 'readme', '--file', file], { encoding: 'utf8' });
  assert.equal(readFileSync(file, 'utf8'), '# hi\n');
  writeFileSync(file, '<!-- SHOWCASE:ACTIVITY:START -->\n<!-- SHOWCASE:ACTIVITY:END -->\n');
  assert.throws(() => execFileSync('node', [BIN, 'readme', '--file', file], { stdio: 'pipe' }), (err) => String(err.stderr).includes('--activity must look like'));
});
