/**
 * rehype 插件：补三件设计稿需要、而 markdown 默认不给的东西。
 *
 * 1. 表格套一层可横向滚动的容器。速查类笔记基本都是宽表格，
 *    不套的话窄屏会把整个页面撑出横向滚动条。
 * 2. H2/H3 生成锚点 id 并挂上锚链接。
 * 3. 代码块套一层外壳，放语言标签和复制按钮。
 *
 * 关于 id：**必须自己算，不能依赖 Astro 生成的那个**。
 * Astro 的标题 id 是在用户 rehype 插件之后才加的，这里根本读不到；
 * 更要紧的是 [[笔记#小节]] 里的锚点由 slugifyHeading 计算，
 * 两边算法一旦不一致，跨笔记的小节跳转会静默失效。
 * 统一用同一个函数，两边永远对得上。
 */

import { visit, SKIP } from 'unist-util-visit';
import { slugifyHeading } from '../lib/slug.mjs';

function textOf(node) {
  if (node.type === 'text') return node.value;
  if (!node.children) return '';
  return node.children.map(textOf).join('');
}

/** 无意义的语言名：这些不显示标签，和设计图里那个 curl 示例一致 */
const PLAIN = new Set(['', 'text', 'plaintext', 'plain', 'txt', 'ansi']);

/**
 * 取代码块的语言。
 *
 * 两种形状都认：本插件和 Astro 的 shiki 谁先跑没有文档保证，
 * shiki 跑过是 `<pre data-language="java">`，没跑过是 `<code class="language-java">`。
 * 认两种，顺序就无关紧要了。
 */
function langOf(pre) {
  const attr = pre.properties?.dataLanguage;
  if (typeof attr === 'string' && attr) return attr.toLowerCase();

  const code = pre.children?.find((c) => c.tagName === 'code');
  const cls = code?.properties?.className;
  const list = Array.isArray(cls) ? cls : typeof cls === 'string' ? cls.split(/\s+/) : [];
  const hit = list.find((c) => typeof c === 'string' && c.startsWith('language-'));
  return hit ? hit.slice('language-'.length).toLowerCase() : '';
}

function icon(className, children) {
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      className: [className],
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      ariaHidden: 'true',
    },
    children,
  };
}

const el = (tagName, properties) => ({ type: 'element', tagName, properties, children: [] });

/**
 * 复制按钮。两个图标都渲染出来，靠 CSS 切换 ——
 * 点击后要换成对勾，如果那时才建 DOM，图标会闪一下才出现。
 */
function copyButton() {
  return {
    type: 'element',
    tagName: 'button',
    properties: {
      type: 'button',
      className: ['code-block__copy'],
      'data-copy': '',
      ariaLabel: '复制代码',
    },
    children: [
      icon('code-block__icon--copy', [
        el('rect', { x: '8', y: '8', width: '14', height: '14', rx: '2' }),
        el('path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }),
      ]),
      icon('code-block__icon--done', [
        el('polyline', { points: '20 6 9 17 4 12' }),
      ]),
    ],
  };
}

export default function rehypePolish() {
  return (tree) => {
    // ── 表格滚动容器 ──
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table' || !parent || index === null || index === undefined) return;
      const cls = parent.properties?.className;
      if (Array.isArray(cls) && cls.includes('table-scroll')) return;

      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-scroll'] },
        children: [node],
      };
      return [SKIP, index + 1];
    });

    // ── 标题 id 与锚点 ──
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'h2' && node.tagName !== 'h3') return;

      const id = slugifyHeading(textOf(node));
      if (!id) return;
      node.properties = { ...(node.properties ?? {}), id };

      node.children.unshift({
        type: 'element',
        tagName: 'a',
        properties: {
          className: ['heading-anchor'],
          href: `#${id}`,
          ariaHidden: 'true',
          tabIndex: -1,
        },
        children: [{ type: 'text', value: '#' }],
      });
    });

    // ── 代码块外壳 ──
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === null || index === undefined) return;
      const cls = parent.properties?.className;
      if (Array.isArray(cls) && cls.includes('code-block')) return;

      const lang = langOf(node);
      const labelled = !PLAIN.has(lang);

      const children = [];
      if (labelled) {
        children.push({
          type: 'element',
          tagName: 'span',
          properties: { className: ['code-block__lang'] },
          children: [{ type: 'text', value: lang }],
        });
      }
      children.push(copyButton(), node);

      parent.children[index] = {
        type: 'element',
        tagName: 'figure',
        properties: {
          className: ['code-block'],
          // 标签占掉一行高度，padding 要跟着变，交给 CSS 按这个属性判断
          ...(labelled ? { 'data-lang': lang } : {}),
        },
        children,
      };
      return [SKIP, index + 1];
    });
  };
}
