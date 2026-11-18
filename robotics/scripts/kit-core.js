/* Visual kit core: data registry, stages, mounting, shared drawing helpers.
   A lesson writes markup only:
     <div class="kit-stage" data-kit="stage" data-src="b23-arm b23-arm-view" data-run="b23"> ...components... </div>
   Data files call Kit.data(name, object); objects with the same names listed in data-src are merged (later wins).
   A stage holds the shared cursor: which run is shown (run), which frame (i), the overlay run, and free params.
   Components inside a stage read it and redraw on its 'change' event. Components register with Kit.define(name, mount).
   build.py adds this file, the other kit-*.js files and every content/kit-data/<name>.js named in data-src.
   HANDOFF-08: the stage also holds the tour's highlight state (setFocus: focus names, callout, ghost frame, view/tab request);
   Kit.overlay draws the HTML tags (labels, the tour's pointer) over 2D and 3D pictures. */
(function (root) {
  'use strict';
  const Kit = root.Kit = root.Kit || {};
  const store = Kit._store = Kit._store || {};
  const defs = Kit._defs = Kit._defs || {};

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function'; }
  // deep merge of plain objects (copied, so stages never write into the registry); arrays and functions by reference
  function merge(a, b) { for (const [k, v] of Object.entries(b)) a[k] = isObj(v) ? merge(isObj(a[k]) ? a[k] : {}, v) : v; return a; }
  Kit.data = (name, obj) => { store[name] = merge(store[name] || {}, obj); };
  Kit.define = (name, mount) => { defs[name] = mount; };

  // ---------- numbers and text
  const fmt = (v, d = 2) => v == null || !Number.isFinite(+v) ? '–' : (Math.abs(+v) < 0.5 * 10 ** -d ? 0 : +v).toFixed(d).replace('-', '−');
  Kit.fmt = fmt;
  Kit.el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids) if (c != null) n.append(c);
    return n;
  };
  const el = Kit.el;
  Kit.colors = ['#2f6fd0', '#d4691c', '#1f9a6a', '#a8429a', '#6b7a1f', '#c23b3b', '#3b8fa8'];

  // ---------- runs: {cols:{name:[...]}, dt?, label?, change?, events?:[{t|i,label}]} ; prepared once
  function prepareRun(id, run, data) {
    if (run._ready) return run;
    run.id = run.id || id; run.cols = run.cols || {};
    const first = Object.values(run.cols)[0] || [];
    run.n = first.length;
    if (!run.cols.t && run.dt) run.cols.t = first.map((_, i) => +(i * run.dt).toFixed(6));
    for (const [name, fn] of Object.entries(data.derive || {})) {
      if (run.cols[name]) continue;
      const out = new Array(run.n); const view = { run, data, col: c => run.cols[c] };
      for (let i = 0; i < run.n; i++) out[i] = fn(i, view);
      run.cols[name] = out;
    }
    run._ready = true; return run;
  }
  Kit.prepareRun = prepareRun;

  class Stage extends EventTarget {
    constructor(host, data) {
      super(); this.host = host; this.data = data; this.params = {}; this.overlay = null; this.i = 0; this.cause = 'init';
      this.focus = new Set(); this.callout = null; this.ghost = null; this.request = { n: 0 };
      const runs = data.runs || {}; for (const [id, r] of Object.entries(runs)) prepareRun(id, r, data);
      this.run = runs[host.dataset.run] || Object.values(runs)[0] || prepareRun('empty', { cols: {} }, data);
      for (const [k, v] of Object.entries(data.params || {})) this.params[k] = Array.isArray(v) ? v.slice() : v;
      this._queued = false;
    }
    get n() { return this.run.n || 0; }
    time(i = this.i, run = this.run) { const t = run.cols.t; return t ? t[Math.max(0, Math.min(run.n - 1, i))] : i; }
    indexAtTime(t, run = this.run) {
      const T = run.cols.t; if (!T) return Math.max(0, Math.min(run.n - 1, Math.round(t)));
      let lo = 0, hi = run.n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= t + 1e-9) lo = m; else hi = m - 1; } return lo;
    }
    setIndex(i, cause = 'index') { i = Math.max(0, Math.min(this.n - 1, Math.round(i))); if (i === this.i && cause === 'index') return; this.i = i; this.emit(cause); }
    setTime(t, cause = 'index') { this.setIndex(this.indexAtTime(t), cause); }
    setRun(run, { keepTime = true, cause = 'run', overlay } = {}) {
      if (typeof run === 'string') run = this.data.runs[run];
      if (!run) return; prepareRun(run.id || 'run', run, this.data);
      const t = this.time(); const prev = this.run; this.run = run;
      if (overlay !== undefined) this.overlay = overlay === 'previous' ? prev : overlay;
      this.i = keepTime ? Math.min(this.indexAtTime(t), run.n - 1) : 0; this.emit(cause);
    }
    setOverlay(run) { this.overlay = typeof run === 'string' ? this.data.runs[run] : run; if (this.overlay) prepareRun(this.overlay.id || 'overlay', this.overlay, this.data); this.emit('overlay'); }
    set(key, value, cause = 'param') { this.params[key] = value; this.emit(cause); }
    // tour highlighting (HANDOFF-08): focus = names of things to light up (scene item ids, field names, plot columns,
    // 'line:N' for a code line); callout = {at: binding [x,y(,z)], text} anchored in every picture that can place it;
    // ghost = frame index whose pose is drawn faint (the previous pose). One call, one redraw.
    // view = camera preset name for 3D scenes ('기본' | '위에서' | '옆에서'); tab = side tab to open. Both are one-shot requests.
    setFocus({ focus = [], callout = null, ghost = null, view = null, tab = null } = {}) {
      this.focus = new Set(focus); this.callout = callout; this.ghost = ghost;
      this.request = { view, tab, n: (this.request ? this.request.n : 0) + 1 }; this.emit('focus');
    }
    lit(name) { return !!this.focus && this.focus.has(name); }
    get focusing() { return !!this.focus && this.focus.size > 0; }
    emit(cause) {
      this.cause = cause;
      if (this._queued) { this._causes.add(cause); return; }
      this._queued = true; this._causes = new Set([cause]);
      // one redraw per frame; the timeout covers pages where animation frames are paused (background tab)
      const flush = () => { if (!this._queued) return; this._queued = false; const causes = this._causes; this.dispatchEvent(Object.assign(new Event('change'), { causes })); };
      requestAnimationFrame(flush); setTimeout(flush, 60);
    }
    on(fn) { this.addEventListener('change', e => fn(e.causes || new Set(['index']))); }
    // value binding: number | [..] | 'col' (value of this run's column at i) | '@param' | function(ctx)
    val(v, run = this.run, i = null) {
      if (i == null) i = run === this.run ? this.i : this.indexAtTime(this.time(), run);
      if (typeof v === 'function') return v(this.ctx(run, i));
      if (typeof v === 'string') { if (v[0] === '@') return this.params[v.slice(1)]; const c = run.cols[v]; return c ? c[Math.max(0, Math.min(c.length - 1, i))] : undefined; }
      if (Array.isArray(v)) return v.map(x => this.val(x, run, i));
      return v;
    }
    ctx(run = this.run, i = this.i) {
      return { i, run, stage: this, data: this.data, params: this.params, c: name => run.cols[name] ? run.cols[name][i] : undefined, col: name => run.cols[name] };
    }
    field(name) { return (this.data.fields || {})[name] || { label: name }; }
    show(name, v) { const f = this.field(name); if (v == null) return '–'; return typeof v === 'number' ? fmt(v * (f.k ?? 1), f.digits ?? 2) + (f.unit ? ' ' + f.unit : '') : String(v); }
  }
  Kit.Stage = Stage;

  // ---------- canvas helper: crisp at any width, redraws on resize
  Kit.canvas = (host, { cls = 'kit-canvas', height = 320, label = '' } = {}) => {
    const cv = el('canvas', { class: cls, tabindex: 0, role: 'img', 'aria-label': label });
    cv.style.height = typeof height === 'number' ? height + 'px' : height;
    host.append(cv);
    const api = { cv, draw: null, ctx: null, w: 0, h: 0 };
    api.fit = () => {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return false;
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      api.ctx = cv.getContext('2d'); api.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); api.w = w; api.h = h; return true;
    };
    api.redraw = () => { if (api.draw && api.fit()) api.draw(api.ctx, api.w, api.h); };
    new ResizeObserver(() => api.redraw()).observe(cv);
    return api;
  };
  Kit.arrow = (g, x0, y0, x1, y1, color, width = 2, head = 9) => {
    const a = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0); if (L < 1) return;
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(a) * head * 0.7, y1 - Math.sin(a) * head * 0.7); g.stroke();
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4)); g.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4)); g.closePath(); g.fill();
  };
  Kit.label = (g, text, x, y, { color = '#20343d', bg = 'rgba(255,255,255,.85)', align = 'left', font = '13px sans-serif' } = {}) => {
    g.font = font; const w = g.measureText(text).width; const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (bg) { g.fillStyle = bg; g.fillRect(x0 - 3, y - 12, w + 6, 17); }
    g.fillStyle = color; g.textAlign = 'left'; g.fillText(text, x0, y);
  };
  // HTML tags over a picture (2D or 3D): crisp text, same look in both. place([{key, x, y, text, cls}]) in CSS px of `box`.
  // cls 'kit-tag-callout' = the tour's pointer (ring on the point + caption bubble); others are small static labels.
  Kit.overlay = box => {
    const layer = el('div', { class: 'kit-ovl', 'aria-hidden': 'true' }); box.append(layer);
    const tags = new Map();
    return {
      layer,
      place(list) {
        const seen = new Set(), W = box.clientWidth, H = box.clientHeight;
        for (const t of list) {
          if (t.x == null || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
          let n = tags.get(t.key);
          if (!n) { n = el('div', {}, el('span')); tags.set(t.key, n); layer.append(n); }
          n.className = 'kit-tag ' + (t.cls || ''); n.firstChild.textContent = t.text;
          if (t.color) n.style.setProperty('--c', t.color); else n.style.removeProperty('--c');
          const out = t.x < -4 || t.y < -4 || t.x > W + 4 || t.y > H + 4;
          n.hidden = out; n.style.left = t.x + 'px'; n.style.top = t.y + 'px';
          // bubble goes up-right of the point unless that runs off the picture
          n.classList.toggle('kit-flip-x', t.x > W * 0.6); n.classList.toggle('kit-flip-y', t.y < 70);
          seen.add(t.key);
        }
        for (const [k, n] of tags) if (!seen.has(k)) n.hidden = true;
      }
    };
  };
  // tour caption text may be a string or a function of the stage context (to quote real numbers from the data)
  Kit.text = (v, ctx) => typeof v === 'function' ? v(ctx) : (v ?? '');
  Kit.niceTicks = (a, b, target = 6) => {
    const span = Math.abs(b - a) || 1, raw = span / target, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
    const step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; const out = [];
    for (let v = Math.ceil(Math.min(a, b) / step - 1e-9) * step; v <= Math.max(a, b) + step * 1e-6; v += step) out.push(+v.toFixed(10));
    return out;
  };
  // which data object a component should read: data-name="x" picks data[group][x], else data[group] if not keyed
  Kit.spec = (stage, group, host, fallbackKey) => {
    const g = stage.data[group] || {}; const key = host.dataset.name || fallbackKey;
    return key && g[key] ? g[key] : (Object.values(g)[0] || {});
  };

  // ---------- mounting
  function lazy(host, fn) {
    const ready = () => !host.closest('details:not([open])');
    if (ready()) return fn();
    const onToggle = () => { if (ready()) { document.removeEventListener('toggle', onToggle, true); fn(); } };
    document.addEventListener('toggle', onToggle, true);
  }
  function mountStage(stageHost) {
    const names = (stageHost.dataset.src || '').split(/\s+/).filter(Boolean);
    const missing = names.filter(n => !store[n]);
    if (!names.length || missing.length) { console.warn('kit: data not loaded', missing.join(' ')); stageHost.classList.add('kit-failed'); return; }
    const data = {}; for (const n of names) merge(data, store[n]);
    const stage = new Stage(stageHost, data); stageHost.kitStage = stage;
    const own = stageHost.dataset.kit && stageHost.dataset.kit !== 'stage' ? [stageHost] : [];
    const parts = own.concat([...stageHost.querySelectorAll('[data-kit]')].filter(h => h !== stageHost && h.dataset.kit !== 'stage' && closestStage(h) === stageHost));
    for (const h of parts) mountPart(h, stage);
    stageHost.classList.add('kit-live');
    stage.emit('init');
  }
  function closestStage(h) { let p = h.parentElement; while (p) { if (p.dataset && p.dataset.src && p.dataset.kit) return p; p = p.parentElement; } return h.dataset.src ? h : null; }
  function mountPart(h, stage) {
    const fn = defs[h.dataset.kit]; if (!fn) { console.warn('kit: unknown component', h.dataset.kit); return; }
    lazy(h, () => {
      try {
        const fallback = [...h.children].filter(c => c.classList.contains('kit-fallback'));
        fn(h, stage);
        fallback.forEach(c => { c.hidden = true; });
        h.classList.add('kit-mounted');
      } catch (e) { console.error('kit component failed:', h.dataset.kit, e); h.classList.add('kit-failed'); }
    });
  }
  Kit.mountAll = (scope = document) => { for (const s of scope.querySelectorAll('[data-kit][data-src]')) if (!s.kitStage) mountStage(s); };
  // <pre data-kit-markup="stageId"></pre> shows the exact markup of that stage as written (captured before mounting)
  function showMarkup() {
    for (const pre of document.querySelectorAll('[data-kit-markup]')) {
      const src = document.getElementById(pre.dataset.kitMarkup); if (!src) continue;
      const copy = src.cloneNode(true);
      for (const f of copy.querySelectorAll('.kit-fallback')) f.innerHTML = ' (JS가 꺼졌을 때 보일 표나 그림) ';
      const lines = copy.outerHTML.split('\n');
      const pad = Math.min(...lines.slice(1).filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
      pre.textContent = lines.map((l, k) => k ? l.slice(Math.min(pad, l.match(/^ */)[0].length)) : l).join('\n');
    }
  }
  const boot = () => { showMarkup(); Kit.mountAll(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})(window);
