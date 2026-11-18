/* View for slip-noise.js (b04_slip_noise.py run as is and with --slip 0.4). Frames: setup, each finished run, each print.
   HANDOFF-08: the floor in 3D (where the robot drives), code and output beside it, an opening tour. */
(function () {
  const fmt = Kit.fmt, NAME = ['열린 고리', '닫힌 고리'], COL = ['#e8312a', '#2f6fd0'];
  const firstAt = (c, test) => { for (let i = 0; i < c.run.n; i++) if (test(i, c.run.cols)) return i; return 0; };
  const printAt = (c, m) => firstAt(c, (i, C) => C.line[i] === 37 && C.m[i] === m);
  const finished = (c, m, n) => firstAt(c, (i, C) => C.line[i] === 36 && C.m[i] === m && C.n[i] - (m ? 20 : 0) >= n);
  const endOf = (run, r) => run.ends[r];
  // end points of the runs finished so far (method m), plus the compare run's in grey
  const ends = m => c => {
    const out = [], upto = c.c('r');
    for (let r = 0; r <= upto; r++) if (c.run.methods[r] === m) { const e = endOf(c.run, r); out.push([e[0] / 1000, e[1] / 1000, 0.02, '', COL[m]]); }
    const ov = c.stage.overlay;
    if (ov) for (let r = 0; r <= upto && r < ov.ends.length; r++) if (ov.methods[r] === m) { const e = ov.ends[r]; out.push([e[0] / 1000, e[1] / 1000, 0.02, '', '#8c969a']); }
    return out;
  };
  const pathOf = m => c => { const r = c.c('r'); if (r < 0 || c.run.methods[r] !== m) return []; const p = c.run.paths[r], out = []; for (let k = 0; k < p.length; k += 2) out.push([p[k] / 1000, p[k + 1] / 1000, 0.006]); return out; };
  const robotAt = c => { const r = c.c('r'); if (r < 0) return [0, 0, 0.03]; const e = endOf(c.run, r); return [e[0] / 1000, e[1] / 1000, 0.03]; };
  Kit.data('slip-noise-view', {
    fields: {
      who: { label: '방금 끝난 실행', value: c => c.c('r') < 0 ? '아직 시작 전' : `${NAME[c.c('m')]} ${c.c('r') % 20 + 1}/20` },
      mean: { label: '목표까지 남은 거리 (평균)', value: c => c.c('mean') == null ? '–' : fmt(c.c('mean'), 3) + ' m' },
      max: { label: '가장 멀었을 때', value: c => c.c('max') == null ? '–' : fmt(c.c('max'), 3) + ' m' },
      slip: { label: '미끄러짐 · 잡음', value: c => `${c.run.slip} · ${c.run.noise} m` }
    },
    scenes3d: {
      floor: {
        camera: [0.95, -1.45, 2.55], target: [0.95, 0.45, 0], views: { '목표 가까이': { camera: [1.8, -0.2, 1.1], target: [1.85, 0.85, 0] } }, label: '바닥을 비스듬히 본 그림: 출발점, 목표, 실행마다 로봇이 멈춘 곳',
        ground: { size: 6 }, axes: { at: [0.3, -0.3, 0.002], len: 0.25 },
        items: [
          { type: 'points', name: 'start', pts: [[0, 0, 0.02, '출발 (0, 0)', '#20343d']], r: 0.035 },
          // the goal is a ring on the floor, not a ball: the blue end points land inside it and must stay visible
          { type: 'ring', name: 'goal', c: c => [c.data.goal[0], c.data.goal[1], 0.004], r: 0.06, radius: 0.007, color: '#e07a12', tag: '목표 (2, 1)', tagAt: c => [c.data.goal[0] + 0.07, c.data.goal[1] - 0.07, 0.02], tagColor: '#b4570c' },
          { type: 'polyline', name: 'path', pts: pathOf(0), radius: 0.006, color: COL[0], max: 400 },
          { type: 'polyline', name: 'path', pts: pathOf(1), radius: 0.006, color: COL[1], max: 400 },
          { type: 'points', name: 'openEnds', pts: ends(0), r: 0.02, max: 48 },
          { type: 'points', name: 'closedEnds', pts: ends(1), r: 0.02, max: 48 },
        ]
      }
    },
    tours: {
      main: {
        intro: '바닥 위 로봇을 (0, 0)에서 (2, 1)로 보내는 일을 두 방법으로 20번씩 해 본 결과입니다. 점 하나가 한 번의 도착입니다.',
        start: { t: 1e9 },
        beats: [
          { t: 0, view: '기본', tab: '코드', focus: ['start', 'goal', 'line:7'], callout: { at3: c => [c.data.goal[0], c.data.goal[1], 0.02], text: '목표 (2, 1)' },
            caption: '검은 점에서 출발해 주황 점(목표)까지 가는 것이 할 일입니다. 코드 7행이 이 두 점을 정합니다.' },
          { at: c => finished(c, 0, 1), focus: ['path', 'openEnds'], callout: { at3: robotAt, text: '1번째 도착' },
            caption: '첫 방법(열린 고리)은 정해 둔 만큼만 움직이고 멈춥니다. 바퀴가 미끄러져 덜 가고 왼쪽으로 샜습니다.' },
          { play: [c => finished(c, 0, 1), null], at: c => finished(c, 0, 20), rate: 8, view: '목표 가까이', focus: ['openEnds'], callout: { at3: robotAt, text: '빨간 점 20개' },
            caption: '20번 해 보면 빨간 점이 모두 목표에 못 미친 왼쪽 위에 모입니다. 매번 덜 가고 왼쪽으로 새기 때문입니다.' },
          { at: c => printAt(c, 0), tab: '코드', focus: ['line:37', 'mean', 'openEnds'],
            caption: c => `파일이 찍은 첫 줄: 열린 고리는 평균 ${fmt(c.c('mean'), 3)} m 모자랐습니다. 오른쪽 출력의 노란 줄이 이 순간입니다.` },
          { play: [c => printAt(c, 0), null], at: c => finished(c, 1, 20), rate: 8, view: '목표 가까이', focus: ['closedEnds'], callout: { at3: c => [c.data.goal[0], c.data.goal[1] + 0.12, 0.02], text: '파란 점 20개 (주황 원 안)' },
            caption: '둘째 방법(닫힌 고리)은 가는 도중 위치를 다시 재고, 덜 간 만큼 더 갑니다. 파란 점은 목표 위에 모입니다.' },
          { at: c => printAt(c, 1), tab: '코드', focus: ['line:37', 'mean', 'closedEnds'],
            caption: c => { const a = c.run.cols.mean[printAt(c, 0)], b = c.c('mean'); return `둘째 줄: 닫힌 고리는 평균 ${fmt(b, 3)} m. 같은 미끄러짐인데 다시 재니 약 ${Math.round(a / b)}배 가깝습니다.`; } }
        ],
        after: '이제 마음대로: 다음 ▶ 또는 ▶ 자동, 출력 줄 누르기, 아래 “--slip 0.4”로 미끄러짐을 두 배로 바꿔 보기.'
      }
    },
    lineNotes: (L, c) => ({
      7: '출발 (0, 0)과 목표 (2, 1)를 정합니다. 그림의 검은 점과 주황 점입니다.',
      36: c.c('r') >= 0 ? `${NAME[c.c('m')]} ${c.c('r') % 20 + 1}번째가 끝났습니다. 바닥에 점 하나가 생깁니다(선은 그 실행의 길).` : '',
      37: `${NAME[c.c('m')]} 20번의 평균과 가장 먼 값을 찍습니다. 출력의 노란 줄입니다.`
    })[L] || '',
    recaps: {
      where: {
        prompt: '방금 본 것: 빨간 점(열린 고리)은 목표에 비해 어디에 모였나요?',
        options: [
          { text: '목표 위에 겹쳤다', correct: false, feedback: '목표 위에 모인 것은 파란 점(닫힌 고리)입니다.' },
          { text: '목표에 못 미친 왼쪽 위에 모였다', correct: true, feedback: '미끄러지면 덜 가고 왼쪽으로 샙니다. 다시 재지 않으니 고치지도 못합니다.' },
          { text: '목표를 지나친 쪽에 모였다', correct: false, feedback: '미끄러지면 덜 갑니다. 지나치지는 않았습니다.' }
        ],
        show: 2
      }
    }
  });
})();
