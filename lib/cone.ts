/**
 * 콘 기하. 배치 상수는 scoop-cone.jsx 프로토타입에서, 스쿱 실루엣과 장식은
 * 아이스크림 도안.png(시안 4번 물결형)에서 실측해 가져왔다.
 *
 * ScoopCone(SVG 내부)과 ConeBoard(타이틀 패널의 세로 위치)가 **같은 좌표계**를
 * 써야 해서 컴포넌트 밖으로 뺐다. 전부 순수 함수라 서버·클라이언트 어디서 불러도
 * 같은 값이 나온다.
 */

export const R = 42;
/**
 * 스쿱 세로 간격. 스쿱 높이(1.54R)의 76%다 — 위 스쿱에 가려지고도 아래 스쿱의
 * 돔 곡선이 드러난다. 1.02R(원형 스쿱 시절 값)로 두면 어깨선 아래만 보여
 * 스택이 둥근 스쿱이 아니라 줄무늬 기둥처럼 읽힌다.
 *
 * 물결형은 치마가 돔보다 넓어서, 이 간격이면 위 스쿱의 로브가 아래 스쿱의 어깨에
 * 얹힌다. 도안 한 장을 쌓았을 때 가장 스쿱처럼 보이는 자리다.
 */
export const STEP = R * 1.17;
export const CONE_H = 150;
export const CONE_HALF = R * 0.88;
/** 위 여백. 최상단 스쿱의 체리(줄기 끝 = 중심에서 R*1.32 위)까지 담아야 한다. */
export const TOP_PAD = 26;
export const BOT_PAD = 10;
export const VB_W = 260;
export const CX = VB_W / 2;

/**
 * 스택에서 빠져나온 스쿱의 자리(화면구성.md §4-2).
 *
 * 선택 링을 없앴으므로 왼쪽 여백(`CX - R` = 88단위)에 스쿱만 들어가면 된다.
 * `DETACH_CX = 46`에서 `scale(1)`이면 [4, 88]로 스택 왼쪽 끝에 정확히 닿는다.
 *
 * 줄이지 않는 이유: 화면에서 보면 작아지는 것이 "스택에서 떨어져 나왔다"가 아니라
 * "멀어졌다"로 읽혀서, 왼쪽으로 나오는 동작이 비스듬히 미끄러지는 것처럼 보인다.
 * 자리를 옮긴 것만으로 선택 표시는 충분하다.
 */
export const DETACH_SCALE = 1;
export const DETACH_CX = 46;

/**
 * 스쿱 n개짜리 콘의 전체 높이(viewBox 단위). 선택 상태와 무관하다 —
 * 벌어질 자리(LIFT_ABOVE·PUSH_BELOW)를 위아래에 늘 비워 두기 때문이다.
 * 선택할 때마다 뷰박스가 커지면 그만큼 박스가 아래로 자라 콘이 통째로 내려앉는다.
 */
export function coneHeight(n: number): number {
  const stackSpan = n > 0 ? (n - 1) * STEP + R : 0;
  return TOP_PAD + LIFT_ABOVE + stackSpan + R * 0.15 + CONE_H + PUSH_BELOW + BOT_PAD;
}

/**
 * 콘(와플) 윗면의 y — 쉴 때 기준.
 *
 * 선택 중에는 콘이 아래 무리와 함께 PUSH_BELOW만큼 내려간다. 그 이동은 path를
 * 다시 그리지 않고 ScoopCone이 transform으로 처리하므로(애니메이션이 걸린다)
 * 이 함수는 늘 쉴 때의 값을 돌려준다.
 */
export function coneTopY(n: number): number {
  return coneHeight(n) - BOT_PAD - PUSH_BELOW - CONE_H;
}

/**
 * i번째 스쿱(0 = 맨 아래)의 중심 y.
 *
 * 선택하면 스택이 그 스쿱을 기준으로 **갈라진다**: 위 무리는 LIFT_ABOVE만큼
 * 올라가고, 아래 무리는 콘과 함께 PUSH_BELOW만큼 내려간다. 고른 스쿱 자신은
 * 세로로 움직이지 않는다(왼쪽으로 빠져나가기만 한다). 갈라진 틈은 메우지 않고
 * 글 자리로 쓴다(화면구성.md §4-2).
 */
export function scoopCy(i: number, n: number, selIdx: number | null = null): number {
  // 0.18R는 실루엣 아래끝(0.74R)이 콘 테두리를 0.56R 물게 하는 값이다. 로브가
  // 테두리에 얹히기만 하면 스쿱이 콘 위에 놓인 게 아니라 떠 있는 것처럼 보인다.
  const bottomCy = coneTopY(n) - R * 0.18;
  if (selIdx == null) return bottomCy - i * STEP;

  const shift = i > selIdx ? -LIFT_ABOVE : i < selIdx ? PUSH_BELOW : 0;
  return bottomCy - i * STEP + shift;
}

/**
 * 빠져나온 스쿱이 남긴 빈 슬롯의 세로 범위(viewBox 단위). 글은 이 안에만 들어간다.
 *
 * **고른 스쿱의 중심을 한가운데 둔다** — 왼쪽의 스쿱과 오른쪽의 글이 같은 높이에
 * 나란히 서야 하기 때문이다. 위아래로 벌어지는 양(LIFT_ABOVE·PUSH_BELOW)이 바로
 * 이 대칭을 만들려고 정해진 값이라, 어느 스쿱을 골라도 슬롯 크기가 같다.
 */
export function slotRange(selIdx: number, n: number): { top: number; height: number } {
  const cy = scoopCy(selIdx, n, selIdx);
  return { top: cy - SLOT_HALF, height: 2 * SLOT_HALF };
}

/* ── 스쿱 실루엣 ("아이스크림 도안.png" = 시안 4번 물결형에서 실측) ──── */

/*
 * 도안을 픽셀 단위로 훑어보니 실루엣이 **원 여섯 개의 호**로 딱 떨어졌다.
 * 돔은 반지름 112px의 정원(定圓)이고, 바닥의 물결은 그 아래에 걸린 원 다섯 개다.
 * 여섯 개 모두 원으로 피팅했을 때 잔차가 선 굵기의 절반 안에 들어왔다.
 *
 * 그래서 곡선을 샘플링해 근사하지 않고 호를 그대로 이어 붙인다. 이전 구현은
 * 원반들을 부드러운 합집합으로 녹인 뒤 광선으로 훑어 Catmull-Rom으로 이었는데,
 * 그 방식은 로브 사이의 **뾰족한 골을 뭉개 버린다**. 도안의 골은 뭉개진 곳이
 * 아니라 두 원이 실제로 만나는 교점이다(계산한 교점이 실측 골과 1.7° 안쪽에서
 * 일치했다). 호로 그리면 근사 오차가 아예 없고 코드도 짧다.
 *
 * 주의: 이 실루엣은 원들의 합집합이 **아니다**. 가운데 로브는 돔 원 안에
 * 완전히 들어가 있어서(0.563 + 0.369 < 1) 합집합으로는 사라진다. 도안은
 * 돔의 아랫배를 물결로 깎아낸 그림이고, 그래서 경계를 직접 잇는 것이 맞다.
 */

/**
 * 도안 실측값의 단위 = 돔 반지름. 원점은 돔 중심, y는 아래가 +.
 *
 * 모든 값은 붓 자국의 **중심선**에서 쟀다. 바깥 테두리에서 재면 실루엣이 선 굵기의
 * 절반만큼 부풀고, 여기에 선을 다시 얹으면 도안보다 한 겹 커진다.
 */
type Circle = { x: number; y: number; r: number };

/** 돔. 위쪽 절반만 실루엣에 쓰이고 아랫배는 로브가 대신한다. */
const DOME: Circle = { x: 0, y: 0, r: 1 };

/**
 * 바닥 물결 — 시계방향(오른쪽 → 아래 → 왼쪽) 순서. 바깥 로브 둘이 돔보다 옆으로
 * 가장 많이 부풀어 반폭을 정한다(돔 반지름의 1.256배). 가운데 로브만 돔 원 안쪽에
 * 들어가 바닥을 깎는다.
 *
 * 도안은 손그림이라 좌우가 조금 어긋나 있는데, 대칭으로 평균 내어 썼다.
 */
const LOBES: Circle[] = [
  { x: 0.984, y: 0.348, r: 0.272 },
  { x: 0.594, y: 0.562, r: 0.315 },
  { x: 0, y: 0.563, r: 0.369 },
  { x: -0.594, y: 0.562, r: 0.315 },
  { x: -0.984, y: 0.348, r: 0.272 },
];

/** 실루엣을 이루는 호의 순서 — 돔 꼭대기에서 출발해 시계방향으로 한 바퀴. */
const RIM: Circle[] = [DOME, ...LOBES];

/** 반폭(= R)으로 잰 돔 반지름. 도안 좌표에 이 값을 곱하면 스쿱 좌표가 된다(du). */
const DOME_R = 1 / (LOBES[0].x + LOBES[0].r);

/**
 * 원점에서 스쿱 꼭대기까지. 반폭 기준.
 *
 * 꼭대기는 돔의 정수리라 결국 돔 반지름과 같은 값이다. 이름을 따로 두는 것은
 * 콘 높이·선택 링·체리 위치가 "실루엣의 위쪽 끝"을 쓰는 것이지 돔을 쓰는 것이
 * 아니어서다 — 실루엣을 바꿔도 레이아웃 쪽 계산은 그대로 둘 수 있다.
 */
export const SCOOP_DOME = DOME_R;
/** 원점에서 가장 깊은 로브 끝까지. 콘 위치·링 크기 계산에 쓴다. */
export const SCOOP_BOTTOM = DOME_R * (LOBES[2].y + LOBES[2].r);

/* ── 선택했을 때 벌어지는 슬롯 (실루엣 치수에서 파생되므로 여기에 둔다) ──── */

/**
 * 글이 들어갈 슬롯의 반높이. 고른 스쿱의 중심에서 위아래로 이만큼씩이다.
 *
 * 78단위 = 좁은 화면(본문 288px)에서 86px, 360px 기기에서 98px. 패널 네 줄이
 * 86.5px이므로 가장 좁은 화면에서도 잘리지 않는 최소값이다.
 */
export const SLOT_HALF = 39;

/**
 * 선택 시 위 무리가 올라가는 양. 위 이웃의 아랫자락(SCOOP_BOTTOM)이 슬롯 위끝에
 * 정확히 맞닿는 값이다 — 스쿱끼리 STEP만큼 겹쳐 쌓이므로 자연 여유(17.97)만으로는
 * 모자란 만큼만 더 벌린다.
 */
export const LIFT_ABOVE = SLOT_HALF - (STEP - SCOOP_BOTTOM * R);

/**
 * 선택 시 아래 무리가 **콘과 함께** 내려가는 양.
 *
 * 기준이 아래 이웃이 아니라 콘이다: 맨 아래 스쿱을 고르면 그 밑에는 이웃 대신
 * 콘 테두리가 있고, 스쿱이 콘에 0.18R 파묻혀 있어 여유가 제일 적다. 그 경우에
 * 맞추면 다른 경우는 저절로 남는다.
 */
export const PUSH_BELOW = SLOT_HALF - R * 0.18;

/**
 * 시계방향으로 a에서 b로 넘어가는 이음매 = 두 원의 교점 중 바깥쪽.
 *
 * 두 교점은 중심을 잇는 선에 대칭이므로, 그 선을 시계 반대 방향으로 90° 돌린
 * 쪽이 항상 바깥이다. 원점에서의 거리로 고르면 돔과 바깥 로브의 교점 둘이
 * **똑같이 돔 반지름**이라 갈리지 않는다.
 */
function seam(a: Circle, b: Circle): [number, number] {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const t = (d * d + a.r * a.r - b.r * b.r) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.r * a.r - t * t));
  return [a.x + t * ux + h * uy, a.y + t * uy - h * ux];
}

/**
 * 스쿱 실루엣 — 돔 호 하나 + 물결 로브 호 다섯.
 *
 * 이음매마다 두 호의 접선이 꺾여 뾰족한 골이 남는다. 도안이 그렇게 그려져 있고,
 * 외곽선의 stroke-linejoin="round"가 붓 자국만큼만 둥글려 준다.
 *
 * 가로는 정확히 ±r, 세로는 -SCOOP_DOME*r ~ +SCOOP_BOTTOM*r에 들어온다.
 */
export function scoopPath(r: number = R): string {
  const k = DOME_R * r;
  const f = (v: number) => Number((v * k).toFixed(3));

  const seams = RIM.map((c, i) => seam(c, RIM[(i + 1) % RIM.length]));
  const start = seams[seams.length - 1];

  let d = `M ${f(start[0])} ${f(start[1])}`;
  for (let i = 0; i < RIM.length; i++) {
    const c = RIM[i];
    const from = seams[(i + seams.length - 1) % seams.length];
    const to = seams[i];
    const a0 = Math.atan2(from[1] - c.y, from[0] - c.x);
    const a1 = Math.atan2(to[1] - c.y, to[0] - c.x);
    // 경계는 시계방향(= 각이 커지는 쪽, y가 아래라서)으로만 돈다.
    const sweep = (a1 - a0 + 2 * Math.PI) % (2 * Math.PI);
    const large = sweep > Math.PI ? 1 : 0;
    d += ` A ${f(c.r)} ${f(c.r)} 0 ${large} 1 ${f(to[0])} ${f(to[1])}`;
  }
  return `${d} Z`;
}

/* ── 도안의 장식 (좌표·크기는 전부 돔 반지름 단위, 원점은 스쿱 중심) ──── */

/** 왼쪽 위에서 빛이 온다 — 돔의 큰 하이라이트와 로브의 작은 윤기가 모두 왼쪽이다. */
export const HIGHLIGHT = { x: -0.547, y: -0.436, rx: 0.268, ry: 0.121, rot: 128 };

/** 로브 위의 작은 윤기. 오른쪽 로브에는 없다(광원이 왼쪽이라). */
export const GLINTS = [
  { x: -1.042, y: 0.245, rx: 0.111, ry: 0.059, rot: 131 },
  { x: -0.732, y: 0.583, rx: 0.132, ry: 0.06, rot: 106 },
  { x: -0.091, y: 0.651, rx: 0.096, ry: 0.05, rot: 101 },
];

/**
 * 물결 자국 — 로브 위에 얹힌 ∩ 모양 붓 자국 셋. 도안의 "물결형"을 물결로 읽게
 * 하는 것이 사실상 이 셋이라, 실루엣만큼이나 위치를 그대로 옮겼다.
 * `from`/`to`는 자국 자신의 원 중심에서 잰 각도(도).
 */
export const WAVE_MARKS = [
  { x: -0.688, y: 0.434, r: 0.122, from: -148, to: -21, w: 0.056 },
  { x: 0.081, y: 0.544, r: 0.138, from: -153, to: -17, w: 0.063 },
  { x: 0.621, y: 0.445, r: 0.119, from: -163, to: -24, w: 0.065 },
];

/**
 * 체리. 돔 정수리에 살짝 걸터앉는다 — 중심이 돔 선보다 0.012만큼 위다.
 * 선이 돔보다 얇은 것도 도안 그대로다(6.5px 대 7.6px).
 */
export const CHERRY = {
  cy: -1.012,
  r: 0.245,
  line: 0.058,
  /** 왼쪽 위 연분홍 윤기. 체리 중심 기준. */
  glint: { x: -0.091, y: -0.1, r: 0.054 },
  /** 줄기 — 체리 안에서 시작해 오른쪽 위로 휘어 나간다. */
  stem: { x0: 0.054, y0: -1.183, cx: 0.075, cy: -1.455, x1: 0.327, y1: -1.62, w: 0.07 },
};

/** 도안 기준 외곽선 굵기(돔 반지름의 0.068배). */
export const LINE = Number((0.068 * DOME_R * R).toFixed(2));

/** 장식 좌표(돔 반지름 단위) → 스쿱 좌표. */
export const du = (v: number, r: number = R) => Number((v * DOME_R * r).toFixed(2));

/** 물결 자국 하나의 호. 각도는 자국 자신의 원 중심 기준이라 시계방향으로만 돈다. */
export function waveMarkPath(m: (typeof WAVE_MARKS)[number], r: number = R): string {
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${du(m.x + m.r * Math.cos(a), r)} ${du(m.y + m.r * Math.sin(a), r)}`;
  };
  const large = m.to - m.from > 180 ? 1 : 0;
  return `M ${at(m.from)} A ${du(m.r, r)} ${du(m.r, r)} 0 ${large} 1 ${at(m.to)}`;
}

/** 체리 줄기. 체리 안에서 시작하므로 체리 위에 그려야 도안대로 보인다. */
export function cherryStemPath(r: number = R): string {
  const { x0, y0, cx, cy, x1, y1 } = CHERRY.stem;
  return `M ${du(x0, r)} ${du(y0, r)} Q ${du(cx, r)} ${du(cy, r)} ${du(x1, r)} ${du(y1, r)}`;
}
