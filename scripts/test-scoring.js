/* 计分逻辑自测：node scripts/test-scoring.js */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "../js/data.js"), "utf8");
(0, eval)(src + "\nglobalThis.__D = { DIMS, QUESTIONS, CHARACTERS, scoreAnswers };");
const { DIMS, QUESTIONS, CHARACTERS, scoreAnswers } = globalThis.__D;

const personas = {
  "诗人型（应落黛玉/妙玉）": [0, 0, 0, 0, 3, 3, 3, 0, 1, 2, 0, 1],
  "管家型（应落凤姐/探春/宝钗）": [1, 1, 1, 1, 1, 0, 1, 3, 0, 1, 2, 0],
  "乐天型（应落刘姥姥/湘云/李纨）": [2, 2, 2, 3, 0, 2, 2, 1, 2, 3, 1, 2],
  "叛逆型（应落宝玉/晴雯）": [2, 3, 3, 2, 3, 3, 0, 0, 3, 0, 3, 3],
  "孤冷型（应落妙玉）": [0, 3, 3, 3, 3, 3, 3, 0, 3, 2, 3, 3],
  "温柔务实型（应落袭人）": [3, 1, 2, 3, 2, 1, 2, 2, 2, 1, 2, 2],
  "痴心向学型（应落香菱/黛玉）": [0, 0, 0, 0, 2, 3, 3, 2, 1, 2, 0, 1],
  "边界感型（应落惜春/晴雯/妙玉）": [0, 3, 3, 2, 3, 3, 0, 0, 3, 0, 0, 3],
  "快乐型（应落薛蟠/湘云/刘姥姥）": [2, 0, 2, 2, 0, 0, 0, 1, 3, 3, 1, 2],
  "周全副手型（应落平儿/袭人）": [3, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0],
  "快意恩仇型（应落尤三姐/晴雯/惜春）": [2, 3, 3, 2, 1, 0, 0, 0, 3, 0, 3, 3],
};

let fail = 0;
for (const [name, answers] of Object.entries(personas)) {
  if (answers.length !== QUESTIONS.length) {
    console.error(`✗ ${name}: 答案数 ${answers.length} != 题数 ${QUESTIONS.length}`);
    fail++;
    continue;
  }
  const r = scoreAnswers(answers);
  const dims = DIMS.map((d, i) => `${d}${Math.round((r.u[i] / 5) * 100)}`).join(" ");
  console.log(
    `${name}\n  六维: ${dims}\n  Top1: ${r.top.c.name}(${r.topPct}%)  Top2: ${r.shadow.c.name}(${r.shadowPct}%)\n`
  );
}

/* 全组合统计：每个选项组合都不该崩，Top1 应覆盖多数角色 */
const chars = new Set();
let combos = 0;
function walk(i, acc) {
  if (i === QUESTIONS.length) {
    const r = scoreAnswers(acc);
    chars.add(r.top.c.id);
    combos++;
    return;
  }
  for (let k = 0; k < 4; k++) walk(i + 1, acc.concat(k));
}
walk(0, []);
console.log(`共 ${combos} 种组合，Top1 覆盖角色数: ${chars.size}/${CHARACTERS.length}`);
if (chars.size < 6) {
  console.error("✗ 角色覆盖过低，题库区分度不足");
  fail++;
}
process.exit(fail ? 1 : 0);
