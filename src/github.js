// Minimal GitHub REST / GraphQL client on top of global fetch (Node >= 20).

const API = 'https://api.github.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createClient({ token = '', fetchImpl = globalThis.fetch, wait = sleep } = {}) {
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'github-action-shares',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };

  async function request(path, init = {}) {
    const res = await fetchImpl(path.startsWith('http') ? path : `${API}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (res.status >= 400) throw new Error(`GitHub ${res.status} on ${path}: ${body?.message ?? text}`);
    return { status: res.status, body };
  }

  return {
    request,

    async repo(fullName) {
      return (await request(`/repos/${fullName}`)).body;
    },

    async ownerRepos(owner, kind = 'users') {
      const { body } = await request(`/${kind}/${owner}/repos?type=public&per_page=100&sort=pushed`);
      return body.filter((r) => !r.private && !r.fork && !r.archived);
    },

    /** Stats are computed lazily: GitHub answers 202 until the cache is warm. */
    async commitActivity(fullName, { attempts = 8 } = {}) {
      for (let i = 1; i <= attempts; i += 1) {
        const { status, body } = await request(`/repos/${fullName}/stats/commit_activity`);
        if (status === 200) return body ?? [];
        if (status === 204) return [];
        await wait(3000 * i);
      }
      throw new Error(`commit_activity for ${fullName} still computing after ${attempts} tries`);
    },

    async contributionCalendar(login) {
      if (!token) throw new Error('a token is required for the GraphQL contribution calendar');
      const query = 'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}';
      const { body } = await request('/graphql', { method: 'POST', body: JSON.stringify({ query, variables: { login } }) });
      if (body.errors) throw new Error(`GraphQL: ${body.errors.map((e) => e.message).join('; ')}`);
      return body.data.user.contributionsCollection.contributionCalendar;
    },

    async events(name, kind = 'users') {
      const path = kind === 'orgs' ? `/orgs/${name}/events?per_page=100` : `/users/${name}/events/public?per_page=100`;
      return (await request(path)).body ?? [];
    },
  };
}
