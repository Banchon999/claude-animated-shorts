// LANTERN LEAP - original 2.5D platformer ad. One timeline drives picture AND sound.
// No imports on purpose: node can run it directly (scripts/export-events.ts) to feed audio/sfx.py.
export const FPS = 30;
export const TOTAL = 780; // 26 s
export const V = 11 / 30; // run speed, metres per frame

export type Arc = { f0: number; f1: number; y0: number; y1: number; h: number };
export const ARCS: Arc[] = [
  { f0: 30, f1: 62, y0: 0, y1: 0, h: 3.4 }, // gap 1
  { f0: 92, f1: 110, y0: 0, y1: 1, h: 1.8 }, // slime 1 stomp @110
  { f0: 110, f1: 128, y0: 1, y1: 1, h: 2.0 }, // slime 2 stomp @128
  { f0: 128, f1: 146, y0: 1, y1: 1, h: 2.2 }, // slime 3 stomp @146
  { f0: 146, f1: 166, y0: 1, y1: 0, h: 1.6 },
  { f0: 192, f1: 236, y0: 0, y1: 0, h: 4.2 }, // long gap 2
  { f0: 350, f1: 372, y0: 0, y1: 0, h: 3.6 }, // dodge slam 1 @360
  { f0: 402, f1: 424, y0: 0, y1: 0, h: 3.6 }, // dodge slam 2 @412
  { f0: 454, f1: 476, y0: 0, y1: 0, h: 3.6 }, // dodge slam 3 @464
  { f0: 490, f1: 540, y0: 0, y1: 0, h: 5.0 }, // charge + burst @515
];
export const STOMPS = [110, 128, 146];
export const SLAMS = [360, 412, 464];
export const BURST = 515;
export const BOSS_UP = [270, 335];
export const LOGO_HIT = 665;

const X270 = V * 270;
export const heroX = (f: number): number => {
  if (f <= 270) return V * f;
  const u = Math.min(1, (f - 270) / 65);
  return X270 + V * 65 * 0.5 * (1 - (1 - u) * (1 - u));
};
export const heroY = (f: number): number => {
  for (const a of ARCS) if (f >= a.f0 && f <= a.f1) {
    const u = (f - a.f0) / (a.f1 - a.f0);
    return a.y0 + (a.y1 - a.y0) * u + 4 * a.h * u * (1 - u);
  }
  // resting height: on a slime top between chained stomps, else the ground
  return 0;
};
export const inAir = (f: number) => ARCS.some((a) => f > a.f0 && f < a.f1);
export const BOSS_X = heroX(335) + 10.5;

// orbs are placed on the hero's own path, collected the frame the hero reaches them
const orbRuns: [number, number, number][] = [[36, 56, 4], [70, 86, 4], [196, 232, 4], [244, 268, 6]];
export const ORBS: { f: number; group: number; idx: number }[] = [];
orbRuns.forEach(([a, b, s], g) => { let i = 0; for (let f = a; f <= b; f += s) ORBS.push({ f, group: g, idx: i++ }); });

// gaps in the ground (x ranges) derived from the long jumps
export const GAPS: [number, number][] = [
  [heroX(40), heroX(53)],
  [heroX(200), heroX(228)],
];
export const SLIMES = STOMPS.map((f) => ({ x: heroX(f), f }));

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };

// sound events (frame, name, optional param) - exported to audio/events.json
export const events = (): { f: number; name: string; p?: number }[] => {
  const e: { f: number; name: string; p?: number }[] = [];
  for (let f = 4; f < 270; f += 11) if (!inAir(f)) e.push({ f, name: "step", p: f % 2 });
  for (const a of ARCS) { e.push({ f: a.f0, name: "jump", p: a.h }); if (a.y1 === 0) e.push({ f: a.f1, name: "land" }); }
  for (const f of STOMPS) e.push({ f, name: "squish" });
  for (const o of ORBS) e.push({ f: o.f, name: "orb", p: o.idx + o.group * 2 });
  e.push({ f: 270, name: "rumble", p: 65 });
  for (const f of SLAMS) e.push({ f, name: "slam" });
  e.push({ f: 482, name: "charge", p: 33 });
  e.push({ f: BURST, name: "burst" });
  e.push({ f: BURST + 6, name: "crumble", p: 55 });
  e.push({ f: 600, name: "sting" });
  e.push({ f: LOGO_HIT, name: "logo" });
  e.push({ f: 0, name: "wind", p: TOTAL });
  return e.sort((a, b) => a.f - b.f);
};
