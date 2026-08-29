/**
 * 代码高亮主题 —— 亮色 / 深色两套，同一份作用域表，两份配色。
 *
 * 为什么不用 Shiki 自带主题：设计要求是「紫色关键字 + 蓝色函数 + 绿色字符串 +
 * 青色类型 + 橙色形参」。自带的亮色主题里没有一个同时满足最后两条 ——
 * one-light / catppuccin-latte 的类型是土黄，min-light / github-light 的
 * 关键字是红色、字符串是深蓝。与其挑一个「差不多」的再到处打补丁，
 * 不如把作用域表写死在这里：一共二十来条，读得懂、改得动。
 *
 * 作用域的书写顺序不重要，TextMate 按**选择器精确度**判定优先级：
 * `storage` 命中紫色，而更长的 `storage.type.object` 命中青色，后者赢。
 * 下面几条「例外」全靠这个机制，别把它们改短。
 */

/* 亮色。对比度按 WCAG AA 正文标准（4.5:1）挑的，都落在近白底 #fffdf9 上。 */
const LIGHT = {
  bg: '#fffdf9',
  fg: '#3d3d3a',      // 正文色，标点、运算符、普通标识符都用它
  comment: '#8e8b82',
  keyword: '#7c3aed',
  fn: '#2563eb',
  type: '#0f766e',
  string: '#1a7f37',
  number: '#b45309',
  param: '#b45309',
};

/* 深色。底色是 tokens.css 里的 --code-bg #0f0e0d，配色相应提亮两档。 */
const DARK = {
  bg: '#0f0e0d',
  fg: '#e9e5de',
  comment: '#85827b',
  keyword: '#c4b5fd',
  fn: '#93c5fd',
  type: '#5eead4',
  string: '#86efac',
  number: '#fcd34d',
  param: '#fcd34d',
};

function build(name, type, p) {
  return {
    name,
    type,
    colors: { 'editor.background': p.bg, 'editor.foreground': p.fg },
    settings: [
      { settings: { background: p.bg, foreground: p.fg } },

      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: p.comment } },

      {
        scope: ['string', 'string.quoted', 'string.template', 'string.regexp',
                'punctuation.definition.string', 'constant.other.symbol'],
        settings: { foreground: p.string },
      },

      {
        scope: ['constant.numeric', 'constant.language', 'constant.character.escape'],
        settings: { foreground: p.number },
      },

      /* 关键字。storage.type.primitive 是 java 的 void/int，
         storage.type.class / storage.type.function 是 class、def 这几个词本身
         （类名和函数名是 entity.name.*，走下面的规则）。 */
      {
        scope: ['keyword', 'storage', 'storage.type.primitive', 'storage.modifier',
                'keyword.control', 'keyword.operator.new', 'keyword.operator.expression',
                'variable.language'],
        settings: { foreground: p.keyword },
      },

      { scope: ['entity.name.function', 'support.function', 'variable.function',
                'meta.function-call.generic'],
        settings: { foreground: p.fn } },

      { scope: ['entity.name.type', 'entity.name.class', 'entity.other.inherited-class',
                'support.type', 'support.class', 'storage.type.object',
                'entity.name.namespace', 'entity.name.tag', 'support.type.property-name'],
        settings: { foreground: p.type } },

      { scope: ['variable.parameter', 'entity.name.variable.parameter',
                'entity.other.attribute-name'],
        settings: { foreground: p.param } },

      /* 普通变量回到正文色 —— 图里 name、greeting、__name__ 都是黑的 */
      { scope: ['variable', 'variable.other'], settings: { foreground: p.fg } },

      /* 三条例外，靠精确度压过上面的通用规则：
         比较和赋值运算符（== 、=）在设计图里是黑的，但 `keyword` 是
         `keyword.operator.comparison` 的前缀，会把它们一起染紫，所以显式压回正文色。
         上面列的 keyword.operator.new / .expression 比这条长，不受影响，仍是紫色 ——
         python 的 in / not / and 靠的就是那条。
         shell 的 echo 在设计图里是紫色（和 python 的 print 蓝色不同待遇）；
         js 的 console.log 里 console 是正文色、只有 log 是蓝色。 */
      { scope: ['keyword.operator'], settings: { foreground: p.fg } },
      { scope: ['support.function.builtin.shell'], settings: { foreground: p.keyword } },
      { scope: ['support.class.console'], settings: { foreground: p.fg } },
    ],
  };
}

export const codeThemeLight = build('vimself-light', 'light', LIGHT);
export const codeThemeDark = build('vimself-dark', 'dark', DARK);
