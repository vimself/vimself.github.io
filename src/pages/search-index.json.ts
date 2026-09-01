import type { APIRoute } from 'astro';
import { allNotes, data, fmtDate } from '../lib/notes';

/**
 * 搜索索引。
 *
 * 设计稿的搜索是「标题与分类」的子串匹配 —— 保留这个取向（即时、零依赖、无需构建后处理），
 * 但把 **aliases 也纳入匹配范围**：知识库里 aliases 存的是同一个概念的别的叫法
 * （中文名、英文名、缩写、合并掉的旧标题），按哪个搜都该命中同一篇。同时带上 lede 做结果摘要。
 *
 * 别把这里当全文搜索的替代：aliases 不是关键词表，正文里的 API 名、命令、子话题
 * 一律不进 aliases（知识库那边明确禁了），所以按这些词搜是搜不到的。
 *
 * 几百篇笔记的索引也就几十 KB，一次请求缓存住，之后每次按键都是本地过滤。
 * 真要全文搜索，在构建后加一层 Pagefind（它对中文分词是零配置的），
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
