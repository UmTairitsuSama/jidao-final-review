/**
 * UI 冒烟测试：用 Chrome DevTools Protocol 驱动无头 Chrome，验证离线网页的核心交互。
 * 用法：node tools/ui_test.mjs [页面路径]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const target = args.find((arg) => arg !== '--judge') || path.join(ROOT, '计导期末复习.html');
const url = target.startsWith('http://127.0.0.1:') ? target : pathToFileURL(path.resolve(target)).href;
const PORT = Number(process.env.UI_TEST_PORT || 9333);
const PROFILE = path.join(ROOT, 'tmp', 'ui-profile-' + PORT);
const SHOT_DIR = path.join(ROOT, 'tmp', 'shots');
const W = 1366, H = 768;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function test(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

if (!PROFILE.startsWith(ROOT + path.sep)) throw new Error('Unsafe test profile path');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  `--window-size=${W},${H}`, 'about:blank'
], { stdio: 'ignore' });

async function getJSON(url) {
  const r = await fetch(url);
  return r.json();
}
async function waitFor(fn, timeout = 15000, step = 200) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await sleep(step);
  }
  throw new Error('waitFor timeout');
}

let ws, msgId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 20000);
  });
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('JS error: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, name + '.png'), Buffer.from(r.data, 'base64'));
}
async function nav(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await sleep(450);
}
async function click(selector) {
  const ok = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.click();return true;})()`);
  if (!ok) throw new Error('找不到元素: ' + selector);
  await sleep(350);
}
async function type(selector, text) {
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;el.value=${JSON.stringify(text)};el.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
  await sleep(600);
}
async function store() {
  return evaluate('JSON.parse(localStorage.getItem("cd_review_v2")||"{}")');
}

try {
  const targets = await waitFor(async () => {
    const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
    return list.find((t) => t.type === 'page');
  });
  ws = new WebSocket(targets.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  await send('Page.navigate', { url });
  await sleep(1500);

  // 1. 页面加载
  const site = await evaluate('window.__SITE__');
  test('页面加载与数据注入', !!site && site.problems > 0, JSON.stringify(site));
  const errBox = await evaluate(`!!Array.from(document.querySelectorAll('div')).find(d=>d.textContent.includes('页面脚本错误'))`);
  test('无脚本错误提示', !errBox);
  test('首页 hero 与考点卡片', await evaluate('!!document.querySelector(".hero h1") && document.querySelectorAll(".progress-card").length >= 6'));
  await shot('01-home');

  // 2. 本地存储可用（file:// 下的 localStorage）
  const lsOk = await evaluate(`(()=>{try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return true}catch(e){return false}})()`);
  test('当前入口可用 localStorage', lsOk);

  // 3. 题库：分类过滤 + 搜索 + 作答保存 + 状态 + 错题
  await nav('#/library');
  const catBtns = await evaluate(`document.querySelectorAll('[data-cat]').length`);
  test('考点分类齐全', catBtns >= 12, `${catBtns} 个分类按钮`);
  await click('[data-cat="array1"]');
  const count1 = await evaluate(`document.querySelectorAll('#problemList .problem-summary').length`);
  const rc = await evaluate(`document.getElementById('resultCount').textContent`);
  test('分类过滤（一维数组）', count1 > 0, rc);
  await click('[data-cat="all"]');

  const firstId = await evaluate(`document.querySelector('#problemList .problem-summary .p-id').textContent.trim()`);
  await click('#problemList .problem-summary');
  test('单题作答界面', await evaluate('document.querySelectorAll(".practice-main .problem").length === 1 && !!document.querySelector(".practice-nav")'));
  await click('[data-toggle-list]');
  test('收起列表', await evaluate('document.querySelector(".practice-layout").classList.contains("list-collapsed")'));
  await click('[data-toggle-list]');
  await type(`[data-answer="${firstId}"]`, 'int main(){ /* 我的作答 */ return 0; }');
  let s = await store();
  test('作答自动保存到 localStorage', !!(s.answers && s.answers[firstId] && s.answers[firstId].text.includes('我的作答')), firstId);
  await click(`[data-status="${firstId}"][data-v="done"]`);
  s = await store();
  test('掌握状态保存', s.status && s.status[firstId] === 'done');
  await click(`[data-wrong="${firstId}"]`);
  s = await store();
  test('加入错题本记录题号', !!(s.wrong && s.wrong[firstId]), firstId);
  test('署名已更新', await evaluate('document.querySelector(".brand-text small").textContent === "provided by：UmTairitsuSama(songqi)"'));
  test('左侧题面与右侧评测顶部对齐，滚动互相独立', await evaluate(`(() => {
    const left = document.querySelector('.practice-statement');
    const right = document.querySelector('.practice-answer');
    const title = left.querySelector('.stars');
    const spacer = document.createElement('div');
    spacer.style.height = '100vh';
    left.append(spacer);
    const rightSpacer = spacer.cloneNode();
    right.append(rightSpacer);
    left.scrollTop = 150;
    window.scrollTo(0, 200);
    const leftMoves = left.scrollTop > 0 && right.scrollTop === 0;
    left.scrollTop = 0;
    right.scrollTop = 150;
    const rightMoves = right.scrollTop > 0 && left.scrollTop === 0;
    right.scrollTop = 0;
    spacer.remove();
    rightSpacer.remove();
    return leftMoves && rightMoves && window.scrollY === 0 &&
      left.getBoundingClientRect().top === right.getBoundingClientRect().top && !!title;
  })()`));
  await shot('02-library');

  if (args.includes('--judge')) {
    const code = '[data-code-editor]';
    await nav('#/library/A01');
    const edited = await evaluate(`(() => {
      const editor = document.querySelector('[data-code-editor]');
      editor.value = 'int main() ';
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
      for (const key of ['{', 'Enter', '(']) {
        editor.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }
      return editor.value === 'int main() {\\n    ()\\n}' && editor.selectionStart === 18 &&
        getComputedStyle(editor).resize === 'vertical';
    })()`);
    test('编辑器括号补全、自动缩进与拉长', edited);
    await type(code, '#include <stdio.h>\nint main(void) { /* first line\n second line */ printf("%d", 42); return 0; }');
    await waitFor(() => evaluate('!!document.querySelector(".c-highlight span[style]")'));
    const dark = await evaluate('document.documentElement.dataset.theme === "dark"');
    const commentColor = dark ? 'rgb(106, 153, 85)' : 'rgb(0, 128, 0)';
    const highlighted = await evaluate(`[...document.querySelectorAll('.c-highlight span[style]')]
      .some((span) => span.textContent.includes('second line') && span.style.color === ${JSON.stringify(commentColor)})`);
    test('使用 VS Code 语法与主题为多行注释着色', highlighted);
    const resultSelector = '[data-judge-result]';
    async function judge(action) {
      await click('[data-judge="' + action + '"]');
      await waitFor(() => evaluate('!document.querySelector(\'[data-judge="run"]\').disabled'), 130000, 500);
      const selector = action === 'submit' ? '#judge-dialog' : resultSelector;
      return evaluate('document.querySelector(' + JSON.stringify(selector) + ').textContent');
    }
    async function closeReport() {
      await click('#judge-dialog button');
    }
    const solution = await evaluate('window.__DATA__.problems.find(p => p.id === "A01").solution');
    const statusButton = (status) => '[data-status="A01"][data-v="' + status + '"]';
    async function hasStatus(status) {
      return (await store()).status.A01 === status &&
        await evaluate('document.querySelector(' + JSON.stringify(statusButton(status)) + ').getAttribute("aria-pressed") === "true"');
    }
    await click(statusButton('review'));
    await type(code, solution);
    await click('[data-judge="sample"]');
    const run = await judge('run');
    test('C 自测按 stdin 返回 stdout', run.includes('The sum is 3 and the difference is -1.'), run);
    test('运行自测后保留掌握状态', await hasStatus('review'));
    const grade = await judge('submit');
    const count = await evaluate('window.__DATA__.problems.filter(p => p.id === "A01").map(p => p.samples.length + p.checkpoints.length)[0]');
    const partialScore = Math.round(10000 / count) / 100;
    test('提交弹窗逐项对比输出并计分', grade.includes('100 / 100 分') && grade.includes(`通过 ${count} / ${count}`) &&
      await evaluate(`document.querySelector('#judge-dialog').open &&
        document.querySelectorAll('.judge-case').length === ${count} &&
        [...document.querySelectorAll('.judge-case')].every(c => c.querySelector('[data-actual]').textContent === c.querySelector('[data-expected]').textContent)`), grade.slice(0, 130));
    await closeReport();
    test('满分提交自动设为已掌握', grade.includes('本次提交 · 已掌握') && await hasStatus('done'));
    test('满分立即标绿', await evaluate('!document.querySelector("[data-full-score=A01]").hidden'));
    await nav('#/library/A02');
    await nav('#/library/A01');
    test('切题后恢复最近一次评测分数', (await evaluate('document.querySelector("[data-judge-grade]").textContent')).includes('最近 100 / 100'));
    await type(code, '#include <stdio.h>\nint main(void){puts("The sum is 3 and the difference is -1.");}');
    const partial = await judge('submit');
    test('部分分显示实际输出与标准输出的差异', partial.includes(`${partialScore} / 100 分`) && partial.includes(`通过 1 / ${count}`) &&
      await evaluate(`[...document.querySelectorAll('.judge-case')].some(c =>
        c.querySelector('[data-actual]').textContent !== c.querySelector('[data-expected]').textContent)`));
    await closeReport();
    test('再次提交未满分自动设为在练', partial.includes('本次提交 · 在练') && await hasStatus('doing'));
    const grades = (await store()).grades;
    test('最近得分和最高分独立保存，仍保留满分标记', grades?.A01?.latest === partialScore && grades?.A01?.best === 100 &&
      await evaluate('!document.querySelector("[data-full-score=A01]").hidden'));
    await type(code, 'int main( {');
    const invalid = await judge('submit');
    test('编译错误弹窗显示零分和未运行的检查点', invalid.includes('编译错误') && invalid.includes('0 / 100 分') && invalid.includes('未运行'));
    await closeReport();
    test('编译失败按零分设为在练', await hasStatus('doing'));
    await click('[data-judge-tab="issues"]');
    test('问题面板列出带行号的编译诊断', await evaluate(`document.querySelector('[data-judge-tab="issues"]').getAttribute('aria-selected') === 'true' &&
      !!document.querySelector('[data-issue-line="1"]') && document.querySelector('[data-judge-result]').hidden`));
    await click('[data-issue-line="1"]');
    test('点击编译诊断定位到代码编辑器', await evaluate('document.activeElement.matches("[data-code-editor]")'));
    await click('[data-judge-tab="terminal"]');
    test('终端保留原始编译诊断', await evaluate('document.querySelector("[data-judge-result]").textContent.includes("error:")'));
    await type(code, 'int main(void){ for (;;) {} }');
    const timeout = await judge('run');
    test('停止超时的 C 程序', timeout.includes('运行超时'), timeout);
    await type(code, 'int main(){ /* 我的作答 */ return 0; }');
    await send('Page.reload');
    await waitFor(() => evaluate('!!document.querySelector("[data-status]")'));
    test('刷新后保留自动设置的状态', await hasStatus('doing'));

    await nav('#/exam/FM7');
    const examSolution = await evaluate('window.__DATA__.exams.find(e => e.id === "FM7").problems[0].solution');
    await type(code, examSolution);
    const examGrade = await judge('submit');
    test('模考题按自身分值识别满分', examGrade.includes('10 / 10 分') && (await store()).status['FM7-1'] === 'done');
    await closeReport();
  }

  // 4. 搜索
  await nav('#/library');
  await type('#searchInput', '排序');
  const searchCount = await evaluate(`document.querySelectorAll('#problemList .problem-summary').length`);
  test('搜索过滤', searchCount >= 1 && searchCount <= 10, `命中 ${searchCount} 题`);
  await type('#searchInput', '');

  // 5. 错题本页面
  await nav('#/wrong');
  const wrongPage = await evaluate(`document.body.innerText`);
  test('错题本页面显示题号', wrongPage.includes(firstId), firstId);
  await shot('03-wrong');

  // 6. 章节路由
  await nav('#/cheatsheet');
  await click('.chapter-nav a:nth-of-type(2)');
  const sheet = await evaluate(`location.hash === '#/cheatsheet/2' &&
    document.querySelectorAll('.sheet-section').length === 1 &&
    document.querySelector('.chapter-nav [aria-current="page"]').textContent === document.querySelector('.sheet-section h2').textContent`);
  test('速查手册目录切换到独立章节', sheet);

  await nav('#/guide/g-pointer');
  const atPointer = await evaluate(`document.querySelectorAll('.sheet-section').length === 1 &&
    document.querySelector('.chapter-nav [aria-current="page"]').getAttribute('href') === '#/guide/g-pointer' &&
    document.querySelector('.sheet-section h2').textContent.includes('指针')`);
  test('知识精讲章节链接只打开指定章节', atPointer);
  await shot('03b-guide');

  // 7. 模拟考试：开始 → 计时 → 作答 → 交卷 → 答案
  await nav('#/exams');
  const examCards = await evaluate(`document.querySelectorAll('[data-start-exam]').length`);
  test('模拟卷列表', examCards >= 6, `${examCards} 套`);
  await click('[data-start-exam]');
  await sleep(600);
  const inRoom = await evaluate(`!!document.querySelector('.exam-room')`);
  test('进入考场', inRoom);
  const timerTxt = await evaluate(`(document.getElementById('examTimer')||{}).textContent`);
  test('倒计时运行', /^\d{2,3}:\d{2}$/.test(timerTxt || ''), timerTxt);
  const examQid = await evaluate(`document.querySelector('.exam-main .p-id').textContent.trim()`);
  await type(`[data-answer="${examQid}"]`, '/* 模考作答 */');
  await click('[data-exam-no="2"]');
  const q2 = await evaluate(`document.querySelector('.exam-main .p-id').textContent.trim()`);
  test('考场切题', q2 !== examQid, `${examQid} → ${q2}`);
  await shot('04-exam');
  await click('[data-exam-submit]');
  await sleep(500);
  const submitted = await evaluate(`!!document.querySelector('.exam-submitted')`);
  test('交卷后显示参考答案', submitted);
  await shot('05-exam-submitted');

  // 8. 主题切换
  await nav('#/home');
  const before = await evaluate(`document.documentElement.dataset.theme`);
  await click('#themeBtn');
  const after = await evaluate(`document.documentElement.dataset.theme`);
  test('主题切换', before !== after, `${before} → ${after}`);

  // 9. 刷新后记录仍在
  await send('Page.reload');
  await sleep(1400);
  s = await store();
  test('刷新后数据持久化', !!(s.answers && s.answers[firstId] && s.answers[firstId].text.includes('我的作答')));
  await shot('06-home-reload');

  // 10. 汇总
  const kpi = await evaluate(`document.querySelectorAll('.hero .kpi b').length`);
  test('首页统计渲染', kpi >= 3, `${kpi} 项`);

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const [route, name] of [
    ['#/home', '总览'], ['#/library', '题库'], ['#/library/A01', '做题页'], ['#/guide/g-pointer', '知识精讲'], ['#/exams', '模拟考试']
  ]) {
    await nav(route);
    test('窄屏布局无整页横向溢出 · ' + name, await evaluate('document.documentElement.scrollWidth <= innerWidth && innerWidth === 390'));
    await shot('mobile-' + route.slice(2).replaceAll('/', '-'));
  }

} catch (e) {
  test('测试框架异常', false, e.message);
  console.error(e);
} finally {
  try { chrome.kill(); } catch (e) {}
  const failed = results.filter((r) => !r.ok);
  console.log(`\n===== ${results.length - failed.length}/${results.length} 通过 =====`);
  if (failed.length) {
    console.log('失败项：');
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
}
