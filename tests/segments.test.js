'use strict';
/* 段落（每段自己的花体和格式）、定色段、包裹、代码解析器。 */
const { install, loadTool } = require('./lib/dom');
const t = require('./lib/t');
const dom = install();
const M = loadTool(['S', 'STYLES', 'newRun', 'codeOut', 'cells', 'blocks',
                    'renderRuns', 'parseCode', 'plainText', 'WRAPS', 'saveHints', 'lens',
                    'liveOutCode', 'render', 'paintPreview']);
const { S, STYLES, newRun, codeOut, parseCode, renderRuns, liveOutCode, render, paintPreview } = M;
const idx = (n) => STYLES.findIndex((s) => s.n === n);
const reset = () => {
  S.runs = [newRun('')]; S.active = 0; S.wrap = 0;
  S.nStops = 2; S.cuts = []; S.enc = 'hex3'; S.codeEdit = null;
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
/* 默认段落切的是同一条全局渐变，所以不开镜像时做不出"前段 A→B、后段 B→A"。
 * 镜像能力已恢复（见下一节），这里只是记录"不开镜像"时的默认现状。 */
t.ok('默认不镜像时，段落共享同一条渐变（首末色不相等）',
  codeOut().slice(0, 7) !== codeOut().slice(-7),
  '这条断言记录默认行为，不是能力上限');

t.section('镜像：段落可选跳出全局渐变，自己反向跑一遍色标');
reset(); S.enc = 'hex6';
S.runs = [newRun('Holo'), newRun('Craft')];
S.runs[1].mirror = true;
S.stops = ['#ff0000', 'x', 'x', '#0000ff'];
const mc = M.cells();
t.eq('前段首字符=起始色', mc[0].col, '#ff0000');
t.eq('镜像后段首字符=尾色（折返起点）', mc[4].col, '#0000ff');
t.eq('镜像后段末字符=起始色（折返终点）', mc[8].col, '#ff0000');
const mcode = codeOut();
t.ok('镜像段独立开渐变标签', (mcode.match(/\{#/g) || []).length >= 4, mcode);
t.info('镜像代码 ' + mcode);

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

t.section('输出代码可以手动编辑 + 撤回，跟逆推的 shotEdit 是同一套模式');
reset(); S.runs = [newRun('abc')];
t.eq('没手改时 liveOutCode 等于自动生成', liveOutCode(), codeOut());
S.codeEdit = '手写的任意内容，跟设计完全对不上也没关系';
dom.el('code').value = S.codeEdit; // 模拟用户已经在文本框里打完这段字（oninput 触发时框里就是这个值）
t.eq('手改之后 liveOutCode 用手改的版本', liveOutCode(), S.codeEdit);
t.ok('手改内容不等于自动生成（确认真的在读 codeEdit，不是巧合一致）',
  liveOutCode() !== codeOut(), liveOutCode());
// 改设计（比如换编码档位）不应该悄悄冲掉手改——这是逆推那边已经验证过的行为，创作这边要一致
S.enc = 'hex6';
t.eq('改了设计之后，手改内容还在（没被覆盖）', liveOutCode(), S.codeEdit);
render();
t.eq('render() 之后手改内容依然还在', dom.el('code').value, S.codeEdit);
t.eq('手改状态下，提示+撤回按钮的金色框应该显示（跟撤回按钮同框，不再分开两处）',
  dom.el('mEditNote').style.display, 'flex');
t.ok('金色框里有提示文字', dom.el('mEditNoteText').textContent.length > 0, dom.el('mEditNoteText').textContent);
S.codeEdit = null; render();
t.eq('撤回后 liveOutCode 回到自动生成', liveOutCode(), codeOut());
t.eq('撤回后文本框内容也回到自动生成', dom.el('code').value, codeOut());
t.eq('撤回后金色框重新隐藏', dom.el('mEditNote').style.display, 'none');

t.section('手改输出代码之后，上面的预览要跟着改，不能停在旧设计上');
reset(); S.runs = [newRun('abc')];
const beforeCs = paintPreview();
t.eq('没手改时预览文字等于设计生成的', beforeCs.map((o) => o.ch).join(''), 'abc');
S.codeEdit = '{#ff0000>}XYZ{#00ff00<}';
dom.el('code').value = S.codeEdit;
const afterCs = paintPreview();
t.eq('手改后预览文字变成手改代码里的文字，不再是 abc', afterCs.map((o) => o.ch).join(''), 'XYZ');
t.eq('手改后预览颜色也是手改代码解出来的', afterCs[0].col, '#ff0000');
t.ok('手改后预览跟旧的设计生成结果不一样了', afterCs.map((o) => o.ch).join('') !== beforeCs.map((o) => o.ch).join(''));
S.codeEdit = null;
const revertedCs = paintPreview();
t.eq('撤回后预览变回设计生成的', revertedCs.map((o) => o.ch).join(''), 'abc');

module.exports = t.done();
