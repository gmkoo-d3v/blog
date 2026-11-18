/* Visual kit: 2D scene drawn to scale (equal x/y scale, grid and axis ticks in scene units).
   <div data-kit="scene2d" data-name="top"></div>
   data.scenes[name] = {xr:[a,b], yr:[a,b], unit:'m', grid:0.1, height?, label, items:[...]}
   Item types (values may be numbers, column names, '@param' or functions of ctx; k scales column values, e.g. 0.001 for mm):
     rect {x0,y0,x1,y1,fill,stroke,label}         circle {c:[x,y], r, stroke, dash, label}
     box {c:[x,y], half, fill, label}             arm {base:[x,y], links:[l1,l2..], q:[deg cols..]}
     path {x, y, k, color, upto, dots, label}     points {pts:[[x,y,label]], mark:'x'|'dot'|'star', color}
     vector {from:[x,y], to:[x,y] | d:[dx,dy], color, label}       frame {at:[x,y], deg, len, label}
     handle {param, label, snap}  (draggable; arrow keys move it)  text {at:[x,y], text}
     custom {draw(g, view, ctx)}
   Any item: when: fn(ctx) to show it conditionally; ghost:false to skip the faint overlay copy; name (or names / tip on an
   arm) = what a tour beat lights up (orange glow). stage.ghost (frame index) draws arms faint at that frame; stage.callout
   puts the tour's pointer tag at callout.at. */
(function (root) {
  'use strict';
  const Kit = root.Kit, el = Kit.el, fmt = Kit.fmt;
  Kit.define('scene2d', (host, stage) => {
    const spec = Kit.spec(stage, 'scenes', host);
    const [x0, x1] = spec.xr, [y0, y1] = spec.yr, aspect = (y1 - y0) / (x1 - x0);
    const wrap = el('div', { class: 'kit-2d' }); host.append(wrap);
    const c = Kit.canvas(wrap, { cls: 'kit-scene', height: spec.height || 380, label: spec.label || '위에서 본 장면' });
    const ovl = Kit.overlay(wrap);
    host.classList.add('kit-scenebox');
    const handles = spec.items.filter(it => it.type === 'handle');
    if (handles.length) host.append(el('p', { class: 'kit-hint', text: spec.hint || '주황 고리를 끌어 보세요. 그림을 누른 뒤 방향키로도 움직입니다.' }));
    let view = null;
    new ResizeObserver(() => { if (!spec.height) { const h = Math.round(Math.max(260, Math.min(spec.maxHeight || 440, c.cv.clientWidth * aspect))); if (Math.abs(c.cv.clientHeight - h) > 2) c.cv.style.height = h + 'px'; } }).observe(host);
    const shown = (it, ctx) => {
      if (!it.when) return true;
      return !!it.when(ctx);
    };
    const V = (v, run, k = 1, gi = null) => { const r = stage.val(v, run, gi); return Array.isArray(r) ? r.map(x => x * k) : r == null ? r : r * k; };
    c.draw = (g, w, h) => {
      const sc = Math.min(w / (x1 - x0), h / (y1 - y0)), ox = (w - sc * (x1 - x0)) / 2, oy = (h - sc * (y1 - y0)) / 2;
      const X = x => ox + (x - x0) * sc, Y = y => h - oy - (y - y0) * sc;
      view = { X, Y, sc, w, h, inv: (px, py) => [x0 + (px - ox) / sc, y0 + (h - oy - py) / sc] };
      g.clearRect(0, 0, w, h); g.fillStyle = spec.background || '#f7faf8'; g.fillRect(0, 0, w, h);
      grid(g);
      const ctx = stage.ctx();
      for (const it of spec.items) {
        if (!shown(it, ctx)) continue;
        if (stage.overlay && it.ghost !== false && (['arm', 'path', 'box'].includes(it.type) || (it.type === 'custom' && it.ghost))) { g.globalAlpha = 0.3; draw(g, it, stage.overlay, true); g.globalAlpha = 1; }
        if (stage.ghost != null && it.type === 'arm' && it.ghost !== false) { g.globalAlpha = 0.3; draw(g, it, stage.run, true, stage.ghost); g.globalAlpha = 1; }
        const hot = [it.name, it.tip, ...(it.names || [])].some(n => n && stage.lit(n));   // tour focus: orange glow
        if (hot) { g.save(); g.shadowColor = '#ff8a1f'; g.shadowBlur = 18; draw(g, it, stage.run, false); g.restore(); }
        draw(g, it, stage.run, false);
      }
      labels(g); legend(g);
      const co = stage.callout, at = co && V(co.at || co.at3, stage.run);
      ovl.place(at ? [{ key: 'callout', x: X(at[0]), y: Y(at[1]), text: Kit.text(co.text, ctx), cls: 'kit-tag-callout' }] : []);
    };
    // tick values along the canvas edges, drawn last so no item hides them
    function labels(g) {
      if (spec.axes === false) return;
      const { X, Y, w, h } = view, ticks = spec.tick ? null : Kit.niceTicks(x0, x1, 6);
      const tick = spec.tick || ticks[1] - ticks[0], d = tick >= 1 ? 0 : tick >= 0.1 ? 1 : 2;
      const xt = spec.tick ? Kit.niceTicks(x0, x1, Math.round((x1 - x0) / tick)) : ticks, yt = Kit.niceTicks(y0, y1, Math.max(3, Math.round((y1 - y0) / tick)));
      const o = { color: '#5c6c72', font: '11px sans-serif', bg: 'rgba(247,250,248,.9)' };
      for (const x of xt) if (X(x) > 30 && X(x) < w - 70) Kit.label(g, fmt(x, d), X(x), h - 5, Object.assign({ align: 'center' }, o));
      for (const y of yt) if (Y(y) > 22 && Y(y) < h - 22) Kit.label(g, fmt(y, d), 4, Y(y) + 4, o);
      Kit.label(g, `x (${spec.unit || 'm'}) →`, w - 6, h - 5, Object.assign({ align: 'right' }, o));
      Kit.label(g, `↑ y (${spec.unit || 'm'})`, 4, 14, o);
    }
    // legend: [[color, text, 'line'|'dash'|'x'|'dot'|'box']] in the top-right corner
    function legend(g) {
      if (!spec.legend) return; g.font = '12px sans-serif';
      const items = spec.legend.filter(l => !l[3] || l[3](stage.ctx()));
      const wmax = Math.max(...items.map(l => g.measureText(l[1]).width)) + 40, x = view.w - wmax - 8; let y = 10;
      g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(x - 6, y - 4, wmax + 8, items.length * 19 + 6); g.strokeStyle = '#cfdcd4'; g.strokeRect(x - 6, y - 4, wmax + 8, items.length * 19 + 6);
      for (const [color, text, kind] of items) {
        const cy = y + 9; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = kind === 'box' ? 1 : 2.5; g.setLineDash(kind === 'dash' ? [5, 4] : []);
        if (kind === 'x') { g.beginPath(); g.moveTo(x + 8, cy - 5); g.lineTo(x + 18, cy + 5); g.moveTo(x + 18, cy - 5); g.lineTo(x + 8, cy + 5); g.stroke(); }
        else if (kind === 'dot') { g.beginPath(); g.arc(x + 13, cy, 5, 0, 7); g.fill(); }
        else if (kind === 'box') { g.fillRect(x + 6, cy - 6, 14, 12); }
        else { g.beginPath(); g.moveTo(x, cy); g.lineTo(x + 26, cy); g.stroke(); }
        g.setLineDash([]); g.fillStyle = '#20343d'; g.textAlign = 'left'; g.fillText(text, x + 32, cy + 4); y += 19;
      }
    }
    function grid(g) {
      const { X, Y } = view, step = spec.grid || 0.1;
      g.lineWidth = 1; g.strokeStyle = '#e3eae6';
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) { g.beginPath(); g.moveTo(X(x), Y(y0)); g.lineTo(X(x), Y(y1)); g.stroke(); }
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) { g.beginPath(); g.moveTo(X(x0), Y(y)); g.lineTo(X(x1), Y(y)); g.stroke(); }
      if (spec.axes === false) return;
      const ay = y0 <= 0 && y1 >= 0 ? 0 : y0, ax = x0 <= 0 && x1 >= 0 ? 0 : x0;
      g.strokeStyle = '#9aa9a2'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(X(x0), Y(ay)); g.lineTo(X(x1), Y(ay)); g.moveTo(X(ax), Y(y0)); g.lineTo(X(ax), Y(y1)); g.stroke();

    }
    function draw(g, it, run, ghost, gi = null) {
      const { X, Y, sc } = view, k = it.k ?? 1;
      switch (it.type) {
        case 'rect': { const a = [V(it.x0, run), V(it.y0, run), V(it.x1, run), V(it.y1, run)]; g.fillStyle = it.fill || '#efe2cc'; g.fillRect(X(a[0]), Y(a[3]), (a[2] - a[0]) * sc, (a[3] - a[1]) * sc); if (it.stroke !== false) { g.strokeStyle = it.stroke || '#b59873'; g.lineWidth = 1.2; g.strokeRect(X(a[0]), Y(a[3]), (a[2] - a[0]) * sc, (a[3] - a[1]) * sc); } if (it.label) Kit.label(g, it.label, X(a[0]) + 5, Y(a[1]) - 6, { color: '#7a6448', bg: null, font: '12px sans-serif' }); break; }
        case 'circle': { const p = V(it.c, run), r = V(it.r, run); g.strokeStyle = it.stroke || '#9db2a8'; g.lineWidth = it.width || 1.3; g.setLineDash(it.dash ? [5, 5] : []); g.beginPath(); g.arc(X(p[0]), Y(p[1]), r * sc, 0, 2 * Math.PI); if (it.fill) { g.fillStyle = it.fill; g.fill(); } g.stroke(); g.setLineDash([]); if (it.label) Kit.label(g, it.label, X(p[0] + r * 0.72) + 4, Y(p[1] + r * 0.72) - 4, { color: '#5c6c72', font: '12px sans-serif' }); break; }
        case 'box': { const p = V(it.c, run, k), s = it.half * sc, onFloor = it.floor ? stage.val(it.floor, run) : false; g.fillStyle = onFloor ? '#c7a24d' : (it.fill || '#f2c230'); g.strokeStyle = '#7a5a00'; g.lineWidth = 2; g.fillRect(X(p[0]) - s, Y(p[1]) - s, 2 * s, 2 * s); g.strokeRect(X(p[0]) - s, Y(p[1]) - s, 2 * s, 2 * s); if (it.label && !ghost) Kit.label(g, onFloor ? it.floorLabel || it.label : it.label, X(p[0]) + s + 4, Y(p[1]) + 4, { color: '#6b5200' }); break; }
        case 'arm': {
          const base = V(it.base || [0, 0], run), q = V(it.q, run, 1, gi); let a = 0, p = base.slice(); const pts = [p.slice()];
          it.links.forEach((L, j) => { a += q[j] * Math.PI / 180; p = [p[0] + L * Math.cos(a), p[1] + L * Math.sin(a)]; pts.push(p.slice()); });
          const cols = it.colors || ['#2f6fd0', '#1f9a6a', '#a8429a'];
          g.lineCap = 'round';
          for (let j = 0; j < it.links.length; j++) { g.strokeStyle = ghost ? '#7d8b86' : cols[j % cols.length]; g.lineWidth = Math.max(5, (it.width || 0.035) * sc); g.beginPath(); g.moveTo(X(pts[j][0]), Y(pts[j][1])); g.lineTo(X(pts[j + 1][0]), Y(pts[j + 1][1])); g.stroke(); }
          g.fillStyle = '#263f45'; for (const pt of pts.slice(0, -1)) { g.beginPath(); g.arc(X(pt[0]), Y(pt[1]), 5, 0, 7); g.fill(); }
          const tip = pts[pts.length - 1]; g.fillStyle = it.tipColor || '#e03030'; g.beginPath(); g.arc(X(tip[0]), Y(tip[1]), 6, 0, 7); g.fill();
          if (it.label && !ghost) Kit.label(g, it.label, X(tip[0]) + 9, Y(tip[1]) - 8, { color: '#a52020', font: 'bold 12px sans-serif' });
          if (ghost && gi == null && stage.overlay && it.ghostLabel !== false) Kit.label(g, stage.overlay.label || '비교', X(tip[0]) + 9, Y(tip[1]) + 14, { color: '#5c6c72', font: '12px sans-serif' });
          break;
        }
        case 'path': {
          const xs = run.cols[it.x], ys = run.cols[it.y]; if (!xs) break;
          const ri = run === stage.run ? stage.i : stage.indexAtTime(stage.time(), run);
          const end = it.upto ? ri : xs.length - 1; const color = ghost ? '#7d8b86' : it.color || '#d23a3a';
          if (it.upto && it.future !== false && !ghost) { g.strokeStyle = color; g.globalAlpha = 0.18; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < xs.length; i++) { const px = X(xs[i] * k), py = Y(ys[i] * k); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.globalAlpha = 1; }
          g.strokeStyle = color; g.lineWidth = it.width || 2.5; g.setLineDash(it.dash ? [6, 4] : []); g.beginPath();
          for (let i = 0; i <= end; i++) { const px = X(xs[i] * k), py = Y(ys[i] * k); i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke(); g.setLineDash([]);
          if (it.dots) { g.fillStyle = color; let last = null; for (let i = 0; i <= end; i++) { const key = xs[i] + ',' + ys[i]; if (key === last) continue; last = key; g.beginPath(); g.arc(X(xs[i] * k), Y(ys[i] * k), 3.5, 0, 7); g.fill(); } }
          if (it.label && !ghost && end >= 0) Kit.label(g, it.label, X(xs[end] * k) + 8, Y(ys[end] * k) + 16, { color, font: '12px sans-serif' });
          break;
        }
        case 'points': {
          const pts = typeof it.pts === 'function' ? it.pts(stage.ctx(run)) : it.pts; if (ghost) break;
          for (const [px0, py0, lab, col] of pts) {
            const px = X(px0 * k), py = Y(py0 * k), color = col || it.color || '#20343d'; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 2.4;
            if (it.mark === 'dot') { g.beginPath(); g.arc(px, py, it.r || 4, 0, 7); g.fill(); }
            else if (it.mark === 'star') star(g, px, py, 11, color);
            else { g.beginPath(); g.moveTo(px - 6, py - 6); g.lineTo(px + 6, py + 6); g.moveTo(px + 6, py - 6); g.lineTo(px - 6, py + 6); g.stroke(); }
            if (lab != null && lab !== '') Kit.label(g, String(lab), px + 8, py - 7, { color, font: 'bold 12px sans-serif' });
          }
          break;
        }
        case 'vector': {
          if (ghost) break; const a = V(it.from, run, k); let b = it.to ? V(it.to, run, k) : null; if (!b) { const d = V(it.d, run, k); b = [a[0] + d[0], a[1] + d[1]]; }
          if (!a || !b || a.some(v => v == null) || b.some(v => v == null)) break;
          Kit.arrow(g, X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), it.color || '#c66b16', it.width || 2.5, 11);
          if (it.label) Kit.label(g, typeof it.label === 'function' ? it.label(stage.ctx(run)) : it.label, (X(a[0]) + X(b[0])) / 2 + 8, (Y(a[1]) + Y(b[1])) / 2 - 8, { color: it.color || '#a2520e', font: 'bold 12px sans-serif' });
          break;
        }
        case 'frame': {
          if (ghost) break; const p = V(it.at, run), d = V(it.deg ?? 0, run) * Math.PI / 180, L = (it.len || 0.1) * sc;
          Kit.arrow(g, X(p[0]), Y(p[1]), X(p[0]) + L * Math.cos(d), Y(p[1]) - L * Math.sin(d), '#c8352b', 2, 8);
          Kit.arrow(g, X(p[0]), Y(p[1]), X(p[0]) - L * Math.sin(d), Y(p[1]) - L * Math.cos(d), '#2b9450', 2, 8);
          if (it.label) Kit.label(g, it.label, X(p[0]) - 8, Y(p[1]) + 16, { color: '#20343d', font: '12px sans-serif', align: 'right' });
          break;
        }
        case 'handle': {
          if (ghost) break; const p = stage.params[it.param]; if (!p) break;
          g.strokeStyle = '#d4691c'; g.lineWidth = 3; g.beginPath(); g.arc(X(p[0]), Y(p[1]), 10, 0, 7); g.stroke();
          g.fillStyle = 'rgba(212,105,28,.25)'; g.fill();
          const lab = typeof it.label === 'function' ? it.label(stage.ctx(run)) : it.label;
          if (lab) Kit.label(g, lab, X(p[0]) + 14, Y(p[1]) - 10, { color: '#a2520e', font: 'bold 12px sans-serif' });
          break;
        }
        case 'text': { if (ghost) break; const p = V(it.at, run); Kit.label(g, typeof it.text === 'function' ? it.text(stage.ctx(run)) : it.text, X(p[0]), Y(p[1]), { color: it.color || '#20343d', font: it.font || '12px sans-serif', bg: it.bg === false ? null : undefined }); break; }
        case 'custom': it.draw(g, view, stage.ctx(run), ghost); break;
      }
    }
    function star(g, x, y, r, color) { g.fillStyle = color; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); } g.closePath(); g.fill(); }
    // dragging handles
    let dragging = null;
    const live = () => handles.filter(hd => shown(hd, stage.ctx()) && stage.params[hd.param]);
    const snap = (hd, v) => { const s = hd.snap || 0.01; return Math.round(v / s) * s; };
    const place = (hd, xy) => stage.set(hd.param, [+snap(hd, Math.max(x0, Math.min(x1, xy[0]))).toFixed(4), +snap(hd, Math.max(y0, Math.min(y1, xy[1]))).toFixed(4)]);
    c.cv.addEventListener('pointerdown', e => {
      if (!view) return; const r = c.cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let best = null, bd = 26; for (const hd of live()) { const p = stage.params[hd.param], d = Math.hypot(view.X(p[0]) - px, view.Y(p[1]) - py); if (d < bd) { bd = d; best = hd; } }
      if (!best && live().length === 1 && spec.clickMoves !== false) best = live()[0];
      if (best) { dragging = best; c.cv.setPointerCapture(e.pointerId); place(best, view.inv(px, py)); e.preventDefault(); }
    });
    c.cv.addEventListener('pointermove', e => { if (!dragging || !view) return; const r = c.cv.getBoundingClientRect(); place(dragging, view.inv(e.clientX - r.left, e.clientY - r.top)); });
    c.cv.addEventListener('pointerup', () => { dragging = null; });
    c.cv.addEventListener('keydown', e => {
      const hd = live()[0]; if (!hd) return; const s = (hd.snap || 0.01) * (e.shiftKey ? 5 : 1), p = stage.params[hd.param].slice();
      const d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key]; if (!d) return;
      e.preventDefault(); place(hd, [p[0] + d[0], p[1] + d[1]]);
    });
    if (handles.length) c.cv.classList.add('kit-draggable');
    stage.on(() => c.redraw());
  });
})(window);
