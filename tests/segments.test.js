'use strict';
/* 段落（每段自己的花体和格式）、定色段、包裹、代码解析器。 */
const { install, loadTool } = require('./lib/dom');
const t = require('./lib/t');
const dom = install();
const M = loadTool(['S', 'STYLES', 'newRun', 'codeOut', 'cells', 'blocks',
                    'renderRuns', 'parseCode', 'plainText', 'WRAPS', 'saveHints', 'lens']);
const { S, STYLES, newRun, codeOut, parseCode, renderRuns } = M;
const idx = (n) => STYLES.findIndex((s) => s.n === n);
const reset = () => {
  S.runs = [newRun('')]; S.active = 0; S.wrap = 0;
  S.nStops = 2; S.cuts = []; S.enc = 'hex3';
  S.stops = ['#f37c52', '#8860c6', '#5555ff', '#2f5b8b'];
};
const fmt = (o) => ['l', 'o', 'n', 'm', 'k'].filter((k) => o.f && o.f[k]).join('') || '-';

t.section('分段：每段自己的花体 + 格式');
reset();
S.runs = [newRun('tako'), newRun('dachi'), newRun('prime')];
S.runs[1].st = idx('小型大写'); S.runs[1].f.n = 1;
S.runs[2].st = idx('哥特体'); S.runs[2].f.l = 1; S.runs[2].f.o = 1;
t.eq('显示文字', M.plainText(), 'takoᴅᴀᴄʜɪ𝔭𝔯𝔦𝔪𝔢');
t.ok('三段各开一个渐变标签', (codeOut().match(/\{#/g) || []).length === 6, codeOut());
t.ok('第二段带 &n', /\{#\w+>\}&n/.test(codeOut()), codeOut());
t.info('代码 ' + codeOut() + '  长度 ' + codeOut().length);

t.section('定色段：用传统色码，只占 2 格');
reset();
S.runs = [newRun('peko'), newRun('❤'), newRun('vivi')];
S.runs[0].st = idx('小型大写'); S.runs[2].st = idx('小型大写');
S.runs[1].fix = '#ff5555';
S.stops = ['#5555ff', 'x', 'x', '#ff55ff'];
S.enc = 'leg';
t.eq('定色段用 &c 而不是渐变标签', codeOut(), '{#&9>}ᴘᴇᴋᴏ{#&9<}&c❤{#&d>}ᴠɪᴠɪ{#&d<}');
/* 已知限制：段落切的是同一条全局渐变，所以做不出"前段 A→B、后段 B→A"的镜像。
 * 原来的镜像模式能做，改成段落架构时丢掉了。见 SKILL.md 待办。 */
t.ok('已知限制：段落无法表达镜像渐变（首末色不相等）',
  codeOut().slice(0, 7) !== codeOut().slice(-7),
  '这条断言记录现状，不是期望行为');

t.section('包裹只花字符本身的钱（并进首尾段，不另开标签）');
reset(); S.runs = [newRun('test')];
const noWrap = codeOut().length;
const WrapIndex = (name) => M.WRAPS.findIndex((w) => w[0] === name);
for (const [name, want] of [['角括号', 2], ['方块渐变', 8], ['方块长', 14]]) {
  S.wrap = WrapIndex(name);
  t.eq(name + ' 成本', codeOut().length - noWrap, want);
}
S.wrap = WrapIndex('角括号');
t.eq('包裹在渐变之内', codeOut(), '{#e75>}「test」{#358<}');

t.section('段落行 UI：删除边界');
reset(); S.runs = [newRun('a')]; renderRuns();
t.ok('单段时删除键禁用', /data-del="0" disabled/.test(dom.el('runs').innerHTML));
S.runs = [newRun('a'), newRun('b'), newRun('c')]; S.active = 2; renderRuns();
const html = dom.el('runs').innerHTML;
t.eq('三段三行', (html.match(/class="rw/g) || []).length, 3);
t.eq('每行 5 个格式键', (html.match(/data-f="/g) || []).length, 15);
t.ok('删除键都可用', !/data-del="\d+" disabled/.test(html));
t.ok('首行↑禁用', /data-up="0" disabled/.test(html));
t.ok('末行↓禁用', /data-dn="2" disabled/.test(html));
S.runs.splice(1, 1); S.active = Math.min(S.active, S.runs.length - 1); renderRuns();
t.eq('删中间段后剩下的', S.runs.map((r) => r.t).join(','), 'a,c');

t.section('hover 花体不能污染输出');
reset(); S.runs = [newRun('Tako')];
const before = codeOut();
const withHover = M.blocks(true).map((b) => b.chars.join('')).join('');
t.eq('输出路径不受 hover 参数影响', codeOut(), before);
t.eq('未 hover 时 blocks(true) 也等于原文', withHover, 'Tako');

t.section('代码解析器：四色代码要解回游戏实测色阶');
const q = parseCode('{#f00>}RRRR{#0f0<>}GGGG{#00f<>}BBBB{#ff0<}');
t.eq('字符数', q.length, 12);
t.eq('逐字色', q.map((o) => o.col.slice(1)).join(' '),
  'ff0000 aa5500 55aa00 00ff00 00ff00 00aa55 0055aa 0000ff 0000ff 5555aa aaaa55 ffff00');

t.section('解析器：格式码');
const e = parseCode('{#d69>}squis{#d9a<>}&lhy{#757<}');
t.eq('&l 之前无格式', fmt(e[0]), '-');
t.eq('&l 之后为粗体', fmt(e[5]), 'l');
const r = parseCode('&l&nAB&rCD&cEF');
t.eq('&r 前', fmt(r[0]), 'ln');
t.eq('&r 后复位', fmt(r[2]), '-');
t.eq('&c 生效', r[4].col, '#ff5555');

t.section('解析器：镜像 + 定色');
const p = parseCode('{#&9>}ᴘᴇᴋᴏ{#&d<}&c❤{#&d>}ᴠɪᴠɪ{#&9<}');
t.eq('字符数', p.length, 9);
t.eq('首字符', p[0].col, '#5555ff');
t.eq('中间定色的心', p[4].col, '#ff5555');
t.eq('末字符回到起点色', p[8].col, '#5555ff');

t.section('超限建议按可省格数排序');
reset(); S.enc = 'hex6'; S.runs = [newRun('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')];
const code = codeOut();
t.ok('确实超限', code.length > S.cap, String(code.length));
const hint = M.saveHints(code.length - S.cap, M.lens());
t.ok('建议里提到换 3 位编码', /3 位编码/.test(hint), hint.replace(/<[^>]+>/g, ''));

module.exports = t.done();
