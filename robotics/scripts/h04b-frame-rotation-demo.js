/* One idea: the cup does not move when the robot turns; only the ruler (the robot's axes) turns, so the numbers change.
   Same scene as vol3/02-frames-rotations/b01_two_frames.py and b18_homogeneous.py: cup (2, 1) m in the room, robot origin (1.5, 0) m.
   robot-frame numbers = R(yaw)^T (cup - origin). Illustration of the arithmetic; numbers are checked in verify_h04b_day1.py. */
(function (root) {
  'use strict';
  const CUP = [2, 1], ORIGIN = [1.5, 0];
  function cupInRobot(yawDeg, cup = CUP, origin = ORIGIN) {
    const a = yawDeg * Math.PI / 180, dx = cup[0] - origin[0], dy = cup[1] - origin[1];
    return { dx, dy, a: dx * Math.cos(a) + dy * Math.sin(a), b: -dx * Math.sin(a) + dy * Math.cos(a) };
  }
  const geom = (w, h) => { const S = Math.min(w / 3.3, h / 2.2), ox = (w - 3.3 * S) / 2 + 0.3 * S, oy = h - (h - 2.2 * S) / 2 - 0.5 * S; return { S, ox, oy }; };
  const math = { cupInRobot, geom };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.FrameRotationMath = math;
  const { f, fit } = root.H4;
  function arrow(c, x0, y0, x1, y1, col, wd) {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 11 * Math.cos(a - 0.4), y1 - 11 * Math.sin(a - 0.4)); c.lineTo(x1 - 11 * Math.cos(a + 0.4), y1 - 11 * Math.sin(a + 0.4)); c.closePath(); c.fill();
  }
  function init(host) {
    host.classList.add('h4-demo');
    host.innerHTML = `<h3>직접 돌려 보기: 컵은 그대로, 눈금자만 돌립니다</h3>
      <p class="h4-how">로봇의 방향(요)을 슬라이더로 돌리거나 그림에서 로봇 둘레를 끌어 보세요. 주황 컵은 한 번도 움직이지 않습니다.</p>
      <div class="h4-row" data-presets role="group" aria-label="로봇 방향 바로 가기"></div>
      <div class="h4-sliders"><label>로봇이 보는 방향(요) <output data-o="yaw"></output> °<input type="range" data-c="yaw" min="-180" max="180" step="5" value="0"></label></div>
      <div class="h4-two"><canvas class="h4-room" tabindex="0" height="340" aria-label="방을 위에서 본 그림. 검은 축은 방, 빨강과 초록 축은 로봇, 주황 원은 컵"></canvas><div class="h4-readout" data-r aria-live="polite"></div></div>
      <p class="small">그림은 방을 위에서 내려다본 것입니다. 로봇의 빨강은 앞(x), 초록은 왼쪽(y)입니다. 점선 화살표 둘이 컵까지의 벡터를 로봇의 눈금자로 읽은 두 성분(앞 a, 왼쪽 b)입니다. 계산은 <code>b18_homogeneous.py --yaw</code>와 같은 식이며 시뮬레이터가 아니라 산수 그림입니다.</p>`;
    const cv = host.querySelector('canvas'), out = host.querySelector('[data-r]'), st = { yaw: 0 };
    const sl = host.querySelector('[data-c=yaw]'), ou = host.querySelector('[data-o=yaw]');
    sl.addEventListener('input', () => { st.yaw = +sl.value; draw(); });
    const bar = host.querySelector('[data-presets]');
    for (const y of [0, 90, 180, -90]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = '요 ' + y + '°'; b.addEventListener('click', () => { st.yaw = y; sl.value = y; draw(); }); bar.append(b); }
    const view = () => { const r = cv.getBoundingClientRect(); return { r, ...geom(r.width, r.height) }; };
    const drag = e => { const v = view(), px = (e.clientX - v.r.left - v.ox) / v.S + 0, py = -(e.clientY - v.r.top - v.oy) / v.S; const ang = Math.atan2(py - ORIGIN[1], px - ORIGIN[0]) * 180 / Math.PI; st.yaw = Math.max(-180, Math.min(180, Math.round(ang))); sl.value = Math.round(st.yaw / 5) * 5; draw(); };
    let down = false; cv.addEventListener('pointerdown', e => { down = true; cv.setPointerCapture?.(e.pointerId); drag(e); }); cv.addEventListener('pointermove', e => { if (down) drag(e); }); cv.addEventListener('pointerup', () => { down = false; });
    cv.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { st.yaw = Math.max(-180, Math.min(180, st.yaw + (e.key === 'ArrowLeft' ? -5 : 5))); sl.value = st.yaw; draw(); e.preventDefault(); } });
    function draw() {
      ou.textContent = st.yaw;
      const g = fit(cv); if (!g) return; const { c, w, h } = g, { S, ox, oy } = geom(w, h);
      const P = (x, y) => [ox + S * x, oy - S * y];
      c.strokeStyle = '#e0e8e5'; c.lineWidth = 1; c.font = '12px sans-serif'; c.fillStyle = '#789';
      for (let x = -0.5; x <= 3; x += 0.5) { const [a, b] = P(x, -0.5), [a2, b2] = P(x, 1.7); c.beginPath(); c.moveTo(a, b); c.lineTo(a2, b2); c.stroke(); }
      for (let y = -0.5; y <= 1.5; y += 0.5) { const [a, b] = P(-0.3, y), [a2, b2] = P(3, y); c.beginPath(); c.moveTo(a, b); c.lineTo(a2, b2); c.stroke(); }
      let [x0, y0] = P(0, 0); arrow(c, x0, y0, ...P(0.5, 0), '#222', 2.5); arrow(c, x0, y0, ...P(0, 0.5), '#222', 2.5);
      c.fillStyle = '#222'; c.fillText('방 x', ...P(0.28, -0.12)); c.fillText('방 y', ...P(0.05, 0.62)); c.fillText('방 원점', ...P(-0.28, -0.12));
      const a = st.yaw * Math.PI / 180, ex = [Math.cos(a), Math.sin(a)], ey = [-Math.sin(a), Math.cos(a)], o = ORIGIN, r = cupInRobot(st.yaw);
      c.setLineDash([5, 4]); c.strokeStyle = '#b8c'; c.lineWidth = 1.5;
      const A = [o[0] + r.a * ex[0], o[1] + r.a * ex[1]];
      c.beginPath(); c.moveTo(...P(...o)); c.lineTo(...P(...A)); c.stroke(); c.beginPath(); c.moveTo(...P(...A)); c.lineTo(...P(...CUP)); c.stroke(); c.setLineDash([]);
      arrow(c, ...P(...o), ...P(o[0] + 0.7 * ex[0], o[1] + 0.7 * ex[1]), '#d33', 3); arrow(c, ...P(...o), ...P(o[0] + 0.7 * ey[0], o[1] + 0.7 * ey[1]), '#2a9d4a', 3);
      c.fillStyle = '#d33'; c.fillText('로봇 앞 x', ...P(o[0] + 0.78 * ex[0] - 0.1, o[1] + 0.78 * ex[1] + 0.05)); c.fillStyle = '#2a9d4a'; c.fillText('로봇 왼쪽 y', ...P(o[0] + 0.78 * ey[0] - 0.1, o[1] + 0.78 * ey[1] + 0.05));
      c.fillStyle = '#e8821a'; c.strokeStyle = '#8a4a00'; c.lineWidth = 2; c.beginPath(); c.arc(...P(...CUP), 9, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#6a3a00'; c.fillText('컵 (방 기준 2, 1)', P(CUP[0], CUP[1])[0] + 12, P(CUP[0], CUP[1])[1] - 10);
      c.fillStyle = '#111'; c.beginPath(); c.arc(...P(...o), 5, 0, 7); c.fill();
      out.innerHTML = `<div>컵(방 기준) = <b>(2, 1)</b> m, 늘 같음</div><div>로봇 원점을 뺀 값(아직 방의 눈금자) = <b>(${f(r.dx, 2)}, ${f(r.dy, 2)})</b></div>
        <div class="h4-big">로봇 기준 컵 = <b>(${f(r.a, 3)}, ${f(r.b, 3)})</b> m</div><div>= 앞 ${f(r.a, 3)}, 왼쪽 ${f(r.b, 3)} (음수는 반대쪽)</div>
        <div>로봇 앞 방향(방 기준) = (${f(ex[0], 3)}, ${f(ex[1], 3)})<br>로봇 왼쪽 방향(방 기준) = (${f(ey[0], 3)}, ${f(ey[1], 3)})</div>`;
    }
    root.addEventListener('resize', draw);
    draw();
  }
  document.querySelectorAll('[data-frame-rotation-demo]').forEach(init);
})(typeof window !== 'undefined' ? window : globalThis);
