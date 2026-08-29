# vimself.github.io

**在 Obsidian 里写完笔记 `git push`，博客自己长出来。** 这个仓库是那套自动化管道的全部代码 ——
一个 Astro 站点，内容一个字都不在这里，内容全部依据另一个仓库 [vimself/jory-notes](https://github.com/vimself/jory-notes)
，即 Obsidian vault 里，每次构建现拉现渲染。

[![部署](https://github.com/vimself/vimself.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/vimself/vimself.github.io/actions/workflows/deploy.yml)
[![站点](https://img.shields.io/badge/线上-vimself.github.io-1f2328)](https://vimself.github.io)

![站点预览](docs/preview.png)

这套东西是给自己搭的，但两个仓库怎么联动、怎么保证不产生「笔记和博客各写一遍」的分叉，
是可以照抄的。下面把链路和复刻步骤都写出来 —— **你也可以有自己的知识库 + 博客，两边永不打架。**

## 链路

```mermaid
flowchart LR
    O["本地 Obsidian vault"] -->|git push| N["notes 仓库<br/>纯 Markdown，无站点代码"]
    N -->|"repository_dispatch<br/>敲门铃"| B["blog 仓库<br/>本仓库"]
    B --> S["clone vault → astro build → Pages"]
    S --> W(("线上站点"))
```

四个入口都会跑同一个全量构建，任一条挂了其余三条还在：

| 入口 | 触发时机 |
| --- | --- |
| `repository_dispatch` | notes 仓库推送后敲门铃（只有 `计算机/**`、`附件/**` 变化才敲，草稿提交不触发） |
| `push` | 博客自己的改动：版式、管道 |
| `workflow_dispatch` | Actions 页面上的手动重建按钮 |
| `schedule` | 每周日 20:00 UTC 兜底一次，防 PAT 过期或 dispatch 偶发丢失 |

## 三个可以照抄的决定

这套管道真正值钱的不是代码，是下面三条取舍。它们和用什么静态站生成器无关。

### 一、方向是「博客拉」，不是「笔记推转换好的 markdown」

笔记仓库里**不产生任何生成物** —— 没有转换后的 md、没有 `dist/`、没有一行站点代码。
于是也就没有生成物与源文件漂移、没有合并冲突、没有「改了转换逻辑要回头重跑全库」。
每次都是从 vault 全量重建，天然幂等。改版式只在这个仓库提一次 commit，全站自动重渲染。

反方向只有一个 HTTP 请求：notes 仓库发一次 `repository_dispatch`，告诉博客「我更新了」。
**它连内容都不传**，博客收到通知后自己去 clone。

### 二、发布范围由**路径**决定，不由 frontmatter 决定

知识库的规则把 frontmatter 锁死在四个键（`tags`/`aliases`/`created`/`updated`），
「一个都不多」。所以博客不能要求笔记新增 `publish`、`draft`、`title` 这类字段 ——
**任何要求作者为发布多写一个字段的方案，都会在某个赶时间的深夜被跳过。**

好在同一套规则规定了「笔记路径恒为三段」，于是 `学科/领域/笔记.md` 这个三段 glob
就是「什么算一篇笔记」的唯一判据：

```
计算机/开发工具链/Git 三个区.md   三段 → 发布
草稿箱/随手记.md                 两段 → 不发布
模板/笔记模板.md                 两段 → 不发布
日志/2026-08-17.md               两段 → 不发布
```

**三段路径 = 发布，其余一律不发布。写作流程一个新步骤都不用加。**

### 三、URL 只由文件名决定，与 `学科/领域` 无关

```
计算机/人工智能/Python GIL.md   →   /n/python-gil/
```

因为知识库自己就说「归类放错了 `git mv` 一下即可，双链只写文件名、与路径无关」。
URL 遵守同一条，把笔记挪到别的领域，外链不会断。

`aliases` 里的每个名字还会额外生成一个 `noindex` 的跳转页，所以**改名也不断链** ——
而「合并笔记时把被删那篇的标题加进 `aliases`」本来就是知识库的规矩，
那条规则在这里直接变成了外链保护。

## 搭一套属于自己的自动化 Blog

前置：Node 22、一个 GitHub 账号、一个用 Obsidian（或任何纯 Markdown 编辑器）写的笔记目录。

**1. 两个仓库。** 一个放笔记（可以是 private，但那样 CI 里 clone 需要额外凭证），
一个放站点，也就是 fork 或 clone 本仓库。站点仓库命名成 `<你的用户名>.github.io`
就能拿到根域名。

**2. 改站点身份。** 「我是谁」只硬编码在这几个地方：

| 文件 | 改什么 |
| --- | --- |
| `src/config/site.ts` | 站点名、作者、URL、简介、首页标语、关于页时间线、每页篇数 |
| `astro.config.mjs` | 顶部的 `site: 'https://...'`（RSS 和 sitemap 要用绝对地址） |
| `src/assets/avatar.jpg` | 换掉这一张就行 —— 页头 30px、关于页 88px、favicon 64px、apple-touch-icon 180px、分享图 512px 全部构建时自动派生 |

**3. 让 CI 拉你的 vault。** 改 `.github/workflows/deploy.yml` 里那行 clone 地址：

```yaml
- name: 拉取知识库
  run: git clone --depth 1 https://github.com/<你>/<你的笔记仓库>.git notes
```

笔记仓库是公开的话，这一步**不需要任何凭证**，匿名 clone 即可。

**4. 在笔记仓库装门铃。** 新建 `.github/workflows/notify-blog.yml`：

```yaml
name: 通知博客重建
on:
  push:
    branches: [main]
    paths: ['计算机/**', '附件/**']   # 换成你自己的正式笔记目录
permissions: {}
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -f -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer ${{ secrets.BLOG_DISPATCH_TOKEN }}" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/<你>/<你>.github.io/dispatches \
            -d '{"event_type":"notes-updated"}'
```

`paths` 过滤是有意的：草稿提交不该触发重新部署 —— 捕获不是知识库的结构性变更。

**5. 配一个 token。** 建一个 **fine-grained PAT**，仓库范围只勾站点仓库，权限只给
**Contents: Read and write**（`repository_dispatch` 归在 Contents 下），存进笔记仓库的
Secrets，名字 `BLOG_DISPATCH_TOKEN`。

> [!NOTE]
> PAT 只用在「笔记 → 博客」这个方向，权限面小得多；反方向的 clone 是匿名的。
> fine-grained PAT 有有效期，过期后门铃会静默失灵 —— 上面那条每周 cron 就是为此存在的兜底。

**6. 打开 Pages。** 站点仓库 Settings → Pages → Source 选 **GitHub Actions**（不是 Deploy from a branch）。

**7. 本地跑起来。**

```bash
npm install
npm run link:notes    # 建立 notes -> ../jory-notes 的符号链接
npm run dev
```

`link:notes` 里的路径按你的目录结构改。在 Obsidian 里写笔记，浏览器实时热更新。
不想建符号链接就直接指过去：

```bash
NOTES_DIR=/path/to/your/vault npm run dev
```

## 你的 vault 不长这样怎么办

管道对知识库的约定就下面这几条，都集中在两个文件里，改起来是分钟级的事：

| 约定 | 现在的值 | 在哪改 |
| --- | --- | --- |
| 什么算一篇笔记 | `*/*/*.md`（恰好三段路径） | `src/lib/vault.mjs` 的 `NOTE_GLOB` |
| 附件目录 | `附件/` | `src/lib/vault.mjs` 的 `ATTACH_DIRNAME`、`astro.config.mjs` 的同步插件 |
| 允许的 frontmatter 键 | `tags` `aliases` `created` `updated` | `src/lib/validate.mjs` 的 `ALLOWED_FRONTMATTER` |
| 分类标签 | `类型/{概念,实践,排错,速查}`，每篇恰好一个 | `src/lib/validate.mjs` 的 `KINDS` |
| 摘要来源 | frontmatter 之后的第一个引用块（「一句话结论」） | `src/lib/vault.mjs` 的 `extractLede` |

用扁平结构（`笔记/xxx.md`）就把 glob 改成两段；不写「一句话结论」就让 `extractLede`
回落到正文首段。**校验规则不想要，`BLOG_STRICT=0` 一律降级成警告。**

## 构建期校验

管道本来就要解析全库笔记，顺手把知识库的规则接上去，违规在构建时就拦住，
而不是等你半年后翻到那篇笔记才发现：

| 级别 | 检查 | 行为 |
| --- | --- | --- |
| 致命 | 笔记重名、别名冲突、slug 撞车 | **中断**。这类问题会让 `[[双链]]` 指向错误的笔记，不能放行 |
| 错误 | frontmatter 出现第五个键、`类型/*` 不在封闭集内或数量 ≠ 1 | 中断（`BLOG_STRICT=0` 降级为警告） |
| 警告 | 缺一句话结论、正文有 H1、附件缺失、日期非法、笔记过短/过长 | 只报告，不拦 |

## 站点里有什么

`[[双链]]`（含 `[[笔记#小节]]`、`[[笔记|别名显示]]`、命中 aliases）、**反链**、
`![[附件]]` 图片、按领域分类页、分页、纯前端搜索（标题 + 别名 + 领域）、
RSS、sitemap、明暗主题、404。

未命中的 `[[X]]` **不生成链接** —— 知识库的规则里，悬空双链是有意的待写标记，
把它渲染成 404 链接等于把设计意图变成 bug。

## 目录

```
src/
├─ lib/              管道层 —— 设计工作不碰这里
│   ├─ vault.mjs        扫盘、解析 frontmatter、摘导语、建链接图
│   ├─ link-index.mjs   笔记名/别名/附件 → URL 的全局解析表
│   ├─ slug.mjs         文件名 → slug
│   ├─ validate.mjs     把知识库的「体检」变成构建期关卡
│   └─ notes.ts         页面用的查询与排序
├─ plugins/          管道层
│   ├─ remark-wikilink.mjs   [[双链]]、![[附件]]、悬空链接
│   └─ rehype-polish.mjs     表格滚动容器、标题锚点
├─ content.config.ts  自定义 Astro loader，串起「扫盘 → 渲染 → 反链」三趟
│
├─ styles/           设计层
│   ├─ tokens.css       设计令牌（唯一真相来源）
│   ├─ global.css       页头/页脚/列表/分页
│   ├─ prose.css        正文排版
│   └─ components.css   Badge / Button / CategoryTab
├─ layouts/ components/ pages/   设计层
└─ config/site.ts     站点身份：简介、时间线、每页篇数
```

`lib/` + `plugins/` 是管道，`styles/` + `layouts/` + `components/` 是设计。
改版式只动后者，怎么改都碰不坏双链解析和构建校验。

<details>
<summary>为什么 markdown 处理器显式切回 unified</summary>

Astro 7 默认换成了 Rust 写的处理器，它不跑 remark/rehype 插件 —— 用的是自己的 AST。
双链插件要把**一个 text 节点拆成多个节点**（链接 + 普通文本 + 待写 span），是结构性改写，
而新处理器的插件 API 是按节点类型就地访问的访问器，能不能做节点替换没有文档保证。
几百篇笔记的构建速度差异可以忽略，拿确定性换速度不划算。见 `astro.config.mjs`。

</details>

## 授权与内容

管道代码采用 [MIT](LICENSE) —— 随便拿去用、改、商用，照抄整套也没问题，保留版权声明即可。

笔记正文不在这里，在 [vimself/jory-notes](https://github.com/vimself/jory-notes)，
按 [CC BY 4.0](https://github.com/vimself/jory-notes/blob/main/LICENSE) 单独授权（转载注明出处）。
那边的 README 和 `CLAUDE.md` 也是公开的 —— 收录判据、目录结构、查重与体检流程都写在里面，
和这条管道是配套的一半。
