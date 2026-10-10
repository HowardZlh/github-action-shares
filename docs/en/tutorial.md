# Tutorial: animated stats for a GitHub profile, an organization and a repository

**English** | [中文](../zh-CN/tutorial.md) · Back to the [README](../../README.md)

This guide wires up the three setups running on [github.com/HowardZlh](https://github.com/HowardZlh), [github.com/FailRouter](https://github.com/FailRouter) and the repos linked from them. Each part stands alone, so skip to the one you need. Expect about 10 minutes per part, most of it waiting for the first workflow run.

**Contents**: [Which output goes where](#which-output-goes-where) · [Profile README](#part-1-your-profile-readme) · [Organization profile](#part-2-an-organization-profile) · [A single repository](#part-3-a-single-repository) · [README copy that gets read](#part-4-readme-copy-that-gets-read-and-found) · [Troubleshooting](#troubleshooting)

## Which output goes where

| Where | Chart | Numbers | Stars table | Activity |
|:--|:--|:--|:--|:--|
| Profile (`login/login`) | `art/snake.svg` (`source: user`) + github-profile-3d-contrib | shields badges reading `art/stats.json` | `repos:` list | `users:login` |
| Org (`org/.github`) | `activity.svg` (`source: org`, `window: auto`) | — | `org:` | `orgs:org` |
| Repo | `activity.svg` (`source: repo`, `window: auto`) | `last commit` / `release` shields badges at the top | — | — |

**One chart per page.** The heatmap, the snake and the skyline draw the same daily numbers. Three of them make a reader scroll past one dataset three times, and a profile already has GitHub's own heatmap under the README. The action still writes all of them, so you can pick.

**Leave out numbers that read as weaknesses.** A visitor counter at 3, a "0 followers" card, a one-day streak or a 53-week grid with four green squares all tell a visitor the opposite of what you meant. `window: auto` and `activity.svg` exist for exactly that; add a visitor counter only once it shows a number you'd quote.

Everything except a visitor counter is generated inside your own Actions run and stored in your own repo. Visitor counters are hosted services and they count image loads, not people.

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
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/YOUR_LOGIN/YOUR_LOGIN/output/art/snake-dark.svg">
  <img alt="Snake eating YOUR_LOGIN's GitHub contribution graph" src="https://raw.githubusercontent.com/YOUR_LOGIN/YOUR_LOGIN/output/art/snake.svg">
</picture>
```

The 3D calendar lives at `output/3d/profile-night-rainbow.svg` (dark) and `output/3d/profile-green-animate.svg` (light). Under it, three badges that update themselves from `output/art/stats.json`:

```md
![Busiest day](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FYOUR_LOGIN%2FYOUR_LOGIN%2Foutput%2Fart%2Fstats.json&label=busiest%20day&query=%24.busiest.count&suffix=%20contributions&color=4d9fff)
![Longest streak](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FYOUR_LOGIN%2FYOUR_LOGIN%2Foutput%2Fart%2Fstats.json&label=longest%20streak&query=%24.longest&suffix=%20days&color=4d9fff)
![Active days](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FYOUR_LOGIN%2FYOUR_LOGIN%2Foutput%2Fart%2Fstats.json&label=active%20days&query=%24.activeDays&suffix=%20of%20the%20last%20year&color=4d9fff)
```

**Most of your work is in private or company repos?** The calendar the action reads is the one strangers see. Turn on *Contribution settings → Private contributions* on your profile, or the charts show only your public commits. Private work is then counted, but never named.

The example leaves out Platane/snk (it eats one colour layer after another, so a busy year loops for about 85 seconds and the darkest days come last) and the lowlighter/metrics card (its counts are public-only, so it can say "219 commits" and "0 followers" next to a calendar of 2,400 contributions, and the 3D chart already has a language donut).

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

## Part 2: an organization profile

An organization's homepage README is `profile/README.md` inside a **public** repository named `.github` owned by the org.

```sh
gh repo create YOUR_ORG/.github --public --description "Organization profile"
```

Copy [`examples/org/.github/workflows/org-showcase.yml`](../../examples/org/.github/workflows/org-showcase.yml). `source: org` asks GitHub for `stats/commit_activity` on every public, non-fork, non-archived repo and adds them up. GitHub computes those statistics lazily and answers `202 Accepted` the first time. The action retries with back-off for about two minutes, so a first run on a big org is slow but succeeds.

Use `window: auto` there: a young org's year is mostly empty, and the grid then starts at the org's first commit. In the README, show `output/activity.svg`, which stays a one-line summary until the org has 10 active days.

`org:` puts every public repo into the stars table. The activity list for an org also shows `⭐ someone starred repo` and `🍴 someone forked repo`. A visitor reading that sees other people already use the project, which a profile can't show.

Private repos and private contributions never appear. Nothing in this setup reads them.

## Part 3: a single repository

The snake and 3D actions for profiles can't draw a repository, because only user accounts have a contribution calendar. This action counts commit dates from `git log` instead:

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0 # without this, git log sees one commit
- uses: HowardZlh/github-action-shares@v1
  with:
    source: repo
    git-path: .
    window: auto # start at the first commit, at least 8 weeks wide
    out-dir: dist
```

Reference `activity.svg`, not `snake.svg`:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/output/activity-dark.svg">
  <img alt="OWNER/REPO commits since the first one" src="https://raw.githubusercontent.com/OWNER/REPO/output/activity.svg">
</picture>
```

Until the repo has 10 active days (`min-days`), `activity.svg` is a single line such as "24 commits since 2026-08-16 · 4 active days · last commit 2026-10-09". After that it becomes the snake.

The README never has to change, and nothing is committed to your default branch to switch between them.

The full workflow is [`examples/repo/.github/workflows/readme-showcase.yml`](../../examples/repo/.github/workflows/readme-showcase.yml). It pushes the SVGs to an `output` branch and never commits to `main`. That matters if merging to `main` deploys your site: a nightly art refresh shouldn't run your production pipeline.

Put the art below the first screen of the README. Visitors decide in the first few seconds whether the project solves their problem. The description, a screenshot of the product and the install command belong there, and the snake doesn't. A "Project activity" section near Contributing works well, as a sign that the project is alive. One image is enough. A `last commit` and a `release` badge at the top answer "is it maintained?" faster:

```md
[![Last commit](https://img.shields.io/github/last-commit/OWNER/REPO)](https://github.com/OWNER/REPO/commits)
[![Release](https://img.shields.io/github/v/release/OWNER/REPO)](https://github.com/OWNER/REPO/releases)
```

## Part 4: README copy that gets read and found

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
| The chart is mostly empty squares | A young repo or org drawn over 53 weeks | `window: auto` and point the README at `activity.svg` |
| `activity.svg` is a sentence, not a chart | Fewer than `min-days` (10) active days in the window | Expected; it switches to the snake by itself |
| Profile chart misses your work commits | Private contributions are hidden from strangers, and the action sees what they see | Profile → Contribution settings → Private contributions |
| Activity list empty | Only public events from the last 90 days count | Expected for a quiet account |

Something else? [Open an issue](https://github.com/HowardZlh/github-action-shares/issues) with the run URL.
