/* One idea: how much a loop corrects per beat (K x period) and how old its measurement is decide whether it settles, overshoots or shakes.
   The model is exactly the one in vol3/01-what-is-a-robot/b13_period.py (delay 0) and b14_delay.py (measurement delay), a 1-D point robot with
   no speed limit and no motor lag. Illustration of that model, not the simulator. Numbers are checked in verify_h04b_day1.py. */
(function (root) {
  'use strict';
  function sim(K, dt, delay, horizon) {
    const steps = Math.round(horizon / dt), lag = Math.round(delay / dt), rec = [0];
    for (let i = 0; i < steps; i++) {
      const meas = rec[Math.max(rec.length - 1 - lag, 0)];
      rec.push(rec[rec.length - 1] + K * (1 - meas) * dt);
    }
    const mx = Math.max(...rec), n = Math.round(1 / dt) , tail = rec.slice(-Math.max(n, 2));
    return { rec, overshoot: Math.max(mx - 1, 0), endErr: Math.abs(1 - rec[rec.length - 1]), swing: Math.max(...tail) - Math.min(...tail), ratio: K * dt, lagSteps: lag };
  }
  function verdict(ratio, lagSteps) {
    if (lagSteps > 0) return '측정이 늦으면 KΔt만으로는 판단할 수 없습니다. 그래프로 직접 확인하세요.';
    if (ratio <= 1) return '0 < KΔt ≤ 1: 오차에 0 이상 1 미만을 곱하므로 지나침 없이 다가갑니다.';
    if (ratio < 2) return '1 < KΔt < 2: 오차의 부호가 바뀌며(지나쳤다 돌아옴) 크기는 줄어듭니다.';
    if (Math.abs(ratio - 2) < 1e-9) return 'KΔt = 2: 오차 크기가 줄지 않는 진동입니다.';
    return 'KΔt > 2: 한 번 고칠 때마다 오차가 커집니다(발산).';
  }
  const math = { sim, verdict };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.ControlPeriodMath = math;
  const { make, f, fit, frame } = root.H4;
  const PRESETS = [['b13 기본 (이득 4, 주기 0.4)', 4, 0.4, 0, 4], ['이득만 2로 (이득 2, 주기 0.6)', 2, 0.6, 0, 4], ['경계 KΔt=2 (이득 4, 주기 0.5)', 4, 0.5, 0, 4],
    ['b14 지연 0.2초 (주기 0.02)', 4, 0.02, 0.2, 6], ['b14 지연 0.4초 (주기 0.02)', 4, 0.02, 0.4, 6]];
  function init(host) {
    host.classList.add('h4-demo');
    host.innerHTML = `<h3>직접 돌려 보기: 한 번에 고치는 정도와 측정의 나이</h3>
      <p class="h4-how">슬라이더 하나만 움직이세요. 점은 한 번 판단한 순간의 위치, 회색 점선이 목표 1m입니다.</p>
      <div class="h4-row" data-presets role="group" aria-label="바로 가기"></div>
      <div class="h4-sliders">
        <label>비례 이득 K <output data-o="K"></output> (1/초)<input type="range" data-c="K" min="0.5" max="8" step="0.5" value="4"></label>
        <label>판단 주기 Δt <output data-o="dt"></output> 초<input type="range" data-c="dt" min="0.02" max="0.8" step="0.02" value="0.4"></label>
        <label>측정이 늦는 시간 <output data-o="delay"></output> 초<input type="range" data-c="delay" min="0" max="0.4" step="0.1" value="0"></label></div>
      <div class="h4-row" role="group" aria-label="보는 시간 길이"><label><input type="radio" name="cp-h" value="4" checked> 4초까지 (b13 방식)</label><label><input type="radio" name="cp-h" value="6"> 6초까지 (b14 방식)</label></div>
      <canvas class="h4-plot" tabindex="0" height="300" aria-label="위치와 시간 그래프. 화살표 키로 시간 칸을 고르면 그 판단 순간의 위치가 아래에 표시됩니다"></canvas>
      <div class="h4-readout" data-r aria-live="polite"></div>
      <p class="small">이 그림은 <code>b13_period.py</code>(지연 없음, 4초)와 <code>b14_delay.py</code>(주기 0.02초, 측정 지연, 6초)와 같은 식을 옮긴 계산입니다. 속도 제한·모터 지연은 넣지 않았으니 실제 로봇의 안전한 이득을 정하는 데 쓰지 마세요.</p>`;
    const cv = host.querySelector('canvas'), out = host.querySelector('[data-r]');
    const st = { K: 4, dt: 0.4, delay: 0, horizon: 4, i: 3 };
    const sl = k => host.querySelector(`[data-c=${k}]`), ou = k => host.querySelector(`[data-o=${k}]`);
    for (const k of ['K', 'dt', 'delay']) sl(k).addEventListener('input', e => { st[k] = +e.target.value; draw(); });
    host.querySelectorAll('[name=cp-h]').forEach(r => r.addEventListener('change', () => { st.horizon = +r.value; draw(); }));
    const bar = host.querySelector('[data-presets]');
    for (const [label, K, dt, delay, hz] of PRESETS) { const b = make('button', label); b.type = 'button'; b.addEventListener('click', () => { Object.assign(st, { K, dt, delay, horizon: hz }); host.querySelector(`[name=cp-h][value="${hz}"]`).checked = true; for (const k of ['K', 'dt', 'delay']) sl(k).value = st[k]; draw(); }); bar.append(b); }
    const setI = e => { const r = cv.getBoundingClientRect(), s = sim(st.K, st.dt, st.delay, st.horizon); st.i = Math.max(0, Math.min(s.rec.length - 1, Math.round((e.clientX - r.left - 50) / (r.width - 62) * st.horizon / st.dt))); draw(); };
    cv.addEventListener('pointermove', setI); cv.addEventListener('pointerdown', e => { cv.setPointerCapture?.(e.pointerId); setI(e); });
    cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.i = Math.max(0, st.i + (e.key === 'ArrowLeft' ? -1 : 1)); draw(); e.preventDefault(); } });
    function draw() {
      ou('K').textContent = f(st.K, 1); ou('dt').textContent = f(st.dt, 2); ou('delay').textContent = f(st.delay, 1);
      const g = fit(cv); if (!g) return; const { c, w, h } = g, s = sim(st.K, st.dt, st.delay, st.horizon);
      st.i = Math.min(st.i, s.rec.length - 1);
      const m = { L: 50, R: 12, T: 14, B: 28 }, YR = [-1.5, 3.5];
      const xt = []; for (let t = 0; t <= st.horizon; t++) xt.push(t);
      const { X, Y } = frame(g, m, [0, st.horizon], YR, xt, [-1, 0, 1, 2, 3], v => v + 's', v => v + 'm');
      c.setLineDash([6, 4]); c.strokeStyle = '#777'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(m.L, Y(1)); c.lineTo(w - m.R, Y(1)); c.stroke(); c.setLineDash([]);
      const cl = v => Math.max(YR[0], Math.min(YR[1], v));
      c.strokeStyle = '#286e99'; c.lineWidth = 2; c.beginPath(); s.rec.forEach((v, k) => { const x = X(k * st.dt), y = Y(cl(v)); k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke();
      if (st.dt >= 0.1) { c.fillStyle = '#286e99'; s.rec.forEach((v, k) => { c.beginPath(); c.arc(X(k * st.dt), Y(cl(v)), 3.5, 0, 7); c.fill(); }); }
      const x = X(st.i * st.dt); c.strokeStyle = '#d33'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, m.T); c.lineTo(x, h - m.B); c.stroke();
      const big = v => Math.abs(v) > 99 ? '화면 밖(' + v.toExponential(1) + ')' : f(v, 3) + ' m';
      out.innerHTML = `<div>KΔt = <b>${f(s.ratio, 2)}</b>${s.lagSteps ? '' : ' → 오차에 곱하는 수 (1−KΔt) = <b>' + f(1 - s.ratio, 2) + '</b>'}</div>
        <div>최대 지나침 <b>${big(s.overshoot)}</b> · 끝 오차 <b>${big(s.endErr)}</b> · 마지막 1초 흔들림 폭 <b>${big(s.swing)}</b></div>
        <div>${st.i}번째 판단(${f(st.i * st.dt, 2)}초)의 위치: <b>${big(s.rec[st.i])}</b></div><div class="h4-verdict">${verdict(s.ratio, s.lagSteps)}</div>`;
    }
    root.addEventListener('resize', draw);
    draw();
  }
  document.querySelectorAll('[data-control-period-demo]').forEach(init);
})(typeof window !== 'undefined' ? window : globalThis);
