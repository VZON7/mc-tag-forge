'use strict';
/* 跑全部测试。每个 .test.js 都在独立子进程里跑 —— 它们各自会污染全局桩，
 * 同一进程里串跑会互相干扰。
 *
 * 用法：node tests/run-all.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();
let failed = [];

for (const f of files) {
  process.stdout.write('\n══════ ' + f + '\n');
  try {
    process.stdout.write(execFileSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' }));
  } catch (e) {
    process.stdout.write(e.stdout || '');
    process.stdout.write(e.stderr || '');
    failed.push(f);
  }
}

process.stdout.write('\n' + '═'.repeat(50) + '\n');
if (failed.length) {
  process.stdout.write('✗ 失败的测试文件：' + failed.join(', ') + '\n');
  process.exit(1);
}
process.stdout.write('✓ ' + files.length + ' 个测试文件全部通过\n');
