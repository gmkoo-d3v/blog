/* Visual kit controls: player, stepper, compare, readout, table, explorer, tour (opening walk-through), tabs (side column),
   recap (optional check at the end; replaced the old predict-first gate in HANDOFF-08).
   Each is mounted from markup (data-kit="...") and talks only to its stage (see kit-core.js). */
(function (root) {
  'use strict';
  const Kit = root.Kit, el = Kit.el, fmt = Kit.fmt;
  const btn = (text, label, on, cls) => el('button', { type: 'button', class: cls, 'aria-label': label || null, text, onclick: on });

  // ---------------------------------------------------------------- time player
  // <div data-kit="player"></div>  run.cols.t (s) or run.dt; run.events [{t,label}] become jump buttons under the slider.
  Kit.define('player', (host, stage) => {
    let playing = false, last = 0, speed = +(host.dataset.speed || 1), simT = 0;
    const play = btn('▶ 재생', '재생', toggle, 'kit-primary');
    const back = btn('◀', '한 칸 뒤로', () => { stop(); stage.setIndex(stage.i - 1); });
    const fwd = btn('▶|', '한 칸 앞으로', () => { stop(); stage.setIndex(stage.i + 1); });
    const range = el('input', { type: 'range', min: 0, max: Math.max(0, stage.n - 1), step: 1, value: 0, 'aria-label': '시간 위치' });
    const out = el('output', { class: 'kit-time', 'aria-live': 'off' });
    const sp = el('select', { 'aria-label': '재생 속도', class: 'kit-speed' }); for (const s of [0.25, 0.5, 1, 2]) sp.append(el('option', { value: s, text: s + '×', selected: s === speed }));
    const marks = el('div', { class: 'kit-marks' });
    host.classList.add('kit-player');
    host.append(el('div', { class: 'kit-bar' }, play, back, fwd, el('div', { class: 'kit-track' }, out, range, marks), sp));   // time sits above the slider's right end
    range.addEventListener('input', () => { stop(); stage.setIndex(+range.value); });
    sp.addEventListener('change', () => { speed = +sp.value; });
    function drawMarks() {
      marks.replaceChildren();
      const T = stage.run.cols.t, tEnd = T ? T[stage.n - 1] : stage.n - 1;
      for (const ev of stage.run.events || []) {
        const t = ev.t ?? stage.time(ev.i); const b = btn(ev.label, `${ev.label}: ${fmt(t)}초로 이동`, () => { stop(); stage.setTime(t); }, 'kit-mark');
        const f = t / (tEnd || 1); b.dataset.frac = f; b.style.left = `calc(8px + (100% - 16px) * ${f.toFixed(4)})`;
        if (f < 0.06) b.style.transform = 'translateX(-8px)'; else if (f > 0.94) b.style.transform = 'translateX(calc(-100% + 8px))';
        marks.append(b);
      }
      marks.hidden = !marks.children.length;
      stack();
    }
    function stack() {                       // put a mark on the next row when it would overlap one already placed (in pixels)
      const W = marks.clientWidth || 300, rowEnd = []; let rowsUsed = 1;
      [...marks.children].sort((a, b) => a.dataset.frac - b.dataset.frac).forEach(m => {
        const w = m.offsetWidth || m.textContent.length * 8 + 14, f = +m.dataset.frac;
        const x0 = f < 0.06 ? 0 : f > 0.94 ? W - w : 8 + (W - 16) * f - w / 2;
        let r = 0; while (rowEnd[r] != null && x0 < rowEnd[r] + 3) r++;
        rowEnd[r] = x0 + w; m.style.top = r * 24 + 'px'; rowsUsed = Math.max(rowsUsed, r + 1);
      });
      marks.style.height = rowsUsed * 24 + 'px';
    }
    new ResizeObserver(() => stack()).observe(marks);
    function tick(now) {
      if (!playing) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now; simT += dt * speed;
      const T = stage.run.cols.t; const end = T ? T[stage.n - 1] : stage.n - 1;
      if (simT >= end) { simT = end; stage.setTime(simT); stop(); return; }
      stage.setTime(T ? simT : simT * 30); requestAnimationFrame(tick);
    }
    function toggle() { playing ? stop() : start(); }
    function start() { if (stage.i >= stage.n - 1) stage.setIndex(0); simT = stage.time(); playing = true; last = performance.now(); play.textContent = '⏸ 멈춤'; play.setAttribute('aria-label', '멈춤'); requestAnimationFrame(tick); }
    function stop() { playing = false; play.textContent = '▶ 재생'; play.setAttribute('aria-label', '재생'); }
    host.kitPlay = start; host.kitStop = stop;
    stage.on(causes => {
      range.max = Math.max(0, stage.n - 1); range.value = stage.i;
      const T = stage.run.cols.t; out.value = T ? `${fmt(stage.time(), 2)} s / ${fmt(T[stage.n - 1], 1)} s` : `${stage.i + 1} / ${stage.n}`;
      if (causes.has('run') || causes.has('init')) drawMarks();
      if (causes.has('run') && playing) simT = stage.time();
      for (const m of marks.children) m.classList.toggle('kit-past', +m.dataset.frac <= stage.time() / ((T && T[stage.n - 1]) || 1) + 1e-6);
    });
  });

  // ---------------------------------------------------------------- stepper (discrete steps; data-by groups frames, e.g. one iteration)
  // <div data-kit="stepper" data-by="k" data-label="{k}회"></div>  notes: run.notes[i] or data.notes[line] via data-note-by.
  Kit.define('stepper', (host, stage) => {
    const by = host.dataset.by, tmpl = host.dataset.label || '단계 {#}', noteBy = host.dataset.noteBy;
    const first = btn('⏮', '처음으로', () => stage.setIndex(0));
    const prev = btn('◀ 이전', '이전 단계', () => go(-1), 'kit-primary');
    const next = btn('다음 ▶', '다음 단계', () => go(1), 'kit-primary');
    const chips = el('div', { class: 'kit-chips', role: 'group', 'aria-label': '단계 바로 가기' });
    const note = el('output', { class: 'kit-note', 'aria-live': 'polite' });
    const pos = el('span', { class: 'kit-pos' });
    host.classList.add('kit-stepper');
    let timer = null; const ms = +(host.dataset.auto || 0);
    const auto = ms ? btn('▶ 자동', '자동으로 넘기기', () => { if (timer) return halt(); if (stage.i >= stage.n - 1) stage.setIndex(0); auto.textContent = '⏸ 멈춤'; timer = setInterval(() => { if (stage.i >= stage.n - 1) return halt(); go(1); }, ms); }) : null;
    function halt() { clearInterval(timer); timer = null; if (auto) auto.textContent = '▶ 자동'; }
    host.kitStop = halt;
    host.append(el('div', { class: 'kit-bar' }, first, prev, pos, next, auto, chips), note);
    for (const b of [first, prev, next]) b.addEventListener('click', halt);
    const groupOf = i => by ? stage.run.cols[by][i] : i;
    function starts() { const s = []; let g; for (let i = 0; i < stage.n; i++) { const v = groupOf(i); if (i === 0 || v !== g) s.push(i); g = v; } return s; }
    function go(d) {
      if (!by || host.dataset.fine === 'true') return stage.setIndex(stage.i + d);
      const s = starts(); let k = s.findIndex((x, j) => stage.i >= x && (j === s.length - 1 || stage.i < s[j + 1]));
      k = Math.max(0, Math.min(s.length - 1, k + d)); stage.setIndex(d > 0 && k === s.length - 1 && stage.i >= s[k] ? stage.n - 1 : s[k]);
    }
    const label = i => tmpl.replace('{#}', i + 1).replace(/\{(\w+)\}/g, (_, c) => stage.run.cols[c] ? stage.run.cols[c][i] : '');
    function drawChips() {
      chips.replaceChildren();
      if (host.dataset.chips === 'none') return;
      for (const i of starts()) chips.append(btn(label(i), null, () => stage.setIndex(i), 'kit-chip'));
    }
    if (host.dataset.fine === 'true') host.append(el('p', { class: 'kit-hint', text: '한 번 누를 때 코드 한 줄씩 나아갑니다.' }));
    stage.on(causes => {
      if (causes.has('run') || causes.has('init')) drawChips();
      const s = starts(); let k = 0; s.forEach((x, j) => { if (stage.i >= x) k = j; });
      [...chips.children].forEach((c, j) => { c.setAttribute('aria-pressed', j === k); });
      pos.textContent = `${k + 1} / ${s.length}`;
      prev.disabled = stage.i === 0; next.disabled = stage.i >= stage.n - 1;
      const notes = stage.data.notes || {};
      const n = stage.data.stepNote || (stage.run.notes && stage.run.notes[stage.i]) || (noteBy && notes[stage.val(noteBy)]);
      note.value = typeof n === 'function' ? n(stage.ctx()) : (n || '');
      note.hidden = !note.value;
    });
  });

  // ---------------------------------------------------------------- compare: choose the run, optionally overlay another
  // <div data-kit="compare" data-runs="a,b" data-overlay="true"></div>   run.label, run.change (what is different)
  Kit.define('compare', (host, stage) => {
    const ids = (host.dataset.runs || Object.keys(stage.data.runs).join(',')).split(',').map(s => s.trim());
    const group = el('div', { class: 'kit-seg', role: 'group', 'aria-label': '비교할 실행 고르기' });
    const change = el('output', { class: 'kit-change', 'aria-live': 'polite' });
    const ov = el('input', { type: 'checkbox', checked: host.dataset.overlay === 'true' });
    host.classList.add('kit-compare');
    host.append(group, el('label', { class: 'kit-check' }, ov, ' 다른 쪽 흐리게 겹치기'), change);
    const buttons = ids.map(id => { const r = stage.data.runs[id]; const b = btn(r.label || id, null, () => { stage.setRun(id); sync(); }); b.dataset.run = id; group.append(b); return b; });
    function sync() {
      const other = ids.find(id => id !== stage.run.id);
      stage.setOverlay(ov.checked && other ? other : null);
    }
    ov.addEventListener('change', sync);
    stage.on(() => {
      ov.checked = !!stage.overlay;          // a tour beat may switch the overlay on or off
      for (const b of buttons) b.setAttribute('aria-pressed', b.dataset.run === stage.run.id);
      // the first run listed is the baseline: name the one edit only when the learner is looking at the changed run
      change.value = stage.run.change && stage.run.id !== ids[0] ? '바뀐 것: ' + stage.run.change : '';
      change.hidden = !change.value;
    });
    sync();
  });

  // ---------------------------------------------------------------- readout: <output> per field, flashes when a param/run changed it
  // <div data-kit="readout" data-fields="S,E,err"></div>  data.fields[name] = {label, unit, digits, k, value?: fn(ctx)}
  Kit.define('readout', (host, stage) => {
    const names = (host.dataset.fields || '').split(',').map(s => s.trim()).filter(Boolean);
    host.classList.add('kit-readout');
    const cells = names.map(name => {
      const f = stage.field(name), o = el('output', { 'aria-label': f.label || name });
      host.append(el('div', { class: 'kit-ro', style: f.color ? `--c:${f.color}` : null }, el('span', { text: f.label || name }), o)); return { name, f, o };
    });
    stage.on(causes => {
      const flash = causes.has('param') || causes.has('run');
      for (const c of cells) {
        const v = c.f.value ? c.f.value(stage.ctx()) : stage.val(c.name);
        const text = typeof v === 'string' ? v : stage.show(c.name, v);
        if (flash && c.o.value !== text && c.o.value !== '') { c.o.parentElement.classList.remove('kit-flash'); void c.o.offsetWidth; c.o.parentElement.classList.add('kit-flash'); }
        c.o.value = text; c.o.parentElement.classList.toggle('kit-lit', stage.lit(c.name));
      }
    });
  });

  // ---------------------------------------------------------------- live table: rows select a time, a frame, a run or params
  // data.tables[name] = {cols:[{key,label}], rows:[{key:value..., t?, i?, run?, set?:{param:value}}], caption}
  Kit.define('table', (host, stage) => {
    const spec = Kit.spec(stage, 'tables', host);
    const rowsOf = () => typeof spec.rows === 'function' ? spec.rows(stage.ctx()) : spec.rows || [];
    const table = el('table', { class: 'kit-table' }); const tbody = el('tbody');
    if (spec.caption) table.append(el('caption', { text: spec.caption }));
    table.append(el('thead', {}, el('tr', {}, ...spec.cols.map(c => el('th', { scope: 'col', text: c.label })))), tbody);
    host.classList.add('kit-tablebox'); host.append(el('div', { class: 'tablewrap' }, table));
    host.append(el('p', { class: 'kit-hint', text: spec.hint || '줄을 누르면 그 장면으로 갑니다.' }));
    let built = null;
    function build() {
      const rows = rowsOf(); built = rows; tbody.replaceChildren();
      rows.forEach((r, k) => {
        const tr = el('tr', { tabindex: 0, 'aria-selected': 'false' }, ...spec.cols.map(c => el('td', { text: typeof c.value === 'function' ? c.value(r, stage) : (r[c.key] ?? '') })));
        const pick = () => {
          if (r.run && r.run !== stage.run.id) stage.setRun(r.run, { keepTime: r.t == null && r.i == null });
          if (r.set) for (const [kk, v] of Object.entries(r.set)) stage.set(kk, v);
          if (r.t != null) stage.setTime(r.t, 'pick'); else if (r.i != null) stage.setIndex(r.i, 'pick');
        };
        tr.addEventListener('click', pick);
        tr.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = tbody.children[k + (e.key === 'ArrowDown' ? 1 : -1)]; if (n) { n.focus(); n.click(); } }
        });
        tbody.append(tr);
      });
    }
    function active() {
      const rows = built || [], t = stage.time(); let best = -1;
      rows.forEach((r, k) => {
        if (r.run && r.run !== stage.run.id) return;
        if (r.t != null) { if (r.t <= t + 1e-9 && (best < 0 || rows[best].t == null || r.t >= rows[best].t)) best = k; }
        else if (r.i != null) { if (r.i <= stage.i && (best < 0 || r.i >= (rows[best].i ?? -1))) best = k; }
        else if (r.match ? r.match(stage.ctx()) : r.run) best = k;
      });
      return best;
    }
    stage.on(causes => {
      if (!built || (typeof spec.rows === 'function' && (causes.has('run') || causes.has('param')))) build();
      const a = active(); [...tbody.children].forEach((tr, k) => tr.setAttribute('aria-selected', k === a));
    });
  });

  // ---------------------------------------------------------------- parameter explorer
  // data.explorers[name] = {params:[{key,label,unit,min,max,step,value} | {key,label,values:[...],value}], presets:[{label,set:{}}],
  //   run: fn(params, stage) -> run object  (formula)      or  key: fn(params) -> id in data.runs (stored-run lookup)}
  // The previous result stays as a faint overlay so the learner sees what changed.
  Kit.define('explorer', (host, stage) => {
    const spec = Kit.spec(stage, 'explorers', host);
    const base = {}; for (const p of spec.params) base[p.key] = p.value;
    const cur = Object.assign({}, base, stage.params);
    const rows = el('div', { class: 'kit-sliders' }), presets = el('div', { class: 'kit-presets' });
    const diff = el('output', { class: 'kit-change', 'aria-live': 'polite' });
    host.classList.add('kit-explorer'); host.append(rows, presets, diff);
    const show = (p, v) => (p.format ? p.format(v) : (typeof v === 'number' ? fmt(v, p.digits ?? (Number.isInteger(v) ? 0 : 2)) : v)) + (p.unit ? ' ' + p.unit : '');
    const ctl = spec.params.map(p => {
      const discrete = Array.isArray(p.values);
      const input = el('input', { type: 'range', min: discrete ? 0 : p.min, max: discrete ? p.values.length - 1 : p.max, step: discrete ? 1 : (p.step || 'any'), 'aria-label': p.label });
      input.value = discrete ? p.values.indexOf(cur[p.key]) : cur[p.key];
      const out = el('output'); const row = el('label', { class: 'kit-slider' }, el('span', {}, p.label + ' ', out), input);
      input.addEventListener('input', () => { cur[p.key] = discrete ? p.values[+input.value] : +input.value; apply(); });
      rows.append(row); return { p, input, out, row, discrete };
    });
    for (const pr of spec.presets || []) presets.append(btn(pr.label, null, () => { Object.assign(cur, base, pr.set); syncInputs(); apply(); }, 'kit-chip'));
    function syncInputs() { for (const c of ctl) c.input.value = c.discrete ? c.p.values.indexOf(cur[c.p.key]) : cur[c.p.key]; }
    function result() {
      if (spec.key) return stage.data.runs[spec.key(cur)];
      if (spec.run) { const r = spec.run(Object.assign({}, cur), stage); r.id = r.id || 'p:' + JSON.stringify(cur); return r; }
      return null;
    }
    function apply(first) {
      for (const [k, v] of Object.entries(cur)) stage.params[k] = v;
      const changed = [];
      for (const c of ctl) {
        const d = cur[c.p.key] !== base[c.p.key]; c.row.classList.toggle('kit-diff', d); c.out.value = show(c.p, cur[c.p.key]);
        if (d) changed.push(`${c.p.label} ${show(c.p, base[c.p.key])} → ${show(c.p, cur[c.p.key])}`);
      }
      diff.value = changed.length ? '기본값에서 바뀐 것: ' + changed.join(', ') : '기본값 그대로입니다. 막대를 하나만 움직여 보세요.';
      const r = result();
      if (r) stage.setRun(r, { keepTime: true, cause: first ? 'init' : 'param', overlay: first || host.dataset.ghost === 'false' ? null : 'previous' });
      else stage.emit('param');
    }
    apply(true);
  });

  // ---------------------------------------------------------------- tour: the opening of every stage (HANDOFF-08)
  // <div data-kit="tour" data-name="main"></div>
  // data.tours[name] = { intro, after, start: {t, run}, beats: [ {
  //     caption,                  // one plain sentence (string or fn(ctx) to quote numbers from the data)
  //     run, overlay,             // which run to show; overlay: run id or null (omit = no overlay)
  //     t | at: fn(ctx) -> index, // the moment to stop on (t = seconds, or the frame index when the run has no t)
  //     play: [from, to], speed,  // optional: animate from..to first (seconds; frames at `rate` per second when no t)
  //     focus: [names],           // what to light up: scene item names, readout fields, plot columns, 'line:N'
  //     callout: {at, at3, text}, // pointer + short tag anchored at a point of the picture (at = 2D, at3 = 3D)
  //     ghost: t,                 // faint pose at that moment (the 'before' picture)
  //     view: '위에서', tab: '코드',
  //     set: {param: value} } ] }    // e.g. move a draggable target to the case the caption talks about
  // Nothing is hidden: the stage shows the scene from the start; the tour only moves the cursor and lights things up.
  Kit.define('tour', (host, stage) => {
    const spec = Kit.spec(stage, 'tours', host), beats = spec.beats || [];
    let k = -1, anim = null, done = false;
    const start = btn(`▶ 처음부터 보기 (${beats.length}장면)`, '처음부터 안내 보기', () => go(0), 'kit-primary kit-tour-start');
    const prev = btn('◀ 이전', '이전 장면', () => go(k - 1));
    const next = btn('다음 ▶', '다음 장면', () => (k >= beats.length - 1 ? finish() : go(k + 1)), 'kit-primary kit-tour-next');
    const quit = btn('✕', '안내 끝내기', () => finish(), 'kit-tour-quit');
    const pos = el('span', { class: 'kit-tour-pos' });
    const cap = el('output', { class: 'kit-tour-cap', 'aria-live': 'polite' });
    const dots = el('div', { class: 'kit-tour-dots', role: 'group', 'aria-label': '장면 바로 가기' });
    beats.forEach((b, j) => dots.append(btn(String(j + 1), `${j + 1}번 장면`, () => go(j), 'kit-tour-dot')));
    host.classList.add('kit-tour');
    host.append(start, el('div', { class: 'kit-tour-body' }, el('div', { class: 'kit-tour-head' }, pos, dots), cap), el('div', { class: 'kit-tour-nav' }, prev, next, quit));
    const stopMotion = () => { anim = null; for (const p of stage.host.querySelectorAll('.kit-player,.kit-stepper')) p.kitStop && p.kitStop(); };
    const T = v => (typeof v === 'function' ? v(stage.ctx()) : v);
    function idxOf(b) { if (b.at) return b.at(stage.ctx()); if (b.t != null) return stage.indexAtTime(T(b.t)); if (b.play) return stage.indexAtTime(T(b.play[1])); return stage.i; }
    function go(j) {
      if (j < 0 || j >= beats.length) return;
      stopMotion(); k = j; done = false; const b = beats[j];
      if (b.run && stage.run.id !== b.run) stage.setRun(b.run, { keepTime: false, cause: 'tour' });
      const ov = 'overlay' in b ? b.overlay : null; if ((stage.overlay && stage.overlay.id) !== ov) stage.setOverlay(ov);
      if (b.set) for (const [kk, v] of Object.entries(b.set)) stage.params[kk] = Array.isArray(v) ? v.slice() : v;   // e.g. move a handle
      const end = idxOf(b);
      const ghost = b.ghost == null ? null : stage.indexAtTime(T(b.ghost));
      stage.setFocus({ focus: b.focus || [], callout: b.callout || null, ghost, view: b.view || null, tab: b.tab || null });
      cap.value = Kit.text(b.caption, stage.ctx(stage.run, end));
      if (b.play) play(stage.indexAtTime(T(b.play[0])), end, b);
      else stage.setIndex(end, 'tour');
      paint();
    }
    function play(i0, i1, b) {
      const token = anim = {}, T0 = stage.time(i0), T1 = stage.time(i1), hasT = !!stage.run.cols.t, t0 = performance.now();
      const rate = hasT ? (b.speed || 1) : (b.rate || 4);
      stage.setIndex(i0, 'tour');
      const tick = () => {
        if (anim !== token) return;
        const v = T0 + (performance.now() - t0) / 1000 * rate;
        if (v >= T1) { stage.setIndex(i1, 'tour'); anim = null; return; }
        stage.setIndex(hasT ? stage.indexAtTime(v) : Math.floor(v), 'tour'); setTimeout(tick, 30);
      };
      setTimeout(tick, 30);
    }
    function finish() {
      stopMotion(); k = -1; done = true; stage.setFocus({}); cap.value = Kit.text(spec.after || '이제 마음대로 움직여 보세요.', stage.ctx()); paint();
    }
    function paint() {
      const on = k >= 0;
      host.classList.toggle('kit-touring', on);
      start.textContent = on ? '↺ 처음부터' : done ? `↺ 처음부터 다시 보기 (${beats.length}장면)` : `▶ 처음부터 보기 (${beats.length}장면)`;
      start.classList.toggle('kit-primary', !on);
      prev.hidden = next.hidden = quit.hidden = !on; dots.hidden = !on;
      prev.disabled = k <= 0; next.textContent = k >= beats.length - 1 ? '마치기 ✓' : '다음 ▶';
      pos.textContent = on ? `${k + 1} / ${beats.length}` : done ? '자유롭게' : '안내';
      [...dots.children].forEach((d, j) => d.setAttribute('aria-current', j === k ? 'step' : 'false'));
      if (!on && !done) cap.value = Kit.text(spec.intro || '', stage.ctx());
    }
    // the learner's own scrubbing, playing or run change stops a tour animation (the caption stays)
    stage.on(causes => { if (anim && ['index', 'pick', 'run', 'param'].some(c => causes.has(c))) anim = null; });
    const s0 = spec.start || {};
    if (s0.run && stage.data.runs[s0.run]) stage.setRun(s0.run, { keepTime: false, cause: 'init' });
    if (s0.t != null) stage.setIndex(stage.indexAtTime(T(s0.t)), 'init');
    stage.tour = { go, finish, get k() { return k; }, get n() { return beats.length; }, get animating() { return !!anim; } };
    paint();
  });

  // ---------------------------------------------------------------- tabs: the side column (graph / code / table ...)
  // <div class="kit-side" data-kit="tabs"><section data-tab="그래프">…</section><section data-tab="코드">…</section></div>
  // A tour beat with tab: '코드' opens that tab. The panel scrolls inside; the stage keeps the picture's height.
  Kit.define('tabs', (host, stage) => {
    const panes = [...host.children].filter(c => c.dataset && c.dataset.tab);
    const list = el('div', { class: 'kit-tablist', role: 'tablist' }), body = el('div', { class: 'kit-tabbody' });
    host.prepend(list); host.append(body);
    const tabs = panes.map((p, j) => {
      const b = el('button', { type: 'button', role: 'tab', class: 'kit-tab', text: p.dataset.tab, onclick: () => pick(j) });
      p.setAttribute('role', 'tabpanel'); p.classList.add('kit-pane-box'); body.append(p); list.append(b); return b;
    });
    function pick(j) { panes.forEach((p, n) => { p.hidden = n !== j; tabs[n].setAttribute('aria-selected', n === j); }); }
    let last = 0;
    stage.on(() => { if (stage.request.n !== last) { last = stage.request.n; const j = panes.findIndex(p => p.dataset.tab === stage.request.tab || p.dataset.tab.startsWith(stage.request.tab || '\u0000')); if (j >= 0) pick(j); } });
    host.kitPick = name => { const j = panes.findIndex(p => p.dataset.tab.startsWith(name)); if (j >= 0) pick(j); };
    pick(Math.max(0, panes.findIndex(p => p.hasAttribute('data-open'))));
  });

  // ---------------------------------------------------------------- recap: optional check AFTER the learner has seen it
  // <details class="kit-recap"><summary>방금 본 것 확인 (선택)</summary><div data-kit="recap" data-q="id"></div></details>
  // data.recaps[id] = {prompt: '방금 본 것: …?', options: [{text, correct, feedback}], show: beat number (0-based) | fn(stage), showLabel}
  // Never blocks anything. Every answer offers a button that replays the moment that shows the answer.
  Kit.define('recap', (host, stage) => {
    const q = (stage.data.recaps || {})[host.dataset.q]; if (!q) throw new Error('recap: no question ' + host.dataset.q);
    const fb = el('output', { class: 'kit-feedback', 'aria-live': 'polite' });
    const again = btn(q.showLabel || '▶ 그 장면 다시 보기', '답이 보이는 장면으로', () => {
      if (typeof q.show === 'function') q.show(stage); else if (stage.tour) stage.tour.go(q.show);
      stage.host.scrollIntoView({ block: 'start', behavior: 'instant' });
    }, 'kit-primary');
    again.hidden = true;
    const opts = el('div', { class: 'kit-recap-opts', role: 'group', 'aria-label': q.prompt });
    q.options.forEach((o, j) => opts.append(btn(o.text, null, () => {
      for (const b of opts.children) b.setAttribute('aria-pressed', b === opts.children[j]);
      fb.dataset.status = o.correct ? 'correct' : 'incorrect';
      fb.value = (o.correct ? '맞습니다. ' : '다시 보면 보입니다. ') + Kit.text(o.feedback, stage.ctx());
      again.hidden = false; again.textContent = o.correct ? '▶ 그 장면 한 번 더' : (q.showLabel || '▶ 그 장면 다시 보기');
    }, 'kit-recap-opt')));
    host.classList.add('kit-recapbox');
    host.append(el('p', { class: 'kit-recap-q', text: q.prompt }), opts, fb, again);
  });
})(window);
