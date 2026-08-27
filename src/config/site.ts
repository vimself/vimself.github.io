/**
 * 站点身份配置。
 *
 * 这些内容**不放进知识库**：CLAUDE.md 明确写了「不记项目细节、日记、待办清单」，
 * 个人简介和时间线属于站点身份，不属于可复用的技术干货。
 * 放在博客仓库里，两边职责清爽 —— vault 只管知识，blog 只管呈现。
 *
 * 文案全部照搬 Claude Design 设计稿里的原值。
 */

export const site = {
  title: 'Vimself',
  author: 'Jory',
  url: 'https://vimself.github.io',
  lang: 'zh-CN',
  description: 'Jory 的个人技术知识库 —— 原理、做法、坑、速查。由 Obsidian 写作，自动同步发布。',

  /** 首页大标题 */
  tagline:
    'Keep the heart of daring to learn, willing to learn, and knowing how to learn',

  /** 首页副标题（小圆点后面那行） */
  intro: 'Jory · 全栈工程师 · 记录学习与折腾',

  /**
   * 头像 / logo 的源文件是 src/assets/avatar.jpg，由 src/lib/avatar.ts 解析。
   * 换头像只要替换那一个文件 —— 页头 30px、关于页 88px、favicon 64px、
   * apple-touch-icon 180px、分享图 512px 全都由它在构建时派生。
   */

  github: 'https://github.com/vimself',
  notesRepo: 'https://github.com/vimself/jory-notes',

  /** 每页笔记数 —— 对应设计稿的 perPage prop（默认 10，范围 5–50） */
  perPage: 10,

  /** 列表行是否显示领域徽标 —— 对应设计稿的 showTagInList prop */
  showTagInList: true,

  about: {
    role: '全栈工程师 · Vimself 的作者',
    paragraphs: [
      '全栈工程师一枚，热爱追逐前沿有意思的项目和技术，业余自学金融知识。',
      '从小爱玩电脑游戏，英雄联盟伴我整个青春。',
    ],
    timeline: [
      { year: '2020', text: '选择网络工程作为本科专业，第一次去东北。' },
      { year: '2025', text: '二战上岸合肥工业大学，开始全面接触 AI 前沿技术。' },
      { year: '2026', text: '结题一个国企全栈 AI 应用项目，并开始写这个 blog，记录自己的成长。' },
      { year: '未完结', text: '继续往前。' },
    ],
    cta: {
      title: '想和我处，先和我的代码去谈吧',
      subtitle: '本博客、有意思的项目，都在此——Follow me 一起进步',
      label: 'vimself',
    },
  },
} as const;

export type Site = typeof site;
