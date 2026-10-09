# Animated GitHub README stats for any user, organization or repository

**English** | [中文](./README.zh-CN.md)

A GitHub Action that draws a contribution heatmap, a snake that eats it, and a 3D skyline, as animated SVGs, for **a single repository or a whole organization** as well as for a user account. It also keeps a star-sorted project table and a recent-activity list in your README up to date. No dependencies, MIT.

[![CI](https://github.com/HowardZlh/github-action-shares/actions/workflows/ci.yml/badge.svg)](https://github.com/HowardZlh/github-action-shares/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Star HowardZlh/github-action-shares on GitHub](https://img.shields.io/badge/Star-on_GitHub-white?style=social&logo=github)](https://github.com/HowardZlh/github-action-shares)
[![Visitors](https://visitor-badge.laobi.icu/badge?page_id=HowardZlh.github-action-shares&left_text=visitors)](https://github.com/HowardZlh/github-action-shares)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/snake-dark.svg">
  <img alt="Animated snake eating this repository's daily commit grid, one square at a time" src="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/snake.svg">
</picture>

That snake is eating this repo's own commits. It's regenerated every night by [`showcase.yml`](.github/workflows/showcase.yml).

**Jump to**: [What you get](#what-you-get) · [Quick start](#quick-start-for-a-repository) · [Profile](#for-your-profile-readme) · [Organization](#for-an-organization-profile) · [Inputs](#inputs) · [Tutorial](docs/en/tutorial.md) · [How it works](#how-it-works)

## What you get

Every SVG comes in a light and a dark version, so it matches whichever GitHub theme the visitor uses.

| Output | Repo | Org | User | Made by |
|:--|:-:|:-:|:-:|:--|
| Heatmap that fills in week by week | ✅ | ✅ | ✅ | this action |
| Snake heading straight for the nearest active day | ✅ | ✅ | ✅ | this action (users can also use [Platane/snk](https://github.com/Platane/snk)) |
| 3D isometric skyline with busiest day and longest streak | ✅ | ✅ | ✅ | this action (users can also use [github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib)) |
| Project table sorted by stars, with a live Star button per row | — | ✅ | ✅ | this action, `command: readme` |
| Recent activity: releases, merged PRs, new repos, and for orgs who starred what | — | ✅ | ✅ | this action, `command: readme` |
| Metrics card: languages | — | — | ✅ | [lowlighter/metrics](https://github.com/lowlighter/metrics) |

The first three columns matter. GitHub only keeps a contribution calendar for user accounts, so the popular snake and 3D actions can't draw a repository or an organization. This one counts commits from `git log` (one repo) or sums `stats/commit_activity` across every public repo (an org) and draws from that.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/heatmap-dark.svg">
  <img alt="Commit heatmap of this repository over the last 53 weeks, cells popping in left to right" src="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/heatmap.svg">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/skyline-dark.svg">
  <img alt="Isometric 3D skyline of daily commits with busiest day and longest streak" src="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/skyline.svg">
</picture>

## Quick start for a repository

Add `.github/workflows/readme-showcase.yml`:

```yaml
name: README showcase
on:
  schedule: [{ cron: "23 3 * * *" }]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  art:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: HowardZlh/github-action-shares@v1
        with: { source: repo, git-path: ., out-dir: dist }
      - uses: crazy-max/ghaction-github-pages@v5
        with: { target_branch: output, build_dir: dist, keep_history: false }
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
```

Run it once from the Actions tab, then put this in your README (replace `OWNER/REPO`):

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/output/snake-dark.svg">
  <img alt="Snake eating OWNER/REPO's commit history" src="https://raw.githubusercontent.com/OWNER/REPO/output/snake.svg">
</picture>
```

The SVGs go to a separate `output` branch. Your default branch never gets a bot commit, so a deploy workflow that runs on `push: main` stays quiet. The full file with comments is in [`examples/repo/`](examples/repo/.github/workflows/readme-showcase.yml).

## For your profile README

The profile example combines three tools: Platane/snk for the snake, github-profile-3d-contrib for the 3D calendar, and this action for the heatmap and the README blocks. Put two marker pairs in `README.md`:

```md
<!-- SHOWCASE:REPOS:START -->
<!-- SHOWCASE:REPOS:END -->

<!-- SHOWCASE:ACTIVITY:START -->
<!-- SHOWCASE:ACTIVITY:END -->
```

and copy [`examples/profile/`](examples/profile/.github/workflows/profile-showcase.yml). The README job writes nothing that changes every day (no "last updated" timestamp), so it only commits when a star count or an event actually changes.

Running live: [github.com/HowardZlh](https://github.com/HowardZlh).

## For an organization profile

An org's homepage README is `profile/README.md` in the org's `.github` repository. Copy [`examples/org/`](examples/org/.github/workflows/org-showcase.yml). `source: org` sums commits across the org's public repos, and the activity list includes `⭐ someone starred your-repo` lines, which is social proof that a user profile can't show.

Running live: [github.com/FailRouter](https://github.com/FailRouter).

## Inputs

| Input | Default | Used by | Meaning |
|:--|:--|:--|:--|
| `command` | `art` | — | `art` writes SVGs, `readme` rewrites marked README blocks |
| `source` | `repo` | art | `repo`, `org` or `user` |
| `target` | current repo | art | `owner/repo`, org name or login |
| `git-path` | — | art | read commit dates from this checkout instead of the stats API; needs `fetch-depth: 0` |
| `label` | `commits` / `contributions` | art | the noun printed in the SVG titles |
| `out-dir` | `dist` | art | where the 6 SVGs and `stats.json` go |
| `readme` | `README.md` | readme | file to rewrite |
| `repos` | — | readme | comma-separated `owner/repo` list for the stars table |
| `org` | — | readme | add every public, non-fork repo of this org to the table |
| `activity` | — | readme | `users:<login>` or `orgs:<org>` |
| `limit` | `8` | readme | max activity lines |
| `skip-repos` | — | readme | `owner/repo` list to leave out of the activity list |
| `token` | `github.token` | both | the default is enough; `source: user` needs it for GraphQL |

`art` writes `heatmap.svg`, `snake.svg`, `skyline.svg`, the same three with `-dark`, and `stats.json` with the yearly total, the busiest day and the streaks, in case you want to quote a number in your own copy.

## How it works

- **Zero dependencies.** Node's built-in `fetch`, `node:test` and string templates. `action.yml` is a composite action that runs `node bin/showcase.mjs`, so there's no `node_modules` to audit or Docker image to pull.
- **Animation without JavaScript.** GitHub serves README images through its camo proxy as `<img>`, where scripts never run. The heatmap and skyline use CSS keyframes, and the snake uses SMIL `<animateMotion>`.
- **The snake only walks where it has to.** It enters from the top-left, always heads for the nearest uneaten square (one cell per step), and leaves through the nearer side; each eaten cell gets one `<animate>` timed to the step the head arrives. A loop lasts 8 to 30 seconds however sparse or busy the year was.
- **Reduced motion is respected.** The CSS animations switch off under `prefers-reduced-motion: reduce`, and the SVG shows the final frame.
- **Readable by screen readers and search engines.** Each SVG has `role="img"`, a `<title>` with the real number ("569 contributions in the last year") and a `<desc>` with the date range. Each cell carries a tooltip with its date and count.
- **Quartile colouring**, the way GitHub does it: one 68-contribution day doesn't wash the rest of the year out to the palest green.

The tests run against a throwaway git repository and a fake `fetch`, with no network. `npm run coverage` fails under 90% lines or 80% branches.

```sh
npm test
npm run coverage
node bin/showcase.mjs art --source repo --target me/repo --git . --out dist   # local preview
```

## Tutorial

A step-by-step guide: creating the profile repo, the metrics token, the org `.github` repo, dark-mode images, README copy that holds up in search results, and troubleshooting. Read it in [English](docs/en/tutorial.md) or [中文](docs/zh-CN/tutorial.md).

## Used by

- [HowardZlh](https://github.com/HowardZlh), profile README
- [FailRouter](https://github.com/FailRouter), organization profile
- [stellar-odyssey](https://github.com/HowardZlh/stellar-odyssey), scroll from a planet's surface out to the edge of the observable universe, in 3D
- [usage-guard-collector](https://github.com/HowardZlh/usage-guard-collector), Cloudflare usage spike alerts
- [failrouter](https://github.com/FailRouter/failrouter), a museum of famous outages

Using it somewhere? Open a PR that adds your repo to this list.

If one of these SVGs ends up in your README, a ⭐ helps the next person find the action.

## License

[MIT](LICENSE) © 2026 Howard ([@HowardZlh](https://github.com/HowardZlh))
