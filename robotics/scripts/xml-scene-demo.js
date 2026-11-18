/* One idea: pos is a centre and size is a HALF length; a child follows its parent when the hinge turns.
   Illustration drawn by three.js (not MuJoCo). The pure math below is checked against MuJoCo in verify_d3_onramp.py. */
(function (root) {
  'use strict';
  const rad = d => d * Math.PI / 180;
  // world centre of a geom at local (gx,0,0) inside a body at (0,0,bz) whose z-axis hinge is turned by theta degrees
  function geomCenter(bz, gx, thetaDeg) { const t = rad(thetaDeg); return [gx * Math.cos(t), gx * Math.sin(t), bz]; }
  // default density 1000 kg/m^3; size is a half length, so volume = 8*sx*sy*sz
  function mass(sx, sy, sz) { return 8 * sx * sy * sz * 1000; }
  const f = (n, d = 3) => (Math.round(n * 10 ** d) / 10 ** d).toString();
  function xmlLines(p) {
    return [
      ['bz', `<body name="panel" pos="0 0 ${f(p.bz, 2)}">`],
      ['', '  <joint type="hinge" axis="0 0 1"/>'],
      ['g', `  <geom type="box" pos="${f(p.gx, 2)} 0 0" size="${f(p.sx, 2)} ${f(p.sy, 2)} ${f(p.sz, 2)}"/>`],
      ['', '</body>']
    ];
  }
  const math = { geomCenter, mass, xmlLines };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.XmlSceneMath = math;
  const T = root.RobotThree.THREE, OrbitControls = root.RobotThree.OrbitControls;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const FIELDS = [
    ['bz', '몸체 pos의 z', 0.1, 1, 0.05, 0.5],
    ['gx', '모양 pos의 x', 0, 0.8, 0.05, 0.4],
    ['sx', 'size 첫째(x)', 0.1, 0.8, 0.05, 0.4],
    ['sy', 'size 둘째(y)', 0.02, 0.3, 0.01, 0.05],
    ['sz', 'size 셋째(z)', 0.1, 0.5, 0.05, 0.3]
  ];
  function init(host) {
    host.classList.add('xml-demo');
    host.innerHTML = `<h3>직접 바꿔 보기: pos와 size</h3>
      <p>슬라이더를 움직이면 오른쪽 XML 글과 아래 3D 그림이 함께 바뀝니다. 방금 바뀐 줄은 노란 띠로 표시됩니다. 점선 상자는 관절이 0°일 때의 자리입니다.</p>
      <div class="xml-grid"><div class="xml-controls"></div><pre class="xml-text" aria-live="polite"></pre></div>
      <div class="xml-canvas" aria-label="3D 장면: 문판과 경첩. 드래그로 돌리고 휠로 확대"></div>
      <div class="xml-readout" aria-live="polite"></div>
      <p class="small">이 그림은 브라우저의 three.js로 그린 것이며 MuJoCo가 아닙니다. 위 숫자는 MuJoCo와 같은 식(중심 = 몸체 위치 + 회전한 pos, 질량 = 8 × size 곱 × 1000)으로 계산했고, 여러 값을 MuJoCo 3.17.0 실행값과 맞춰 보았습니다.</p>`;
    const state = { bz: .5, gx: .4, sx: .4, sy: .05, sz: .3, th: 0 }; let last = '';
    const ctl = host.querySelector('.xml-controls'), pre = host.querySelector('.xml-text'), out = host.querySelector('.xml-readout'), canvas = host.querySelector('.xml-canvas');
    const outputs = {};
    for (const [key, label, min, max, step, val] of FIELDS) {
      const l = make('label'); l.append(label + ' ', make('output', '', 'xml-val')); const i = make('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val; i.dataset.key = key; i.setAttribute('aria-label', label);
      l.append(i); ctl.append(l); outputs[key] = l.querySelector('output');
      i.addEventListener('input', () => { state[key] = +i.value; last = key === 'bz' ? 'bz' : 'g'; redraw(); });
    }
    const lt = make('label'); lt.append('관절 각도 θ (코드에서 넣는 qpos) ', make('output', '', 'xml-val')); const ti = make('input'); ti.type = 'range'; ti.min = -90; ti.max = 90; ti.step = 1; ti.value = 0; ti.dataset.key = 'th'; ti.setAttribute('aria-label', '관절 각도');
    lt.append(ti); ctl.append(lt); outputs.th = lt.querySelector('output');
    ti.addEventListener('input', () => { state.th = +ti.value; last = ''; redraw(); });
    const scene = new T.Scene(); scene.background = new T.Color('#f4f8f7');
    const camera = new T.PerspectiveCamera(40, 1, .01, 30); camera.up.set(0, 0, 1); camera.position.set(1.7, -2.1, 1.5);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); canvas.append(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(.35, 0, .45); controls.update();
    scene.add(new T.HemisphereLight(0xffffff, 0x526e69, 2.6)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, -3, 5); scene.add(dl);
    const grid = new T.GridHelper(3, 30, 0x91aaa1, 0xd4dfd9); grid.rotation.x = Math.PI / 2; scene.add(grid); scene.add(new T.AxesHelper(.5));
    const dyn = new T.Group(); scene.add(dyn);
    function clear() { for (const c of [...dyn.children]) { dyn.remove(c); c.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); } }
    function redraw() {
      for (const [key] of FIELDS) outputs[key].textContent = f(state[key], 2) + ' m';
      outputs.th.textContent = state.th + '°';
      pre.innerHTML = ''; for (const [k, line] of xmlLines(state)) pre.append(make('span', line + '\n', k && k === last ? 'xml-hit' : ''));
      clear();
      const pivot = new T.Group(); pivot.position.set(0, 0, state.bz); pivot.rotation.z = rad(state.th); dyn.add(pivot);
      const geo = new T.BoxGeometry(2 * state.sx, 2 * state.sy, 2 * state.sz);
      const box = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x286e99 })); box.position.set(state.gx, 0, 0); pivot.add(box);
      const ghost = new T.LineSegments(new T.EdgesGeometry(geo), new T.LineDashedMaterial({ color: 0x555555, dashSize: .04, gapSize: .03 })); ghost.computeLineDistances(); ghost.position.set(state.gx, 0, state.bz); dyn.add(ghost);
      const pin = new T.Mesh(new T.CylinderGeometry(.012, .012, 1.2, 12), new T.MeshStandardMaterial({ color: 0x222222 })); pin.rotation.x = Math.PI / 2; pin.position.set(0, 0, state.bz); dyn.add(pin);
      const origin = new T.Mesh(new T.SphereGeometry(.03, 16, 12), new T.MeshStandardMaterial({ color: 0xdd3333 })); origin.position.set(0, 0, state.bz); dyn.add(origin);
      const c = geomCenter(state.bz, state.gx, state.th); const dot = new T.Mesh(new T.SphereGeometry(.025, 16, 12), new T.MeshStandardMaterial({ color: 0xe16a20 })); dot.position.set(...c); dyn.add(dot);
      const m = mass(state.sx, state.sy, state.sz);
      out.innerHTML = `<b>빨간 점</b>(몸체 기준점) 세계 위치: (0, 0, ${f(state.bz, 2)})<br><b>주황 점</b>(모양 중심) 세계 위치: (${f(c[0])}, ${f(c[1])}, ${f(c[2])})<br>모양의 실제 크기: ${f(2 * state.sx, 2)} × ${f(2 * state.sy, 2)} × ${f(2 * state.sz, 2)} m (size의 두 배)<br>질량: 8 × ${f(state.sx, 2)} × ${f(state.sy, 2)} × ${f(state.sz, 2)} × 1000 = <b>${f(m, 3)} kg</b>`;
      renderer.render(scene, camera);
    }
    controls.addEventListener('change', () => renderer.render(scene, camera));
    function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.render(scene, camera); }
    new ResizeObserver(resize).observe(canvas); redraw(); resize();
  }
  document.querySelectorAll('[data-xml-scene-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '3D 화면을 열 수 없습니다. 브라우저의 WebGL 설정을 확인하세요.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
