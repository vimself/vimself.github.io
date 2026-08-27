/**
 * rehype 插件：补两件设计稿需要、而 markdown 默认不给的东西。
 *
 * 1. 表格套一层可横向滚动的容器。速查类笔记基本都是宽表格，
 *    不套的话窄屏会把整个页面撑出横向滚动条。
 * 2. H2/H3 生成锚点 id 并挂上锚链接。
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
  };
}
