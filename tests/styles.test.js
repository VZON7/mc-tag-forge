'use strict';
/* 花体映射表的完整性。
 * 这个文件的存在是因为一次真实事故：手打反白方框的 26 个字符时把 i/j 打成了 G/H，
 * 结果 "Prime" 在游戏里显示成 "PRGME"。连续 Unicode 区块必须用 seq() 生成。 */
const { install, loadTool } = require('./lib/dom');
const t = require('./lib/t');
install();
const M = loadTool(['STYLES', 'GAME', 'apply', 'auditStyles', 'seq', 'digits']);
const { STYLES, GAME, apply, auditStyles } = M;
const idx = (n) => STYLES.findIndex((s) => s.n === n);

t.section('启动自检：每张表 26 码点、无意外重复');
const bad = auditStyles();
t.ok('auditStyles 无告警', bad.length === 0, bad.join(' | '));
t.eq('花体总数', STYLES.length, 34);

t.section('PRGME 事故回归：连续区块必须由 seq(码点) 生成，不能手打');
/* 真正的不变式不是"大小写相同"（圆圈和全角本来就有两种形态），
 * 而是"每张表都等于从正确起始码点生成的序列"。手打的错字必然打破这一条。 */
const blocks = [
  ['方框',     'up', 0x1F130], ['方框',     'lo', 0x1F130],
  ['反白方框', 'up', 0x1F170], ['反白方框', 'lo', 0x1F170],
  ['反白圆圈', 'up', 0x1F150], ['反白圆圈', 'lo', 0x1F150],
  ['带括号',   'up', 0x249C],  ['带括号',   'lo', 0x249C],
  ['圆圈',     'up', 0x24B6],  ['圆圈',     'lo', 0x24D0],
  ['全角',     'up', 0xFF21],  ['全角',     'lo', 0xFF41],
];
for (const [name, side, start] of blocks) {
  const st = STYLES[idx(name)];
  const want = Array.from({ length: 26 }, (_, i) => String.fromCodePoint(start + i)).join('');
  t.eq(`${name}.${side} = seq(0x${start.toString(16).toUpperCase()})`, st[side], want);
}
t.eq('反白方框 Prime', apply(STYLES[idx('反白方框')], 'Prime'), '\u{1F17F}\u{1F181}\u{1F178}\u{1F17C}\u{1F174}');
t.eq('反白方框全字母表', apply(STYLES[idx('反白方框')], 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1F170 + i)).join(''));

t.section('组合符已全部移除（2 格 + MC 会往右飘）');
t.eq('带 comb 的花体数', STYLES.filter((s) => s.comb).length, 0);

t.section('预组合花体：1 格且贴合');
for (const n of ['预组合·双点', '预组合·点上', '预组合·波浪', '预组合·尖音']) {
  const out = apply(STYLES[idx(n)], 'Takodachi');
  t.eq(n + ' 长度不翻倍', out.length, 9);
  t.eq(n + ' 标注为实测', GAME[n], 'e');
}
t.eq('预组合双点结果', apply(STYLES[idx('预组合·双点')], 'Takodachi'), 'Täködäcḧï');

t.section('游戏内表现标注齐全');
const missing = STYLES.filter((s) => !GAME[s.n]).map((s) => s.n);
t.ok('每种花体都有 GAME 标注', missing.length === 0, missing.join(','));
t.eq('辨识度高的种类数', STYLES.filter((s) => GAME[s.n] === 'd').length, 14);
t.eq('游戏内近似普通字（8×16 点阵吃掉了差别）',
  STYLES.filter((s) => GAME[s.n] === 'p').map((s) => s.n).join(','),
  '衬线粗体,黑板粗体,无衬线,无衬线粗,等宽');

t.section('倒转会镜像括号');
t.eq('「abc」', apply(STYLES[idx('倒转')], '「abc」'), '「ɔqɐ」');

module.exports = t.done();
