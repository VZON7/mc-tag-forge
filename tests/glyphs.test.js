'use strict';
/* 像素预览用的 Unifont 字形子集：解码正确性 + 覆盖完整性。
 *
 * 覆盖完整性这条最重要——STYLES/SYMS/EMOJI_PROBE 以后改了（加新花体、加新符号），
 * 嵌入的字形子集不会自动跟着变，这里断言"当前表里用到的每个码位在字形数据里都有"，
 * 谁忘了重新抽字形子集，这个测试会先炸，不会等到用户在像素模式下看见空心方框才发现。 */
const { install, loadTool } = require('./lib/dom');
const t = require('./lib/t');
const dom = install();
const M = loadTool(['S', 'newRun', 'STYLES', 'SYMS', 'EMOJI_PROBE', 'apply',
  'b64decode', 'GLYPHS', 'drawGlyph', 'drawPixelPreview', 'paintPreview', 'render',
  'renderRuns', 'renderStops', 'renderSyms']);
const { S, newRun, STYLES, SYMS, EMOJI_PROBE, apply, b64decode, GLYPHS, drawGlyph, paintPreview } = M;

t.section('b64decode：手写解码器 roundtrip 正确');
// "AQIDBA==" 是 [1,2,3,4] 的标准 base64
t.eq('已知 base64 解出已知字节', [...b64decode('AQIDBA==')].join(','), '1,2,3,4');
t.eq('空字符串解出空数组', b64decode('').length, 0);

t.section('字形子集：数量与已知字形核对');
t.eq('字形总数', GLYPHS.map.size, 3547);
const gA = GLYPHS.map.get(0x41); // 'A'
t.ok('大写 A 存在', !!gA, JSON.stringify(gA));
t.eq('大写 A 是 8px 窄字形', gA.width, 8);
t.eq('大写 A 位图字节', [...GLYPHS.blob.slice(gA.offset, gA.offset + gA.len)].map(b => b.toString(16).padStart(2, '0')).join(''),
  '0000000018242442427e424242420000');
const gOct = GLYPHS.map.get(0x1F419); // 🐙 章鱼，已实测游戏内可用
t.ok('🐙 章鱼存在', !!gOct, JSON.stringify(gOct));
t.eq('🐙 是 16px 宽字形（增补平面）', gOct.width, 16);

t.section('字形子集：覆盖 STYLES/SYMS/EMOJI_PROBE 里用到的每一个码位');
const need = new Set();
STYLES.forEach((s) => {
  ['up', 'lo', 'dg', 'sp'].forEach((k) => { if (s[k]) [...s[k]].forEach((c) => need.add(c.codePointAt(0))); });
  if (s.pre) Object.values(s.pre).forEach((c) => need.add(c.codePointAt(0)));
});
Object.values(SYMS).forEach((str) => [...str].forEach((c) => need.add(c.codePointAt(0))));
EMOJI_PROBE.forEach(([, , rows]) => rows.forEach((r) => [...r].forEach((c) => need.add(c.codePointAt(0)))));
const missing = [...need].filter((cp) => !GLYPHS.map.has(cp));
t.ok(`${need.size} 个码位全部覆盖，没有缺字形`, missing.length === 0,
  '缺失：' + missing.slice(0, 10).map((c) => 'U+' + c.toString(16).toUpperCase()).join(',') + (missing.length > 10 ? '...' : ''));

t.section('drawGlyph：真的画到 canvas 上，逐像素核对 "A" 的形状');
const canvas = dom.el('pvCanvas'); // 复用 install() 里的通用 mk() 桩，getContext 走 makeCanvas 的实现
canvas.width = 20; canvas.height = 20;
const ctx = canvas.getContext('2d');
drawGlyph(ctx, 0x41, 0, 0, 2, '#ff0000', false);
// 已知位图第 4 行（0 起）是 ...##... —— 对应 scale=2 时第 8-9 行、第 6-9 列应该被点亮
t.eq('第 4 源行的中间两列被点亮（scale=2）', canvas._pixels[8][6], '#ff0000');
t.eq('第 4 源行左侧留空', canvas._pixels[8][0], null);

t.section('像素预览整体走一遍：S.pixel=true 时 canvas 显示、#pv 隐藏');
S.runs = [newRun('A')]; S.active = 0; S.pixel = true;
M.renderRuns(); M.renderStops(); M.renderSyms();
paintPreview();
const pv = dom.el('pv'), pvCanvas = dom.el('pvCanvas');
t.eq('#pv 隐藏', pv.style.display, 'none');
// 不能断言等于空字符串——CSS 里 #pvCanvas 默认 display:none，清空 inline style
// 只是回退到那条规则，测试桩不模拟真实层叠，所以这里必须断言一个真正会显示的值，
// 不然这个测试自己就是在验证那个曾经踩过的 bug。
t.ok('#pvCanvas 显示（不是 none，也不是清空 inline 又落回样式表的 none）',
  pvCanvas.style.display && pvCanvas.style.display !== 'none', JSON.stringify(pvCanvas.style.display));
t.ok('canvas 画出了非零宽度', pvCanvas.width > 0, String(pvCanvas.width));
S.pixel = false;

module.exports = t.done();
