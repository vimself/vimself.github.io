# vimself.github.io

[Vimself](https://vimself.github.io) 的站点源码。内容不在这里 —— 它是
[vimself/jory-notes](https://github.com/vimself/jory-notes) 那个 Obsidian 知识库，
每次构建时现拉现渲染。

## 它是怎么跑起来的

```
本地 Obsidian vault
      │ git push
      ▼
vimself/jory-notes ──── workflow 敲门铃 (repository_dispatch) ────┐
   纯内容，没有一行站点代码                                        │
                                                                 ▼
                                                    vimself.github.io
                                                    ① clone 知识库到 ./notes
                                                    ② astro build（全量重渲染）
                                                    ③ deploy 到 GitHub Pages
```

**方向是「博客拉」，不是「笔记推转换好的 markdown」。** 这样不产生任何中间提交：
没有生成物入库，也就没有生成物与源文件漂移、没有合并冲突、没有「改了转换逻辑要回头重跑全库」。
每次都是从 vault 全量重建，天然幂等。改版式只要在这个仓库提一次 commit，全站自动重渲染。

## 发布范围

由**路径**决定，不由 frontmatter 决定。

知识库的规则把 frontmatter 锁死在四个键（`tags`/`aliases`/`created`/`updated`），
"一个都不多"，所以博客不能要求笔记新增 `publish`、`draft`、`title` 之类的字段。
好在它同时规定了「笔记路径恒为三段」，`学科/领域/笔记.md` 这个三段 glob 就是
「什么算一篇笔记」的唯一判据 —— `草稿箱/`、`模板/`、`日志/`、`附件/` 都只有两段，天然落选。

于是：**三段路径 = 发布，其余一律不发布。写作流程一个新步骤都不用加。**

## URL

只由文件名决定，与 `学科/领域` 无关：

```
计算机/人工智能/Python GIL.md   →   /n/python-gil/
```

因为知识库自己就说「归类放错了 `git mv` 一下即可，双链只写文件名、与路径无关」。
URL 遵守同一条，把笔记挪到别的领域外链不会断。

`aliases` 里的每个名字会额外生成一个跳转页，所以改名也不断链 ——
而「合并」流程本来就要求把被删那篇的标题加进 `aliases`，那条规则在这里直接变成了外链保护。

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
├─ content.config.ts  自定义 Astro loader，串起上面三趟
│
├─ styles/           设计层 —— 来自 Claude Design
│   ├─ tokens.css       设计令牌（唯一真相来源）
│   ├─ global.css       页头/页脚/列表/分页
│   ├─ prose.css        正文排版
│   └─ components.css   Badge / Button / CategoryTab
├─ layouts/ components/ pages/   设计层
└─ config/site.ts     站点身份：简介、时间线、每页篇数
```

`lib/` + `plugins/` 是管道，`styles/` + `layouts/` + `components/` 是设计。
改版式只动后者，怎么改都碰不坏双链解析和构建校验。

## 构建期校验

管道本来就要解析全库笔记，顺手把知识库的规则接上去，违规在构建时就拦住：

| 级别 | 检查 | 行为 |
| --- | --- | --- |
| 致命 | 笔记重名、别名冲突、slug 撞车 | **中断**。这类问题会让 `[[双链]]` 指向错误的笔记 |
| 错误 | frontmatter 出现第五个键、`类型/*` 不在四值封闭集内或数量 ≠ 1 | 中断（`BLOG_STRICT=0` 可降级） |
| 警告 | 缺一句话结论、正文有 H1、附件缺失、日期非法、笔记过短/过长 | 只报告，不拦 |

## 头像 / logo

源文件一张：`src/assets/avatar.jpg`。换头像只替换它，下面五个尺寸构建时自动派生 ——
页头 30px（含 2x）、关于页 88px（含 2x）、favicon 64px、apple-touch-icon 180px、
分享图 512px。放在 `src/assets/` 而不是 `public/` 就是为了走这套优化：
原图 434 KB，页头实际只加载 502 B 的 WebP。

文件缺失时会回落到 `public/avatar.svg` 占位图，构建不会中断。

## 本地开发

```bash
npm install
npm run link:notes    # 建立 notes -> ../jory-notes 的符号链接
npm run dev
```

在 Obsidian 里写笔记，浏览器实时热更新。

指向别处的 vault：`NOTES_DIR=/path/to/vault npm run dev`

## 部署

`main` 分支推送、`jory-notes` 的 dispatch、手动触发、每周兜底 cron，
四个入口都会跑同一个全量构建。Pages 的 Source 需要在仓库设置里选 **GitHub Actions**。
