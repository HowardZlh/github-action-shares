import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '../src/github.js';

/** Fake fetch: a queue of [status, body] answers; records each call. */
function fake(answers) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const [status, body] = answers.shift();
    return { status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
  };
  return { calls, fetchImpl };
}

test('requests carry the token and API version', async () => {
  const f = fake([[200, { full_name: 'o/r' }]]);
  const c = createClient({ token: 'tkn', fetchImpl: f.fetchImpl });
  assert.equal((await c.repo('o/r')).full_name, 'o/r');
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/o/r');
  assert.equal(f.calls[0].init.headers.authorization, 'Bearer tkn');
  assert.equal(f.calls[0].init.headers['x-github-api-version'], '2022-11-28');
});

test('no token -> no authorization header; 4xx throws with message', async () => {
  const f = fake([[404, { message: 'Not Found' }]]);
  const c = createClient({ fetchImpl: f.fetchImpl });
  await assert.rejects(c.repo('o/x'), /GitHub 404 on \/repos\/o\/x: Not Found/);
  assert.equal(f.calls[0].init.headers.authorization, undefined);
});

test('commitActivity retries 202 and handles 204', async () => {
  const waits = [];
  const f = fake([[202, {}], [202, {}], [200, [{ week: 1, days: [0, 0, 0, 0, 0, 0, 1] }]], [204, undefined]]);
  const c = createClient({ fetchImpl: f.fetchImpl, wait: async (ms) => waits.push(ms) });
  assert.equal((await c.commitActivity('o/r')).length, 1);
  assert.deepEqual(waits, [3000, 6000]);
  assert.deepEqual(await c.commitActivity('o/empty'), []);
  const g = fake([[202, {}], [202, {}]]);
  const c2 = createClient({ fetchImpl: g.fetchImpl, wait: async () => {} });
  await assert.rejects(c2.commitActivity('o/r', { attempts: 2 }), /still computing/);
});

test('ownerRepos filters forks, archived and private', async () => {
  const f = fake([[200, [{ name: 'a' }, { name: 'b', fork: true }, { name: 'c', archived: true }, { name: 'd', private: true }]]]);
  const c = createClient({ fetchImpl: f.fetchImpl });
  assert.deepEqual((await c.ownerRepos('org', 'orgs')).map((r) => r.name), ['a']);
  assert.match(f.calls[0].url, /\/orgs\/org\/repos\?type=public/);
});

test('contributionCalendar needs a token and surfaces GraphQL errors', async () => {
  await assert.rejects(createClient({ fetchImpl: async () => {} }).contributionCalendar('u'), /token is required/);
  const cal = { totalContributions: 1, weeks: [] };
  const f = fake([[200, { data: { user: { contributionsCollection: { contributionCalendar: cal } } } }], [200, { errors: [{ message: 'nope' }] }]]);
  const c = createClient({ token: 't', fetchImpl: f.fetchImpl });
  assert.deepEqual(await c.contributionCalendar('u'), cal);
  assert.equal(f.calls[0].init.method, 'POST');
  assert.equal(JSON.parse(f.calls[0].init.body).variables.login, 'u');
  await assert.rejects(c.contributionCalendar('u'), /GraphQL: nope/);
});

test('withPullTitles fills missing PR titles within a budget and tolerates 404', async () => {
  const f = fake([[200, { title: 'Add hall', html_url: 'https://x/9' }], [404, { message: 'Not Found' }]]);
  const c = createClient({ fetchImpl: f.fetchImpl });
  const events = [
    { type: 'PullRequestEvent', repo: { name: 'o/r' }, payload: { action: 'merged', number: 9 } },
    { type: 'PullRequestEvent', repo: { name: 'o/r' }, payload: { action: 'opened', pull_request: { number: 8 } } },
    { type: 'PullRequestEvent', repo: { name: 'o/r' }, payload: { action: 'opened', pull_request: { number: 7, title: 'has one' } } },
    { type: 'PullRequestEvent', repo: { name: 'o/r' }, payload: { action: 'opened', number: 6 } },
    { type: 'PushEvent', repo: { name: 'o/r' }, payload: {} },
  ];
  await c.withPullTitles(events, { max: 2 });
  assert.equal(events[0].payload.pull_request.title, 'Add hall');
  assert.equal(events[1].payload.pull_request.title, undefined); // 404 kept bare
  assert.equal(events[3].payload.pull_request, undefined); // over budget
  assert.deepEqual(f.calls.map((x) => x.url), ['https://api.github.com/repos/o/r/pulls/9', 'https://api.github.com/repos/o/r/pulls/8']);
});

test('events picks the user or org endpoint', async () => {
  const f = fake([[200, [{ id: 1 }]], [200, null]]);
  const c = createClient({ fetchImpl: f.fetchImpl });
  assert.equal((await c.events('u')).length, 1);
  assert.deepEqual(await c.events('o', 'orgs'), []);
  assert.match(f.calls[0].url, /\/users\/u\/events\/public/);
  assert.match(f.calls[1].url, /\/orgs\/o\/events/);
});
