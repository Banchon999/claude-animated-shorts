// Our cast as lit flat cards in the 3D world (the bridge short's system: a canvas pool keyed by drawing, yaw-only
// billboards shaded by cardShade(), contact blobs, unlit effect cards), plus everything that moves in front of the
// world in "Made of Thin Air": the doctor, the kid, CO2 / O2 molecules, water drops, sugar rings, leaves, sparks.
import * as THREE from "three";
import {
  Pen, bodyFront, DOCTOR, KID, Outfit, Expr, FrontOpts, Prop, fxCO2, fxO2, fxC, fxDrop, fxStoma, fxRay, fxLeaf, fxSugar, fxPour,
  fxRingGlow, fxSpark, fxPuff, fxStars, fxBurst, fxContact, fxShadow,
} from "./toon";
import {
  ROOTS, alongRoot, FPS, V3, SHOTS, OAK, STUMP, KID_BREATHE, KID_STUMP, POT, POT_H, STRING, beamEnd, TRUNK, SOIL_TOP, LEAF, groundY,
  DOC_SCALE, DOC_WATER, DOC_FINAL, docWalk, WALK_B, beamAngle, smooth, clamp01, leafPoint, TRUNK_R,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { TUBES } from "./paint2";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    } else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = this.mesh.material === this.soft ? 2 : 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; roll?: number; size?: [number, number, number];
};
/** face = fixed Euler orientation (cards lying on a surface); flat = horizontal; otherwise camera-facing */
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; face?: V3 };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
/** effect canvases: bigger when close (the final is 1440 wide) */
const fxRes = (cam: CamInfo, x: number, y: number, z: number, w: number) => {
  const d = cam.pos.distanceTo(tmp.set(x, y, z)), px = (w / Math.max(0.3, d)) * 1500;
  return px > 700 ? 2 : px > 300 ? 1 : 0.5;
};

let SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

// ---------------- life: blinks ----------------
const LID = [0.5, 1, 1, 0.5];
const lidAt = (f: number, i: number) => {
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, okey: string, o: Outfit, seed: number, x: number, y: number, z: number, fo: FrontOpts, scale = 1, mirror = false): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale;
  const [w, h, k] = tier(d);
  const light = light2D(cam, mirror), f2: FrontOpts = { ...fo, light, seed };
  return { key: `F|${okey}|${fkey(f2)}`, x, y, z, scale, mirror, draw: (p) => bodyFront(p, o, f2), size: [w, h, k] };
};

const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- reusable effect placements ----------------
const fxCard = (cam: CamInfo, out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, extra: Partial<FxPlace> = {}) => {
  const k = fxRes(cam, x, y, z, w);
  out.fx.push({ key: `${key}@${k}`, cw: Math.round(cw * k), ch: Math.round(ch * k), draw: (p) => { p.g.scale(k, k); draw(p); }, x, y, z, w, h, ...extra });
};
/** a CO2 molecule (0.9 m wide by default) with a mood and an occasional blink */
const co2 = (cam: CamInfo, out: Stage, i: number, f: number, x: number, y: number, z: number, w = 0.9, mood = 0, rot = 0) => {
  const bl = lidAt(f, i + 300) >= 1 ? 1 : 0;
  fxCard(cam, out, `co2|${mood}|${bl}`, 600, 300, (p) => fxCO2(p, mood, bl), x, y, z, w, w / 2, { rot });
};
const o2 = (cam: CamInfo, out: Stage, i: number, f: number, x: number, y: number, z: number, w = 0.75, mood = 0, rot = 0) => {
  const bl = lidAt(f, i + 500) >= 1 ? 1 : 0;
  fxCard(cam, out, `o2|${mood}|${bl}`, 460, 300, (p) => fxO2(p, mood, bl), x, y, z, w, (w * 300) / 460, { rot });
};
/** molecules drifting lazily in the air around a centre (sky above the court, around the oak) */
const airDrift = (cam: CamInfo, out: Stage, f: number, n: number, c: V3, rx: number, ry: number, rz: number, w: number, seed: number) => {
  const t = f / FPS;
  for (let i = 0; i < n; i++) {
    const a = hh(i, seed) * Math.PI * 2 + t * (0.15 + 0.1 * hh(i, seed + 1)), b = hh(i, seed + 2) * Math.PI * 2 + t * 0.2;
    const x = c[0] + rx * (hh(i, seed + 3) - 0.5) * 2 + 0.4 * Math.cos(a), y = c[1] + ry * (hh(i, seed + 4) - 0.5) * 2 + 0.3 * Math.sin(b), z = c[2] + rz * (hh(i, seed + 5) - 0.5) * 2;
    const mood = i % 4 === 1 ? 3 : 0;
    co2(cam, out, i + seed * 7, f, x, y, z, w * (0.8 + 0.4 * hh(i, seed + 6)), mood, 0.25 * Math.sin(t * 0.9 + i));
  }
};

// ---------------- shots ----------------
const docPlace = (cam: CamInfo, out: Stage, f: number, pos: V3, fo: FrontOpts) => {
  const lid = lidAt(f, 11);
  out.places.push(person(cam, "doc", DOCTOR, 3, pos[0], pos[1], pos[2], { blink: lid, ...fo }));
  blob(out, pos[0], pos[1], pos[2], 1);
};
const kidPlace = (cam: CamInfo, out: Stage, f: number, pos: V3, fo: FrontOpts, mirror = false) => {
  const lid = lidAt(f, 21);
  out.places.push(person(cam, "kid", KID, 5, pos[0], pos[1], pos[2], { blink: lid, ...fo }, 0.82, mirror));
  blob(out, pos[0], pos[1], pos[2], 0.82);
};
/** the balance's pan centres at frame f (left, right), world */
const pans = (id: number, f: number): [V3, V3] => {
  const th = beamAngle(id, f);
  return [-1, 1].map((s) => { const e = beamEnd(s, th); return [e[0], e[1] - STRING, e[2]] as V3; }) as [V3, V3];
};

/** CO2 drifting into the oak canopy (hook) */
const hookFx = (cam: CamInfo, out: Stage, f: number) => {
  const t = f / FPS, c: V3 = [OAK[0], OAK[1] + 11, OAK[2]];
  for (let i = 0; i < 14; i++) {
    const a = hh(i, 1) * Math.PI * 2, el = (hh(i, 2) - 0.3) * 0.9, d0 = 13 + 5 * hh(i, 3), per = 3.2 + 1.5 * hh(i, 4);
    const u = ((t + hh(i, 5) * per) % per) / per, d = d0 * (1 - u) + 5.2 * u;
    const x = c[0] + Math.cos(a) * Math.cos(el) * d, y = c[1] + Math.sin(el) * d + 0.6 * Math.sin(t * 1.3 + i), z = c[2] + Math.sin(a) * Math.cos(el) * d + 2;
    const pop = Math.min(1, u * 6) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    if (pop < 0.05) continue;
    co2(cam, out, i, f, x, y, z, 1.25 * pop, u > 0.7 ? 1 : 0, 0.3 * Math.sin(t + i));
  }
};

/** water drops: soil -> root tips -> trunk base -> up the tubes */
const trunkFx = (cam: CamInfo, out: Stage, f: number) => {
  const t = f / FPS, [tx, , tz] = TRUNK, Y = SOIL_TOP, zf = tz + 0.35;
  // in the soil: drops crawl from the root tips toward the trunk
  for (let i = 0; i < 21; i++) {
    const k = i % ROOTS.length, per = 2.4, u = ((t * 0.9 + hh(i, 3) * per) % per) / per;
    // soak in at the tip (grow from nothing), ride the root to the trunk, vanish into the root plate
    const [x, y] = alongRoot(k, u * 1.15 - 0.1), pop = Math.min(1, (u * 1.15 - 0.02) * 6) * (u > 0.9 ? (1 - u) / 0.1 : 1);
    if (pop <= 0.05) continue;
    fxCard(cam, out, `drop|${i % 3 === 0 ? 3 : 0}`, 240, 320, (p) => fxDrop(p, i % 3 === 0 ? 3 : 0), tx + x, y + 0.12, zf, 0.3 * pop, 0.4 * pop, { rot: 0.15 * Math.sin(t * 3 + i) });
  }
  // up the tubes, a steady procession ("like sipping a straw")
  for (let k = 0; k < TUBES.length; k++) for (let j = 0; j < 9; j++) {
    const speed = 2.3 + 0.3 * hh(k, 7), y = Y - 0.5 + ((t * speed + j * 2.0 + hh(k, 8) * 2) % 18);
    const x = tx + (TUBES[k] - 0.5) * 2 * TRUNK_R;
    fxCard(cam, out, `drop|${(j + k) % 4 === 0 ? 3 : 0}`, 240, 320, (p) => fxDrop(p, (j + k) % 4 === 0 ? 3 : 0), x, y, tz + 0.2, 0.26, 0.35, { rot: 0 });
  }
};

/** stomata spots on the hero leaf (local x, y on the blade) */
const MOUTHS: [number, number][] = [[-0.55, 1.4], [0.6, 1.9], [-0.7, 2.6], [0.5, 3.2], [-0.4, 3.8], [0.35, 4.4], [0.85, 2.6], [-0.95, 2.0], [0.0, 0.9]];
const mouthOpen = (k: number, f: number) => {
  const t = f / FPS, per = 1.8, ph = ((t + hh(k, 4) * per) % per) / per; // a CO2 arrives at ph = 0.75
  return ph < 0.55 ? 0.15 : ph < 0.72 ? 0.15 + 0.85 * smooth((ph - 0.55) / 0.17) : ph < 0.82 ? 1 : Math.max(0.15, 1 - (ph - 0.82) / 0.08);
};
const leafFx = (cam: CamInfo, out: Stage, f: number, id: number) => {
  const t = f / FPS;
  MOUTHS.forEach(([lx, ly], k) => {
    const [x, y, z] = leafPoint(lx, ly, 0.06), op = q(mouthOpen(k, f), 12);
    fxCard(cam, out, `stoma|${op}`, 300, 200, (p) => fxStoma(p, op), x, y, z, 0.42, 0.28, { face: [0, 0, 0.12] });
    if (id !== 11) return;
    // a CO2 floats in from the open air and gets gulped at ph 0.75
    const per = 1.8, ph = ((t + hh(k, 4) * per) % per) / per;
    if (ph > 0.78) return;
    const u = smooth(ph / 0.78), side = lx < 0 ? -1 : 1;
    const sx = x + side * (1.6 + hh(k, 5)), sy = y + 0.8 * (hh(k, 6) - 0.3), sz = z + 2.6;
    const px = sx + (x - sx) * u, py = sy + (y - sy) * u + 0.25 * Math.sin(u * Math.PI), pz = sz + (z + 0.05 - sz) * u;
    const sz2 = 0.7 * (u > 0.85 ? 1 - (u - 0.85) / 0.15 * 0.7 : 1);
    co2(cam, out, k, f, px, py, pz, sz2, u > 0.7 ? 1 : 0, 0.2 * Math.sin(t * 1.5 + k));
  });
};
/** sunlight splits CO2: ray, burst, carbon stays, O2 floats off; then sugar rings flow down the midrib */
const SPLIT: V3 = [0.5, 3.2, 0];
const splitFx = (cam: CamInfo, out: Stage, f: number) => {
  const [mx, my, mz] = leafPoint(SPLIT[0], SPLIT[1], 0.35), hit = 1428;
  if (f < 1466) {
    // sunbeam from the upper right onto the waiting molecule
    const ray = smooth((f - 1412) / 10);
    if (ray > 0) for (const k of [0, 1]) fxCard(cam, out, "ray", 200, 800, fxRay, mx + 0.62 + k * 0.03, my + 1.47, mz + 0.05 + k * 0.01, 0.55 * ray, 3.2, { soft: true, rot: -0.4 });
    if (f < hit) co2(cam, out, 7, f, mx, my, mz + 0.05, 1.0, f > hit - 8 ? 1 : 0, 0);
    else {
      const u = (f - hit) / FPS;
      if (u < 0.3) fxCard(cam, out, `burst${q(u / 0.3, 30)}`, 500, 500, (p) => fxBurst(p, q(u / 0.3, 30)), mx, my, mz + 0.1, 1.6, 1.6);
      fxCard(cam, out, "carbon", 260, 260, (p) => fxC(p, 3), mx - 0.05 * u, my - 0.3 * smooth(u / 0.8), mz - 0.15, 0.34, 0.34);
      o2(cam, out, 1, f, mx + 0.22 + 0.25 * u, my + 0.3 + 0.55 * u, mz + 0.3 + 0.3 * u, 0.5, 3, 0.2 * Math.sin(u * 4));
      o2(cam, out, 2, f, mx - 0.25 - 0.2 * u, my + 0.2 + 0.65 * u, mz + 0.35 + 0.25 * u, 0.46, 0, -0.2 * Math.sin(u * 3));
    }
    for (let i = 0; i < 6; i++) { // a few sparkles riding the beam
      const u = ((f - 1412) / 30 + i / 6) % 1;
      fxCard(cam, out, "spark", 200, 200, (p) => fxSpark(p), mx + 0.9 - 0.9 * u + 0.2 * Math.sin(i), my + 1.9 * (1 - u) + 0.1, mz + 0.2, 0.14, 0.14, { rot: u * 3 });
    }
  } else {
    // carbon becomes sugar rings that flow down the midrib to the stalk ("builds the wood")
    for (let i = 0; i < 10; i++) {
      const u = ((f - 1466) / 50 + i / 10) % 1, ly = 4.2 - 4.6 * u;
      const p = ly > 0 ? leafPoint(0.02, ly, 0.12) : leafPoint(-0.25 * -ly, ly, 0.12);
      fxCard(cam, out, "sugar", 220, 220, fxSugar, p[0], p[1], p[2], 0.32, 0.32, { rot: u * 4 + i });
    }
    MOUTHS.slice(0, 3).forEach(([lx, ly], k) => { // the last of the carbon arrives
      const [x, y, z] = leafPoint(lx, ly, 0.3), u = ((f - 1466) / 40 + k / 3) % 1;
      fxCard(cam, out, "carbon", 260, 260, (p) => fxC(p, 3), x + 0.05 * Math.sin(u * 6), y - 0.3 * u, z, 0.3 * (1 - u * 0.5), 0.3 * (1 - u * 0.5));
    });
  }
};

/** O2 floating from the oak to the kid's face */
const breatheFx = (cam: CamInfo, out: Stage, f: number) => {
  const t = f / FPS, [kx, ky, kz] = KID_BREATHE, nose: V3 = [kx + 0.02, ky + 1.0, kz + 0.1];
  for (let i = 0; i < 7; i++) {
    const per = 2.2, u = ((t + hh(i, 2) * per) % per) / per;
    const sx = kx + (hh(i, 3) - 0.5) * 3.2, sy = ky + 1.6 + 2.2 * hh(i, 4), sz = kz - 2.5 - 1.5 * hh(i, 5);
    const x = sx + (nose[0] - sx) * smooth(u), y = sy + (nose[1] - sy) * smooth(u), z = sz + (nose[2] - sz) * smooth(u);
    const pop = Math.min(1, u * 5) * (u > 0.85 ? (1 - u) / 0.15 : 1);
    if (pop < 0.05) continue;
    o2(cam, out, i, f, x, y, z, 0.42 * pop, i % 2 ? 3 : 0, 0.25 * Math.sin(t * 1.4 + i));
  }
};

/** falling willow leaves in the autumn time-lapse */
const autumnFx = (cam: CamInfo, out: Stage, f: number) => {
  const t = f / FPS, [px, py, pz] = POT;
  for (let i = 0; i < 16; i++) {
    const per = 1.6 + hh(i, 2), u = ((t + hh(i, 3) * per) % per) / per;
    const x = px + (hh(i, 4) - 0.5) * 2.0 + 0.25 * Math.sin(u * 7 + i), y = py + 2.4 - 2.3 * u, z = pz + (hh(i, 5) - 0.2) * 1.4;
    const col = ["#e3b23e", "#d9902e", "#f0c75a"][i % 3];
    fxCard(cam, out, `leaf|${col}`, 220, 90, (p) => fxLeaf(p, col), x, y, z, 0.2, 0.08, { rot: u * 9 + i });
  }
};

/** everything with a face (or a job) in shot `id` at frame f */
export const stage = (id: number, f: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], t = f / FPS;
  LNAME = s.light;
  SUN = cam.sun.clone().normalize();
  switch (id) {
    case 1: hookFx(cam, out, f); break;
    case 2: {
      const p = docWalk(f), walking = f < WALK_B, phase = q((((f - 126) / FPS) * 0.9) % 1, 60);
      docPlace(cam, out, f, p, { mode: walking ? "stroll" : "stand", phase: walking ? phase : 0, prop: "sapling", expr: f < 200 ? "smile" : "neutral", headTilt: f >= 214 ? 5 : 0, lift: 50 });
      break;
    }
    case 3: {
      docPlace(cam, out, f, DOC_SCALE, { mode: "stand", prop: f < 356 ? "hips" : null, expr: f < 300 ? "smile" : f < 356 ? "grin" : f < 392 ? "neutral" : "smile_closed", facing: 1 });
      const [, R] = pans(3, f);
      for (const d of [300, 390]) if (f >= d && f < d + 10) {
        const u = (f - d) / 10;
        fxCard(cam, out, `puff${q(u, 30)}`, 300, 300, (p) => fxPuff(p, q(u, 30)), R[0], R[1] + 0.25, R[2] + 0.2, 0.9, 0.9, { soft: true });
      }
      break;
    }
    case 4: case 6: {
      docPlace(cam, out, f, DOC_WATER, { mode: "stand", prop: "can", expr: id === 4 ? "smile_closed" : "smile", facing: 1 });
      fxCard(cam, out, `pour${q((t * 2) % 1, 20)}`, 400, 500, (p) => fxPour(p, q((t * 2) % 1, 20)), POT[0] - 0.36, POT[1] + POT_H + 0.28, POT[2] + 0.62, 0.42, 0.52);
      break;
    }
    case 5: autumnFx(cam, out, f); break;
    case 7: {
      docPlace(cam, out, f, DOC_SCALE, { mode: "stand", expr: f < 712 ? "shock" : "grin", facing: 1, prop: f < 712 ? null : "hips" });
      const [, R] = pans(7, f);
      if (f >= 700 && f < 712) { const u = (f - 700) / 12; fxCard(cam, out, `puff${q(u, 30)}`, 300, 300, (p) => fxPuff(p, q(u, 30)), R[0], R[1] + 0.3, R[2] + 0.25, 1.4, 1.4, { soft: true }); }
      break;
    }
    case 8: {
      docPlace(cam, out, f, DOC_SCALE, { mode: "stand", expr: f < 840 ? "nervous" : "dazed", facing: 1 });
      if (f >= 840) {
        const u = (t * 0.9) % 1;
        fxCard(cam, out, `stars${q(u, 30)}`, 420, 210, (p) => fxStars(p, q(u, 30)), DOC_SCALE[0], 2.0, DOC_SCALE[2] + 0.05, 0.75, 0.375);
      }
      break;
    }
    case 9: {
      docPlace(cam, out, f, DOC_SCALE, { mode: "stand", expr: f < 972 ? "smile" : "neutral", prop: "scratch", facing: 1 });
      if (f >= 972) airDrift(cam, out, f, 18, [401.4, 7.5, -1.6], 2.6, 4.5, 1.6, 1.25, 3);
      break;
    }
    case 10: trunkFx(cam, out, f); break;
    case 11: leafFx(cam, out, f, 11); break;
    case 12: leafFx(cam, out, f, 12); splitFx(cam, out, f); break;
    case 13: {
      kidPlace(cam, out, f, KID_BREATHE, { mode: "stand", prop: "breathe", expr: "relief", blink: 0 });
      breatheFx(cam, out, f);
      break;
    }
    case 14: {
      kidPlace(cam, out, f, KID_STUMP, { mode: "stand", prop: "point", expr: "grin" }, true);
      const [sx, sy, sz] = STUMP, r = 0.12 + 0.88 * (((f - 1600) / 104) % 1);
      fxCard(cam, out, `ring${q(r, 40)}`, 600, 600, (p) => fxRingGlow(p, q(r, 40)), sx + 0.016 * 0, sy + 0.565, sz - 0.012, 1.5, 1.5, { flat: true, soft: true });
      break;
    }
    case 15: {
      docPlace(cam, out, f, DOC_FINAL, { mode: "stand", expr: "neutral", prop: "hips", facing: -1 });
      airDrift(cam, out, f, 18, [400.3, 15.5, -3.2], 2.8, 5, 2, 1.1, 5);
      break;
    }
  }
  return out;
};
void groundY;
