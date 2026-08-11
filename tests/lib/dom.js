'use strict';
/* mc-tag-forge.html 是单文件 HTML，没有浏览器也要能测。
 * 这里桩掉它用到的全部宿主 API，然后把 <script> 抽出来当模块 require。
 *
 * 两个坑（都踩过）：
 *  1. canvas 桩必须真的实现 drawImage 的最近邻缩放和 getImageData，
 *     否则逆推那套完全测不出东西，只会静默返回空结果。
 *  2. querySelectorAll 按 class 查询时，必须把同一标签上的 data-* 带到
 *     返回对象的 dataset 上。否则 renderStyles 里 +b.dataset.i 拿到 NaN，
 *     hover 之类的逻辑看着"通过"其实根本没跑。
 */
const fs = require('fs');
const path = require('path');

function makeCanvas(target) {
  // target 有传的话（比如 mk() 生成的普通 stub 元素）就直接把画布能力接到它身上，
  // 不能每次 getContext() 都 new 一个不相干的画布——那样 width/height 设在外面那个
  // 元素上，实际画的时候用的是另一个对象的 0/0，fillRect 循环直接空转。
  const c = target || { width: 0, height: 0, _img: null, style: {} };
  c._pixels = c._pixels || null;
  Object.assign(c, {
    getContext() {
      const ensure = () => {
        if (!c._pixels || c._pixels.length !== c.height) {
          c._pixels = Array.from({ length: c.height }, () => new Array(c.width).fill(null));
        }
      };
      const ctx = {
        imageSmoothingEnabled: true,
        fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1,
        // 逆推那边靠 drawImage/getImageData 读像素；像素预览那边靠 fillRect/clearRect 画像素。
        // 两套桩共用同一个 c._pixels 网格，fillRect 的桩是给 drawGlyph 测试用的，
        // 用真实二维网格记录颜色，而不是只判断"调用没报错"——否则字形位置错了也测不出来。
        drawImage(src, x, y, dw, dh) {
          const s = src._img || src;
          if (dw === undefined) { c._img = s; return; }
          const out = new Uint8ClampedArray(dw * dh * 4);
          for (let yy = 0; yy < dh; yy++) for (let xx = 0; xx < dw; xx++) {
            const sx = Math.floor(xx * s.width / dw), sy = Math.floor(yy * s.height / dh);
            const si = (sy * s.width + sx) * 4, di = (yy * dw + xx) * 4;
            for (let k = 0; k < 4; k++) out[di + k] = s.data[si + k];
          }
          c._img = { data: out, width: dw, height: dh };
        },
        getImageData() { return c._img; },
        fillRect(x, y, w, h) {
          ensure();
          for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(c.height, y + h); yy++)
            for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(c.width, x + w); xx++)
              c._pixels[yy][xx] = ctx.fillStyle;
        },
        clearRect(x, y, w, h) {
          ensure();
          for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(c.height, y + h); yy++)
            for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(c.width, x + w); xx++)
              c._pixels[yy][xx] = null;
        },
        strokeRect() {}, // 缺字形占位框，测试不依赖这个，先留空避免报错
      };
      return ctx;
    },
  });
  return c;
}

function install() {
  const store = {};
  const mk = (id) => {
    if (store[id]) return store[id];
    const el = {
      _id: id, _h: '', _t: '', value: '', selectionStart: 0,
      style: {}, dataset: {}, disabled: false,
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); },
        remove(c) { this._s.delete(c); },
        toggle(c, v) {
          if (v === undefined) this._s.has(c) ? this._s.delete(c) : this._s.add(c);
          else v ? this._s.add(c) : this._s.delete(c);
          return this._s.has(c);
        },
        contains(c) { return this._s.has(c); },
      },
      querySelector(sel) {
        const m = /\[data-([a-z]+)\]/.exec(sel);
        if (m) {
          const g = new RegExp('data-' + m[1] + '="([^"]*)"').exec(el._h);
          if (!g) return null;
          const e = mk(el._id + '>' + m[1] + g[1]);
          e.dataset[m[1]] = g[1];
          return e;
        }
        return mk(id + sel);
      },
      querySelectorAll(sel) {
        const m = /\[data-([a-z]+)(?:="([^"]*)")?\]|\.([\w-]+)/.exec(sel);
        if (!m) return [];
        if (m[3]) {
          const re = new RegExp('<[^>]*class="[^"]*\\b' + m[3] + '\\b[^"]*"[^>]*>', 'g');
          return (el._h.match(re) || []).map((tag, i) => {
            const e = mk(id + '.' + m[3] + i);
            let d; const dre = /data-([a-z]+)="([^"]*)"/g;
            while ((d = dre.exec(tag))) e.dataset[d[1]] = d[2];
            // 让 fitrow 之类能 querySelector 到自己的子按钮
            e._h = tag;
            return e;
          });
        }
        const re = new RegExp('data-' + m[1] + '="([^"]*)"', 'g');
        const out = []; let g;
        while ((g = re.exec(el._h))) {
          const e = mk(id + '[' + m[1] + g[1] + ']');
          e.dataset[m[1]] = g[1];
          e._h = '<button data-pick="' + g[1] + '"></button>';
          out.push(e);
        }
        return out;
      },
      focus() {}, setSelectionRange() {}, click() {}, addEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      setPointerCapture() {}, hasPointerCapture: () => false,
      width: 0, height: 0,
      getContext(kind) { return makeCanvas(el).getContext(kind); },
    };
    Object.defineProperty(el, 'innerHTML', { get() { return el._h; }, set(v) { el._h = v; } });
    Object.defineProperty(el, 'textContent', { get() { return el._t; }, set(v) { el._t = v; } });
    return store[id] = el;
  };

  let copied = '';
  // Node 22 起 navigator 是只读全局，直接赋值会抛 TypeError，必须 defineProperty
  const setGlobal = (name, value) => {
    try { global[name] = value; }
    catch (e) { Object.defineProperty(global, name, { value, writable: true, configurable: true }); }
  };
  setGlobal('console', { log() {}, info() {}, warn() {}, error() {} }); // 沙箱方法不全，测试也别依赖
  setGlobal('document', {
    getElementById: mk,
    createElement: (t) => t === 'canvas' ? makeCanvas() : { style: {}, select() {}, remove() {} },
    querySelectorAll: () => [],
    body: { appendChild() {} },
  });
  setGlobal('navigator', { clipboard: { writeText(v) { copied = v; return Promise.resolve(); } } });
  setGlobal('window', { scrollY: 0, scrollTo() {}, addEventListener() {} });
  setGlobal('URL', { createObjectURL: () => '', revokeObjectURL() {} });
  setGlobal('Image', class {});
  setGlobal('setTimeout', () => {});
  setGlobal('setInterval', () => {});
  setGlobal('matchMedia', () => ({ matches: true }));

  return { el: mk, get copied() { return copied; } };
}

/* 把 mc-tag-forge.html 里的 <script> 抽出来，加上导出，当模块加载 */
function loadTool(exportNames) {
  const root = path.resolve(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'mc-tag-forge.html'), 'utf8');
  const m = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('mc-tag-forge.html 里找不到 <script>');
  const tmp = path.join(require('os').tmpdir(), 'mctf-' + process.pid + '-' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(tmp, m[1] + '\nmodule.exports={' + exportNames.join(',') + '};\n');
  try { return require(tmp); } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

module.exports = { install, loadTool, makeCanvas };
