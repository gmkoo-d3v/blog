/* One idea: who advances time? In a launch_passive window the user's loop does; the window's Pause/step controls are inactive.
   This is a mock of the viewer drawn by three.js. The angles replay a real MuJoCo 3.17.0 pendulum run (viewer-tour-data.js). */
(function (root) {
  'use strict';
  const data = root.ViewerTourData || { dt: .002, deg: [90, 90] };
  const N = data.deg.length - 1, TEND = N * data.dt;
  function angleAt(deg, dt, t) { const x = Math.max(0, Math.min(deg.length - 1, t / dt)), i = Math.min(deg.length - 2, Math.floor(x)); return deg[i] + (deg[i + 1] - deg[i]) * (x - i); }
  // pendulum hinge at height 1 m, y axis, bob 0.5 m below; qpos = angle in degrees
  function ballPos(thetaDeg) { const t = thetaDeg * Math.PI / 180; return [-0.5 * Math.sin(t), 0, 1 - 0.5 * Math.cos(t)]; }
  const math = { angleAt, ballPos };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.ViewerTourMath = math;
  const T = root.RobotThree.THREE, OrbitControls = root.RobotThree.OrbitControls;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  function init(host) {
    host.classList.add('viewer-demo');
    host.innerHTML = `<h3>눌러 보기: 시간은 누가 흘릴까</h3>
      <p>진자 창을 흉내 낸 그림입니다. 두 방식을 바꿔 가며 Space와 화살표 키(또는 아래 버튼)를 눌러 보세요. 그림 속 진자는 실제 MuJoCo 계산을 그대로 되돌려 보여 줍니다.</p>
      <div class="viewer-modes" role="radiogroup" aria-label="창을 여는 방식">
        <label><input type="radio" name="vt-mode" value="passive" checked> 내 반복문이 시간을 흘림 (<code>launch_passive</code>)</label>
        <label><input type="radio" name="vt-mode" value="normal"> 창이 시간을 흘림 (일반 뷰어)</label></div>
      <div class="viewer-buttons">
        <button type="button" data-act="play">정지 / 재생 (Space)</button>
        <button type="button" data-act="back">◀ 한 걸음 (←)</button><button type="button" data-act="fwd">한 걸음 ▶ (→)</button>
        <button type="button" data-act="slow">느리게 (−)</button><button type="button" data-act="fast">빠르게 (+)</button>
        <button type="button" data-act="reset">처음부터 (이 그림 전용)</button></div>
      <div class="viewer-note" data-note aria-live="polite"></div>
      <div class="viewer-canvas" tabindex="0" aria-label="진자 3D 화면. 왼쪽 드래그로 돌리고 휠로 확대, 오른쪽 드래그로 옮김"></div>
      <div class="viewer-readout" data-readout aria-live="polite"></div>
      <figure class="viewer-plotbox"><canvas class="viewer-plot" height="170" aria-label="진자 각도의 시간 그래프. 세로선이 지금 시간. 일반 뷰어 방식에서는 그래프를 눌러 끌면 그 시간으로 이동"></canvas><figcaption>가로: 시간 0~4초, 세로: 각도 −90°~90°. 세로선이 지금 시간입니다. 점은 0.2초마다의 값(아래 표의 숫자)입니다. 일반 뷰어 방식에서는 그래프를 끌어 시간을 옮겨 볼 수 있습니다.</figcaption></figure>
      <p class="small">이 그림은 MuJoCo 뷰어가 아니라 three.js로 흉내 낸 것입니다. 진자의 각도는 MuJoCo 3.17.0으로 2000걸음(4초) 돌린 기록입니다. 이 컴퓨터에서 직접 확인한 것은 앞쪽 방식입니다(Pause/Run 회색, Space를 보내도 시간이 계속 감). 뒤쪽 방식의 동작은 창 안 도움말 표에 적힌 대로 흉내 낸 것으로, 눌러 확인하지는 않았습니다.</p>`;
    const st = { mode: 'passive', t: 0, playing: true, speed: 1, note: '' };
    const canvas = host.querySelector('.viewer-canvas'), note = host.querySelector('[data-note]'), readout = host.querySelector('[data-readout]');
    const scene = new T.Scene(); scene.background = new T.Color('#f4f8f7');
    const camera = new T.PerspectiveCamera(38, 1, .01, 30); camera.up.set(0, 0, 1); camera.position.set(.5, -2.5, 1.15);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); canvas.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(-.15, 0, .72); controls.update();
    scene.add(new T.HemisphereLight(0xffffff, 0x526e69, 2.6)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, -3, 5); scene.add(dl);
    const grid = new T.GridHelper(3, 30, 0x91aaa1, 0xd4dfd9); grid.rotation.x = Math.PI / 2; scene.add(grid); scene.add(new T.AxesHelper(.4));
    const pivot = new T.Mesh(new T.SphereGeometry(.03, 16, 12), new T.MeshStandardMaterial({ color: 0xdd3333 })); pivot.position.set(0, 0, 1); scene.add(pivot);
    const ball = new T.Mesh(new T.SphereGeometry(.05, 24, 16), new T.MeshStandardMaterial({ color: 0xd94a2b })); scene.add(ball);
    const rod = new T.Mesh(new T.CylinderGeometry(.008, .008, 1, 10), new T.MeshStandardMaterial({ color: 0x444444 })); scene.add(rod);
    const plot = host.querySelector('.viewer-plot'), pctx = plot.getContext('2d');
    function drawPlot() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = plot.clientWidth, h = plot.clientHeight; if (!w || !h) return;
      if (plot.width !== Math.round(w * dpr)) { plot.width = Math.round(w * dpr); plot.height = Math.round(h * dpr); }
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0); pctx.clearRect(0, 0, w, h);
      const L = 44, R = 10, Tp = 10, B = 24, X = t => L + (w - L - R) * t / TEND, Y = a => Tp + (h - Tp - B) * (90 - a) / 180;
      pctx.font = '12px sans-serif'; pctx.fillStyle = '#444'; pctx.strokeStyle = '#ccd8d3'; pctx.lineWidth = 1;
      for (const a of [-90, -45, 0, 45, 90]) { pctx.beginPath(); pctx.moveTo(L, Y(a)); pctx.lineTo(w - R, Y(a)); pctx.stroke(); pctx.textAlign = 'right'; pctx.fillText(a + '°', L - 6, Y(a) + 4); }
      for (let t = 0; t <= TEND + 1e-9; t++) { pctx.textAlign = 'center'; pctx.fillText(t + ' s', X(t), h - 6); }
      pctx.strokeStyle = '#286e99'; pctx.lineWidth = 2; pctx.beginPath();
      for (let i = 0; i <= N; i += 5) { const x = X(i * data.dt), y = Y(data.deg[i]); i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); } pctx.stroke();
      pctx.fillStyle = '#e16a20'; for (let k = 0; k * 0.2 <= TEND + 1e-9; k++) { const i = Math.round(k * 0.2 / data.dt); pctx.beginPath(); pctx.arc(X(i * data.dt), Y(data.deg[i]), 3, 0, 7); pctx.fill(); }
      pctx.strokeStyle = '#d33'; pctx.lineWidth = 2; pctx.beginPath(); pctx.moveTo(X(st.t), Tp); pctx.lineTo(X(st.t), h - B); pctx.stroke();
    }
    function scrub(e) { if (st.mode === 'passive') { st.note = '반응 없음: 이 방식에서는 시간을 내 반복문이 정합니다.'; ui(); return; } const r = plot.getBoundingClientRect(), x = (e.clientX - r.left - 44) / (r.width - 54); st.playing = false; st.t = Math.max(0, Math.min(TEND, x * TEND)); st.note = '그래프로 시간 이동'; ui(); pose(); }
    let dragging = false; plot.addEventListener('pointerdown', e => { dragging = true; plot.setPointerCapture(e.pointerId); scrub(e); }); plot.addEventListener('pointermove', e => { if (dragging) scrub(e); }); plot.addEventListener('pointerup', () => { dragging = false; });
    const up = new T.Vector3(0, 1, 0);
    function pose() {
      const deg = angleAt(data.deg, data.dt, st.t), b = ballPos(deg), p = new T.Vector3(0, 0, 1), q = new T.Vector3(...b), d = q.clone().sub(p);
      ball.position.copy(q); rod.position.copy(p).add(q).multiplyScalar(.5); rod.scale.set(1, d.length(), 1); rod.quaternion.setFromUnitVectors(up, d.normalize());
      readout.innerHTML = `시뮬레이션 시간 <b>${st.t.toFixed(3)} s</b> · 걸음 수 ${Math.round(st.t / data.dt)} (= 시간 ÷ 0.002) · 진자 각도 <b>${deg.toFixed(1)}°</b> · 속도 배율 ${st.speed}×`;
      renderer.render(scene, camera); drawPlot();
    }
    function ui() {
      const passive = st.mode === 'passive';
      for (const act of ['play', 'back', 'fwd', 'slow', 'fast']) host.querySelector(`[data-act="${act}"]`).disabled = passive;
      note.textContent = st.note || (passive ? '지금: 내 반복문이 mj_step과 viewer.sync()를 부릅니다. Pause/Run과 걸음 단추가 회색이고, Space를 눌러도 시간은 계속 갑니다.' : '지금: 창이 시간을 흘립니다(도움말 표의 단축키). Space는 재생/정지, ← →는 한 걸음, + −는 속도입니다.');
    }
    function act(a) {
      const passive = st.mode === 'passive';
      if (a === 'reset') { st.t = 0; st.note = ''; }
      else if (passive) { st.note = '반응 없음: 이 방식에서는 시간을 내 반복문이 정합니다.'; }
      else if (a === 'play') { st.playing = !st.playing; st.note = ''; }
      else if (a === 'back') { st.playing = false; st.t = Math.max(0, st.t - data.dt); st.note = '한 걸음(0.002 s) 뒤로'; }
      else if (a === 'fwd') { st.playing = false; st.t = Math.min(TEND, st.t + data.dt); st.note = '한 걸음(0.002 s) 앞으로'; }
      else if (a === 'slow') { st.speed = Math.max(.125, st.speed / 2); st.note = ''; }
      else if (a === 'fast') { st.speed = Math.min(8, st.speed * 2); st.note = ''; }
      ui(); pose();
    }
    host.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
    host.querySelectorAll('input[name="vt-mode"]').forEach(r => r.addEventListener('change', () => { if (!r.checked) return; st.mode = r.value; st.playing = true; st.speed = 1; st.note = ''; ui(); pose(); }));
    host.addEventListener('keydown', e => {
      const map = { ' ': 'play', ArrowLeft: 'back', ArrowRight: 'fwd', '-': 'slow', '+': 'fast', '=': 'fast' };
      if (e.target.matches('input[type="radio"]') && e.key !== ' ') { /* radio arrows keep their meaning */ if (e.key.startsWith('Arrow')) return; }
      if (map[e.key] && !e.target.matches('button')) { e.preventDefault(); act(map[e.key]); }
    });
    controls.addEventListener('change', () => renderer.render(scene, camera));
    let prev = performance.now();
    function loop(now) {
      const dt = Math.min(.1, (now - prev) / 1000); prev = now;
      if (st.playing || st.mode === 'passive') { st.t += dt * (st.mode === 'passive' ? 1 : st.speed); if (st.t > TEND) st.t -= TEND; pose(); }
      requestAnimationFrame(loop);
    }
    function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.render(scene, camera); }
    new ResizeObserver(resize).observe(canvas); new ResizeObserver(drawPlot).observe(plot); ui(); resize(); pose(); requestAnimationFrame(loop);
    host._vt = { st, act, pose };
  }
  document.querySelectorAll('[data-viewer-tour-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '3D 화면을 열 수 없습니다. 브라우저의 WebGL 설정을 확인하세요.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
