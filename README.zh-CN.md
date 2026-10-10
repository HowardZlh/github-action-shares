# GitHub README 动画统计：个人主页、组织主页、单个仓库都能用

[English](./README.md) | **中文**

一个 GitHub Action，用提交记录画三张会动的 SVG：一年的贡献热力图、一条把格子吃掉的贪吃蛇、一片 3D 等距柱状图。它能画**单个仓库**和**整个组织**，不只限于个人账号。另外它还会每天改写 README 里两块内容：按星数排序的项目表，和最近动态列表。零依赖，MIT 协议。

[![CI](https://github.com/HowardZlh/github-action-shares/actions/workflows/ci.yml/badge.svg)](https://github.com/HowardZlh/github-action-shares/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Star HowardZlh/github-action-shares on GitHub](https://img.shields.io/badge/Star-on_GitHub-white?style=social&logo=github)](https://github.com/HowardZlh/github-action-shares)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/demo/snake-dark.svg">
  <img alt="贪吃蛇动画：直奔最近的一格，吃掉 @HowardZlh 一年里每天的贡献" src="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/demo/snake.svg">
</picture>

上面这条蛇吃的是 [@HowardZlh](https://github.com/HowardZlh) 一年的贡献，[`showcase.yml`](.github/workflows/showcase.yml) 每晚重画一次。才建两个月的仓库，格子从第一次提交那周画起，不会摆出一整年的空格；活跃不满 10 天时只显示一行文字。

**目录**：[能生成什么](#能生成什么) · [仓库三步接入](#仓库三步接入) · [个人主页](#个人主页) · [组织主页](#组织主页) · [参数](#参数) · [教程](docs/zh-CN/tutorial.md) · [实现方式](#实现方式)

## 能生成什么

每张 SVG 都有浅色、深色两版，访客用哪种 GitHub 主题就显示哪版。

| 产物 | 仓库 | 组织 | 个人 | 来源 |
|:--|:-:|:-:|:-:|:--|
| 直奔最近一格的贪吃蛇 | 支持 | 支持 | 支持 | 本 Action |
| 按周逐列浮现的贡献热力图 | 支持 | 支持 | 支持 | 本 Action |
| 3D 等距柱状图，附最忙的一天、最长连续天数 | 支持 | 支持 | 支持 | 本 Action（个人也可用 [github-profile-3d-contrib](https://github.com/yoshi389111/github-profile-3d-contrib)） |
| `activity.svg`：活跃满 10 天是贪吃蛇，不满时是一行文字摘要 | 支持 | 支持 | 支持 | 本 Action |
| `stats.json`，给 shields 动态徽章用（最忙一天、连续天数、活跃天数） | 支持 | 支持 | 支持 | 本 Action |
| 按星数排序的项目表，每行一个实时 Star 按钮 | — | 支持 | 支持 | 本 Action，`command: readme` |
| 最近动态：发版、合并的 PR、新仓库；组织还会显示谁点了星 | — | 支持 | 支持 | 本 Action，`command: readme` |

关键在前三列。GitHub 只给个人账号记贡献日历，所以那两个最常用的贪吃蛇和 3D Action 画不了仓库，也画不了组织。本 Action 换了数据源：单个仓库读 `git log`，组织把所有公开仓库的 `stats/commit_activity` 加起来，再照同样的格子画。

三张图画的是同一份每日数字，README 里放**一张**就够，最能让人停下来看的是贪吃蛇。下面的热力图和 3D 图，和上面那条蛇用的是同一年的数据。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/demo/heatmap-dark.svg">
  <img alt="@HowardZlh 一年每日贡献的热力图，格子从左到右依次弹出" src="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/demo/heatmap.svg">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/demo/skyline-dark.svg">
  <img alt="@HowardZlh 一年每日贡献的 3D 等距柱状图，标出最忙的一天和最长连续天数" src="https://raw.githubusercontent.com/HowardZlh/github-action-shares/output/demo/skyline.svg">
</picture>

## 仓库三步接入

第一步，新建 `.github/workflows/readme-showcase.yml`：

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
        with: { source: repo, git-path: ., window: auto, out-dir: dist }
      - uses: crazy-max/ghaction-github-pages@v5
        with: { target_branch: output, build_dir: dist, keep_history: false }
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
```

第二步，到 Actions 页手动跑一次。第三步，把下面这段贴进 README，`OWNER/REPO` 换成你的：

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OWNER/REPO/output/activity-dark.svg">
  <img alt="OWNER/REPO 从第一次提交以来的提交记录" src="https://raw.githubusercontent.com/OWNER/REPO/output/activity.svg">
</picture>
```

仓库活跃满 10 天后，`activity.svg` 就是贪吃蛇；之前是一行文字，比如「24 commits since 2026-08-16 · last commit 2026-10-09」，新项目不会摆出一片空格子。`window: auto` 让格子从第一次提交那周开始（至少 8 周宽），而不是从 53 周前开始。

图片推到单独的 `output` 分支，默认分支上不会出现机器人提交。你的部署流程如果监听 `push: main`，也不会被它误触发。带注释的完整文件在 [`examples/repo/`](examples/repo/.github/workflows/readme-showcase.yml)。

## 个人主页

个人主页的示例组合了两样东西：本 Action 画贪吃蛇、产出 `stats.json`、改写 README，github-profile-3d-contrib 画 3D 日历。GitHub 本来就会在个人主页 README 下面画一张热力图，示例里不再放第二张。在 `README.md` 里放两对标记：

```md
<!-- SHOWCASE:REPOS:START -->
<!-- SHOWCASE:REPOS:END -->

<!-- SHOWCASE:ACTIVITY:START -->
<!-- SHOWCASE:ACTIVITY:END -->
```

再复制 [`examples/profile/`](examples/profile/.github/workflows/profile-showcase.yml)。生成的内容里没有「最后更新于」这类每天都变的字段，星数或动态真的变了才会产生提交，提交历史不会被每天一条的刷新淹掉。

实际效果：[github.com/HowardZlh](https://github.com/HowardZlh)。

## 组织主页

组织主页的 README 放在该组织 `.github` 仓库的 `profile/README.md`。复制 [`examples/org/`](examples/org/.github/workflows/org-showcase.yml) 即可。`source: org` 会把组织下所有公开仓库的提交加起来；动态列表里还会出现「某某 starred 某仓库」，这种别人点星的记录，个人主页上看不到。

实际效果：[github.com/FailRouter](https://github.com/FailRouter)。

## 参数

| 参数 | 默认值 | 用于 | 含义 |
|:--|:--|:--|:--|
| `command` | `art` | — | `art` 生成 SVG；`readme` 改写 README 里的标记块 |
| `source` | `repo` | art | `repo`、`org` 或 `user` |
| `target` | 当前仓库 | art | `owner/repo`、组织名或用户名 |
| `git-path` | — | art | 从这个本地检出读提交日期，不走统计接口；需要 `fetch-depth: 0` |
| `label` | `commits` / `contributions` | art | SVG 标题里的计数单位 |
| `window` | `year` | art | `year`：最近 53 周；`auto`：从第一个活跃日所在的那周开始，至少 `min-weeks` 周宽。不满一年的仓库和组织用它 |
| `min-weeks` | `8` | art | `window: auto` 时格子最窄几周 |
| `min-days` | `10` | art | 活跃满这么多天，`activity.svg` 才是贪吃蛇，之前是一行文字摘要 |
| `out-dir` | `dist` | art | 8 张 SVG 和 `stats.json` 的输出目录 |
| `readme` | `README.md` | readme | 要改写的文件 |
| `repos` | — | readme | 项目表里的仓库，逗号分隔的 `owner/repo` |
| `org` | — | readme | 把这个组织的全部公开、非 fork 仓库加进项目表 |
| `activity` | — | readme | `users:<用户名>` 或 `orgs:<组织名>` |
| `limit` | `8` | readme | 动态列表最多几行 |
| `skip-repos` | — | readme | 不出现在动态里的仓库 |
| `token` | `github.token` | 两者 | 默认值就够；`source: user` 要用它调 GraphQL |

`art` 产出 `heatmap.svg`、`snake.svg`、`skyline.svg`、`activity.svg`，各带一个 `-dark` 版本，外加一份 `stats.json`：总数、最忙的一天、活跃天数、最长和当前连续天数、第一个和最后一个活跃日、窗口类型。想在 README 里放一个会自己更新的数字，用 shields 的动态徽章读它：

```md
![Longest streak](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOWNER%2FREPO%2Foutput%2Fstats.json&label=longest%20streak&query=%24.longest&suffix=%20days)
```

## 实现方式

- **零依赖。**只用 Node 自带的 `fetch`、`node:test` 和字符串模板。`action.yml` 是 composite action，直接跑 `node bin/showcase.mjs`，没有 `node_modules` 要审计，也没有 Docker 镜像要拉。
- **动画不靠 JavaScript。**README 里的图片经 GitHub 的 camo 代理以 `<img>` 加载，脚本根本不会执行。热力图和 3D 图用 CSS 关键帧，贪吃蛇用 SMIL 的 `<animateMotion>`。
- **贪吃蛇只走必要的路。**从左上角进场，每次直奔离蛇头最近、还没吃掉的格子，每步走一格，吃完从近的一侧离场。被吃的格子各配一个 `<animate>`，时间点对上蛇头到达的那一步。不管一年的提交多稀疏或多密集，一圈都在 8 到 30 秒之间。
- **照顾「减少动态效果」设置。**系统开了 `prefers-reduced-motion: reduce`，CSS 动画就关掉，直接显示最后一帧。
- **读屏软件和搜索引擎都读得到。**每张 SVG 带 `role="img"`；`<title>` 里写的是真实数字，比如「569 contributions in the last year」；`<desc>` 写日期范围。
- **README 里做不到交互，这是 GitHub 的限制。**悬停提示、点击、拖动旋转都要脚本或鼠标事件，经 camo 代理的 `<img>` 一样都拿不到。想要能把玩的图，就把图片链接到你自己托管的页面。
- **不展示会被读成短板的数字。**最长连续不到 3 天就不写进文字；活跃不满 10 天的项目显示一句话，而不是一张几乎全空的格子。
- **按四分位数分配颜色**，和 GitHub 自己的算法一样。我自己的日历里有一天 68 次贡献，如果按最大值等分，全年其余格子都会褪成最浅的绿。

测试跑在临时 git 仓库和假的 `fetch` 上，不联网。`npm run coverage` 在行覆盖低于 90%、分支覆盖低于 80% 时失败。

```sh
npm test
npm run coverage
node bin/showcase.mjs art --source repo --target me/repo --git . --out dist   # 本地预览
```

## 教程

从建个人主页仓库、配置组织的 `.github` 仓库、接入一个新仓库，到深色模式图片、写出在搜索结果里站得住的 README 文案、排错，都按步骤写在教程里：[中文](docs/zh-CN/tutorial.md) · [English](docs/en/tutorial.md)。

## 谁在用

- [HowardZlh](https://github.com/HowardZlh)：个人主页
- [FailRouter](https://github.com/FailRouter)：组织主页
- [stellar-odyssey](https://github.com/HowardZlh/stellar-odyssey)：用滚轮从行星表面一路缩放到可观测宇宙边缘的 3D 宇宙
- [usage-guard-collector](https://github.com/HowardZlh/usage-guard-collector)：Cloudflare 用量突增告警
- [failrouter](https://github.com/FailRouter/failrouter)：著名故障博物馆

你的仓库也用上了？提个 PR 把它加到这个列表。

哪张图最后放进了你的 README，顺手点个 Star，下一个找这类工具的人更容易看到它。

## 许可证

[MIT](LICENSE) © 2026 Howard（[@HowardZlh](https://github.com/HowardZlh)）
