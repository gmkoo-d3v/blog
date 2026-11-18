/* View for ik-newton.js (b15_ik_newton2.py traced line by line). One frame = one executed line (state after that line).
   HANDOFF-08: 3D picture first, an opening tour instead of a "guess first" question, a recap check at the end. */
(function () {
  const fmt = Kit.fmt, Z = 0.04;
  const sci = v => v == null ? '–' : (+v).toExponential(2).replace('e-', '×10⁻').replace('e+', '×10^').replace(/⁻(\d+)/, (_, d) => '⁻' + d.split('').map(ch => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+ch]).join('')) + ' m';
  const plain = v => v >= 0.001 ? fmt(v, 3) + ' m' : sci(v);                           // 0.502 m reads easier than 5.02×10⁻¹ m
  const first = (c, line, k) => { const L = c.run.cols.line, K = c.run.cols.k; for (let i = 0; i < c.run.n; i++) if (L[i] === line && (k == null || K[i] === k)) return i; return 0; };
  const fixes = c => c.c('k') + (c.c('line') === 16 ? 1 : 0);                           // line 16 has just changed the angles
  const tip3 = c => [c.c('tx'), c.c('ty'), Z];
  Kit.data('ik-newton-view', {
    fields: {
      k: { label: '각도를 고친 횟수', value: c => `${fixes(c)}번` },
      err: { label: '남은 거리', color: '#e07a12', value: c => plain(c.c('err')) },
      pose: { label: '어깨 · 팔꿈치 각도', value: c => `${fmt(c.c('q1'), 1)}° · ${fmt(c.c('q2'), 1)}°` },
      q1: { label: '어깨', unit: '°', digits: 1, color: '#3380e6' }, q2: { label: '팔꿈치', unit: '°', digits: 1, color: '#33b380' }
    },
    scenes3d: {
      arm: {
        camera: [0.12, -0.95, 1.05], target: [0.12, 0.2, 0], label: '바닥에 놓인 두 마디 팔(위팔 0.4 m, 아래팔 0.3 m)과 목표',
        ground: { size: 2.4 }, axes: { at: [-0.55, -0.4, 0.002], len: 0.15 },
        items: [
          { type: 'cylinder', at: [0, 0, 0.02], r: 0.035, h: 0.04, color: '#4d4d4d' },
          { type: 'ring', c: [0, 0, 0.003], r: 0.7, dash: [0.025, 0.02], radius: 0.0025, color: '#8d9a95', tag: '팔이 닿는 끝 0.7 m', tagAt: [-0.5, 0.5, 0.01] },
          { type: 'points', name: 'goal', pts: c => [[c.data.goal[0], c.data.goal[1], Z, '목표 (0.5, 0.3)', '#e07a12']], r: 0.022, labelLift: 0.09 },
          { type: 'points', name: 'trail', r: 0.011, max: 20,
            pts: c => { const L = c.run.cols.line, out = []; for (let i = 0; i <= c.i; i++) if (i === 0 || L[i] === 16) out.push([c.run.cols.tx[i], c.run.cols.ty[i], 0.006, '', '#a8429a']); return out; } },
          { type: 'arm', base: [0, 0, Z], links: [0.4, 0.3], q: ['q1', 'q2'], radius: 0.018, colors: ['#3380e6', '#33b380'], names: ['upper', 'lower'], tip: 'tip', tipColor: '#ff3333', tipR: 0.014 },
          { type: 'arrow', name: 'err', from: tip3, to: c => [c.data.goal[0], c.data.goal[1], Z], color: '#e07a12', radius: 0.005, when: c => c.c('err') > 0.02 }
        ]
      }
    },
    plots: {
      err: { x: 'k', y: [{ col: 'err', digits: 3 }], only: c => c.c('line') === 12, ylog: true, markers: true, trail: true, xlabel: '고친 횟수', ylabel: '남은 거리 (m, 칸마다 10배)', height: 300, xticks: [0, 1, 2, 3, 4, 5, 6, 7] }
    },
    lineNotes: {
      9: '출발 자세를 정합니다. 팔이 출발 자세에 놓입니다.', 10: '출발 자세를 찍습니다.',
      11: '한 바퀴를 시작합니다.', 12: '목표 − 지금 손끝 = 주황 화살표(남은 거리)를 잽니다.',
      13: '남은 거리를 찍습니다. 그래프의 점 하나가 이 줄입니다.', 14: '충분히 가까운지 봅니다(10⁻⁹ m).',
      15: '충분히 가까워 멈춥니다.', 16: '화살표 쪽으로 관절 각도를 한 번 고칩니다: 팔이 움직입니다.', 17: '도착 자세를 찍습니다.'
    },
    tours: {
      main: {
        intro: '빨간 공(손끝)을 주황 공(목표)에 대려고, 각도를 조금 고치고 다시 재는 일을 되풀이합니다.',
        beats: [
          { at: c => first(c, 10), view: '기본', focus: ['upper', 'lower', 'tip'], callout: { at3: tip3, text: '손끝 (빨간 공)' },
            caption: '파란 막대(0.4 m)와 초록 막대(0.3 m)가 팔이고, 빨간 공이 손끝입니다.' },
          { at: c => first(c, 10), focus: ['goal'], callout: { at3: c => [c.data.goal[0], c.data.goal[1], Z], text: '가고 싶은 곳' },
            caption: '주황 공이 손끝을 보내고 싶은 곳(목표)입니다.' },
          { at: c => first(c, 12, 0), focus: ['err'], callout: { at3: c => [(c.c('tx') + c.data.goal[0]) / 2, (c.c('ty') + c.data.goal[1]) / 2, Z], text: '남은 거리' },
            caption: c => `주황 화살표가 손끝에서 목표까지 남은 거리입니다. 지금 ${plain(c.c('err'))}.` },
          { at: c => first(c, 16, 0), ghost: c => first(c, 12, 0), focus: ['tip', 'err'], callout: { at3: tip3, text: '한 번 고친 뒤' },
            caption: c => `화살표 쪽으로 각도를 한 번 고쳤습니다(흐린 팔 → 진한 팔). 손끝이 목표를 지나쳐 오히려 멀어졌습니다: ${plain(c.c('err'))}.` },
          { play: [c => first(c, 16, 0), null], at: c => c.run.n - 1, rate: 6, tab: '그래프', focus: ['trail', 'err'],
            caption: c => `다시 재고, 다시 고칩니다. 오른쪽 그래프처럼 남은 거리가 고칠 때마다 줄어 ${Math.max(...c.run.cols.k)}번 만에 사실상 0이 됩니다.` },
          { at: c => c.run.n - 1, tab: '코드', focus: ['line:12', 'line:16', 'tip', 'goal'],
            caption: '이 되풀이가 코드 11~16행입니다. 12행이 화살표를 재고, 16행이 각도를 고칩니다.' }
        ],
        after: '이제 마음대로: 다음 ▶으로 한 줄씩 넘기거나, 아래 “시작 (0°, 30°)”을 눌러 다른 출발 자세에서 어디에 닿는지 보세요.'
      }
    },
    recaps: {
      firstFix: {
        prompt: '방금 본 것: 처음으로 각도를 고친 직후, 손끝은 목표에 더 가까워졌나요?',
        options: [
          { text: '가까워졌다', correct: false, feedback: c => { const r = c.data.runs.s90, at = (l, k) => { for (let i = 0; i < r.n; i++) if (r.cols.line[i] === l && r.cols.k[i] === k) return r.cols.err[i]; }; return `처음 한 번은 목표를 지나쳐 ${plain(at(12, 0))}에서 ${plain(at(16, 0))}로 멀어졌습니다.`; } },
          { text: '오히려 멀어졌다', correct: true, feedback: '고치는 방향은 맞지만 한 번에 너무 많이 갔습니다. 다시 재고 고치면서 가까워집니다.' },
          { text: '그대로였다', correct: false, feedback: '팔이 움직였고 남은 거리가 바뀌었습니다.' }
        ],
        show: 3
      }
    }
  });
})();
