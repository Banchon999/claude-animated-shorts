// Timeline of "Made of Thin Air" (60 s, no voice): shots timed to the subtitle cards (SUBS), story state (willow
// growth, season, what sits on the balance, the balance beam angle) and the camera grammar of the bridge short:
// continuous slow push-ins; symmetric smootherstep glides of 18-40 f; big reframes are cuts; impacts are 7-frame
// kicks that flip sign every frame; no hand-held float.
export const FPS = 30;
export const TOTAL = 1800;
export const D0 = 0; // ground height of the courtyard (build.ts houses sit on it)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- places (one world, zones 400 m apart so fog hides each from the others) ----------------
/** the hill with the hero oak (hook, kid breathing, the stump with rings) */
export const HILL_H = 3, HILL_R = 46;
export const groundY = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  if (r >= HILL_R) return 0;
  const u = r / HILL_R;
  return HILL_H * (1 - u * u) * (1 - u * u);
};
export const OAK: V3 = [0, groundY(0, 0), 0];
export const STUMP: V3 = [-2.6, groundY(-2.6, 6.4), 6.4];
export const KID_BREATHE: V3 = [1.0, groundY(1.0, 6.6), 6.6];
export const KID_STUMP: V3 = [-2.3, groundY(-2.3, 5.45), 5.45]; // behind the stump, pointing down at the rings
/** van Helmont's courtyard (Brussels area, 1640s) */
export const CX = 400;
export const POT: V3 = [399.0, 0, -0.6];
export const POT_H = 0.62, POT_R = 0.5;
export const SCALE: V3 = [401.5, 0, -1.2];
export const PIVOT_Y = 2.0, ARM = 0.85, STRING = 1.0;
/** the balance is turned 43 deg so the vertical frame sees both pans (left pan nearer the lens) */
export const SCALE_YAW = 0.75;
/** beam end (s = -1 left, +1 right) for beam angle th */
export const beamEnd = (s: number, th: number): V3 => [SCALE[0] + s * ARM * Math.cos(th) * Math.cos(SCALE_YAW), PIVOT_Y + s * ARM * Math.sin(th), SCALE[2] - s * ARM * Math.cos(th) * Math.sin(SCALE_YAW)];
export const DOOR: V3 = [400, 0, -7];
/** the cut-away trunk over a cut-away bank of soil (roots, water climbing) */
export const TRUNK: V3 = [0, 0, 404]; // front cut plane at z = 404, soil top at y = 6
export const SOIL_TOP = 6;
/** roots on the soil face: polylines from the trunk base to the tip (x relative to the trunk axis, y absolute) */
export const ROOTS: { pts: [number, number][]; r0: number }[] = [
  { pts: [[-1.6, 6.0], [-1.95, 5.2], [-2.2, 4.2], [-2.7, 3.1], [-3.0, 1.9]], r0: 0.36 },
  { pts: [[-0.9, 6.0], [-1.1, 4.9], [-1.0, 3.6], [-1.5, 2.3], [-1.7, 1.0]], r0: 0.32 },
  { pts: [[-0.2, 6.0], [-0.35, 4.7], [-0.1, 3.3], [-0.4, 2.0], [-0.25, 0.7]], r0: 0.3 },
  { pts: [[0.5, 6.0], [0.6, 4.7], [0.35, 3.4], [0.75, 2.2], [0.7, 0.9]], r0: 0.3 },
  { pts: [[1.1, 6.0], [1.4, 5.0], [1.4, 3.8], [1.9, 2.6], [2.1, 1.4]], r0: 0.32 },
  { pts: [[1.7, 6.0], [2.2, 5.3], [2.7, 4.4], [3.2, 3.4], [3.6, 2.4]], r0: 0.34 },
  { pts: [[-2.0, 6.0], [-2.7, 5.4], [-3.4, 4.8], [-4.2, 4.1]], r0: 0.3 },
];
/** point along root k, u = 0 at the tip .. 1 at the trunk base (by arc length) */
export const alongRoot = (k: number, u: number): [number, number] => {
  const p = [...ROOTS[k].pts].reverse(), seg = p.slice(1).map((q, i) => Math.hypot(q[0] - p[i][0], q[1] - p[i][1]));
  let d = clamp01(u) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const k2 = Math.min(1, d / seg[i]); return [p[i][0] + (p[i + 1][0] - p[i][0]) * k2, p[i][1] + (p[i + 1][1] - p[i][1]) * k2]; }
    d -= seg[i];
  }
  return p[p.length - 1];
};
/** the giant leaf in the sky */
export const LEAF: V3 = [-400, 30, 0];
/** surface point of the giant leaf (local x, y) -> world, matching leafGeo with the hero parameters */
export const LEAF_L = 5.6, LEAF_W = 1.7, LEAF_CURL = 0.35, LEAF_ARCH = 0.3, LEAF_TILT = 0.12;
export const leafPoint = (x: number, y: number, lift = 0.05): V3 => {
  const z = -LEAF_CURL * (x / LEAF_W) ** 2 + LEAF_ARCH * 4 * (y / LEAF_L) * (1 - y / LEAF_L);
  // the leaf group: base at LEAF - (0, L/2, 0), rotated by LEAF_TILT about z
  const bx = x, by = y - LEAF_L / 2, c = Math.cos(LEAF_TILT), s = Math.sin(LEAF_TILT);
  return [LEAF[0] + bx * c - by * s, LEAF[1] + bx * s + by * c, LEAF[2] + z + lift];
};
/** points on the trunk cut face: tube k (TUBES index) at height y */
export const TRUNK_R = 2.2;



// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Place = "hill" | "court" | "trunk" | "leaf";
export type ShotDef = { id: number; a: number; b: number; light: Light; place: Place };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 120, light: "day", place: "hill" },        // hook: the oak, molecules drifting in
  { id: 2, a: 120, b: 270, light: "day", place: "court" },     // Belgium 1640s, the doctor with a sapling
  { id: 3, a: 270, b: 450, light: "day", place: "court" },     // weighs the sapling, then the soil
  { id: 4, a: 450, b: 510, light: "day", place: "court" },     // time-lapse: spring, watering
  { id: 5, a: 510, b: 570, light: "golden", place: "court" },  // autumn, leaves falling
  { id: 6, a: 570, b: 630, light: "day", place: "court" },     // spring again, big willow
  { id: 7, a: 630, b: 780, light: "day", place: "court" },     // the willow on the balance: 77 kg
  { id: 8, a: 780, b: 900, light: "day", place: "court" },     // the soil: the needle barely moves, 57 grams
  { id: 9, a: 900, b: 1050, light: "day", place: "court" },    // luckily / unluckily: tilt up to the air
  { id: 10, a: 1050, b: 1230, light: "day", place: "trunk" },  // roots drink, water climbs like a straw
  { id: 11, a: 1230, b: 1410, light: "day", place: "leaf" },   // mouths on the leaf gulp CO2
  { id: 12, a: 1410, b: 1520, light: "day", place: "leaf" },   // sunlight splits it, carbon stays
  { id: 13, a: 1520, b: 1600, light: "day", place: "hill" },   // oxygen out, for us (kid breathing)
  { id: 14, a: 1600, b: 1710, light: "day", place: "hill" },   // the rings of a stump
  { id: 15, a: 1710, b: TOTAL, light: "day", place: "court" }, // over his head all along
];
/** crossfades (frames) at place / time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 5: 10, 6: 10, 10: 8, 11: 8, 13: 8, 15: 8 };
export const FLASH_AT = 120;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- subtitles (no voice: these carry the story) ----------------
/** a = first frame, b = last frame + 1; words wrapped in * are highlighted */
export type Sub = { a: number; b: number; text: string };
export const SUBS: Sub[] = [
  { a: 8, b: 118, text: "This tree is made of *thin air.*" },
  { a: 126, b: 196, text: "Belgium, 1640s." },
  { a: 200, b: 268, text: "A doctor named van Helmont asks: *what is a tree made of?*" },
  { a: 274, b: 356, text: "He weighs a tiny willow: *2 kg.*" },
  { a: 362, b: 448, text: "Then 90 kg of dry soil." },
  { a: 454, b: 560, text: "For five years, he gives it *nothing but rainwater.*" },
  { a: 564, b: 628, text: "It grows. And grows." },
  { a: 636, b: 776, text: "The willow now weighs *77 kg.*" },
  { a: 784, b: 838, text: "The soil? It lost..." },
  { a: 842, b: 898, text: "*57 grams.*" },
  { a: 904, b: 970, text: "Luckily, he weighed everything." },
  { a: 974, b: 1048, text: "Unluckily, he *never weighed the air.*" },
  { a: 1056, b: 1118, text: "Roots drink water." },
  { a: 1122, b: 1228, text: "Leaves pull it up the trunk, *like sipping a straw.*" },
  { a: 1236, b: 1408, text: "Tiny mouths on every leaf *gulp carbon dioxide* from the air." },
  { a: 1414, b: 1464, text: "Sunlight splits it." },
  { a: 1468, b: 1518, text: "Carbon *builds the wood.*" },
  { a: 1524, b: 1598, text: "Oxygen goes out, *for us.*" },
  { a: 1604, b: 1708, text: "Every ring is *one year of air,* turned into wood." },
  { a: 1714, b: 1798, text: "The answer was *over his head* all along." },
];

// ---------------- story state ----------------
export type Season = "spring" | "autumn";
/** willow growth 0 (sapling, 0.9 m) .. 1 (five years, 3.4 m) and where it is */
export type WillowAt = "hand" | "pan" | "ground" | "pot" | "lying" | "none";
export const willow = (id: number, f: number): { g: number; at: WillowAt; season: Season } => {
  switch (id) {
    case 2: return { g: 0, at: "hand", season: "spring" };
    case 3: return { g: 0, at: f < 360 ? "pan" : "ground", season: "spring" };
    case 4: return { g: lin([[440, 0.12], [520, 0.3]], f), at: "pot", season: "spring" };
    case 5: return { g: lin([[500, 0.36], [580, 0.62]], f), at: "pot", season: "autumn" };
    case 6: return { g: lin([[560, 0.7], [640, 1.0]], f), at: "pot", season: "spring" };
    case 7: return { g: 1, at: "pan", season: "spring" };
    case 8: case 9: return { g: 1, at: "lying", season: "spring" };
    case 15: return { g: 1, at: "pot", season: "spring" };
    default: return { g: 0, at: "none", season: "spring" };
  }
};
/** what sits on the two pans: left (tree / soil) and the number of iron weights on the right */
export type PanLoad = { left: "sapling" | "soil" | "willow" | "none"; weights: number; drop: number };
/** drop = frame a new load lands on the right pan (the beam swings from tilted to level, settling with a ding) */
export const panLoad = (id: number, f: number): PanLoad => {
  if (id === 3) return f < 360 ? { left: "sapling", weights: f >= 300 ? 1 : 0, drop: 300 } : { left: "soil", weights: f >= 390 ? 9 : 0, drop: 390 };
  if (id === 7) return { left: "willow", weights: f >= 700 ? 14 : 0, drop: 700 };
  if (id === 8 || id === 9) return { left: "soil", weights: 9, drop: -999 };
  return { left: "none", weights: 0, drop: -999 };
};
/** beam angle (rad, + = left pan down). Before the drop the loaded side rests down; then a damped swing to level. */
export const beamAngle = (id: number, f: number) => {
  const L = panLoad(id, f);
  if (L.left === "none") return 0;
  const rest = id === 7 ? 0.36 : 0.22;
  if (id === 8 || id === 9) {
    // the soil lost 57 g: the needle starts a hair off level and the hair is all it moves
    const t = (f - 790) / FPS;
    return f < 790 ? -0.004 : -0.004 + 0.0075 * Math.exp(-1.3 * t) * Math.sin(5.2 * t);
  }
  if (f < L.drop) return rest;
  const t = (f - L.drop) / FPS;
  return rest * Math.exp(-2.4 * t) * Math.cos(6.2 * t);
};
/** wobble of the right pan when a weight lands (for the drop puff) */
export const DINGS = [300, 390, 700];

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mixCam = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mixCam(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const at = (p: V3, dx: number, dy: number, dz: number): V3 => [p[0] + dx, p[1] + dy, p[2] + dz];

// doctor marks (cast.ts reads them too)
export const DOC_WALK0: V3 = [400.0, 0, -6.4], DOC_WALK1: V3 = [400.15, 0, -2.3];
export const DOC_SCALE: V3 = [400.0, 0, -0.1];
export const DOC_WATER: V3 = [398.05, 0, -0.05];
export const DOC_FINAL: V3 = [400.1, 0, -0.35];
export const WALK_A = 126, WALK_B = 214; // frames of the walk out of the door
export const docWalk = (f: number): V3 => { const u = smooth((f - WALK_A) / (WALK_B - WALK_A)); return DOC_WALK0.map((v, i) => v + (DOC_WALK1[i] - v) * u) as V3; };

const OAKC = OAK;
const S1a = (f: number) => dolly([7, OAKC[1] + 1.6, 36], at(OAKC, 0, 8.5, 0), pushK(f, 0, 0.0028), { fov: 46 });
const S1b = (f: number) => dolly([3.2, OAKC[1] + 3.2, 19], at(OAKC, 0, 10.5, 0), pushK(f, 56, 0.003), { fov: 44, roll: 0.035 });
const S2a = (f: number) => zoom([400.6, 1.55, 10], [400, 3.4, -6], 48, pushK(f, 120, 0.0022));
const S2b = (f: number) => { const d = docWalk(f); return dolly([d[0] - 0.4, 1.5, d[2] + 3.9], [d[0], 1.42, d[2]], pushK(f, 196, 0.0025, 0.006, 30), { fov: 38 }); };
const S3a = (f: number) => dolly([402.7, 1.75, 4.6], [401.1, 1.3, -0.75], pushK(f, 270, 0.0022), { fov: 42 });
const S3b = (f: number) => dolly([401.95, 1.5, 3.5], [401.15, 1.15, -0.9], pushK(f, 356, 0.0022), { fov: 40, roll: -0.03 });
const S4a = (f: number) => dolly([399.35, 1.75, 5.3], [399.0, 1.55, -0.6], pushK(f, 444, 0.0012), { fov: 42 });
const S7a = (f: number) => dolly([402.6, 2.0, 6.6], [400.75, 2.0, -0.8], pushK(f, 626, 0.002), { fov: 44 });
const S7b = (f: number) => dolly([402.6, 1.6, 4.9], [401.3, 1.5, -1.0], pushK(f, 700, 0.0015, 0.006, 30), { fov: 42, roll: 0.035 });
const S8a = (f: number) => zoom([SCALE[0] + Math.sin(SCALE_YAW) * 1.5, PIVOT_Y + 0.32, SCALE[2] + Math.cos(SCALE_YAW) * 1.5], [SCALE[0], PIVOT_Y + 0.3, SCALE[2]], 34, pushK(f, 780, 0.0028));
const S8b = (f: number) => dolly([DOC_SCALE[0] + 0.25, 1.55, DOC_SCALE[2] + 2.6], [DOC_SCALE[0], 1.5, DOC_SCALE[2]], pushK(f, 840, 0.002, 0.007, 30), { fov: 38, roll: -0.04 });
const S9a = (f: number) => dolly([DOC_SCALE[0] + 0.6, 1.6, DOC_SCALE[2] + 3.0], [DOC_SCALE[0], 1.45, DOC_SCALE[2]], pushK(f, 900, 0.0025), { fov: 38 });
const S9b = (f: number) => ({ pos: [401.2, 0.8, 4.0] as V3, look: [401.2, 2.4, -2] as V3, fov: 46, roll: 0 });
const S9c = (f: number) => dolly([401.2, 0.8, 4.0], [401.0, 13, -4], pushK(f, 1000, 0.0015), { fov: 46, roll: 0.03 });
const TR = TRUNK;
const S10a = (f: number) => dolly(at(TR, 0.4, 3.6, 9.5), at(TR, 0, 3.4, 0), pushK(f, 1046, 0.002), { fov: 42 });
const S10b = (f: number) => dolly(at(TR, -0.4, 15.5, 10), at(TR, 0, 16.5, 0), pushK(f, 1150, 0.002), { fov: 42, roll: 0.03 });
const LF = LEAF;
const S11a = (f: number) => dolly(at(LF, 0.6, -0.4, 9.2), at(LF, 0, 0.3, 0), pushK(f, 1226, 0.0016), { fov: 40 });
const S11b = (f: number) => dolly(at(LF, -0.2, -0.6, 5.0), at(LF, -0.35, -0.4, 0), pushK(f, 1320, 0.0018), { fov: 38, roll: -0.035 });
const S12a = (f: number) => dolly(at(LF, 0.9, 0.5, 4.4), at(LF, 0.5, 0.6, 0), pushK(f, 1410, 0.002, 0.006, 28), { fov: 38 });
const S12b = (f: number) => dolly(at(LF, 0.4, -2.2, 6.0), at(LF, 0.1, -1.6, 0), pushK(f, 1466, 0.0022), { fov: 40, roll: 0.035 });
const KB = KID_BREATHE;
const S13a = (f: number) => dolly(at(KB, 0.5, 1.25, 3.6), at(KB, 0.0, 1.1, 0), pushK(f, 1516, 0.0025, 0.005, 30), { fov: 38 });
const ST = STUMP;
const S14a = (f: number) => dolly(at(ST, 0.15, 1.55, 3.0), at(ST, 0.15, 0.8, -0.4), pushK(f, 1600, 0.0022), { fov: 40 });
const S14b = (f: number) => dolly(at(ST, 0.05, 1.7, 1.15), at(ST, 0.0, 0.5, 0), pushK(f, 1654, 0.002), { fov: 36, roll: -0.03 });
const S15a = (f: number) => dolly([400.35, 1.5, 3.7], [399.9, 1.55, -0.5], pushK(f, 1706, 0.002), { fov: 40 });
const CRANE: V3[] = [[400.5, 4.5, 4.4], [400.6, 9, 3.2], [400.0, 22, -6]];
const S15b = (f: number): Shot => {
  const a = S15a(1742), s = glide((f - 1742) / 56), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (46 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 56, dur: 40, s: S1b }],
  2: [{ f: 120, s: S2a }, { f: 196, cut: true, s: S2b }],
  3: [{ f: 270, s: S3a }, { f: 356, cut: true, s: S3b }],
  4: [{ f: 444, s: S4a }],
  7: [{ f: 626, s: S7a }, { f: 700, cut: true, s: S7b }, { f: 700, dur: 20, s: rolled(S7b, -0.02) }],
  8: [{ f: 776, s: S8a }, { f: 840, cut: true, s: S8b }],
  9: [{ f: 896, s: S9a }, { f: 972, cut: true, s: S9b }, { f: 980, dur: 40, s: S9c }],
  10: [{ f: 1046, s: S10a }, { f: 1124, dur: 40, s: S10b }],
  11: [{ f: 1226, s: S11a }, { f: 1320, cut: true, s: S11b }],
  12: [{ f: 1406, s: S12a }, { f: 1466, cut: true, s: S12b }],
  13: [{ f: 1516, s: S13a }],
  14: [{ f: 1596, s: S14a }, { f: 1654, cut: true, s: S14b }],
  15: [{ f: 1706, s: S15a }, { f: 1742, s: S15b, dur: 1 }],
};
CAMS[5] = CAMS[4]; CAMS[6] = CAMS[4]; // the time-lapse keeps one camera through the seasons

// impact kicks: weights landing on the pan, the slam of 57 grams
const KICKS: [number, number][] = [[300 / FPS, 0.3], [390 / FPS, 0.5], [700 / FPS, 1.1], [842 / FPS, 0.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
const T = (f: number) => f / FPS;
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

// ---------------- lens: depth of field ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const docEyes = (p: V3): (() => V3) => () => [p[0], 1.55, p[2]];
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },                                               // hook wide on the oak
  { f: 120, cInf: 0 },                                             // courtyard establishing
  { f: 196, cInf: 12, focus: (f) => { const d = docWalk(f); return [d[0], 1.55, d[2]]; } }, // MS of the doctor
  { f: 270, cInf: 10 },                                            // the balance + sapling (focus = look)
  { f: 444, cInf: 6 },                                             // time-lapse (pot + doctor)
  { f: 626, cInf: 7 },                                             // willow on the balance
  { f: 776, cInf: 14 },                                            // the needle close-up
  { f: 840, cInf: 12, focus: docEyes(DOC_SCALE) },                 // doctor MS
  { f: 972, cInf: 0 },                                             // tilt up to the air
  { f: 1046, cInf: 6 },                                            // roots
  { f: 1124, dur: 40, cInf: 8 },                                   // trunk climb
  { f: 1226, cInf: 12, focus: () => [LEAF[0], LEAF[1], LEAF[2] + 0.1] }, // the leaf: sky + other leaves soft
  { f: 1320, cInf: 14, focus: () => [LEAF[0] - 0.35, LEAF[1] - 0.4, LEAF[2] + 0.15] },
  { f: 1406, cInf: 14, focus: () => [LEAF[0] + 0.5, LEAF[1] + 0.6, LEAF[2] + 0.15] },
  { f: 1466, cInf: 12, focus: () => [LEAF[0] + 0.1, LEAF[1] - 1.6, LEAF[2] + 0.1] },
  { f: 1516, cInf: 13, focus: () => [KID_BREATHE[0], KID_BREATHE[1] + 1.05, KID_BREATHE[2]] }, // kid CU, oak soft
  { f: 1596, cInf: 8 },                                            // stump (focus = look)
  { f: 1654, cInf: 11 },
  { f: 1706, cInf: 10, focus: docEyes(DOC_FINAL) },
  { f: 1742, dur: 40, cInf: 0 },                                   // crane into the sky
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
