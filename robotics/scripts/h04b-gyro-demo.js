/* One idea: integrating a gyro turns every small error into a growing attitude error, and a constant bias grows steadily.
   The signal, the four integration rules and the noise sequence are those of vol3/02-frames-rotations/gyro_data.py, b23_gyro_integrate.py
   and b24_gyro_drift.py (100 Hz, 10 s, noise = N(0, sigma) from numpy default_rng(0), bias on the z axis). The reference attitude is the
   same 100-substep integral the owner file uses. Illustration of that computation; numbers are checked in verify_h04b_day1.py. */
(function (root) {
  'use strict';
  const DT = 0.01, N = 1000;
  const omega = t => [0.8 * Math.sin(1.3 * t), 0.6 * Math.cos(0.9 * t), 0.5 + 0.3 * Math.sin(0.5 * t)];
  const qmul = (p, q) => [p[0] * q[0] - p[1] * q[1] - p[2] * q[2] - p[3] * q[3], p[0] * q[1] + p[1] * q[0] + p[2] * q[3] - p[3] * q[2],
    p[0] * q[2] - p[1] * q[3] + p[2] * q[0] + p[3] * q[1], p[0] * q[3] + p[1] * q[2] - p[2] * q[1] + p[3] * q[0]];
  function incr(w, h) {
    const x = w[0] * h, y = w[1] * h, z = w[2] * h, a = Math.hypot(x, y, z);
    if (a < 1e-12) return [1, 0, 0, 0];
    const s = Math.sin(a / 2) / a; return [Math.cos(a / 2), s * x, s * y, s * z];
  }
  const angle = (p, q) => { const d = Math.min(Math.abs(p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3]), 1); return 2 * Math.acos(d) * 180 / Math.PI; };
  let refCache = null;
  function reference() {                                     // gyro_data.참_자세: 100 substeps per beat, midpoint rate
    if (refCache) return refCache;
    let q = [1, 0, 0, 0]; const out = [q], h = DT / 100;
    for (let k = 0; k < N; k++) { const t = k * DT; for (let i = 0; i < 100; i++) q = qmul(q, incr(omega(t + (i + 0.5) * h), h)); out.push(q); }
    return (refCache = out);
  }
  const eulerQ = r => {                                       // scipy Rotation.from_euler('ZYX', [yaw, pitch, roll]) as [w,x,y,z]
    const h = v => [Math.cos(v / 2), Math.sin(v / 2)], [cz, sz] = h(r[2]), [cy, sy] = h(r[1]), [cx, sx] = h(r[0]);
    return qmul(qmul([cz, 0, 0, sz], [cy, 0, sy, 0]), [cx, sx, 0, 0]);
  };
  /* opts: method 'euler' | 'inc' | 'mid', bias (rad/s on z), sigma (rad/s), noise [[z]x3], still (body not turning). Returns error per beat in degrees. */
  function errors(opts) {
    const { method, bias, sigma, noise, still } = opts, ref = reference(), err = [];
    let q = [1, 0, 0, 0]; const rpy = [0, 0, 0];
    for (let k = 0; k < N; k++) {
      const t = k * DT, w0 = still ? [0, 0, 0] : omega(method === 'mid' ? t + DT / 2 : t);
      const w = [w0[0] + sigma * noise[k][0], w0[1] + sigma * noise[k][1], w0[2] + sigma * noise[k][2] + bias];
      if (method === 'euler') { rpy[0] += w[0] * DT; rpy[1] += w[1] * DT; rpy[2] += w[2] * DT; q = eulerQ(rpy); }
      else q = qmul(q, incr(w, DT));
      err.push(angle(q, still ? [1, 0, 0, 0] : ref[k + 1]));
    }
    return err;
  }
  const at = (err, sec) => err[Math.round(sec / DT) - 1];
  const math = { omega, qmul, incr, reference, errors, at, DT, N };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.GyroMath = math;
  const { f, fit, frame } = root.H4, noise = root.H4GyroNoise;
  function init(host) {
    host.classList.add('h4-demo');
    host.innerHTML = `<h3>직접 돌려 보기: 자이로 값을 쌓으면 오차도 쌓입니다</h3>
      <p class="h4-how">고르는 것: 쌓는 방법, 센서의 잡음과 치우침. 보는 것: 10초 동안의 자세 오차(도). 회색은 같은 방법에 완벽한 센서를 쓴 경우입니다.</p>
      <div class="h4-row" role="group" aria-label="몸의 움직임"><label><input type="radio" name="gy-still" value="0" checked> 움직이는 신호 (b24의 신호)</label><label><input type="radio" name="gy-still" value="1"> 몸이 가만히 있을 때</label></div>
      <div class="h4-row" role="group" aria-label="쌓는 방법"><label><input type="radio" name="gy-m" value="inc" checked> 쿼터니언 증분 곱 (다)</label><label><input type="radio" name="gy-m" value="mid"> 주기 가운데 값으로 곱 (라)</label><label><input type="radio" name="gy-m" value="euler"> 오일러 각에 더하기 (가)</label></div>
      <div class="h4-sliders"><label>치우침 (z축) <output data-o="bias"></output> rad/s<input type="range" data-c="bias" min="0" max="0.03" step="0.005" value="0.01"></label>
        <label>잡음 표준편차 <output data-o="sigma"></output> rad/s<input type="range" data-c="sigma" min="0" max="0.04" step="0.005" value="0.02"></label></div>
      <canvas class="h4-plot" tabindex="0" height="300" aria-label="자세 오차 그래프. 화살표 키로 시간을 고르면 그 순간의 오차가 표시됩니다"></canvas>
      <div class="h4-readout" data-r aria-live="polite"></div>
      <p class="small">이 그림은 <code>gyro_data.py</code>·<code>b23_gyro_integrate.py</code>·<code>b24_gyro_drift.py</code>의 계산(100Hz, 10초, 같은 난수열)을 그대로 옮겨 다시 계산한 것입니다. 기본값(움직이는 신호, 증분 곱, 치우침 0.01, 잡음 0.02)에서 b24의 “잡음 + 치우침” 줄과 같은 값이 나옵니다. 실제 센서의 측정이 아닙니다.</p>`;
    const cv = host.querySelector('canvas'), out = host.querySelector('[data-r]');
    const st = { still: 0, method: 'inc', bias: 0.01, sigma: 0.02, t: 10 };
    const sl = k => host.querySelector(`[data-c=${k}]`), ou = k => host.querySelector(`[data-o=${k}]`);
    for (const k of ['bias', 'sigma']) sl(k).addEventListener('input', e => { st[k] = +e.target.value; draw(); });
    host.querySelectorAll('[name=gy-m]').forEach(r => r.addEventListener('change', () => { st.method = r.value; draw(); }));
    host.querySelectorAll('[name=gy-still]').forEach(r => r.addEventListener('change', () => { st.still = +r.value; draw(); }));
    const setT = e => { const r = cv.getBoundingClientRect(); st.t = Math.max(0.01, Math.min(10, (e.clientX - r.left - 50) / (r.width - 62) * 10)); draw(); };
    cv.addEventListener('pointermove', setT); cv.addEventListener('pointerdown', e => { cv.setPointerCapture?.(e.pointerId); setT(e); });
    cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.t = Math.max(0.01, Math.min(10, st.t + (e.key === 'ArrowLeft' ? -0.1 : 0.1))); draw(); e.preventDefault(); } });
    function draw() {
      ou('bias').textContent = f(st.bias, 3); ou('sigma').textContent = f(st.sigma, 3);
      const g = fit(cv); if (!g) return; const { c, w, h } = g;
      const mine = errors({ method: st.method, bias: st.bias, sigma: st.sigma, noise, still: !!st.still });
      const ideal = errors({ method: st.method, bias: 0, sigma: 0, noise, still: !!st.still });
      const top = Math.max(1, ...mine, ...ideal), ymax = top <= 1 ? 1 : top <= 6 ? Math.ceil(top) : Math.ceil(top / 20) * 20;
      const m = { L: 50, R: 12, T: 14, B: 28 }, step = ymax <= 6 ? 1 : ymax / 5, yt = []; for (let v = 0; v <= ymax + 1e-9; v += step) yt.push(v);
      const { X, Y } = frame(g, m, [0, 10], [0, ymax], [0, 2, 4, 6, 8, 10], yt, v => v + 's', v => f(v, 0) + '°');
      const line = (arr, col, wd) => { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); arr.forEach((v, k) => { const x = X((k + 1) * DT), y = Y(Math.min(v, ymax)); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
      line(ideal, '#9aa5a1', 2); line(mine, '#b9461d', 2.5);
      const x = X(st.t); c.strokeStyle = '#286e99'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, m.T); c.lineTo(x, h - m.B); c.stroke();
      const k = Math.round(st.t / DT) - 1; c.fillStyle = '#b9461d'; c.beginPath(); c.arc(x, Y(Math.min(mine[k], ymax)), 5, 0, 7); c.fill();
      const row = e => [1, 2, 5, 10].map(s => `${s}초 ${f(at(e, s), 2)}°`).join(', ');
      out.innerHTML = `<div>내 설정(주황): <b>${row(mine)}</b></div><div>완벽한 센서(회색): ${row(ideal)}</div><div>${f(st.t, 2)}초 순간: 주황 <b>${f(mine[k], 3)}°</b> · 회색 ${f(ideal[k], 3)}°</div>
        <div class="h4-verdict">${st.still ? '몸은 가만히 있는데 치우침만큼 쌓여 가는 오차를 보세요(치우침 0.01 rad/s × 10초 = 0.1 rad ≈ 5.73°).' : '회색 곡선이 이미 0이 아니면 그것은 센서 탓이 아니라 쌓는 방법의 오차입니다.'}</div>`;
    }
    root.addEventListener('resize', draw);
    draw();
  }
  if (noise) document.querySelectorAll('[data-gyro-demo]').forEach(init);
})(typeof window !== 'undefined' ? window : globalThis);
