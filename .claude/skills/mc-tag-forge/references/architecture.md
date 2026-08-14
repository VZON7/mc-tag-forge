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
9. 双语（中/EN）
10. 像素字形引擎（Unifont 子集）

---

## 1. 数据表

| 名字 | 内容 | 注意 |
|---|---|---|
| `STYLES` | 34 种花体。`{n, up, lo, dg?, sp?, rev?, pre?}` | 连续 Unicode 区块**必须**用 `seq(码点)` / `digits(码点)` 生成，不手打 |
| `GAME` | 花体名 → `d`辨识度高 / `p`近似普通字 / `i`近似斜体 / `n`未实测 / `e`预组合 | 排序和角标都靠它 |
| `BADGE` | `GAME` 值 → 角标 HTML | |
| `WRAPS` | 12 个包裹模板 `[名, 前缀, 后缀]` | |
| `SYMS` / `SYMNOTE` | 11 类符号库 + 分类说明 | |
| `EMOJI_PROBE` | 由 `EMOJI_BLOCKS`（7 个标准 emoji 落座的连续 Unicode 区块）经 `emojiRange(a,b)` 穷举生成，过滤掉 `\p{Cn}`（未分配码位）后 1791 个单码点候选，每行 8 个，行号 `${tag}-${i+1}` 带分隔符 | 不手挑候选，整段区块生成——跟 `STYLES` 的 `seq()` 同一个原则；但区块连续不等于码位全部有字符，生成后必须过滤未分配码位，否则会把"这个字符不存在"和"资源包不支持这个字符"混成同一种"方块"结果，没法区分 |
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
- `r.mirror`（段落行「镜」按钮）：该段跳出共享的 `globalRamp`，改用 `localRampReversed(n)` ——把 `activeStops()` 反过来，在段落自己的字符数内均分独立跑一遍。`fix` 优先级高于 `mirror`（两者都开时按 `fix` 走，`cells()`/`codeOut()` 的判断顺序都是先查 `fix`）。默认 `mirror:false`，不勾选时行为和原来完全一致。
- **段落行 UI（2026-08-08 改版）**：原来每行有独立的「花体：无」下拉 + `l/o/n/m/k` 裸字母格式键 + 点了才长出一个新下拉的定色方块——用户反馈看不懂哪个按钮是什么、点定色会撑开挤到别的按钮。改法：① 去掉每行的花体下拉，花体统一在下面的大卡片面板选（点行→`renderStyles()` 高亮当前行的选中状态，跟以前一样，只是入口只剩一个）；② 格式键从裸字母改成 `FLABEL`（B/I/U/S/?）+ `FSTYLE`（按钮自己套上对应效果：B 真加粗、I 真斜体……），悬停文案在 `FNAME_ZH`/`FNAME_EN` 里，取的时候按 `S.lang` 挑，**不能**在模块顶层直接调 `t()` 拼好（同 STOPLABEL 那个坑）；③ 定色从「点方块切换 + 条件渲染一个新 select」改成 `.swatchwrap`：色块本身 `pointer-events:none` 纯展示，上面盖一层不可见的 `<select>`（`opacity:0`，同尺寸叠住）接点击，选单第一项固定是「渐变（关闭定色）」——点色块不会再让色块本身变宽、也不会把后面的↑↓×推走，取消定色也不用猜。

单段 + 无包裹时，输出与最早的两色/三色版本逐字节一致——改这条链务必跑回归。

- **输出代码可编辑+撤回（2026-08-11）**：`#code` 从只读 `<pre>` 改成 `<textarea>`，跟逆推面板的 `S.shotEdit`/`liveCode()` 同一套模式——`S.codeEdit`（null=自动生成，非 null=用户手改的字符串）、`liveOutCode()`（`S.codeEdit!==null ? S.codeEdit : codeOut()`，长度计/复制/超限判定全部走这个而不是直接调 `codeOut()`）、`#bCodeRevert` 按钮清空 `S.codeEdit`。改设计（换段落/花体/渐变/编码档位等）**不会**清掉手改内容，只有点撤回按钮或加载预设才清（预设整个状态被替换，旧手改代码对不上新设计，`Object.assign(S,...)` 后强制 `S.codeEdit=null`）。`render()` 里 `if(S.codeEdit===null) $('code').value=gen`——只在没手改时才把生成结果写回文本框，避免打字时光标被打断。
- **手改代码后预览联动（2026-08-11）**：`paintPreview()` 的取色源从固定 `cells(true)` 改成 `S.codeEdit!==null ? parseCode(S.codeEdit) : cells(true)`——`parseCode()` 本来就是逆推「复刻效果」在用的解析器（把 `{#xxx>}`/`&l` 这类代码解回逐字色+格式），直接复用即可，不用另写一套。`render()` 里 `$('ramp')`/`$('hexlist')`/`mVis` 都是从 `paintPreview()` 返回的同一个 `cs` 派生的，所以手改代码后色带、hex 列表也会跟着同步，不用分别处理。**范围内不含**下面的「段落」面板（文字输入框/花体/颜色滑块）——那些是设计状态 `S.runs`，手改任意代码不保证能唯一地反解回段落结构（同一段代码可能对应很多种切法），所以段落面板在手改时保持原样不动，只有预览图跟色带联动。`HOVER`（悬停花体卡片临时预览）在手改模式下会被手改内容盖过，这是预期行为，不是 bug——手改之后设计面板本来就不是当前真相来源了。

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
- 「最佳」= **最高分 3% 以内的最小 n**，不是最高分（多加色标几乎总能微涨，但每个多 7 格；容差取值依据见 SKILL.md 坑表）。
- `SHOT` 全局存 `{img, w, hh, glyphs, spans, fits}`。`spans` 用来画对齐色带。`fits` 是 `[{n, fit}]`，`fit.stops` 是下游唯一读的颜色来源。
- `shotCode()` / `shotCells()`：先调 `shotActive()` 统一解出"当前实际要用哪份颜色"，再各自处理断点单位。`shotActive()` 返回 `{stops, cuts, n, match, glyphSpace}`：`S.shotFit` 是 2/3/4 时读只读的 `SHOT.fits`（`glyphSpace:true`，`cuts` 是**有墨色阶下标**，要用 `mapShotCuts(cuts,map,n,gN)` 按比例换算成字符下标）；`S.shotFit==='custom'` 时读 `S.shotCustom`（`glyphSpace:false`，`cuts` **已经是字符下标**，直接 `customBounds(n)` clamp 就行，不用再换算）。`mapShotCuts` 是纯函数，1:1 时等价于直接对应；**不能**假设色阶数跟手打字数相等（框选常连装饰符号一起框进去，色阶数会远多于裸名字字数），那样会导致断点全部 clamp 到同一个字符、中间色标消失。
- `S.shotEdit` 非 null 表示用户手改过**代码文本框**，此后自动生成不再覆盖；`liveCode()` 返回当前生效的版本。这跟下面的「我的配色」是两层不同的手改——一个改最终代码字符串，一个改喂给 `shotCode()` 的颜色/断点输入。
- **我的配色**（`S.shotCustom = {nStops, stops, cuts}`，形状故意跟创作模式的 `S.nStops/S.stops/S.cuts` 一致）：自动拟合的 2/3/4 色三行**永远只读**，不会被手改——之前是直接改 `fit.stops`，改坏了看不到原始拟合结果，也没法跟自己调的版本对比。现在改的是这份独立拷贝：点某一行的「套用微调」调 `seedCustomFrom(n, fit)` 从那行拷贝一份起点（stops 按 2/3/4 展开成 4 格，cuts 从色阶空间转一次到字符空间，转完之后就一直留在字符空间），改完可以随时回头看原始三行对比。`renderShotEditor()`/`syncShotPicker()`/`setShotStop()` 复刻创作模式的 `STOPIDX`/`STOPLABEL`/HSV 取色器（各自 DOM id 加 `Shot` 后缀，两个面板互斥所以能共存），`renderCustomCuts()` 复刻 `renderCuts()` 的断点滑块，都直接读写 `S.shotCustom`。`activeCustomStops()`/`customBounds()` 分别对应创作模式的 `activeStops()`/`bounds()`。`renderShot()` 每次重新提取（新图/新框选）都会用当次的 `bestN` 重新 `seedCustomFrom`，旧手调随之作废——这是预期行为，跟 `S.shotEdit`/`S.shotPk` 的重置逻辑一致。`shotApply()`（套用配色去创作）统一走 `shotActive()`，custom 分支的 cuts 已经是字符下标可以直接当 `S.cuts` 用，auto 分支沿用改之前就有的"色阶下标直接塞给创作模式"这个不太精确但会被 `bounds()` 自愈的旧行为，没特意去修。
- **取色笔**：自动拟合对任意截图（不是渐变文字，比如背包 GUI）没有防呆——它不验证"这像不像渐变"，只会无条件拟合出一条曲线，分数还可能很高（因为像素本来就很接近同一色）。取色笔是给这种场景的退路：模块级 `EYEDROP` 开关（不进 `S`，纯 UI 态），开着时 `srcCanvas` 的 `pointerdown`/`pointermove` 走取色分支而不是裁框分支——画布是整数倍近邻缩放画的（`imageSmoothingEnabled=false`），显示像素跟原图像素一一对应，直接 `getImageData` 读，不用换算坐标。点一下调 `setShotStop()` 写入「我的配色」当前选中的色标（`S.shotPk`），同时把 `S.shotFit` 切到 `'custom'`。`renderShot()` 重建整个面板时新 DOM 不认得旧的 `EYEDROP` 值，靠 `syncEyedropUI()` 在重建后重新同步按钮高亮/读色条显示/光标样式——忘记这一步的话开关状态和实际行为会对不上。

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

## 9. 双语（中/EN）

`S.lang` ∈ `'zh'|'en'`，页头「EN/中」按钮切换，调用 `applyLang()`。

- **动态生成的文字**（render* 系列函数里拼出来的 HTML/文案）：直接在调用处用 `t(zh,en)`（`const t=(zh,en)=>S.lang==='zh'?zh:en`）取值，两种语言写在一起方便对照，不用另开一张大字典表维护。
- **写死在 HTML 里、JS 不会再碰的静态标签**（section 标题、说明文字、按钮文案）：给元素配 `id`，登记进 `STATIC_I18N`（纯文字，`textContent`）或 `STATIC_HTML_I18N`（带 `<b>`/`<span class=badge>` 这类内嵌标签，`innerHTML`），`applyStaticI18n()` 统一刷。
- **会被多处复用的名字**（花体名、包裹名、符号分类、传统色码名、配色预设名）：改在各自数据表里加 `en` 字段（`STYLES[i].en`）或平行的 `_EN` 映射表（`SYM_CAT_EN`、`LEGNAME_EN`），内部 key（`S.cat`、`GAME`/`DUP_OK` 的查表 key）继续用中文不变，只是显示的时候查 `en`。改动风险低——不动内部逻辑，纯加字段。
- **两个坑**：
  1. 模块顶层 `const` 如果在定义时就调 `t(...)`（比如 `const STOPLABEL={2:[t('起','Start'),...]}`），只会在脚本加载那一刻求值一次，之后切语言不会重新跑，会卡死在启动时的语言上。必须存成 `{zh:[...],en:[...]}` 两套，取用时按 `S.lang` 查，不能在定义处直接调 `t()`。
  2. 引入全局 `t()` 之后，几个函数原本用 `t` 当局部变量名（`newRun(t)`、`hsv2hex` 内部、`lerp(a,b,t)`、`toast` 里的 DOM 元素）——这些是**参数/局部变量遮蔽**，虽然函数体没调全局 `t()` 所以当时没坏，但极易在后续维护里踩到"改了这个函数却发现 t() 不生效"。已经全部改名（`newRun(txt)`、`lerp(a,b,pt)` 等）。以后新写函数**不要再用 `t` 当参数名**。
- **切换流程**：`applyLang()` 依次做——设置语言胶囊/主标题、跑 `applyStaticI18n()`、手动同步几个不经过标准 render 流程的动态按钮文案（`dockToggle`/`glyphSys`/`glyphPix`，这些平时由各自的 onclick handler 维护，不在 `render()` 里）、重新跑 `auditStyles()`/`renderGradPresetOptions()`/`renderRuns()`/`renderStops()`/`renderSyms()`/`render()`/`renderPresets()`，如果逆推面板正开着（`SHOT&&SHOT.img`）额外调 `reExtract()` 整块重建（`renderShot()` 的模板字符串太大，重新提取一遍比单独维护一套"只换文字"的补丁便宜）。

## 10. 像素字形引擎（Unifont 子集）

「字形：像素」模式不再靠系统里凑巧长得像素风的字体（`Silkscreen`/`Press Start 2P`）去猜，而是直接用 **GNU Unifont** 的真实位图字形画，跟游戏内观感一致。

- **数据来源**：`unifoundry.com` 发布的 `unifont_all-VERSION.hex`（SIL OFL 1.1 / GNU GPLv2+font-exception 二选一再分发），文本格式，每行 `六位十六进制码位:位图十六进制`。8px 宽字形是 32 个十六进制字符（16 字节，每行 1 字节），16px 宽字形是 64 个（32 字节，每行 2 字节）。位序已用大写字母 `A`（`0000000018242442427E424242420000`）核对过：每字节 bit7=最左像素、bit0=最右像素，字节从左到右排。
- **只抽子集，不嵌整个字体**：完整 Unifont 覆盖 10 万+ 字形，塞进单文件不现实。只抽本工具真正用得到的码位——`STYLES` 表全部花体字母/数字输出、`SYMS` 符号库、`EMOJI_PROBE` 的全部候选、外加基本 ASCII/Latin-1/常用标点（给没套花体、原样打字的场景兜底）。当前一共 3547 个，压缩后（打包成二进制、base64 编码）大约 130KB，写进 `GLYPH_CP_DELTA`（码位差分表，36 进制）/`GLYPH_W_B64`（宽度位图）/`GLYPH_BLOB_B64`（逐字形位图数据）三个常量，`decodeGlyphData()` 启动时解一次，存进模块级 `GLYPHS.map`（码位→`{width,offset,len}`）。
- **改了 STYLES/SYMS/EMOJI_PROBE 之后要重新抽子集**——`tests/glyphs.test.js` 里有个覆盖率测试就是防这个事的，加了新花体/新符号却忘记重新跑抽取脚本，这个测试会先炸。抽取脚本没留在仓库里（一次性用完的工具脚本，产出的三个常量已经在正文里），下次要重抽的话，流程是：①算出新的所需码位集合（跟测试里的 `need` 逻辑一样）②下载 `unifont_all-*.hex.gz` 解压 ③按码位过滤出对应行 ④按码位排序、差分编码、位图拼成二进制再 base64 ⑤替换正文里那三个常量。
- **渲染**：`drawGlyph(ctx,cp,x,y,scale,color,italic)` 逐像素 `fillRect`；`drawPixelPreview(cs)` 逐字符量宽度、算总宽度、设置 canvas 尺寸，然后逐字符画阴影(25% 亮度、偏移 1px)+本体。粗体是「正常位置画一遍、右移 1px 再画一遍」——位图字体常见的假粗体手法，MC 自己也是这么实现的。斜体是逐行错位（越靠顶部错位越多），不追求跟游戏内算法逐像素一致，只求看着像斜体。下划线/删除线画成实心横条。混淆（`&k`）靠 `PIXEL_K_CHARS`（跟 cells 顺序对齐的数组）记录当前显示哪个随机字符，`setInterval` 里如果发现处于像素模式就整体清空重画，复用原本给文字模式 `.k` 跳字用的同一个计时器。
- **缺字形**：理论上不会发生（码位表已覆盖全部用到的字符），万一发生就画一个空心方框占位，不静默跳过——跳过会让用户以为字符消失了。
- **`paintPreview()` 分支**：`S.pixel` 为真时隐藏 `#pv`、显示 `#pvCanvas` 并调 `drawPixelPreview`；否则走原来的 innerHTML 文字方案。**目前只接了创作模式顶部这一个预览**，逆推面板的「复刻效果」（`renderRepro()`/`#repro`）还是旧的文字方案，没有跟着换成位图——如果要保持两边观感一致，这是下一步。
- **测试桩踩过的坑**：`tests/lib/dom.js` 原来的 `document.getElementById` 桩，`getContext()` 每次都 `makeCanvas()` 生成一个全新、跟外层元素不相干的画布，外面设的 `canvas.width/height` 对内部实际画图用的对象毫无影响，`fillRect` 循环直接空转但不报错——这种"跑起来不报错但什么都没测到"的桩，比直接报错更危险。改法：`makeCanvas(target)` 接收一个已有对象直接把画布能力挂上去，`mk()` 生成 stub 时 `getContext(kind){ return makeCanvas(el).getContext(kind); }` 绑定回 `el` 自己。
