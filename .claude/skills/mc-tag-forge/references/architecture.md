# mc-tag-forge.html 架构

改代码前读这份，不要通读 800 行去摸索。单文件、无后端、无外部依赖。

## 目录

1. 数据表
2. 编码三档
3. 组装链（段落 → 逐字色 → 代码）
4. 渐变（N 色标）
5. 逆推（截图 → 色标）
6. 代码解析器
7. 渲染分层
8. 测试方法

---

## 1. 数据表

| 名字 | 内容 | 注意 |
|---|---|---|
| `STYLES` | 34 种花体。`{n, up, lo, dg?, sp?, rev?, pre?}` | 连续 Unicode 区块**必须**用 `seq(码点)` / `digits(码点)` 生成，不手打 |
| `GAME` | 花体名 → `d`辨识度高 / `p`近似普通字 / `i`近似斜体 / `n`未实测 / `e`预组合 | 排序和角标都靠它 |
| `BADGE` | `GAME` 值 → 角标 HTML | |
| `WRAPS` | 12 个包裹模板 `[名, 前缀, 后缀]` | |
| `SYMS` / `SYMNOTE` | 11 类符号库 + 分类说明 | |
| `EMOJI_PROBE` | 三批 emoji 候选（A Hololive / B MC 通用 / C BMP） | |
| `LEGACY` / `LEGNAME` | 16 个传统色码 → hex / 中文名 | |
| `FLIP` | 倒转花体的括号镜像表 | |
| `GRADS` | 配色预设，前 5 条是从真实截图逆推的实测值 | |

`apply(st, s)` 是唯一的花体应用入口：`pre`（预组合查表）→ `comb`（组合符，已废弃）→ 常规大小写数字映射 → `rev`（反转 + 括号镜像）。

`auditStyles()` 在启动时验证每张表 26 码点且无意外重复，结果写进 `#audit`。`DUP_OK` 是允许重复的花体白名单（希腊仿字、符文、古意大利等本来就有多对一映射）。

## 2. 编码三档

`S.enc` ∈ `hex6` / `hex3` / `leg`。

- `to3(hex)` → 三位（每通道 `round(v/17)`）
- `exp3(s)` → 三位展开回六位（逐位翻倍）
- `legOf(hex)` → 最近的传统色码（RGB 欧氏距离）
- `effective(hex)` → 该档下**实际会渲染出来**的颜色，预览必须用这个而不是理想值
- `tag(hex, suf)` → 生成 `{#...>}` / `{#...<>}` / `{#...<}`

`lens()` 临时切三档各算一遍长度，用于长度对比行。

## 3. 组装链

```
S.runs[] + S.wrap  →  blocks(hover)  →  cells(hover)  →  paintPreview / render
                                    →  codeOut()
```

- `blocks(hover)`：段落套上花体，包裹算作首尾两个无格式块。**`hover` 参数只有预览路径传 true**，输出路径永不传（否则悬停花体卡片时会复制到错误代码）。
- `cells(hover)`：把全局渐变按字符切给各块，返回 `[{ch, col, f}]`。
- `codeOut()`：每段各开一个渐变标签；纯颜色断点（段落边界与色标断点重合、格式相同）合并成 `{#x<>}`。`fix` 段用传统色码只占 2 格。

单段 + 无包裹时，输出与最早的两色/三色版本逐字节一致——改这条链务必跑回归。

## 4. 渐变（N 色标）

- `S.nStops` ∈ 2/3/4，`S.stops` 恒为 4 元数组，`activeStops()` 取出实际用到的
- `S.cuts` 是内部断点（长度 `nStops-2`），`bounds(total)` 做校验和越界重新均分
- `globalRamp(total)` 按 `bounds` 分段，各段 `rampN` 独立跑满全程

取色器：`hex2hsv` / `hsv2hex`（往返无损，测过 6 色）、`drag(el, cb)` 用 pointer capture 所以拖出边界不断、`syncPicker()` 刷新方块背景和旋钮位置。色标用 chips 切换，`S.pk` 记当前选中的色标下标。

## 5. 逆推

```
detectScale → extractGlyphs → fitStops → (用户填文字) → shotCode / shotCells
```

- `detectScale(d,w,h)`：用**水平同色游程长度的可整除性**判断，跟裁切相位无关（早期版本用「s×s 方块同色」，裁过的图必然失败）。结果只用于告知用户，**不作为任何前置条件**。
- `extractGlyphs(img)`：逐列取最亮墨色（阴影是 25% 亮度，必然更暗），按**颜色变化**切分而非按空列切分（所以笔画粘连也能分开）。三道剔除：
  1. `chrome[]` —— 单行内超过 `RUNMAX` 的同色游程 = tooltip 边框 / 界面底条
  2. `isShadow[]` —— 存在另一候选色约等于我的 4 倍 → 我是阴影
  3. 端点剪裁 —— 相邻色差 > 中位步长×3.5 → 界面杂色，两端各最多剪 3 个
- `fitStops(cols, n)`：暴力扫描内部断点，最小化逐通道平均绝对误差，返回 `{stops, cuts, err, match}`。`match` = `100 - err/255*100`。
- 「最佳」= **最高分 1.5% 以内的最小 n**，不是最高分（多加色标几乎总能微涨，但每个多 7 格）。
- `SHOT` 全局存 `{img, w, hh, glyphs, spans, fits}`。`spans` 用来画对齐色带。
- `shotCode()` / `shotCells()`：`fit.cuts` 的单位是**有墨字符下标**（空格不产生色阶），要跳过空格换算回真实字符位置。
- `S.shotEdit` 非 null 表示用户手改过代码，此后自动生成不再覆盖；`liveCode()` 返回当前生效的版本。

## 6. 代码解析器

`parseCode(code)` → `[{ch, col, f}]`。支持 `{#rrggbb|rgb|&x}` 配 `>` / `<>` / `<`、`&l&o&n&m&k`、`&r`、`&0-&f`。

存在的理由：用户手改代码后预览必须跟着变，否则对比失效。副作用是代码框可以当通用预览器用——贴任何人的代码都能看效果。

已用四种真实代码往返验证，四色那条解析出的 12 个色阶与游戏实测逐字节一致。

## 7. 渲染分层

| 函数 | 职责 |
|---|---|
| `paintPreview()` | **只**画顶部 tooltip，返回 cells。hover 时只调这个，避免重建卡片导致鼠标目标丢失 |
| `render()` | 调 `paintPreview` + 色阶条 + hex 表 + 代码 + 计数 + 建议 + 各面板 |
| `renderRuns()` | 段落行（单行一段）。`tintRuns()` 只更新序号颜色，不重建 DOM |
| `renderStyles()` | 花体卡片网格，带 hover 预览 |
| `renderStops()` / `syncPicker()` / `renderCuts()` | 渐变面板 |
| `renderShot*()` | 逆推面板 |
| `saveHints()` | 超限时按可省格数排序给建议 |
| `setMode2('C'\|'R')` | 顶层模式切换，逆推时自动收起段落行 |

`HOVER` 是模块级变量，只有 `blocks(true)` 会读它。

## 8. 测试方法

没有浏览器，用 node 桩测。已有 `test5`–`testD` 系列，模式：

1. 用 python/PIL 把真实截图的像素 dump 成 JSON
2. node 里桩掉 `document` / `canvas` / `navigator` / `window` / `Image` / `matchMedia`
3. canvas 桩要**真的实现** `drawImage` 的最近邻缩放和 `getImageData`，否则逆推测不出东西
4. DOM 桩的 `querySelectorAll` 要能解析 `[data-x]` 和 `.class`，并把同标签上的 `data-*` 带到返回对象的 `dataset` 上（否则 handler 拿到 `NaN`，hover 之类的逻辑测不到）
5. 把 script 抽出来 + 追加 `module.exports = {...}` 再 `require`

**必跑的回归**：单段输出与旧版逐字节一致、四张真实截图（Takodachi 2色 / Korone 2色 / cottagecrisps 3色 / THAT'S NOT MY EAR 3色）的色标数量判定全对、段落删除边界、hover 不污染输出。

沙箱 console 方法不全，桩里用 `process.stdout.write` 而不是 `console.log`。
