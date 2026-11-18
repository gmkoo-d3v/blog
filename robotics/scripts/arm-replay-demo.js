/* Two small widgets on the 팔장면.py scene, drawn to scale from above (base at the origin).
   [data-arm-pose]   b22: sliders for shoulder and elbow draw the arm; x,y come from the forward-kinematics formula, and for the owner's
                     three poses the stored MuJoCo site position is shown next to it.
   [data-arm-replay] b23 / b24: replays a stored MuJoCo run (arm-replay-data.js, frames every 0.01 s): arm, fingertip path, targets,
                     box, and the two joint-angle curves with a time cursor. The widget never simulates. */
(function (root) {
  'use strict';
  const L1 = 0.30, L2 = 0.25, BOX = { x: 0.4, y: 0.15, half: 0.03 }, TABLE = { x0: -0.1, x1: 0.7, y0: -0.35, y1: 0.35 };
  const rad = d => d * Math.PI / 180;
  const f = (x, d = 3) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  function fk(sDeg, eDeg) { const a = rad(sDeg), b = rad(sDeg + eDeg); return { elbow: [L1 * Math.cos(a), L1 * Math.sin(a)], tip: [L1 * Math.cos(a) + L2 * Math.cos(b), L1 * Math.sin(a) + L2 * Math.sin(b)] }; }
  function frameAt(run, t) { const n = run.F.S.length; return Math.max(0, Math.min(n - 1, Math.round(t / 0.01))); }
  function targetIndex(run, t) { return Math.min(run.targets.length - 1, Math.floor(t / run.hold + 1e-9)); }
  const math = { fk, frameAt, targetIndex, L1, L2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.ArmReplayMath = math;
  const XR = [-0.2, 0.85], YR = [-0.42, 0.64];
  function setupCanvas(cv) {
    const dpr = Math.min(root.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = Math.min(w / (XR[1] - XR[0]), h / (YR[1] - YR[0]));
    return { ctx, w, h, sc, X: x => (x - XR[0]) * sc, Y: y => h - (y - YR[0]) * sc };
  }
  function drawTable(g, caption) {
    const { ctx, X, Y, sc, w, h } = g;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#dfe5e2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e6c9a3'; ctx.fillRect(X(TABLE.x0), Y(TABLE.y1), (TABLE.x1 - TABLE.x0) * sc, (TABLE.y1 - TABLE.y0) * sc);
    ctx.strokeStyle = '#a88660'; ctx.lineWidth = 1.5; ctx.strokeRect(X(TABLE.x0), Y(TABLE.y1), (TABLE.x1 - TABLE.x0) * sc, (TABLE.y1 - TABLE.y0) * sc);
    ctx.fillStyle = '#6a5a47'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(caption || '탁자 윗면 (바깥은 바닥)', X(TABLE.x0) + 6, Y(TABLE.y1) + 15);
    ctx.strokeStyle = '#b9ad9c'; ctx.lineWidth = 1; ctx.fillStyle = '#7d705e'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    for (const gx of [0, 0.2, 0.4, 0.6]) { ctx.beginPath(); ctx.moveTo(X(gx), Y(TABLE.y0)); ctx.lineTo(X(gx), Y(TABLE.y0) - 5); ctx.stroke(); if (gx) ctx.fillText('x=' + gx, X(gx), Y(TABLE.y0) - 8); }
  }
  function drawBox(g, bx, by, onFloor) {
    const { ctx, X, Y, sc } = g, s = BOX.half * sc;
    ctx.fillStyle = onFloor ? '#c9a24a' : '#f2c230'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2;
    ctx.fillRect(X(bx) - s, Y(by) - s, 2 * s, 2 * s); ctx.strokeRect(X(bx) - s, Y(by) - s, 2 * s, 2 * s);
  }
  function drawArm(g, sDeg, eDeg) {
    const { ctx, X, Y, sc } = g, A = fk(sDeg, eDeg);
    ctx.lineCap = 'round'; ctx.lineWidth = 0.04 * sc; ctx.strokeStyle = '#2f6fd0'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(A.elbow[0]), Y(A.elbow[1])); ctx.stroke();
    ctx.lineWidth = 0.036 * sc; ctx.strokeStyle = '#1f9a6a'; ctx.beginPath(); ctx.moveTo(X(A.elbow[0]), Y(A.elbow[1])); ctx.lineTo(X(A.tip[0]), Y(A.tip[1])); ctx.stroke();
    ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(X(0), Y(0), 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#e03030'; ctx.beginPath(); ctx.arc(X(A.tip[0]), Y(A.tip[1]), 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('받침', X(0) + 9, Y(0) + 15);
    return A;
  }
  const label = (ctx, txt, x, y, col, align) => { ctx.fillStyle = col || '#333'; ctx.textAlign = align || 'left'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(txt, x, y); };

  /* ---------- b22: pose sliders ---------- */
  function initPose(host) {
    const D = root.ArmReplayData; host.classList.add('b2-demo');
    host.innerHTML = `<h3>직접 돌려 보기: 두 각도로 손끝이 어디에 놓이나</h3>
      <p class="b2-how">슬라이더나 단추로 어깨 θ₁과 팔꿈치 θ₂를 정하면 팔이 그 자세로 놓입니다. b22는 이렇게 각도만 정하고 위치를 계산하는 일(mj_forward)까지만 합니다.</p>
      <div class="b2-push"><div class="b2-pushview"><canvas class="b2-pcanvas" aria-label="위에서 본 탁자와 상자, 어깨와 팔꿈치 각도에 따른 팔의 자세"></canvas></div>
      <div class="b2-pushside"><div class="b2-presets" data-presets></div>
        <div class="b2-sliders b2-onecol"><label>어깨 θ₁ <output data-out="s"></output><input type="range" data-ctl="s" min="-90" max="120" step="5" aria-label="어깨 각도"></label>
          <label>팔꿈치 θ₂ (위팔 방향에서 잰 상대각) <output data-out="e"></output><input type="range" data-ctl="e" min="-120" max="120" step="5" aria-label="팔꿈치 각도"></label></div>
        <div class="b2-readout" data-readout aria-live="polite"></div></div></div>
      <p class="small">손끝 위치는 식 x = 0.30cosθ₁ + 0.25cos(θ₁+θ₂), y = 0.30sinθ₁ + 0.25sin(θ₁+θ₂)로 이 화면에서 계산합니다. 세 단추의 MuJoCo 값은 b22를 돌려 읽은 site 위치(소수 둘째 자리 이하는 반올림)입니다. 이 그림은 시뮬레이션이 아니라 자세 그림입니다.</p>`;
    const cv = host.querySelector('.b2-pcanvas'), out = host.querySelector('[data-readout]'), pre = host.querySelector('[data-presets]');
    const ctl = n => host.querySelector(`[data-ctl=${n}]`), st = { s: 30, e: 60 };
    D.poses.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `(${p.s}°, ${p.e}°)`; b.addEventListener('click', () => { st.s = p.s; st.e = p.e; update(); }); pre.append(b); });
    function update() {
      ctl('s').value = st.s; ctl('e').value = st.e; host.querySelector('[data-out=s]').textContent = st.s + '°'; host.querySelector('[data-out=e]').textContent = st.e + '°';
      const A = fk(st.s, st.e), pose = D.poses.find(p => p.s === st.s && p.e === st.e);
      out.innerHTML = `<div class="b2-grid"><div><span>아래팔이 가리키는 절대 방향 θ₁+θ₂</span><b>${st.s + st.e}°</b></div>
        <div><span>손끝 x = 0.30·cos ${st.s}° + 0.25·cos ${st.s + st.e}°</span><b>${f(A.tip[0], 3)} m</b></div>
        <div><span>손끝 y = 0.30·sin ${st.s}° + 0.25·sin ${st.s + st.e}°</span><b>${f(A.tip[1], 3)} m</b></div>
        <div><span>MuJoCo site 위치 (b22를 돌려 읽은 값)</span><b>${pose ? `(${f(pose.x, 3)}, ${f(pose.y, 3)}) m` : '이 자세는 돌려 보지 않았습니다 (위 세 단추만)'}</b></div></div>`;
      const g = setupCanvas(cv); if (!g) return; const { ctx, X, Y, sc } = g;
      drawTable(g); drawBox(g, BOX.x, BOX.y, false); const a = drawArm(g, st.s, st.e);
      const ex = a.elbow[0], ey = a.elbow[1], ux = Math.cos(rad(st.s)), uy = Math.sin(rad(st.s));
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(0.5), Y(0));
      ctx.moveTo(X(ex), Y(ey)); ctx.lineTo(X(ex + 0.2 * ux), Y(ey + 0.2 * uy)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#2f6fd0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(0), Y(0), 0.07 * sc, -rad(st.s), 0, st.s < 0); ctx.stroke();
      label(ctx, 'θ₁ ' + st.s + '°', X(0.1), st.s >= 0 ? Y(0) + 16 : Y(0) - 8, '#2f6fd0');
      ctx.strokeStyle = '#1f9a6a'; ctx.beginPath(); ctx.arc(X(a.elbow[0]), Y(a.elbow[1]), 0.07 * sc, -rad(st.s + st.e), -rad(st.s), st.e < 0); ctx.stroke();
      label(ctx, 'θ₂ ' + st.e + '°', X(a.elbow[0]) + 0.08 * sc, Y(a.elbow[1]) - 0.06 * sc, '#1f9a6a');
      label(ctx, `손끝 (${f(a.tip[0], 2)}, ${f(a.tip[1], 2)})`, Math.min(X(a.tip[0]) + 8, g.w - 120), Y(a.tip[1]) - 10, '#c0392b');
    }
    for (const k of ['s', 'e']) ctl(k).addEventListener('input', e => { st[k] = +e.target.value; update(); });
    new ResizeObserver(update).observe(cv); update(); host.dataset.ready = '1';
  }

  /* ---------- b23 / b24: replay ---------- */
  function initReplay(host) {
    const D = root.ArmReplayData, names = (host.dataset.runs || 'b23').split(','), titles = { b23: '원래 b23: 네 목표 자세', b23x: '마지막 목표만 (60°, 0°)로 바꾼 b23', b24: 'b24: 어깨 목표를 2초 동안 0°→100°' };
    host.classList.add('b2-demo');
    const radios = names.length > 1 ? `<div class="b2-modes" role="radiogroup" aria-label="어느 실행을 볼까">${names.map((n, i) => `<label><input type="radio" name="${host.id || 'r'}-run" value="${n}"${i ? '' : ' checked'}> ${titles[n]}</label>`).join('')}</div>` : '';
    host.innerHTML = `<h3>${host.dataset.title}</h3><p class="b2-how">${host.dataset.how}</p>${radios}
      <div class="b2-push"><div class="b2-pushview"><canvas class="b2-pcanvas" aria-label="위에서 본 탁자, 상자, 팔과 손끝 경로"></canvas></div>
      <div class="b2-pushside"><div class="b2-readout" data-readout aria-live="polite"></div></div></div>
      <figure class="b2-plotbox"><canvas class="b2-mini b2-anglecv" height="230" aria-label="어깨와 팔꿈치 각도 곡선. 점선은 목표. 클릭하면 그 시각으로 이동" tabindex="0"></canvas>
      <figcaption>가로: 시간(초), 세로: 관절 각도(도). 실선은 실제 각도, 점선은 목표. 세로 선이 지금 시각입니다. 그림을 클릭하거나 끌어도 됩니다.</figcaption></figure>
      <div class="b2-pushtime"><button type="button" data-ctl="play">재생</button><input type="range" data-ctl="time" min="0" max="1" step="1" aria-label="시간"><output data-out="time"></output></div>
      <p class="small">${host.dataset.note}</p>`;
    const cv = host.querySelector('.b2-pcanvas'), pl = host.querySelector('.b2-anglecv'), out = host.querySelector('[data-readout]');
    const ctl = n => host.querySelector(`[data-ctl=${n}]`), st = { run: names[0], i: 0, play: false, raf: 0, last: 0 };
    const run = () => D[st.run], N = () => run().F.S.length - 1;
    function setRun(n) { st.run = n; ctl('time').max = N(); st.i = n === 'b24' ? 0 : 0; stop(); update(); }
    host.querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', e => setRun(e.target.value)));
    function readout() {
      const R = run(), F = R.F, i = st.i, t = i * 0.01, tip = [F.TX[i] / 1000, F.TY[i] / 1000];
      let rows = `<div><span>시간</span><b>${f(t, 2)} s</b></div>`;
      if (R.targets.length) {
        const k = targetIndex(R, t), tg = R.targets[k], tt = fk(tg[0], tg[1]).tip, dist = Math.hypot(tip[0] - tt[0], tip[1] - tt[1]) * 1000;
        rows += `<div><span>지금 목표 (${k + 1}번)</span><b>(${tg[0]}°, ${tg[1]}°) → 손끝 (${f(tt[0], 3)}, ${f(tt[1], 3)})</b></div>`;
        rows += `<div><span>손끝과 목표의 거리</span><b>${f(dist, 1)} mm</b></div>`;
      } else rows += `<div><span>어깨 목표 (ctrl)</span><b>${f(F.TS[i], 1)}° (팔꿈치 목표 0°)</b></div>`;
      rows += `<div><span>실제 관절각 어깨 / 팔꿈치</span><b>${f(F.S[i], 1)}° / ${f(F.E[i], 1)}°</b></div><div><span>손끝 x, y</span><b>(${f(tip[0], 3)}, ${f(tip[1], 3)}) m</b></div>`;
      const touched = R.c !== null && t >= R.c, fell = R.f !== null && t >= R.f;
      rows += `<div><span>상자 x, y</span><b>(${f(F.BX[i] / 1000, 3)}, ${f(F.BY[i] / 1000, 3)}) m ${fell ? '· 바닥에 닿음' : (touched ? '· 팔과 닿았음' : '· 처음 자리')}</b></div>`;
      const verdict = R.c === null ? '이 실행 전체에서 팔은 상자에 한 번도 닿지 않았습니다(4초, 상자는 [0.4, 0.15, 0.43] 그대로).' : `팔이 상자에 처음 닿은 때 ${f(R.c, 3)} s${R.f !== null ? `, 상자가 바닥에 닿은 때 ${f(R.f, 3)} s` : ', 상자는 탁자 위에 남음'}. 마지막 위치 [${R.fin.join(', ')}].`;
      out.innerHTML = `<div class="b2-grid">${rows}</div><p class="${R.f !== null ? 'b2-sub' : 'b2-warn'}">${verdict}</p>`;
    }
    function drawView() {
      const g = setupCanvas(cv); if (!g) return; const { ctx, X, Y } = g, R = run(), F = R.F, i = st.i, t = i * 0.01;
      drawTable(g);
      if (R.targets.length > 1) {                       // straight lines between targets: what a straight path would look like
        ctx.setLineDash([5, 5]); ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.2; ctx.beginPath();
        R.targets.forEach((tg, k) => { const p = fk(tg[0], tg[1]).tip; k ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])); }); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.strokeStyle = 'rgba(190,60,60,.28)'; ctx.lineWidth = 1.5; ctx.beginPath();     // whole fingertip path, faint
      F.TX.forEach((x, k) => { k ? ctx.lineTo(X(x / 1000), Y(F.TY[k] / 1000)) : ctx.moveTo(X(x / 1000), Y(F.TY[k] / 1000)); }); ctx.stroke();
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2.5; ctx.beginPath();              // travelled part
      for (let k = 0; k <= i; k++) { k ? ctx.lineTo(X(F.TX[k] / 1000), Y(F.TY[k] / 1000)) : ctx.moveTo(X(F.TX[k] / 1000), Y(F.TY[k] / 1000)); } ctx.stroke();
      const fell = R.f !== null && t >= R.f;
      drawBox(g, F.BX[i] / 1000, F.BY[i] / 1000, fell);
      R.targets.forEach((tg, k) => { const p = fk(tg[0], tg[1]).tip, x = X(p[0]), y = Y(p[1]); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); label(ctx, String(k + 1), x + 8, y - 6, '#111'); });
      drawArm(g, F.S[i], F.E[i]);
      if (F.BY[i] / 1000 > YR[1] + 0.03) label(ctx, '상자가 화면 위쪽 밖으로 나갔습니다', 8, 52, '#7a3a00');
      label(ctx, 't = ' + f(t, 2) + ' s', 8, 34, '#333');
      label(ctx, R.targets.length > 1 ? '빨간 선: 손끝이 지난 길 · 회색 점선: 목표를 곧게 이은 선' : '빨간 선: 손끝이 지난 길', 8, 16, '#555');
    }
    function drawPlot() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = pl.clientWidth, h = pl.clientHeight; if (!w || !h) return;
      if (pl.width !== Math.round(w * dpr)) { pl.width = Math.round(w * dpr); pl.height = Math.round(h * dpr); }
      const c = pl.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const R = run(), F = R.F, n = F.S.length, T = (n - 1) * 0.01, all = F.S.concat(F.E, F.TS, F.TE), lo = Math.floor(Math.min(...all) / 20) * 20, hi = Math.ceil(Math.max(...all) / 20) * 20;
      const Lm = 40, Rm = 10, Tm = 10, Bm = 26, X = t => Lm + (w - Lm - Rm) * t / T, Y = v => Tm + (h - Tm - Bm) * (1 - (v - lo) / (hi - lo));
      c.font = '12px sans-serif'; c.fillStyle = '#444'; c.strokeStyle = '#d3dedb'; c.lineWidth = 1;
      for (let v = lo; v <= hi; v += 20) { c.beginPath(); c.moveTo(Lm, Y(v)); c.lineTo(w - Rm, Y(v)); c.stroke(); c.textAlign = 'right'; c.fillText(v + '°', Lm - 4, Y(v) + 4); }
      c.textAlign = 'center'; for (let s = 0; s <= T + 1e-9; s += 0.5) { c.fillText(String(s), X(s), h - 8); }
      if (R.targets.length > 1) { c.strokeStyle = '#e7d9c8'; for (let k = 1; k < R.targets.length; k++) { c.beginPath(); c.moveTo(X(k * R.hold), Tm); c.lineTo(X(k * R.hold), h - Bm); c.stroke(); } }
      const line = (arr, col, dash, wd) => { c.setLineDash(dash); c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); arr.forEach((v, k) => { k ? c.lineTo(X(k * 0.01), Y(v)) : c.moveTo(X(0), Y(v)); }); c.stroke(); c.setLineDash([]); };
      line(F.TS, '#2f6fd0', [5, 4], 1.5); line(F.TE, '#1f9a6a', [5, 4], 1.5); line(F.S, '#2f6fd0', [], 2.2); line(F.E, '#1f9a6a', [], 2.2);
      c.fillStyle = '#2f6fd0'; c.textAlign = 'left'; c.fillText('어깨 (실선) / 목표 (점선)', Lm + 8, Tm + 12); c.fillStyle = '#1f9a6a'; c.fillText('팔꿈치', Lm + 175, Tm + 12);
      c.strokeStyle = '#333'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X(st.i * 0.01), Tm); c.lineTo(X(st.i * 0.01), h - Bm); c.stroke();
    }
    function update() { ctl('time').value = st.i; host.querySelector('[data-out=time]').textContent = f(st.i * 0.01, 2) + ' s'; readout(); drawView(); drawPlot(); }
    function seekFromEvent(ev) { const r = pl.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, w = r.width, Lm = 40, Rm = 10, u = (x * w - Lm) / (w - Lm - Rm); st.i = Math.max(0, Math.min(N(), Math.round(u * N()))); stop(); update(); }
    pl.addEventListener('pointerdown', e => { pl.setPointerCapture(e.pointerId); seekFromEvent(e); pl.onpointermove = seekFromEvent; });
    pl.addEventListener('pointerup', () => { pl.onpointermove = null; });
    pl.addEventListener('keydown', e => { if (e.key === 'ArrowRight') st.i = Math.min(N(), st.i + 5); else if (e.key === 'ArrowLeft') st.i = Math.max(0, st.i - 5); else return; e.preventDefault(); stop(); update(); });
    ctl('time').addEventListener('input', e => { st.i = +e.target.value; stop(); update(); });
    function stop() { st.play = false; cancelAnimationFrame(st.raf); ctl('play').textContent = '재생'; }
    function tick(ts) { if (!st.play) return; if (!st.last) st.last = ts; const adv = (ts - st.last) / 10; if (adv >= 1) { st.i = Math.min(N(), st.i + Math.floor(adv)); st.last = ts; update(); } if (st.i >= N()) { stop(); return; } st.raf = requestAnimationFrame(tick); }
    ctl('play').addEventListener('click', () => { if (st.play) { stop(); return; } if (st.i >= N()) st.i = 0; st.play = true; st.last = 0; ctl('play').textContent = '멈춤'; st.raf = requestAnimationFrame(tick); });
    ctl('time').max = N(); st.i = host.dataset.start === 'end' ? N() : 0;
    new ResizeObserver(update).observe(cv); new ResizeObserver(drawPlot).observe(pl); update(); host.dataset.ready = '1';
  }
  function mount(sel, init) {
    document.querySelectorAll(sel).forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '그림을 열 수 없습니다.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
  }
  mount('[data-arm-pose]', initPose); mount('[data-arm-replay]', initReplay);
})(typeof window === 'undefined' ? globalThis : window);
