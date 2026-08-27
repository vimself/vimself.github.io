import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'notes'>;

export interface NoteData {
  file: string;
  name: string;
  slug: string;
  url: string;
  discipline: string;
  domain: string;
  kind: string | null;
  topics: string[];
  aliases: string[];
  created: Date | null;
  updated: Date | null;
  lede: string;
  backlinks: { name: string; url: string; slug: string; lede: string; domain: string }[];
  unresolved: string[];
}

export const data = (n: Note) => n.data as unknown as NoteData;

/**
 * 日期格式化 —— 必须走 UTC。
 *
 * frontmatter 里的 created/updated 是纯日期（2026-08-25），YAML 会把它解析成
 * UTC 零点的 Date。若用本地时区的 getFullYear/getDate 取值，任何位于 UTC 以西的机器
 * 都会把日期减掉一天：你在本地预览看到 08-24，GitHub Actions（UTC）构建出来是 08-25。
 * 纯日期本来就没有时间分量，一律按 UTC 读回来才是原值。
 */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const p = (x: number) => String(x).padStart(2, '0');
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}`;
}

const time = (d: Date | null) => (d ? new Date(d).getTime() : 0);

let cached: Promise<Note[]> | null = null;

/**
 * 全部笔记，按 updated 倒序 —— 知识库里「更新」和「新增」同等重要，最近动过的排前面。
 *
 * 构建时缓存结果：十来个页面各自 getCollection 一次纯属重复劳动，
 * 而且知识库为空时 Astro 会为每一次调用各打印一条「collection is empty」警告 ——
 * 首次部署（还没写第一篇笔记）时刷屏，看着像出错了。
 * dev 下不缓存，否则在 Obsidian 里改了笔记浏览器不会更新。
 */
export async function allNotes(): Promise<Note[]> {
  if (import.meta.env.PROD && cached) return cached;

  const promise = getCollection('notes').then((notes) =>
    notes.sort((a, b) => {
      const diff = time(data(b).updated) - time(data(a).updated);
      return diff !== 0 ? diff : data(a).name.localeCompare(data(b).name, 'zh');
    }),
  );
  if (import.meta.env.PROD) cached = promise;
  return promise;
}

/**
 * 领域清单，按篇数排序。
 * 设计稿里那句注解说得很准：「分类不维护清单，从笔记推导。新分类 push 一篇笔记即出现，
 * 最后一篇删掉即消失。」知识库的 目录.md 预先定义了九个领域，但空领域不该出现在博客上 ——
 * 所以这里只从**实际存在的笔记**推导，和设计稿的行为完全一致。
 */
export function domainsOf(notes: Note[]) {
  const map = new Map<string, Note[]>();
  for (const n of notes) {
    const d = data(n).domain;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(n);
  }
  return [...map.entries()]
    .map(([name, items]) => ({ name, items, count: items.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** 全站待写清单：所有悬空双链，以及是谁在等它 */
export function todoOf(notes: Note[]) {
  const map = new Map<string, string[]>();
  for (const n of notes) {
    for (const t of data(n).unresolved) {
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(data(n).name);
    }
  }
  return [...map.entries()]
    .map(([name, from]) => ({ name, from, count: from.length }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

export function paginate<T>(items: T[], per: number, page: number) {
  const last = Math.max(1, Math.ceil(items.length / per));
  const current = Math.min(Math.max(1, page), last);
  const start = (current - 1) * per;
  return { slice: items.slice(start, start + per), page: current, last, start, total: items.length };
}
