'use strict';
/* 逆推精度 —— 用四张真实游戏截图当语料。
 *
 * 这是整个仓库最有价值的测试：逆推涉及缩放探测、界面 chrome 剔除、阴影剔除、
 * 端点剪裁、色标拟合五层启发式，任何一层退化都会让结果悄悄变差而不报错。
 * 只有拿真实截图跑才能发现。
 *
 * 每条的"真值"来自用户在游戏里实际用的代码，或手工逐像素提取的结果。 */
const path = require('path');
const { install, loadTool } = require('./lib/dom');
const { loadImage } = require('./lib/png');
const t = require('./lib/t');
install();
const M = loadTool(['extractGlyphs', 'fitStops', 'detectScale']);
const { extractGlyphs, fitStops } = M;

const fix = (n) => loadImage(path.join(__dirname, 'fixtures', n));

/* [文件, 说明, 真实色标数, 起点真值, 终点真值, 最低吻合度, 裁剪区域] */
const CASES = [
  ['takodachi-2color.png', 'Takodachi（完整 tooltip，必须框选名字行）',
    2, '#f37c52', '#2f5b8b', 97, { x: 0, y: 8, w: 450, h: 22 }],
  ['korone-2color.png', 'Korone（用户代码 #a55d35 → #2b547e）',
    2, '#a35c34', '#355376', 98],
  ['cottagecrisps-3color.png', 'cottagecrisps（用户代码 {#bdf} {#c7b} {#cff}）',
    3, '#b9dafc', '#cafcfc', 99],
  ['notmyear-3color.png', "THAT'S NOT MY EAR（三段，中点为 &9 蓝）",
    3, '#e26d92', null, 90],
];

for (const [file, label, wantN, wantFirst, wantLast, minMatch, crop] of CASES) {
  t.section(label);
  const res = extractGlyphs(fix(file), null, crop);
  t.ok('取到色阶', res.glyphs.length >= 8, `${res.glyphs.length} 个`);
  t.eq('起点色', res.glyphs[0], wantFirst);
  if (wantLast) t.eq('终点色', res.glyphs[res.glyphs.length - 1], wantLast);
  t.info(`缩放探测 ${res.scale}×  背景 ${res.bg}  剔除阴影 ${res.dropped} / 端点杂色 ${res.trimmed}`);

  const fits = [2, 3, 4].map((n) => ({ n, f: fitStops(res.glyphs, n) })).filter((o) => o.f);
  fits.forEach(({ n, f }) => t.info(`${n} 色 ${f.match.toFixed(2)}%  ${f.stops.join(' → ')}`));

  // 「最佳」= 最高分 3% 以内的最小色标数。容差依据见 mc-tag-forge.html 里 renderShot 的注释
  const top = Math.max(...fits.map((o) => o.f.match));
  const best = (fits.find((o) => o.f.match >= top - 3) || fits[0]).n;
  t.eq('判定色标数', best, wantN);
  const chosen = fits.find((o) => o.n === wantN).f;
  t.ok(`吻合度 ≥ ${minMatch}%`, chosen.match >= minMatch, chosen.match.toFixed(2) + '%');
}

t.section('Takodachi 逐字色必须精确到字节（对照手工提取）');
const tk = extractGlyphs(fix('takodachi-2color.png'), null, { x: 0, y: 8, w: 450, h: 22 });
t.eq('17 个色阶', tk.glyphs.length, 17);
t.eq('逐字色', tk.glyphs.join(' ').toUpperCase(),
  '#F37C52 #E57857 #D7755B #CB7160 #BD6E64 #AF6A69 #A1666D #936372 #865F76 ' +
  '#795C7B #6B587E #615980 #575982 #4D5A85 #435A87 #395B89 #2F5B8B');

t.section('取色与缩放无关（降采样不是前置条件）');
t.info('takodachi 那张是 GUI Scale 2，探测到 ' + tk.scale + '×，但逐字色仍然精确');
t.ok('端点未被 tooltip 紫边污染', tk.glyphs[0] !== '#24015c' && tk.glyphs[0] !== '#100110');

t.section('不框选整张 tooltip 会取到全部文字行 —— 这就是框选存在的理由');
const whole = extractGlyphs(fix('takodachi-2color.png'));
t.ok('未框选时色阶数远超单行', whole.glyphs.length > 30, whole.glyphs.length + ' 个色阶');
t.info('检测到 ' + whole.bands.length + ' 个文字行带，但 tooltip 后面压着铁砧 GUI，自动分行不可靠');

t.section('PNG 解码器自检');
const im = fix('korone-2color.png');
t.eq('尺寸', `${im.width}×${im.height}`, '128×26');
t.eq('RGBA 数据长度', im.data.length, 128 * 26 * 4);
t.ok('alpha 全不透明', im.data[3] === 255);

module.exports = t.done();
