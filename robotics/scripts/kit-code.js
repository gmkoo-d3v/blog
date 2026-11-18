/* Visual kit: code trace. A code listing whose current line, printed output and picture move together.
   <div data-kit="code" data-show="9-17" data-cmd="..\..\.venv\Scripts\python.exe b15_ik_newton2.py"></div>
   Reads data.code (array of source lines, real line numbers), run.out (printed lines of that run),
   run.cols.line (line just executed at frame i) and run.cols.out (how many lines were printed by frame i).
   data.lineNotes = {lineNo: 'what this line means in the picture' | fn(ctx)}.
   Click a code line: jump to the next time it runs. Click an output line: jump to the moment it was printed. */
(function (root) {
  'use strict';
  const Kit = root.Kit, el = Kit.el;
  Kit.define('code', (host, stage) => {
    const spec = Object.assign({}, (stage.data.codes || {})[host.dataset.name] || {});
    const lines = spec.lines || stage.data.code || [];
    const show = host.dataset.show || (typeof spec.show === 'function' ? spec.show(stage.data) : spec.show) || [1, lines.length];
    const [a, b] = Array.isArray(show) ? show : show.split('-').map(Number);
    const lineCol = spec.lineCol || 'line', outCol = spec.outCol || 'out';
    const pre = el('pre', { class: 'kit-code', tabindex: 0, 'aria-label': (stage.data.file || '코드') + `, ${a}~${b}행` });
    const rows = {};
    for (let n = a; n <= b; n++) {
      const row = el('span', { class: 'kit-line', 'data-line': n }, el('span', { class: 'kit-ln', text: String(n).padStart(2, ' ') }), el('span', { text: lines[n - 1] ?? '' }));
      row.addEventListener('click', () => jumpLine(n)); rows[n] = row; pre.append(row);   // block rows: long lines wrap under their own text, not under the number
    }
    const outBox = el('pre', { class: 'kit-out', 'aria-label': '실행 출력', tabindex: 0 });
    const note = el('output', { class: 'kit-note', 'aria-live': 'polite' });
    const file = el('div', { class: 'kit-file' }, el('b', { text: stage.data.file || '' }), stage.data.source ? el('span', { class: 'kit-source', text: stage.data.source }) : null, host.dataset.cmd ? el('code', { text: host.dataset.cmd }) : null);
    host.classList.add('kit-codebox');
    host.append(file, el('div', { class: 'kit-code-grid' }, el('div', { class: 'kit-codecol' }, el('div', { class: 'kit-pane', text: '코드: 노란 줄 = 방금 실행된 줄' }), pre), el('div', { class: 'kit-codecol' }, el('div', { class: 'kit-pane', text: '출력: 지금까지 찍힌 줄 (누르면 그 순간으로)' }), outBox)), note);
    const traced = new Set(stage.run.cols[lineCol] || []); for (const n of traced) rows[n]?.classList.add('kit-traced');
    function jumpLine(n) {
      const L = stage.run.cols[lineCol]; if (!L) return;
      for (let s = 1; s <= stage.n; s++) { const i = (stage.i + s) % stage.n; if (L[i] === n) return stage.setIndex(i, 'pick'); }
    }
    let lastOut = null;
    function drawOut() {
      const out = stage.run.out || []; outBox.replaceChildren(); lastOut = stage.run;
      out.forEach((t, k) => { const r = el('span', { class: 'kit-oline', 'data-k': k, text: t || ' ' }); r.addEventListener('click', () => jumpOut(k)); outBox.append(r); });
    }
    function jumpOut(k) { const O = stage.run.cols[outCol]; if (!O) return; const i = O.findIndex(v => v >= k + 1); if (i >= 0) stage.setIndex(i, 'pick'); }
    stage.on(() => {
      if (lastOut !== stage.run) drawOut();
      const L = stage.run.cols[lineCol], O = stage.run.cols[outCol];
      const line = L ? L[stage.i] : null, count = O ? O[stage.i] : (stage.run.out || []).length;
      for (const [n, r] of Object.entries(rows)) { r.classList.toggle('kit-now', +n === line); r.classList.toggle('kit-lit', stage.lit('line:' + n)); }
      const justPrinted = O && stage.i > 0 && O[stage.i] > O[stage.i - 1];
      [...outBox.querySelectorAll('.kit-oline')].forEach((r, k) => { r.classList.toggle('kit-future', k >= count); r.classList.toggle('kit-now', justPrinted ? k === count - 1 : false); });
      const litN = Object.keys(rows).find(n => stage.lit('line:' + n)), showN = litN || line;
      // several lit lines (a tour beat naming lines 12 and 16): put the first near the top so the others fit below it
      if (showN && rows[showN]) { const r = rows[showN]; const top = litN ? r.offsetTop - 24 : r.offsetTop - pre.clientHeight / 2;
        if (litN) { pre.scrollTop = Math.max(0, top); } else if (r.offsetTop < pre.scrollTop || r.offsetTop > pre.scrollTop + pre.clientHeight - 20) pre.scrollTop = Math.max(0, top); }
      const nowOut = outBox.querySelector('.kit-now') || outBox.querySelectorAll('.kit-oline')[Math.max(0, count - 1)];
      if (nowOut && (nowOut.offsetTop > outBox.scrollTop + outBox.clientHeight - 20 || nowOut.offsetTop < outBox.scrollTop)) outBox.scrollTop = Math.max(0, nowOut.offsetTop - outBox.clientHeight / 2);
      const LN = stage.data.lineNotes || {}, n = typeof LN === 'function' ? LN(line, stage.ctx()) : LN[line];
      note.value = line ? `${line}행: ` + (typeof n === 'function' ? n(stage.ctx()) : (n || '')) : '';
    });
  });
})(window);
