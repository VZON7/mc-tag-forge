'use strict';
/* 最小 PNG 解码器 —— 零依赖，只用 node 内置 zlib。
 *
 * 存在的理由：逆推的回归测试需要真实截图的像素。用 npm 装解码库会让
 * "clone 下来就能跑测试" 变成 "先 npm install"，而这个仓库刻意保持零依赖。
 *
 * 只支持 8 位、非隔行、颜色类型 2(RGB) 和 6(RGBA) —— fixtures 全是这两种。
 * 遇到别的格式直接抛错，不做静默降级（静默降级会让测试假装通过）。
 */
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(path) {
  const buf = fs.readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`不是 PNG: ${path}`);

  let pos = 8, ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        depth: data[8], colorType: data[9], interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error('缺少 IHDR');
  const { width, height, depth, colorType, interlace } = ihdr;
  if (depth !== 8) throw new Error(`只支持 8 位色深，这张是 ${depth}`);
  if (interlace !== 0) throw new Error('不支持隔行 PNG');
  if (colorType !== 2 && colorType !== 6)
    throw new Error(`只支持颜色类型 2/6，这张是 ${colorType}`);

  const ch = colorType === 2 ? 3 : 4;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = new Uint8ClampedArray(width * height * 4);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    // 反解 PNG 的 5 种行滤波器
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0;   // 左
      const b = prev[i];                      // 上
      const c = i >= ch ? prev[i - ch] : 0;   // 左上
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const s = x * ch, d = (y * width + x) * 4;
      out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2];
      out[d + 3] = ch === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { width, height, data: out };
}

/* 返回工具代码期待的形状：既能当 <img> 用，也能当源像素用 */
function loadImage(path) {
  const img = decodePNG(path);
  return Object.assign({}, img, { _img: img });
}

module.exports = { decodePNG, loadImage };
