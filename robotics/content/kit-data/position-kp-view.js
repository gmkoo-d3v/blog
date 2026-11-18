/* View for position-kp.js: stored MuJoCo runs of b15_position_kp.py's 응답() for every kp x dampratio pair.
   HANDOFF-08: the pendulum is a physical scene, so the picture is 3D (hinge 1 m up, 0.5 m rod, 1 kg bob; turning about +y). */
(function () {
  const fmt = Kit.fmt, H = 1.0, Lr = 0.5;
  const bob = A => { const th = A * Math.PI / 180; return [-Lr * Math.sin(th), 0, H - Lr * Math.cos(th)]; };   // hinge about +y: +θ swings to −x
  Kit.data('position-kp-view', {
    fields: {
      t: { label: '시간', unit: 's' },
      A: { label: '막대 각도', unit: '°', digits: 1, color: '#3380e6' },
      setting: { label: 'XML 한 줄', value: c => `<position ${c.run.setting}/>` },
      range: { label: '3초 동안 오간 범위', value: c => `${fmt(c.run.min, 1)}° ~ ${fmt(c.run.max, 1)}°` },
      end: { label: '3초 뒤 각도 (목표 60°)', value: c => `${fmt(c.run.end, 1)}° (목표와 ${fmt(Math.abs(60 - c.run.end), 1)}° 차이)` }
    },
    explorers: {
      kp: {
        params: [
          { key: 'kp', label: 'kp (얼마나 세게 당기나)', values: [5, 10, 20, 50, 100], value: 20 },
          { key: 'dr', label: 'dampratio (흔들림 줄이기)', values: [0, 0.25, 0.5, 1, 2], value: 0, format: v => v === 0 ? '0 (없음)' : String(v) }
        ],
        presets: [
          { label: 'kp=20, 감쇠 없음', set: { kp: 20, dr: 0 } },
          { label: 'kp=20, dampratio=1', set: { kp: 20, dr: 1 } },
          { label: 'kp=100, dampratio=1', set: { kp: 100, dr: 1 } }
        ],
        key: p => `${p.kp}|${p.dr}`
      }
    },
    plots: {
      angle: { x: 't', y: ['A'], yr: [-5, 125], hlines: [{ y: 60, label: '목표 60°' }], ylabel: '막대 각도 (°)', height: 300 }
    },
    scenes3d: {
      side: {
        camera: [0.4, -1.3, 1.05], target: [-0.2, 0, 0.82], label: '진자: 1 m 높이의 축, 0.5 m 막대, 끝에 1 kg 추',
        ground: { size: 2.4 }, axes: { at: [0.35, -0.3, 0.002], len: 0.15 },
        items: [
          { type: 'cuboid', center: [0, 0.06, 0.5], half: [0.02, 0.02, 0.5], color: '#8a9096' },
          { type: 'sphere', at: [0, 0, H], r: 0.025, color: '#3a3f44' },
          { type: 'polyline', pts: [[0, 0, H], bob(60)], dash: [0.03, 0.02], radius: 0.004, color: '#55625d', tag: '목표 60°', tagAt: bob(60) },
          { type: 'link', name: 'rod', a: [0, 0, H], b: c => bob(c.c('A')), radius: 0.011, color: '#3380e6' },
          { type: 'sphere', name: 'bob', at: c => bob(c.c('A')), r: 0.045, color: '#d4691c' },
          { type: 'link', a: [0, 0, H], b: c => bob(c.stage.val('A', c.stage.overlay)), radius: 0.008, color: '#b8c1bd', when: c => !!c.stage.overlay },
          { type: 'sphere', at: c => bob(c.stage.val('A', c.stage.overlay)), r: 0.035, color: '#c3cbc7', when: c => !!c.stage.overlay }
        ]
      }
    },
    tours: {
      main: {
        intro: '모터에게 “막대를 60°로” 하고 명령합니다. 얼마나 세게 당기나(kp)와 흔들림 줄이기(dampratio)를 바꿔 보는 곳입니다.',
        beats: [
          { t: 0.01, focus: ['rod', 'bob'], callout: { at3: c => bob(c.c('A')), text: '추 (1 kg)' },
            caption: '파란 막대 끝의 주황 추를 모터가 돌립니다. 회색 점선이 목표 60°입니다.' },
          { play: [0.01, 1.6], tab: '그래프', focus: ['A', 'bob'], callout: { at3: c => bob(c.c('A')), text: '목표를 지나침' },
            caption: c => `흔들림 줄이기가 없으면 추가 목표를 지나쳐 ${fmt(c.run.min, 1)}°와 ${fmt(c.run.max, 1)}° 사이를 계속 오갑니다.` },
          { t: 3, focus: ['setting', 'range', 'bob'],
            caption: '아래 dampratio 막대를 1로 옮겨 보세요. 흐린 추(바로 전 설정)와 진한 추를 함께 보며 흔들림이 사라지는 것을 봅니다.' }
        ],
        after: '이제 마음대로: 막대를 하나씩 움직이고 ▶ 재생. 흐린 선과 흐린 추가 바로 전 설정입니다.'
      }
    }
  });
})();
