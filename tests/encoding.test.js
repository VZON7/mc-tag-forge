'use strict';
/* 三档编码、字符长度、N 色渐变。
 * 表格里的"实测"都是游戏内验证过的，改动这块必须仍然对得上。 */
const { install, loadTool } = require('./lib/dom');
const t = require('./lib/t');
install();
const M = loadTool(['S', 'newRun', 'codeOut', 'cells', 'to3', 'exp3', 'legOf',
                    'effective', 'hex2hsv', 'hsv2hex', 'lens']);
const { S, newRun, codeOut, to3, exp3, legOf, hex2hsv, hsv2hex } = M;

const reset = () => {
  S.runs = [newRun('')]; S.active = 0; S.wrap = 0;
  S.nStops = 2; S.cuts = []; S.enc = 'hex3';
  S.stops = ['#f37c52', '#8860c6', '#5555ff', '#2f5b8b'];
};

t.section('三位简写按 CSS 逐位翻倍展开');
t.eq('to3(#f37c52)', to3('#f37c52'), 'e75');
t.eq('exp3(bdf) —— 游戏实测 #BBDDFF', exp3('bdf'), '#bbddff');
t.eq('exp3(c7b) —— 游戏实测 #CC77BB', exp3('c7b'), '#cc77bb');
t.eq('exp3(cff) —— 游戏实测 #CCFFFF', exp3('cff'), '#ccffff');

t.section('传统色码映射');
t.eq('#5555ff → &9', legOf('#5555ff'), '9');
t.eq('#ff55ff → &d', legOf('#ff55ff'), 'd');
t.eq('#ff5555 → &c', legOf('#ff5555'), 'c');

t.section('标签成本：6位=10 / 3位=7 / 色码=6');
reset(); S.runs = [newRun('X')];
const bare = { hex6: 10 * 2 + 1, hex3: 7 * 2 + 1, leg: 6 * 2 + 1 };
for (const e of ['hex6', 'hex3', 'leg']) {
  S.enc = e;
  t.eq(e, codeOut().length, bare[e]);
}

t.section('anvil 上限数 UTF-16 单元，emoji 占 2 格');
reset(); S.runs = [newRun('「Takodachi \u{1F419} Prime」')]; S.enc = 'hex3';
t.eq('文字部分 UTF-16 长度', [...'「Takodachi \u{1F419} Prime」'].length + 1, 20);
t.eq('完整代码长度', codeOut().length, 34);
t.eq('代码内容', codeOut(), '{#e75>}「Takodachi \u{1F419} Prime」{#358<}');

t.section('四色渐变 —— 对照游戏实测色阶');
reset(); S.runs = [newRun('RRRRGGGGBBBB')];
S.nStops = 4; S.cuts = []; S.stops = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
t.eq('代码', codeOut(), '{#f00>}RRRR{#0f0<>}GGGG{#00f<>}BBBB{#ff0<}');
t.eq('长度', codeOut().length, 42);
t.eq('逐字色阶（游戏实测值）',
  M.cells().map(o => o.col.slice(1)).join(' '),
  'ff0000 aa5500 55aa00 00ff00 00ff00 00aa55 0055aa 0000ff 0000ff 5555aa aaaa55 ffff00');

t.section('两色/三色输出没有回归');
reset(); S.runs = [newRun('「Takodachi \u{1F419} Prime」')];
S.nStops = 2; S.enc = 'hex6';
t.eq('两色', codeOut(), '{#f37c52>}「Takodachi \u{1F419} Prime」{#2f5b8b<}');
S.nStops = 3; S.cuts = [10]; S.stops = ['#e56e94', '#5555ff', '#5555ff', '#65008f'];
t.eq('三色用 <> 合并断点', codeOut(),
  '{#e56e94>}「Takodachi{#5555ff<>} \u{1F419} Prime」{#65008f<}');

t.section('HSV 往返无损');
for (const hx of ['#f37c52', '#2f5b8b', '#000000', '#ffffff', '#5555ff', '#cc77bb']) {
  t.eq(hx, hsv2hex(hex2hsv(hx)), hx);
}

t.section('量化后的实际颜色（预览必须用这个）');
S.enc = 'hex3'; t.eq('hex3 下 #f37c52 实际渲染', M.effective('#f37c52'), '#ee7755');
S.enc = 'hex6'; t.eq('hex6 无损', M.effective('#f37c52'), '#f37c52');
S.enc = 'leg';  t.eq('leg 下落到 &c 红', M.effective('#f37c52'), '#ff5555');

module.exports = t.done();
