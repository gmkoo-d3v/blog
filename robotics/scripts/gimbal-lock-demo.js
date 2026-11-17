/* Intrinsic ZYX: R = Rz(yaw) Ry(pitch) Rx(roll), column vectors. */
(function (root) {
  'use strict';
  const rad = d => d * Math.PI / 180;
  function matrix(yaw, pitch, roll) {
    const [a,b,c] = [yaw,pitch,roll].map(rad), [ca,sa,cb,sb,cc,sc] = [Math.cos(a),Math.sin(a),Math.cos(b),Math.sin(b),Math.cos(c),Math.sin(c)];
    return [[ca*cb,ca*sb*sc-sa*cc,ca*sb*cc+sa*sc],[sa*cb,sa*sb*sc+ca*cc,sa*sb*cc-ca*sc],[-sb,cb*sc,cb*cc]];
  }
  function difference(a,b) {
    let trace=0; for(let i=0;i<3;i++) for(let j=0;j<3;j++) trace+=a[i][j]*b[i][j];
    return Math.acos(Math.max(-1,Math.min(1,(trace-1)/2)))*180/Math.PI;
  }
  const math={matrix,difference};
  if(typeof module !== 'undefined' && module.exports) module.exports=math;
  if(!root.document) return;
  root.GimbalLockMath=math;
  const T=root.RobotThree.THREE, OrbitControls=root.RobotThree.OrbitControls;
  const make=(tag, text, cls)=>{const e=document.createElement(tag); if(text)e.textContent=text; if(cls)e.className=cls; return e;};
  function init(host) {
    host.classList.add('gimbal-demo');
    host.innerHTML=`<h3>직접 보기: 피치가 90°가 되면</h3>
      <p>두 로봇은 같은 피치에서 출발합니다. 왼쪽 A는 롤을 +δ, 오른쪽 B는 요를 −δ만큼 돌립니다. 앞쪽 주황 돌기와 위쪽 노란 면으로 자세를 비교하세요.</p>
      <div class="gimbal-steps" role="group" aria-label="시범 단계"><button type="button" data-step="1">1 피치 90°</button><button type="button" data-step="2">2 롤 +30°</button><button type="button" data-step="3">3 요 −30°와 비교</button><button type="button" data-step="0">처음으로</button></div>
      <div class="gimbal-sliders"><label>피치 <output data-pitch-output>0°</output><input data-pitch type="range" min="0" max="90" value="0" step="1"></label><label>비교 각도 δ <output data-delta-output>30°</output><input data-delta type="range" min="-90" max="90" value="30" step="1"></label></div>
      <div class="gimbal-presets" role="group" aria-label="피치 빠른 선택"><span>피치 바로 선택:</span><button type="button" data-pitch-preset="0">0°</button><button type="button" data-pitch-preset="80">80°</button><button type="button" data-pitch-preset="89">89°</button><button type="button" data-pitch-preset="90">90°</button></div>
      <p class="gimbal-guide" data-guide aria-live="polite"></p>
      <div class="gimbal-canvas" aria-label="좌우 3D 자세 비교"></div>
      <p class="gimbal-legend"><b>A 왼쪽:</b> 롤 +δ　 <b>B 오른쪽:</b> 요 −δ<br><span class="gimbal-yaw">보라: 고정 요 +축</span> · <span class="gimbal-roll">청록: 피치 후 롤 +축</span> · 회색: 고정 x/y축 · 빨강/초록/파랑: 물체에 붙은 현재 x/y/z축</p>
      <p>보라·청록은 <b>회전을 조절하는 축</b>이고, 빨강·초록·파랑은 <b>물체에 붙은 좌표축</b>입니다. 피치 90°에서도 물체의 세 축은 서로 수직이고 회전행렬은 R Rᵀ = I, det R = 1입니다. 두 조절 손잡이가 같은 회전을 중복해서 표현하는 것입니다.</p>
      <p>드래그로 보는 방향을 바꾸고 휠 또는 두 손가락으로 확대합니다. 보는 방향은 로봇 자세와 계산을 바꾸지 않습니다.</p>
      <div class="gimbal-result" data-result aria-live="polite"></div>
      <details><summary>왜 같은 자세가 되나요? (식 보기)</summary><p>열벡터와 오른손 법칙을 쓰며 R = Rz(ψ) Ry(θ) Rx(φ)입니다. θ=90°이면 R의 나머지 항은 φ−ψ에만 의존합니다. A는 φ−ψ=δ−0=δ, B는 0−(−δ)=δ이므로 행렬이 같습니다. 각도 숫자 자체가 같다는 뜻은 아닙니다.</p><p>이것은 오일러 각 표현의 특이점입니다. 로봇이 물리적으로 모든 3차원 회전을 할 수 없다는 일반적인 주장은 아닙니다.</p></details>`;
    const scene=new T.Scene(); scene.background=new T.Color('#f4f8f7');
    const camera=new T.OrthographicCamera(-3,3,2,-2,.1,50); camera.up.set(0,0,1); camera.position.set(0,-4.7,2.5);
    const renderer=new T.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(root.devicePixelRatio||1,2));
    const canvas=host.querySelector('.gimbal-canvas'); canvas.append(renderer.domElement); renderer.domElement.tabIndex=0; renderer.domElement.setAttribute('aria-label','3D 비교 화면. 드래그 또는 방향키로 시점 회전, 휠로 확대');
    const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(0,0,.15); controls.minDistance=3; controls.maxDistance=14; controls.listenToKeyEvents(renderer.domElement); controls.update();
    scene.add(new T.HemisphereLight(0xffffff,0x526e69,2.6)); const light=new T.DirectionalLight(0xffffff,2); light.position.set(1,-3,5); scene.add(light);
    const dynamic=new T.Group(); scene.add(dynamic);
    function label(text,p,color='#173c3a') {const c=document.createElement('canvas'); c.width=512;c.height=128;const x=c.getContext('2d');x.font='bold 76px sans-serif';x.textAlign='center';x.fillStyle=color;x.fillText(text,256,78);const tex=new T.CanvasTexture(c);const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthTest:false}));s.position.set(...p);s.scale.set(1.55,.39,1);dynamic.add(s);}
    function arrow(origin, vector, color, len) {const dir=new T.Vector3(...vector).normalize();dynamic.add(new T.ArrowHelper(dir,new T.Vector3(...origin),len,color,.15,.08));}
    function drawBody(origin, m) {
      const g=new T.Group();g.position.set(...origin); const mat=new T.Matrix4().set(m[0][0],m[0][1],m[0][2],0,m[1][0],m[1][1],m[1][2],0,m[2][0],m[2][1],m[2][2],0,0,0,0,1);g.quaternion.setFromRotationMatrix(mat);
      const box=new T.Mesh(new T.BoxGeometry(.75,.5,.32),new T.MeshStandardMaterial({color:0x377eab}));g.add(box);
      const nose=new T.Mesh(new T.ConeGeometry(.15,.35,24),new T.MeshStandardMaterial({color:0xec792d}));nose.rotation.z=-Math.PI/2;nose.position.x=.53;g.add(nose);
      const top=new T.Mesh(new T.BoxGeometry(.44,.34,.035),new T.MeshStandardMaterial({color:0xffd958}));top.position.z=.18;g.add(top);dynamic.add(g);
      for(let i=0;i<3;i++)arrow(origin,[m[0][i],m[1][i],m[2][i]],[0xd34a3c,0x21894d,0x4861c5][i],.8);
    }
    let pitch=0,delta=30,step=0;
    const p=host.querySelector('[data-pitch]'),d=host.querySelector('[data-delta]'),result=host.querySelector('[data-result]'),guide=host.querySelector('[data-guide]');
    function fmt(n){return (Math.abs(n)<.0005?0:n).toFixed(3)}
    function redraw(){
      while(dynamic.children.length){const o=dynamic.children[0];dynamic.remove(o);o.traverse(c=>{c.geometry?.dispose();if(c.material){c.material.map?.dispose();c.material.dispose();}});}
      const a=matrix(0,pitch,step===1?0:delta), b=matrix(step===1||step===2?0:-delta,pitch,0);
      const roll=[Math.cos(rad(pitch)),0,-Math.sin(rad(pitch))];
      for(const [i,origin] of [[0,[-1.45,0,0]],[1,[1.45,0,0]]]){
        drawBody(origin,i?b:a);
        arrow(origin,[1,0,0],0x778987,1.05);arrow(origin,[0,1,0],0x778987,1.05);arrow(origin,[0,0,1],0x8039b8,1.3);arrow(origin,roll,0x008b8b,1.15);
        label(i?(step===1||step===2?'B · 요 0°':'B · 요 −δ'):(step===1?'A · 롤 0°':'A · 롤 +δ'),[origin[0],0,1.65]);
      }

      p.value=pitch;d.value=delta;host.querySelector('[data-pitch-output]').textContent=pitch+'°';host.querySelector('[data-delta-output]').textContent=delta+'°';
      const diff=difference(a,b), same=diff<1e-5;
      guide.textContent=step===1?'1단계: 둘 다 피치 90°에 놓았습니다. 청록 롤 +축과 보라 요 +축이 같은 직선에서 반대 방향인지 보세요.':step===2?'2단계: A만 롤 +30° 회전했습니다. 이제 3단계에서 B를 비교하세요.':'피치를 0°에서 90°로 올리며 두 축과 A/B의 자세 차이를 살펴보세요.';
      result.innerHTML=`<strong>${same?'A와 B는 같은 자세입니다':'A와 B는 서로 다른 자세입니다'}</strong><br>최종 자세의 각도 차이: ${fmt(diff)}°<br>피치 후 롤 +축 = (${roll.map(fmt).join(', ')}) · 고정 요 +축 = (0, 0, 1)<br>A 행렬 = [${a.map(row=>row.map(fmt).join(', ')).join('] [')}]<br>B 행렬 = [${b.map(row=>row.map(fmt).join(', ')).join('] [')}]<br>${pitch===90?'두 축은 반평행입니다. 롤 + 방향이 요 − 방향과 일치합니다.':'두 축은 아직 같은 직선이 아닙니다.'}`;
      renderer.render(scene,camera);
    }
    p.addEventListener('input',()=>{pitch=+p.value;step=3;redraw()});d.addEventListener('input',()=>{delta=+d.value;step=3;redraw()});
    host.querySelectorAll('[data-pitch-preset]').forEach(b=>b.addEventListener('click',()=>{pitch=+b.dataset.pitchPreset;step=3;redraw()}));
    host.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{step=+b.dataset.step;if(step===0){pitch=0;delta=30;}else{pitch=90;delta=30;}redraw()}));
    controls.addEventListener('change',()=>renderer.render(scene,camera));
    function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h, span=Math.max(3.8,5.8/aspect); camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();renderer.render(scene,camera);}
    new ResizeObserver(resize).observe(canvas);document.addEventListener('toggle',()=>requestAnimationFrame(resize),true);redraw();resize();
  }
  document.querySelectorAll('[data-gimbal-lock-demo]').forEach(host=>{let done=false;function start(){if(done||host.closest('details:not([open])')||!host.getClientRects().length||!host.clientWidth)return;done=true;try{init(host)}catch(e){host.textContent='3D 화면을 열 수 없습니다. 브라우저의 WebGL 설정을 확인하세요.';console.error(e)}}document.addEventListener('toggle',()=>requestAnimationFrame(start),true);requestAnimationFrame(start);});
})(typeof window==='undefined'?globalThis:window);




