/* One idea: every number on a robot spec sheet lands in exactly one MJCF attribute. Edit a spec value and the attribute it
   becomes lights up in the XML. The XML and the read-back numbers come from the pure math below, which verify_d3_batch2.py
   compares with a real MuJoCo 3.17.0 load for the default and for many random specs. The top view is an illustration. */
(function (root) {
  'use strict';
  const DEFAULT = { L1: 0.30, L2: 0.25, m1: 0.3, m2: 0.2, useRange: true, rangeDeg: 150, useForce: true, force: 5, ctrl: 3.14, kp: 50 };
  const n2 = x => (Math.round(x * 100) / 100).toFixed(2);
  const g = x => String(Math.round(x * 1000) / 1000);
  const T = (t, k) => [t, k || null];
  // each line = list of [text, specKey] pieces; a piece with a key is the attribute value that spec number becomes
  function xmlLines(s) {
    const posAttr = [T('<position kp="'), T(g(s.kp), 'kp'), T('" dampratio="1" ctrlrange="'), T('-' + g(s.ctrl) + ' ' + g(s.ctrl), 'ctrl')];
    if (s.useForce) posAttr.push(T('" forcerange="'), T('-' + g(s.force) + ' ' + g(s.force), 'force'));
    posAttr.push(T('"/>'));
    const rng = s.useRange ? [T(' range="'), T('-' + g(s.rangeDeg) + ' ' + g(s.rangeDeg), 'range'), T('"')] : [];
    return [
      [T('<mujoco model="spec arm">')],
      [T('  <default>')],
      [T('    <joint type="hinge" axis="0 0 1" damping="0.05"/>')],
      [T('    ')].concat(posAttr),
      [T('  </default>')],
      [T('  <worldbody>')],
      [T('    <body name="upper">')],
      [T('      <joint name="shoulder"')].concat(rng, [T('/>')]),
      [T('      <geom type="capsule" fromto="0 0 0 '), T(n2(s.L1), 'L1'), T(' 0 0" size="0.02" mass="'), T(g(s.m1), 'm1'), T('"/>')],
      [T('      <body name="lower" pos="'), T(n2(s.L1), 'L1'), T(' 0 0">')],
      [T('        <joint name="elbow"')].concat(rng, [T('/>')]),
      [T('        <geom type="capsule" fromto="0 0 0 '), T(n2(s.L2), 'L2'), T(' 0 0" size="0.018" mass="'), T(g(s.m2), 'm2'), T('"/>')],
      [T('        <site name="tip" pos="'), T(n2(s.L2), 'L2'), T(' 0 0"/>')],
      [T('      </body>')],
      [T('    </body>')],
      [T('  </worldbody>')],
      [T('  <actuator>')],
      [T('    <position name="shoulder" joint="shoulder"/>')],
      [T('    <position name="elbow" joint="elbow"/>')],
      [T('  </actuator>')],
      [T('</mujoco>')]
    ];
  }
  const xmlText = s => xmlLines(s).map(l => l.map(p => p[0]).join('')).join('\n');
  // what model.* reports after loading the XML above (angles come back in radians; ctrlrange is not an angle conversion)
  function readback(s) {
    const r = s.rangeDeg * Math.PI / 180;
    return { dof: 2, reach: s.L1 + s.L2, mass: [s.m1, s.m2], total: s.m1 + s.m2, jrange: s.useRange ? [-r, r] : null, forcerange: s.useForce ? [-s.force, s.force] : null, ctrlrange: [-s.ctrl, s.ctrl], kp: s.kp };
  }
  const math = { DEFAULT, xmlLines, xmlText, readback };
  if (typeof module !== 'undefined' && module.exports) module.exports = math;
  if (!root.document) return;
  root.SpecSheetMath = math;
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  // [key, label, spec item, min, max, step, unit, optional toggle]
  const FIELDS = [['L1', '위팔 길이', '링크 길이', 0.1, 0.6, 0.05, 'm'], ['L2', '아래팔 길이', '링크 길이', 0.1, 0.6, 0.05, 'm'], ['m1', '위팔 질량', '링크 질량', 0.1, 1, 0.1, 'kg'], ['m2', '아래팔 질량', '링크 질량', 0.1, 1, 0.1, 'kg'],
    ['rangeDeg', '가동 범위 ±', '가동 범위', 30, 180, 10, '°', 'useRange'], ['force', '최대 토크 ±', '최대 토크', 1, 20, 1, 'N·m', 'useForce'], ['ctrl', '명령 범위 ±', '명령 범위', 1, 3.14, 0.01, 'rad'], ['kp', '단단함 kp', '제어 방식', 10, 200, 10, '']];
  const ATTR = { L1: 'lower pos · geom fromto', L2: 'geom fromto · site pos', m1: 'geom mass', m2: 'geom mass', range: 'joint range (도)', force: 'forcerange', ctrl: 'ctrlrange', kp: 'position kp' };
  function init(host) {
    host.classList.add('b2-demo');
    host.innerHTML = `<h3>직접 바꿔 보기: 제원표 숫자가 어느 속성이 될까</h3>
      <p class="b2-how">왼쪽 숫자를 바꾸면 오른쪽 XML에서 그 숫자가 들어가는 자리가 노랗게 켜집니다. 한 숫자가 두 군데에 들어가는 경우도 있습니다(위팔 길이).</p>
      <div class="b2-spec"><div class="b2-specform"></div><pre class="b2-xml" aria-live="polite"></pre></div>
      <div class="b2-two"><canvas class="b2-top" height="360" aria-label="팔을 위에서 본 그림. 길이와 가동 범위가 입력값에 맞게 바뀝니다"></canvas><div class="b2-readout" data-readout aria-live="polite"></div></div>
      <p class="small">XML 글과 읽어 온 값은 같은 규칙으로 만든 것이고, 이 규칙을 MuJoCo 3.17.0으로 직접 불러 본 결과(기본 값과 무작위 제원 여러 개)와 맞춰 보았습니다. 위에서 본 그림은 MuJoCo가 그린 것이 아니라 캔버스로 그린 설명용 그림입니다.</p>`;
    const s = Object.assign({}, DEFAULT); let active = null;
    const form = host.querySelector('.b2-specform'), pre = host.querySelector('.b2-xml'), out = host.querySelector('[data-readout]'), cv = host.querySelector('.b2-top'), ctx = cv.getContext('2d');
    const outs = {};
    for (const [k, label, item, min, max, step, unit, tog] of FIELDS) {
      const row = make('div', '', 'b2-specrow'); const lab = make('label'); lab.append(make('span', item + ' · ', 'b2-item'), label + ' ', make('output')); const i = make('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = s[k]; i.dataset.key = k; i.setAttribute('aria-label', label); lab.append(i); row.append(lab);
      const key = k === 'rangeDeg' ? 'range' : k; outs[k] = lab.querySelector('output');
      i.addEventListener('input', () => { s[k] = +i.value; active = key; draw(); }); i.addEventListener('focus', () => { active = key; draw(); }); row.addEventListener('mouseenter', () => { active = key; draw(); });
      if (tog) { const c = make('input'); c.type = 'checkbox'; c.checked = s[tog]; c.setAttribute('aria-label', label + ' 쓰기'); const cl = make('label', ' 쓰기', 'b2-chk'); cl.prepend(c); row.append(cl); c.addEventListener('change', () => { s[tog] = c.checked; i.disabled = !c.checked; active = key; draw(); }); }
      form.append(row);
    }
    form.append(make('p', '체크를 끄면 그 속성을 아예 적지 않습니다. 그러면 “제한 없음”입니다(팔장면.py의 가동 범위와 최대 토크가 이 경우입니다).', 'small'));
    function top() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const reach0 = s.L1 + s.L2, sc = (h / 2 - 34) / Math.max(0.6, reach0); if (!(sc > 20)) return; const ox = w * 0.5, oy = h / 2 + 12; const P = (x, y) => [ox + x * sc, oy - y * sc];
      const reach = s.L1 + s.L2; ctx.setLineDash([5, 4]); ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ox, oy, reach * sc, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const a1 = 30 * Math.PI / 180, a2 = a1 + 60 * Math.PI / 180, e = [s.L1 * Math.cos(a1), s.L1 * Math.sin(a1)], tip = [e[0] + s.L2 * Math.cos(a2), e[1] + s.L2 * Math.sin(a2)];
      if (s.useRange) { const R = s.rangeDeg * Math.PI / 180; ctx.fillStyle = 'rgba(225,106,32,.16)'; ctx.strokeStyle = 'rgba(225,106,32,.6)'; for (const [c, base] of [[[0, 0], 0], [e, a1]]) { const [cx, cy] = P(c[0], c[1]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 0.2 * sc, -(base + R), -(base - R)); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
      const [bx, by] = P(0, 0), [ex, ey] = P(...e), [tx, ty] = P(...tip); ctx.lineCap = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = '#286e99'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); ctx.strokeStyle = '#2a9d6c'; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; for (const [x, y] of [[bx, by], [ex, ey]]) { ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.stroke(); } ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(tx, ty, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#444'; ctx.font = '13px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('위에서 본 그림 (어깨 30°, 팔꿈치 60°)', w - 8, 18); ctx.fillText('점선 원: 닿는 최대 거리 ' + n2(reach) + ' m', w - 8, 38); if (s.useRange) ctx.fillText('주황 부채꼴 = 가동 범위(관절마다 ±' + s.rangeDeg + '°)', w - 8, 58);
    }
    function draw() {
      for (const [k, , , , , , unit] of FIELDS) outs[k].textContent = (k === 'L1' || k === 'L2' ? n2(s[k]) : g(s[k])) + ' ' + unit;
      pre.innerHTML = '';
      for (const line of xmlLines(s)) { const row = make('span', '', 'b2-line'); for (const [t, k] of line) row.append(k ? make('span', t, 'b2-val' + (k === active ? ' b2-hit' : '')) : document.createTextNode(t)); row.append('\n'); pre.append(row); }
      const r = readback(s), rr = r.jrange ? '[[' + r.jrange.map(x => n2(x)).join(', ') + '], 같은 값]' : '(제한 없음: jnt_limited = False)', fr = r.forcerange ? '[' + r.forcerange.join(', ') + '] N·m' : '(제한 없음)';
      out.innerHTML = `<b>이 XML을 MuJoCo로 불러 읽으면</b><br>자유도 <code>model.nv</code> = ${r.dof}<br>질량 <code>model.body_mass[1:]</code> = [${g(r.mass[0])}, ${g(r.mass[1])}] kg (합 ${g(r.total)})<br>손끝 <code>data.site("tip").xpos</code> (관절 0°) = [${n2(r.reach)}, 0, 0] m<br>가동 범위 <code>model.jnt_range</code> = ${rr} rad<br>토크 한계 <code>model.actuator_forcerange[0]</code> = ${fr}<br>명령 범위 <code>model.actuator_ctrlrange[0]</code> = [${g(-s.ctrl)}, ${g(s.ctrl)}] (적은 숫자 그대로)<br><span class="b2-sub">지금 켜진 속성: ${active ? ATTR[active] : '(숫자를 바꿔 보세요)'}</span>`;
      top();
    }
    new ResizeObserver(top).observe(cv); draw();
  }
  document.querySelectorAll('[data-spec-sheet-demo]').forEach(host => { let done = false; function start() { if (done || host.closest('details:not([open])') || !host.getClientRects().length || !host.clientWidth) return; done = true; try { init(host); } catch (e) { host.textContent = '그림을 그릴 수 없습니다.'; console.error(e); } } document.addEventListener('toggle', () => requestAnimationFrame(start), true); requestAnimationFrame(start); });
})(typeof window === 'undefined' ? globalThis : window);
