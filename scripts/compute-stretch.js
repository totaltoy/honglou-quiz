/* 计算各维度用户得分的分位数，用于把用户云拉伸到铺满 0-5 坐标系 */
const fs = require("fs");
const path = require("path");
(0, eval)(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") + "\nglobalThis.__D={DIMS,QUESTIONS};");
const { DIMS, QUESTIONS } = globalThis.__D;
const D = DIMS.length;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(7);

const OPT = QUESTIONS.map((q) => q.options.map((o) => DIMS.map((d) => o.score[d] || 0)));
const MAXD = DIMS.map((_, i) => QUESTIONS.reduce((s, q) => s + Math.max(0, ...q.options.map((o) => o.score[DIMS[i]] || 0)), 0));

const N = 2000000;
const buckets = DIMS.map(() => new Float64Array(101)); // 每维 0-100 分桶（0.5% 精度）
const acc = new Array(D);
for (let k = 0; k < N; k++) {
  acc.fill(0);
  for (let i = 0; i < QUESTIONS.length; i++) {
    const o = OPT[i][(rand() * 4) | 0];
    for (let d = 0; d < D; d++) acc[d] += o[d];
  }
  for (let d = 0; d < D; d++) {
    const pctOfMax = (acc[d] / MAXD[d]) * 5 / 5; // 0~1
    buckets[d][Math.min(100, Math.round(pctOfMax * 100))]++;
  }
}

console.log("维度  p50(pctOfMax)  p90  p95  p97  p99  → 拉伸系数 K = 5 / (p95*5) = 1/p95");
for (let d = 0; d < D; d++) {
  const at = (p) => { let t = N * p, c = 0; for (let b = 0; b <= 100; b++) { c += buckets[d][b]; if (c >= t) return b / 100; } return 1; };
  const p50 = at(0.5), p90 = at(0.9), p95 = at(0.95), p97 = at(0.97), p99 = at(0.99);
  console.log(DIMS[d] + "  " + p50.toFixed(2) + "  " + p90.toFixed(2) + "  " + p95.toFixed(2) + "  " + p97.toFixed(2) + "  " + p99.toFixed(2) + "  → K=" + (1 / p95).toFixed(2));
}
