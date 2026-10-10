---
title: Animated GitHub contribution snake for your profile README, your repos and your orgs
published: false
description: A zero-dependency GitHub Action that draws an animated snake, heatmap and 3D skyline for a repository or an organization, not only for a user. One workflow file, no bot commits on main.
tags: github, githubactions, opensource, showdev
cover_image: https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/cover.png
---

![A snake eating a year of daily contributions on a GitHub-style grid, heading for the nearest green square each time](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/snake.gif)

GitHub keeps a contribution calendar for user accounts and nothing else. A repository doesn't have one, and neither does an organization. That's why every contribution snake you've seen sits on somebody's profile page.

I wanted the snake on two pages that don't qualify: the README of [stellar-odyssey](https://github.com/HowardZlh/stellar-odyssey), and the profile of the [FailRouter](https://github.com/FailRouter) organization. So I wrote [github-action-shares](https://github.com/HowardZlh/github-action-shares), a GitHub Action that builds the calendar itself and draws three animated SVGs from it. It took two days, from v1.0.0 to v1.2.0.

## What lands in your README

One run writes eight SVGs (a light and a dark version of each) and a `stats.json`:

| File | What it shows |
|:--|:--|
| `snake.svg` | a snake that eats the year, nearest square first |
| `heatmap.svg` | the familiar grid, filling in week by week |
| `skyline.svg` | a 3D isometric skyline with the busiest day and the longest streak |
| `activity.svg` | the snake, or a one-line summary while the project is young |
| `stats.json` | total, busiest day, streaks, first and last active day |

The heatmap and the skyline are drawn from the same year as the snake at the top of this post:

![Heatmap of a year of contributions, squares popping in from left to right](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/heatmap.gif)

![3D isometric skyline of the same year, bars growing from the floor, with busiest day 68 and longest streak 20 days](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/skyline-dark.gif)

All three draw the same daily numbers. Pick one per page. Three charts of one dataset make a reader scroll past the same year three times.

## A young repo doesn't show a year of empty squares

This was the first thing that looked wrong. A repository that is two months old, drawn on GitHub's 53-week grid, is forty-five weeks of grey followed by a few green columns. To a visitor that reads as "barely touched", which is the opposite of what a project activity chart is for.

`window: auto` starts the grid at the week of the first commit, at least eight weeks wide. Stellar Odyssey started on 2026-07-19, so its grid is twelve weeks, not fifty-three:

![The Project Activity section of the stellar-odyssey README: 304 commits since 2026-07-19, a snake moving through a twelve-week grid](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/repo-activity.png)

Below ten active days even a cropped grid is mostly empty, so `activity.svg` turns into a sentence. The FailRouter org page shows that state right now:

![FailRouter organization profile: a repository table with a Star button, a one-line commit summary reading 24 commits since 2026-08-16, 4 active days, and a recent activity list](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/org-profile.png)

On its tenth active day the same URL starts serving the snake. Nobody edits the README for that, and no bot commits to it either.

## Set it up for a repository in three steps

**Add the workflow.** Save this as `.github/workflows/readme-showcase.yml`:

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
        with: { fetch-depth: 0 } # git log needs the full history
      - uses: HowardZlh/github-action-shares@v1
        with: { source: repo, git-path: ., window: auto, out-dir: dist }
      - uses: crazy-max/ghaction-github-pages@v5
        with: { target_branch: output, build_dir: dist, keep_history: false }
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
```

**Run it once.** Open the Actions tab, pick the workflow, and press Run workflow. After that the nightly schedule takes over.

![The Actions tab of a repository with the Showcase workflow selected and the Run workflow dropdown open on branch main](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/run-workflow.png)

The run takes 10 to 15 seconds and creates an `output` branch with the images:

![The output branch of the repository: one bot commit with the SVGs (activity, heatmap, skyline, snake) in light and dark, plus stats.json](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/output-branch.png)

**Point your README at it.** Replace `OWNER/REPO`:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/output/activity-dark.svg">
  <img alt="OWNER/REPO commits since the first one" src="https://raw.githubusercontent.com/OWNER/REPO/output/activity.svg">
</picture>
```

`<picture>` picks the dark file for visitors on GitHub's dark theme. Write a real `alt`; screen readers read it and image search indexes it.

## Your profile and your organization

On a profile, `source: user` reads your contribution calendar through GraphQL, so private work counts too if you've ticked *Private contributions* in your profile settings. The profile example pairs the snake with [github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib) for the 3D calendar, and adds three [shields.io](https://shields.io) badges that read their numbers from `stats.json`. Here is [my profile](https://github.com/HowardZlh) in dark mode:

![HowardZlh's GitHub profile in dark mode: the snake eating 1,208 contributions, a 3D contribution calendar with a language donut, and badges for busiest day, longest streak and active days](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/profile-dark.png)

For an organization, `source: org` sums the commit statistics of every public, non-fork repository. The same action has a second command, `readme`, that rewrites two marked blocks in a README: a project table sorted by stars and a recent-activity list. On an org page that list includes lines like "⭐ someone starred your-repo", which is social proof a personal profile can't show.

You can copy both setups from [`examples/`](https://github.com/HowardZlh/github-action-shares/tree/main/examples), and the [tutorial](https://github.com/HowardZlh/github-action-shares/blob/main/docs/en/tutorial.md) walks through each one with the same screenshots.

## How it works

![Data flow: git log, stats/commit_activity or GraphQL feed one daily calendar; the action renders eight SVGs and stats.json into the output branch; the README loads them through raw.githubusercontent.com](https://raw.githubusercontent.com/HowardZlh/github-action-shares/main/docs/images/flow.png)

**Three sources, one calendar.** A repository is counted from `git log` dates in the checkout. An organization is the sum of `/repos/{repo}/stats/commit_activity` across its public repos. A user comes from the GraphQL `contributionCalendar`, the same numbers GitHub draws on the profile. Everything after that step only sees a list of `{ date, count }`.

**Animation without JavaScript.** GitHub serves README images through its camo proxy as plain `<img>` tags. Scripts never run there, and hover events never fire. What does work is CSS `@keyframes` and SMIL. The heatmap and the skyline use keyframes with a per-cell delay. The snake is a `<rect>` per body segment moving along an `<animateMotion>` path, and each square it eats has its own `<animate>` that turns it grey at the exact step the head arrives.

**The snake takes the short way.** It enters at the top left, always heads for the nearest uneaten green square one cell at a time, and leaves through the nearer edge. The step length is chosen so a loop lasts between 8 and 30 seconds, whether the year had five active days or three hundred.

My first version swept all 371 cells in order. On a sparse year it spent ten seconds crawling over grey before it reached anything green.

**Nothing lands on your default branch.** The images go to an `output` branch through [crazy-max/ghaction-github-pages](https://github.com/crazy-max/ghaction-github-pages) with `keep_history: false`, so that branch is always one commit. If merging to `main` deploys your site, a nightly art refresh never triggers it.

**Quartile colours, like GitHub.** The four greens are cut at the quartiles of your non-zero days, not at a fraction of the maximum. One 68-commit day doesn't wash the rest of the year out to the palest shade.

**Respectful defaults.** Under `prefers-reduced-motion: reduce` the SVGs show the final frame. Each one has `role="img"`, a `<title>` with the real number and a `<desc>` with the date range. A longest streak under three days is left out of the text, because "longest streak: 1 day" helps nobody.

**Zero dependencies.** It's a composite action that runs `node bin/showcase.mjs`: about 850 lines of JavaScript using the built-in `fetch` and string templates. There's no `node_modules` to audit and no Docker image to pull. Tests use `node:test` against a throwaway git repository and a fake `fetch`, and CI fails under 90% line coverage.

## Tools it stands on

| Tool | Job |
|:--|:--|
| GitHub Actions, composite action | runs the generator on a schedule |
| Node.js built-ins (`fetch`, `node:test`) | API calls, tests, coverage, no packages |
| GitHub REST and GraphQL APIs | commit statistics, contribution calendar, stars, events |
| crazy-max/ghaction-github-pages | pushes the SVGs to the `output` branch |
| raw.githubusercontent.com | serves the images to your README |
| shields.io dynamic JSON badges | live numbers from `stats.json` |
| github-profile-3d-contrib (optional) | the 3D calendar on a profile |

## Things I ran into

- **Not every badge host gets through camo.** Visitor-counter images from komarev.com load in a browser and return `404 Cannot proxy the given URL` inside a README. Copy the image address from the rendered page and `curl` it before you rely on a badge.
- **The org's own `.github` repo broke the org chart.** Every commit to the profile README made GitHub recompute that repo's statistics, and the API kept answering `202 Accepted`. The action now skips `.github` and skips a repo whose statistics are still cold with a warning instead of failing the run.
- **Pull request events lost their titles.** Since 2025 the Events API ships pull request events without `title` or `html_url`, so the activity list fetches `/pulls/{n}` for the few it shows.

For comparison, here is how it differs from the snake most profiles use:

| | [Platane/snk](https://github.com/Platane/snk) | github-action-shares |
|:--|:--|:--|
| Works for | users | users, repos, orgs |
| Eating order | one colour level after another | nearest square first |
| Loop on a busy year I measured | about 85 s | 8 to 30 s by design |

## Limits

README images can't be interactive. If you want tooltips or zoom, link the image to a page you host. The org chart only sees public repositories, and it inherits GitHub's 52-week window for commit statistics. GitHub pauses scheduled workflows in a public repository after 60 days without activity, so a dormant repo's chart stops refreshing until you re-enable it.

## Try it

Copy the workflow above into one of your repos, press Run workflow, and paste the five lines of `<picture>` into the README. The whole thing takes about two minutes, most of it waiting for the first run.

{% embed https://github.com/HowardZlh/github-action-shares %}

If you put it on a page, open a PR that adds your repo to the *Used by* list. And if it saved you an evening, a star on the repo helps the next person find it.
