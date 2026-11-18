r"""팔로 상자를 밀어 떨어뜨리기: 관절을 움직이는 세 가지 방법, 링크 길이, 팔꿈치 각도를 바꿔 보는 연습.

오너의 장면 파일 팔장면.py(2관절 팔 + 탁자 + 상자)를 그대로 불러 쓰고, 링크 길이 네 곳만 새 값으로 바꿉니다.

실행 방법 (PowerShell. 그림 파일을 만들지 않으므로 어느 폴더에서 돌려도 됩니다):
    cd C:\code\blog\robotics
    C:\code\src\robo\.venv\Scripts\python.exe practice\arm_push_by_angle.py                    # 창이 뜨고 팔이 상자를 민다(닫을 때까지 반복)
    C:\code\src\robo\.venv\Scripts\python.exe practice\arm_push_by_angle.py --headless         # 창 없이 숫자만 출력(한 번 돌림)
    C:\code\src\robo\.venv\Scripts\python.exe practice\arm_push_by_angle.py --headless --L1 0.25 --L2 0.25
    C:\code\src\robo\.venv\Scripts\python.exe practice\arm_push_by_angle.py --headless --mode forward   # b22 방식: 시간이 안 흐름
    C:\code\src\robo\.venv\Scripts\python.exe practice\arm_push_by_angle.py --headless --mode target    # b23·b24 방식: 액추에이터에 목표를 줌
창이 뜨는 쪽은 마우스로 돌려 볼 수 있고, 창을 닫으면 끝납니다.

세 방식 (--mode):
  forward  b22 방식. 관절 각도를 data.qpos 에 쓰고 mj_forward 만 부른다. 위치는 계산되지만 시간이 안 흘러 상자는 꼼짝 않는다.
  angle    (기본) 매 걸음 qpos 에 각도를 쓰고 mj_step 으로 시간을 흘린다. 팔은 정해 준 각도대로만 움직이고 상자는 접촉으로 밀린다.
  target   b23·b24 방식. data.ctrl 에 목표 각도를 주고 mj_step. 모터(kp=50)가 목표를 따라가느라 조금 늦는다.
"""
import argparse
import sys
import time

sys.dont_write_bytecode = True                       # 오너 폴더에 __pycache__ 를 남기지 않는다
sys.path.insert(0, r"C:\code\src\robo\vol3\04-mujoco-basics")

import mujoco
import numpy as np
import 팔장면                                          # 오너의 장면: L1, L2, XML, 손끝_계산

인자 = argparse.ArgumentParser(description=__doc__.split("\n")[0])
인자.add_argument("--mode", choices=["forward", "angle", "target"], default="angle", help="관절을 움직이는 방법")
인자.add_argument("--L1", type=float, default=팔장면.L1, help="위팔 길이(m), 기본 팔장면.py 의 값")
인자.add_argument("--L2", type=float, default=팔장면.L2, help="아래팔 길이(m), 기본 팔장면.py 의 값")
인자.add_argument("--start", type=float, default=-40.0, help="어깨 시작 각도(도)")
인자.add_argument("--end", type=float, default=80.0, help="어깨 끝 각도(도)")
인자.add_argument("--elbow", type=float, default=60.0, help="팔꿈치 각도(도). 도는 동안 고정")
인자.add_argument("--time", type=float, default=2.0, help="어깨를 start 에서 end 로 돌리는 데 걸리는 시간(초)")
인자.add_argument("--headless", action="store_true", help="창 없이 한 번 돌리고 숫자만 출력")
값 = 인자.parse_args()
L1, L2 = 값.L1, 값.L2

# 팔장면.XML 의 길이 네 곳(팔 geom, 아래팔 body 위치, 아래팔 geom, 손끝 site)을 새 길이로 바꾼다.
# 먼저 자리표시자로 바꾼 뒤 숫자를 넣는다. (새 L1 이 옛 L2 와 같은 값이어도 헷갈리지 않게)
XML = 팔장면.XML
for 옛, 자리 in [(f'fromto="0 0 0 {팔장면.L1} 0 0"', 'fromto="0 0 0 @@L1@@ 0 0"'),
               (f'<body name="lower" pos="{팔장면.L1} 0 0">', '<body name="lower" pos="@@L1@@ 0 0">'),
               (f'fromto="0 0 0 {팔장면.L2} 0 0"', 'fromto="0 0 0 @@L2@@ 0 0"'),
               (f'<site name="tip" pos="{팔장면.L2} 0 0"', '<site name="tip" pos="@@L2@@ 0 0"')]:
    assert XML.count(옛) == 1, f"바꿀 자리를 못 찾음: {옛}"
    XML = XML.replace(옛, 자리)
XML = XML.replace("@@L1@@", str(L1)).replace("@@L2@@", str(L2))

모델 = mujoco.MjModel.from_xml_string(XML)
데이터 = mujoco.MjData(모델)
어깨, 팔꿈치 = 모델.joint("shoulder"), 모델.joint("elbow")
어깨_q, 팔꿈치_q = 어깨.qposadr[0], 팔꿈치.qposadr[0]       # qpos 칸 번호
어깨_v, 팔꿈치_v = 어깨.dofadr[0], 팔꿈치.dofadr[0]          # qvel 칸 번호
상자 = 모델.geom("block").id
바닥, 탁자 = 모델.geom("floor").id, 모델.geom("table").id
시작, 끝, 팔꿈치_각 = np.deg2rad([값.start, 값.end, 값.elbow])
각속도 = (끝 - 시작) / 값.time


def 종이_계산():
    """창을 띄우기 전에 종이로 따질 수 있는 숫자: 손끝이 상자까지 닿는가."""
    mujoco.mj_resetData(모델, 데이터)
    mujoco.mj_forward(모델, 데이터)
    상자_xy = 데이터.body("block").xpos[:2] - 데이터.body("base").xpos[:2]
    중심거리 = np.linalg.norm(상자_xy)
    모서리거리 = np.hypot(abs(상자_xy[0]) - 0.03, abs(상자_xy[1]) - 0.03)     # 받침에서 가장 가까운 상자 모서리
    R = np.sqrt(L1**2 + L2**2 + 2 * L1 * L2 * np.cos(팔꿈치_각))             # 팔꿈치를 고정했을 때 손끝 반지름
    print(f"링크 L1={L1} m, L2={L2} m, 팔꿈치 {값.elbow:.0f}도, 어깨 {값.start:.0f}도 -> {값.end:.0f}도 ({값.time}초), 방식 {값.mode}")
    print(f"상자 중심까지 {중심거리:.3f} m, 가장 가까운 모서리까지 {모서리거리:.3f} m (팔 끝 반지름 0.018 m)")
    print(f"손끝 반지름 R = sqrt(L1^2 + L2^2 + 2*L1*L2*cos(팔꿈치)) = {R:.3f} m -> "
          + ("R + 0.018 >= 모서리 거리: 닿을 수 있음" if R + 0.018 >= 모서리거리 else "R + 0.018 < 모서리 거리: 팔이 짧아 닿지 못함"))


def 한_번(창=None):
    """상자를 한 번 밀어 보고 (사건, 상자 위치)를 돌려준다."""
    mujoco.mj_resetData(모델, 데이터)
    사건 = {}
    벽시계 = time.time()
    if 값.mode == "forward":                         # b22 방식: 각도만 쓰고 mj_forward. 시간은 0 그대로
        데이터.qpos[어깨_q], 데이터.qpos[팔꿈치_q] = 끝, 팔꿈치_각
        mujoco.mj_forward(모델, 데이터)
        if 창 is not None:
            창.sync()
        return 사건, 데이터.body("block").xpos.copy()
    while 데이터.time < 값.time + 1.5 and (창 is None or 창.is_running()):
        비율 = min(데이터.time / 값.time, 1.0)
        어깨_각 = 시작 + 비율 * (끝 - 시작)
        if 값.mode == "angle":                       # 매 걸음 각도를 직접 써 넣는다(속도도 같이: 접촉이 팔의 움직임을 알도록)
            데이터.qpos[어깨_q], 데이터.qpos[팔꿈치_q] = 어깨_각, 팔꿈치_각
            데이터.qvel[어깨_v] = 각속도 if 비율 < 1.0 else 0.0
            데이터.qvel[팔꿈치_v] = 0.0
            데이터.ctrl[:] = [어깨_각, 팔꿈치_각]      # 모터가 반대로 당기지 않도록 목표도 같게
        else:                                        # target: 목표만 주고 모터가 따라가게 한다(b23, b24 방식)
            데이터.ctrl[:] = [어깨_각, 팔꿈치_각]
        mujoco.mj_step(모델, 데이터)
        for 접촉 in 데이터.contact[:데이터.ncon]:
            짝 = {접촉.geom1, 접촉.geom2}
            if 상자 in 짝:
                상대 = (짝 - {상자}).pop()
                if 상대 not in (바닥, 탁자):
                    사건.setdefault("팔", 데이터.time)
                if 상대 == 바닥:
                    사건.setdefault("바닥", 데이터.time)
        if 창 is not None and round(데이터.time / 모델.opt.timestep) % 8 == 0:   # 8걸음(0.016초)마다 화면 갱신
            창.sync()
            남음 = 데이터.time - (time.time() - 벽시계)
            if 남음 > 0:
                time.sleep(남음)                     # 실제 시간과 맞춰 보여 준다
    return 사건, 데이터.body("block").xpos.copy()


def 출력(사건, 위치):
    if 값.mode == "forward":
        print(f"시간(data.time): {데이터.time} 초. 각도만 바꿨을 뿐 시간이 흐르지 않았으니 상자는 그대로입니다.")
    elif "팔" in 사건:
        print(f"팔이 상자에 처음 닿음: {사건['팔']:.3f}초")
    else:
        print("팔이 상자에 닿지 않음")
    if 값.mode != "forward":
        print(f"상자가 바닥에 닿음: {사건['바닥']:.3f}초 -> 탁자에서 떨어짐" if "바닥" in 사건 else "상자가 탁자 위에 남음")
    print("상자 마지막 위치:", np.round(위치, 3), "(처음 [0.4 0.15 0.43])")


종이_계산()
if 값.headless:
    출력(*한_번())
else:
    import mujoco.viewer
    with mujoco.viewer.launch_passive(모델, 데이터) as 창:
        창.cam.lookat[:] = [0.3, 0.0, 0.42]
        창.cam.distance, 창.cam.azimuth, 창.cam.elevation = 1.5, 130, -35
        첫번째 = True
        while 창.is_running():
            결과 = 한_번(창)
            if 첫번째:
                출력(*결과)
                첫번째 = False
            if 값.mode == "forward":
                time.sleep(0.2)
            else:
                time.sleep(1.0)
