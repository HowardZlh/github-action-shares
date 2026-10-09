# 教程：给 GitHub 个人主页、组织主页和单个仓库加上动画统计

[English](../en/tutorial.md) | **中文** · 返回 [README](../../README.zh-CN.md)

这份教程把 [github.com/HowardZlh](https://github.com/HowardZlh)、[github.com/FailRouter](https://github.com/FailRouter) 和它们链接的几个仓库的配置拆开讲一遍。

四个部分互不依赖，需要哪个看哪个。每部分大约 10 分钟，大半是在等第一次运行跑完。

**目录**：[哪张图放哪里](#哪张图放哪里) · [个人主页](#一个人主页-readme) · [metrics 令牌](#二metrics-令牌) · [组织主页](#三组织主页) · [单个仓库](#四单个仓库) · [文案怎么写才有人看](#五readme-文案怎么写才有人看搜得到) · [排错](#排错)

## 哪张图放哪里

| 位置 | 贪吃蛇 | 热力图 | 3D | 项目表 | 最近动态 | 访客数 |
|:--|:--|:--|:--|:--|:--|:--|
| 个人主页（`login/login`） | Platane/snk | 本 Action，`source: user` | github-profile-3d-contrib | `repos:` 列表 | `users:login` | komarev |
| 组织主页（`org/.github`） | 本 Action，`source: org` | 同左 | 同左 | `org:` | `orgs:org` | komarev |
| 单个仓库 | 本 Action，`source: repo` | 同左 | 同左 | — | — | visitor-badge |

除了访客计数，所有图都在你自己的 Actions 里生成、存在你自己的仓库里。访客计数是第三方托管服务，数的是图片被加载了几次，不是来了几个人，看趋势就好，别当成精确人数。

## 一、个人主页 README

GitHub 的规则：只要有一个**公开**仓库和你的用户名同名，它的 README 就会显示在你的个人主页上。

```sh
gh repo create YOUR_LOGIN/YOUR_LOGIN --public --description "Profile README"
```

`README.md` 第一行写 H1，说清你是谁、在做什么，用别人会搜的词。个人主页的 `<title>` 只有「YOUR_LOGIN (名字) · GitHub」，搜索引擎能从页面上读到你做什么的地方，就是这个 H1 和第一段。

```md
# Howard: open-source 3D space visualisation and Cloudflare tooling
```

接着放图。图片一律包在 `<picture>` 里，深色模式的访客才会拿到深色版；`alt` 一律写清图里是什么：

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/YOUR_LOGIN/YOUR_LOGIN/output/snake-dark.svg">
  <img alt="贪吃蛇吃掉 YOUR_LOGIN 的 GitHub 贡献图" src="https://raw.githubusercontent.com/YOUR_LOGIN/YOUR_LOGIN/output/snake.svg">
</picture>
```

3D 日历在 `output/3d/profile-night-rainbow.svg`（深色）和 `output/3d/profile-green-animate.svg`（浅色）。热力图、等距柱状图在 `output/art/heatmap.svg`、`output/art/skyline.svg`，各有一个 `-dark` 版本。

然后放两块由 Action 维护的区域。标记之间的内容每次运行都会被替换，标记外面的一个字都不动：

```md
## Projects
<!-- SHOWCASE:REPOS:START -->
<!-- SHOWCASE:REPOS:END -->

## Recent activity
<!-- SHOWCASE:ACTIVITY:START -->
<!-- SHOWCASE:ACTIVITY:END -->
```

复制 [`examples/profile/.github/workflows/profile-showcase.yml`](../../examples/profile/.github/workflows/profile-showcase.yml)，把 `repos:` 那行换成你自己的项目，推上去，手动跑一次：

```sh
gh workflow run profile-showcase.yml --repo YOUR_LOGIN/YOUR_LOGIN
gh run watch --repo YOUR_LOGIN/YOUR_LOGIN
```

跑绿之后会多出一个 `output` 分支，README 里的图就能加载了。raw.githubusercontent.com 有大约 5 分钟的缓存，刚跑完看到旧图属于正常现象。

## 二、metrics 令牌

[lowlighter/metrics](https://github.com/lowlighter/metrics) 那张语言占比卡片需要个人访问令牌（PAT）：默认的 `GITHUB_TOKEN` 只看得见当前仓库，看不到你名下的其他仓库。没配这个 secret，工作流会跳过这张卡片，其他图照常生成，所以这一步可做可不做。

先打开 [GitHub 的令牌创建页](https://github.com/settings/tokens/new?scopes=read:user,read:org&description=METRICS_TOKEN)，链接已经预选好 `read:user` 和 `read:org` 两个只读权限。过期时间选 90 天就够，快到期时 GitHub 会发邮件提醒。

生成后复制，再用下面的命令存进仓库，令牌不会出现在终端历史里：

```sh
pbpaste | gh secret set METRICS_TOKEN --repo YOUR_LOGIN/YOUR_LOGIN   # macOS
# Linux：xclip -o -selection clipboard | gh secret set METRICS_TOKEN --repo YOUR_LOGIN/YOUR_LOGIN
```

卡片会提交到默认分支的 `metrics/metrics.svg`，README 里用相对路径引用：`![语言占比](metrics/metrics.svg)`。

`plugin_achievements` 不要开。v3.34 的成就插件还在查询经典版 Projects，GitHub 已经下线了这个接口，卡片的 Achievements 一栏会显示「Unexpected error」。

## 三、组织主页

组织主页的 README 放在组织名下、名为 `.github` 的**公开**仓库里，路径是 `profile/README.md`。

```sh
gh repo create YOUR_ORG/.github --public --description "Organization profile"
```

复制 [`examples/org/.github/workflows/org-showcase.yml`](../../examples/org/.github/workflows/org-showcase.yml)。`source: org` 会对每个公开、非 fork、未归档的仓库请求 `stats/commit_activity`，再把结果加起来。GitHub 的统计是懒计算的，第一次请求会返回 `202 Accepted`。Action 会退避重试大约两分钟，所以大组织第一次跑得慢，但能跑完。

`org:` 会把全部公开仓库放进项目表。组织的动态列表里还会出现「⭐ 某人 starred 某仓库」「🍴 某人 forked 某仓库」。访客一眼就能看到已经有别人在用，个人主页给不出这种信号。

私有仓库和私有贡献不会出现，整套配置根本不读它们。

## 四、单个仓库

个人主页那两个贪吃蛇、3D Action 画不了仓库，因为贡献日历只属于个人账号。本 Action 改读 `git log` 里的提交日期：

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0 # 不加这一行，git log 只能看到一个提交
- uses: HowardZlh/github-action-shares@v1
  with:
    source: repo
    git-path: .
    out-dir: dist
```

完整工作流见 [`examples/repo/.github/workflows/readme-showcase.yml`](../../examples/repo/.github/workflows/readme-showcase.yml)。图推到 `output` 分支，从不向 `main` 提交。如果你的项目合并到 `main` 就会部署上线，这一点很要紧：每晚刷新一次图，不该把生产流水线也跑一遍。

图要放在 README 首屏以下。访客头几秒就在判断这个项目能不能解决他的问题，首屏该留给一句话简介、产品截图和安装命令，贪吃蛇往后排。放在 Contributing 附近一个「项目活跃度」小节里就很合适，告诉读者这个项目还活着。

## 五、README 文案怎么写才有人看、搜得到

图负责把人吸引进来，点不点 Star 要看图周围的字。

**首屏按这个顺序：**它是什么（H1，用别人会搜的说法）→ 它真能用（在线地址、截图、一个数字）→ 现在能做的一件事（安装命令、一键部署按钮、在线试用）。徽章放在证据后面，不要压在证据前面。

**H1 和第一段。**搜索结果里展示的是仓库 About 里的描述，再加 README 开头。两处都放上搜索词：「Cloudflare usage spike alerts」比「我写的一个小工具」好搜得多。

**仓库 About。**描述、网站、Topics 三项填满：`gh repo edit --description ... --homepage ... --add-topic ...`。Topics 会让仓库出现在 github.com/topics/cloudflare-workers 这类聚合页上。

**社交预览图。**Settings → Social preview，尺寸 1280×640。分享到 X、Slack、Discord、微信时显示的就是它；不传的话，GitHub 会拿你的头像凑数。

**每张图都写 alt**，写图里实际有什么，带上真实名字：「贪吃蛇吃掉 stellar-odyssey 的提交记录」，而不是「snake」。读屏软件会念它，图片搜索也会收录它。

**徽章不超过 5 个。**每个都应该回答访客心里的一个问题：能不能构建通过、什么许可证、还有没有人维护。「Made with love」回答不了任何问题。

**只请求一次 Star，放在结尾，**给一个具体的理由。第一行就摆个 Star 按钮像在讨要；读者拿到了有用的东西之后再提一句，才是正当的请求。

**星数少的时候别放 star-history 曲线。**一条停在 3 颗星的平线只会帮倒忙。实时的 Star 徽章能起同样的作用，又不会把数字放大给人看。

**照顾「减少动态效果」。**这里生成的 SVG 在 `prefers-reduced-motion` 下会停止动画。你自己加 GIF 的话，尽量短，一屏之内最多一张会动的图。

## 排错

| 现象 | 原因 | 处理 |
|:--|:--|:--|
| README 里图片裂开 | `output` 分支还不存在 | 到 Actions 页手动跑一次 |
| 图是昨天的 | raw.githubusercontent.com 缓存约 5 分钟，浏览器可能缓存更久 | 强制刷新，或稍等 |
| 报 `commit_activity ... still computing` | GitHub 还没算完某个仓库的统计 | 重跑一次，第二次命中缓存 |
| 热力图只有今天一格 | checkout 没加 `fetch-depth: 0` | 加上 |
| 推送 `output` 报 403 | 工作流令牌只读 | 写上 `permissions: contents: write`，并在 Settings → Actions → Workflow permissions 选 Read and write |
| 定时任务不跑了 | 公开仓库 60 天没有活动，GitHub 会暂停定时任务 | Actions 页找到该工作流，点 Enable |
| metrics 步骤显示跳过 | `METRICS_TOKEN` 没配或已过期 | 见第二部分 |
| 动态列表为空 | 只统计最近 90 天的公开事件 | 账号最近不活跃时属正常 |

遇到别的问题，带上运行链接 [提个 issue](https://github.com/HowardZlh/github-action-shares/issues)。
