/* One idea: what the six sensors declared in b16_sensors.py actually say while a box falls, lands and sits, and what an
   accelerometer says when it is only tilted. Every value replays a real MuJoCo 3.17.0 run (sensor-data.js); the widget
   draws, it does not simulate. sensordata is read right after mj_step, exactly as b16_sensors.py does. */
(function (root) {
  'use strict';
  const f = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  const rad = d => d * Math.PI / 180;
  // what a resting accelerometer reads when its box is turned by alpha degrees about the y axis: minus gravity written in the sensor's own axes
  function restReading(alphaDeg, g = 9.81) { const a = rad(alphaDeg); return [-g * Math.sin(a), 0, g * Math.cos(a)]; }
  const math = { restReading, rad };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.SensorMath = math;
  const data = root.SensorData;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const SENSORS = [['accelerometer', 'site imu', '0~2', [0, 1, 2], 'm/s²'], ['gyro', 'site imu', '3~5', [3, 4, 5], 'rad/s'], ['touch', 'site bottom', '6', [6], 'N'],
    ['framepos', 'body box', '7~9', [7, 8, 9], 'm'], ['jointpos', 'joint shoulder', '10', [10], 'rad'], ['jointvel', 'joint shoulder', '11', [11], 'rad/s']];
  function init(host) {
    host.classList.add('b2-demo');
    host.innerHTML = `<h3>직접 돌려 보기: 센서는 무엇이라고 말할까</h3>
      <p class="b2-how">먼저 “떨어뜨리기”에서 슬라이더를 밀어 떨어지는 동안, 닿는 순간, 가만히 있을 때의 값을 비교하세요. 그다음 “기울여 두기”로 가만히 놓은 가속도계만 돌려 봅니다.</p>
      <div class="b2-modes" role="radiogroup" aria-label="실험 고르기">
        <label><input type="radio" name="sd-mode" value="flat" checked> 떨어뜨리기: 평평하게</label>
        <label><input type="radio" name="sd-mode" value="tilted"> 떨어뜨리기: 20° 기울여서</label>
        <label><input type="radio" name="sd-mode" value="tilt"> 기울여 두기: 가만히 놓고 각도만 바꾸기</label></div>
      <div class="b2-sliders"><label data-lab>걸음 수 <output data-out="k"></output><input type="range" data-ctl="k" min="0" max="500" step="1" aria-label="걸음 수"></label></div>
      <div class="b2-buttons" data-btns><button type="button" data-go="play">재생 / 정지</button><button type="button" data-go="50">0.1초로</button><button type="button" data-go="hit">닿는 순간으로</button><button type="button" data-go="500">1.0초로</button></div>
      <canvas class="b2-side" height="340" aria-label="옆에서 본 장면: 바닥 위로 떨어지는 상자와 오른쪽의 흔들리는 팔"></canvas>
      <figure class="b2-plotbox" data-plotbox><canvas class="b2-mini" height="140" tabindex="0" aria-label="가속도계 z값의 시간 그래프. 그래프를 누르거나 끌면 그 시각으로 이동"></canvas><figcaption>가속도계 z값(m/s²)의 변화. 닿는 순간 값이 너무 커서 눈금 위로 잘립니다(가장 큰 값은 아래 표시).</figcaption></figure>
      <div class="tablewrap"><table class="b2-table"><thead><tr><th>센서 (XML 태그)</th><th>붙는 곳</th><th>sensordata 칸</th><th>지금 값</th></tr></thead><tbody></tbody></table></div>
      <div class="b2-readout" data-readout aria-live="polite"></div>
      <p class="small">그림은 2D 캔버스가 다시 그린 것이고 MuJoCo가 아닙니다. 숫자는 b16_sensors.py와 같은 장면을 MuJoCo 3.17.0으로 0.002초씩 500걸음 돌리며 mj_step 직후에 센서값을 읽은 기록입니다(기울인 낙하와 기울여 두기는 같은 장면에 시작 자세만 바꾼 것).</p>`;
    const st = { mode: 'flat', k: 0, playing: false, last: 0 };
    const side = host.querySelector('.b2-side'), sctx = side.getContext('2d'), mini = host.querySelector('.b2-mini'), mctx = mini.getContext('2d'), tbody = host.querySelector('tbody'), out = host.querySelector('[data-readout]');
    const slider = host.querySelector('[data-ctl=k]'), kout = host.querySelector('[data-out=k]'), lab = host.querySelector('[data-lab]'), btns = host.querySelector('[data-btns]'), plotbox = host.querySelector('[data-plotbox]');
    const tiltKeys = Object.keys(data.tilt).map(Number).sort((a, b) => a - b);
    const rows = () => (st.mode === 'tilted' ? data.tilted : data.flat).rows;
    const hitStep = () => rows().findIndex(r => r[6] > 0);
    host.querySelectorAll('input[name=sd-mode]').forEach(r => r.addEventListener('change', () => { st.mode = r.value; st.playing = false; st.k = st.mode === 'tilt' ? 0 : 0; update(); }));
    slider.addEventListener('input', () => { st.k = +slider.value; st.playing = false; update(); });
    btns.addEventListener('click', e => { const g = e.target.dataset?.go; if (!g) return; if (g === 'play') { st.playing = !st.playing; if (st.k >= 500) st.k = 0; st.last = 0; if (st.playing) requestAnimationFrame(tick); } else { st.playing = false; st.k = g === 'hit' ? hitStep() : +g; } update(); });
    function tick(ts) { if (!st.playing) return; if (!st.last) st.last = ts; const adv = Math.floor((ts - st.last) / 8); if (adv > 0) { st.k = Math.min(500, st.k + adv); st.last = ts; update(); if (st.k >= 500) { st.playing = false; update(); return; } } requestAnimationFrame(tick); }
    function scrub(e) { const r = mini.getBoundingClientRect(), x = (e.clientX - r.left - 40) / (r.width - 52); st.k = Math.max(0, Math.min(500, Math.round(x * 500))); st.playing = false; update(); }
    let drag = false; mini.addEventListener('pointerdown', e => { drag = true; mini.setPointerCapture?.(e.pointerId); scrub(e); }); mini.addEventListener('pointermove', e => { if (drag) scrub(e); }); mini.addEventListener('pointerup', () => { drag = false; });
    mini.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.k = Math.max(0, Math.min(500, st.k + (e.key === 'ArrowLeft' ? -1 : 1))); st.playing = false; update(); e.preventDefault(); } });
    function toXY(w, h) { const s = Math.min((w - 20) / 1.9, (h - 20) / 1.15); return { s, X: x => 40 + (x + 0.4) * s * 0.98, Z: z => h - 18 - z * s }; }
    function drawDrop(r) {
      const w = side.clientWidth, h = side.clientHeight, { s, X, Z } = toXY(w, h);
      sctx.fillStyle = '#e8d9c0'; sctx.fillRect(0, Z(0), w, 18); sctx.strokeStyle = '#a99677'; sctx.beginPath(); sctx.moveTo(0, Z(0)); sctx.lineTo(w, Z(0)); sctx.stroke();
      sctx.fillStyle = '#666'; sctx.font = '12px sans-serif'; sctx.textAlign = 'left'; sctx.fillText('바닥', 6, Z(0) + 14);
      const first = r.every(v => v === 0), q = first ? (rows()[1] || r) : r;   // step 0 has no sensor values yet (all 0): draw the start pose from step 1
      const bz = q[9], pitch = rad(q[12]);   // framepos z, pitch about y (positive = +x side down)
      sctx.save(); sctx.translate(X(0), Z(bz)); sctx.rotate(pitch);          // canvas y points down, so a positive rotation matches positive y-axis pitch
      sctx.fillStyle = r[6] > 0 ? '#e8a13a' : '#286e99'; sctx.fillRect(-0.1 * s, -0.05 * s, 0.2 * s, 0.1 * s);
      sctx.strokeStyle = '#d33'; sctx.lineWidth = 2; sctx.beginPath(); sctx.moveTo(0, 0); sctx.lineTo(0.08 * s, 0); sctx.stroke();
      sctx.strokeStyle = '#0a0'; sctx.beginPath(); sctx.moveTo(0, 0); sctx.lineTo(0, -0.08 * s); sctx.stroke();
      sctx.fillStyle = '#d33'; sctx.beginPath(); sctx.arc(0, 0, 3, 0, 7); sctx.fill();
      sctx.fillStyle = '#0c4d7a'; sctx.fillRect(-0.1 * s, 0.05 * s - 3, 0.2 * s, 3);
      sctx.restore();
      sctx.fillStyle = '#444'; sctx.textAlign = 'center'; sctx.fillText('상자 (붉은 점 = imu, 짙은 밑줄 = touch 영역)', X(0), Z(0.2));
      // arm: pivot at (1, 1); joint angle about +y swings the tip down
      const th = r[10], px = X(1), pz = Z(1); sctx.strokeStyle = '#0c6e70'; sctx.lineWidth = 6; sctx.lineCap = 'round'; sctx.beginPath(); sctx.moveTo(px, pz); sctx.lineTo(px + 0.4 * s * Math.cos(th), pz + 0.4 * s * Math.sin(th)); sctx.stroke();
      sctx.fillStyle = '#d33'; sctx.beginPath(); sctx.arc(px, pz, 4, 0, 7); sctx.fill(); sctx.fillStyle = '#444'; sctx.fillText('팔 (어깨 jointpos)', px + 20, pz - 14);
    }
    function drawTilt(row, a) {
      const w = side.clientWidth, h = side.clientHeight, cx = w * 0.5, cz = h * 0.58, s = Math.min(w, h) * 0.55;
      sctx.fillStyle = '#e8d9c0'; sctx.fillRect(0, h - 14, w, 14);
      const px = cx - 0.22 * s, pz = cz, al = rad(a), bx = px + 0.4 * s * Math.cos(al), bz = pz + 0.4 * s * Math.sin(al);
      sctx.strokeStyle = '#8a9a98'; sctx.lineWidth = 3; sctx.beginPath(); sctx.moveTo(px, pz); sctx.lineTo(bx, bz); sctx.stroke();
      sctx.save(); sctx.translate(bx, bz); sctx.rotate(al); sctx.fillStyle = '#286e99'; sctx.fillRect(-0.1 * s, -0.05 * s, 0.2 * s, 0.1 * s);
      sctx.strokeStyle = '#d33'; sctx.lineWidth = 3; sctx.beginPath(); sctx.moveTo(0, 0); sctx.lineTo(0.16 * s, 0); sctx.stroke(); sctx.strokeStyle = '#0a0'; sctx.beginPath(); sctx.moveTo(0, 0); sctx.lineTo(0, -0.16 * s); sctx.stroke();
      sctx.restore(); sctx.fillStyle = '#d33'; sctx.font = 'bold 13px sans-serif'; sctx.textAlign = 'left'; sctx.fillText('센서 x', bx + 0.17 * s * Math.cos(al), bz + 0.17 * s * Math.sin(al)); sctx.fillStyle = '#0a0'; sctx.fillText('센서 z', bx + 0.17 * s * Math.sin(al), bz - 0.17 * s * Math.cos(al));
      const arrow = (x0, y0, x1, y1, c, t) => { sctx.strokeStyle = c; sctx.fillStyle = c; sctx.lineWidth = 3; sctx.beginPath(); sctx.moveTo(x0, y0); sctx.lineTo(x1, y1); sctx.stroke(); const an = Math.atan2(y1 - y0, x1 - x0); sctx.beginPath(); sctx.moveTo(x1, y1); sctx.lineTo(x1 - 10 * Math.cos(an - .45), y1 - 10 * Math.sin(an - .45)); sctx.lineTo(x1 - 10 * Math.cos(an + .45), y1 - 10 * Math.sin(an + .45)); sctx.fill(); sctx.font = '13px sans-serif'; sctx.fillText(t, x1 + 8, y1 + 4); };
      arrow(bx + 0.28 * s, bz - 0.2 * s, bx + 0.28 * s, bz + 0.12 * s, '#777', '중력 (아래로)'); arrow(bx - 0.3 * s, bz + 0.2 * s, bx - 0.3 * s, bz - 0.12 * s, '#e16a20', '가속도계가 읽는 방향 (위로)');
      sctx.fillStyle = '#444'; sctx.fillText('경첩', px - 14, pz - 10);
    }
    function drawMini() {
      const w = mini.clientWidth, h = mini.clientHeight; if (!w || !h) return; const dpr = Math.min(root.devicePixelRatio || 1, 2);
      if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr); }
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.clearRect(0, 0, w, h);
      const rr = rows(), L = 40, Rr = 12, Tp = 10, B = 24, X = k => L + (w - L - Rr) * k / 500, YMAX = 40, Y = v => Tp + (h - Tp - B) * (1 - (Math.max(-2, Math.min(YMAX, v)) + 2) / (YMAX + 2));
      mctx.font = '12px sans-serif'; mctx.fillStyle = '#444'; mctx.strokeStyle = '#d3dedb'; mctx.lineWidth = 1;
      for (const v of [0, 9.81, 20, 40]) { mctx.beginPath(); mctx.moveTo(L, Y(v)); mctx.lineTo(w - Rr, Y(v)); mctx.stroke(); mctx.textAlign = 'right'; mctx.fillText(v === 9.81 ? '9.81' : v, L - 5, Y(v) + 4); }
      mctx.textAlign = 'center'; for (const t of [0, 0.25, 0.5, 0.75, 1]) mctx.fillText(t + ' s', X(t * 500), h - 6);
      mctx.strokeStyle = '#286e99'; mctx.lineWidth = 2; mctx.beginPath(); rr.forEach((r, k) => { const x = X(k), y = Y(r[2]); k ? mctx.lineTo(x, y) : mctx.moveTo(x, y); }); mctx.stroke();
      mctx.strokeStyle = '#d33'; mctx.beginPath(); mctx.moveTo(X(st.k), Tp); mctx.lineTo(X(st.k), h - B); mctx.stroke();
    }
    function update() {
      const tilt = st.mode === 'tilt';
      lab.style.display = btns.style.display = plotbox.style.display = tilt ? 'none' : '';
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = side.clientWidth, h = side.clientHeight; if (!w || !h) return;
      if (side.width !== Math.round(w * dpr)) { side.width = Math.round(w * dpr); side.height = Math.round(h * dpr); }
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.clearRect(0, 0, w, h);
      let vals, note;
      if (tilt) {
        if (st.k > 12) st.k = 12;
        const key = tiltKeys[st.k], t = data.tilt[key]; slider.max = 12; slider.value = st.k; kout.textContent = ''; lab.style.display = ''; lab.firstChild.textContent = '상자를 돌린 각도 '; kout.textContent = f(t.a, 1) + '°';
        drawTilt(t, t.a); vals = { 0: t.acc[0], 1: t.acc[1], 2: t.acc[2], 3: t.gyro[0], 4: t.gyro[1], 5: t.gyro[2], 6: null, 7: null, 8: null, 9: null, 10: rad(t.a), 11: 0 };
        const p = restReading(t.a);
        note = `<p class="b2-sub">가만히 있어도 가속도계는 0이 아닙니다. 센서 자기 축으로 쓴 “중력의 반대 방향”을 읽기 때문에, 돌리면 9.81이 x와 z 사이에서 나뉩니다. 손으로 계산한 (−9.81·sin ${f(t.a, 1)}°, 0, 9.81·cos ${f(t.a, 1)}°) = (${f(p[0])}, 0, ${f(p[2])}) 이고, 크기 √(x²+z²)는 늘 ${f(Math.hypot(t.acc[0], t.acc[2]))} 근처입니다. 자이로는 돌지 않으므로 0입니다.</p>`;
      } else {
        slider.max = 500; if (!tilt) { lab.firstChild.textContent = '걸음 수 '; }
        const r = rows()[st.k]; slider.value = st.k; kout.textContent = st.k + ' (시각 ' + f(st.k * data.flat.dt, 3) + ' s)';
        drawDrop(r); drawMini(); vals = r;
        const mx = Math.max(...rows().map(x => x[2]));
        note = `<p class="b2-sub">${st.k === 0 ? '아직 mj_step을 한 번도 하지 않아 모든 칸이 0입니다.' : ''}가속도계 z는 떨어지는 동안 0, 닿는 순간 최대 ${f(mx, 1)} m/s²까지 치솟고(touch 칸도 같은 크기의 N), 자리를 잡으면 9.81로 돌아옵니다. 이 값들은 mj_step 직후에 읽은 것이라 한 걸음(0.002초) 전 상태로 계산된 값입니다.</p>`;
      }
      tbody.innerHTML = '';
      for (const [name, where, slot, idx, unit] of SENSORS) {
        const tr = make('tr'); tr.append(make('td', '<' + name + '>'), make('td', where), make('td', slot));
        const v = idx.map(i => vals[i]); tr.append(make('td', v.some(x => x === null) ? '(이 실험에서는 읽지 않음)' : '[' + v.map(x => f(x, Math.abs(x) >= 100 ? 1 : 2)).join(', ') + '] ' + unit)); tbody.append(tr);
      }
      out.innerHTML = note; if (!tilt) drawMini();
    }
    new ResizeObserver(() => update()).observe(side); update();
  }
  document.querySelectorAll('[data-sensor-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '그림을 그릴 수 없습니다.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
