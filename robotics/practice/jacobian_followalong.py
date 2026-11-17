"""2링크 평면 팔 야코비안 따라하기 - 교안 PDF 21쪽 / 교과서 3.5절.

이 파일은 강의 자료의 실제 코드인 두링크.py(순기구학2·야코비안2)와
b13_velocity.py(속도 예제)를 NumPy만으로 한 파일에 옮긴 연습용 사본입니다.
링크 길이는 교안과 같은 0.4 m, 0.3 m로 고정했습니다.
실제 로봇이나 시뮬레이터를 움직이지 않고, 숫자만 계산합니다.

실행 예 (PowerShell):
    python practice\\jacobian_followalong.py
    python practice\\jacobian_followalong.py --dq 0.5 0
    python practice\\jacobian_followalong.py --q 0 0
"""
from __future__ import annotations

import argparse
import math
import sys

import numpy as np

# ─── 학습자가 직접 바꿔 보는 기본값 ───────────────────────────────
Q_DEG_DEFAULT = (30.0, 45.0)   # 어깨, 팔꿈치 각도 [deg]  ← 여기 숫자를 바꿔도 됩니다
DQ_DEFAULT = (0.5, -0.2)       # 어깨, 팔꿈치 각속도 [rad/s]
DT_DEFAULT = 0.001             # 유한차분 간격 [s]
# ───────────────────────────────────────────────────────────────
# 교안 3.5절과 같은 고정 길이(m). 이 값은 바꾸지 않습니다.
위팔, 아래팔 = 0.4, 0.3


def 순기구학2(q: np.ndarray) -> np.ndarray:
    """관절 각도 q=[어깨, 팔꿈치](rad) → 손끝 위치 [x, y](m)."""
    손끝 = 위팔 * np.array([np.cos(q[0]), np.sin(q[0])]) + 아래팔 * np.array(
        [np.cos(q[0] + q[1]), np.sin(q[0] + q[1])]
    )
    return 손끝


def 야코비안2(q: np.ndarray) -> np.ndarray:
    """2×2 야코비안(m/rad). 열 i는 '관절 i만 1rad/s로 돌 때의 손끝 속도'."""
    s1, c1 = np.sin(q[0]), np.cos(q[0])
    s12, c12 = np.sin(q[0] + q[1]), np.cos(q[0] + q[1])
    return np.array(
        [
            [-위팔 * s1 - 아래팔 * s12, -아래팔 * s12],
            [위팔 * c1 + 아래팔 * c12, 아래팔 * c12],
        ]
    )


def _유한실수(값: str) -> float:
    """숫자로 읽히고 nan/inf가 아닌 값만 통과시킨다."""
    try:
        숫자 = float(값)
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"숫자로 읽을 수 없습니다 → {값!r}"
        ) from None
    if not math.isfinite(숫자):
        raise argparse.ArgumentTypeError(
            f"유한한 실수만 넣을 수 있습니다(nan/inf 불가) → {값!r}"
        )
    return 숫자


def _칸(x: float, 자리: int = 6) -> str:
    """-0.0을 0.0으로 정리하고 부호를 붙여 출력한다."""
    if abs(x) < 5e-13:
        x = 0.0
    return f"{x:+.{자리}f}"


def _방향(x: float, 양이름: str, 음이름: str) -> str:
    if abs(x) < 5e-13:
        return f"{양이름}/{음이름} 변화 없음"
    return f"{양이름} 방향" if x > 0 else f"{음이름} 방향"


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")  # 콘솔이 한글을 못 받아도 죽지 않게
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        description="2링크 팔의 야코비안과 손끝 속도를 한 번에 계산합니다.",
        epilog="예: python practice\\jacobian_followalong.py --q 0 0 / --dq 0.5 0",
    )
    parser.add_argument(
        "--q", nargs=2, metavar=("DEG", "DEG"),
        type=_유한실수,
        default=Q_DEG_DEFAULT,
        help="어깨·팔꿈치 각도[deg] (기본: 30 45)",
    )
    parser.add_argument(
        "--dq", nargs=2, metavar=("RAD_S", "RAD_S"),
        type=_유한실수,
        default=DQ_DEFAULT,
        help="어깨·팔꿈치 각속도[rad/s] (기본: 0.5 -0.2)",
    )
    args = parser.parse_args(argv)

    q_deg = np.array(args.q, dtype=float)
    dq = np.array(args.dq, dtype=float)
    q = np.deg2rad(q_deg)
    dt = DT_DEFAULT

    J = 야코비안2(q)
    어깨기여 = J[:, 0] * dq[0]
    팔꿈치기여 = J[:, 1] * dq[1]
    v = J @ dq
    속력 = float(np.linalg.norm(v))

    손끝 = 순기구학2(q)
    새각도 = q + dq * dt
    새손끝 = 순기구학2(새각도)
    평균속도 = (새손끝 - 손끝) / dt
    평균속력 = float(np.linalg.norm(평균속도))
    차이 = v - 평균속도
    최대차이 = float(np.max(np.abs(차이)))

    print("=== 2링크 평면 팔: 야코비안에서 손끝 속도까지 ===")
    print("NumPy 수치 계산입니다. 실제 로봇·시뮬레이터는 움직이지 않습니다.")
    print()
    print("[입력] 자세 q와 관절 속도 qdot")
    print(f"  q  = [{q_deg[0]:.1f}°, {q_deg[1]:.1f}°] = [{q[0]:.6f}, {q[1]:.6f}] rad")
    print(f"  qdot = [{dq[0]:+.6f}, {dq[1]:+.6f}] rad/s   (어깨, 팔꿈치)")
    print(f"  dt = {dt:.6f} s (유한차분 간격)")
    print(f"  링크 길이: 위팔 {위팔} m, 아래팔 {아래팔} m (교안과 동일, 고정)")
    print()

    print("[1] 야코비안 J - 자세 q만으로 정해지는 영향표 (m/rad)")
    print("                 어깨 열       팔꿈치 열")
    print(f"      x 행     {_칸(J[0, 0], 9)}     {_칸(J[0, 1], 9)}")
    print(f"      y 행     {_칸(J[1, 0], 9)}     {_칸(J[1, 1], 9)}")
    print("  · 행 = 손끝 출력: x 행은 오른쪽(+)/왼쪽(-), y 행은 위쪽(+)/아래쪽(-)")
    print("  · 열 = 관절 입력: 첫 열 어깨 q[0], 둘째 열 팔꿈치 q[1]")
    print("  · 단위 m/rad: '관절 1rad당 손끝 몇 m'. 아직 m/s(속도)가 아닙니다.")
    print("  · 열 읽기(가정): 어깨만 +1rad/s → 손끝 "
          f"[{_칸(J[0, 0])}, {_칸(J[1, 0])}] m/s")
    print("                   팔꿈치만 +1rad/s → 손끝 "
          f"[{_칸(J[0, 1])}, {_칸(J[1, 1])}] m/s")
    print("    이 1rad/s는 열의 뜻을 읽기 위한 가정입니다. 실제 속도는 아래 입력의 qdot입니다.")
    print()

    print("[2] 열별 기여 - 각 열에 그 관절의 실제 속도를 곱한 것")
    print(f"  어깨   [{_칸(J[0, 0])}, {_칸(J[1, 0])}] × {dq[0]:+.6f}"
          f" = [{_칸(어깨기여[0])}, {_칸(어깨기여[1])}] m/s")
    print(f"  팔꿈치 [{_칸(J[0, 1])}, {_칸(J[1, 1])}] × {dq[1]:+.6f}"
          f" = [{_칸(팔꿈치기여[0])}, {_칸(팔꿈치기여[1])}] m/s")
    print("  음수 속도는 그 열의 기여 방향을 뒤집습니다.")
    print("  각속도를 더하는 것이 아니라, 손끝에 대한 영향끼리 더합니다.")
    print()

    print("[3] 합산 = 이 순간의 손끝 속도 v = J @ qdot")
    print(f"  vx = {_칸(v[0])} m/s  ({_방향(v[0], '오른쪽', '왼쪽')})")
    print(f"  vy = {_칸(v[1])} m/s  ({_방향(v[1], '위쪽', '아래쪽')})")
    print(f"  v  = [{_칸(v[0])}, {_칸(v[1])}] m/s")
    print(f"  속력 |v| = {속력:.6f} m/s")
    print("  속력은 방향을 뺀 크기(스칼라)입니다. vx·vy와 단위는 같지만 다른 값입니다.")
    print()

    print(f"[4] 유한차분 '평균' 속도 - {dt:.3f}s 동안 순기구학으로 잰 위치 차이")
    print(f"  각도 변화량 qdot·dt = [{dq[0] * dt:+.6f}, {dq[1] * dt:+.6f}] rad")
    print(f"  새 q            = [{새각도[0]:.6f}, {새각도[1]:.6f}] rad")
    print(f"  손끝 위치: [{손끝[0]:.9f}, {손끝[1]:.9f}] m")
    print(f"          → [{새손끝[0]:.9f}, {새손끝[1]:.9f}] m")
    print(f"  (새손끝 - 손끝)/dt = [{_칸(평균속도[0])}, {_칸(평균속도[1])}] m/s"
          f"  · |평균| = {평균속력:.6f} m/s")
    print(f"  J@qdot와의 차이 = [{_칸(차이[0])}, {_칸(차이[1])}] m/s"
          f"  (최대 {최대차이:.2e})")
    print("  J@qdot는 시작 순간의 속도, 유한차분은 그 짧은 구간의 평균입니다.")
    print("  그동안 자세가 조금 변하므로 두 값은 똑같지 않습니다.")
    print()
    print("[정리]")
    print("  J는 자세의 영향표(m/rad)이고, qdot을 곱해야 속도(m/s)가 됩니다.")
    print("  q만 바꾸면 J가 바뀌고, qdot만 바꾸면 J는 그대로입니다.")
    print("  출처: 로봇기초 2일차 PDF 21쪽 / 교과서 3.5절, "
          "두링크.py·b13_velocity.py의 순기구학·야코비안 정의.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
