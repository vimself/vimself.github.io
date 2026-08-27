/**
 * 文件名 → URL slug
 *
 * 知识库的规则里写着：「归类放错了 git mv 一下即可，双链只写文件名、与路径无关」。
 * URL 遵守同一条：**只由文件名决定，与 <学科>/<领域> 无关**。
 * 于是把笔记从「网络与协议」挪到「软件设计」，外链不会断。
 *
 * 纯函数、无依赖、不转拼音 —— 转拼音会引入不稳定性（同音字、多音字）
 * 和一个中文分词依赖，收益只是 URL 变成 ASCII，不值。
 * 中文字符原样留在 URL 里，浏览器地址栏正常显示，线上走 percent-encoding。
 *
 *   Python GIL       → python-gil
 *   HTTP 缓存        → http-缓存
 *   Docker 分层存储  → docker-分层存储
 */

// 会破坏 URL 结构的字符（其中大部分知识库本来就禁止出现在文件名里）
const BREAKS_URL = /[\/\\:*?"<>|#^[\]%`{}]/g;

// 中文标点：留在 URL 里既难看又容易被各种工具转义，去掉
const CJK_PUNCT = /[，。、！？：；''""《》（）【】〔〕〈〉·…—～]/g;

// 西文标点里对可读性没贡献的
const ASCII_PUNCT = /[,;!？'"“”‘’@$&=]/g;

export function slugify(input) {
  return String(input ?? '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(BREAKS_URL, '')
    .replace(CJK_PUNCT, '')
    .replace(ASCII_PUNCT, '')
    .replace(/[\s_]+/g, '-')   // 空白与下划线统一成连字符
    .replace(/\.+$/g, '')      // 结尾的点在某些文件系统/服务器上有坑
    .replace(/-{2,}/g, '-')    // 折叠连续连字符
    .replace(/^-+|-+$/g, '');  // 去掉首尾连字符
}

/** 标题锚点用同一套规则，保证 [[笔记#小节]] 能落到正确的 id 上 */
export const slugifyHeading = slugify;

/** 归一化的匹配键：大小写不敏感，这样 [[gil]] 也能命中 GIL */
export function normalizeKey(input) {
  return String(input ?? '').normalize('NFC').trim().toLowerCase();
}
