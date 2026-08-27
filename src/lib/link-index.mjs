/**
 * 全局双链解析表：笔记名 / 别名 / 附件名 → URL
 *
 * 为什么挂在 globalThis 上而不是普通模块级变量：
 * 这张表由 content.config.ts 里的 loader 填充，由 astro.config.mjs 里注册的
 * remark 插件读取。这两处属于 Vite 的不同模块图，普通模块级单例有可能被实例化两次
 * （一次给 config，一次给 content），那样插件读到的就是一张空表，全站双链静默变成待写状态。
 * Symbol.for + globalThis 是跨模块图共享的可靠办法。
 */

import { normalizeKey } from './slug.mjs';

const KEY = Symbol.for('vimself.blog.linkIndex');

function createIndex() {
  return {
    /** 归一化名 → { name, url, slug, isAlias } */
    byKey: new Map(),
    /** 附件文件名（含扩展名，归一化） → URL */
    attachments: new Map(),
    /** 建表时发现的冲突，loader 负责决定是警告还是中断构建 */
    conflicts: [],
    ready: false,
  };
}

export const linkIndex = (globalThis[KEY] ??= createIndex());

export function resetIndex() {
  linkIndex.byKey.clear();
  linkIndex.attachments.clear();
  linkIndex.conflicts.length = 0;
  linkIndex.ready = false;
}

/**
 * 登记一个可被 [[双链]] 命中的名字。
 * canonical = 笔记本名；别名来自 frontmatter 的 aliases。
 *
 * 重名和别名冲突是**致命**的：知识库的整套去重设计就建立在「文件名全库唯一」上，
 * 一旦重名，[[X]] 指向哪一篇就是掷骰子。这里只记录冲突，由 loader 决定中断。
 */
export function registerName(name, { url, slug, isAlias = false, file }) {
  const key = normalizeKey(name);
  if (!key) return;

  const existing = linkIndex.byKey.get(key);
  // 比的是**来源文件**，不是 URL。两篇同名笔记算出来的 slug 完全一样，
  // URL 也就一样 —— 拿 URL 比永远比不出重名，而重名恰恰是最该拦的那种。
  if (existing && existing.file !== file) {
    linkIndex.conflicts.push({
      name,
      kind: isAlias || existing.isAlias ? 'alias' : 'note',
      a: existing.file,
      b: file,
    });
    // 本名优先于别名：别名撞上本名时不覆盖本名
    if (isAlias) return;
  }
  linkIndex.byKey.set(key, { name, url, slug, isAlias, file });
}

export function registerAttachment(filename, url) {
  linkIndex.attachments.set(normalizeKey(filename), url);
}

/** 解析 [[目标]]。命中返回条目，未命中返回 null —— 未命中是有意的「还没写」，不是错误。 */
export function resolveName(target) {
  return linkIndex.byKey.get(normalizeKey(target)) ?? null;
}

export function resolveAttachment(filename) {
  return linkIndex.attachments.get(normalizeKey(filename)) ?? null;
}
