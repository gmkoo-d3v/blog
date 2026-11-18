/* View for b23-arm.js (numbers generated from the LECTURE FORM of b23_arm_points.py: four targets, four printed lines).
   Hand-written: what to draw and the opening tour, not what happened. HANDOFF-08: 3D picture first, tour instead of a question. */
(function () {
  const fmt = (v, d) => Kit.fmt(v, d);
  const L1 = 0.30, L2 = 0.25, Z = 0.45;                 // 팔장면.py: link lengths and the arm's plane height (m)
  const goalOf = (run, k) => run.goals[Math.max(0, Math.min(run.goals.length - 1, k))];
  const segOf = ctx => Math.min(ctx.run.targets.length - 1, Math.floor(ctx.c('t') / ctx.run.hold - 1e-9));
  // sideways distance of the real fingertip from the straight dashed line through the previous and the current target
  function offLine(ctx) {
    const k = segOf(ctx); if (k < 1) return null;
    const a = goalOf(ctx.run, k - 1), b = goalOf(ctx.run, k), p = [ctx.c('TX') / 1000, ctx.c('TY') / 1000];
    const d = [b[0] - a[0], b[1] - a[1]];
    return Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / Math.hypot(...d);
  }
  // frame where the tip is farthest from the dashed line while going to target k (0-based)
  function widest(c, k) {
    let best = 0, bi = 0; for (let i = 0; i < c.run.n; i++) { const cc = c.stage.ctx(c.run, i); if (segOf(cc) !== k) continue; const d = offLine(cc); if (d > best) { best = d; bi = i; } }
    return { i: bi, mm: best * 1000 };
  }
  function settle(run, k, col, tcol) {                  // first time after the target change within 1° of the new target
    const T = run.cols.t, A = run.cols[col], G = run.cols[tcol], t0 = k * run.hold, t1 = (k + 1) * run.hold;
    for (let i = 0; i < run.n; i++) if (T[i] > t0 + 1e-9 && T[i] <= t1 + 1e-9 && Math.abs(A[i] - G[i]) <= 1) return T[i] - t0;
    return null;
  }
  const endIndex = (run, k) => { const T = run.cols.t, t = (k + 1) * run.hold; let best = 0; for (let i = 0; i < run.n; i++) if (T[i] <= t + 1e-9) best = i; return best; };
  const tip3 = c => [c.c('TX') / 1000, c.c('TY') / 1000, Z];
  const box3 = c => [c.c('BX') / 1000, c.c('BY') / 1000, c.c('BZ') / 1000 + 0.03];
  Kit.data('b23-arm-view', {
    fields: {
      t: { label: '시간', unit: 's' },
      S: { label: '어깨 각도 (파란 막대)', unit: '°', digits: 1, color: '#3380e6' }, E: { label: '팔꿈치 각도 (초록 막대)', unit: '°', digits: 1, color: '#33b380' },
      TS: { label: '어깨 목표', unit: '°', digits: 0, color: '#3380e6' }, TE: { label: '팔꿈치 목표', unit: '°', digits: 0, color: '#33b380' },
      target: { label: '지금 가는 곳', value: c => `${segOf(c) + 1}번 점` },
      off: { label: '점선에서 벗어남', value: c => { const d = offLine(c); return d == null ? '1번으로 가는 중' : fmt(d * 1000, 0) + ' mm'; } },
      block: { label: '노란 상자', value: c => c.c('BZ') < 200 ? '바닥으로 떨어짐' : Math.hypot(c.c('BX') - 400, c.c('BY') - 150) > 3 ? '밀려 움직임' : '처음 자리' }
    },
    scenes3d: {
      arm: {
        // the owner's XML: table 0.8×0.7×0.4 m at x=0.3, arm plane 0.45 m, colours from rgba; camera like the model's 'overview'
        camera: [0.88, -0.78, 0.98], target: [0.3, -0.02, 0.42], label: '탁자 위의 두 마디 팔과 노란 상자 (팔장면.py와 같은 크기와 색)',
        axes: { at: [0.7, -0.35, 0.401], len: 0.12 },
        items: [
          { type: 'cuboid', name: 'table', center: [0.3, 0, 0.2], half: [0.4, 0.35, 0.2], color: '#bf9973' },
          { type: 'cylinder', at: [0, 0, 0.425], r: 0.04, h: 0.05, color: '#4d4d4d' },
          { type: 'polyline', name: 'line', pts: c => c.run.goals.map(g => [g[0], g[1], Z]), dash: [0.014, 0.01], radius: 0.0028, color: '#55625d' },
          { type: 'points', name: 'goals', pts: c => c.run.goals.map((g, k) => [g[0], g[1], Z, String(k + 1), '#20343d']), r: 0.009 },
          { type: 'path', name: 'path', x: 'TX', y: 'TY', z: Z, k: 0.001, upto: true, color: '#e8312a', radius: 0.0035 },
          { type: 'arm', base: [0, 0, Z], links: [L1, L2], q: ['S', 'E'], radius: 0.02, colors: ['#3380e6', '#33b380'], names: ['upper', 'lower'], tip: 'tip', tipColor: '#ff3333', tipR: 0.013 },
          { type: 'cuboid', name: 'block', center: ['BX', 'BY', 'BZ'], k: 0.001, half: [0.03, 0.03, 0.03], quat: ['QW', 'QX', 'QY', 'QZ'], color: '#f2bf1a' }
        ]
      }
    },
    plots: {
      joints: { x: 't', y: ['S', 'E', { col: 'TS', dash: true, step: true, cursor: false }, { col: 'TE', dash: true, step: true, cursor: false }], ylabel: '관절 각도 (°)', height: 300 }
    },
    tables: {
      goals: {
        caption: '점마다: 각 관절이 새 목표 1° 안에 처음 들어온 때, 1초 뒤 손끝이 점에서 떨어진 거리',
        cols: [{ key: 'n', label: '점' }, { key: 'q', label: '목표 각 (어깨, 팔꿈치)' }, { key: 'ts', label: '어깨 1° 안' }, { key: 'te', label: '팔꿈치 1° 안' }, { key: 'err', label: '1초 뒤' }],
        rows: c => c.run.targets.map((q, k) => {
          const i = endIndex(c.run, k), g = c.run.goals[k], e = Math.hypot(c.run.cols.TX[i] / 1000 - g[0], c.run.cols.TY[i] / 1000 - g[1]);
          const s1 = settle(c.run, k, 'S', 'TS'), s2 = settle(c.run, k, 'E', 'TE');
          return { t: k * c.run.hold, n: k + 1, q: `(${fmt(q[0], 0)}°, ${fmt(q[1], 0)}°)`, ts: s1 == null ? '–' : fmt(s1, 2) + ' s', te: s2 == null ? '–' : fmt(s2, 2) + ' s', err: fmt(e * 1000, 1) + ' mm' };
        }),
        hint: '줄을 누르면 그 점으로 목표가 바뀐 순간으로 갑니다.'
      }
    },
    codes: { main: { show: d => [d.lines.ctrl - 4, d.lines.print + 1] } },
    lineNotes: (L, c) => {
      const d = c.data.lines;
      if (L === d.ctrl) return `${segOf(c) + 1}번 점의 관절 각도를 목표로 줍니다. 그래프의 점선이 계단처럼 뜁니다.`;
      if (L === d.step) return '시간을 조금씩 흘리는 중: 팔이 목표 각도를 따라가고, 손끝이 빨간 길을 그립니다.';
      if (L === d.print) return '도착한 손끝과 점의 차이를 찍었습니다. 아래 출력의 노란 줄입니다.';
      return '';
    },
    tours: {
      main: {
        intro: '팔이 탁자 위의 점 네 개를 1초씩 차례로 찾아갑니다. 손끝이 지나간 길이 빨간 선입니다.',
        start: { t: 4 },
        beats: [
          { t: 0.01, view: '기본', focus: ['upper', 'lower', 'tip'], callout: { at3: tip3, text: '손끝 (빨간 공)' },
            caption: '파란 막대와 초록 막대가 팔이고, 끝의 빨간 공이 손끝입니다.' },
          { t: 0.01, focus: ['goals'], callout: { at3: c => [c.run.goals[0][0], c.run.goals[0][1], Z], text: '1번 점' },
            caption: '검은 점 1~4는 손끝이 차례로 가야 할 곳입니다. 1초마다 다음 점이 목표가 됩니다.' },
          { play: [0.01, 1.0], focus: ['tip', 'path'], callout: { at3: tip3, text: '지나간 길' },
            caption: '손끝이 1번 점으로 갑니다. 지나간 자리가 빨간 선으로 남습니다.' },
          { play: [2.0, 2.5], at: c => widest(c, 2).i, ghost: 2.0, focus: ['line', 'path', 'off'], callout: { at3: tip3, text: '점선에서 벗어남' },
            caption: c => `2번에서 3번으로 갈 때, 빨간 길이 회색 점선(곧은 길)에서 ${fmt(widest(c, 2).mm, 0)} mm까지 벗어나 휩니다. 흐린 팔은 출발 자세입니다.` },
          { t: 2.04, ghost: 2.0, tab: '그래프', focus: ['S', 'E', 'upper', 'lower'], callout: { at3: c => [L1 * Math.cos(c.c('S') * Math.PI / 180), L1 * Math.sin(c.c('S') * Math.PI / 180), Z], text: '팔꿈치가 먼저 꺾임' },
            caption: '왜 휠까요? 오른쪽 그래프에서 초록(팔꿈치)이 파랑(어깨)보다 먼저 새 목표에 닿습니다. 두 관절이 따로 도니 길이 곧지 않습니다.' },
          { t: 4, tab: '표', focus: ['block'], callout: { at3: box3, text: '처음 자리 그대로' },
            caption: '네 점에 모두 도착했지만 노란 상자는 한 번도 닿지 않았습니다. 점에 도착했다고 상자 밀기가 된 것은 아닙니다.' }
        ],
        after: '이제 마음대로: 재생하고, 끌어서 돌려 보세요. “마지막 목표만 (60°, 0°)”은 같은 코드로 상자를 떨어뜨립니다.'
      }
    },
    recaps: {
      bend: {
        prompt: '방금 본 것: 2번 점에서 3번 점으로 갈 때, 손끝은 회색 점선 위로 곧게 갔나요?',
        options: [
          { text: '네, 점선 위로 곧게 갔다', correct: false, feedback: '빨간 길이 점선에서 크게 벗어났습니다. 아래 단추로 그 장면을 다시 보세요.' },
          { text: '아니요, 점선에서 벗어나 휘어 갔다', correct: true, feedback: '두 관절이 각자 목표 각도로만 가고, 손끝의 길은 아무도 정하지 않았습니다.' },
          { text: '3번 점에 도착하지 못했다', correct: false, feedback: '도착은 했습니다(표의 “1초 뒤” 칸). 휜 것은 가는 길입니다.' }
        ],
        show: 3
      }
    }
  });
})();
