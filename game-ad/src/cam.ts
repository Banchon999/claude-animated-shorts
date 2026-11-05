import { BURST, SLAMS, STOMPS, heroX, heroY, smooth, BOSS_X } from "./timeline";

export type Cam = { pos: [number, number, number]; look: [number, number, number]; fov: number; roll: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hxEnd = heroX(335);
// shot boundaries (hard cuts on big reframes, glides inside a shot)
export const CUTS = [0, 90, 192, 270, 310, 345, 395, 447, 482, 560];

export const camAt = (f: number): Cam => {
  const hx = heroX(f), hy = heroY(f);
  let c: Cam;
  if (f < 90) { // hook: low, close tracking, creeping push
    const t = f / 90;
    c = { pos: [hx + 5.2 - 1.4 * t, 1.5 + 0.6 * t, 8.6 - 1.0 * t], look: [hx + 0.7, hy * 0.5 + 1.3, 0], fov: 54, roll: 0.07 };
  } else if (f < 192) { // stomp combo: higher, wider, slow orbit
    const t = (f - 90) / 102;
    c = { pos: [hx + 5.5 - 2.5 * t, 4.2 - 1.2 * t, 11.5 - 1.0 * t], look: [hx + 1.0, 1.9, 0], fov: 58, roll: -0.05 };
  } else if (f < 270) { // long jump: behind-low tracking, looks ahead down the level
    const t = (f - 192) / 78;
    c = { pos: [hx - 10 + 6 * t, 2.4 + hy * 0.25, 9.5 - 1.5 * t], look: [hx + 2.6, 2.2 + hy * 0.55, 0], fov: 60, roll: 0.1 - 0.05 * t };
  } else if (f < 310) { // hero skids to a stop while the ground starts to shake
    const t = (f - 270) / 40;
    c = { pos: [hx + 1.2, 1.9 + 0.5 * t, 12 - 1.0 * t], look: [hx + 2.0, 2.6, 0], fov: 58, roll: 0.06 };
  } else if (f < 345) { // boss rises: wide reveal, slow push
    const t = (f - 310) / 35;
    c = { pos: [hxEnd + 3.2, 5, 31 - 4 * t], look: [hxEnd + 3.2, 7.2 + 0.8 * t, 0], fov: 62, roll: 0 };
  } else if (f < 395) { // slam 1: wide, hero tiny against the giant
    const t = (f - 345) / 50;
    c = { pos: [hxEnd + 4.5, 4.2, 25 - 3 * t], look: [hxEnd + 4.5, 6.6, 0], fov: 60, roll: -0.03 };
  } else if (f < 447) { // slam 2: high angle
    const t = (f - 395) / 52;
    c = { pos: [hxEnd + 1.5 + 1.5 * t, 11 - 1.2 * t, 14], look: [hxEnd + 3.2, 2.2, 0], fov: 56, roll: 0.05 };
  } else if (f < 482) { // slam 3: dutch, close
    const t = (f - 447) / 35;
    c = { pos: [hxEnd + 5.5 - 1.2 * t, 2.8, 14 - 1.5 * t], look: [hxEnd + 2.4, 3.6 + hy * 0.25, 0], fov: 56, roll: 0.14 };
  } else if (f < 560) { // charge + burst: orbit around the hero, push in on the burst
    const t = (f - 482) / 78, a = lerp(-0.7, 0.95, smooth(t));
    c = { pos: [hxEnd + 9.5 * Math.sin(a), 1.2 + hy * 0.35 + 2 * t, 9.5 * Math.cos(a)], look: [hxEnd, hy + 1.5, 0], fov: lerp(54, 44, smooth((f - 500) / 25)), roll: 0.05 * Math.sin(t * 6) };
  } else { // pull-back and rise to reveal the level
    const e = smooth((f - 560) / 160);
    c = { pos: [hxEnd + 6 + 14 * e, 2.6 + 24 * e, 12 + 34 * e], look: [hxEnd + 2.5 + 10 * e, 2.5 + 3 * e, 0], fov: lerp(52, 46, e), roll: 0.02 };
  }
  // impact kicks: flip sign every frame, decay over 7 frames
  const kick = (at: number, amp: number) => { const d = f - at; if (d >= 0 && d < 7) { const k = (1 - d / 7) * amp * (d % 2 ? -1 : 1); c.pos[1] += k; c.look[1] += k * 0.6; c.pos[0] += k * 0.5; c.roll += k * 0.04; } };
  for (const s of SLAMS) kick(s, 0.55);
  for (const s of STOMPS) kick(s, 0.16);
  kick(BURST, 0.7);
  if (f > 270 && f < 335) { const s = (1 - smooth((f - 270) / 60)) * 0.12; c.pos[1] += Math.sin(f * 2.3) * s; }
  return c;
};
export { BOSS_X };
