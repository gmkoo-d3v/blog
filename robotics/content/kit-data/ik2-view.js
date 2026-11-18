/* Formula view: drag the target, see both analytic IK answers of the 2-link arm (same formula as 두링크.py 역기구학2).
   Uses ik-newton.js for L and for checks (Python values the headless test compares against). */
(function () {
  const fmt = Kit.fmt, deg = r => r * 180 / Math.PI;
  // port of 두링크.역기구학2: returns 0..2 [shoulder, elbow] pairs in degrees
  function ik2(x, y, L1 = 0.4, L2 = 0.3) {
    const c2 = (x * x + y * y - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    if (Math.abs(c2) > 1) return [];
    const a = Math.acos(c2), out = [];
    for (const e of Math.abs(Math.abs(c2) - 1) < 1e-8 ? [a] : [-a, a]) {
      const s = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(e), L1 + L2 * Math.cos(e));
      out.push([deg(((s + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI), deg(e)]);
    }
    return out;
  }
  const sol = (c, k) => { const p = c.params.target; return ik2(p[0], p[1])[k]; };
  Kit.data('ik2-view', {
    formulas: { ik2 },
    params: { target: [0.5, 0.3] },
    fields: {
      dist: { label: '어깨에서 목표까지', value: c => fmt(Math.hypot(...c.params.target), 3) + ' m' },
      count: { label: '답의 개수', value: c => { const n = ik2(...c.params.target).length; return n + '개' + (n === 0 ? ' (닿지 않음)' : n === 1 ? ' (쭉 편 경계)' : ''); } },
      a: { label: '답 A (팔꿈치 −)', color: '#2f6fd0', value: c => { const s = sol(c, 0); return s ? `(${fmt(s[0], 1)}°, ${fmt(s[1], 1)}°)` : '없음'; } },
      b: { label: '답 B (팔꿈치 +)', color: '#1f9a6a', value: c => { const s = sol(c, 1); return s ? `(${fmt(s[0], 1)}°, ${fmt(s[1], 1)}°)` : '–'; } }
    },
    scenes: {
      ik2: {
        xr: [-0.8, 0.8], yr: [-0.45, 0.8], grid: 0.1, label: '2링크 팔의 두 역기구학 답과 닿는 범위',
        legend: [['#2f6fd0', '답 A: 팔꿈치 − 쪽', 'line'], ['#1f9a6a', '답 B: 팔꿈치 + 쪽', 'line'], ['#d4691c', '목표 (끌어서 옮김)', 'dot']],
        items: [
          { type: 'circle', c: [0, 0], r: 0.7, dash: true },
          { type: 'text', at: [-0.79, 0.6], text: '점선 원 0.7 m: 팔을 쭉 편 끝', color: '#5c6c72' },
          { type: 'circle', name: 'near', c: [0, 0], r: 0.1, dash: true, fill: 'rgba(200,60,60,.07)' },
          { type: 'text', at: [0.03, -0.06], text: '0.1 m 안: 닿지 않음', color: '#a03c22' },
          { type: 'arm', name: 'armA', base: [0, 0], links: [0.4, 0.3], q: c => sol(c, 0) || [0, 0], colors: ['#2f6fd0', '#2f6fd0'], when: c => !!sol(c, 0) },
          { type: 'arm', name: 'armB', base: [0, 0], links: [0.4, 0.3], q: c => sol(c, 1) || [0, 0], colors: ['#1f9a6a', '#1f9a6a'], when: c => !!sol(c, 1) },
          { type: 'handle', name: 'target', param: 'target', label: c => `목표 (${fmt(c.params.target[0], 2)}, ${fmt(c.params.target[1], 2)})` }
        ]
      }
    },
    tours: {
      main: {
        intro: '위에서 본 두 마디 팔입니다. 주황 고리(목표)에 손끝이 닿는 자세를 식으로 바로 구합니다.',
        beats: [
          { set: { target: [0.5, 0.3] }, focus: ['target'], callout: { at: c => c.params.target, text: '목표: 끌어서 옮김' },
            caption: '주황 고리가 손끝을 보낼 곳(목표)입니다. 마우스로 끌거나, 그림을 누른 뒤 방향키로 옮깁니다.' },
          { set: { target: [0.5, 0.3] }, focus: ['armA', 'armB', 'a', 'b'], callout: { at: c => c.params.target, text: '자세 두 가지' },
            caption: '같은 목표에 닿는 팔 자세가 두 가지입니다: 파랑(팔꿈치를 한쪽으로)과 초록(반대쪽으로).' },
          { set: { target: [0, 0.05] }, focus: ['count', 'near'], callout: { at: [0, 0.05], text: '어깨에 너무 가까움' },
            caption: '어깨 바로 옆(빨간 원 안)은 팔을 어떻게 접어도 닿지 않습니다. 답이 0개입니다.' }
        ],
        after: '이제 마음대로: 고리를 끌어 답이 두 개, 한 개, 0개가 되는 곳을 찾아보세요. 오른쪽 표의 줄을 누르면 그 목표로 옮겨집니다.'
      }
    },
    tables: {
      ikchecks: {
        caption: '같은 목표를 오너의 두링크.py(역기구학2)로 계산한 값. 줄을 누르면 그 목표로 옮깁니다.',
        cols: [{ key: 'xy', label: '목표 (m)' }, { key: 'py', label: 'Python 답' }],
        rows: c => c.data.checks.ik.map(r => ({ set: { target: [r.x, r.y] }, xy: `(${r.x}, ${r.y})`, py: r.sol.length ? r.sol.map(s => `(${fmt(s[0], 3)}°, ${fmt(s[1], 3)}°)`).join(' · ') : '답 없음',
                                               match: cc => Math.abs(cc.params.target[0] - r.x) < 1e-9 && Math.abs(cc.params.target[1] - r.y) < 1e-9 }))
      }
    }
  });
})();
