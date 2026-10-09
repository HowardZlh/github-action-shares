import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeEvent, hasBlock, renderActivity, renderRepoTable, replaceBlock } from '../src/readme.js';

const md = 'top\n<!-- SHOWCASE:REPOS:START -->\nold\n<!-- SHOWCASE:REPOS:END -->\nbottom';

test('replaceBlock swaps only the marked region and keeps $ literal', () => {
  const out = replaceBlock(md, 'REPOS', 'costs $1 and $&');
  assert.equal(out, 'top\n<!-- SHOWCASE:REPOS:START -->\ncosts $1 and $&\n<!-- SHOWCASE:REPOS:END -->\nbottom');
  assert.equal(replaceBlock(out, 'REPOS', 'costs $1 and $&'), out); // idempotent
  assert.throws(() => replaceBlock('x', 'ACTIVITY', 'y'), /not found/);
  assert.equal(hasBlock(md, 'REPOS'), true);
  assert.equal(hasBlock(md, 'ACTIVITY'), false);
});

const repo = (name, stars, extra = {}) => ({ name, full_name: `o/${name}`, html_url: `https://github.com/o/${name}`, stargazers_count: stars, description: `desc | ${name}`, language: 'TypeScript', homepage: '', ...extra });

test('renderRepoTable sorts by stars and escapes pipes', () => {
  const out = renderRepoTable([repo('a', 1), repo('b', 5, { homepage: 'https://b.dev', language: null })]);
  const rows = out.split('\n').filter((l) => l.startsWith('| [**'));
  assert.match(rows[0], /\*\*b\*\*.*live ↗/);
  assert.match(rows[0], /\| — \|/);
  assert.match(rows[1], /desc \\\| a/);
  assert.match(out, /⭐ 6 stars across 2/);
  assert.match(out, /img\.shields\.io\/github\/stars\/o\/b\?style=social/);
});

const ev = (type, payload, extra = {}) => ({ type, payload, repo: { name: 'o/r' }, actor: { login: 'fan' }, created_at: '2026-10-09T01:02:03Z', ...extra });

test('describeEvent covers the useful event types', () => {
  assert.match(describeEvent(ev('ReleaseEvent', { action: 'published', release: { tag_name: 'v1', html_url: 'u' } })), /🚀 Released \[v1\]\(u\) in \[r\]/);
  assert.equal(describeEvent(ev('ReleaseEvent', { action: 'edited' })), null);
  assert.match(describeEvent(ev('PullRequestEvent', { action: 'closed', number: 3, pull_request: { merged: true, title: 'Fix [x]' } })), /✅ Merged \[#3 Fix x\]\(https:\/\/github.com\/o\/r\/pull\/3\)/);
  assert.match(describeEvent(ev('PullRequestEvent', { action: 'merged', number: 4 })), /✅ Merged \[#4\]/);
  assert.match(describeEvent(ev('PullRequestEvent', { action: 'opened', pull_request: { number: 5, html_url: 'p' } })), /🔀 Opened \[#5\]\(p\)/);
  assert.equal(describeEvent(ev('PullRequestEvent', { action: 'labeled', number: 6 })), null);
  assert.match(describeEvent(ev('IssuesEvent', { action: 'opened', issue: { number: 7, title: 't' } })), /🐛 Opened issue \[#7 t\]/);
  assert.match(describeEvent(ev('IssuesEvent', { action: 'closed', issue: { number: 8, html_url: 'i' } })), /☑️ Closed issue \[#8\]\(i\)/);
  assert.equal(describeEvent(ev('IssuesEvent', { action: 'reopened', issue: {} })), null);
  assert.match(describeEvent(ev('CreateEvent', { ref_type: 'repository' })), /🆕 Created \[r\]/);
  assert.match(describeEvent(ev('CreateEvent', { ref_type: 'tag', ref: 'v2' })), /🏷️ Tagged `v2`/);
  assert.equal(describeEvent(ev('CreateEvent', { ref_type: 'branch' })), null);
  assert.match(describeEvent(ev('PushEvent', { ref: 'refs/heads/main' })), /⬆️ Pushed to `main` in \[r\]\(https:\/\/github.com\/o\/r\) · <sub>2026-10-09<\/sub>/);
  assert.equal(describeEvent(ev('WatchEvent', {})), null);
  assert.match(describeEvent(ev('WatchEvent', {}), { stars: true }), /⭐ \[fan\]/);
  assert.match(describeEvent(ev('ForkEvent', {}), { stars: true }), /🍴 \[fan\]/);
  assert.equal(describeEvent(ev('ForkEvent', {})), null);
  assert.equal(describeEvent(ev('GollumEvent', {})), null);
});

test('renderActivity collapses repeats, skips repos and respects the limit', () => {
  const push = ev('PushEvent', { ref: 'refs/heads/main' });
  const events = [push, push, push, ev('CreateEvent', { ref_type: 'repository' }), ev('PushEvent', { ref: 'x' }, { repo: { name: 'o/skip' } })];
  assert.equal(renderActivity(events).split('\n').length, 3);
  assert.equal(renderActivity(events, { skipRepos: ['o/skip'] }).split('\n').length, 2);
  assert.match(renderActivity(events), /^1\. ⬆️/);
  assert.equal(renderActivity(events, { limit: 1 }).split('\n').length, 1);
  assert.equal(renderActivity([ev('PushEvent', { ref: 'x' }, { repo: { name: 'o/skip' } })], { skipRepos: ['o/skip'] }), '_Nothing public in the last 90 days._');
});
