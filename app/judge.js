  const judgeWorkerSource = %%JUDGE_WORKER%%;
  const verdicts = {
    ok: '通过', wrong: '答案错误', runtime: '运行错误',
    timeout: '运行超时', output: '输出超限',
  };
  let activeJudge;
  let lastCompilation;
  const judgeReports = new Map();
  const nativeJudge = window.__NATIVE_JUDGE__;

  const cLiterals = /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|(?![\s\S])))|(?<string>"(?:\\[\s\S]|[^"\\\n])*(?:"|\\?)|'(?:\\[\s\S]|[^'\\\n])*(?:'|\\?))/g;
  let vscodeHighlight, vscodeLoading;

  async function unpackVscodeAsset(encoded) {
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }

  function refreshVscodeEditors() {
    const editors = document.querySelectorAll('[data-code-editor]');
    if (!editors.length) return;
    if (!vscodeLoading) {
      vscodeLoading = (async function () {
        const asset = JSON.parse(document.getElementById('vscode-c-assets').textContent);
        const [data, engine] = await Promise.all([unpackVscodeAsset(asset.data), unpackVscodeAsset(asset.wasm)]);
        const bundle = JSON.parse(new TextDecoder().decode(data));
        await onig.loadWASM(engine);
        const registry = new vscodetextmate.Registry({
          onigLib: Promise.resolve({
            createOnigScanner: (patterns) => new onig.OnigScanner(patterns),
            createOnigString: (value) => new onig.OnigString(value),
          }),
          loadGrammar: async (scope) => bundle.grammars[scope] || null,
        });
        const grammar = await registry.loadGrammar('source.c');
        vscodeHighlight = { registry, grammar, themes: bundle.themes, theme: null };
      })().catch((error) => console.error('VS Code C syntax initialization failed', error));
    }
    vscodeLoading.then(() => {
      if (!vscodeHighlight) return;
      const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      if (vscodeHighlight.theme !== theme) {
        vscodeHighlight.registry.setTheme(vscodeHighlight.themes[theme]);
        vscodeHighlight.theme = theme;
        vscodeHighlight.colors = vscodeHighlight.registry.getColorMap();
      }
      document.querySelectorAll('[data-code-editor]').forEach((editor) => syncCodeHighlight(editor, true));
    });
  }

  function highlightC(value) {
    if (!vscodeHighlight) return esc(value) + '\n';
    const { grammar, colors } = vscodeHighlight;
    let ruleStack = vscodetextmate.INITIAL;
    return value.split('\n').map((line) => {
      const result = grammar.tokenizeLine2(line, ruleStack, 30);
      ruleStack = result.ruleStack;
      let html = '';
      for (let index = 0; index < result.tokens.length; index += 2) {
        const start = result.tokens[index];
        const end = result.tokens[index + 2] ?? line.length;
        const metadata = result.tokens[index + 1];
        const color = colors[(metadata >>> 15) & 0x1ff];
        const font = (metadata >>> 11) & 15;
        const decoration = [font & 4 ? 'underline' : '', font & 8 ? 'line-through' : ''].filter(Boolean).join(' ');
        const style = (color ? 'color:' + color + ';' : '') +
          (font & 1 ? 'font-style:italic;' : '') + (font & 2 ? 'font-weight:bold;' : '') +
          (decoration ? 'text-decoration:' + decoration : '');
        html += '<span style="' + style + '">' + esc(line.slice(start, end)) + '</span>';
      }
      return html;
    }).join('\n') + '\n';
  }

  function syncCodeHighlight(editor, refresh) {
    const display = editor.previousElementSibling;
    if (refresh) display.firstElementChild.innerHTML = highlightC(editor.value);
    display.firstElementChild.style.transform = 'translate(' + -editor.scrollLeft + 'px,' + -editor.scrollTop + 'px)';
  }

  function editCode(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
    const editor = event.target;
    const key = event.key;
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    const closing = Object.values(pairs).includes(key);
    if (key !== 'Enter' && key !== 'Tab' && key !== 'Backspace' && !pairs[key] && !closing) return false;
    let start = editor.selectionStart;
    let end = editor.selectionEnd;
    const value = editor.value;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    const indent = line.match(/^[ \t]*/)[0];
    const selected = value.slice(start, end);
    const tab = '    ';
    let insert, selectStart, selectEnd;

    if (key === 'Enter') {
      const opener = line.trimEnd().slice(-1);
      const nested = !cLiteralAtEnd(before) && ['{', '(', '['].includes(opener);
      insert = '\n' + indent + (nested ? tab : '');
      selectStart = selectEnd = start + insert.length;
      if (nested && after[0] === pairs[opener]) insert += '\n' + indent;
    } else if (key === 'Tab') {
      if (event.shiftKey) return false;
      insert = ' '.repeat(4 - line.replace(/\t/g, tab).length % 4);
    } else if (key === 'Backspace') {
      if (selected || !pairs[before.slice(-1)] || pairs[before.slice(-1)] !== after[0]) return false;
      start--;
      end++;
      insert = '';
    } else if (closing && !selected && after[0] === key) {
      event.preventDefault();
      editor.setSelectionRange(start + 1, start + 1);
      return true;
    } else if (pairs[key] && (selected || !cLiteralAtEnd(before))) {
      const quotes = key === '"' || key === "'";
      if (quotes && !selected && (/\w$/.test(before) || /\w/.test(after[0] || '') ||
        (before.match(/\\+$/)?.[0].length || 0) % 2)) return false;
      insert = key + selected + pairs[key];
      selectStart = start + 1;
      selectEnd = selectStart + selected.length;
    } else if (key === '}' && !selected && line === indent && indent) {
      start = lineStart;
      insert = indent.replace(/(?:\t| {1,4})$/, '') + key;
    } else {
      return false;
    }

    event.preventDefault();
    editor.setSelectionRange(start, end);
    if (!document.execCommand(insert ? 'insertText' : 'delete', false, insert)) {
      editor.setRangeText(insert, start, end, 'end');
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (selectStart !== undefined) editor.setSelectionRange(selectStart, selectEnd);
    return true;
  }

  function cLiteralAtEnd(before) {
    let last;
    for (const match of before.matchAll(cLiterals)) last = match;
    if (!last || last.index + last[0].length !== before.length) return false;
    if (last.groups.comment) return last[0].startsWith('//') || !last[0].endsWith('*/');
    if (!last.groups.string) return false;
    const literal = last[0];
    return literal.length === 1 || literal[0] !== literal.at(-1) ||
      (literal.slice(0, -1).match(/\\+$/)?.[0].length || 0) % 2 !== 0;
  }

  function checkpoints(p) {
    return (p.samples || []).concat(p.checkpoints || []);
  }

  function maxJudgeScore(problem) {
    const points = problem._exam && problem.desc.match(/本题\s*(\d+)\s*分/);
    return points ? Number(points[1]) : 100;
  }

  function gradeOf(problem) {
    const grade = store.grades[problem.id];
    if (grade) return grade;
    const legacy = String(answerOf(problem.id).judge || '').match(/^(?:编译错误 · )?(\d+(?:\.\d+)?) \/ (\d+) 分/);
    if (!legacy) return null;
    return { latest: Number(legacy[1]), best: Number(legacy[1]), max: Number(legacy[2]) };
  }

  function hasFullScore(problem) {
    const grade = gradeOf(problem);
    return grade?.max === 100 && grade.best === 100 && grade.caseCount === checkpoints(problem).length;
  }

  function gradeHtml(problem) {
    const grade = gradeOf(problem);
    if (grade && grade.caseCount !== checkpoints(problem).length) {
      return '<span>旧版检查点最高 ' + esc(grade.best) + ' / ' + esc(grade.max) + ' 分，请重新提交评测。</span>';
    }
    return grade ? '<span>最近 ' + esc(grade.latest) + ' / ' + esc(grade.max) + ' 分</span>' +
      '<span>最高 ' + esc(grade.best) + ' / ' + esc(grade.max) + ' 分</span>' +
      (judgeReports.has(problem.id) ? '<button type="button" class="btn small" data-judge="report">查看评测详情</button>' : '') : '';
  }

  function showJudgeReport(problem, report) {
    const dialog = document.getElementById('judge-dialog');
    const cases = checkpoints(problem);
    dialog.querySelector('.judge-report').innerHTML =
      '<p class="judge-problem">' + esc(problem.id + ' · ' + problem.title) + '</p>' +
      '<div class="judge-score-row"><p class="judge-score">' + report.score + ' / ' + report.max + ' 分 <span>通过 ' + report.passed + ' / ' + cases.length + '</span></p>' +
      '<span class="status-label ' + report.status + '">本次提交 · ' + STATUS_LABELS[report.status] + '</span></div>' +
      (report.diagnostics ? '<details' + (report.compileFailed ? ' open' : '') + '><summary>' +
        (report.compileFailed ? '编译错误' : '编译信息') + '</summary><pre>' + esc(report.diagnostics) + '</pre></details>' : '') +
      cases.map(function (test, index) {
        const run = report.runs[index];
        const status = run ? verdicts[run.status] : '未运行';
        return '<section class="judge-case"><h3>检查点 ' + (index + 1) + '<span class="judge-verdict ' + (run ? run.status : 'pending') + '">' + status + '</span></h3>' +
          '<details><summary>查看输入</summary><pre>' + esc(test.in || '（无输入）') + '</pre></details>' +
          '<div class="judge-comparison"><div><h4>你的输出</h4><pre data-actual>' +
          esc(run ? run.out || '（无输出）' : '（编译失败，未运行）') + '</pre></div>' +
          '<div><h4>标准输出</h4><pre data-expected>' + esc(test.out || '（无输出）') + '</pre></div></div>' +
          (run?.err ? '<details><summary>标准错误</summary><pre>' + esc(run.err) + '</pre></details>' : '') +
          '</section>';
      }).join('');
    dialog.showModal();
    dialog.querySelector('.judge-report').scrollTop = 0;
  }

  function saveJudgeReport(problem, box, report) {
    const previous = gradeOf(problem);
    report.caseCount = checkpoints(problem).length;
    report.status = report.score === report.max ? 'done' : 'doing';
    store.grades[problem.id] = {
      latest: report.score,
      best: Math.max(report.score, previous?.max === report.max && previous.caseCount === report.caseCount ? previous.best : 0),
      caseCount: report.caseCount,
      max: report.max,
    };
    judgeReports.set(problem.id, report);
    setStatus(problem.id, report.status);
    saveNow();
    box.querySelector('[data-judge-grade]').innerHTML = gradeHtml(problem);
    const badge = document.querySelector('[data-full-score="' + problem.id + '"]');
    if (badge) badge.hidden = !hasFullScore(problem);
    showJudgeReport(problem, report);
  }

  function judgeTabs(p) {
    const id = esc(p.id);
    return '<div class="judge-console"><div class="judge-console-tabs" role="tablist" aria-label="编译与运行面板">' +
      '<button type="button" role="tab" id="issues-tab-' + id + '" aria-selected="false" tabindex="-1" aria-controls="issues-panel-' + id +
      '" data-judge-tab="issues">问题 <span data-issue-count></span></button>' +
      '<button type="button" role="tab" id="terminal-tab-' + id + '" aria-selected="true" aria-controls="terminal-panel-' + id +
      '" data-judge-tab="terminal">终端</button></div>' +
      '<div class="judge-issues" id="issues-panel-' + id + '" role="tabpanel" aria-labelledby="issues-tab-' + id + '" data-judge-panel="issues" hidden>' +
      '<p class="muted small">暂无编译问题</p></div>' +
      '<div class="judge-result" id="terminal-panel-' + id + '" role="tabpanel" aria-labelledby="terminal-tab-' + id +
      '" data-judge-panel="terminal" data-judge-result aria-live="polite" tabindex="0">C11 · ' + checkpoints(p).length + ' 个检查点</div></div>';
  }

  function selectJudgeTab(button, focus = false) {
    const consolePanel = button.closest('.judge-console');
    for (const tab of consolePanel.querySelectorAll('[data-judge-tab]')) {
      const selected = tab === button;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    }
    if (focus) button.focus();
  }

  function setJudgeIssues(box, diagnostics) {
    const problems = Array.from(diagnostics.matchAll(
      /^(?:(.+?):(\d+):(?:(\d+):)?\s*)?(fatal error|error|warning|note):\s*(.*)$/gm,
    ));
    box.querySelector('[data-issue-count]').textContent = problems.length || '';
    box.querySelector('[data-judge-panel="issues"]').innerHTML = problems.length
      ? '<ul>' + problems.map(([, file, line, column, severity, message]) => {
        const location = file ? file + ':' + line + (column ? ':' + column : '') : '';
        const level = severity.includes('error') ? 'error' : severity;
        const label = '<span class="judge-issue-level ' + level + '">' + esc(severity) + '</span>' +
          '<span>' + esc(message) + '</span>' + (location ? '<small>' + esc(location) + '</small>' : '');
        return '<li>' + (file && /(?:^|[\\/])main\.c$/.test(file)
          ? '<button type="button" data-issue-line="' + line + '" data-issue-column="' + (column || 1) + '">' + label + '</button>'
          : '<div class="judge-issue">' + label + '</div>') + '</li>';
      }).join('') + '</ul>'
      : '<p class="muted small">暂无编译问题</p>';
  }

  function gotoJudgeIssue(button) {
    const editor = button.closest('.answer-box').querySelector('[data-code-editor]');
    const lines = editor.value.split('\n');
    const row = Math.max(0, Math.min(Number(button.dataset.issueLine) - 1, lines.length - 1));
    const column = Math.max(0, Math.min(Number(button.dataset.issueColumn) - 1, lines[row].length));
    const offset = lines.slice(0, row).reduce((length, line) => length + line.length + 1, 0) + column;
    editor.scrollIntoView({ block: 'nearest' });
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(offset, offset);
    editor.scrollTop = Math.max(0, row - 2) * parseFloat(getComputedStyle(editor).lineHeight);
  }

  function judgeHtml(p) {
    return '<section class="judge-panel" aria-label="C 语言评测">' +
      '<div class="judge-engine muted small">' + (nativeJudge ? esc(nativeJudge.compiler) : 'Clang C11 · 浏览器评测') + '</div>' +
      '<label>自测输入 <span class="muted">stdin</span><textarea data-judge-input aria-label="自测输入" spellcheck="false" rows="3" placeholder="输入传给程序的内容"></textarea></label>' +
      '<div class="judge-actions">' +
      '<button type="button" class="btn small" data-judge="sample">填入样例</button>' +
      '<span class="spacer"></span>' +
      '<button type="button" class="btn small" data-judge="run">运行自测</button>' +
      '<button type="button" class="btn small teal" data-judge="submit">提交评测</button>' +
      '<button type="button" class="btn small" data-judge="cancel" hidden>停止</button></div>' +
      judgeTabs(p) +
      '<div class="judge-grade" data-judge-grade aria-live="polite">' + gradeHtml(p) + '</div></section>';
  }

  function workerTask(data, signal) {
    const url = URL.createObjectURL(new Blob([judgeWorkerSource], { type: 'text/javascript' }));
    return new Promise((resolve, reject) => {
      let worker, timer;
      function finish(error, result) {
        clearTimeout(timer);
        signal.removeEventListener('abort', stop);
        if (worker) worker.terminate();
        URL.revokeObjectURL(url);
        if (error) reject(error);
        else resolve(result);
      }
      function stop() {
        finish(new DOMException('已停止', 'AbortError'));
      }
      if (signal.aborted) { stop(); return; }
      try {
        worker = new Worker(url);
        signal.addEventListener('abort', stop, { once: true });
        timer = setTimeout(() => finish(new Error('加载评测环境超时，请检查网络后重试。')), data.module ? 30000 : 120000);
        worker.onmessage = ({ data: message }) => {
          if (message.running) {
            clearTimeout(timer);
            timer = setTimeout(() => finish(null, { status: 'timeout', out: '', err: '' }), 2000);
          } else if (message.toolError) {
            finish(new Error('评测环境加载或执行失败：' + message.toolError));
          } else {
            finish(null, message);
          }
        };
        worker.onerror = (event) => {
          const detail = event.message ? ' ' + event.message : '';
          finish(new Error('无法启动评测环境，请检查浏览器和网络后重试。' + detail));
        };
        worker.postMessage(data);
      } catch (error) {
        finish(error);
      }
    });
  }

  async function judgeTask(data, signal) {
    if (!nativeJudge) return workerTask(data, signal);
    const response = await fetch('/local-judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Judge-Token': nativeJudge.token },
      body: JSON.stringify(data),
      signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.toolError || '本机评测请求失败');
    return result;
  }

  function normalizeOutput(value) {
    const lines = value.replace(/\r\n?/g, '\n');
    if (!lines) return '';
    return (lines.endsWith('\n') ? lines : lines + '\n').replace(/[^\S\n]+$/gm, '');
  }

  function setJudgeBusy(box, busy) {
    for (const button of box.querySelectorAll('[data-judge="run"], [data-judge="submit"]')) {
      button.disabled = busy;
    }
    box.querySelector('[data-judge="cancel"]').hidden = !busy;
  }

  async function handleJudge(button) {
    const box = button.closest('.answer-box');
    const editor = box.querySelector('[data-answer]');
    const input = box.querySelector('[data-judge-input]');
    const result = box.querySelector('[data-judge-result]');
    const problem = BY_ID[editor.dataset.answer];
    const maxScore = maxJudgeScore(problem);
    const action = button.dataset.judge;
    if (action === 'report') {
      showJudgeReport(problem, judgeReports.get(problem.id));
      return;
    }
    if (action === 'sample') {
      const index = Number(button.dataset.sampleIndex || 0);
      input.value = problem.samples[index].in;
      button.dataset.sampleIndex = (index + 1) % problem.samples.length;
      input.focus();
      return;
    }
    if (action === 'cancel') {
      if (activeJudge && activeJudge.box === box) activeJudge.controller.abort();
      return;
    }
    const source = editor.value;
    const customInput = input.value;
    if (!source.trim()) { result.textContent = '请先输入 C 代码。'; editor.focus(); return; }
    if (source.length > 65536 || (action === 'run' && customInput.length > 65536)) {
      result.textContent = '代码和自测输入各最多 65,536 个字符。';
      return;
    }
    if (activeJudge) activeJudge.controller.abort();
    const controller = new AbortController();
    activeJudge = { box, controller };
    setJudgeBusy(box, true);
    setJudgeIssues(box, '');
    selectJudgeTab(box.querySelector('[data-judge-tab="terminal"]'));
    result.textContent = nativeJudge ? '正在使用本机编译器…' : '正在编译 C11，首次加载评测环境可能需要一些时间…';
    try {
      const compiled = !nativeJudge && lastCompilation?.source === source
        ? lastCompilation.compiled : await judgeTask({ source }, controller.signal);
      lastCompilation = { source, compiled };
      const diagnostics = (compiled.compileOutput || '').slice(0, 5000).trim();
      setJudgeIssues(box, diagnostics.replace(/\x1b\[[0-9;]*m/g, ''));
      if (!compiled.module) {
        result.textContent = '编译错误' + (diagnostics ? '\n' + diagnostics : '');
        if (action === 'submit' && box.isConnected) saveJudgeReport(problem, box, {
          score: 0, max: maxScore, passed: 0, runs: [], diagnostics, compileFailed: true,
        });
        return;
      }
      if (action === 'run') {
        result.textContent = '正在运行自测…';
        const run = await judgeTask({ module: compiled.module, input: customInput }, controller.signal);
        result.textContent = (run.status === 'ok' ? '运行完成' : verdicts[run.status]) +
          '\n标准输出\n' + (run.out || '（无输出）') +
          (run.err ? '\n\n标准错误\n' + run.err : '') +
          (run.status === 'runtime' && Number.isInteger(run.exitCode) ? '\n退出代码 ' + run.exitCode : '') +
          (diagnostics ? '\n\n编译信息\n' + diagnostics : '');
        return;
      }
      const cases = checkpoints(problem);
      const runs = [];
      let passed = 0;
      for (const [index, test] of cases.entries()) {
        if (!box.isConnected) return;
        result.textContent = '正在评测 ' + (index + 1) + ' / ' + cases.length;
        const run = await judgeTask({ module: compiled.module, input: test.in }, controller.signal);
        const status = run.status === 'ok' && normalizeOutput(run.out) !== normalizeOutput(test.out)
          ? 'wrong' : run.status;
        if (status === 'ok') passed++;
        runs.push({ ...run, status });
      }
      const score = Math.round(100 * maxScore * passed / cases.length) / 100;
      result.textContent = '提交完成' + (diagnostics ? '\n\n编译信息\n' + diagnostics : '');
      if (box.isConnected) saveJudgeReport(problem, box, { score, max: maxScore, passed, runs, diagnostics });
    } catch (error) {
      if (activeJudge?.controller === controller) {
        result.textContent = error.name === 'AbortError' ? '已停止评测。' : error.message;
      }
    } finally {
      if (activeJudge && activeJudge.controller === controller) activeJudge = null;
      setJudgeBusy(box, false);
    }
  }
