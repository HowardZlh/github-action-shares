# Tutorial: animated stats for a GitHub profile, an organization and a repository

**English** | [中文](../zh-CN/tutorial.md) · Back to the [README](../../README.md)

This guide wires up the three setups running on [github.com/HowardZlh](https://github.com/HowardZlh), [github.com/FailRouter](https://github.com/FailRouter) and the repos linked from them. Each part stands alone, so skip to the one you need. Expect about 10 minutes per part, most of it waiting for the first workflow run.

**Contents**: [Which output goes where](#which-output-goes-where) · [Profile README](#part-1-your-profile-readme) · [Metrics token](#part-2-the-metrics-token) · [Organization profile](#part-3-an-organization-profile) · [A single repository](#part-4-a-single-repository) · [README copy that gets read](#part-5-readme-copy-that-gets-read-and-found) · [Troubleshooting](#troubleshooting)

## Which output goes where

| Where | Snake | Heatmap | 3D | Stars table | Activity | Visitors |
|:--|:--|:--|:--|:--|:--|:--|
| Profile (`login/login`) | Platane/snk | this action, `source: user` | github-profile-3d-contrib | `repos:` list | `users:login` | visitor-badge |
| Org (`org/.github`) | this action, `source: org` | same | same | `org:` | `orgs:org` | visitor-badge |
| Repo | this action, `source: repo` | same | same | — | — | visitor-badge |

Everything except the visitor counters is generated inside your own Actions run and stored in your own repo. The visitor counters are hosted services and they count image loads, not people. Treat the number as a trend.

Check that a badge service actually renders on github.com before you rely on it. README images go through GitHub's camo proxy, and camo answers `404 Cannot proxy the given URL` for some hosts that load fine in a browser (komarev.com, as of October 2026). Open the page, copy the image address, and `curl` it.

## Part 1: your profile README

GitHub shows a README on your profile when a **public** repository has exactly the same name as your login.

```sh
gh repo create YOUR_LOGIN/YOUR_LOGIN --public --description "Profile README"
```

Start `README.md` with an H1 that says who you are and what you build, in the words people search for. The profile page `<title>` is just "YOUR_LOGIN (Your Name) · GitHub", so the H1 and the first paragraph are the only places a search engine learns what you do.

```md
# Howard: open-source 3D space visualisation and Cloudflare tooling
```

Then the images. Always wrap them in `<picture>`, so dark-mode visitors get the dark version, and always write an `alt` that says what the image shows:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/YOUR_LOGIN/YOUR_LOGIN/output/snake-dark.svg">
  <img alt="Snake eating YOUR_LOGIN's GitHub contribution graph" src="https://raw.githubusercontent.com/YOUR_LOGIN/YOUR_LOGIN/output/snake.svg">
</picture>
```

The 3D calendar lives at `output/3d/profile-night-rainbow.svg` (dark) and `output/3d/profile-green-animate.svg` (light). The heatmap and skyline are at `output/art/heatmap.svg` and `output/art/skyline.svg`, each with a `-dark` twin.

Add the two blocks the action keeps up to date. Text between the markers is replaced on every run, and anything outside them is left alone:

```md
## Projects
<!-- SHOWCASE:REPOS:START -->
<!-- SHOWCASE:REPOS:END -->

## Recent activity
<!-- SHOWCASE:ACTIVITY:START -->
<!-- SHOWCASE:ACTIVITY:END -->
```

Copy [`examples/profile/.github/workflows/profile-showcase.yml`](../../examples/profile/.github/workflows/profile-showcase.yml), change the `repos:` line to your projects and push. Then start it once:

```sh
gh workflow run profile-showcase.yml --repo YOUR_LOGIN/YOUR_LOGIN
gh run watch --repo YOUR_LOGIN/YOUR_LOGIN
```

When the run is green, an `output` branch exists and the README images load. raw.githubusercontent.com caches for about five minutes, so a fresh image can lag behind the run.

## Part 2: the metrics token

The [lowlighter/metrics](https://github.com/lowlighter/metrics) languages card needs a personal access token, because the default `GITHUB_TOKEN` can only see the repository it runs in. The workflow skips the card when the secret is missing, so this part is optional.

1. Open [GitHub's new-token page](https://github.com/settings/tokens/new?scopes=read:user,read:org&description=METRICS_TOKEN). The link pre-fills a classic token with only `read:user` and `read:org`.
2. Pick an expiry (90 days is a reasonable default, and GitHub emails you before it lapses) and generate it.
3. Copy it, then store it without it ever showing up in your terminal history:

```sh
pbpaste | gh secret set METRICS_TOKEN --repo YOUR_LOGIN/YOUR_LOGIN   # macOS
# Linux: xclip -o -selection clipboard | gh secret set METRICS_TOKEN --repo YOUR_LOGIN/YOUR_LOGIN
```

The card is committed to `metrics/metrics.svg` on the default branch, so reference it with a relative path: `![Languages](metrics/metrics.svg)`.

Leave `plugin_achievements` off. In v3.34 it still queries classic Projects, which GitHub has removed, and the card renders "Unexpected error" under Achievements.

## Part 3: an organization profile

An organization's homepage README is `profile/README.md` inside a **public** repository named `.github` owned by the org.

```sh
gh repo create YOUR_ORG/.github --public --description "Organization profile"
```

Copy [`examples/org/.github/workflows/org-showcase.yml`](../../examples/org/.github/workflows/org-showcase.yml). `source: org` asks GitHub for `stats/commit_activity` on every public, non-fork, non-archived repo and adds them up. GitHub computes those statistics lazily and answers `202 Accepted` the first time. The action retries with back-off for about two minutes, so a first run on a big org is slow but succeeds.

`org:` puts every public repo into the stars table. The activity list for an org also shows `⭐ someone starred repo` and `🍴 someone forked repo`. A visitor reading that sees other people already use the project, which a profile can't show.

Private repos and private contributions never appear. Nothing in this setup reads them.

## Part 4: a single repository

The snake and 3D actions for profiles can't draw a repository, because only user accounts have a contribution calendar. This action counts commit dates from `git log` instead:

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0 # without this, git log sees one commit
- uses: HowardZlh/github-action-shares@v1
  with:
    source: repo
    git-path: .
    out-dir: dist
```

The full workflow is [`examples/repo/.github/workflows/readme-showcase.yml`](../../examples/repo/.github/workflows/readme-showcase.yml). It pushes the SVGs to an `output` branch and never commits to `main`. That matters if merging to `main` deploys your site: a nightly art refresh shouldn't run your production pipeline.

Put the art below the first screen of the README. Visitors decide in the first few seconds whether the project solves their problem. The description, a screenshot of the product and the install command belong there, and the snake doesn't. A "Project activity" section near Contributing works well, as a sign that the project is alive.

## Part 5: README copy that gets read and found

The images bring people in. Whether they star the repo depends on the words around them.

**First screen, in this order:** what it is (the H1, phrased the way someone would search for it), proof it works (live link, screenshot, one number), and one thing to do (install, deploy button, try it). Badges come after the proof, not before it.

**H1 and first paragraph.** Google shows the repo's About description and the start of the README. Put the search phrase in both: "Cloudflare usage spike alerts" beats "A small tool I wrote".

**Repo About box.** Fill in all three fields (description, website, topics) with `gh repo edit --description ... --homepage ... --add-topic ...`. Topics put the repo on topic pages such as github.com/topics/cloudflare-workers.

**Social preview.** Settings → Social preview, 1280×640 px. That's the card chat apps and X show when someone pastes your link. Without one, GitHub falls back to your avatar.

**Alt text on every image** says what the image shows, with real names: "Snake eating stellar-odyssey's commit history", not "snake". Screen readers read it, and image search indexes it.

**At most five badges.** Each one should answer a question a visitor has: does it build, what license, is it alive. "Made with love" doesn't.

**One star request, at the end,** tied to a concrete reason. A star button in the first line reads as begging. A sentence after the visitor got something useful reads as a fair ask.

**Skip the star-history chart while the count is small.** A flat line at three stars works against you. The live star badge does the same job without drawing attention to the number.

**Respect reduced motion.** The SVGs here stop animating under `prefers-reduced-motion`. If you add GIFs, keep them short and don't put more than one moving image in a single screen.

## Troubleshooting

| Symptom | Cause | Fix |
|:--|:--|:--|
| Broken images in the README | The `output` branch doesn't exist yet | Run the workflow once from the Actions tab |
| Image is a day old | raw.githubusercontent.com caches about 5 minutes; your browser may cache longer | Hard-refresh, or wait |
| `commit_activity ... still computing` | GitHub hadn't finished the stats for a repo | Re-run; the second run hits a warm cache |
| Heatmap shows only today | Checkout without `fetch-depth: 0` | Add it |
| Push to `output` fails with 403 | Workflow token is read-only | `permissions: contents: write`, and Settings → Actions → Workflow permissions → Read and write |
| Scheduled runs stopped | GitHub pauses schedules in public repos after 60 days without activity | Actions tab → the workflow → Enable |
| Metrics step says skipped | `METRICS_TOKEN` not set or expired | Part 2 |
| Activity list empty | Only public events from the last 90 days count | Expected for a quiet account |

Something else? [Open an issue](https://github.com/HowardZlh/github-action-shares/issues) with the run URL.
