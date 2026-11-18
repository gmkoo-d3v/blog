/* One idea: the two gains of a hand-written loop do different jobs. kp is the spring (how hard it pulls toward the target),
   kd is the brake (how hard it holds back a fast-moving joint). Every curve below is a real MuJoCo 3.17.0 run of the v02 scene
   (control-loop-data.js); this widget only picks which stored run to draw. Numbers are checked in verify_d3_batch2.py. */
(function (root) {
  'use strict';
  const G = 9.81, M = 1, R = 0.5;                          // ball 1 kg on a 0.5 m rod
  const f1 = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  const key = (kp, kd) => kp + '|' + kd;
  const weightTorque = deg => M * G * R * Math.cos(deg * Math.PI / 180);   // torque that gravity puts on the shoulder
  function lookup(data, kp, kd) { return data.runs[key(kp, kd)]; }
  function angleAt(run, dt, t) { const x = Math.max(0, Math.min(run.deg.length - 1, t / dt)), i = Math.min(run.deg.length - 2, Math.floor(x)); return run.deg[i] + (run.deg[i + 1] - run.deg[i]) * (x - i); }
  const I_ARM = 0.2506;                                         // joint inertia of the v02 arm (kg m^2), read back from MuJoCo: kv = 2*dampratio*sqrt(kp*I)
  const kdOfDamp = (kp, dr) => 2 * dr * Math.sqrt(kp * I_ARM), dampOfKd = (kp, kd) => kd / (2 * Math.sqrt(kp * I_ARM));
  const math = { weightTorque, lookup, angleAt, key, kdOfDamp, dampOfKd, I_ARM };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.ControlLoopMath = math;
  const data = root.ControlLoopData;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const PRESETS = [['처음 예제 (40, 4)', 40, 4], ['브레이크 없음 (40, 0)', 40, 0], ['용수철이 너무 약함 (5, 4)', 5, 4], ['세게 + 브레이크 (160, 8)', 160, 8], ['브레이크가 너무 셈 (40, 16)', 40, 16]];
  function init(host) {
    host.classList.add('b2-demo');
    host.innerHTML = `<h3>직접 돌려 보기: kp와 kd를 하나씩 바꿔 보세요</h3>
      <p class="b2-how">슬라이더 하나만 움직이고 그래프가 어떻게 달라지는지 보세요. 파란 곡선이 팔의 각도, 점선이 목표 60°입니다.</p>
      <div class="b2-presets" role="group" aria-label="바로 가기"></div>
      <div class="b2-sliders"><label>kp (용수철) <output data-out="kp"></output><input type="range" data-ctl="kp" min="0" max="${data.kps.length - 1}" step="1" aria-label="kp"></label>
      <label>kd (브레이크) <output data-out="kd"></output><input type="range" data-ctl="kd" min="0" max="${data.kds.length - 1}" step="1" aria-label="kd"></label></div>
      <figure class="b2-plotbox"><canvas class="b2-plot" tabindex="0" height="300" aria-label="팔 각도의 시간 그래프. 화살표 키나 마우스 이동으로 시간을 고르면 그 순간의 각도가 아래에 나옵니다"></canvas><figcaption>가로는 시간(초), 세로는 각도(도). 그래프 위에서 마우스를 움직이거나 ← → 키를 누르면 그 시각의 값을 읽습니다.</figcaption></figure>
      <div class="b2-readout" data-readout aria-live="polite"></div>
      <p class="small">이 그래프는 앞에서 실제로 돌린 MuJoCo 3.17.0 기록을 그대로 그린 것입니다(kp 7가지 × kd 6가지 = 42번 실행, 0.002초 걸음, 매 0.01초 값). 슬라이더 칸 사이의 값은 돌려 보지 않았으므로 칸 위에서만 움직입니다. 이 그림이 MuJoCo 자체는 아닙니다.</p>`;
    const st = { i: data.kps.indexOf(40), j: data.kds.indexOf(4), t: 2.0 };
    const plot = host.querySelector('.b2-plot'), ctx = plot.getContext('2d'), out = host.querySelector('[data-readout]');
    const sl = { kp: host.querySelector('[data-ctl=kp]'), kd: host.querySelector('[data-ctl=kd]') };
    const ol = { kp: host.querySelector('[data-out=kp]'), kd: host.querySelector('[data-out=kd]') };
    const bar = host.querySelector('.b2-presets');
    for (const [label, kp, kd] of PRESETS) { const b = make('button', label); b.type = 'button'; b.addEventListener('click', () => { st.i = data.kps.indexOf(kp); st.j = data.kds.indexOf(kd); draw(); }); bar.append(b); }
    sl.kp.addEventListener('input', () => { st.i = +sl.kp.value; draw(); });
    sl.kd.addEventListener('input', () => { st.j = +sl.kd.value; draw(); });
    function setT(e) { const r = plot.getBoundingClientRect(), L = 46, Rr = 12; st.t = Math.max(0, Math.min(data.T, (e.clientX - r.left - L) / (r.width - L - Rr) * data.T)); draw(); }
    plot.addEventListener('pointermove', setT); plot.addEventListener('pointerdown', e => { plot.setPointerCapture?.(e.pointerId); setT(e); });
    plot.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.t = Math.max(0, Math.min(data.T, st.t + (e.key === 'ArrowLeft' ? -0.05 : 0.05))); draw(); e.preventDefault(); } });
    function draw() {
      const kp = data.kps[st.i], kd = data.kds[st.j], run = lookup(data, kp, kd);
      sl.kp.value = st.i; sl.kd.value = st.j; ol.kp.textContent = kp; ol.kd.textContent = kd;
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = plot.clientWidth, h = plot.clientHeight;
      if (!w || !h) return;
      if (plot.width !== Math.round(w * dpr)) { plot.width = Math.round(w * dpr); plot.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const L = 46, Rr = 12, Tp = 12, B = 28, YMIN = -10, YMAX = 130, X = t => L + (w - L - Rr) * t / data.T, Y = a => Tp + (h - Tp - B) * (YMAX - a) / (YMAX - YMIN);
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#444'; ctx.strokeStyle = '#d3dedb'; ctx.lineWidth = 1;
      for (const a of [0, 30, 60, 90, 120]) { ctx.beginPath(); ctx.moveTo(L, Y(a)); ctx.lineTo(w - Rr, Y(a)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(a + '°', L - 6, Y(a) + 4); }
      ctx.textAlign = 'center'; for (let t = 0; t <= data.T; t++) ctx.fillText(t + ' s', X(t), h - 8);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = '#777'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L, Y(60)); ctx.lineTo(w - Rr, Y(60)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#555'; ctx.textAlign = 'left'; ctx.fillText('목표 60°', L + 6, Y(60) - 6);
      ctx.strokeStyle = '#286e99'; ctx.lineWidth = 2.5; ctx.beginPath();
      run.deg.forEach((a, k) => { const x = X(k * data.dt), y = Y(Math.max(YMIN, Math.min(YMAX, a))); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      const a = angleAt(run, data.dt, st.t);
      ctx.strokeStyle = '#d33'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(st.t), Tp); ctx.lineTo(X(st.t), h - B); ctx.stroke();
      ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(X(st.t), Y(Math.max(YMIN, Math.min(YMAX, a))), 5, 0, 7); ctx.fill();
      const settle = run.settle === null ? '자리를 못 잡음 (계속 흔들리거나 너무 느림)' : f1(run.settle, 2) + ' s';
      const fin = run.final === null ? '정해지지 않음 (브레이크가 없어 계속 오르내림)' : f1(run.final, 1) + '° (처짐 ' + f1(60 - run.final, 1) + '°)';
      const matched = run.final !== null && run.settle !== null && run.settle < 2;
      const gravity = matched ? ` · 2초 뒤 명령 ${f1(run.tq2, 2)} N·m ≈ 추의 무게 토크 9.81×0.5×cos(${f1(run.a2, 1)}°) = ${f1(weightTorque(run.a2), 2)} N·m` : '';
      out.innerHTML = `<div class="b2-grid">
        <div><span>표시 시각 ${f1(st.t, 2)} s</span><b>각도 ${f1(a, 1)}°</b></div>
        <div><span>첫 걸음 토크 = kp × 60°</span><b>${f1(run.tq0, 1)} N·m</b></div>
        <div><span>가장 높이 간 각도</span><b>${f1(run.peak, 1)}°</b></div>
        <div><span>목표 60°를 넘은 양 (overshoot)</span><b>${f1(run.over, 1)}°</b></div>
        <div><span>자리 잡는 시간 (끝값 ±1° 안에 들어와 머묾)</span><b>${settle}</b></div>
        <div><span>2초 뒤 각도 / 끝에 멈춘 각도</span><b>${f1(run.a2, 1)}° / ${fin}</b></div></div>
        <p class="b2-sub" data-damp><b>dampratio 다이얼로 읽기:</b> 이 kd=${kd}는 dampratio ≈ <b>${f1(dampOfKd(kp, kd), 2)}</b>입니다(이 팔의 관성 I=0.2506 kg·m², kv = 2 × dampratio × √(kp × I)). 같은 kp=${kp}에서 dampratio=1이 되는 kd는 ${f1(kdOfDamp(kp, 1), 2)}입니다. 1보다 작으면 흔들리고, 1보다 크면 느립니다.</p>
        <p class="b2-sub">같은 일을 <code>&lt;position kp="${kp}" kv="${kd}"/&gt;</code> 액추에이터에 맡긴 곡선과의 최대 차이: ${run.diff.toExponential(1)}°${gravity}</p>`;
    }
    new ResizeObserver(draw).observe(plot); draw();
  }
  document.querySelectorAll('[data-control-loop-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '그래프를 그릴 수 없습니다.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
