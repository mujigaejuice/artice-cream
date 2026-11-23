/** Bowl drop-stack geometry: pure functions, no DOM. */
import assert from "node:assert/strict";
import {
  BOWL_CX, COLLIDE, CROWN_CLEARANCE, INNER_RX, TOP_MARGIN,
  bowlPaths, dropOrder, innerFloorY, layoutBowl, seededUnit,
} from "../lib/bowl";

const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 1000 + i * 7, date: "2026-11-01",
  savedAt: `2026-11-01T${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z` }));

assert.deepEqual(dropOrder([{ id: 3, date: "2026-11-02", savedAt: "2026-11-02T00:00:00Z" },
  { id: 1, date: "2026-11-01", savedAt: "2026-11-03T00:00:00Z" }, { id: 2, date: "2026-11-05", savedAt: null }]).map(s => s.id),
  [2, 3, 1], "unsaved-time first, then by save time");
assert.deepEqual(dropOrder([{ id: 9, date: "2026-11-02" }, { id: 8, date: "2026-11-01" }, { id: 7, date: "2026-11-01" }]).map(s => s.id),
  [7, 8, 9], "ties fall back to date then id");

for (const id of [0, 1, 2, 999, 123456]) {
  const u = seededUnit(id);
  assert.ok(u >= 0 && u < 1);
  assert.equal(seededUnit(id), u, "same id, same value");
}
assert.notEqual(seededUnit(1), seededUnit(2));

assert.deepEqual(layoutBowl(make(12)), layoutBowl(make(12)), "deterministic");
assert.deepEqual(layoutBowl([]), { scale: 1, placements: [], topId: null });
{
  const one = layoutBowl(make(1)).placements[0];
  assert.ok(Math.abs(one.y - (innerFloorY(one.x) - COLLIDE)) < 1e-9, "a lone scoop rests on the floor");
}
for (const n of [1, 5, 15, 30, 80]) {
  const { scale, placements, topId } = layoutBowl(make(n));
  assert.equal(placements.length, n);
  const c = COLLIDE * scale;
  for (const p of placements) {
    assert.ok(Math.abs(p.x - BOWL_CX) <= INNER_RX - c + 0.01, `n=${n}: inside the bowl rim`);
    assert.ok(p.y <= innerFloorY(p.x) - c + 0.01, `n=${n}: never below the floor`);
  }
  for (let i = 0; i < placements.length; i++) for (let j = i + 1; j < placements.length; j++)
    assert.ok(Math.hypot(placements[i].x - placements[j].x, placements[i].y - placements[j].y) >= 2 * c - 0.5,
      `n=${n}: scoops ${i} and ${j} overlap`);
  assert.equal(topId, [...placements].sort((a, b) => a.y - b.y)[0].id, `n=${n}: topping goes on the highest scoop`);
  if (n <= 30) assert.ok(placements.every(p => p.y - CROWN_CLEARANCE * scale >= TOP_MARGIN - 0.01), `n=${n}: fits the scene`);
}
{
  const a = layoutBowl(make(10)), b = layoutBowl(make(11));
  if (a.scale === b.scale) assert.deepEqual(b.placements.slice(0, 10), a.placements, "a new scoop never moves old ones");
}
assert.ok(layoutBowl(make(80)).scale < 1, "many scoops shrink");

const { back, front } = bowlPaths(BOWL_CX);
assert.match(back, /^M /);
assert.match(front, /A /);
assert.match(front, /Z$/);

console.log("Bowl layout: drop order, seeded x, determinism, rim/floor bounds, no deep overlap, top scoop, stability and shrink passed.");
