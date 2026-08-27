import type { APIRoute } from 'astro';
import { allNotes, data, fmtDate } from '../lib/notes';

/**
 * 搜索索引。
 *
 * 设计稿的搜索是「标题与分类」的子串匹配 —— 保留这个取向（即时、零依赖、无需构建后处理），
 * 但把 **aliases 也纳入匹配范围**：知识库里 aliases 存的就是「以后可能用来搜它的所有叫法」
 * （中文名、英文名、缩写），不拿来搜就浪费了。同时带上 lede 做结果摘要。
 *
 * 几百篇笔记的索引也就几十 KB，一次请求缓存住，之后每次按键都是本地过滤。
 * 以后想要全文搜索，可以在构建后加一层 Pagefind（它对中文分词是零配置的），
 * 那时把这个文件退化成 fallback 即可。
 */
export const GET: APIRoute = async () => {
  const notes = await allNotes();
  const payload = notes.map((n) => {
    const d = data(n);
    return {
      t: d.name,
      u: d.url,
      c: d.domain,
      k: d.kind,
      a: d.aliases,
      g: d.topics,
      l: d.lede,
      d: fmtDate(d.updated),
    };
  });
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
