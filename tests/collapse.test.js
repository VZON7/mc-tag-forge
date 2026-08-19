'use strict';
/* 区域折叠：花体/符号/包裹/渐变/预设可以收起，输出不行——测的是这条界限本身，
 * 不是"点了会不会变"这种表面行为。落盘用的是跟预设同一套 storage 适配器，
 * 也测一下坏数据（不是数组、混进了不认识的 id）不会把整个功能打崩。 */
const { install, loadTool } = require('./lib/dom');
const t = require('./lib/t');
const dom = install();
const M = loadTool(['COLLAPSIBLE_SECS', 'COLLAPSE_KEY', 'loadCollapsedSecs', 'saveCollapsedSecs',
  'applyCollapsedSecs', 'collapsedSecs', 'MEM']);
const { COLLAPSIBLE_SECS, COLLAPSE_KEY } = M;
// 面板显隐现在直接读写各自的 style.display（不再靠 CSS 的兄弟选择器猜），
// 这里按 mc-tag-forge.html 里 SEC_PANEL_ID 同样的命名规则找到对应面板。
const panelOf = (id) => dom.el(id + 'Panel');

t.section('输出不在可折叠名单里——它要实时反映别的区域的改动，收起了就丢了核心反馈');
t.ok('可折叠名单不含 secOutput', !COLLAPSIBLE_SECS.includes('secOutput'), COLLAPSIBLE_SECS.join(','));
t.eq('可折叠名单正好是这 5 个', COLLAPSIBLE_SECS.slice().sort().join(','),
  ['secStyles', 'secSymbols', 'secWrap', 'secGradient', 'secPresets'].sort().join(','));

t.section('点标题收起/展开，class 和标题旁边的 panel 显隐要对上');
COLLAPSIBLE_SECS.forEach((id) => { dom.el(id).classList.add('toggle'); });
M.applyCollapsedSecs();
COLLAPSIBLE_SECS.forEach((id) => {
  t.ok(`${id} 默认展开（没有 collapsed）`, !dom.el(id).classList.contains('collapsed'));
  t.ok(`${id} 有原生 title 提示（箭头太小容易被忽略的兜底）`, dom.el(id).title.length > 0, dom.el(id).title);
});
t.ok('secOutput 没有被加上 title 提示（它压根不在可折叠名单里）', !dom.el('secOutput').title);

t.section('折叠状态落盘 + 重新加载后复原');
dom.el('secStyles').classList.add('collapsed');
M.collapsedSecs.add('secStyles');
M.saveCollapsedSecs();
M.collapsedSecs.clear(); // 模拟刷新页面，内存状态清空
M.loadCollapsedSecs();
t.ok('重新加载后 secStyles 还是折叠状态', M.collapsedSecs.has('secStyles'),
  [...M.collapsedSecs].join(','));
t.ok('没被存过的 secSymbols 不受影响', !M.collapsedSecs.has('secSymbols'));

t.section('坏数据不会把功能打崩——不是数组、混进不认识的 id 都要能兜住');
// 测试环境没有真的 localStorage，store.get/set 会 catch 到异常退回 MEM——
// 直接写 MEM 等价于模拟"localStorage 里存的是坏数据"。
M.collapsedSecs.clear();
M.MEM[COLLAPSE_KEY] = JSON.stringify({ not: 'an array' });
M.loadCollapsedSecs();
t.eq('不是数组时静默忽略，不抛错', M.collapsedSecs.size, 0);

M.MEM[COLLAPSE_KEY] = JSON.stringify(['secStyles', 'secOutput', '乱写的id']);
M.loadCollapsedSecs();
t.eq('未知 id（包括 secOutput 本身）会被过滤掉，只留认识的', [...M.collapsedSecs].join(','), 'secStyles');

/* 一键折叠按钮：之前只测过 applyCollapsedSecs/loadCollapsedSecs 这些状态函数，
 * 从没真的模拟点一下按钮——secStyles 标题外面套了 .secHeadWrap 之后，.panel
 * 不再是 h2 的下一个兄弟节点，第一版就是这么栽的，而这类"点了没反应"的问题
 * 只测状态函数测不出来，必须真的调用 .onclick()。 */
t.section('一键折叠按钮：模拟真实点击，不只测状态函数');
M.collapsedSecs.clear();
COLLAPSIBLE_SECS.forEach((id) => { dom.el(id).classList.add('toggle'); });
M.applyCollapsedSecs();
t.ok('按钮挂上了 onclick 处理函数', typeof dom.el('collapseAllBtn').onclick === 'function');

dom.el('collapseAllBtn').onclick();
t.ok('点一次后 5 个区块的标题都带上 collapsed', COLLAPSIBLE_SECS.every((id) => dom.el(id).classList.contains('collapsed')));
t.ok('对应的 5 个面板 style.display 也真的变成 none（不只是标题的 class）',
  COLLAPSIBLE_SECS.every((id) => panelOf(id).style.display === 'none'));
t.eq('collapsedSecs 同步成全部 5 个', [...M.collapsedSecs].sort().join(','), COLLAPSIBLE_SECS.slice().sort().join(','));
t.eq('按钮文字变成"全部展开"', dom.el('collapseAllBtn').textContent, '全部展开');

dom.el('collapseAllBtn').onclick();
t.ok('再点一次，5 个区块的 collapsed 都没了', COLLAPSIBLE_SECS.every((id) => !dom.el(id).classList.contains('collapsed')));
t.ok('5 个面板也都重新显示出来（style.display 不再是 none）',
  COLLAPSIBLE_SECS.every((id) => panelOf(id).style.display !== 'none'));
t.eq('collapsedSecs 清空', M.collapsedSecs.size, 0);
t.eq('按钮文字变回"全部收起"', dom.el('collapseAllBtn').textContent, '全部收起');

t.section('混合状态：全部收起后手动展开一个，点一键折叠要能把它也收进去');
dom.el('collapseAllBtn').onclick(); // 先全部收起
dom.el('secSymbols').onclick(); // 手动展开其中一个
t.ok('手动展开的那个区块不再是 collapsed', !dom.el('secSymbols').classList.contains('collapsed'));
t.ok('它的面板也真的重新显示了', panelOf('secSymbols').style.display !== 'none');
t.eq('按钮文字回到"全部收起"（因为不再是全收起状态）', dom.el('collapseAllBtn').textContent, '全部收起');
dom.el('collapseAllBtn').onclick();
t.ok('再点一键折叠，手动展开的那个也被收回去了', dom.el('secSymbols').classList.contains('collapsed'));
t.ok('它的面板也真的隐藏了', panelOf('secSymbols').style.display === 'none');
t.ok('5 个区块又全部 collapsed', COLLAPSIBLE_SECS.every((id) => dom.el(id).classList.contains('collapsed')));

module.exports = t.done();
