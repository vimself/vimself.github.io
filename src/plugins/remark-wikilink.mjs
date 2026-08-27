/**
 * remark 插件：把 Obsidian 的 [[双链]] 和 ![[附件]] 转成真实 HTML。
 *
 * 支持的写法
 *   [[Python GIL]]            → 链接，文本取笔记名
 *   [[Python GIL|它]]         → 链接，文本取竖线后的部分
 *   [[Python GIL#为什么存在]]  → 链接到该笔记的小节锚点
 *   [[全局解释器锁]]           → 命中 aliases，落到笔记的正式 URL
 *   ![[GIL-示意图.png]]        → 图片
 *   ![[某笔记]]                → 不展开转写，降级成普通链接
 *
 * 最关键的一条：**未命中的 [[X]] 不生成链接。**
 * 知识库的规则里写着「不建空的占位笔记 —— 留一个悬空双链就够，它会出现在
 * Obsidian 的未解析链接面板里当待办」。悬空双链是有意的待写标记，
 * 把它渲染成 404 链接，等于把设计意图变成 bug。
 *
 * 只遍历 text 节点，所以代码块（code）和行内代码（inlineCode）里的
 * [[不该被转换]] 会原样保留 —— 它们的内容不是 text 节点。
 */

import { visit, SKIP } from 'unist-util-visit';
import { resolveName, resolveAttachment } from '../lib/link-index.mjs';
import { slugifyHeading } from '../lib/slug.mjs';

const WIKILINK = /(!?)\[\[([^[\]|#]+)(#[^[\]|]+)?(?:\|([^[\]]+))?\]\]/g;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNodes(value) {
  const out = [];
  let last = 0;
  let matched = false;

  WIKILINK.lastIndex = 0;
  let m;
  while ((m = WIKILINK.exec(value)) !== null) {
    matched = true;
    const [full, bang, rawTarget, rawHash, rawDisplay] = m;

    if (m.index > last) {
      out.push({ type: 'text', value: value.slice(last, m.index) });
    }
    last = m.index + full.length;

    const target = rawTarget.trim();
    const hash = rawHash ? rawHash.slice(1).trim() : '';
    const display = (rawDisplay ?? '').trim();
    const isEmbed = bang === '!';

    // ── ![[图片]] ──
    if (isEmbed && IMAGE_EXT.test(target)) {
      const url = resolveAttachment(target);
      if (url) {
        out.push({ type: 'image', url, alt: display || target, title: null });
      } else {
        // 附件缺失时给一个醒目占位，绝不静默输出一张坏图
        out.push({
          type: 'html',
          value: `<span class="img-missing">附件缺失：${escapeHtml(target)}</span>`,
        });
      }
      continue;
    }

    const hit = resolveName(target);
    const label = display || (hash && !display ? `${target} § ${hash}` : target);

    // ── 未命中：待写标记，不是链接 ──
    if (!hit) {
      out.push({
        type: 'html',
        value:
          `<span class="wl-todo" data-wikilink-missing="${escapeHtml(target)}"` +
          ` title="这篇还没写">${escapeHtml(label)}</span>`,
      });
      continue;
    }

    // ── ![[某笔记]] 转写：不展开正文，降级成普通链接 ──
    // 知识库规则「同一概念全库只在一处展开」，所以转写基本不会出现；
    // 真出现了也不能把整篇内容内联进来，那会制造重复内容。
    const href = hash ? `${hit.url}#${slugifyHeading(hash)}` : hit.url;
    out.push({
      type: 'html',
      value:
        `<a class="wikilink" href="${escapeHtml(href)}"` +
        ` data-wikilink="${escapeHtml(hit.name)}">${escapeHtml(label)}</a>`,
    });
  }

  if (!matched) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}

export default function remarkWikilink() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;
      // 已经在链接内部的文本不再处理，避免嵌套出 <a> 里套 <a>
      if (parent.type === 'link' || parent.type === 'linkReference') return;
      if (!node.value.includes('[[')) return;

      const nodes = buildNodes(node.value);
      if (!nodes) return;

      parent.children.splice(index, 1, ...nodes);
      return [SKIP, index + nodes.length];
    });
  };
}
