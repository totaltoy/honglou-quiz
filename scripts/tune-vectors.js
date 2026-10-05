/* 角色向量自动调参器 v2：弱角色逐个爬坡。
 * 每个占比 <9% 的角色，朝多个质量中心方向以 0.5 步长爬坡，
 * 只要自身占比上升即接受；约束：每维偏离种子 ≤1.5、总偏离 ≤3、值域 [0,5]。 */
const fs = require("fs");
const path = require("path");
(0, eval)(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") + "\nglobalThis.__D={DIMS,QUESTIONS,CHARACTERS};");
const { DIMS, QUESTIONS, CHARACTERS } = globalThis.__D;

const D = DIMS.length, C = CHARACTERS.length;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const OPT = QUESTIONS.map((q) => q.options.map((o) => DIMS.map((d) => o.score[d] || 0)));
const MAXD = DIMS.map((_, i) => QUESTIONS.reduce((s, q) => s + Math.max(0, ...q.options.map((o) => o.score[DIMS[i]] || 0)), 0));

const N = 500000;
const rand = mulberry32(42);
const users = new Float32Array(N * D);
const acc = new Array(D);
for (let k = 0; k < N; k++) {
  acc.fill(0);
  for (let i = 0; i < QUESTIONS.length; i++) {
    const o = OPT[i][(rand() * 4) | 0];
    for (let d = 0; d < D; d++) acc[d] += o[d];
  }
  for (let d = 0; d < D; d++) users[k * D + d] = (acc[d] / MAXD[d]) * 5;
}

function evaluate(vec) {
  const cnt = new Array(C).fill(0);
  const winSum = new Float64Array(C * D);
  for (let k = 0; k < N; k++) {
    let best = -1, bd = Infinity;
    const base = k * D;
    for (let c = 0; c < C; c++) {
      let s = 0; const off = c * D;
      for (let d = 0; d < D; d++) { const e = users[base + d] - vec[off + d]; s += e * e; }
      if (s < bd) { bd = s; best = c; }
    }
    cnt[best]++;
    const off = best * D;
    for (let d = 0; d < D; d++) winSum[off + d] += users[base + d];
  }
  return { cnt: cnt.map((x) => x / N), winSum };
}

let vec = Float32Array.from(CHARACTERS.flatMap((c) => DIMS.map((d) => c.vector[d])));
const seed = Float32Array.from(vec);
const MAX_PER_DIM = 1.5, MAX_EUCLID = 3.0, HEALTHY = 0.09;

function withinSeed(base, cand) {
  let eu = 0;
  for (let d = 0; d < D; d++) {
    if (Math.abs(cand[base + d] - seed[base + d]) > MAX_PER_DIM + 1e-9) return false;
    const e = cand[base + d] - seed[base + d]; eu += e * e;
  }
  return Math.sqrt(eu) <= MAX_EUCLID + 1e-9;
}

for (let pass = 0; pass < 3; pass++) {
  let ev = evaluate(vec);
  const order = ev.cnt.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  let moved = 0;
  for (const [share0, S] of order) {
    if (share0 >= HEALTHY) continue;
    const base = S * D;
    for (let iter = 0; iter < 30; iter++) {
      ev = evaluate(vec);
      const cur = ev.cnt[S];
      if (cur >= HEALTHY) break;
      // 候选方向：全局用户均值、前3大角色的胜者均值、自身每维 ±0.5/±1.0/±1.5
      const cands = [];
      const gMean = new Array(D).fill(0);
      for (let k = 0; k < N; k++) for (let d = 0; d < D; d++) gMean[d] += users[k * D + d];
      for (let d = 0; d < D; d++) gMean[d] /= N;
      const tops = ev.cnt.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]);
      for (const T of tops) {
        const m = new Array(D);
        for (let d = 0; d < D; d++) m[d] = ev.winSum[T * D + d] / (ev.cnt[T] * N);
        cands.push(m);
      }
      cands.push(gMean);
      const moves = [];
      for (const m of cands) {
        for (const step of [0.5, 1.0, 1.5, 2.0, 3.0]) {
          let norm = 0;
          for (let d = 0; d < D; d++) norm += (m[d] - vec[base + d]) ** 2;
          if (norm < 1e-9) continue;
          moves.push({ m, step });
        }
      }
      for (let d = 0; d < D; d++) for (const st of [0.5, 1.0, 1.5]) {
        const m = vec.slice();
        m[d] += st;
        moves.push({ m, step: st, direct: true });
        const m2 = vec.slice();
        m2[d] -= st;
        moves.push({ m: m2, step: st, direct: true });
      }
      let best = null;
      for (const { m, step, direct } of moves) {
        const cand = Float32Array.from(vec);
        if (direct) {
          for (let d = 0; d < D; d++) {
            if (m[d] === vec[base + d]) continue;
            cand[base + d] = Math.max(0, Math.min(5, m[d]));
          }
        } else {
          let norm = 0;
          for (let d = 0; d < D; d++) norm += (m[d] - vec[base + d]) ** 2;
          norm = Math.sqrt(norm);
          for (let d = 0; d < D; d++) {
            let v = vec[base + d] + ((m[d] - vec[base + d]) / norm) * step;
            cand[base + d] = Math.max(0, Math.min(5, v));
          }
        }
        for (let d = 0; d < D; d++) cand[base + d] = Math.round(cand[base + d] * 2) / 2;
        if (!withinSeed(base, cand)) continue;
        const tsh = evaluate(cand).cnt;
        if (tsh[S] > cur + 0.0005) {
          if (!best || tsh[S] > best.tsh[S]) best = { cand, tsh };
        }
      }
      if (!best) break;
      vec = best.cand;
    }
    const after = evaluate(vec).cnt[S];
    if (after > share0 + 0.001) moved++;
  }
  console.log("pass " + pass + " 完成，爬坡角色数: " + moved);
}

const ev = evaluate(vec);
const rows = CHARACTERS.map((c, i) => ({ name: c.name, pct: ev.cnt[i], vec: Array.from(vec.slice(i * D, i * D + D)), seed: CHARACTERS[i].vector }))
  .sort((a, b) => b.pct - a.pct);
console.log("\n---- 调参后分布 ----");
for (const r of rows) {
  const delta = DIMS.map((d, i) => { const diff = r.vec[i] - r.seed[d]; return diff === 0 ? null : d + (diff > 0 ? "+" : "") + diff; }).filter(Boolean).join(",") || "不变";
  console.log(r.name.padEnd(4, "　") + " " + (r.pct * 100).toFixed(1) + "%   [" + r.vec.join(", ") + "]   改动: " + delta);
}
console.log("\n最大占比: " + (Math.max(...ev.cnt) * 100).toFixed(1) + "%  最小: " + (Math.min(...ev.cnt) * 100).toFixed(1) + "%");
console.log("\n// 复制到 data.js：");
for (let i = 0; i < C; i++) {
  const v = Array.from(vec.slice(i * D, i * D + D));
  console.log(CHARACTERS[i].id + ": { " + DIMS.map((d, j) => d + ": " + v[j]).join(", ") + " },");
}
