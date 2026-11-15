/* 计导期末复习 · 前端应用（无依赖，离线可用） */
(function () {
  'use strict';

  /* ================= 数据 ================= */
  var DATA = window.__DATA__ || {};
  var PROBLEMS = (DATA.problems || []).slice();
  var EXAMS = (DATA.exams || []).slice();
  var SECTIONS = (DATA.cheatsheet && DATA.cheatsheet.sections) || [];
  var GUIDE = (DATA.guide && DATA.guide.sections) || [];

  var CATS = [
    { id: 'basic', name: '基础语法与数据类型', ch: 'Ch1–Ch2', short: '基础', group: 'base', desc: '数据类型、常量与变量、运算符与表达式、格式化输入输出' },
    { id: 'select', name: '选择结构', ch: 'Ch3.2', short: '选择', group: 'base', desc: 'if / 多分支 / switch / 嵌套判断与边界处理' },
    { id: 'loop', name: '循环结构', ch: 'Ch3.3–3.4', short: '循环', group: 'base', desc: 'while / do-while / for / 嵌套循环 / 穷举 / 递推' },
    { id: 'array1', name: '一维数组', ch: 'Ch4.1–4.2', short: '一维数组', group: 'base', desc: '定义与初始化、遍历、最值、查找、排序、前缀和' },
    { id: 'array2', name: '二维数组', ch: 'Ch4.3–4.4', short: '二维数组', group: 'base', desc: '矩阵遍历、转置、行列操作、鞍点、蛇形矩阵' },
    { id: 'mix', name: '数组 + 控制流综合', ch: 'Ch4 进阶', short: '数组+控制', group: 'base', desc: '递推、模拟、前缀和、排序查找与数组结合' },
    { id: 'string', name: '字符串与字符数组', ch: '实验9 · Ch5', short: '字符串', group: 'final', guide: 'g-string', desc: '字符数组与 \'\\0\'、字符串库函数、单词与句子处理、字符分类统计、子串查找与替换' },
    { id: 'func', name: '函数与递归', ch: '实验5–6 · Ch6', short: '函数递归', group: 'final', guide: 'g-func', desc: '函数定义与调用、值传递、数组作参数、返回多个值、递归与分治、作用域' },
    { id: 'pointer', name: '指针与动态内存', ch: '实验10 · Ch7', short: '指针', group: 'final', guide: 'g-pointer', desc: '地址与指针、指针与数组、指针作参数、指针数组、malloc/free、二维动态数组' },
    { id: 'struct', name: '结构体与自定义类型', ch: '实验11 · Ch8', short: '结构体', group: 'final', guide: 'g-struct', desc: 'struct/typedef/枚举、结构体数组与指针、多关键字排序、封装与「类」的设计' },
    { id: 'algo', name: '算法与综合应用', ch: '实验7 + 综合', short: '算法综合', group: 'final', guide: 'g-algo', desc: '排序、二分查找变式、递推、最大子段和、日期与进制、高精度与位运算' }
  ];
  var CAT_MAP = {};
  CATS.forEach(function (c) { CAT_MAP[c.id] = c; });
  var CAT_GROUPS = [
    { id: 'base', name: '基础回顾（期中范围）', sub: 'Ch1–Ch4' },
    { id: 'final', name: '期末新增重点', sub: '数组 → 类的设计' }
  ];
  var PAGE = 10;

  PROBLEMS.forEach(function (p, i) { p._i = i; });
  var BY_ID = {};
  PROBLEMS.forEach(function (p) { BY_ID[p.id] = p; });
  EXAMS.forEach(function (e) {
    (e.problems || []).forEach(function (p) { BY_ID[p.id] = p; });
  });

  var TIPS = [
    '字符数组的容量要比字符串长度多 1，\'\\0\' 也算一个字节；忘了它 printf("%s") 会一直读到内存里的随机 0。',
    '字符串读入三选一：scanf("%s") 遇空格停；fgets(s, n, stdin) 连空格读一行（带 \\n，要手动去掉）；getchar() 逐个字符读。',
    'scanf("%d", &n) 之后马上读字符/字符串，先 getchar() 吃掉行尾换行 —— 机考最经典的坑。',
    '数组作函数参数会「退化成指针」，函数里用 sizeof(a) 得到的是指针大小，不是数组长度；长度必须单独传。',
    'C 只有值传递。想在函数里改变外面的变量，就传地址：swap(&a, &b)，形参写 int *。',
    '递归三要素：出口、规模递减、每层用下一层的结果。写完先想「n=1 会不会无限递归」。',
    '指针声明后是野指针，用之前必须指向有效内存；malloc 之后要判空、用完 free。',
    '结构体指针访问成员用 p->x；结构体变量用 s.x；typedef struct {...} X; 之后直接用 X 定义变量。',
    '字符串比较不能用 ==，要用 strcmp(a, b) == 0；字符串赋值不能用 =，要用 strcpy。',
    '输出 long long 用 %lld；double 用 %lf 输入、%f 输出；保留 k 位小数用 %.kf。',
    '结构体排序时用 struct 整体赋值交换（tmp = a[i]; a[i] = a[j]; a[j] = tmp;），比逐字段交换更稳。',
    '机考先写 I/O 框架+样例，再补算法；每写完一题立刻自测样例，别攒到最后一起调。'
  ];

  /* ================= 存储 ================= */
  var STORE_KEY = 'cd_review_v2';
  var memoryStore = null;

  function emptyStore() {
    return { answers: {}, status: {}, wrong: {}, exams: {}, settings: {} };
  }
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyStore();
      var s = JSON.parse(raw);
      var base = emptyStore();
      Object.keys(base).forEach(function (k) {
        if (!s[k] || typeof s[k] !== 'object') s[k] = base[k];
      });
      return s;
    } catch (e) {
      return emptyStore();
    }
  }
  var store = loadStore();
  var saveTimer = null;
  function saveNow() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      memoryStore = store;
    }
  }
  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 350);
  }
  window.addEventListener('beforeunload', saveNow);

  function answerOf(id) { return store.answers[id] || { text: '', note: '', updated: 0 }; }
  function statusOf(id) { return store.status[id] || 'todo'; }
  function inWrong(id) { return !!store.wrong[id]; }
  function examSession(e) { return store.exams[e.id] || null; }

  /* ================= 工具 ================= */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return (d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
  function stars(n) {
    n = Math.max(1, Math.min(5, n || 1));
    var out = '';
    for (var i = 0; i < 5; i++) out += i < n ? '★' : '<span class="off">★</span>';
    return out;
  }
  function catName(id) { return CAT_MAP[id] ? CAT_MAP[id].name : id; }
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('已复制'); }, function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制'); } catch (e) { toast('复制失败，请手动选择'); }
    document.body.removeChild(ta);
  }

  /* ================= 轻量 Markdown ================= */
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }
  function md(text) {
    if (!text) return '';
    var lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    var out = [], para = [], i = 0;
    function flush() {
      if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; }
    }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*```/.test(line)) {
        flush();
        var lang = line.replace(/^\s*```/, '').trim();
        var buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre class="code"><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      if (/^###\s+/.test(line)) { flush(); out.push('<h4>' + inline(line.replace(/^###\s+/, '')) + '</h4>'); i++; continue; }
      if (/^\s*\|/.test(line)) {
        flush();
        var rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i]); i++; }
        var cells = function (r) { return r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }); };
        var html = '<table>';
        rows.forEach(function (r, ri) {
          if (ri === 1 && /^[\s|:\-]+$/.test(r)) return;
          var tag = ri === 0 ? 'th' : 'td';
          html += '<tr>' + cells(r).map(function (c) { return '<' + tag + '>' + inline(c) + '</' + tag + '>'; }).join('') + '</tr>';
        });
        html += '</table>';
        out.push(html);
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        flush();
        var items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ul>' + items.join('') + '</ul>');
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        flush();
        var oitems = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          oitems.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ol>' + oitems.join('') + '</ol>');
        continue;
      }
      if (line.trim() === '') { flush(); i++; continue; }
      para.push(line);
      i++;
    }
    flush();
    return out.join('\n');
  }

  /* ================= 状态与路由 ================= */
  var state = {
    view: 'home', cat: 'all', q: '', diff: 0, status: 'all', wrongOnly: false,
    page: 1, problemId: null, examId: null, timerId: null
  };

  function route() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    var v = parts[0] || 'home';
    if (v === 'library') {
      state.view = 'library';
      state.problemId = parts[1] && BY_ID[parts[1]] ? parts[1] : null;
      if (parts[1] && CAT_MAP[parts[1]]) state.cat = parts[1];
    } else if (v === 'exam') {
      state.view = 'exam';
      state.examId = parts[1] || (EXAMS[0] && EXAMS[0].id);
    } else if (v === 'guide') {
      state.view = 'guide';
      state.guideId = parts[1] || null;
    } else if (['home', 'exams', 'wrong', 'cheatsheet', 'data'].indexOf(v) >= 0) {
      state.view = v;
    } else {
      state.view = 'home';
    }
    render();
  }
  window.addEventListener('hashchange', route);

  /* ================= 统计 ================= */
  function stats() {
    var s = { answered: 0, done: 0, doing: 0, review: 0, wrong: 0, total: PROBLEMS.length };
    PROBLEMS.forEach(function (p) {
      var a = store.answers[p.id];
      if (a && a.text && a.text.trim()) s.answered++;
      var st = statusOf(p.id);
      if (st === 'done') s.done++;
      else if (st === 'doing') s.doing++;
      else if (st === 'review') s.review++;
    });
    s.wrong = Object.keys(store.wrong).filter(function (id) { return !!BY_ID[id]; }).length;
    return s;
  }
  function catStats(cat) {
    var list = PROBLEMS.filter(function (p) { return p.cat === cat; });
    var answered = 0, done = 0;
    list.forEach(function (p) {
      var a = store.answers[p.id];
      if (a && a.text && a.text.trim()) answered++;
      if (statusOf(p.id) === 'done') done++;
    });
    return { total: list.length, answered: answered, done: done };
  }
  function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }

  /* ================= 题面渲染 ================= */
  function samplesHtml(p) {
    if ((p.id || '').indexOf('V-') === 0) return '<div class="muted small">代码分析题：请先独立推导指定输入的输出，再展开参考答案核对。</div>';
    var ss = p.samples || [];
    if (!ss.length) return '';
    return '<div class="samples">' + ss.map(function (s, i) {
      return '<div class="sample"><div class="st"><span>样例 ' + (i + 1) + ' 输入</span><button class="copy-btn" title="复制输入">复制</button></div><pre>' + esc(s.in) + '</pre></div>' +
        '<div class="sample"><div class="st"><span>样例 ' + (i + 1) + ' 输出</span><button class="copy-btn" title="复制输出">复制</button></div><pre>' + esc(s.out) + '</pre></div>';
    }).join('') + '</div>';
  }
  function statusHtml(id) {
    var cur = statusOf(id);
    var opts = [['todo', '未做', 'todo'], ['doing', '在练', 'doing'], ['done', '已掌握', 'done'], ['review', '需复习', 'review']];
    return '<div class="status-seg">' + opts.map(function (o) {
      return '<button class="' + o[2] + (cur === o[0] ? ' on' : '') + '" data-status="' + id + '" data-v="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function answerHtml(p) {
    var a = answerOf(p.id);
    var w = inWrong(p.id);
    return '<div class="answer-box">' +
      '<div class="answer-bar"><b>作答记录</b><span class="saved" id="saved-' + p.id + '">' + (a.updated ? '已保存 ' + fmtTime(a.updated) : '自动保存到本机') + '</span><span class="spacer"></span><button class="btn small" data-clear-answer="' + p.id + '">清空</button></div>' +
      '<textarea data-answer="' + p.id + '" spellcheck="false" placeholder="在这里粘贴你的代码或思路（自动保存）">' + esc(a.text || '') + '</textarea>' +
      '<input class="note" data-note="' + p.id + '" placeholder="备注：错误原因 / 关键点（自动保存）" value="' + esc(a.note || '') + '">' +
      '<div class="answer-foot">' + statusHtml(p.id) +
      '<button class="btn small wrong-btn' + (w ? ' on' : '') + '" data-wrong="' + p.id + '">' + (w ? '★ 已收录错题本' : '☆ 加入错题本') + '</button>' +
      '<span class="muted small">' + (a.updated ? '最后更新 ' + fmtTime(a.updated) : '') + '</span></div></div>';
  }
  function solutionHtml(p) {
    return '<details class="solution"><summary>参考答案 / 思路提示</summary><div class="sol-body">' +
      (p.hint ? '<h4>思路</h4><div class="md">' + md(p.hint) + '</div>' : '') +
      (p.pitfalls ? '<h4>易错点</h4><div class="md">' + md(p.pitfalls) + '</div>' : '') +
      '<h4>参考代码（C）</h4><div class="sol-code-wrap"><button class="copy-btn">复制代码</button><pre class="code"><code>' + esc(p.solution || '') + '</code></pre></div>' +
      '</div></details>';
  }
  function metaHtml(p) {
    var cn = catName(p.cat);
    var tags = (p.tags || []).filter(function (t) { return t !== cn; });
    return '<div class="p-meta"><span>' + esc(cn) + '</span><span class="src">' + esc(p.source || '') + '</span>' +
      '<span class="tagrow">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</span></div>';
  }
  function cardHtml(p) {
    return '<article class="problem card" id="p-' + p.id + '">' +
      '<div class="p-head"><span class="p-id">' + esc(p.id) + '</span><h3>' + esc(p.title) + '</h3><span class="stars" title="难度">' + stars(p.difficulty) + '</span></div>' +
      metaHtml(p) +
      '<div class="p-body md">' + md(p.desc) + '</div>' +
      samplesHtml(p) + answerHtml(p) + solutionHtml(p) +
      '</article>';
  }

  /* ================= 路由渲染 ================= */
  function render() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    var app = document.getElementById('app');
    var v = state.view;
    var nav = document.querySelectorAll('#nav a');
    for (var i = 0; i < nav.length; i++) {
      var n = nav[i].dataset.nav;
      nav[i].classList.toggle('active', n === v || (v === 'exam' && n === 'exams'));
    }
    document.body.classList.toggle('exam-mode', v === 'exam');
    document.body.classList.toggle('home-mode', v === 'home');
    document.body.classList.toggle('practice-mode', v === 'library' && !!state.problemId);
    if (v === 'home') app.innerHTML = viewHome();
    else if (v === 'library') { app.innerHTML = viewLibrary(); renderList(); }
    else if (v === 'guide') { app.innerHTML = viewGuide(); if (state.guideId) scrollToGuideSection(state.guideId); }
    else if (v === 'exams') app.innerHTML = viewExams();
    else if (v === 'exam') app.innerHTML = viewExamRoom();
    else if (v === 'wrong') app.innerHTML = viewWrong();
    else if (v === 'cheatsheet') app.innerHTML = viewSheet();
    else if (v === 'data') app.innerHTML = viewData();
    window.scrollTo(0, 0);
  }

  /* ================= 总览 ================= */
  function catCard(c) {
    var cs = catStats(c.id);
    return '<a class="card progress-card" href="#/library/' + c.id + '"><div class="top"><span class="name">' + c.name + '</span><span class="pill">' + c.ch + '</span></div>' +
      '<p class="category-desc">' + c.desc + '</p>' +
      '<div class="bar thin"><i style="width:' + pct(cs.done, cs.total) + '%"></i></div>' +
      '<div class="counts">已作答 ' + cs.answered + '/' + cs.total + ' · 已掌握 ' + cs.done + '<span>进入练习 →</span></div></a>';
  }
  function viewHome() {
    var s = stats();
    var next = PROBLEMS.find(function (p) { return statusOf(p.id) !== 'done'; }) || PROBLEMS[0];
    var finalProblems = PROBLEMS.filter(function (p) { return CAT_MAP[p.cat] && CAT_MAP[p.cat].group === 'final'; }).length;
    var fmCount = EXAMS.filter(function (e) { return /^FM/.test(e.id || ''); }).length;
    var guideCards = GUIDE.slice(0, 9).map(function (g) {
      return '<a class="guide-mini" href="#/guide/' + g.id + '"><b>' + esc(g.title) + '</b><span>' + esc(g.ch || '') + '</span>' + (g.weight ? '<i class="pill ' + (g.weight === '必考' ? 'danger' : g.weight === '高频' ? 'warn' : '') + '">' + esc(g.weight) + '</i>' : '') + '</a>';
    }).join('');
    var catBlocks = CAT_GROUPS.map(function (grp) {
      var list = CATS.filter(function (c) { return c.group === grp.id; });
      if (!list.length) return '';
      return '<div class="section-title"><h2>' + grp.name + '<span class="muted small" style="font-weight:400;margin-left:8px">' + grp.sub + ' · ' + list.length + ' 个考点</span></h2></div>' +
        '<div class="grid cols-3 home-categories">' + list.map(catCard).join('') + '</div>';
    }).join('');
    return '<div class="home-dashboard">' +
      '<section class="hero"><div><span class="pill accent">期末复习 · 数组 → 类的设计</span> <span class="muted small">考试语言：C（实验5–11）</span>' +
      '<h1>期末冲刺，把每个考点练成肌肉记忆。</h1>' +
      '<p class="lead">从数组（含字符串数组）一路到函数、递归、指针、动态内存、结构体与「类」的设计思想：<b>' + PROBLEMS.length + '</b> 道精选题 + <b>' + EXAMS.length + '</b> 套限时模拟卷（其中 ' + fmCount + ' 套期末全真卷）+ 知识精讲与速查手册。答题区只做记录，不联网、不上传。</p>' +
      '<div class="actions"><a class="btn primary" href="#/library/' + next.id + '">开始练习 →</a><a class="btn" href="#/guide">知识精讲</a><a class="btn" href="#/exams">限时模考</a><a class="btn" href="#/cheatsheet">速查手册</a></div></div>' +
      '<div class="kpi"><div><b>' + s.answered + '<small> / ' + s.total + '</small></b><span>已作答</span></div><div><b>' + s.done + '</b><span>已掌握</span></div><div><b>' + s.wrong + '</b><span>错题待复习</span></div><div><b>' + finalProblems + '</b><span>期末新增题</span></div></div></section>' +
      catBlocks +
      (GUIDE.length ? '<div class="section-title"><h2>知识精讲</h2><a class="sub" href="#/guide">全部 ' + GUIDE.length + ' 节 →</a></div><div class="guide-mini-grid">' + guideCards + '</div>' : '') +
      '<div class="grid cols-2" style="margin-top:20px"><div class="card" style="padding:18px 20px"><h2 style="font-size:15px;margin-bottom:10px">期末复习路线（建议顺序）</h2>' +
      '<ul class="roadmap">' + [
        ['#/library/array1', '数组进阶', '一维/二维复习 + 遍历、最值、前缀和、矩阵操作（Ch4，期末仍考）'],
        ['#/library/func', '函数与递归', '值传递、数组作参数、返回多个值；递归三要素与经典递归题'],
        ['#/library/string', '字符串与字符数组', '\\0、strlen/strcpy/strcmp、整行读入、单词与句子处理'],
        ['#/library/pointer', '指针与动态内存', '地址与解引用、指针作参数、指针数组、malloc/free'],
        ['#/library/struct', '结构体与「类」的设计', '结构体数组与指针、多关键字排序、封装与信息管理系统'],
        ['#/library/algo', '算法综合', '排序、二分变式、递推、最大子段和、日期与进制'],
        ['#/exams', '期末模拟', '10 套期末卷 × 6 题 × 120 分钟，含四套新增仿真卷']
      ].map(function (x, i) {
        return '<li data-nav-href="' + x[0] + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></li>';
      }).join('') + '</ul></div>' +
      '<div class="card" style="padding:18px 20px"><h2 style="font-size:15px;margin-bottom:10px">机考高频坑（先背下来）</h2><ul class="tips">' +
      TIPS.slice(0, 8).map(function (t, i) { return '<li><span class="n">' + (i + 1) + '</span><span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div></div>' +
      '<div class="home-bottom"><a class="card" href="#/wrong"><b>错题本</b><span>回顾 ' + s.wrong + ' 道错题，巩固薄弱点 →</span></a><a class="card" href="#/exams"><b>模拟考试</b><span>' + EXAMS.length + ' 套试卷 · 期末卷 120 分钟 →</span></a><a class="card" href="#/data"><b>学习数据</b><span>导出备份，保存复习进度 →</span></a></div></div>';
  }

  /* ================= 题库 ================= */
  function viewLibrary() {
    if (state.problemId) return viewPractice();
    if (state.cat !== 'all' && !CAT_MAP[state.cat]) state.cat = 'all';
    var catBtns = '<button class="' + (state.cat === 'all' ? 'active' : '') + '" data-cat="all"><span>全部题目</span><span class="n">' + PROBLEMS.length + '</span></button>' +
      CAT_GROUPS.map(function (grp) {
        var list = CATS.filter(function (c) { return c.group === grp.id; });
        if (!list.length) return '';
        return '<p class="cat-group">' + grp.name + '</p>' + list.map(function (c) {
          var n = PROBLEMS.filter(function (p) { return p.cat === c.id; }).length;
          return '<button class="' + (state.cat === c.id ? 'active' : '') + '" data-cat="' + c.id + '"><span>' + c.short + '</span><span class="n">' + n + '</span></button>';
        }).join('');
      }).join('');
    var diffBtns = [0, 1, 2, 3, 4, 5].map(function (d) {
      return '<button class="' + (state.diff === d ? 'active' : '') + '" data-diff="' + d + '">' + (d === 0 ? '全部' : d + '★') + '</button>';
    }).join('');
    var stBtns = [['all', '全部'], ['todo', '未做'], ['doing', '在练'], ['done', '已掌握'], ['review', '需复习']].map(function (o) {
      return '<button class="' + (state.status === o[0] ? 'active' : '') + '" data-st="' + o[0] + '">' + o[1] + '</button>';
    }).join('');
    return '<div class="page-head"><div><h1>精选题库</h1><p>教材与 PTA 作业中的经典题 + 自编新题，按考点分类。所有题目都附思路与完整参考代码，作答自动保存。</p></div>' +
      '<div class="muted small">共 ' + PROBLEMS.length + ' 题</div></div>' +
      '<div class="lib-layout"><aside class="sidebar card">' +
      '<div class="side-block"><input class="search" id="searchInput" type="search" placeholder="搜索题号 / 标题 / 标签 / 题面…" value="' + esc(state.q) + '"></div>' +
      '<div class="side-block"><p class="label">分类</p><div class="cat-list">' + catBtns + '</div></div>' +
      '<div class="side-block"><p class="label">难度</p><div class="filter-row">' + diffBtns + '</div></div>' +
      '<div class="side-block"><p class="label">掌握状态</p><div class="filter-row">' + stBtns + '</div></div>' +
      '<div class="side-block"><label class="switch"><input type="checkbox" id="wrongOnly"' + (state.wrongOnly ? ' checked' : '') + '>只看错题本</label></div>' +
      '</aside><section>' +
      '<div class="toolbar"><span class="result" id="resultCount"></span><span class="muted small">提示：答案自动保存在本机浏览器</span></div>' +
      '<div id="problemList" class="problem-list"></div><div class="load-more" id="loadMore"></div></section></div>';
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return PROBLEMS.filter(function (p) {
      if (state.cat !== 'all' && p.cat !== state.cat) return false;
      if (state.diff && p.difficulty !== state.diff) return false;
      if (state.status !== 'all' && statusOf(p.id) !== state.status) return false;
      if (state.wrongOnly && !inWrong(p.id)) return false;
      if (q) {
        var hay = (p.id + ' ' + p.title + ' ' + (p.tags || []).join(' ') + ' ' + (p.source || '') + ' ' + p.desc + ' ' + (p.hint || '')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function renderList() {
    var el = document.getElementById('problemList');
    if (!el) return;
    var list = filtered();
    var shown = list.slice(0, state.page * PAGE);
    el.innerHTML = shown.length
      ? shown.map(function(p) { return '<a class="card problem-summary" href="#/library/' + p.id + '"><span class="p-id">' + esc(p.id) + '</span><div><h3>' + esc(p.title) + '</h3><span class="muted small">' + esc(catName(p.cat)) + ' · ' + ({todo:'未做',doing:'在练',done:'已掌握',review:'需复习'}[statusOf(p.id)]) + '</span></div><span class="stars">' + stars(p.difficulty) + '</span><span>作答 →</span></a>'; }).join('')
      : '<div class="card empty">没有符合条件的题目。<br>试试清空搜索词或切换到「全部题目」。</div>';
    var more = document.getElementById('loadMore');
    if (more) {
      if (list.length > shown.length) {
        more.innerHTML = '<button class="btn" data-load-more="1">加载更多（还有 ' + (list.length - shown.length) + ' 题）</button>';
      } else if (list.length) {
        more.innerHTML = '<span class="muted small">已显示全部 ' + list.length + ' 题</span>';
      } else {
        more.innerHTML = '';
      }
    }
    var rc = document.getElementById('resultCount');
    if (rc) rc.textContent = '共 ' + list.length + ' 题，已显示 ' + shown.length + ' 题';
    var cats = document.querySelectorAll('[data-cat]');
    for (var i = 0; i < cats.length; i++) cats[i].classList.toggle('active', cats[i].dataset.cat === state.cat);
    var diffs = document.querySelectorAll('[data-diff]');
    for (var j = 0; j < diffs.length; j++) diffs[j].classList.toggle('active', Number(diffs[j].dataset.diff) === state.diff);
    var sts = document.querySelectorAll('[data-st]');
    for (var k = 0; k < sts.length; k++) sts[k].classList.toggle('active', sts[k].dataset.st === state.status);
    var w = document.getElementById('wrongOnly');
    if (w) w.checked = state.wrongOnly;
  }

  /* ================= 模拟考试列表 ================= */
  function examCard(e) {
    var ses = examSession(e);
    var submitted = ses && ses.submittedAt;
    var total = (e.problems || []).length;
    var answered = 0;
    (e.problems || []).forEach(function (p) { var a = store.answers[p.id]; if (a && a.text && a.text.trim()) answered++; });
    var topics = {};
    (e.problems || []).forEach(function (p) { topics[p.cat] = true; });
    var topicHtml = Object.keys(topics).map(function (c) { return '<span class="tag">' + catName(c) + '</span>'; }).join('');
    var status = submitted ? '<span class="pill ok">已完成</span>' : (ses ? '<span class="pill warn">进行中</span>' : '<span class="pill">未开始</span>');
    var btn = submitted
      ? '<a class="btn" href="#/exam/' + e.id + '">查看试卷与答案</a>'
      : (ses ? '<a class="btn primary" href="#/exam/' + e.id + '">继续答题</a>' : '<button class="btn primary" data-start-exam="' + e.id + '">开始模考</button>');
    return '<div class="card exam-card"><div class="top"><div><h3>' + esc(e.title) + '</h3><div class="sub">' + esc(e.subtitle || '') + '</div></div>' + status + '</div>' +
      '<div class="meta"><span>' + total + ' 题</span><span>' + (e.duration || 120) + ' 分钟</span><span>已作答 ' + answered + '/' + total + '</span>' + (submitted ? '<span>交卷时间 ' + fmtTime(submitted) + '</span>' : '') + '</div>' +
      '<div class="topics">' + topicHtml + '</div>' +
      '<div class="exam-progress"><div class="cap"><span>作答进度</span><span>' + answered + '/' + total + '</span></div><div class="bar thin"><i style="width:' + pct(answered, total) + '%"></i></div></div>' +
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">' + btn + (submitted ? '<button class="btn small" data-start-exam="' + e.id + '" data-reset="1">重新模考</button>' : '') + '</div></div>';
  }
  function viewExams() {
    var intro = '<div class="card" style="padding:16px 20px;margin-bottom:16px;background:var(--panel-2)">' +
      '<b>模拟考试说明</b><div class="muted small" style="margin-top:4px">期末卷每套 6 题、限时 120 分钟，按本地课程资料覆盖函数、字符串、指针、结构体与算法。FM7–FM10为新增仿真卷，每卷100分；练习卷不代表学校真实命题。「期中范围热身卷」每套 5 题、限时 90 分钟。点开始后计时，交卷后显示参考答案；作答自动保存，可随时退出再继续。</div></div>';
    var fm = EXAMS.filter(function (e) { return /^FM/.test(e.id || ''); });
    var warm = EXAMS.filter(function (e) { return !/^FM/.test(e.id || ''); });
    var blocks = '';
    if (fm.length) blocks += '<div class="section-title"><h2>期末全真模拟卷</h2><span class="sub">6 题 / 120 分钟 · 覆盖实验 5–11</span></div><div class="grid cols-2">' + fm.map(examCard).join('') + '</div>';
    if (warm.length) blocks += '<div class="section-title"><h2>期中范围热身卷</h2><span class="sub">5 题 / 90 分钟 · Ch1–Ch4</span></div><div class="grid cols-2">' + warm.map(examCard).join('') + '</div>';
    return '<div class="page-head"><div><h1>模拟考试</h1><p>共 ' + EXAMS.length + ' 套限时训练，其中 ' + fm.length + ' 套期末全真卷。建议先按考点练熟新增内容，再用全真卷检验。</p></div></div>' +
      intro + blocks;
  }

  /* ================= 考场 ================= */
  function examById(id) {
    for (var i = 0; i < EXAMS.length; i++) if (EXAMS[i].id === id) return EXAMS[i];
    return null;
  }
  function sessionOf(e) {
    var s = store.exams[e.id];
    if (!s) {
      s = { startedAt: Date.now(), submittedAt: null, current: 1 };
      store.exams[e.id] = s;
      save();
    }
    return s;
  }
  function viewExamRoom() {
    var e = examById(state.examId);
    if (!e) return '<div class="empty">未找到该试卷。<a href="#/exams">返回模拟考试</a></div>';
    var ses = sessionOf(e);
    var submitted = !!ses.submittedAt;
    var total = e.problems.length;
    var no = Math.max(1, Math.min(total, ses.current || 1));
    var q = e.problems[no - 1];
    var answeredN = 0;
    e.problems.forEach(function (p) { var a = store.answers[p.id]; if (a && a.text && a.text.trim()) answeredN++; });
    var navBtns = e.problems.map(function (p, i) {
      var a = store.answers[p.id];
      var has = a && a.text && a.text.trim();
      return '<button class="qbtn' + (i + 1 === no ? ' active' : '') + (has ? ' answered' : '') + '" data-exam-no="' + (i + 1) + '"><span class="no">' + (i + 1) + '</span><span class="t">' + esc(p.title) + '</span></button>';
    }).join('');
    var banner = submitted ? '<div class="exam-submitted">✅ 已交卷（' + fmtTime(ses.submittedAt) + '）。下面显示参考答案，可对照答案把错题加入错题本，再点「重新模考」再练一轮。</div>' : '';
    var timerHtml = submitted ? '<span class="exam-timer" id="examTimer">已交卷</span>' : '<span class="exam-timer" id="examTimer">--:--</span>';
    return '<div class="exam-room">' +
      '<div class="exam-head"><div><div class="title">' + esc(e.title) + '</div><div class="sub">' + esc(e.subtitle || '') + ' · 共 ' + total + ' 题 · ' + (e.duration || 120) + ' 分钟</div></div>' + timerHtml +
      '<button class="btn small" data-exam-exit="1">退出考场</button></div>' +
      '<div class="exam-body"><aside class="exam-nav"><div class="legend">题号颜色：<b style="color:var(--teal)">绿</b>=已作答，蓝=当前题</div>' + navBtns +
      '<div style="margin-top:14px"><div class="muted small">已作答 ' + answeredN + '/' + total + '</div><div class="bar thin" style="margin-top:6px"><i style="width:' + pct(answeredN, total) + '%"></i></div></div></aside>' +
      '<div class="exam-main"><div class="q-wrap">' + banner +
      '<div class="q-head"><span class="p-id">' + esc(q.id) + '</span><h2>' + esc(q.title) + '</h2><span class="stars">' + stars(q.difficulty) + '</span></div>' +
      metaHtml(q) + '<div class="q-desc md">' + md(q.desc) + '</div>' + samplesHtml(q) + answerHtml(q) +
      (submitted ? solutionHtml(q) : '<div class="muted small" style="margin-top:12px">交卷后可查看参考答案。</div>') +
      '</div></div></div>' +
      '<div class="exam-foot"><button class="btn" data-exam-prev="1"' + (no <= 1 ? ' disabled' : '') + '>← 上一题</button>' +
      '<button class="btn" data-exam-next="1"' + (no >= total ? ' disabled' : '') + '>下一题 →</button><span class="spacer"></span>' +
      (submitted ? '<span class="muted small">已交卷，可继续查看解析</span>' : '<button class="btn teal" data-exam-submit="1">交卷并查看参考答案</button>') +
      '</div></div>';
  }
  function startTimer(e) {
    if (state.timerId) clearInterval(state.timerId);
    var ses = store.exams[e.id];
    if (!ses || ses.submittedAt) return;
    var tick = function () {
      var s = store.exams[e.id];
      if (!s || s.submittedAt) { clearInterval(state.timerId); state.timerId = null; return; }
      var left = s.startedAt + (e.duration || 90) * 60000 - Date.now();
      var el = document.getElementById('examTimer');
      if (el) {
        el.textContent = fmtClock(left);
        el.classList.toggle('warn', left <= 5 * 60000);
      }
      if (left <= 0) {
        clearInterval(state.timerId);
        state.timerId = null;
        submitExam(e, true);
      }
    };
    tick();
    state.timerId = setInterval(tick, 1000);
  }
  function submitExam(e, auto) {
    var s = store.exams[e.id];
    if (!s || s.submittedAt) return;
    if (!auto && !confirm('确定交卷吗？交卷后可以查看参考答案，但仍可继续修改作答记录。')) return;
    s.submittedAt = Date.now();
    saveNow();
    render();
    toast(auto ? '时间到，已自动交卷' : '已交卷，参考答案已显示');
  }

  /* ================= 错题本 ================= */
  function wrongList() {
    return Object.keys(store.wrong).filter(function (id) { return !!BY_ID[id]; }).map(function (id) {
      return { id: id, p: BY_ID[id], w: store.wrong[id] };
    }).sort(function (a, b) {
      var ca = (CATS.map(function (c) { return c.id; }).indexOf(a.p.cat));
      var cb = (CATS.map(function (c) { return c.id; }).indexOf(b.p.cat));
      if (ca !== cb) return ca - cb;
      return (a.w.added || 0) - (b.w.added || 0);
    });
  }
  function viewWrong() {
    var list = wrongList();
    var byCat = {};
    list.forEach(function (it) { (byCat[it.p.cat] = byCat[it.p.cat] || []).push(it); });
    var groups = CATS.filter(function (c) { return byCat[c.id]; }).map(function (c) {
      var items = byCat[c.id].map(function (it) {
        return '<div class="wrong-item card"><span class="id">' + esc(it.id) + '</span>' +
          '<div><h4>' + esc(it.p.title) + '</h4><div class="meta">' + esc(catName(it.p.cat)) + ' · ' + stars(it.p.difficulty) + ' · 收录于 ' + fmtTime(it.w.added) +
          ' · 状态：' + ({ todo: '未做', doing: '在练', done: '已掌握', review: '需复习' }[statusOf(it.id)] || '未做') + '</div>' +
          '<textarea data-wrong-reason="' + it.id + '" placeholder="记录错误原因：是思路错了、边界漏了，还是格式/输出问题？">' + esc(it.w.reason || '') + '</textarea></div>' +
          '<div class="acts"><button class="btn small" data-goto-problem="' + it.id + '">去题目</button><button class="btn small danger" data-remove-wrong="' + it.id + '">移除</button></div></div>';
      }).join('');
      return '<div class="section-title" style="margin-top:18px"><h2 style="font-size:15px">' + c.name + '<span class="muted small" style="font-weight:400"> · ' + byCat[c.id].length + ' 题</span></h2><span class="sub">' + c.ch + '</span></div><div class="wrong-list">' + items + '</div>';
    }).join('');
    var md = '# 错题本（计导期末复习）\n\n收录 ' + list.length + ' 题\n\n' + list.map(function (it) {
      return '- ' + it.id + ' ' + it.p.title + '（' + catName(it.p.cat) + '）' + (it.w.reason ? '\n  - 错误原因：' + it.w.reason : '');
    }).join('\n');
    return '<div class="page-head"><div><h1>错题本</h1><p>按题号记录你的错题与错误原因，复习时优先重做。数据保存在本机浏览器，可导出。</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-export-wrong="1">导出错题本 (Markdown)</button><button class="btn danger" data-clear-wrong="1">清空错题本</button></div></div>' +
      (list.length ? '<div class="grid cols-4" style="margin-bottom:6px">' + CATS.map(function (c) {
        var n = (byCat[c.id] || []).length;
        return '<div class="card" style="padding:12px 16px"><div class="muted small">' + c.short + '</div><b style="font-size:22px">' + n + '</b><span class="muted small"> 题</span></div>';
      }).join('') + '</div>' : '') +
      (list.length ? groups : '<div class="card empty">错题本还是空的。在题目卡片上点「☆ 加入错题本」即可按题号收录；做错的题、没思路的题都可以放进来。</div>') +
      (list.length ? '<div class="section-title"><h2 style="font-size:15px">导出的 Markdown 预览</h2><span class="sub">点右上角按钮下载 .md 文件</span></div><textarea class="export-box" readonly>' + esc(md) + '</textarea>' : '');
  }

  /* ================= 速查手册 ================= */
  function viewSheet() {
    if (!SECTIONS.length) return '<div class="card empty">速查手册内容生成中…</div>';
    var nav = SECTIONS.map(function (s, i) { return '<button data-sheet="' + i + '">' + esc(s.title) + '</button>'; }).join('');
    var body = SECTIONS.map(function (s, i) {
      return '<section class="sheet-section" id="sheet-' + i + '"><h3>' + esc(s.title) + '</h3><div class="md">' + md(s.body) + '</div></section>';
    }).join('');
    return '<div class="page-head"><div><h1>速查手册</h1><p>考前 10 分钟扫一遍：数据类型、格式符、运算符优先级、数组算法模板、常见坑。</p></div></div>' +
      '<div class="sheet-layout"><aside class="sheet-nav card">' + nav + '</aside><div class="card sheet-body">' + body + '</div></div>';
  }

  /* ================= 知识精讲 ================= */
  function viewGuide() {
    if (!GUIDE.length) return '<div class="card empty">知识精讲内容生成中…（请重新构建网页）</div>';
    var cur = state.guideId;
    var nav = GUIDE.map(function (g, i) {
      return '<button class="' + (cur === g.id ? 'active' : '') + '" data-sheet="' + i + '"><span>' + esc(g.title) + '</span>' + (g.weight ? '<i class="pill ' + (g.weight === '必考' ? 'danger' : g.weight === '高频' ? 'warn' : '') + '">' + esc(g.weight) + '</i>' : '') + '</button>';
    }).join('');
    var body = GUIDE.map(function (g, i) {
      var catLinks = CATS.filter(function (c) { return c.guide === g.id; }).map(function (c) {
        return '<a class="tag" href="#/library/' + c.id + '">' + c.name + ' → 练 ' + PROBLEMS.filter(function (p) { return p.cat === c.id; }).length + ' 题</a>';
      }).join('');
      return '<section class="sheet-section" id="sheet-' + i + '"><div class="guide-head"><h3>' + esc(g.title) + '</h3>' + (g.ch ? '<span class="pill">' + esc(g.ch) + '</span>' : '') + '</div><div class="md">' + md(g.body) + '</div>' + (catLinks ? '<div class="guide-links">' + catLinks + '</div>' : '') + '</section>';
    }).join('');
    var totalFinal = CATS.filter(function (c) { return c.group === 'final'; }).reduce(function (a, c) { return a + catStats(c.id).total; }, 0);
    return '<div class="page-head"><div><h1>知识精讲</h1><p>期末新增考点的系统讲解：概念 → 语法 → 代码模板 → 常见错误 → 对应练习。期末新增题库共 ' + totalFinal + ' 道题，讲完一节就去练那一组。</p></div>' +
      '<div class="muted small">' + GUIDE.length + ' 节</div></div>' +
      '<div class="sheet-layout"><aside class="sheet-nav card">' + nav + '</aside><div class="card sheet-body">' + body + '</div></div>';
  }
  function scrollToGuideSection(id) {
    for (var i = 0; i < GUIDE.length; i++) {
      if (GUIDE[i].id === id) {
        var sec = document.getElementById('sheet-' + i);
        if (sec) setTimeout(function () { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
        return;
      }
    }
  }

  /* ================= 数据管理 ================= */
  function viewData() {
    var s = stats();
    var size = 0;
    try { size = (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { size = 0; }
    var examDone = EXAMS.filter(function (e) { var ses = examSession(e); return ses && ses.submittedAt; }).length;
    return '<div class="page-head"><div><h1>数据管理</h1><p>作答记录、掌握状态、错题本、模考记录都保存在本机浏览器（localStorage），换电脑时请导出/导入。</p></div></div>' +
      '<div class="grid cols-3" style="margin-bottom:16px">' +
      '<div class="card" style="padding:16px 18px"><div class="muted small">精选题</div><b style="font-size:24px">' + s.total + '</b><div class="muted small">已作答 ' + s.answered + ' · 已掌握 ' + s.done + '</div></div>' +
      '<div class="card" style="padding:16px 18px"><div class="muted small">错题本</div><b style="font-size:24px">' + s.wrong + '</b><div class="muted small">按题号记录</div></div>' +
      '<div class="card" style="padding:16px 18px"><div class="muted small">模拟考试</div><b style="font-size:24px">' + examDone + '/' + EXAMS.length + '</b><div class="muted small">已完成套数</div></div></div>' +
      '<div class="data-grid"><div class="data-card card"><h3>备份 / 迁移</h3><p>导出为 JSON 文件；在新浏览器/新电脑打开本页面后导入即可恢复全部记录。</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-export-all="1">导出全部记录 (JSON)</button>' +
      '<label class="btn" style="cursor:pointer">导入记录 JSON<input type="file" id="importFile" accept=".json,application/json" style="display:none"></label>' +
      '<button class="btn" data-export-answers="1">导出作答记录 (Markdown)</button></div>' +
      '<div style="margin-top:14px"><div class="kv"><span>存储占用</span><b>' + (size / 1024).toFixed(1) + ' KB</b></div><div class="kv"><span>存储键名</span><span class="mono small">' + STORE_KEY + '</span></div><div class="kv"><span>自动保存</span><b>已开启</b></div></div></div>' +
      '<div class="data-card card"><h3>清空记录</h3><p>清空会删除所有作答、状态、错题本与模考计时，不可恢复。建议先导出备份。</p>' +
      '<button class="btn danger" data-clear-all="1">清空全部记录</button>' +
      '<p style="margin-top:14px">隐私说明：所有数据仅保存在你的浏览器本地，本页面不联网、不上传任何内容。</p></div></div>';
  }

  /* ================= 行为 ================= */
  function setAnswer(id, text) {
    var a = store.answers[id] || { text: '', note: '', updated: 0 };
    a.text = text;
    a.updated = Date.now();
    store.answers[id] = a;
    save();
    var el = document.getElementById('saved-' + id);
    if (el) el.textContent = '已保存 ' + fmtTime(a.updated);
  }
  function setNote(id, note) {
    var a = store.answers[id] || { text: '', note: '', updated: 0 };
    a.note = note;
    a.updated = a.updated || Date.now();
    store.answers[id] = a;
    save();
  }
  function setStatus(id, v) {
    store.status[id] = v;
    save();
    var segs = document.querySelectorAll('[data-status="' + id + '"]');
    for (var i = 0; i < segs.length; i++) segs[i].classList.toggle('on', segs[i].dataset.v === v);
  }
  function toggleWrong(id) {
    if (store.wrong[id]) {
      delete store.wrong[id];
      toast('已从错题本移除');
    } else {
      store.wrong[id] = { added: Date.now(), reason: '' };
      toast('已加入错题本');
    }
    save();
    var btns = document.querySelectorAll('[data-wrong="' + id + '"]');
    var on = !!store.wrong[id];
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('on', on);
      btns[i].textContent = on ? '★ 已收录错题本' : '☆ 加入错题本';
    }
  }
  function gotoProblem(id) {
    var p = BY_ID[id];
    if (!p) return;
    if (p._exam) { location.hash = '#/exam/' + p._exam; var ses = store.exams[p._exam]; if (ses) ses.current = examById(p._exam).problems.indexOf(p) + 1; }
    else location.hash = '#/library/' + id;
  }
  function viewPractice() {
    var p = BY_ID[state.problemId];
    var list = filtered();
    if (!list.some(function(x) { return x.id === p.id; })) list = PROBLEMS;
    var idx = list.indexOf(p);
    var cat = CAT_MAP[p.cat];
    var guideBtn = (cat && cat.guide) ? '<a class="btn small" href="#/guide/' + cat.guide + '">看考点精讲</a>' : '';
    return '<div class="practice-toolbar"><a class="btn small" href="#/library">← 返回题库</a><button class="btn small" data-toggle-list aria-expanded="true">收起题目列表</button>' + guideBtn + '<span class="muted small">作答自动保存 · ' + (idx+1) + ' / ' + list.length + '</span><span class="spacer"></span><button class="btn small" data-goto-problem="' + (list[idx-1] || p).id + '" ' + (idx === 0 ? 'disabled' : '') + '>上一题</button><button class="btn small" data-goto-problem="' + (list[idx+1] || p).id + '" ' + (idx === list.length-1 ? 'disabled' : '') + '>下一题</button></div><div class="practice-layout"><aside class="practice-nav card" aria-label="题目列表"><div class="practice-nav-title">题目列表 <span class="muted small">' + list.length + ' 题</span></div>' + list.map(function(x) { return '<a href="#/library/' + x.id + '" class="practice-link ' + (x.id === p.id ? 'active' : '') + '" ' + (x.id === p.id ? 'aria-current="page"' : '') + '><span class="mono">' + x.id + '</span><span>' + esc(x.title) + '</span></a>'; }).join('') + '</aside><section class="practice-main">' + cardHtml(p) + '</section></div>';
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function exportAll() {
    saveNow();
    download('计导期末复习-记录备份-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(store, null, 2));
    toast('已导出 JSON 备份');
  }
  function exportAnswersMd() {
    var lines = ['# 计导期末复习 · 作答记录', '', '导出时间：' + new Date().toLocaleString(), ''];
    var n = 0;
    PROBLEMS.forEach(function (p) {
      var a = answerOf(p.id);
      if (!a.text || !a.text.trim()) return;
      n++;
      lines.push('## ' + p.id + ' ' + p.title, '', '状态：' + ({ todo: '未做', doing: '在练', done: '已掌握', review: '需复习' }[statusOf(p.id)] || '') + '　难度：' + p.difficulty + '★', '');
      lines.push('```c');
      lines.push(a.text);
      lines.push('```', '');
      if (a.note) lines.push('> 备注：' + a.note, '');
    });
    if (!n) { toast('还没有作答记录'); return; }
    download('计导期末复习-作答记录.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    toast('已导出 ' + n + ' 道题的作答');
  }
  function exportWrongMd() {
    var list = wrongList();
    if (!list.length) { toast('错题本还是空的'); return; }
    var lines = ['# 错题本（计导期末复习）', '', '共 ' + list.length + ' 题', ''];
    list.forEach(function (it) {
      lines.push('- **' + it.id + '** ' + it.p.title + '（' + catName(it.p.cat) + '）' + (it.w.reason ? '　错误原因：' + it.w.reason : ''));
    });
    download('计导期末复习-错题本.md', lines.join('\n'), 'text/markdown;charset=utf-8');
    toast('已导出错题本');
  }
  function startExam(id, reset) {
    var e = examById(id);
    if (!e) return;
    if (reset) {
      if (!confirm('重新模考会重新开始计时，已作答内容会保留，确定吗？')) return;
      store.exams[id] = { startedAt: Date.now(), submittedAt: null, current: 1 };
      saveNow();
    } else if (!store.exams[id]) {
      store.exams[id] = { startedAt: Date.now(), submittedAt: null, current: 1 };
      saveNow();
    }
    location.hash = '#/exam/' + id;
    if (state.view === 'exam') render();
  }

  /* ================= 事件 ================= */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var el;

    if ((el = t.closest('[data-toggle-list]'))) {
      var collapsed = document.querySelector('.practice-layout').classList.toggle('list-collapsed');
      el.textContent = collapsed ? '展开题目列表' : '收起题目列表';
      el.setAttribute('aria-expanded', String(!collapsed)); return;
    }
    if ((el = t.closest('[data-copy-btn]'))) return;

    if ((el = t.closest('.copy-btn'))) {
      var box = el.closest('.sample') || el.closest('.sol-code-wrap');
      var pre = box && box.querySelector('pre');
      if (pre) copyText(pre.textContent);
      ev.preventDefault();
      return;
    }
    if ((el = t.closest('[data-cat]'))) {
      state.cat = el.dataset.cat; state.page = 1; renderList(); return;
    }
    if ((el = t.closest('[data-diff]'))) {
      state.diff = Number(el.dataset.diff); state.page = 1; renderList(); return;
    }
    if ((el = t.closest('[data-st]'))) {
      state.status = el.dataset.st; state.page = 1; renderList(); return;
    }
    if ((el = t.closest('[data-status]'))) {
      setStatus(el.dataset.status, el.dataset.v);
      return;
    }
    if ((el = t.closest('[data-wrong]'))) {
      toggleWrong(el.dataset.wrong);
      return;
    }
    if ((el = t.closest('[data-clear-answer]'))) {
      var cid = el.dataset.clearAnswer;
      if (!confirm('清空这道题的作答记录？')) return;
      store.answers[cid] = { text: '', note: '', updated: 0 };
      saveNow();
      var card = document.getElementById('p-' + cid);
      if (card) { var ta = card.querySelector('[data-answer]'); if (ta) ta.value = ''; var nt = card.querySelector('[data-note]'); if (nt) nt.value = ''; }
      var sv = document.getElementById('saved-' + cid); if (sv) sv.textContent = '已清空';
      toast('已清空');
      return;
    }
    if ((el = t.closest('[data-load-more]'))) {
      state.page++; renderList(); return;
    }
    if ((el = t.closest('[data-goto-cat]'))) {
      ev.preventDefault();
      state.cat = el.dataset.gotoCat; state.view = 'library'; location.hash = '#/library';
      if (state.view === 'library' && location.hash === '#/library') render();
      return;
    }
    if ((el = t.closest('[data-nav-href]'))) {
      location.hash = el.dataset.navHref; return;
    }
    if ((el = t.closest('[data-goto-problem]'))) { gotoProblem(el.dataset.gotoProblem); return; }
    if ((el = t.closest('[data-remove-wrong]'))) {
      delete store.wrong[el.dataset.removeWrong];
      saveNow();
      render();
      toast('已从错题本移除');
      return;
    }
    if ((el = t.closest('[data-clear-wrong]'))) {
      if (!Object.keys(store.wrong).length) { toast('错题本已经是空的'); return; }
      if (!confirm('清空错题本？所有记录将被删除。')) return;
      store.wrong = {};
      saveNow();
      render();
      toast('错题本已清空');
      return;
    }
    if ((el = t.closest('[data-export-wrong]'))) { exportWrongMd(); return; }
    if ((el = t.closest('[data-export-all]'))) { exportAll(); return; }
    if ((el = t.closest('[data-export-answers]'))) { exportAnswersMd(); return; }
    if ((el = t.closest('[data-clear-all]'))) {
      if (!confirm('确定清空全部记录吗？此操作不可恢复，建议先导出备份。')) return;
      if (!confirm('再次确认：清空全部作答、状态、错题本与模考记录？')) return;
      store = emptyStore();
      saveNow();
      render();
      toast('已清空全部记录');
      return;
    }
    if ((el = t.closest('[data-start-exam]'))) {
      startExam(el.dataset.startExam, el.dataset.reset === '1');
      return;
    }
    if ((el = t.closest('[data-exam-no]'))) {
      var e0 = examById(state.examId); if (!e0) return;
      var s0 = store.exams[e0.id]; if (!s0) return;
      s0.current = Number(el.dataset.examNo); saveNow(); render();
      return;
    }
    if ((el = t.closest('[data-exam-prev]'))) {
      var e1 = examById(state.examId); if (!e1) return;
      var s1 = store.exams[e1.id]; if (!s1) return;
      s1.current = Math.max(1, (s1.current || 1) - 1); saveNow(); render(); return;
    }
    if ((el = t.closest('[data-exam-next]'))) {
      var e2 = examById(state.examId); if (!e2) return;
      var s2 = store.exams[e2.id]; if (!s2) return;
      s2.current = Math.min(e2.problems.length, (s2.current || 1) + 1); saveNow(); render(); return;
    }
    if ((el = t.closest('[data-exam-submit]'))) {
      var e3 = examById(state.examId); if (!e3) return;
      submitExam(e3, false); return;
    }
    if ((el = t.closest('[data-exam-exit]'))) {
      location.hash = '#/exams'; return;
    }
    if ((el = t.closest('[data-sheet]'))) {
      var idx = Number(el.dataset.sheet);
      if (state.view === 'guide') {
        var g = GUIDE[idx];
        if (!g) return;
        state.guideId = g.id;
        var target = '#/guide/' + g.id;
        if (location.hash === target) { render(); } else { location.hash = target; }
        return;
      }
      var sec = document.getElementById('sheet-' + idx);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.matches('[data-answer]')) { setAnswer(t.dataset.answer, t.value); return; }
    if (t.matches('[data-note]')) { setNote(t.dataset.note, t.value); return; }
    if (t.matches('[data-wrong-reason]')) {
      var id = t.dataset.wrongReason;
      if (store.wrong[id]) { store.wrong[id].reason = t.value; save(); }
      return;
    }
    if (t.id === 'searchInput') {
      state.q = t.value; state.page = 1; renderList(); return;
    }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'wrongOnly') { state.wrongOnly = t.checked; state.page = 1; renderList(); return; }
    if (t.id === 'importFile') {
      var f = t.files && t.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(String(reader.result));
          if (!obj || typeof obj !== 'object' || !obj.answers) throw new Error('格式不对');
          if (!confirm('导入将覆盖当前全部记录（作答、状态、错题本、模考）。确定导入吗？')) return;
          var base = emptyStore();
          Object.keys(base).forEach(function (k) { if (obj[k] && typeof obj[k] === 'object') base[k] = obj[k]; });
          store = base;
          saveNow();
          render();
          toast('导入成功');
        } catch (err) {
          alert('导入失败：文件不是有效的备份 JSON。');
        }
      };
      reader.readAsText(f, 'utf-8');
      t.value = '';
      return;
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && state.view === 'exam') {
      if (confirm('退出考场？作答已自动保存，下次可继续。')) location.hash = '#/exams';
    }
  });

  /* ================= 顶部主题按钮 ================= */
  document.getElementById('themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    var next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    store.settings.theme = next; save();
    toast(next === 'dark' ? '已切换到深色模式' : '已切换到浅色模式');
  });

  /* ================= 启动 ================= */
  function applyTheme() {
    var t = store.settings.theme;
    if (!t) {
      t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  }
  applyTheme();
  route();

  if (state.view === 'exam') {
    var e = examById(state.examId);
    if (e) startTimer(e);
  }
  var _origRender = render;
  render = function () {
    _origRender();
    if (state.view === 'exam') {
      var ex = examById(state.examId);
      if (ex) startTimer(ex);
    }
  };
  window.__SITE__ = { problems: PROBLEMS.length, exams: EXAMS.length, sections: SECTIONS.length };
})();
