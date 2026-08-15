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

module.exports = t.done();
