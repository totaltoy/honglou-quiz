/* 角色分布报告：全量枚举 4^12 种答题组合，统计每个角色被选为第一名的占比 */
const fs = require("fs");
const path = require("path");
(0, eval)(fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8") + "\nglobalThis.__D={DIMS,QUESTIONS,CHARACTERS,STRETCH};");
const { DIMS, QUESTIONS, CHARACTERS, STRETCH } = globalThis.__D;

const n = QUESTIONS.length;
const C = CHARACTERS.length;
const OPT = QUESTIONS.map((q) => q.options.map((o) => DIMS.map((d) => o.score[d] || 0)));
const MAXD = DIMS.map((_, i) => QUESTIONS.reduce((s, q) => s + Math.max(0, ...q.options.map((o) => o.score[DIMS[i]] || 0)), 0));
const VEC = CHARACTERS.map((c) => DIMS.map((d) => c.vector[d]));
const MAX_DIST = Math.sqrt(DIMS.length) * 5;

const counts = new Array(C).fill(0);
const sumU = new Array(DIMS.length).fill(0);
const winU = CHARACTERS.map(() => new Array(DIMS.length).fill(0));

const raw = new Array(DIMS.length).fill(0);
const u = new Array(DIMS.length).fill(0);
const wheel = new Array(n).fill(0);
const total = Math.pow(4, n);

// 初始组合：全选 0
for (let i = 0; i < n; i++) for (let d = 0; d < DIMS.length; d++) raw[d] += OPT[i][0][d];

let done = 0;
function tally() {
  for (let d = 0; d < DIMS.length; d++) u[d] = Math.min(5, (raw[d] / MAXD[d]) * 5 * STRETCH[d]);
  let best = -1, bestD = Infinity, secondD = Infinity;
  for (let c = 0; c < C; c++) {
    let s = 0;
    const v = VEC[c];
    for (let d = 0; d < DIMS.length; d++) { const e = u[d] - v[d]; s += e * e; }
    if (s < bestD) { secondD = bestD; bestD = s; best = c; }
    else if (s < secondD) { secondD = s; }
  }
  counts[best]++;
  for (let d = 0; d < DIMS.length; d++) { sumU[d] += u[d]; winU[best][d] += u[d]; }
  done++;
}

tally();
let wheelPos = 0;
while (wheelPos < n) {
  // 找到最右未满的轮
  let i = 0;
  while (i < n && wheel[i] === 3) {
    if (wheel[i] !== 0) for (let d = 0; d < DIMS.length; d++) raw[d] -= OPT[i][wheel[i]][d];
    wheel[i] = 0;
    for (let d = 0; d < DIMS.length; d++) raw[d] += OPT[i][0][d];
    i++;
  }
  if (i >= n) break;
  for (let d = 0; d < DIMS.length; d++) raw[d] -= OPT[i][wheel[i]][d];
  wheel[i]++;
  for (let d = 0; d < DIMS.length; d++) raw[d] += OPT[i][wheel[i]][d];
  tally();
  if (wheel[i] === 3) wheelPos = i + 1; else wheelPos = 0;
}

console.log("全局用户均值: " + DIMS.map((d, i) => d + " " + (sumU[i] / total * 100 / 5).toFixed(0)).join(" | "));
console.log("---- Top1 分布（占比%） ----");
const rows = CHARACTERS.map((c, i) => ({ name: c.name, pct: (counts[i] / total) * 100, mean: winU[i].map((v) => (v / counts[i] * 100 / 5).toFixed(0)).join(",") }))
  .sort((a, b) => b.pct - a.pct);
for (const r of rows) console.log(r.name.padEnd(4, "　") + " " + r.pct.toFixed(2) + "%   胜者均值[" + r.mean + "]");
