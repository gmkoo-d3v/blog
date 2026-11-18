/* One idea: whether the arm can push the box off the table depends first on REACH (tip radius R against the box distance),
   then on how the arm meets the box. Top view of table, box and arm. Sliders pick L1, L2, elbow and the shoulder sweep end; every
   slider position is a grid point of real MuJoCo 3.17.0 runs (arm-push-data.js), so the box path, contact time and final place
   are replayed from those runs. Only the reach number R is computed live. The widget never simulates. */
(function (root) {
  'use strict';
  const BOX = { x: 0.4, y: 0.15, half: 0.03 }, ARM_R = 0.018, TABLE = { x0: -0.1, x1: 0.7, y0: -0.35, y1: 0.35 };
  const rad = d => d * Math.PI / 180;
  const f = (x, d = 3) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  const BASE_DIST = Math.hypot(BOX.x, BOX.y);                                  // base -> box centre
  const CORNER_DIST = Math.hypot(BOX.x - BOX.half, BOX.y - BOX.half);          // base -> nearest box corner
  // tip distance from the shoulder with the elbow fixed: law of cosines
  function reachRadius(L1, L2, elbowDeg) { return Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(rad(elbowDeg))); }
  // the forearm end cap has radius ARM_R, so contact is possible once R + ARM_R reaches the nearest corner of the box
  function canReach(R) { return R + ARM_R >= CORNER_DIST; }
  function shoulderAt(t, start, end, dur) { return start + Math.min(t / dur, 1) * (end - start); }
  function armPoints(L1, L2, sDeg, eDeg) {
    const a = rad(sDeg), b = rad(sDeg + eDeg), elbow = [L1 * Math.cos(a), L1 * Math.sin(a)];
    return { elbow, tip: [elbow[0] + L2 * Math.cos(b), elbow[1] + L2 * Math.sin(b)] };
  }
  function runKey(L1, L2, el, end) { return L1 + '|' + L2 + '|' + el + '|' + end; }
  function boxAt(run, t, dt) {                       // stored path: xy in mm every dt seconds; hold the last frame
    const n = run.p.length / 2, u = Math.max(0, t) / dt, i = Math.min(Math.floor(u), n - 1), j = Math.min(i + 1, n - 1), w = Math.min(u - i, 1);
    return [(run.p[2 * i] * (1 - w) + run.p[2 * j] * w) / 1000, (run.p[2 * i + 1] * (1 - w) + run.p[2 * j + 1] * w) / 1000];
  }
  // one sentence about what the stored run did (only statements the data shows)
  function verdict(run, R) {
    if (run.c === null) return canReach(R) ? 'none-late' : 'short';
    if (run.f !== null) return 'off';
    const moved = Math.hypot(run.fin[0] / 1000 - BOX.x, run.fin[1] / 1000 - BOX.y);
    return Math.hypot(run.fin[0] / 1000, run.fin[1] / 1000) < BASE_DIST - 0.05 ? 'hook' : (moved < 0.2 ? 'nudge' : 'stay');
  }
  const math = { reachRadius, canReach, shoulderAt, armPoints, runKey, boxAt, verdict, BASE_DIST, CORNER_DIST, ARM_R };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.ArmPushMath = math;
  const data = root.ArmPushData;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  function init(host) {
    host.classList.add('b2-demo');
    const sl = (id, label, arr) => `<label>${label} <output data-out="${id}"></output><input type="range" data-ctl="${id}" min="0" max="${arr.length - 1}" step="1" aria-label="${label}"></label>`;
    host.innerHTML = `<h3>직접 돌려 보기: 이 팔이 상자를 밀어 떨어뜨릴까</h3>
      <p class="b2-how">슬라이더 네 개를 움직이면 팔과 상자의 위쪽 모습이 바뀝니다. 재생 단추를 누르면 그 설정으로 돌려 둔 MuJoCo 실행을 다시 보여 줍니다.</p>
      <div class="b2-push">
        <div class="b2-pushview"><canvas class="b2-pcanvas" aria-label="위에서 본 탁자, 상자, 팔. 점선 원은 손끝이 닿는 거리"></canvas>
          <div class="b2-pushtime"><button type="button" data-ctl="play">재생</button><input type="range" data-ctl="time" min="0" max="${Math.round(data.total / data.dt)}" step="1" aria-label="시간"><output data-out="time"></output></div></div>
        <div class="b2-pushside">
          <div class="b2-sliders b2-onecol">${sl('L1', '위팔 L1', data.L1s)}${sl('L2', '아래팔 L2', data.L2s)}${sl('el', '팔꿈치 각도 (고정)', data.els)}${sl('end', '어깨를 −40°에서 여기까지 2초 동안 돌림', data.ends)}</div>
          <div class="b2-readout" data-readout aria-live="polite"></div>
        </div>
      </div>
      <p class="small">여기서 직접 계산하는 것은 손끝 반지름 R뿐입니다. 상자의 움직임·접촉 시각·최종 위치는 MuJoCo 3.17.0으로 돌려 둔 400번의 실행(L1 4가지 × L2 4가지 × 팔꿈치 5가지 × 어깨 끝 5가지)에서 읽은 값이고, 슬라이더는 그 격자 위에서만 움직입니다. 어깨 각도는 b22처럼 매 걸음 직접 써 넣은 값입니다.</p>`;
    const cv = host.querySelector('.b2-pcanvas'), ctx = cv.getContext('2d'), out = host.querySelector('[data-readout]');
    const ctl = n => host.querySelector(`[data-ctl=${n}]`), outEl = n => host.querySelector(`[data-out=${n}]`);
    const st = { L1: 0, L2: 0, el: 0, end: 0, step: 0, play: false, raf: 0, last: 0 };
    st.L1 = data.L1s.indexOf(0.25); st.L2 = data.L2s.indexOf(0.25); st.el = data.els.indexOf(60); st.end = data.ends.indexOf(80);
    const steps = Math.round(data.total / data.dt);
    const cur = () => ({ L1: data.L1s[st.L1], L2: data.L2s[st.L2], el: data.els[st.el], end: data.ends[st.end] });
    const XR = [-0.2, 0.85], YR = [-0.42, 0.64];
    function draw() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sc = Math.min(w / (XR[1] - XR[0]), h / (YR[1] - YR[0])), X = x => (x - XR[0]) * sc, Y = y => h - (y - YR[0]) * sc;
      const p = cur(), run = data.runs[runKey(p.L1, p.L2, p.el, p.end)], t = st.step * data.dt;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#dfe5e2'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e6c9a3'; ctx.fillRect(X(TABLE.x0), Y(TABLE.y1), (TABLE.x1 - TABLE.x0) * sc, (TABLE.y1 - TABLE.y0) * sc);
      ctx.strokeStyle = '#a88660'; ctx.lineWidth = 1.5; ctx.strokeRect(X(TABLE.x0), Y(TABLE.y1), (TABLE.x1 - TABLE.x0) * sc, (TABLE.y1 - TABLE.y0) * sc);
      ctx.fillStyle = '#6a5a47'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('탁자 윗면 (바깥은 바닥)', X(TABLE.x0) + 6, Y(TABLE.y1) + 15);
      // reach circle R and the distances to the box
      const R = reachRadius(p.L1, p.L2, p.el), ok = canReach(R);
      ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = ok ? '#1f7a4d' : '#c0392b';
      ctx.beginPath(); ctx.arc(X(0), Y(0), R * sc, rad(-60), rad(100)); ctx.stroke();
      ctx.setLineDash([2, 4]); ctx.lineWidth = 1.2; ctx.strokeStyle = '#7a6a2a';
      ctx.beginPath(); ctx.arc(X(0), Y(0), CORNER_DIST * sc, rad(-10), rad(60)); ctx.stroke(); ctx.setLineDash([]);
      // box trail up to now and the box
      const bx = boxAt(run, t, data.dt), n = Math.min(Math.floor(t / data.dt), run.p.length / 2 - 1);
      ctx.strokeStyle = 'rgba(160,110,0,.6)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const x = X(run.p[2 * i] / 1000), y = Y(run.p[2 * i + 1] / 1000); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      const onFloor = run.f !== null && t >= run.f, s = BOX.half * sc;
      ctx.fillStyle = onFloor ? '#c9a24a' : '#f2c230'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2;
      ctx.fillRect(X(bx[0]) - s, Y(bx[1]) - s, 2 * s, 2 * s); ctx.strokeRect(X(bx[0]) - s, Y(bx[1]) - s, 2 * s, 2 * s);
      // arm
      const sd = shoulderAt(t, data.start, p.end, data.dur), A = armPoints(p.L1, p.L2, sd, p.el);
      ctx.lineCap = 'round'; ctx.lineWidth = 0.04 * sc; ctx.strokeStyle = '#2f6fd0'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(A.elbow[0]), Y(A.elbow[1])); ctx.stroke();
      ctx.lineWidth = 0.036 * sc; ctx.strokeStyle = '#1f9a6a'; ctx.beginPath(); ctx.moveTo(X(A.elbow[0]), Y(A.elbow[1])); ctx.lineTo(X(A.tip[0]), Y(A.tip[1])); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(X(0), Y(0), 6, 0, 7); ctx.fill(); ctx.fillStyle = '#e03030'; ctx.beginPath(); ctx.arc(X(A.tip[0]), Y(A.tip[1]), 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#333'; ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillText('받침 (0, 0)', X(0) + 9, Y(0) + 15);
      ctx.fillStyle = ok ? '#1f7a4d' : '#c0392b'; ctx.fillText('R = ' + f(R) + ' m (점선 원)', X(0.02), Y(-0.34) + 4);
      ctx.fillStyle = '#7a6a2a'; ctx.fillText('상자 모서리까지 ' + f(CORNER_DIST) + ' m', X(0.03), Y(0.5));
      if (onFloor) { ctx.fillStyle = '#7a3a00'; ctx.fillText('상자가 바닥에 닿음', X(bx[0]) - 40, Y(bx[1]) - s - 6); }
      if (bx[1] > YR[1] + 0.03 || bx[0] > XR[1] + 0.03 || bx[0] < XR[0] - 0.03) { ctx.fillStyle = '#7a3a00'; ctx.fillText('상자가 화면 밖으로 나갔습니다', 8, 34); }
      ctx.textAlign = 'left'; ctx.fillStyle = '#333'; ctx.fillText('t = ' + f(t, 2) + ' s   어깨 ' + f(sd, 1) + '°', 8, 16);
    }
    function readout() {
      const p = cur(), run = data.runs[runKey(p.L1, p.L2, p.el, p.end)], R = reachRadius(p.L1, p.L2, p.el), ok = canReach(R), v = verdict(run, R);
      const fin = run.fin.map(x => f(x / 1000, 3)).join(', ');
      const away = f(Math.hypot(run.fin[0] / 1000 - BOX.x, run.fin[1] / 1000 - BOX.y), 2);
      const why = {
        short: `손끝이 상자 모서리(${f(CORNER_DIST)} m)에 ${f(CORNER_DIST - ARM_R - R)} m 모자라서 아예 닿지 않았습니다. 시간을 더 줘도, 어깨를 더 돌려도 소용없는 기하의 문제입니다.`,
        'none-late': `닿을 수 있는 거리인데 이 실행에서는 닿지 않았습니다.`,
        off: `닿은 뒤 상자가 탁자 가장자리를 넘어 바닥까지 떨어졌습니다.`,
        nudge: `닿긴 했지만 상자는 처음 자리에서 ${away} m만 움직이고 탁자 위에 남았습니다.`,
        stay: `상자가 ${away} m 밀려났지만 탁자 위에 남았습니다.`,
        hook: `닿았지만 상자가 받침 쪽으로 <b>끌려와</b> 탁자 위에 남았습니다. 팔이 길고 팔꿈치가 꺾여 있으면 밀어내는 대신 안쪽으로 쓸어 오는 일이 생깁니다.`
      }[v];
      out.innerHTML = `<div class="b2-grid">
        <div><span>손끝 반지름 R = √(L1² + L2² + 2·L1·L2·cos 팔꿈치)</span><b>√(${f(p.L1 * p.L1, 4)} + ${f(p.L2 * p.L2, 4)} + ${f(2 * p.L1 * p.L2 * Math.cos(rad(p.el)), 4)}) = ${f(R)} m</b></div>
        <div><span>R + 팔 끝 반지름 ${ARM_R} ≥ 상자 앞 모서리 거리 ${f(CORNER_DIST)}?</span><b>${f(R + ARM_R)} ${ok ? '≥' : '<'} ${f(CORNER_DIST)} → ${ok ? '닿을 수 있음' : '닿지 못함'}</b></div>
        <div><span>MuJoCo: 팔이 상자에 처음 닿은 때</span><b>${run.c === null ? '닿지 않음' : f(run.c) + ' s'}</b></div>
        <div><span>MuJoCo: 상자가 바닥에 닿은 때</span><b>${run.f === null ? '탁자 위에 남음' : f(run.f) + ' s → 떨어짐'}</b></div>
        <div><span>MuJoCo: 상자 마지막 위치 x, y, z (m)</span><b>${fin}</b></div></div>
        <p class="${v === 'off' ? 'b2-sub' : 'b2-warn'}">${why}</p>`;
    }
    function labels() {
      const p = cur(); outEl('L1').textContent = p.L1 + ' m'; outEl('L2').textContent = p.L2 + ' m'; outEl('el').textContent = p.el + '°'; outEl('end').textContent = p.end + '°';
      outEl('time').textContent = f(st.step * data.dt, 2) + ' s';
      for (const k of ['L1', 'L2', 'el', 'end']) ctl(k).value = st[k]; ctl('time').value = st.step;
    }
    function update() { labels(); readout(); draw(); }
    for (const k of ['L1', 'L2', 'el', 'end']) ctl(k).addEventListener('input', e => { st[k] = +e.target.value; st.step = steps; stop(); update(); });
    ctl('time').addEventListener('input', e => { st.step = +e.target.value; stop(); labels(); draw(); });
    function stop() { st.play = false; cancelAnimationFrame(st.raf); ctl('play').textContent = '재생'; }
    function tick(ts) { if (!st.play) return; if (!st.last) st.last = ts; const adv = (ts - st.last) / 1000 / data.dt; if (adv >= 1) { st.step = Math.min(steps, st.step + Math.floor(adv)); st.last = ts; labels(); draw(); } if (st.step >= steps) { stop(); return; } st.raf = requestAnimationFrame(tick); }
    ctl('play').addEventListener('click', () => { if (st.play) { stop(); return; } if (st.step >= steps) st.step = 0; st.play = true; st.last = 0; ctl('play').textContent = '멈춤'; st.raf = requestAnimationFrame(tick); });
    st.step = steps; new ResizeObserver(update).observe(cv); update();
    host.dataset.ready = '1';
  }
  document.querySelectorAll('[data-arm-push-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '그림을 열 수 없습니다.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
