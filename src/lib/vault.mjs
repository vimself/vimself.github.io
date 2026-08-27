/**
 * 知识库读取管道。
 *
 * 输入：NOTES_DIR 指向的 Obsidian vault（本地是 ../jory-notes 的符号链接，CI 里是 clone 出来的目录）
 * 输出：一组类型化的 Note，交给 Astro content collection
 *
 * ─── 发布范围由路径决定，不由 frontmatter 决定 ───
 * 知识库的规则写死了「frontmatter 恰好四个键，一个都不多」，所以博客**不能**要求
 * 笔记新增 publish / draft / title / description 之类的字段。
 * 好在它同时规定了「笔记路径恒为三段」，而「学科/领域/笔记.md」这个三段 glob 就是
 * 「什么算一篇笔记」的唯一判据 —— 草稿箱/、模板/、日志/、附件/ 全是两段路径，
 * 天然落选。于是发布范围 = 三段路径白名单，写作流程一个新步骤都不用加。
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { glob } from 'tinyglobby';
import matter from 'gray-matter';

import { slugify, normalizeKey } from './slug.mjs';
import { resetIndex, registerName, registerAttachment, linkIndex } from './link-index.mjs';
import { validateNote, reportValidation } from './validate.mjs';

export const NOTES_DIR = path.resolve(process.env.NOTES_DIR || './notes');
export const ATTACH_DIRNAME = '附件';
export const ATTACH_BASE = '/attachments';

// 只认恰好三段的路径 —— 与知识库 CLAUDE.md 里那条「三段 glob」判据完全一致
const NOTE_GLOB = '*/*/*.md';

/** 类型/* 是封闭集合，只有这四个值，规则里写明「永不新增」 */
export const KINDS = ['概念', '实践', '排错', '速查'];

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTags(tags) {
  const list = Array.isArray(tags) ? tags : tags ? [tags] : [];
  const kinds = [];
  const topics = [];
  const other = [];
  for (const raw of list) {
    const t = String(raw).trim();
    if (t.startsWith('类型/')) kinds.push(t.slice(3));
    else if (t.startsWith('技术/')) topics.push(t.slice(3));
    else other.push(t);
  }
  return { kinds, topics, other };
}

/**
 * 摘出「一句话结论」。
 *
 * 知识库规定：不写 H1（文件名即标题），frontmatter 之后第一行是引用块形式的一句话结论。
 * 把它从正文里摘出来单独存，好处是它同时能当 meta description、列表页摘要、
 * 卡片文案、RSS 描述 —— 全站到处要一句人写的摘要，而这已经是写作规范的一部分了，
 * 一个字都不用额外写。
 */
function extractLede(body) {
  const lines = body.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length || !/^\s*>/.test(lines[i])) {
    return { lede: '', rest: body, hasLede: false };
  }
  const start = i;
  const parts = [];
  while (i < lines.length && /^\s*>/.test(lines[i])) {
    parts.push(lines[i].replace(/^\s*>\s?/, ''));
    i++;
  }
  const rest = [...lines.slice(0, start), ...lines.slice(i)].join('\n');
  return { lede: parts.join(' ').trim(), rest, hasLede: true };
}

/** 导语用于 meta / 卡片，去掉 markdown 记号，[[双链]] 只留显示文本 */
export function toPlainText(md) {
  return String(md ?? '')
    .replace(/!?\[\[([^[\]|#]+)(?:#[^[\]|]+)?(?:\|([^[\]]+))?\]\]/g, (_, t, d) => d || t)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function collectAttachments() {
  const dir = path.join(NOTES_DIR, ATTACH_DIRNAME);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && !e.name.startsWith('.')).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * 第 1 趟：扫盘、解析 frontmatter、建双链解析表。
 * 必须整体先跑完再渲染 —— 渲染第一篇时就可能出现指向最后一篇的双链。
 */
export async function loadVault({ logger } = {}) {
  const log = logger ?? console;
  resetIndex();

  const files = (await glob(NOTE_GLOB, { cwd: NOTES_DIR, absolute: false })).sort();

  for (const name of await collectAttachments()) {
    registerAttachment(name, `${ATTACH_BASE}/${encodeURIComponent(name)}`);
  }

  const notes = [];
  const issues = [];

  for (const rel of files) {
    const abs = path.join(NOTES_DIR, rel);
    const raw = await fs.readFile(abs, 'utf8');
    const { data: fm, content } = matter(raw);

    const segments = rel.split('/');
    const [discipline, domain, filename] = segments;
    const name = filename.replace(/\.md$/, '');
    const slug = slugify(name);
    const url = `/n/${slug}/`;

    const { kinds, topics, other } = parseTags(fm.tags);
    const aliases = (Array.isArray(fm.aliases) ? fm.aliases : fm.aliases ? [fm.aliases] : [])
      .map((a) => String(a).trim())
      .filter(Boolean);
    const { lede, rest, hasLede } = extractLede(content);

    const note = {
      file: rel,
      abs,
      name,
      slug,
      url,
      discipline,
      domain,
      kind: kinds[0] ?? null,
      kinds,
      topics,
      aliases,
      created: toDate(fm.created),
      updated: toDate(fm.updated) ?? toDate(fm.created),
      lede: toPlainText(lede),
      hasLede,
      bodyLines: content.split(/\r?\n/).length,
      body: rest,
      frontmatterKeys: Object.keys(fm),
      extraTags: other,
    };

    issues.push(...validateNote(note));

    registerName(name, { url, slug, isAlias: false, file: rel });
    for (const alias of aliases) {
      registerName(alias, { url, slug, isAlias: true, file: rel });
    }
    notes.push(note);
  }

  // slug 撞车：两个不同的文件名可能归一化成同一个 slug（比如 "Foo Bar" 和 "Foo-Bar"）。
  // 不拦的话它们会争抢同一个 URL，Astro 会抛一个跟根因毫无关系的重复路由错误。
  const bySlug = new Map();
  for (const n of notes) {
    if (bySlug.has(n.slug)) {
      linkIndex.conflicts.push({ name: n.slug, kind: 'note', a: bySlug.get(n.slug), b: n.file });
    } else {
      bySlug.set(n.slug, n.file);
    }
  }

  linkIndex.ready = true;
  reportValidation({ issues, conflicts: linkIndex.conflicts, count: notes.length, log });
  return notes;
}

/**
 * 第 3 趟：反链。
 * 双链图在渲染时已经建好了 —— remark 插件给每个命中的链接打了 data-wikilink，
 * 这里把渲染结果扫一遍反转即可。对 wiki 来说反链是刚需，而这一步几乎白送。
 */
export function buildGraph(notes, htmlByFile) {
  const byName = new Map(notes.map((n) => [normalizeKey(n.name), n]));
  const outMap = new Map();
  const missMap = new Map();

  for (const note of notes) {
    const html = htmlByFile.get(note.file) ?? '';
    const out = new Set();
    const miss = new Set();

    for (const m of html.matchAll(/data-wikilink="([^"]*)"/g)) {
      const hit = byName.get(normalizeKey(decodeHtml(m[1])));
      if (hit && hit.file !== note.file) out.add(hit.file);
    }
    for (const m of html.matchAll(/data-wikilink-missing="([^"]*)"/g)) {
      miss.add(decodeHtml(m[1]));
    }
    outMap.set(note.file, out);
    missMap.set(note.file, [...miss]);
  }

  const backMap = new Map(notes.map((n) => [n.file, new Set()]));
  for (const [from, targets] of outMap) {
    for (const to of targets) backMap.get(to)?.add(from);
  }

  return { outMap, backMap, missMap };
}

function decodeHtml(s) {
  return String(s)
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
