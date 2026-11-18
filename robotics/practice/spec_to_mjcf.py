"""제원표 -> MJCF 연습: 숫자 몇 개가 적힌 제원표를 XML로 바꾸고, 불러온 뒤 모델에서 다시 읽어 확인합니다.

실행 방법 (robotics 폴더에서. MuJoCo가 설치된 이 컴퓨터의 파이썬):
    C:\\code\\src\\robo\\.venv\\Scripts\\python.exe practice\\spec_to_mjcf.py
파일을 만들지 않고 숫자만 출력합니다. 아래 제원표의 숫자를 바꿔 다시 실행해 보세요.
(범위 = 도, 토크 = N*m, 명령 범위 = rad. 범위나 토크를 None으로 두면 그 속성을 아예 적지 않습니다 = 제한 없음.)
"""
import mujoco
import numpy as np

제원 = {
    "링크1_m": 0.30, "링크2_m": 0.25,        # 링크 길이 -> body pos, geom fromto, site pos
    "질량1_kg": 0.3, "질량2_kg": 0.2,        # 링크 질량 -> geom mass
    "가동범위_도": 150,                      # 관절 한 개가 -150 ~ +150도 -> joint range (None이면 제한 없음)
    "최대토크_Nm": 5,                        # 모터가 낼 수 있는 힘 -> forcerange (None이면 제한 없음)
    "명령범위_rad": 3.14,                    # 보낼 수 있는 목표 각도 -> ctrlrange
    "kp": 50,                                # 제어 방식: position 액추에이터의 단단함
}


def xml_만들기(s: dict) -> str:
    """제원표 사전 하나를 MJCF 글자로 바꿉니다. 숫자 하나가 어느 속성이 되는지 줄마다 주석으로 적었습니다."""
    범위 = "" if s["가동범위_도"] is None else f' range="-{s["가동범위_도"]} {s["가동범위_도"]}"'          # 도 단위로 적는다
    힘 = "" if s["최대토크_Nm"] is None else f' forcerange="-{s["최대토크_Nm"]} {s["최대토크_Nm"]}"'
    return f"""<mujoco model="제원표 팔">
  <default>
    <joint type="hinge" axis="0 0 1" damping="0.05"/>
    <position kp="{s["kp"]}" dampratio="1" ctrlrange="-{s["명령범위_rad"]} {s["명령범위_rad"]}"{힘}/>
  </default>
  <worldbody>
    <body name="upper">
      <joint name="shoulder"{범위}/>
      <geom type="capsule" fromto="0 0 0 {s["링크1_m"]:.2f} 0 0" size="0.02" mass="{s["질량1_kg"]}"/>
      <body name="lower" pos="{s["링크1_m"]:.2f} 0 0">
        <joint name="elbow"{범위}/>
        <geom type="capsule" fromto="0 0 0 {s["링크2_m"]:.2f} 0 0" size="0.018" mass="{s["질량2_kg"]}"/>
        <site name="tip" pos="{s["링크2_m"]:.2f} 0 0"/>
      </body>
    </body>
  </worldbody>
  <actuator>
    <position name="shoulder" joint="shoulder"/>
    <position name="elbow" joint="elbow"/>
  </actuator>
</mujoco>"""


def 읽어_확인(s: dict) -> None:
    """XML을 불러와, 제원표에 적은 숫자가 모델 안에 그대로 들어갔는지 읽어 봅니다."""
    모델 = mujoco.MjModel.from_xml_string(xml_만들기(s))
    데이터 = mujoco.MjData(모델)
    mujoco.mj_forward(모델, 데이터)
    print("자유도 model.nv:", 모델.nv, "| 액추에이터 model.nu:", 모델.nu)
    print("링크 질량 model.body_mass[1:]:", 모델.body_mass[1:], "| 합:", round(float(모델.body_mass.sum()), 3), "kg")
    print("손끝 위치(관절 0도) data.site('tip').xpos:", np.round(데이터.site("tip").xpos, 3), "-> 작업 반경 =", round(float(데이터.site("tip").xpos[0]), 3), "m")
    print("가동 범위 model.jnt_range (rad):", np.round(모델.jnt_range[0], 4), "| 제한 켜짐 jnt_limited:", 모델.jnt_limited.tolist())
    print("토크 한계 model.actuator_forcerange[0]:", 모델.actuator_forcerange[0], "| 켜짐:", 모델.actuator_forcelimited.tolist())
    print("명령 범위 model.actuator_ctrlrange[0]:", 모델.actuator_ctrlrange[0], "| 켜짐:", 모델.actuator_ctrllimited.tolist())
    print("kp:", 모델.actuator_gainprm[:, 0].tolist(), "| kv(= -biasprm[2], dampratio=1이 정한 값):", np.round(-모델.actuator_biasprm[:, 2], 3).tolist())


def 한계_시험(s: dict) -> None:
    """한계가 정말 걸리는지 세 가지를 시험합니다 (어깨만 움직이고 팔꿈치 목표는 0)."""
    모델 = mujoco.MjModel.from_xml_string(xml_만들기(s))
    데이터 = mujoco.MjData(모델)
    데이터.ctrl[:] = [3.0, 0.0]                        # 3.0rad = 171.9도: 가동 범위보다 멀리 보낸다
    for _ in range(2000):
        mujoco.mj_step(모델, 데이터)
    print(f"목표 3.0rad(171.9도)를 주면 어깨가 멈춘 각도: {np.rad2deg(데이터.qpos[0]):.2f}도 (가동 범위 {s['가동범위_도']}도)")
    데이터 = mujoco.MjData(모델)
    데이터.ctrl[:] = [5.0, 0.0]                        # 명령 5rad: 명령 범위 3.14를 넘는다
    mujoco.mj_step(모델, 데이터)
    print(f"ctrl에 5.0을 넣어도 data.ctrl은 {데이터.ctrl[0]} 그대로, 모터 힘 actuator_force는 {데이터.actuator_force[0]:.1f} N*m")


def 오류_보기() -> None:
    """제원표를 옮길 때 자주 나는 실수 두 개와 조용히 지나가는 실수 하나의 결과를 봅니다."""
    기본 = xml_만들기(제원)
    사례 = {
        "range에 숫자 하나만": 기본.replace('range="-150 150"', 'range="-150"'),
        "range를 뒤집어 씀(150 -150)": 기본.replace('range="-150 150"', 'range="150 -150"'),
        "angle=radian인데 150이라고 씀": 기본.replace('<mujoco model="제원표 팔">', '<mujoco model="제원표 팔"><compiler angle="radian"/>'),
    }
    for 이름, xml in 사례.items():
        try:
            모델 = mujoco.MjModel.from_xml_string(xml)
        except Exception as e:      # noqa: BLE001  (MuJoCo가 ValueError로 알려 줍니다)
            print(f"[{이름}] 오류: {str(e).splitlines()[0]}")
        else:
            print(f"[{이름}] 오류 없이 읽힘: jnt_limited={모델.jnt_limited.tolist()}, jnt_range[0]={np.round(모델.jnt_range[0], 3).tolist()}")


if __name__ == "__main__":
    print("== 만들어진 XML")
    print(xml_만들기(제원))
    print("== 읽어 보기")
    읽어_확인(제원)
    print("== 한계가 걸리는지")
    한계_시험(제원)
    print("== 실수했을 때")
    오류_보기()
