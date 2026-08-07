'use strict';
/* 极简断言。重点是失败要真的失败（非零退出码），
 * 而不是像早期那批临时脚本一样只把结果打出来 —— 打出来没人看就等于没测。 */
const out = (s) => process.stdout.write(s + '\n');
let pass = 0, fail = 0, group = '';

function section(name) { group = name; out('\n── ' + name); }

function ok(label, cond, detail) {
  if (cond) { pass++; out('  ✓ ' + label + (detail ? '  ' + detail : '')); }
  else { fail++; out('  ✗ ' + label + (detail ? '  ' + detail : '')); }
}

function eq(label, got, want) {
  const g = typeof got === 'object' ? JSON.stringify(got) : String(got);
  const w = typeof want === 'object' ? JSON.stringify(want) : String(want);
  ok(label, g === w, g === w ? '' : `\n      得到 ${g}\n      预期 ${w}`);
}

function near(label, got, want, tol) {
  const d = Math.abs(got - want);
  ok(label, d <= tol, `${got} vs ${want}（容差 ${tol}，差 ${d.toFixed(2)}）`);
}

function info(s) { out('    ' + s); }

function done() {
  out(`\n${fail ? '✗ 失败' : '✓ 全部通过'}：${pass} 通过，${fail} 失败`);
  if (fail) process.exitCode = 1;
  return fail === 0;
}

module.exports = { section, ok, eq, near, info, done, out };
