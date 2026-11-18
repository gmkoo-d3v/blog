"""XML 읽는 법 연습: 정상 장면 한 개와, 실수를 하나씩 넣은 장면 다섯 개를 MuJoCo에 읽혀 봅니다.

실행 방법 (MuJoCo가 설치된 파이썬으로 실행합니다. 이 컴퓨터에서는 아래 파이썬입니다):
    C:\\code\\src\\robo\\.venv\\Scripts\\python.exe practice\\xml_primer.py
robotics 폴더에서 실행합니다. 파일을 만들지 않고 숫자와 오류 문장만 출력합니다.
"""
import mujoco

# 첫 줄(<mujoco ...>)을 1줄로 세면 body는 4줄, 상자 geom은 6줄입니다.
BOX = """<mujoco model="box">
  <worldbody>
    <geom type="plane" size="1 1 0.1"/>
    <body name="crate" pos="0 0 0.5">
      <freejoint/>
      <geom type="box" size="0.1 0.2 0.3"/>
    </body>
  </worldbody>
</mujoco>"""

MISTAKES = {
    "닫는 태그 빠짐": BOX.replace("    </body>\n", ""),
    "따옴표 빠짐": BOX.replace('size="0.1 0.2 0.3"', "size=0.1 0.2 0.3"),
    "대소문자 다름 <Body>": BOX.replace("<body name", "<Body name").replace("</body>", "</Body>"),
    "속성 철자 틀림 sizee": BOX.replace('size="0.1 0.2 0.3"', 'sizee="0.1 0.2 0.3"'),
    "숫자 자리에 글자": BOX.replace('size="0.1 0.2 0.3"', 'size="0.1 abc 0.3"'),
}


def main() -> None:
    model = mujoco.MjModel.from_xml_string(BOX)
    data = mujoco.MjData(model)
    print("== 정상 장면")
    print("몸체 수(world 포함):", model.nbody, "| 모양 수:", model.ngeom)
    print("qpos 칸:", model.nq, "| qvel 칸:", model.nv)
    print("상자 질량:", round(float(model.body("crate").mass[0]), 3), "kg")
    for _ in range(500):          # 500걸음 x 0.002초 = 1초
        mujoco.mj_step(model, data)
    print("1초 뒤 상자 높이 z:", round(float(data.body("crate").xpos[2]), 4), "m")
    print("== 일부러 틀린 장면 (오류 문장의 줄 번호를 위 XML과 맞춰 보세요)")
    for name, xml in MISTAKES.items():
        try:
            mujoco.MjModel.from_xml_string(xml)
            print(f"[{name}] 오류 없음")
        except ValueError as err:
            print(f"[{name}]")
            for line in str(err).strip().splitlines():
                print("   ", line)


if __name__ == "__main__":
    main()
