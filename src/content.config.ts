import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { loadVault, buildGraph, NOTES_DIR } from './lib/vault.mjs';

/**
 * 自定义 content loader —— 唯一负责「vault → 类型化笔记 + 渲染好的 HTML」的地方。
 *
 * 为什么不用现成的 glob() loader：
 * 反链、导语、待写清单这些派生字段必须进 entry.data，索引页才能不二次扫盘就用上。
 * glob() 只认 frontmatter，而知识库的 frontmatter 被规则锁死在四个键 ——
 * 想要的东西一个都不在里面，只能自己算。
 *
 * 三趟，顺序不能变：
 *   1. 扫全库、建双链解析表  （渲染第一篇时就可能出现指向最后一篇的链接）
 *   2. 逐篇渲染             （remark 插件此时才能解析出正确的 [[双链]]）
 *   3. 反转链接图得到反链
 */
const vaultLoader: Loader = {
  name: 'vault-loader',
  async load({ store, renderMarkdown, logger, watcher }) {
    store.clear();

    // ── 第 1 趟 ──
    const notes = await loadVault({ logger });

    // ── 第 2 趟 ──
    // 必须串行 await：remark 插件通过共享索引记录本次渲染的出链，
    // 并行会让不同文件的渲染互相穿插。全库几百篇也就几百毫秒，不值得优化。
    const rendered = new Map<string, Awaited<ReturnType<typeof renderMarkdown>>>();
    const htmlByFile = new Map<string, string>();
    for (const note of notes) {
      const out = await renderMarkdown(note.body);
      rendered.set(note.file, out);
      htmlByFile.set(note.file, out.html ?? '');
    }

    // ── 第 3 趟 ──
    const { backMap, missMap } = buildGraph(notes, htmlByFile);
    const byFile = new Map(notes.map((n) => [n.file, n]));

    const brief = (n: (typeof notes)[number]) => ({
      name: n.name,
      url: n.url,
      slug: n.slug,
      lede: n.lede,
      domain: n.domain,
    });

    for (const note of notes) {
      const backlinks = [...(backMap.get(note.file) ?? [])]
        .map((f) => byFile.get(f))
        .filter(Boolean)
        .map((n) => brief(n!))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh'));

      store.set({
        id: note.slug,
        data: {
          file: note.file,
          name: note.name,
          slug: note.slug,
          url: note.url,
          discipline: note.discipline,
          domain: note.domain,
          kind: note.kind,
          topics: note.topics,
          aliases: note.aliases,
          created: note.created,
          updated: note.updated,
          lede: note.lede,
          backlinks,
          unresolved: missMap.get(note.file) ?? [],
        },
        rendered: rendered.get(note.file),
      });
    }

    // dev 模式下监听 vault，改完笔记浏览器直接热更新
    watcher?.add(NOTES_DIR);
  },
};

export const collections = {
  notes: defineCollection({ loader: vaultLoader }),
};
