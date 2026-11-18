/* Visual kit: 3D scene, the default picture for anything physical (vendored three.js via window.RobotThree; z up, metres).
   <div data-kit="scene3d" data-name="arm"></div>
   data.scenes3d[name] = {camera:[x,y,z], target:[x,y,z], label, height?, ground:{size, z}|false, axes:{at,len}|false,
                          views:{name:{camera,target}} (added to 기본 / 위에서 / 옆에서), items:[...]}
   Items (values bind like scene2d: numbers, column names, '@param', functions of ctx; k scales columns, e.g. 0.001 mm→m).
   Every item may have name (what a tour beat lights up), tag (a small always-on label) + tagAt, when: fn(ctx).
     cuboid {center, half:[hx,hy,hz], quat?:[w,x,y,z], color, opacity}      cylinder {at, r, h, color}
     sphere {at, r, color}       link {a, b, radius, color}       frame {at, len}       label {at, text, color}
     arm {base, links:[l1,l2..], q:[deg cols..], radius, colors, names:[per link], tip: name, tipColor}
         (planar arm turning about z; a faint copy shows stage.ghost (a frame index) or the compare overlay run)
     path {x, y, z, k, color, radius, upto}         (the run's trail as a tube; the overlay run's trail in grey)
     polyline {pts:[[x,y,z]..] | fn(ctx), color, radius, dash:[on,off] m}      ring {c:[x,y,z], r, color, dash}
     points {pts:[[x,y,z,label?,color?]] | fn(ctx), r, color, max, labelLift (m above the point)}            arrow {from, to, color, radius}
   One WebGL context serves every 3D scene on the page: each scene renders into the shared renderer and copies the
   picture into its own 2D canvas (Edge keeps at most 16 live WebGL contexts per page; measured 2026-11-18).
   Scenes outside the viewport are not drawn until they scroll in. */
(function (root) {
  'use strict';
  const Kit = root.Kit, el = Kit.el;
  const shared = { r: null, w: 0, h: 0, lost: 0, created: 0 };
  Kit.three = {
    scenes: new Set(),
    get contexts() { return shared.r ? 1 : 0; }, get created() { return shared.created; }, get lost() { return shared.lost; },
    redrawAll() { for (const s of this.scenes) s.redraw(); }
  };
  function renderer(T) {
    if (shared.r) return shared.r;
    const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setScissorTest(true); shared.w = shared.h = 0; shared.created++;
    r.domElement.addEventListener('webglcontextlost', e => {   // e.g. another widget opened too many contexts: start a new one
      e.preventDefault(); shared.lost++; if (shared.r === r) shared.r = null; setTimeout(() => Kit.three.redrawAll(), 30);
    });
    return (shared.r = r);
  }
  function paint(T, cv, scene, camera) {
    const r = renderer(T), w = cv.width, h = cv.height; if (!w || !h) return;
    if (shared.w !== w || shared.h !== h) { shared.w = w; shared.h = h; r.setSize(w, h, false); }   // cheap when one size repeats
    r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.render(scene, camera);
    const g = cv.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(r.domElement, 0, 0, w, h, 0, 0, w, h);
  }
  function canvasTexture(T, w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; }

  Kit.define('scene3d', (host, stage) => {
    if (!root.RobotThree) throw new Error('three.js (vendor/three-offline.js) not loaded');
    const { THREE: T, OrbitControls } = root.RobotThree;
    const spec = Kit.spec(stage, 'scenes3d', host);
    const up = new T.Vector3(0, 1, 0);
    host.classList.add('kit-scenebox', 'kit-scene3dbox');
    const box = el('div', { class: 'kit-3d' }); if (spec.height) box.style.height = spec.height + 'px'; host.append(box);
    try { renderer(T); } catch (e) { box.textContent = '3D 화면을 열 수 없습니다(WebGL 꺼짐). 아래 표와 숫자로 같은 값을 볼 수 있습니다.'; host.classList.add('kit-failed'); return; }
    const cv = el('canvas', { class: 'kit-3dcanvas', tabindex: 0, role: 'img', 'aria-label': (spec.label || '3D 장면') + '. 끌어서 돌리고, 휠로 확대하고, 방향키로도 돌립니다.' });
    box.append(cv);
    const ovl = Kit.overlay(box);
    const bar = el('div', { class: 'kit-views', role: 'group', 'aria-label': '보는 방향' }); box.append(bar);
    box.append(el('span', { class: 'kit-3dhint', text: '끌어서 돌리기 · 휠로 확대' }));

    // ---------- world: MuJoCo-like sky, light checker floor with a 10 cm grid, labelled axes
    const scene = new T.Scene();
    scene.background = canvasTexture(T, 4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9fb3c8'); gr.addColorStop(1, '#f2f2fb'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    scene.add(new T.HemisphereLight(0xffffff, 0x8d949a, 1.7));
    const sun = new T.DirectionalLight(0xffffff, 2.0); sun.position.set(0.3, -0.5, 2.5); scene.add(sun);
    const fill = new T.DirectionalLight(0xffffff, 0.7); fill.position.set(-1.2, 1.5, 1.0); scene.add(fill);
    const gz = spec.ground === false ? null : (spec.ground || {});
    if (gz) {
      const size = gz.size || 4, z = gz.z || 0;
      const tex = canvasTexture(T, 64, 64, (g) => { g.fillStyle = '#e1e5e8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#d3d8dc'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32); });
      tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(size / 0.5, size / 0.5); tex.magFilter = T.NearestFilter;
      const floor = new T.Mesh(new T.PlaneGeometry(size, size), new T.MeshStandardMaterial({ map: tex, roughness: 0.95 })); floor.position.z = z - 0.0005; scene.add(floor);
      const g1 = new T.GridHelper(size, Math.round(size / 0.1), 0xaeb6bd, 0xbfc6cc); g1.rotation.x = Math.PI / 2; g1.position.z = z + 0.0005; g1.material.opacity = 0.55; g1.material.transparent = true; scene.add(g1);
    }
    const tags = [];                        // always-on labels: {key, at(): [x,y,z], text(), color}
    const ax = spec.axes === false ? null : (spec.axes || {});
    if (ax) {
      const at = ax.at || [0, 0, gz ? (gz.z || 0) + 0.002 : 0], L = ax.len || 0.2, R = ax.radius || 0.004;
      [[1, 0, 0, '#d0342c', 'x'], [0, 1, 0, '#1f9a4a', 'y'], [0, 0, 1, '#2f5fd0', 'z']].forEach(([dx, dy, dz, c, n]) => {
        const m = new T.Mesh(new T.CylinderGeometry(R, R, 1, 10), new T.MeshBasicMaterial({ color: c })); rod([at[0], at[1], at[2]], [at[0] + dx * L, at[1] + dy * L, at[2] + dz * L], m); scene.add(m);
        tags.push({ key: 'axis-' + n, at: () => [at[0] + dx * L * 1.15, at[1] + dy * L * 1.15, at[2] + dz * L * 1.15], text: () => n, color: c, cls: 'kit-tag-axis' });
      });
    }

    // ---------- camera, orbit, view presets
    const camera = new T.PerspectiveCamera(spec.fov || 38, 1, 0.01, 60); camera.up.set(0, 0, 1);
    const target0 = spec.target || [0, 0, 0], cam0 = spec.camera || [1.2, -1.2, 1];
    const dist = Math.hypot(cam0[0] - target0[0], cam0[1] - target0[1], cam0[2] - target0[2]);
    const views = Object.assign({
      '기본': { camera: cam0, target: target0 },
      '위에서': { camera: [target0[0], target0[1] - 0.0005, target0[2] + dist * 0.95], target: target0 },
      '옆에서': { camera: [target0[0], target0[1] - dist * 0.95, target0[2] + 0.02], target: target0 }
    }, spec.views || {});
    const controls = new OrbitControls(camera, cv); controls.target.set(...target0); camera.position.set(...cam0); controls.update();
    let flying = null, current = '기본';
    const vbtn = {};
    for (const name of Object.keys(views)) bar.append(vbtn[name] = el('button', { type: 'button', text: name, 'aria-label': name + ' 보기', onclick: () => fly(name) }));
    function markView() { for (const [n, b] of Object.entries(vbtn)) b.setAttribute('aria-pressed', n === current); }
    function fly(name, ms = 380) {
      const v = views[name]; if (!v) return; current = name; markView();
      const p0 = camera.position.clone(), t0 = controls.target.clone(), p1 = new T.Vector3(...v.camera), t1 = new T.Vector3(...v.target), start = performance.now();
      const token = flying = {};
      const step = () => {
        if (flying !== token) return; const u = Math.min(1, (performance.now() - start) / ms), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        camera.position.lerpVectors(p0, p1, e); controls.target.lerpVectors(t0, t1, e); controls.update(); render();
        if (u < 1) setTimeout(step, 16); else flying = null;
      };
      step();
    }
    markView();
    controls.addEventListener('start', () => { flying = null; current = null; markView(); });
    controls.addEventListener('change', () => render());
    cv.addEventListener('keydown', e => {           // keyboard orbit: ←/→ turn around, ↑/↓ higher/lower
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return; e.preventDefault();
      const off = camera.position.clone().sub(controls.target), s = new T.Spherical(); s.setFromVector3(new T.Vector3(off.x, off.z, -off.y));
      s.theta += d[0] * 0.17; s.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, s.phi - d[1] * 0.12));
      const v = new T.Vector3().setFromSpherical(s); camera.position.set(controls.target.x + v.x, controls.target.y - v.z, controls.target.z + v.y);
      current = null; markView(); controls.update(); render();
    });

    // ---------- items
    const V = (v, k = 1, run = stage.run, i = null) => { const r = stage.val(v, run, i); return Array.isArray(r) ? r.map(x => x * k) : r == null ? r : r * k; };
    function rod(a, b, m) { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(1, Math.max(L, 1e-6), 1); if (L > 1e-9) m.quaternion.setFromUnitVectors(up, d.normalize()); }
    const mat = (color, opacity = 1) => new T.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    const haloMat = () => new T.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.55, side: T.BackSide, depthWrite: false });
    const ghostMat = () => new T.MeshStandardMaterial({ color: 0x7d8b86, transparent: true, opacity: 0.32, depthWrite: false });
    const parts = [];                       // {names, mats, halos}: what a beat can light up
    function part(names, meshes, haloScale) {
      const halos = meshes.map(m => { const h = new T.Mesh(m.geometry, haloMat()); h.scale.set(...haloScale); h.visible = false; h.renderOrder = -1; m.add(h); return h; });
      parts.push({ names: names.filter(Boolean), mats: meshes.map(m => m.material), halos });
    }
    const M4 = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), S = new T.Vector3();
    function segMatrices(pts, dash) {           // one cylinder per segment (or per dash piece) as instance matrices
      const out = [];
      for (let j = 0; j + 1 < pts.length; j++) {
        const a = new T.Vector3(...pts[j]), b = new T.Vector3(...pts[j + 1]), d = b.clone().sub(a), L = d.length(); if (L < 1e-7) { out.push(null); continue; }
        const dir = d.clone().normalize(); Q.setFromUnitVectors(up, dir);
        const pieces = dash ? (() => { const r = []; for (let s = 0; s < L; s += dash[0] + dash[1]) r.push([s, Math.min(L, s + dash[0])]); return r; })() : [[0, L]];
        for (const [s0, s1] of pieces) { P.copy(a).addScaledVector(dir, (s0 + s1) / 2); S.set(1, s1 - s0, 1); out.push(M4.compose(P, Q, S).clone()); }
      }
      return out;
    }
    function tube(radius, color, cap) {        // instanced cylinders + an orange halo sharing the same matrices
      const geo = new T.CylinderGeometry(radius, radius, 1, 8), m = new T.InstancedMesh(geo, mat(color), cap);
      const h = new T.InstancedMesh(new T.CylinderGeometry(radius * 2.6, radius * 2.6, 1, 8), haloMat(), cap); h.instanceMatrix = m.instanceMatrix; h.visible = false;
      m.count = h.count = 0; m.frustumCulled = h.frustumCulled = false; return { m, h, cap };
    }
    function fillTube(t, mats) { let n = 0; for (const x of mats) { if (!x || n >= t.cap) continue; t.m.setMatrixAt(n++, x); } t.m.count = t.h.count = n; t.m.instanceMatrix.needsUpdate = true; return n; }
    const updaters = [];
    for (const it of spec.items || []) {
      const k = it.k ?? 1, grp = new T.Group(); scene.add(grp);
      const when = () => { grp.visible = !it.when || !!it.when(stage.ctx()); return grp.visible; };
      if (it.tag) tags.push({ key: 'tag-' + tags.length, at: () => grp.visible ? V(it.tagAt || it.center || it.at, it.tagAt ? 1 : k) : null, text: () => Kit.text(it.tag, stage.ctx()), color: it.tagColor });
      if (it.type === 'cuboid') {
        const h = it.half, m = new T.Mesh(new T.BoxGeometry(2 * h[0], 2 * h[1], 2 * h[2]), mat(it.color || '#f2bf1a', it.opacity ?? 1)); grp.add(m); part([it.name], [m], [1.18, 1.18, 1.18]);
        updaters.push(() => { if (!when()) return; m.position.set(...V(it.center, k)); if (it.quat) { const q = V(it.quat); m.quaternion.set(q[1], q[2], q[3], q[0]); } });
      } else if (it.type === 'cylinder') {
        const m = new T.Mesh(new T.CylinderGeometry(it.r || 0.04, it.r || 0.04, it.h || 0.05, 24), mat(it.color || '#4d4d4d')); m.rotation.x = Math.PI / 2; grp.add(m); part([it.name], [m], [1.2, 1.1, 1.2]);
        updaters.push(() => { if (when()) m.position.set(...V(it.at, k)); });
      } else if (it.type === 'sphere') {
        const m = new T.Mesh(new T.SphereGeometry(it.r || 0.02, 20, 14), mat(it.color || '#e03030')); grp.add(m); part([it.name], [m], [1.6, 1.6, 1.6]);
        updaters.push(() => { if (when()) m.position.set(...V(it.at, k)); });
      } else if (it.type === 'link') {
        const m = new T.Mesh(new T.CylinderGeometry(it.radius || 0.015, it.radius || 0.015, 1, 16), mat(it.color || '#3380e6')); grp.add(m); part([it.name], [m], [1.9, 1.0, 1.9]);
        updaters.push(() => { if (when()) rod(V(it.a, k), V(it.b, k), m); });
      } else if (it.type === 'arm') {
        const cols = it.colors || ['#3380e6', '#33b380'], R = it.radius || 0.02, names = it.names || [];
        const build = (ghost) => {
          const rods = it.links.map((L, j) => { const m = new T.Mesh(new T.CylinderGeometry(R, R, 1, 18), ghost ? ghostMat() : mat(cols[j % cols.length])); grp.add(m); return m; });
          const joints = it.links.map(() => { const m = new T.Mesh(new T.SphereGeometry(R * 1.45, 18, 12), ghost ? ghostMat() : mat(it.jointColor || '#3a3f44')); grp.add(m); return m; });
          const tip = new T.Mesh(new T.SphereGeometry(it.tipR || R * 0.8, 16, 12), ghost ? ghostMat() : mat(it.tipColor || '#ff3333')); grp.add(tip);
          return { rods, joints, tip };
        };
        const real = build(false), faint = build(true);
        real.rods.forEach((m, j) => part([names[j], it.name], [m], [1.7, 1.0, 1.7])); part([it.tip, it.name], [real.tip], [2.2, 2.2, 2.2]); part([it.name], real.joints, [1.3, 1.3, 1.3]);
        const pose = (set, q) => {
          const b = V(it.base || [0, 0, 0]); let a = 0, p = b.slice();
          it.links.forEach((L, j) => { set.joints[j].position.set(...p); a += q[j] * Math.PI / 180; const n = [p[0] + L * Math.cos(a), p[1] + L * Math.sin(a), p[2]]; rod(p, n, set.rods[j]); p = n; });
          set.tip.position.set(...p);
        };
        const showFaint = on => { for (const m of [...faint.rods, ...faint.joints, faint.tip]) m.visible = on; };
        updaters.push(() => {
          if (!when()) return; pose(real, V(it.q));
          if (stage.ghost != null && it.ghost !== false) { pose(faint, V(it.q, 1, stage.run, stage.ghost)); showFaint(true); }
          else if (stage.overlay && it.ghost !== false) { pose(faint, V(it.q, 1, stage.overlay)); showFaint(true); }
          else showFaint(false);
        });
      } else if (it.type === 'path') {
        const R = it.radius || 0.004, mk = (color, cap) => { const t = tube(R, color, cap); grp.add(t.m, t.h); return t; };
        let main = null, ghost = null, builtFor = null, ghostFor = null, mats = [];
        const lit = { names: [it.name].filter(Boolean), mats: [], halos: [] }; parts.push(lit);
        const pts = run => { const xs = run.cols[it.x], ys = run.cols[it.y], zs = typeof it.z === 'number' ? null : run.cols[it.z]; const out = []; for (let i = 0; i < run.n; i++) out.push([xs[i] * k, ys[i] * k, zs ? zs[i] * k : it.z]); return out; };
        updaters.push(() => {
          if (!when()) return; const run = stage.run;
          if (builtFor !== run) { mats = segMatrices(pts(run)); if (!main || main.cap < mats.length) { if (main) grp.remove(main.m, main.h); main = mk(it.color || '#e8312a', mats.length + 1); lit.mats = [main.m.material]; lit.halos = [main.h]; } builtFor = run; }
          fillTube(main, it.upto ? mats.slice(0, Math.max(0, stage.i)) : mats);
          const ov = stage.overlay && it.ghost !== false ? stage.overlay : null;
          if (ov && ghostFor !== ov) { const gm = segMatrices(pts(ov)); if (!ghost || ghost.cap < gm.length) { if (ghost) grp.remove(ghost.m, ghost.h); ghost = mk('#8c969a', gm.length + 1); } fillTube(ghost, gm); ghostFor = ov; }
          if (ghost) ghost.m.visible = !!ov;
        });
      } else if (it.type === 'polyline' || it.type === 'ring') {
        const t = tube(it.radius || 0.003, it.color || '#6e7a76', it.max || 600); grp.add(t.m, t.h); parts.push({ names: [it.name].filter(Boolean), mats: [t.m.material], halos: [t.h] });
        let key = null;
        updaters.push(() => {
          if (!when()) return;
          let pts;
          if (it.type === 'ring') { const c = V(it.c), r = V(it.r); pts = []; for (let a = 0; a <= 96; a++) pts.push([c[0] + r * Math.cos(a / 96 * 2 * Math.PI), c[1] + r * Math.sin(a / 96 * 2 * Math.PI), c[2]]); }
          else pts = (typeof it.pts === 'function' ? it.pts(stage.ctx()) : it.pts).map(p => p.map(v => v * (it.k ?? 1)));
          const kk = JSON.stringify(pts); if (kk === key) return; key = kk; fillTube(t, segMatrices(pts, it.dash));
        });
      } else if (it.type === 'points') {
        const cap = it.max || 64, r = it.r || 0.012;
        const m = new T.InstancedMesh(new T.SphereGeometry(r, 14, 10), new T.MeshStandardMaterial({ roughness: 0.5 }), cap);
        const h = new T.InstancedMesh(new T.SphereGeometry(r * 1.55, 14, 10), haloMat(), cap); h.instanceMatrix = m.instanceMatrix; h.visible = false;
        m.frustumCulled = h.frustumCulled = false; grp.add(m, h); parts.push({ names: [it.name].filter(Boolean), mats: [m.material], halos: [h] });
        const col = new T.Color(); let labels = [];
        tags.push({ many: () => grp.visible ? labels : [] });
        updaters.push(() => {
          if (!when()) { labels = []; return; }
          const pts = typeof it.pts === 'function' ? it.pts(stage.ctx()) : it.pts; let n = 0; labels = [];
          for (const p of pts) { if (n >= cap) break; S.set(1, 1, 1); P.set(p[0] * k, p[1] * k, p[2] * k); m.setMatrixAt(n, M4.compose(P, Q.identity(), S)); m.setColorAt(n, col.set(p[4] || it.color || '#20343d')); if (p[3] != null && p[3] !== '') labels.push({ at: [P.x, P.y, P.z + (it.labelLift ?? r * 1.6)], text: String(p[3]), color: p[4] || it.color }); n++; }
          m.count = h.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
        });
      } else if (it.type === 'arrow') {
        const R = it.radius || 0.006, c = it.color || '#e07a12';
        const shaft = new T.Mesh(new T.CylinderGeometry(R, R, 1, 12), mat(c)), head = new T.Mesh(new T.ConeGeometry(R * 3, R * 8, 16), mat(c)); grp.add(shaft, head); part([it.name], [shaft, head], [1.9, 1.0, 1.9]);
        updaters.push(() => {
          if (!when()) return; const a = V(it.from, k), b = V(it.to, k); if (!a || !b || a.some(v => v == null) || b.some(v => v == null)) { grp.visible = false; return; }
          const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); if (L < R * 10) { grp.visible = false; return; }
          const hl = R * 8, mid = A.clone().addScaledVector(d.clone().normalize(), L - hl); rod(a, mid.toArray(), shaft);
          head.position.copy(mid).addScaledVector(d.clone().normalize(), hl / 2); head.quaternion.setFromUnitVectors(up, d.clone().normalize());
        });
      } else if (it.type === 'frame') {
        const L = it.len || 0.1, R = it.radius || 0.004; const axes = [[1, 0, 0, '#d0342c'], [0, 1, 0, '#1f9a4a'], [0, 0, 1, '#2f5fd0']].map(([x, y, z, c]) => { const m = new T.Mesh(new T.CylinderGeometry(R, R, 1, 8), mat(c)); grp.add(m); return [x, y, z, m]; });
        updaters.push(() => { if (!when()) return; const p = V(it.at, k); for (const [x, y, z, m] of axes) rod(p, [p[0] + x * L, p[1] + y * L, p[2] + z * L], m); });
      } else if (it.type === 'label') {
        tags.push({ key: 'label-' + tags.length, at: () => when() ? V(it.at, k) : null, text: () => Kit.text(it.text, stage.ctx()), color: it.color });
      }
    }

    // ---------- drawing
    let visible = true, dirty = true;
    const v3 = new T.Vector3();
    function project(p) { if (!p || p.length < 3 || p.some(x => x == null)) return null; v3.set(p[0], p[1], p[2]).project(camera); if (v3.z > 1) return null; return [(v3.x + 1) / 2 * cv.clientWidth, (1 - v3.y) / 2 * cv.clientHeight]; }
    function placeTags() {
      const list = [];
      for (const t of tags) {
        if (t.many) { t.many().forEach((x, j) => { const p = project(x.at); if (p) list.push({ key: 'pt-' + tags.indexOf(t) + '-' + j, x: p[0], y: p[1], text: x.text, color: x.color, cls: 'kit-tag-small' }); }); continue; }
        const p = project(t.at()); if (p) list.push({ key: t.key, x: p[0], y: p[1], text: t.text(), color: t.color, cls: t.cls || 'kit-tag-small' });
      }
      const co = stage.callout;
      if (co) { const at = V(co.at3 || co.at); const p = project(at && at.length === 2 ? [at[0], at[1], spec.plane || 0] : at); if (p) list.push({ key: 'callout', x: p[0], y: p[1], text: Kit.text(co.text, stage.ctx()), cls: 'kit-tag-callout' }); }
      ovl.place(list);
    }
    function render() {
      if (!visible) { dirty = true; return; }
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (!w || !h) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      camera.aspect = w / h; camera.updateProjectionMatrix();
      paint(T, cv, scene, camera); placeTags(); dirty = false; host.dataset.frames = (+host.dataset.frames || 0) + 1;
    }
    function update() {
      for (const u of updaters) u();
      for (const p of parts) { const on = p.names.some(n => stage.focus.has(n)); for (const h of p.halos) h.visible = on; for (const m of p.mats) if (m.emissive) { m.emissive.setHex(on ? 0x553000 : 0x000000); m.emissiveIntensity = on ? 0.35 : 0; } }   // halo does the work; keep the part's own colour
      render();
    }
    let lastReq = 0;
    stage.on(causes => { if (stage.request.n !== lastReq) { lastReq = stage.request.n; if (stage.request.view && views[stage.request.view]) fly(stage.request.view); } update(); });
    new ResizeObserver(() => render()).observe(box);
    new IntersectionObserver(es => { for (const e of es) { visible = e.isIntersecting; if (visible && dirty) render(); } }, { rootMargin: '200px' }).observe(box);
    const api = { redraw: () => { dirty = true; render(); }, project, camera, controls, fly, views };
    host.kitScene3d = api; Kit.three.scenes.add(api);
    update();
  });
})(window);
