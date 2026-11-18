/* One idea: a motor does not jump to the commanded speed; it follows it with a delay set by the time constant tau.
   The two loops below are line-for-line the ones in vol3/01-what-is-a-robot/b09_motor.py (1 ms Euler steps), so the default
   sliders (tau 0.05, kp 8) reproduce that file's printed numbers. Illustration of the model, not a measurement of a real motor.
   Numbers are checked against the real script in verify_h04b_day1.py. */
(function (root) {
  'use strict';
  const DT = 0.001;
  function dc(tau, cmd = 10, steps = 600) {                 // b09 lines 6-12
    let v = 0; const rec = [];
    for (let i = 0; i < steps; i++) { v += (cmd - v) * DT / tau; rec.push(v); }
    const first = r => { const k = rec.findIndex(x => x >= r * cmd); return k < 0 ? null : (k + 1) * DT; };
    return { rec, t63: first(0.63), t95: first(0.95), cmd };
  }
  function servo(tau, kp = 8, target = 90, steps = 600) {   // b09 lines 17-23
    let ang = 0, v = 0; const rec = [];
    for (let i = 0; i < steps; i++) {
      const cmd = Math.max(-360, Math.min(360, kp * (target - ang)));
      v += (cmd - v) * DT / tau; ang += v * DT; rec.push(ang);
    }
    let pk = 0; rec.forEach((a, i) => { if (a > rec[pk]) pk = i; });
    return { rec, target, peak: rec[pk], peakT: (pk + 1) * DT, at: s => rec[Math.round(s / DT) - 1] };
  }
  const math = { dc, servo };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.MotorLagMath = math;
  const { make, f, fit, frame } = root.H4;
  function init(host) {
    host.classList.add('h4-demo');
    host.innerHTML = `<h3>직접 돌려 보기: 모터는 명령을 따라가는 데 시간이 걸립니다</h3>
      <p class="h4-how">고르는 것: 모터 종류, 시간 상수 τ(작을수록 빨리 따라옴). 보는 것: 명령(점선)과 실제(파란 선)의 간격.</p>
      <div class="h4-row" role="group" aria-label="모터 종류"><label><input type="radio" name="ml-mode" value="dc" checked> DC 모터 (명령 속도 10 rad/s)</label>
        <label><input type="radio" name="ml-mode" value="servo"> 서보 (목표 90°, 남은 각도에 비례하는 제어)</label></div>
      <div class="h4-sliders"><label>시간 상수 τ <output data-o="tau"></output> 초<input type="range" data-c="tau" min="0.02" max="0.2" step="0.01" value="0.05"></label>
        <label class="h4-kp">서보 이득 kp <output data-o="kp"></output><input type="range" data-c="kp" min="2" max="16" step="1" value="8"></label></div>
      <canvas class="h4-plot" tabindex="0" height="300" aria-label="모터 응답 그래프. 화살표 키나 마우스로 시간을 고르면 그 순간의 값이 아래에 표시됩니다"></canvas>
      <div class="h4-readout" data-r aria-live="polite"></div>
      <p class="small">이 조작판은 <code>b09_motor.py</code>의 두 반복문(0.001초 걸음)을 그대로 옮긴 그림입니다. 실제 모터의 측정이 아니라 그 모형의 계산입니다. 기본값(τ=0.05, kp=8)에서 파일의 출력과 같은 값이 나옵니다.</p>`;
    const cv = host.querySelector('canvas'), out = host.querySelector('[data-r]');
    const st = { mode: 'dc', tau: 0.05, kp: 8, t: 0.15 };
    const sl = k => host.querySelector(`[data-c=${k}]`), ou = k => host.querySelector(`[data-o=${k}]`);
    host.querySelectorAll('[name=ml-mode]').forEach(r => r.addEventListener('change', () => { st.mode = r.value; draw(); }));
    sl('tau').addEventListener('input', e => { st.tau = +e.target.value; draw(); });
    sl('kp').addEventListener('input', e => { st.kp = +e.target.value; draw(); });
    const setT = e => { const r = cv.getBoundingClientRect(); st.t = Math.max(0.001, Math.min(0.6, (e.clientX - r.left - 50) / (r.width - 62) * 0.6)); draw(); };
    cv.addEventListener('pointermove', setT); cv.addEventListener('pointerdown', e => { cv.setPointerCapture?.(e.pointerId); setT(e); });
    cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.t = Math.max(0.001, Math.min(0.6, st.t + (e.key === 'ArrowLeft' ? -0.01 : 0.01))); draw(); e.preventDefault(); } });
    function draw() {
      ou('tau').textContent = f(st.tau, 2); ou('kp').textContent = st.kp;
      host.querySelector('.h4-kp').style.display = st.mode === 'servo' ? '' : 'none';
      const g = fit(cv); if (!g) return; const { c, w, h } = g;
      const isDc = st.mode === 'dc', ymax = isDc ? 10 : 110, tgt = isDc ? 10 : 90;
      const m = { L: 50, R: 12, T: 24, B: 28 };
      const run = isDc ? dc(st.tau) : servo(st.tau, st.kp), rec = run.rec;
      const { X, Y } = frame(g, m, [0, 0.6], [0, ymax], [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6], isDc ? [0, 2.5, 5, 7.5, 10] : [0, 30, 60, 90], v => f(v, 1) + 's', v => v + (isDc ? '' : '°'));
      c.setLineDash([6, 4]); c.strokeStyle = '#777'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(m.L, Y(tgt)); c.lineTo(w - m.R, Y(tgt)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#555'; c.textAlign = 'left'; c.fillText(isDc ? '명령 10 rad/s' : '목표 90°', m.L + 6, Y(tgt) - 6);
      if (isDc) for (const [r, t, col] of [[0.63, run.t63, '#c66b16'], [0.95, run.t95, '#8a3d00']]) {
        c.strokeStyle = col; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(m.L, Y(r * 10)); c.lineTo(w - m.R, Y(r * 10)); c.stroke(); c.setLineDash([]);
        c.fillStyle = col; c.textAlign = 'right'; c.fillText(Math.round(r * 100) + '%', w - m.R - 2, Y(r * 10) - 4);
        if (t) { c.beginPath(); c.arc(X(t), Y(r * 10), 5, 0, 7); c.fill(); }
      }
      c.strokeStyle = '#286e99'; c.lineWidth = 2.5; c.beginPath(); rec.forEach((v, i) => { const x = X((i + 1) * DT), y = Y(Math.min(v, ymax)); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      const k = Math.round(st.t / DT) - 1; c.strokeStyle = '#d33'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(X(st.t), m.T); c.lineTo(X(st.t), h - m.B); c.stroke();
      c.fillStyle = '#d33'; c.beginPath(); c.arc(X(st.t), Y(Math.min(rec[k], ymax)), 5, 0, 7); c.fill();
      const unit = isDc ? ' rad/s' : '°';
      out.innerHTML = isDc
        ? `<div>명령의 63%에 닿기까지 <b>${run.t63 === null ? '0.6초 안에 못 닿음' : f(run.t63, 3) + ' 초'}</b> (τ와 같음) · 95%까지 <b>${run.t95 === null ? '0.6초 안에 못 닿음' : f(run.t95, 3) + ' 초'}</b> (약 3τ)</div><div>${f(st.t, 3)}초 순간의 실제 속도: <b>${f(rec[k], 2)}${unit}</b> (명령의 ${f(rec[k] / 10 * 100, 0)}%)</div>`
        : `<div>0.5초의 각도 <b>${f(run.at(0.5), 2)}°</b> · 가장 높이 올라간 각도 <b>${f(run.peak, 2)}°</b> (${f(run.peakT, 3)}초) → 목표를 <b>${f(Math.max(run.peak - 90, 0), 2)}°</b> 지나침</div><div>${f(st.t, 3)}초 순간의 각도: <b>${f(rec[k], 2)}${unit}</b></div>`;
    }
    root.addEventListener('resize', draw);
    draw();
  }
  document.querySelectorAll('[data-motor-lag-demo]').forEach(init);
})(typeof window !== 'undefined' ? window : globalThis);
