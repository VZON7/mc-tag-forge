# Minecraft 标签锻造台

单文件 HTML 工具，用来设计 Minecraft 物品名 / 昵称的渐变彩色标签。目标服务器 HoloCraft，语法为 EssentialsX 渐变标签。

替代掉原来的流程：三个网站选花体字 / 找符号 / 试颜色，再回铁砧一个个粘贴试效果。

## 用法

**看效果**：双击 `mc-tag-forge.html`，用浏览器打开就行，不需要装任何东西。

**跑测试**：需要 [Node.js](https://nodejs.org/) 18 以上。

```
node tests/run-all.js
```

零依赖，不用 `npm install`。

## 两个模式

**创作** —— 段落（每段自己的花体和格式）、34 种花体、11 类符号、12 种包裹、2/3/4 色渐变、三档颜色编码、实时长度计和省字建议。

**逆推** —— 贴进别人标签的截图（Ctrl+V 直接粘贴），在图上拖框选出要取色的那一行，自动逐字取色、拟合色标、生成完整代码。代码框可以手改，改完上面的复刻预览会跟着变。

## 关键事实速查

这些都是在游戏里实测出来的，改代码前先看一眼，别重新推导。

| | |
|---|---|
| anvil 改名上限 | **50**，数的是 **UTF-16 单元** |
| emoji / 增补平面字符 | **2 格**（BMP 字符 1 格） |
| 标签成本 | `{#rrggbb>}` 10 格 · `{#rgb>}` 7 格 · `{#&9>}` 6 格 |
| 三位简写 | 按 CSS 逐位翻倍展开（`b` → `bb`） |
| 色标数量 | **最多可到 4 色以上**，一串里能有多个 `{#x<>}` |
| 渐变算法 | 逐字线性 RGB 插值，每段独立跑满全程 |
| 颜色代码 | **会重置格式**，所以每段都要重新发 `&l` 之类 |
| 每多一段 | 约 +14 格（各自要开一对渐变标签） |
| 包裹 | 只花字符本身的钱（并进首尾段，不另开标签） |
| 组合符 | MC 不做组合符定位，会往右飘一格且占 2 格 —— **别用**，改用预组合字符 |
| 花体 | 34 种在 HoloCraft 全部能渲染，零方框；但 8 种在游戏里跟普通字/斜体分不出来 |
| `/emoji` 短代码 | 只在聊天生效；物品名要用字符本体 |

## 仓库结构

```
mc-tag-forge.html                     工具本体，约 850 行，无后端无依赖
.claude/skills/mc-tag-forge/          Claude Code 会自动加载的项目 skill
  SKILL.md                            已验证事实 / 不能踩的坑 / 待办
  references/architecture.md           代码结构，改代码前读
tests/
  run-all.js                          跑全部
  encoding.test.js                    三档编码、长度、N 色渐变
  styles.test.js                      花体表完整性（PRGME 事故回归）
  segments.test.js                    段落、定色、包裹、代码解析器
  reverse.test.js                     逆推精度
  lib/png.js                          零依赖 PNG 解码（用 node 内置 zlib）
  lib/dom.js                          DOM/canvas 桩 + 从 html 抽 script 当模块
  lib/t.js                            断言
  fixtures/                           四张真实游戏截图
```

## 为什么有 fixtures

`tests/fixtures/` 里那四张截图是整个仓库最有价值的东西。逆推涉及缩放探测、界面 chrome 剔除、阴影剔除、端点剪裁、色标拟合五层启发式，任何一层退化都会让结果悄悄变差而不报错——只有拿真实截图跑才发现得了。

| 截图 | 真实结构 | 当前吻合度 |
|---|---|---|
| takodachi-2color | 2 色（完整 tooltip，需框选） | 97.65% |
| korone-2color | 2 色 | 99.03% |
| cottagecrisps-3color | 3 色 | 99.86% |
| notmyear-3color | 3 色 | 92.91% |

其中 takodachi 那张的逐字色被断言到**字节级精确**，对照的是手工逐像素提取的结果。

## 待办

见 `.claude/skills/mc-tag-forge/SKILL.md` 末尾。
