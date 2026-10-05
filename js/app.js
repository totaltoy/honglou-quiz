/* ============================================================
 * 太虚幻境 · 身份册 —— 交互逻辑
 * ============================================================ */
(function () {
  "use strict";

  var CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
  var REVEAL_HINTS = ["警幻仙子翻开名册……", "于「金陵十二钗」册页间流连……", "朱笔，轻轻落下——"];

  var state = { idx: 0, answers: new Array(QUESTIONS.length).fill(null), busy: false };
  var lastResult = null;
  var revealTimers = [];

  /* 作答进度本地续存（刷新不丢） */
  var LS_KEY = "thj_progress_v1";
  function saveProgress() {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ a: state.answers, i: state.idx })); } catch (e) {}
  }
  function loadProgress() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && s.a && s.a.length === QUESTIONS.length && s.i > 0 && s.i < QUESTIONS.length) return s;
    } catch (e) {}
    return null;
  }
  function clearProgress() {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
  }

  /* 邀请链：?from=<角色id>，朋友测完显示"与邀请人的缘分" */
  var fromChar = (function () {
    try {
      var f = new URLSearchParams(window.location.search).get("from");
      return CHARACTERS.some(function (c) { return c.id === f; }) ? f : null;
    } catch (e) { return null; }
  })();

  var $ = function (id) { return document.getElementById(id); };
  var screens = {
    cover: $("screen-cover"), quiz: $("screen-quiz"), result: $("screen-result"),
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (k) { screens[k].classList.toggle("active", k === name); });
    window.scrollTo(0, 0);
  }

  /* ---------------- 答题 ---------------- */
  function renderQuestion(dir) {
    var q = QUESTIONS[state.idx];
    $("q-idx").textContent = CN[state.idx];
    $("q-scene").textContent = q.scene;
    $("q-text").textContent = q.text;
    $("progress-fill").style.width = ((state.idx) / QUESTIONS.length) * 100 + "%";
    $("btn-back").disabled = state.idx === 0;

    var box = $("options");
    box.innerHTML = "";
    q.options.forEach(function (opt, i) {
      var btn = document.createElement("button");
      btn.className = "option" + (state.answers[state.idx] === i ? " selected" : "");
      btn.type = "button";
      var key = document.createElement("span");
      key.className = "opt-key";
      key.textContent = "ABCD"[i];
      var txt = document.createElement("span");
      txt.textContent = opt.text;
      btn.appendChild(key);
      btn.appendChild(txt);
      btn.addEventListener("click", function () { select(i); });
      box.appendChild(btn);
    });

    var card = $("q-card");
    card.classList.remove("anim", "anim-back");
    void card.offsetWidth; // 重新触发动画
    card.classList.add(dir === "back" ? "anim-back" : "anim");
  }

  function select(i) {
    if (state.busy) return;
    state.busy = true;
    state.answers[state.idx] = i;
    var opts = $("options").children;
    for (var k = 0; k < opts.length; k++) opts[k].classList.toggle("selected", k === i);

    setTimeout(function () {
      state.busy = false;
      state.idx++;
      if (state.idx >= QUESTIONS.length) {
        state.idx = QUESTIONS.length - 1; // 停在最后一卷，允许返回修改
        startReveal();
      } else {
        saveProgress();
        renderQuestion("next");
      }
    }, 300);
  }

  /* ---------------- 揭晓 ---------------- */
  function startReveal() {
    lastResult = scoreAnswers(state.answers);
    clearProgress();
    var reveal = $("reveal");
    reveal.classList.remove("hidden");
    var hint = $("reveal-hint");
    var step = 0;
    hint.textContent = REVEAL_HINTS[0];
    revealTimers.push(setInterval(function () {
      step++;
      if (step < REVEAL_HINTS.length) hint.textContent = REVEAL_HINTS[step];
    }, 800));
    revealTimers.push(setTimeout(function () {
      reveal.classList.add("hidden");
      renderResult(lastResult);
      showScreen("result");
    }, 2500));
  }

  function cancelReveal() {
    revealTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    revealTimers = [];
    $("reveal").classList.add("hidden");
  }

  /* ---------------- 结果 ---------------- */
  function renderResult(r) {
    var c = r.top.c;
    $("r-pct").textContent = r.topPct + "%";
    $("r-name").textContent = c.name;
    $("r-alias").textContent = c.alias + " · " + c.title + " · " + c.home;
    $("r-quote-text").textContent = "「" + c.quote + "」";
    $("r-quote-src").textContent = "—— " + c.quoteSrc;
    $("r-tagline").textContent = c.tagline;
    $("r-desc").textContent = c.desc;

    var tags = $("r-tags");
    tags.innerHTML = "";
    c.tags.forEach(function (t) {
      var s = document.createElement("span");
      s.textContent = t;
      tags.appendChild(s);
    });

    $("r-shadow").textContent = r.shadow.c.name + "（" + r.shadow.c.title + " · " + r.shadowPct + "%）";
    $("r-confidant").textContent = c.confidant;

    // 「为什么是TA」：从作答中找出与该角色高维对应的证据
    var why = $("r-why");
    var items = whyEvidence(r);
    var whyList = $("r-why-list");
    whyList.innerHTML = "";
    if (items.length) {
      items.forEach(function (it) {
        var div = document.createElement("div");
        div.className = "r-why-item";
        var sc = document.createElement("span");
        sc.className = "r-why-scene";
        sc.textContent = it.scene;
        div.appendChild(sc);
        div.appendChild(document.createTextNode("你选了「" + it.text + "」"));
        var b = document.createElement("b");
        b.textContent = " " + it.dim + " +" + it.val;
        div.appendChild(b);
        whyList.appendChild(div);
        why.classList.remove("hidden");
      });
    } else {
      why.classList.add("hidden");
    }

    // 关系彩蛋
    if (fromChar) {
      var fc = CHARACTERS.filter(function (x) { return x.id === fromChar; })[0];
      var rel = relationOf(fromChar, c.id);
      var relTitle = rel.title;
      if (fromChar !== c.id) relTitle += "（你是" + c.name + "，TA是" + fc.name + "）";
      $("r-rel-title").textContent = relTitle;
      $("r-rel-line").textContent = rel.line;
      $("r-relation").classList.remove("hidden");
    } else {
      $("r-relation").classList.add("hidden");
    }

    var dims = $("r-dims");
    dims.innerHTML = "";
    r.u.forEach(function (v, i) {
      var pct = Math.round((v / 5) * 100);
      var b = document.createElement("b");
      b.textContent = DIMS[i] + " " + pct;
      dims.appendChild(b);
      if (i < DIMS.length - 1) dims.appendChild(document.createTextNode(" · "));
    });

    // 重启印章动画
    var seal = $("r-seal");
    seal.style.animation = "none";
    void seal.offsetWidth;
    seal.style.animation = "";

    drawRadar($("radar"), r.u);
  }

  /* ---------------- 六维雷达图 ---------------- */
  function drawRadar(canvas, u, scale) {
    var dpr = window.devicePixelRatio || 1;
    var size = (scale && scale.size) || 300;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = "100%";
    canvas.style.maxWidth = size + "px";
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    var cx = size / 2, cy = size / 2 + 4, R = size * 0.31;
    var n = DIMS.length;
    var ang = function (i) { return -Math.PI / 2 + (i * 2 * Math.PI) / n; };
    var pt = function (i, r) { return [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r]; };

    // 网格环
    ctx.strokeStyle = "#d8cdb6";
    ctx.lineWidth = 1;
    for (var ring = 1; ring <= 5; ring++) {
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var p = pt(i % n, (R * ring) / 5);
        i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    // 轴线
    for (var j = 0; j < n; j++) {
      var q = pt(j, R);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }

    // 数值多边形
    ctx.beginPath();
    for (var k = 0; k <= n; k++) {
      var idx = k % n;
      var v = (R * Math.min(5, Math.max(0, u[idx]))) / 5;
      var pp = pt(idx, v);
      k === 0 ? ctx.moveTo(pp[0], pp[1]) : ctx.lineTo(pp[0], pp[1]);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(158, 59, 44, 0.22)";
    ctx.fill();
    ctx.strokeStyle = "#9e3b2c";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (var m = 0; m < n; m++) {
      var vv = (R * Math.min(5, Math.max(0, u[m]))) / 5;
      var dot = pt(m, vv);
      ctx.beginPath();
      ctx.arc(dot[0], dot[1], 2.6, 0, Math.PI * 2);
      ctx.fillStyle = "#9e3b2c";
      ctx.fill();
    }

    // 轴标签
    ctx.fillStyle = "#6b6155";
    ctx.font = "12px " + '"Songti SC","STSong","Noto Serif SC",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var t = 0; t < n; t++) {
      var lp = pt(t, R + 22);
      ctx.fillText(DIMS[t], lp[0], lp[1]);
    }
  }

  /* ---------------- 分享身份卡（Canvas 绘制） ---------------- */
  function buildCardCanvas(r) {
    var c = r.top.c;
    var W = 750, H = 1334;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");
    var serif = '"Songti SC","STSongti","Noto Serif SC","Source Han Serif SC",serif';

    // 字距逐行设置，避免跨行泄漏；超宽自动缩字号
    function setFont(size, spacing, bold) {
      ctx.font = (bold ? "bold " : "") + size + "px " + serif;
      try { ctx.letterSpacing = (spacing || 0) + "px"; } catch (e) {}
    }
    function fitSize(text, baseSize, maxWidth, spacing, bold) {
      var size = baseSize;
      while (size > 14) {
        setFont(size, spacing, bold);
        if (ctx.measureText(text).width <= maxWidth) break;
        size -= 2;
      }
      return size;
    }

    // 宣纸底
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f8f2e4");
    g.addColorStop(1, "#f1e9d5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(110, 90, 60, 0.12)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 双线边框
    ctx.strokeStyle = "#a9855a";
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.strokeStyle = "rgba(158,59,44,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, H - 80);

    ctx.textAlign = "center";

    // 顶部小字
    setFont(26, 12);
    ctx.fillStyle = "#7a5c33";
    ctx.fillText("太虚幻境 · 身份册", W / 2, 112);

    // 印章（右上）
    ctx.save();
    ctx.translate(W - 132, 88);
    ctx.rotate((8 * Math.PI) / 180);
    ctx.fillStyle = "#9e3b2c";
    ctx.fillRect(-44, -44, 88, 88);
    ctx.strokeStyle = "rgba(248,241,224,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-36, -36, 72, 72);
    ctx.fillStyle = "#f8f1e0";
    ctx.font = "bold 52px " + serif;
    try { ctx.letterSpacing = "0px"; } catch (e) {}
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("册", 0, 4);
    ctx.restore();
    ctx.textBaseline = "alphabetic";

    // 匹配度
    setFont(24, 6);
    ctx.fillStyle = "#9a8f7d";
    ctx.fillText("册上有名 · 匹配度 " + r.topPct + "%", W / 2, 252);

    // 名字
    setFont(fitSize(c.name, 150, 640, 8, true), 8, true);
    ctx.fillStyle = "#2f2a24";
    ctx.fillText(c.name, W / 2, 408);

    // 别号
    var aliasText = c.alias + " · " + c.title;
    setFont(fitSize(aliasText, 36, 620, 4), 4);
    ctx.fillStyle = "#9e3b2c";
    ctx.fillText(aliasText, W / 2, 478);

    // 分隔符
    separator(ctx, W / 2, 542);

    // 判词
    var quoteText = "「" + c.quote + "」";
    setFont(fitSize(quoteText, 38, 640, 2), 2);
    ctx.fillStyle = "#2f2a24";
    ctx.fillText(quoteText, W / 2, 612);
    setFont(22, 4);
    ctx.fillStyle = "#9a8f7d";
    ctx.fillText("—— " + c.quoteSrc, W / 2, 660);

    // 一句话
    setFont(fitSize(c.tagline, 32, 620, 3), 3);
    ctx.fillStyle = "#3d4a56";
    ctx.fillText(c.tagline, W / 2, 726);

    // 标签
    var tagsText = c.tags.join("  ·  ");
    setFont(fitSize(tagsText, 26, 640, 2), 2);
    ctx.fillStyle = "#7a5c33";
    ctx.fillText(tagsText, W / 2, 788);

    // 雷达图
    drawRadarOn(ctx, r.u, W / 2, 985, 140, serif);

    // 底部（带测试入口网址，转发图片也能找到入口）
    setFont(fitSize("穿越到红楼梦，你会是谁？", 34, 640, 4), 4);
    ctx.fillStyle = "#2f2a24";
    ctx.fillText("穿越到红楼梦，你会是谁？", W / 2, H - 112);
    var siteUrl = "";
    try {
      if (location.protocol === "https:" || location.protocol === "http:") {
        siteUrl = (location.host + location.pathname.replace(/index\.html.*$/, "")).replace(/\/$/, "");
      }
    } catch (e) {}
    var footer2 = siteUrl ? siteUrl + " · 太虚幻境身份册" : "太虚幻境 · 身份册 | 娱乐向二创测试";
    setFont(fitSize(footer2, 22, 640, 2), 2);
    ctx.fillStyle = "#9a8f7d";
    ctx.fillText(footer2, W / 2, H - 64);
    try { ctx.letterSpacing = "0px"; } catch (e) {}
    return canvas;
  }

  function separator(ctx, x, y) {
    ctx.strokeStyle = "#a9855a";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 120, y); ctx.lineTo(x - 16, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 16, y); ctx.lineTo(x + 120, y); ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#9e3b2c";
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }

  function drawRadarOn(ctx, u, cx, cy, R, serif) {
    var n = DIMS.length;
    var ang = function (i) { return -Math.PI / 2 + (i * 2 * Math.PI) / n; };
    var pt = function (i, r) { return [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r]; };
    ctx.strokeStyle = "#d8cdb6";
    ctx.lineWidth = 1.5;
    for (var ring = 1; ring <= 5; ring++) {
      ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var p = pt(i % n, (R * ring) / 5);
        i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    for (var j = 0; j < n; j++) {
      var q = pt(j, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    ctx.beginPath();
    for (var k = 0; k <= n; k++) {
      var idx = k % n;
      var v = (R * Math.min(5, Math.max(0, u[idx]))) / 5;
      var pp = pt(idx, v);
      k === 0 ? ctx.moveTo(pp[0], pp[1]) : ctx.lineTo(pp[0], pp[1]);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(158,59,44,0.22)";
    ctx.fill();
    ctx.strokeStyle = "#9e3b2c";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#6b6155";
    ctx.font = "24px " + serif;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var t = 0; t < n; t++) {
      var lp = pt(t, R + 28);
      ctx.fillText(DIMS[t], lp[0], lp[1]);
    }
    ctx.textBaseline = "alphabetic";
  }

  /* ---------------- 分享 / 复制 / 弹层 ---------------- */
  /* 「为什么是TA」证据：取用户与角色都突出的维度，回溯对应作答 */
  function whyEvidence(r) {
    var c = r.top.c;
    var rows = DIMS.map(function (d, i) {
      return { d: d, i: i, align: r.u[i] * (c.vector[d] / 5), cv: c.vector[d], uv: r.u[i] };
    }).sort(function (a, b) { return b.align - a.align; });
    var used = {};
    var out = [];
    rows.forEach(function (row) {
      if (out.length >= 3) return;
      if (row.cv < 2.5 || row.uv < 2.5) return;
      var bestQ = -1, bestVal = 0;
      QUESTIONS.forEach(function (q, qi) {
        if (used[qi] || state.answers[qi] == null) return;
        var v = q.options[state.answers[qi]].score[row.d] || 0;
        if (v > bestVal) { bestVal = v; bestQ = qi; }
      });
      if (bestQ < 0 || bestVal < 1) return;
      used[bestQ] = true;
      var q = QUESTIONS[bestQ];
      var text = q.options[state.answers[bestQ]].text;
      if (text.length > 16) text = text.slice(0, 16) + "…";
      out.push({ scene: q.scene, text: text, dim: row.d, val: bestVal });
    });
    return out;
  }

  function shareText(r) {
    var c = r.top.c;
    var link = window.location.href.split(/[?#]/)[0] + "?from=" + c.id;
    return (
      "【太虚幻境·身份册】我在红楼梦里是「" + c.alias + "」" + c.name +
      "（匹配度" + r.topPct + "%）——" + c.tags.join(" · ") +
      "。影子人格：" + r.shadow.c.name + "。" +
      "敢不敢来对答案？你的红楼身份 → " + link
    );
  }

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast("文案已复制，去粘贴吧"); },
        function () { fallbackCopy(text); }
      );
    } else fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    if (ok) toast("文案已复制，去粘贴吧");
    else window.prompt("自动复制失败——请长按下方文案手动复制", text);
  }

  function openCardModal() {
    var canvas = buildCardCanvas(lastResult);
    var url = canvas.toDataURL("image/png");
    $("card-img").src = url;
    $("btn-download").href = url;
    $("card-modal").classList.remove("hidden");
  }

  /* ---------------- 事件绑定 ---------------- */
  if (fromChar) {
    var fc0 = CHARACTERS.filter(function (x) { return x.id === fromChar; })[0];
    var note = $("from-note");
    if (fc0 && note) {
      note.textContent = "「" + fc0.name + "」邀你同入幻境——测完与TA对答案。";
      note.classList.remove("hidden");
    }
  }

  $("btn-start").addEventListener("click", function () {
    clearProgress();
    $("btn-continue").classList.add("hidden");
    state.idx = 0;
    state.answers = new Array(QUESTIONS.length).fill(null);
    renderQuestion("next");
    showScreen("quiz");
  });

  var saved = loadProgress();
  if (saved) {
    var bc = $("btn-continue");
    bc.textContent = "继续上次作答（上次到第 " + CN[saved.i] + " 卷）";
    bc.classList.remove("hidden");
    bc.addEventListener("click", function () {
      state.answers = saved.a.slice();
      state.idx = saved.i;
      renderQuestion("next");
      showScreen("quiz");
    });
  }

  $("btn-back").addEventListener("click", function () {
    if (state.idx === 0 || state.busy) return;
    state.idx--;
    saveProgress();
    renderQuestion("back");
  });

  $("reveal-back").addEventListener("click", function () {
    cancelReveal();
    showScreen("quiz");
    renderQuestion("back");
  });

  $("btn-retry").addEventListener("click", function () {
    showScreen("cover");
  });

  $("btn-copy").addEventListener("click", function () {
    copyText(shareText(lastResult));
  });

  $("btn-card").addEventListener("click", openCardModal);
  $("btn-close-card").addEventListener("click", function () {
    $("card-modal").classList.add("hidden");
  });
  $("card-modal").addEventListener("click", function (e) {
    if (e.target === this) this.classList.add("hidden");
  });
})();
