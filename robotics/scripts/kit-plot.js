/* Visual kit: line plot with a cursor linked to the stage.
   <div data-kit="plot" data-name="joints"></div>
   data.plots[name] = {x:'t', y:['S',{col:'TS',dash:true}], ylog, yr:[lo,hi], xr, xlabel, ylabel, height, markers, trail,
                       hlines:[{y,label}], events:true}
   Colors and labels come from data.fields[col] = {label, unit, color, digits, k}. Click or drag the plot to move the cursor;
   arrow keys do the same when the plot has focus. The overlay run (compare / explorer) is drawn dashed and faint. */
(function (root) {
  'use strict';
  const Kit = root.Kit, el = Kit.el, fmt = Kit.fmt;
  Kit.define('plot', (host, stage) => {
    const spec = Kit.spec(stage, 'plots', host);
    const series = (spec.y || []).map((s, k) => {
      const o = typeof s === 'string' ? { col: s } : Object.assign({}, s); const f = stage.field(o.col);
      return Object.assign({ label: f.label || o.col, color: f.color || Kit.colors[k % Kit.colors.length], k: f.k ?? 1, unit: f.unit || '', digits: f.digits ?? 2 }, o);
    });
    const xcol = spec.x || 't', xf = stage.field(xcol);
    const c = Kit.canvas(host, { cls: 'kit-plot', height: spec.height || 260, label: spec.label || `${spec.ylabel || ''} 그래프. 누르거나 끌면 시점이 바뀝니다.` });
    const legend = el('div', { class: 'kit-legend', 'aria-hidden': 'true' });
    for (const s of series) legend.append(el('span', { style: `--c:${s.color}`, class: s.dash ? 'kit-dash' : null, text: s.label }));
    if (spec.legend !== false) host.append(legend);
    host.classList.add('kit-plotbox');
    if (host.closest('.kit-side')) { c.cv.style.height = ''; host.classList.add('kit-fill'); }   // in the side column: fill the panel
    const M = { l: 58, r: 16, t: 14, b: 36 };
    let map = null;
    const xs = run => run.cols[xcol] || run.cols.t || [...Array(run.n).keys()];
    const keep = (run, i) => !spec.only || spec.only(stage.ctx(run, i));
    const ys = (run, s) => (run.cols[s.col] || []).map((v, i) => v == null || !keep(run, i) ? null : v * s.k);
    function ranges() {
      const runs = [stage.run].concat(stage.overlay ? [stage.overlay] : []).concat(spec.allRuns ? Object.values(stage.data.runs) : []);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const r of runs) {
        for (const v of xs(r)) { if (v < x0) x0 = v; if (v > x1) x1 = v; }
        for (const s of series) for (const v of ys(r, s)) { if (v == null || (spec.ylog && v <= 0)) continue; if (v < y0) y0 = v; if (v > y1) y1 = v; }
      }
      for (const h of spec.hlines || []) { y0 = Math.min(y0, h.y); y1 = Math.max(y1, h.y); }
      if (spec.xr) [x0, x1] = spec.xr; if (spec.yr) [y0, y1] = spec.yr;
      if (!(y1 > y0)) { y0 -= 1; y1 += 1; }
      if (!spec.yr && !spec.ylog) { const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad; }
      if (spec.ylog) { y0 = 10 ** Math.floor(Math.log10(y0)); y1 = 10 ** Math.ceil(Math.log10(y1)); }
      return { x0, x1: x1 > x0 ? x1 : x0 + 1, y0, y1 };
    }
    c.draw = (g, w, h) => {
      const R = ranges(), pw = w - M.l - M.r, ph = h - M.t - M.b;
      const X = x => M.l + (x - R.x0) / (R.x1 - R.x0) * pw;
      const Y = spec.ylog ? y => M.t + ph - (Math.log10(Math.max(y, 1e-300)) - Math.log10(R.y0)) / (Math.log10(R.y1) - Math.log10(R.y0)) * ph : y => M.t + ph - (y - R.y0) / (R.y1 - R.y0) * ph;
      map = { X, R, pw };
      g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
      g.font = '12px sans-serif'; g.strokeStyle = '#e4ebe7'; g.fillStyle = '#5c6c72'; g.lineWidth = 1;
      const yt = spec.ylog ? (() => { const a = []; const e0 = Math.log10(R.y0), e1 = Math.log10(R.y1), st = Math.max(1, Math.ceil((e1 - e0) / 6)); for (let e = e1; e >= e0; e -= st) a.push(10 ** e); return a; })() : Kit.niceTicks(R.y0, R.y1, 5);
      for (const v of yt) { const y = Y(v); if (y < M.t - 1 || y > M.t + ph + 1) continue; g.beginPath(); g.moveTo(M.l, y); g.lineTo(M.l + pw, y); g.stroke(); g.textAlign = 'right'; g.fillText(spec.ylog ? '10' + sup(Math.round(Math.log10(v))) : fmt(v, dec(yt)), M.l - 6, y + 4); }
      for (const v of spec.xticks || Kit.niceTicks(R.x0, R.x1, Math.max(3, Math.floor(pw / 90)))) { const x = X(v); if (x < M.l - 1 || x > M.l + pw + 1) continue; g.beginPath(); g.moveTo(x, M.t); g.lineTo(x, M.t + ph); g.stroke(); g.textAlign = 'center'; g.fillText(fmt(v, dec(spec.xticks || Kit.niceTicks(R.x0, R.x1, 6))), x, M.t + ph + 15); }
      g.strokeStyle = '#9fb0a8'; g.strokeRect(M.l, M.t, pw, ph);
      g.fillStyle = '#41524b'; g.textAlign = 'right'; g.fillText(spec.xlabel || ((xf.label || xcol) + (xf.unit ? ` (${xf.unit})` : '')), M.l + pw, h - 4);
      g.save(); g.translate(13, M.t + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(spec.ylabel || '', 0, 0); g.restore();
      if (spec.events !== false && xcol === 't') for (const ev of stage.run.events || []) { const x = X(ev.t ?? stage.time(ev.i)); g.strokeStyle = '#d9c9b0'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x, M.t); g.lineTo(x, M.t + ph); g.stroke(); g.setLineDash([]); }
      for (const hl of spec.hlines || []) { const y = Y(hl.y); g.strokeStyle = '#8c969a'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(M.l, y); g.lineTo(M.l + pw, y); g.stroke(); g.setLineDash([]); if (hl.label) Kit.label(g, hl.label, M.l + 6, y - 5, { color: '#5c6c72' }); }
      g.save(); g.beginPath(); g.rect(M.l, M.t, pw, ph); g.clip();
      if (spec.allRuns) for (const r of Object.values(stage.data.runs)) if (r !== stage.run) for (const s of series) line(g, xs(r), ys(r, s), X, Y, '#c9d3ce', 1, false);
      if (stage.overlay) for (const s of series) line(g, xs(stage.overlay), ys(stage.overlay, s), X, Y, s.color, 1.6, true, 0.38);
      const upto = spec.trail ? stage.i : null;
      for (const s of series) {
        if (upto != null) line(g, xs(stage.run), ys(stage.run, s), X, Y, s.color, 1.5, s.dash, 0.25);
        const hot = stage.lit(s.col);         // tour focus: this curve glows and thickens
        if (hot) { g.shadowColor = '#ff8a1f'; g.shadowBlur = 10; }
        line(g, xs(stage.run), ys(stage.run, s), X, Y, s.color, hot ? 4.2 : s.width || 2.2, s.dash, 1, upto, s.step);
        g.shadowBlur = 0;
        if (spec.markers) { const xv = xs(stage.run), yv = ys(stage.run, s); g.fillStyle = s.color; for (let i = 0; i <= (upto ?? stage.n - 1); i++) if (yv[i] != null) { g.beginPath(); g.arc(X(xv[i]), Y(yv[i]), 3.5, 0, 7); g.fill(); } }
      }
      g.restore();
      if (spec.cursor !== false && stage.n) {
        const xv = xs(stage.run)[stage.i], x = X(xv);
        g.strokeStyle = '#20343d'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, M.t); g.lineTo(x, M.t + ph); g.stroke();
        let ly = M.t + 14;
        for (const s of series) {
          if (s.cursor === false) continue;
          const Ys = ys(stage.run, s); let j = stage.i; while (spec.only && j > 0 && Ys[j] == null) j--;
          const v = Ys[j]; if (v == null) continue; const y = Y(v);
          g.fillStyle = s.color; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
          const num = spec.ylog && v > 0 && v < 1e-3 ? (+v).toExponential(2).replace(/e([-+])(\d+)/, (_, sg, d) => '×10' + sup((sg === '-' ? '-' : '') + d)) : fmt(v, s.digits);
          const text = `${s.label} ${num}${s.unit ? ' ' + s.unit : ''}`;
          g.font = 'bold 13px sans-serif'; const right = x + 9 + g.measureText(text).width < M.l + pw; Kit.label(g, text, right ? x + 9 : x - 9, ly, { color: s.color, align: right ? 'left' : 'right', font: 'bold 13px sans-serif' }); ly += 18;
        }
      }
    };
    function line(g, x, y, X, Y, color, width, dash, alpha = 1, upto = null, step = false) {
      g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash ? [6, 4] : []); g.beginPath();
      let on = false; const end = upto == null ? x.length - 1 : Math.min(upto, x.length - 1);
      for (let i = 0; i <= end; i++) {
        if (y[i] == null && spec.only) continue;
        if (y[i] == null || (spec.ylog && y[i] <= 0)) { on = false; continue; }
        const px = X(x[i]), py = Y(y[i]);
        if (!on) { g.moveTo(px, py); on = true; } else if (step) { g.lineTo(px, Y(y[i - 1])); g.lineTo(px, py); } else g.lineTo(px, py);
      }
      g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    const sup = n => String(n).split('').map(ch => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(ch)] || (ch === '-' ? '⁻' : ch)).join('');
    const dec = t => { const st = Math.abs((t[1] ?? 1) - (t[0] ?? 0)); return st >= 1 ? 0 : st >= 0.1 ? 1 : st >= 0.01 ? 2 : 3; };
    function pick(ev) {
      if (!map) return; const r = c.cv.getBoundingClientRect(); const xv = map.R.x0 + (ev.clientX - r.left - M.l) / map.pw * (map.R.x1 - map.R.x0);
      const X = xs(stage.run); let best = 0, bd = Infinity;
      for (let i = 0; i < X.length; i++) { const d = Math.abs(X[i] - xv); if (d < bd - 1e-12) { bd = d; best = i; } }
      stage.setIndex(best);
    }
    let drag = false;
    c.cv.addEventListener('pointerdown', e => { drag = true; c.cv.setPointerCapture(e.pointerId); pick(e); });
    c.cv.addEventListener('pointermove', e => { if (drag) pick(e); });
    c.cv.addEventListener('pointerup', () => { drag = false; });
    c.cv.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stage.setIndex(stage.i + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); } });
    stage.on(() => { host.classList.toggle('kit-lit', stage.lit('plot:' + (host.dataset.name || ''))); c.redraw(); });
  });
})(window);
