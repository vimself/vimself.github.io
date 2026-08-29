// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

import remarkWikilink from './src/plugins/remark-wikilink.mjs';
import rehypePolish from './src/plugins/rehype-polish.mjs';
import { codeThemeLight, codeThemeDark } from './src/lib/code-theme.mjs';

const NOTES_DIR = path.resolve(process.env.NOTES_DIR || './notes');

/**
 * 附件同步。
 *
 * 知识库把图片平铺在 附件/ 下，而 Astro 只从 public/ 取静态资源，
 * 且 vault 在项目之外（本地是符号链接，CI 里是 clone）。
 * 所以在配置阶段把 附件/ 镜像进 public/attachments/ —— 早于一切构建步骤，顺序确定。
 * public/attachments 已进 .gitignore，它是产物不是源文件。
 */
function syncAttachments() {
  return {
    name: 'vault-attachments',
    hooks: {
      'astro:config:setup': ({ logger }) => {
        const from = path.join(NOTES_DIR, '附件');
        const to = path.resolve('./public/attachments');
        fs.rmSync(to, { recursive: true, force: true });
        if (!fs.existsSync(from)) {
          logger.warn(`没有找到附件目录 ${from}，跳过`);
          return;
        }
        fs.mkdirSync(to, { recursive: true });
        let n = 0;
        for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
          if (!entry.isFile() || entry.name.startsWith('.')) continue;
          fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
          n++;
        }
        logger.info(`同步了 ${n} 个附件`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://vimself.github.io',
  trailingSlash: 'always',
  integrations: [syncAttachments(), sitemap()],

  markdown: {
    /*
     * Astro 7 默认换成了 Rust 写的 Sätteri 处理器，它不跑 remark/rehype 插件 —— 用的是自己的 AST。
     * 这里显式切回 unified（Astro 7 仍然一等支持，只是不再是默认）。
     *
     * 为什么不移植到 Sätteri：双链插件要把**一个 text 节点拆成多个节点**
     * （链接 + 普通文本 + 待写 span），是结构性改写；Sätteri 的插件 API 是按节点类型
     * 就地访问的访问器，能不能做节点替换没有文档保证。几百篇笔记的构建速度差异可以忽略，
     * 拿确定性换速度不划算。
     */
    processor: unified({
      remarkPlugins: [remarkWikilink],
      rehypePlugins: [rehypePolish],
      gfm: true,
      // 技术笔记里出现裸 -- 和引号的机会不少，不做智能标点替换，保持字面
      smartypants: false,
    }),
    shikiConfig: {
      /*
       * 双主题。亮色照着设计图配（见 src/lib/code-theme.mjs），深色是同一份
       * 作用域表换一套配色。Shiki 把深色值写成行内变量 --shiki-dark，
       * 由 prose.css 在 [data-theme='dark'] 下整体切过去 ——
       * 纯 CSS，跟首屏那段主题脚本一样不产生闪烁。
       * 两个主题自带的背景都不用，底色统一由 --code-bg 覆盖。
       */
      themes: { light: codeThemeLight, dark: codeThemeDark },
      wrap: false,
    },
  },

  vite: {
    server: {
      // notes/ 通常是指向 ../jory-notes 的符号链接，dev 下要允许读到项目外
      fs: { allow: ['..'] },
    },
  },
});
