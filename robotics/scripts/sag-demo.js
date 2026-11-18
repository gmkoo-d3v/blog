/* One idea: a position actuator holds an arm up only by sagging until spring torque = gravity torque; sag shrinks as kp grows,
   and a torque limit below the gravity torque lets the arm fall. Poses are the resting angles of real MuJoCo 3.17.0 runs of the
   two-link arm in v04_joint_vs_actuator.py (sag-data.js). three.js only draws them; the widget never simulates. */
(function (root) {
  'use strict';
  const f = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
  const rad = d => d * Math.PI / 180;
  // joint angles in degrees (axis 0 -1 0: positive = rising) -> world x,z of elbow, forearm end, ball centre
  function armPoints(sDeg, eDeg, pivotZ = 0.85, l1 = 0.3, l2 = 0.25) {
    const a = rad(sDeg), b = rad(sDeg + eDeg);
    const elbow = [l1 * Math.cos(a), pivotZ + l1 * Math.sin(a)];
    return { elbow, ball: [elbow[0] + l2 * Math.cos(b), elbow[1] + l2 * Math.sin(b)] };
  }
  function runKey(kpIndex, frcIndex) { return kpIndex === 0 ? 'none' : root.SagData.kps[kpIndex - 1] + '|' + frcIndex; }
  const math = { armPoints, rad };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.SagMath = math;
  const data = root.SagData, T = root.RobotThree.THREE, OrbitControls = root.RobotThree.OrbitControls;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  function init(host) {
    host.classList.add('b2-demo');
    host.innerHTML = `<h3>직접 돌려 보기: kp를 키우면 처짐이 얼마나 줄까</h3>
      <p class="b2-how">kp 슬라이더를 움직이세요. 목표는 늘 수평(0°)입니다. 회색 점선 팔이 목표, 색칠한 팔이 실제로 멈춘 모습입니다. 드래그하면 시점이 돌아갑니다.</p>
      <div class="b2-sliders"><label>어깨 kp (팔꿈치는 절반) <output data-out="kp"></output><input type="range" data-ctl="kp" min="0" max="${data.kps.length}" step="1" aria-label="어깨 kp"></label>
      <label>어깨 토크 한계 forcerange <output data-out="frc"></output><input type="range" data-ctl="frc" min="0" max="${data.frcs.length - 1}" step="1" aria-label="어깨 토크 한계"></label></div>
      <div class="b2-two"><div class="b2-canvas" aria-label="3D 장면: 기둥 위의 두 관절 팔. 드래그로 돌리고 휠로 확대"></div><figure class="b2-plotbox"><canvas class="b2-mini" height="250" aria-label="kp별 어깨 처짐 그래프"></canvas><figcaption>가로: kp(로그 눈금), 세로: 어깨가 멈춘 처짐(도). 속이 빈 빨간 점은 기둥에 걸려 멈춘 경우입니다.</figcaption></figure></div>
      <div class="b2-readout" data-readout aria-live="polite"></div>
      <p class="small">그림은 three.js가 그린 것이고 MuJoCo가 아닙니다. 각도와 토크는 MuJoCo 3.17.0으로 60초씩 돌려 완전히 멈춘 뒤 읽은 값(어깨 kp 9가지 × 토크 한계 6가지)입니다. 슬라이더의 칸 사이 값은 돌려 보지 않았습니다.</p>`;
    const st = { i: 5, k: 0 };               // kp 60, no limit: the deck's example
    const canvas = host.querySelector('.b2-canvas'), mini = host.querySelector('.b2-mini'), mctx = mini.getContext('2d'), out = host.querySelector('[data-readout]');
    const sKp = host.querySelector('[data-ctl=kp]'), sFr = host.querySelector('[data-ctl=frc]'), oKp = host.querySelector('[data-out=kp]'), oFr = host.querySelector('[data-out=frc]');
    const scene = new T.Scene(); scene.background = new T.Color('#f4f8f7');
    const camera = new T.PerspectiveCamera(36, 1, .01, 30); camera.up.set(0, 0, 1); camera.position.set(.5, -1.45, .8);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); canvas.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(.22, 0, .62); controls.update();
    scene.add(new T.HemisphereLight(0xffffff, 0x526e69, 2.6)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, -3, 5); scene.add(dl);
    const grid = new T.GridHelper(3, 30, 0x91aaa1, 0xd4dfd9); grid.rotation.x = Math.PI / 2; scene.add(grid);
    const pillar = new T.Mesh(new T.BoxGeometry(.08, .08, .8), new T.MeshStandardMaterial({ color: 0x8b9a99 })); pillar.position.set(0, 0, .4); scene.add(pillar);
    const mat = c => new T.MeshStandardMaterial({ color: c });
    function link(len, r, color) { const g = new T.Group(); const m = new T.Mesh(new T.CapsuleGeometry(r, len, 6, 16), mat(color)); m.rotation.z = Math.PI / 2; m.position.x = len / 2; g.add(m); return g; }
    const upper = link(.3, .025, 0x0c6e70), fore = link(.25, .022, 0x4fa89f); fore.position.x = .3; upper.add(fore);
    const ball = new T.Mesh(new T.SphereGeometry(.035, 20, 14), mat(0xf0c030)); ball.position.x = .25; fore.add(ball);
    const pivot = new T.Group(); pivot.position.set(0, 0, .85); pivot.add(upper); scene.add(pivot);
    const goalPts = [new T.Vector3(0, 0, .85), new T.Vector3(.55, 0, .85)];
    const goal = new T.Line(new T.BufferGeometry().setFromPoints(goalPts), new T.LineDashedMaterial({ color: 0x555555, dashSize: .03, gapSize: .02 })); goal.computeLineDistances(); scene.add(goal);
    const hinge = new T.Mesh(new T.SphereGeometry(.03, 16, 12), mat(0xdd3333)); hinge.position.set(0, 0, .85); scene.add(hinge);
    function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.render(scene, camera); }
    controls.addEventListener('change', () => renderer.render(scene, camera));
    sKp.addEventListener('input', () => { st.i = +sKp.value; update(); }); sFr.addEventListener('input', () => { st.k = +sFr.value; update(); });
    function drawMini(run) {
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = mini.clientWidth, h = mini.clientHeight; if (!w || !h) return;
      if (mini.width !== Math.round(w * dpr)) { mini.width = Math.round(w * dpr); mini.height = Math.round(h * dpr); }
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.clearRect(0, 0, w, h);
      const L = 40, Rr = 12, Tp = 12, B = 28, lo = Math.log(4), hi = Math.log(1300), X = kp => L + (w - L - Rr) * (Math.log(kp) - lo) / (hi - lo), Y = a => Tp + (h - Tp - B) * (1 - a / 32);
      mctx.font = '12px sans-serif'; mctx.fillStyle = '#444'; mctx.strokeStyle = '#d3dedb'; mctx.lineWidth = 1;
      for (const a of [0, 10, 20, 30]) { mctx.beginPath(); mctx.moveTo(L, Y(a)); mctx.lineTo(w - Rr, Y(a)); mctx.stroke(); mctx.textAlign = 'right'; mctx.fillText(a + '°', L - 5, Y(a) + 4); }
      mctx.textAlign = 'center'; for (const kp of [5, 10, 30, 100, 300, 1000]) mctx.fillText(kp, X(kp), h - 8);
      const pts = data.kps.map(kp => [kp, data.runs[kp + '|' + st.k]]);
      mctx.strokeStyle = '#286e99'; mctx.lineWidth = 2; mctx.beginPath(); pts.forEach(([kp, r], n) => { const x = X(kp), y = Y(-r.s); n ? mctx.lineTo(x, y) : mctx.moveTo(x, y); }); mctx.stroke();
      pts.forEach(([kp, r], n) => { const cur = st.i === n + 1; mctx.beginPath(); mctx.arc(X(kp), Y(-r.s), cur ? 7 : 4, 0, 7); if (r.pillar) { mctx.strokeStyle = '#c0392b'; mctx.lineWidth = 2; mctx.stroke(); } else { mctx.fillStyle = cur ? '#e16a20' : '#286e99'; mctx.fill(); } if (cur) { mctx.strokeStyle = '#e16a20'; mctx.lineWidth = 2; mctx.stroke(); } });
    }
    function update() {
      const noAct = st.i === 0, kp = noAct ? 0 : data.kps[st.i - 1], fr = data.frcs[st.k], run = data.runs[runKey(st.i, st.k)];
      sKp.value = st.i; sFr.value = st.k; sFr.disabled = noAct;
      oKp.textContent = noAct ? '액추에이터 없음 (joint만)' : kp + ' (팔꿈치 ' + kp / 2 + ')'; oFr.textContent = noAct ? '해당 없음' : (fr ? '±' + fr + ' N·m' : '제한 없음');
      upper.rotation.y = -rad(run.s); fore.rotation.y = -rad(run.e);
      let msg = '';
      if (noAct) msg = `<p class="b2-warn">힘을 내는 장치가 없어서 팔이 중력에 떨어졌습니다. 어깨는 −28.7°에서 <b>기둥 윗모서리에 얹혀</b> 멈췄고(용수철이 버틴 것이 아닙니다), 팔꿈치는 아래팔이 곧게 늘어질 때까지 내려가 −61.3°가 되었습니다. 1초 뒤에는 어깨 ${f(run.s1)}°, 팔꿈치 ${f(run.e1)}°입니다.</p>`;
      else {
        const spring = kp * rad(-run.s);
        msg = `<div class="b2-grid"><div><span>어깨: 목표 0° → 멈춘 곳 (1초 뒤)</span><b>${f(run.s, 2)}° (${f(run.s1, 2)}°)</b></div>
          <div><span>팔꿈치: 목표 0° → 멈춘 곳 (1초 뒤)</span><b>${f(run.e, 2)}° (${f(run.e1, 2)}°)</b></div>
          <div><span>어깨 모터가 내는 토크</span><b>${f(run.tsh, 2)} N·m</b></div>
          <div><span>어깨에 걸린 중력 토크</span><b>${f(run.gsh, 2)} N·m</b></div>
          <div><span>kp × 처짐(rad)</span><b>${f(kp, 0)} × ${f(rad(-run.s), 4)} = ${f(spring, 2)} N·m</b></div>
          <div><span>팔 전체가 수평일 때 필요한 토크</span><b>3.07 N·m (어깨), 0.86 N·m (팔꿈치)</b></div></div>`;
        if (run.pillar) msg += `<p class="b2-warn">어깨가 <b>기둥에 얹혀</b> 멈췄습니다. 용수철 힘이 부족해 더 내려가려다 기둥이 받친 것이라, 이 처짐 값은 kp가 정한 값이 아닙니다.</p>`;
        else if (fr && fr < run.gsh + .001 && run.tsh >= fr - .001) msg += `<p class="b2-warn">토크 한계 ${fr} N·m에 걸렸습니다(모터가 낼 수 있는 힘의 끝). 중력 토크가 줄어드는 자세(−${f(-run.s, 1)}°)까지 내려와서야 한계 안에서 버팁니다.</p>`;
        else msg += `<p class="b2-sub">멈춘 뒤에는 모터 토크 ${f(run.tsh, 2)} = 중력 토크 ${f(run.gsh, 2)}로 같습니다. 팔이 처져야 오차가 생기고, 오차 × kp가 그 토크가 됩니다.${run.still ? '' : ' (아직 완전히 멈추지는 않았습니다.)'}</p>`;
      }
      out.innerHTML = msg; renderer.render(scene, camera); drawMini(noAct ? data.runs['60|0'] : run);
    }
    new ResizeObserver(() => { resize(); drawMini(null); update(); }).observe(canvas); new ResizeObserver(update).observe(mini); resize(); update();
  }
  document.querySelectorAll('[data-sag-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '3D 화면을 열 수 없습니다. 브라우저의 WebGL 설정을 확인하세요.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
