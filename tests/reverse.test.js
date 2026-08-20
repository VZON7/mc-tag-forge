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
const dom = install();
const M = loadTool(['extractGlyphs', 'fitStops', 'detectScale', 'mapShotCuts',
                    'S', 'shotCode', 'shotCells', 'customBounds', 'activeCustomStops', 'renderShot']);
const { extractGlyphs, fitStops, mapShotCuts, S, shotCode, shotCells,
        customBounds, activeCustomStops, renderShot } = M;

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

/* 上传截图之后，2/3/4 色推荐 + 「我的配色」这一块（#fitsList）必须立刻画出来，
 * 不能等用户点了别的按钮才第一次出现——之前 renderShot() 只调了 bindFitPicks()
 * （只负责绑点击事件），没调真正负责画内容的 renderFitsList()，导致 #fitsList
 * 上传完截图后是空的，得点一下「我的配色」区的 2 色/3 色/4 色按钮（副作用里
 * 才调了 renderFitsList()）才会冒出来。 */
t.section('上传截图后 #fitsList 必须立刻有内容，不用等用户点别的按钮');
const takoImg = fix('takodachi-2color.png');
const rs = extractGlyphs(takoImg, null, { x: 0, y: 8, w: 450, h: 22 });
renderShot(rs, takoImg);
const fitsHTML = dom.el('fitsList').innerHTML;
t.ok('renderShot 之后 #fitsList 不是空的', fitsHTML.length > 0, `长度 ${fitsHTML.length}`);
t.ok('包含"我的配色"这一行', fitsHTML.includes('我的配色'));

t.section('Takodachi 逐字色必须精确到字节（对照手工提取）');
const tk = extractGlyphs(fix('takodachi-2color.png'), null, { x: 0, y: 8, w: 450, h: 22 });
t.eq('17 个色阶', tk.glyphs.length, 17);
t.eq('逐字色', tk.glyphs.join(' ').toUpperCase(),
  '#F37C52 #E57857 #D7755B #CB7160 #BD6E64 #AF6A69 #A1666D #936372 #865F76 ' +
  '#795C7B #6B587E #615980 #575982 #4D5A85 #435A87 #395B89 #2F5B8B');

t.section('取色与缩放无关（降采样不是前置条件）');
t.info('takodachi 那张是 GUI Scale 2，探测到 ' + tk.scale + '×，但逐字色仍然精确');
t.ok('端点未被 tooltip 紫边污染', tk.glyphs[0] !== '#24015c' && tk.glyphs[0] !== '#100110');

t.section('逆推色标下标换算：框选带上装饰符号导致色阶数远多于手打字数时不能塌缩');
/* 实测过的事故：框选连爱心、符号一起框进去，取到 52 个色阶，
 * 但「文字内容」框只手打了裸名字 13 个字符。旧公式拿色阶下标直接当字符下标用
 * （只在两边数量不等时才退回按比例算，但这个退回分支几乎永远不会触发），
 * 字数一少色阶下标全部被 clamp 到最后一个字符，两个断点叠在一起，
 * 4 色里中间那一段直接消失、渐变从起点跳色跳到第三个色标。 */
const map13 = Array.from({ length: 13 }, (_, i) => i);
const collapsedBefore = mapShotCuts([13, 35], map13, 13, 52);
t.eq('两个断点数量不变', collapsedBefore.length, 2);
t.ok('按比例换算，不会塌缩成同一个字符下标',
  collapsedBefore[1] > collapsedBefore[0], collapsedBefore.join(','));
t.ok('都落在合法字符范围内',
  collapsedBefore.every((v) => v >= 1 && v <= 12), collapsedBefore.join(','));

t.section('逆推色标下标换算：色阶数刚好等于手打字数时行为不变（回归）');
const map17 = Array.from({ length: 17 }, (_, i) => i);
t.eq('1:1 时直接对应原下标（跟改之前一致）',
  mapShotCuts([5, 9], map17, 17, 17).join(','), '5,9');

t.section('我的配色：4 格数组按 nStops 收缩成实际用到的色标（跟创作模式 activeStops 同一套规则）');
S.shotCustom = { nStops: 2, stops: ['#111111', 'x', 'x', '#eeeeee'], cuts: [] };
t.eq('2 色只取首尾', activeCustomStops().join(','), '#111111,#eeeeee');
S.shotCustom = { nStops: 3, stops: ['#111111', '#222222', 'x', '#eeeeee'], cuts: [] };
t.eq('3 色取起/中/尾', activeCustomStops().join(','), '#111111,#222222,#eeeeee');
S.shotCustom = { nStops: 4, stops: ['#111111', '#222222', '#333333', '#eeeeee'], cuts: [] };
t.eq('4 色四格全取', activeCustomStops().join(','), '#111111,#222222,#333333,#eeeeee');

t.section('我的配色：断点越界（比如文字变短了）时按比例重新均分，不会指向不存在的字符');
S.shotCustom = { nStops: 3, stops: ['#ff0000', '#00ff00', 'x', '#0000ff'], cuts: [20] };
const bnd = customBounds(3);
t.eq('断点数组形状不变', bnd.length, 3);
t.ok('重新均分后落在合法范围内', bnd[1] >= 1 && bnd[1] <= 2, bnd.join(','));

t.section('我的配色：非破坏性编辑——断点直接是字符下标，不用再绕回色阶空间');
S.shotText = 'shiranui flare'; S.shotStyle = null; S.shotFmt = { l: 0, o: 0, n: 0, m: 0, k: 0 };
S.shotEdit = null; S.enc = 'hex6'; S.shotFit = 'custom';
S.shotCustom = { nStops: 4, stops: ['#ff00ff', '#00ff00', '#5500cc', '#ffffff'], cuts: [3, 9] };
const cs = shotCells();
t.eq('逐字色数量等于打字长度', cs.length, [...S.shotText].length);
t.eq('开头是起始色', cs[0].col, '#ff00ff');
t.eq('第一个断点处正好过渡到色标 2', cs[2].col, '#00ff00');
t.eq('第二个断点处正好过渡到色标 3', cs[9].col, '#5500cc');
t.eq('结尾是终止色', cs[cs.length - 1].col, '#ffffff');
const customCode = shotCode();
t.info('我的配色代码 ' + customCode);
t.ok('代码以起始色开标签', customCode.startsWith('{#ff00ff>}'), customCode);
t.ok('代码含中间色标', customCode.includes('00ff00') && customCode.includes('5500cc'), customCode);
t.ok('代码以终止色收尾', customCode.endsWith('{#ffffff<}'), customCode);

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
