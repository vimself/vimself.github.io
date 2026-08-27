/**
 * 构建期校验 —— 顺手把知识库的「体检」变成自动化关卡。
 *
 * 管道本来就要解析全库笔记，把 CLAUDE.md 里那几条硬规则接上去几乎不额外花钱，
 * 换来的是：违规在构建时就被拦住，而不是等你半年后翻到那篇笔记才发现。
 *
 * 分三级，是刻意的：
 *   fatal —— 会产生**指向错误的链接**，必须拦。重名和别名冲突属于此类：
 *             知识库整套去重设计建立在「文件名全库唯一」上，一旦重名，
 *             [[X]] 落到哪一篇就是掷骰子。
 *   error —— 明确违反 CLAUDE.md 的「禁止事项」，默认拦，BLOG_STRICT=0 可降级为警告。
 *   warn  —— 风格与完整性问题，只报告不拦。发布不该被这种事卡住。
 */

const ALLOWED_FRONTMATTER = new Set(['tags', 'aliases', 'created', 'updated']);
const KINDS = new Set(['概念', '实践', '排错', '速查']);

const STRICT = process.env.BLOG_STRICT !== '0';

export function validateNote(note) {
  const issues = [];
  const at = note.file;

  // ── error：frontmatter 恰好四个键 ──
  for (const key of note.frontmatterKeys) {
    if (!ALLOWED_FRONTMATTER.has(key)) {
      issues.push({
        level: 'error',
        at,
        msg: `frontmatter 出现规则外的键「${key}」。CLAUDE.md：四个键，一个都不多（tags/aliases/created/updated）`,
      });
    }
  }

  // ── error：类型/* 恰好一个，且在封闭集合内 ──
  if (note.kinds.length === 0) {
    issues.push({ level: 'error', at, msg: '缺少 类型/* 标签，每篇恰好一个' });
  } else if (note.kinds.length > 1) {
    issues.push({
      level: 'error',
      at,
      msg: `有 ${note.kinds.length} 个 类型/* 标签（${note.kinds.join('、')}），每篇恰好一个`,
    });
  }
  for (const k of note.kinds) {
    if (!KINDS.has(k)) {
      issues.push({
        level: 'error',
        at,
        msg: `类型/${k} 不在封闭集合内。只有 概念/实践/排错/速查 四个值，规则写明永不新增`,
      });
    }
  }

  // ── warn：一句话结论（体检第 1 项） ──
  if (!note.hasLede) {
    issues.push({
      level: 'warn',
      at,
      msg: '缺少一句话结论。frontmatter 之后第一行应该是引用块形式的结论 —— 它同时是列表页摘要和 meta description 的来源',
    });
  }

  // ── warn：不写 H1，文件名即标题 ──
  // 先剥掉围栏代码块，否则 Python / Shell 注释里的 `# xxx` 会被误判成 H1
  const withoutFences = note.body.replace(/^```[\s\S]*?^```/gm, '');
  if (/^#\s+\S/m.test(withoutFences)) {
    issues.push({ level: 'warn', at, msg: '正文里出现了 H1。文件名即标题，正文从 H2 开始' });
  }

  // ── warn：日期 ──
  if (!note.created) issues.push({ level: 'warn', at, msg: 'created 缺失或格式非法' });
  if (!note.updated) issues.push({ level: 'warn', at, msg: 'updated 缺失或格式非法' });

  // ── warn：碎屑与超长（体检第 4 项；超长只是提醒，不必然拆） ──
  if (note.bodyLines < 10) {
    issues.push({ level: 'warn', at, msg: `只有 ${note.bodyLines} 行，考虑并进更上层的笔记` });
  } else if (note.bodyLines > 400) {
    issues.push({ level: 'warn', at, msg: `${note.bodyLines} 行，值得重新审视是否该拆（仅提醒）` });
  }

  return issues;
}

export function reportValidation({ issues, conflicts, count, log }) {
  const fatal = conflicts.map((c) =>
    c.kind === 'alias'
      ? `别名冲突：「${c.name}」同时被 ${c.a} 和 ${c.b} 认领`
      : `笔记重名：「${c.name}」同时存在于 ${c.a} 和 ${c.b}`,
  );

  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');

  if (count === 0) {
    // 知识库还没有正式笔记时属正常状态，CLAUDE.md 自己也写了这一条。
    log.warn?.('[vault] 没有找到任何笔记（*/*/*.md）。空库是合法状态，站点会渲染空态。');
  } else {
    log.info?.(`[vault] 收录 ${count} 篇笔记`);
  }

  for (const w of warns) log.warn?.(`[vault] ${w.at} — ${w.msg}`);

  if (errors.length) {
    const list = errors.map((e) => `  · ${e.at} — ${e.msg}`).join('\n');
    if (STRICT) {
      throw new Error(
        `[vault] ${errors.length} 处违反知识库规则，构建中断：\n${list}\n\n` +
          `修好它们，或临时用 BLOG_STRICT=0 降级为警告。`,
      );
    }
    for (const e of errors) log.warn?.(`[vault] ${e.at} — ${e.msg}`);
  }

  if (fatal.length) {
    throw new Error(
      `[vault] 双链解析表存在冲突，构建中断：\n${fatal.map((f) => `  · ${f}`).join('\n')}\n\n` +
        `这类问题会让 [[双链]] 指向错误的笔记，不能放行。\n` +
        `处理方式：给其中一篇改名，或按「合并」流程把两篇并成一篇。`,
    );
  }
}
