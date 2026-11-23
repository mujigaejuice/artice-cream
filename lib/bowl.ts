/**
 * 노트북 내 콘의 보울 장면 기하. 순수 함수라 서버·테스트·화면이 같은 값을 낸다.
 *
 * 스쿱은 콘에 올린 순서대로 하나씩 떨어뜨린다. x는 스쿱 id로 정해지는 무작위 값이고,
 * 그 x에서 바닥 곡면이나 먼저 놓인 스쿱에 처음 닿는 높이에 멈춘다. 그래서 먼저 놓인
 * 스쿱은 나중 스쿱의 영향을 받지 않는다(크기 단계가 같은 동안).
 *
 * 좌표는 viewBox `0 0 600 400` 단위다.
 */
import { R } from "@/lib/cone";

export const BOWL_VB_W = 600;
export const BOWL_VB_H = 400;
export const BOWL_CX = 300;
/** 테두리 타원의 중심 높이. */
export const BOWL_RIM_Y = 300;
export const BOWL_RIM_RX = 190;
export const BOWL_RIM_RY = 18;
/** 테두리에서 몸통 바닥까지. */
export const BOWL_DEPTH = 64;

/** 스쿱 중심이 움직일 수 있는 안쪽 반폭. */
export const INNER_RX = 176;
/** 안쪽 바닥 곡면이 테두리보다 가장 깊이 내려가는 양(가운데). */
export const INNER_DEPTH = 28;
/** 두 스쿱 중심이 이보다 2배 가까우면 겹친 것으로 본다. 스쿱 실루엣이 납작해 R보다 조금 작다. */
export const COLLIDE = 0.86 * R;
/** 꼭대기 스쿱 위에 토핑·체리가 들어갈 몫. */
export const CROWN_CLEARANCE = 1.5 * R;
export const TOP_MARGIN = 12;

/** 더미가 장면 위를 넘으면 이 순서로 스쿱을 줄여 다시 쌓는다. 0.42·0.36은 한 달 80개 안팎까지 장면 안에 두려는 몫이다. */
export const SCALE_STEPS = [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.36] as const;

/** 스쿱을 고르면 보울이 비켜나는 양과, 고른 스쿱이 나오는 무대. */
export const BOWL_SHIFT_X = -100;
export const STAGE = { x: 495, y: 150 };
export const STAGE_PANEL = { x: 400, y: 200, w: 190, h: 110 };

export type BowlInput = { id: number; date: string; savedAt?: string | null };
export type BowlPlacement = { id: number; x: number; y: number };
export type BowlLayout = { scale: number; placements: BowlPlacement[]; topId: number | null };

/** 떨어뜨리는 순서: 콘에 올린 시각(없으면 맨 앞), 같으면 완료 날짜, 그다음 id. */
export function dropOrder<T extends BowlInput>(scoops: T[]): T[] {
  return [...scoops].sort((a, b) => {
    const sa = a.savedAt ?? "", sb = b.savedAt ?? "";
    if (sa !== sb) return sa < sb ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id - b.id;
  });
}

/** id만으로 정해지는 [0, 1) 값(mulberry32 한 번). */
export function seededUnit(id: number): number {
  let t = (Math.trunc(id) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** 안쪽 바닥 곡면의 높이. 가운데가 가장 깊다. */
export function innerFloorY(x: number): number {
  const u = (x - BOWL_CX) / INNER_RX;
  return BOWL_RIM_Y + INNER_DEPTH * Math.sqrt(Math.max(0, 1 - u * u));
}

function highest(placed: BowlPlacement[]): number | null {
  let top: BowlPlacement | null = null;
  for (const p of placed) if (!top || p.y <= top.y) top = p;
  return top?.id ?? null;
}

type Point = { x: number; y: number };
const EPS = 1e-6;

/** (x, y0)에서 곧장 떨어뜨려 바닥이나 아래 스쿱에 처음 닿는 높이. */
function dropFrom(x: number, y0: number, placed: BowlPlacement[], c: number): number {
  let y = innerFloorY(x) - c;
  for (const p of placed) {
    const dx = Math.abs(p.x - x);
    if (dx >= 2 * c) continue;
    const contact = p.y - Math.sqrt((2 * c) ** 2 - dx ** 2);
    if (contact >= y0 - EPS) y = Math.min(y, contact);
  }
  return y;
}

const onFloor = (pt: Point, c: number) => pt.y >= innerFloorY(pt.x) - c - 1e-4;
const overlaps = (pt: Point, q: BowlPlacement, c: number) => Math.hypot(pt.x - q.x, pt.y - q.y) < 2 * c - 1e-4;

/**
 * 떨어진 스쿱이 아래 스쿱 하나에만 얹혔으면 그 둘레를 따라 굴러 내려간다.
 * 바닥·벽에 닿거나 양쪽에서 받쳐지면 멈춘다. 움직이는 것은 새 스쿱뿐이라
 * 먼저 놓인 스쿱 자리는 그대로다.
 */
function settle(id: number, x0: number, placed: BowlPlacement[], c: number, lo: number, hi: number): Point {
  let pt: Point = { x: x0, y: dropFrom(x0, -Infinity, placed, c) };
  for (let round = 0; round < 200; round++) {
    if (onFloor(pt, c)) return pt;
    const supports = placed.filter(q => q.y > pt.y && Math.hypot(pt.x - q.x, pt.y - q.y) <= 2 * c + 1e-4);
    if (supports.length === 0) { // 벽 근처에서 굴러 떨어진 뒤의 자유 낙하
      const y = dropFrom(pt.x, pt.y, placed, c);
      if (y <= pt.y + EPS) return pt;
      pt = { x: pt.x, y };
      continue;
    }
    const left = supports.some(q => q.x < pt.x - EPS), right = supports.some(q => q.x > pt.x + EPS);
    if (left && right) return pt;
    let dir = left ? 1 : right ? -1 : seededUnit(id * 31 + 7) < 0.5 ? -1 : 1;
    if ((dir > 0 && pt.x >= hi - EPS) || (dir < 0 && pt.x <= lo + EPS)) {
      if (supports.every(q => q.x >= pt.x - EPS) && pt.x <= lo + EPS) return pt;
      if (supports.every(q => q.x <= pt.x + EPS) && pt.x >= hi - EPS) return pt;
      dir = -dir;
    }
    // 다른 받침을 파고들지 않는 받침을 축으로 고른다.
    let next: Point | null = null;
    for (const pivot of supports) {
      const rolled = roll(pt, pivot, dir, placed, c, lo, hi);
      if (rolled && (!next || rolled.y > next.y)) next = rolled;
    }
    if (!next || next.y <= pt.y + EPS) return pt;
    pt = next;
  }
  return pt;
}

/** pivot 둘레를 dir 쪽으로 굴려 첫 사건(다른 스쿱·바닥·벽·적도)까지 간 자리. 바로 막히면 null. */
function roll(pt: Point, pivot: BowlPlacement, dir: number, placed: BowlPlacement[], c: number,
  lo: number, hi: number): Point | null {
  const d = 2 * c;
  const theta0 = Math.atan2(dir * (pt.x - pivot.x), pivot.y - pt.y); // 수직에서 굴러가는 쪽으로 잰 각
  const at = (theta: number): Point => ({ x: pivot.x + dir * d * Math.sin(theta), y: pivot.y - d * Math.cos(theta) });
  const blocked = (q: Point) => q.x < lo - EPS || q.x > hi + EPS || q.y > innerFloorY(q.x) - c + 1e-4 ||
    placed.some(o => o !== pivot && overlaps(q, o, c));
  const step = 0.01;
  let good = theta0;
  if (blocked(at(theta0 + step))) return null;
  for (let theta = theta0 + step; theta <= Math.PI / 2; theta += step) {
    if (blocked(at(theta))) {
      let a = good, b = theta; // 닿는 순간을 이분 탐색으로 좁힌다
      for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (blocked(at(m))) b = m; else a = m; }
      return at(a);
    }
    good = theta;
  }
  return at(Math.min(good, Math.PI / 2));
}

export function layoutBowl(scoops: BowlInput[]): BowlLayout {
  if (scoops.length === 0) return { scale: 1, placements: [], topId: null };
  const order = dropOrder(scoops);
  for (const scale of SCALE_STEPS) {
    const c = COLLIDE * scale;
    const lo = BOWL_CX - INNER_RX + c, hi = BOWL_CX + INNER_RX - c;
    const placed: BowlPlacement[] = [];
    for (const s of order) {
      const { x, y } = settle(s.id, lo + seededUnit(s.id) * (hi - lo), placed, c, lo, hi);
      placed.push({ id: s.id, x, y });
    }
    const fits = placed.every(p => p.y - CROWN_CLEARANCE * scale >= TOP_MARGIN);
    if (fits || scale === SCALE_STEPS.at(-1)) return { scale, placements: placed, topId: highest(placed) };
  }
  throw new Error("unreachable");
}

/**
 * 보울 그림. back은 테두리 타원 전체(안쪽 면, 스쿱 뒤), front는 테두리 앞쪽 호에서
 * 몸통 바닥을 지나 닫는 앞면(스쿱 앞) — 맨 아래 줄 스쿱의 아랫부분을 가려 담긴 것처럼 보인다.
 */
export function bowlPaths(cx: number): { back: string; front: string } {
  const l = cx - BOWL_RIM_RX, r = cx + BOWL_RIM_RX, y = BOWL_RIM_Y;
  const rx = BOWL_RIM_RX, ry = BOWL_RIM_RY, bottom = BOWL_RIM_Y + BOWL_DEPTH;
  const back = `M ${l} ${y} A ${rx} ${ry} 0 1 0 ${r} ${y} A ${rx} ${ry} 0 1 0 ${l} ${y} Z`;
  const front = `M ${l} ${y} A ${rx} ${ry} 0 0 0 ${r} ${y} ` +
    `C ${r} ${y + BOWL_DEPTH * 0.7} ${cx + rx * 0.55} ${bottom} ${cx} ${bottom} ` +
    `C ${cx - rx * 0.55} ${bottom} ${l} ${y + BOWL_DEPTH * 0.7} ${l} ${y} Z`;
  return { back, front };
}
