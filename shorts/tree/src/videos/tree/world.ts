// The whole film as one three.js scene, four places 400 m apart (fog hides each from the others):
//   hill   - the hero oak on a grassy mound, a stump with growth rings, meadow and a ring of distant trees
//   court  - van Helmont's 1640s courtyard: gabled houses, cobbles, the terracotta pot, the beam balance (beam, pans,
//            strings, needle and dial posed every frame), iron weights, the willow (grows, changes season, moves)
//   trunk  - a cut-away bank of soil with roots and a cut-away trunk showing its water tubes
//   leaf   - a giant leaf (with its twig and neighbours) in the open sky
// update(id, f, camera) poses everything for shot `id` at frame f (a pure function of id + f).
import * as THREE from "three";
import { Batch, V, lam, house, prop, setSight, Ray, Kit, addVeg, lobeGeo, boxGeo, quad } from "./build";
import { rep, ctex, grassHD, cobbleHD, stoneHD, beamHD, cloudHD, brick } from "./paint";
import { barkHD, cutFaceHD, soilFaceHD, leafHD, ringsHD, terracottaHD, soilTopHD, dialHD, ironHD } from "./paint2";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, SHOTS, ShotDef, V3, camAt, groundY, HILL_R, OAK, STUMP, POT, POT_H, POT_R, SCALE, PIVOT_Y, ARM, STRING, TRUNK, SOIL_TOP, LEAF,
  ROOTS, willow, panLoad, beamAngle, beamEnd, SCALE_YAW, LEAF_L, LEAF_W, LEAF_CURL, LEAF_ARCH, LEAF_TILT, leafPoint, TRUNK_R,
} from "./story";

export const loadKit = async (): Promise<Kit> => ({}); // no external models: every prop is built here

/** sun disc + halo sprites (lighting.md: solid disc with a soft rim, flat golden halo) */
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-shot sun override: keep faces front-lit where the camera looks at the doctor; the leaf is lit from above-right */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 150, el: 42 }, 2: { az: 140, el: 38 }, 3: { az: 135, el: 40 }, 4: { az: 140, el: 40 }, 5: { az: 115, el: 16 }, 6: { az: 140, el: 40 },
  7: { az: 135, el: 40 }, 8: { az: 135, el: 40 }, 9: { az: 140, el: 40 }, 15: { az: 140, el: 40 },
  10: { az: 168, el: 34 }, 11: { az: 130, el: 55 }, 12: { az: 130, el: 55 }, 13: { az: 150, el: 42 }, 14: { az: 145, el: 48 },
};

/** every lens position of the film looking at its subject (houses and props there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, Math.min(1799, f))), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

// ---------------- geometry helpers ----------------
/** tapered tube along a curve (r0 at the start, r1 at the end), smooth normals, uv u around / v along (metres / tile) */
const taperTube = (pts: THREE.Vector3[], r0: number, r1: number, seg = 24, sides = 10, tileV = 2) => {
  const curve = new THREE.CatmullRomCurve3(pts);
  const frames = curve.computeFrenetFrames(seg, false);
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const len = curve.getLength();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t), r = r0 + (r1 - r0) * t;
    const N = frames.normals[i], B = frames.binormals[i];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2, nx = Math.cos(a) * N.x + Math.sin(a) * B.x, ny = Math.cos(a) * N.y + Math.sin(a) * B.y, nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      pos.push(p.x + r * nx, p.y + r * ny, p.z + r * nz); nor.push(nx, ny, nz); uv.push(k / sides, (t * len) / tileV);
    }
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < sides; k++) {
    const a = i * (sides + 1) + k, b = a + sides + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
};
const hiLobe = new THREE.SphereGeometry(1, 40, 28);
const M4 = (x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, ry = 0) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(sx, sy, sz));
/** horizontal quad at height y covering x0..x1, z0..z1, uv tiled every `tile` m */
const flat = (x0: number, x1: number, z0: number, z1: number, y: number, tile: number) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(Array(6).fill([0, 1, 0]).flat(), 3));
  const u = (x1 - x0) / tile, v = (z1 - z0) / tile;
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
/** painted willow foliage (light yellow-green, long thin leaf strokes) */
const willowTex = (key: string, base: string, light: string, dark: string) => ctex("willow" + key, 256, 256, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.lineCap = "round";
  for (let i = 0; i < 160; i++) {
    const x = r() * 256, y = r() * 256, l = 10 + r() * 16;
    g.strokeStyle = r() > 0.5 ? light : dark; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + l); g.stroke();
  }
});
/** leaf outline (tip at +y, base at y = 0), length L, half-width W */
const leafShape = (L: number, W: number) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(W * 0.9, L * 0.12, W * 1.15, L * 0.55, 0, L);
  s.bezierCurveTo(-W * 1.15, L * 0.55, -W * 0.9, L * 0.12, 0, 0);
  return s;
};
/** curled leaf mesh: edges bend back by `curl` m, the blade arches by `arch` m; uv over the bounding box */
export const leafGeo = (L: number, W: number, curl: number, arch: number) => {
  const g = new THREE.ShapeGeometry(leafShape(L, W), 48);
  const p = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, 0.5 + x / (2.3 * W), y / L);
    p.setZ(i, -curl * (x / W) ** 2 + arch * 4 * (y / L) * (1 - y / L));
  }
  g.computeVertexNormals();
  return g;
};
type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // dynamic court pieces
  private beam = new THREE.Group(); private pans: THREE.Group[] = []; private strings: THREE.Mesh[] = [];
  private weights: THREE.InstancedMesh; private heap: THREE.Mesh; private potSoil: THREE.Mesh;
  private willow = new THREE.Group(); private willowLeaf: THREE.Mesh[] = []; private rootBall: THREE.Mesh;
  private wLeafS: THREE.Material; private wLeafA: THREE.Material;

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light (as in the bridge short) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.bark = lam("barkHD2", () => ({ map: barkHD() }));
    M.wood = lam("wood", () => ({ map: beamHD() }));
    M.dark = lam("darkWood", () => ({ color: "#6e4a34" }));
    M.brass = twoTone(new THREE.MeshPhongMaterial({ color: "#c9a24e", specular: "#ffe9a8", shininess: 50 }), 0.15);
    M.iron = twoTone(new THREE.MeshPhongMaterial({ color: "#555a66", specular: "#9a9a9a", shininess: 50 }), 0.15);
    M.terra = lam("terracotta", () => ({ map: terracottaHD() }));
    M.soil = lam("soilTop", () => ({ map: rep(soilTopHD(), 1, 1) }));
    M.brick = lam("brickWall", () => ({ map: rep(brick(), 3, 1) }));
    M.stone = lam("courtStone", () => ({ map: stoneHD("copeHD", ["#e6dccd", "#ddd3c3", "#ece4d6", "#d6cbba"], "#aea293") }));

    setSight(sightLines());
    const b = new Batch();

    // ================= ground everywhere + the hill =================
    b.add(flat(-1000, 1000, -1000, 1000, -0.02, 4), M.grass);
    {
      // radial rings for a smooth dome
      const ring = new THREE.RingGeometry(0.01, HILL_R, 128, 40); ring.rotateX(-Math.PI / 2);
      const q = ring.attributes.position as THREE.BufferAttribute, uv = ring.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = q.getZ(i); q.setY(i, groundY(x, z) + 0.005); uv.setXY(i, x / 4, z / 4); }
      ring.computeVertexNormals();
      b.add(ring, M.grass);
    }
    // ---- the hero oak ----
    const ob = OAK;
    b.add(taperTube([V(ob[0], ob[1] - 0.5, ob[2]), V(ob[0] + 0.1, ob[1] + 2.5, ob[2]), V(ob[0] - 0.05, ob[1] + 5.0, ob[2] + 0.1), V(ob[0], ob[1] + 7.2, ob[2])], 1.05, 0.55, 24, 20, 2.8), M.bark);
    for (let k = 0; k < 6; k++) { // root flares
      const a = (k / 6) * Math.PI * 2 + 0.4, d = 1.9;
      b.add(taperTube([V(ob[0] + Math.cos(a) * 0.5, ob[1] + 1.0, ob[2] + Math.sin(a) * 0.5), V(ob[0] + Math.cos(a) * 1.2, ob[1] + 0.25, ob[2] + Math.sin(a) * 1.2), V(ob[0] + Math.cos(a) * d, groundY(Math.cos(a) * d, Math.sin(a) * d) - 0.1, ob[2] + Math.sin(a) * d)], 0.45, 0.12, 10, 10), M.bark);
    }
    const nb = new Batch(); // branches: no shadows (their long straight shadows striped the canopy)
    const BR: [number, number, number, number][] = [[0.3, 5.6, 4.6, 0.38], [2.1, 6.0, 4.2, 0.34], [3.6, 5.2, 4.8, 0.36], [4.9, 6.3, 4.0, 0.32], [1.2, 6.8, 3.4, 0.3], [5.8, 5.0, 4.4, 0.33]];
    for (const [a, y0, len, r0] of BR) {
      const dx = Math.cos(a), dz = Math.sin(a);
      nb.add(taperTube([V(ob[0] + dx * 0.3, ob[1] + y0, ob[2] + dz * 0.3), V(ob[0] + dx * len * 0.5, ob[1] + y0 + 1.4, ob[2] + dz * len * 0.5), V(ob[0] + dx * len, ob[1] + y0 + 2.8, ob[2] + dz * len)], r0, 0.12, 12, 10), M.bark);
    }
    nb.build(R, false);
    const oakLeaf = [0, 1, 2, 3].map((i) => lam("leafHD" + i, () => ({ color: ["#5aa83c", "#4c9a37", "#69b545", "#55a243"][i] })));
    {
      const { leafMat } = { leafMat: (i: number) => oakLeaf[i % 4] };
      const lobes: [number, number, number, number][] = [[0, 10.6, 0, 4.4], [0, 13.6, 0, 3.0], [0, 15.4, 0.3, 2.2]];
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; lobes.push([Math.cos(a) * 4.6, 9.4 + (k % 3) * 0.5, Math.sin(a) * 4.6, 2.8 + (k % 2) * 0.6]); }
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.7; lobes.push([Math.cos(a) * 3.0, 12.6 + (k % 2) * 0.4, Math.sin(a) * 3.0, 2.4 + (k % 3) * 0.3]); }
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + 1.1; lobes.push([Math.cos(a) * 6.4, 8.2 + (k % 2) * 0.6, Math.sin(a) * 6.4, 1.8 + (k % 3) * 0.25]); }
      // canopy lobes cast shadows on the ground but do not receive them: lobe-on-lobe shadows striped the crown
      const cb = new Batch(), cg = new THREE.Group();
      lobes.forEach(([x, y, z, r], i) => cb.add(hiLobe, leafMat(i), M4(ob[0] + x, ob[1] + y, ob[2] + z, r, r * 0.88, r, i)));
      cb.build(cg); cg.traverse((o) => { o.receiveShadow = false; }); R.add(cg);
    }
    // ---- stump with growth rings ----
    {
      const [sx, sy, sz] = STUMP, rad = 0.75, h = 0.55;
      b.add(new THREE.CylinderGeometry(rad, rad * 1.12, h + 0.3, 40, 1, true).translate(0, (h + 0.3) / 2 - 0.3, 0), lam("barkStump", () => ({ map: rep(barkHD(), 3, 0.5) })), M4(sx, sy, sz));
      const top = new THREE.CircleGeometry(rad, 64); top.rotateX(-Math.PI / 2);
      b.add(top, lam("rings", () => ({ map: ringsHD() })), M4(sx, sy + h, sz));
      for (let k = 0; k < 4; k++) { const a = k * 1.6 + 0.3; b.add(taperTube([V(sx + Math.cos(a) * 0.55, sy + 0.25, sz + Math.sin(a) * 0.55), V(sx + Math.cos(a) * 1.15, sy - 0.05, sz + Math.sin(a) * 1.15)], 0.22, 0.08, 6, 8), M.bark); }
    }
    // ---- meadow: bushes, a ring of trees, far tree line ----
    const r = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 12 + r() * 30, x = Math.cos(a) * d, z = Math.sin(a) * d;
      prop(b, kit, "plant_bushLarge", x, groundY(x, z) - 0.1, z, 1.0 + r() * 0.8, r() * 6);
    }
    const trees = ["tree_oak", "tree_fat", "tree-high-round", "tree_cone", "tree_default"];
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = 55 + r() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d;
      prop(b, kit, trees[i % 5], x, 0, z, 8 + r() * 6, r() * 6);
    }

    // ================= the courtyard =================
    const CX = 400;
    b.add(flat(CX - 15, CX + 15, -7.2, 12, 0.01, 2), M.cobble);
    house(b, CX, -11, 0, 9, 8, 8.4, 3, 0);
    house(b, CX - 8.6, -11.4, 0, 8, 8, 7.0, 1, 0);
    house(b, CX + 9.2, -11.2, 0, 9, 8, 9.8, 4, 0);
    house(b, CX - 17, -10.5, 0.15, 8, 8, 8.4, 6, 0);
    house(b, CX + 18.5, -10.8, -0.12, 8, 8, 7.0, 0, 0);
    for (const sx of [-1, 1]) b.add(boxGeo(V(CX + sx * 13.2 - 0.25, 0, -7), V(CX + sx * 13.2 + 0.25, 2.3, 12), 1), M.brick);
    // barrel + bench + bushes for dressing
    b.add(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 20).translate(0, 0.5, 0), M.wood, M4(CX - 3.6, 0, -5.6));
    b.add(new THREE.TorusGeometry(0.43, 0.03, 6, 24).rotateX(Math.PI / 2), M.iron, M4(CX - 3.6, 0.2, -5.6));
    b.add(new THREE.TorusGeometry(0.43, 0.03, 6, 24).rotateX(Math.PI / 2), M.iron, M4(CX - 3.6, 0.8, -5.6));
    b.add(boxGeo(V(CX + 3.2, 0.42, -6.6), V(CX + 5.0, 0.5, -6.2)), M.dark);
    for (const x of [CX + 3.3, CX + 4.9]) b.add(boxGeo(V(x - 0.05, 0, -6.55), V(x + 0.05, 0.42, -6.25)), M.dark);
    for (const [x, z, h] of [[CX - 6.2, -6.2, 1.3], [CX + 6.5, -6.0, 1.1], [CX - 11.8, 3, 1.5], [CX + 11.6, 2.4, 1.6]] as const) prop(b, kit, "plant_bushLarge", x, 0, z, h, x);
    for (const [x, z] of [[CX - 7, -22], [CX + 2, -24], [CX + 12, -23], [CX - 16, -25], [CX + 22, -22]]) prop(b, kit, "tree_oak", x, 0, z, 11 + (x % 3), x);
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = 50 + r() * 110; prop(b, kit, trees[i % 5], CX + Math.cos(a) * d, 0, Math.sin(a) * d, 9 + r() * 5, r() * 6); }
    // the pot
    {
      const prof = [[0.0, 0.0], [0.34, 0.0], [0.36, 0.04], [0.47, 0.5], [0.5, 0.52], [0.54, 0.56], [0.54, 0.62], [0.48, 0.62], [0.45, 0.56]].map(([x, y]) => new THREE.Vector2(x, y));
      b.add(new THREE.LatheGeometry(prof, 48), M.terra, M4(POT[0], POT[1], POT[2]));
    }
    this.potSoil = new THREE.Mesh(new THREE.CircleGeometry(0.46, 40).rotateX(-Math.PI / 2), M.soil);
    this.potSoil.position.set(POT[0], POT[1] + POT_H - 0.05, POT[2]); this.potSoil.receiveShadow = true;
    R.add(this.potSoil);
    // the balance: post on a foot, bracket, dial (fixed), beam + needle (rotating group), two pans on strings
    {
      const [sx, , sz] = SCALE;
      b.add(boxGeo(V(sx - 0.38, 0, sz - 0.38), V(sx + 0.38, 0.12, sz + 0.38)), M.dark);
      b.add(new THREE.CylinderGeometry(0.06, 0.08, PIVOT_Y, 14).translate(0, PIVOT_Y / 2, 0), M.dark, M4(sx, 0.12, sz));
      b.add(boxGeo(V(sx - 0.08, PIVOT_Y - 0.08, sz - 0.08), V(sx + 0.08, PIVOT_Y + 0.08, sz + 0.08)), M.brass);
      const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: dialHD(), alphaTest: 0.5, color: 0xe8e8e8 }));
      dial.position.set(sx - Math.sin(SCALE_YAW) * 0.07, PIVOT_Y + 0.245, sz - Math.cos(SCALE_YAW) * 0.07); dial.rotation.y = SCALE_YAW; dial.layers.set(NOINK);
      R.add(dial);
    }
    {
      const bm = new THREE.Mesh(new THREE.BoxGeometry(2 * ARM + 0.08, 0.07, 0.07), M.brass);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.42, 0.02).translate(0, 0.21, 0), M.iron);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 10).translate(0, 0.46, 0), M.iron);
      for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), M.brass); k.position.x = s * (ARM + 0.04); this.beam.add(k); }
      this.beam.add(bm, needle, tip);
      this.beam.position.set(SCALE[0], PIVOT_Y, SCALE[2]); this.beam.rotation.order = "YXZ";
      this.beam.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
      R.add(this.beam);
      const panG = new THREE.CylinderGeometry(0.42, 0.34, 0.06, 32);
      for (let i = 0; i < 2; i++) { const g = new THREE.Group(), m = new THREE.Mesh(panG, M.brass); m.castShadow = true; m.receiveShadow = true; g.add(m); this.pans.push(g); R.add(g); }
      const sg = new THREE.CylinderGeometry(0.008, 0.008, 1, 5).translate(0, 0.5, 0);
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(sg, M.dark); m.castShadow = true; this.strings.push(m); R.add(m); }
      this.weights = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 20).translate(0, 0.5, 0), M.iron, 24);
      this.weights.castShadow = true; this.weights.receiveShadow = true; this.weights.frustumCulled = false;
      R.add(this.weights);
      this.heap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.3, 28), M.soil);
      this.heap.castShadow = true; this.heap.receiveShadow = true;
      R.add(this.heap);
    }
    // the willow: built at full size (g = 1, 3.3 m), scaled down for the sapling; leaves swap material by season
    {
      this.wLeafS = lam("willowS", () => ({ map: willowTex("S", "#8fc350", "rgba(196,228,128,0.45)", "rgba(96,150,56,0.4)") }));
      this.wLeafA = lam("willowA", () => ({ map: willowTex("A", "#eda634", "rgba(255,214,110,0.5)", "rgba(200,110,30,0.4)") }));
      const trunk = new THREE.Mesh(taperTube([V(0, -0.1, 0), V(0.03, 0.8, 0), V(-0.02, 1.6, 0.02), V(0, 2.3, 0)], 0.09, 0.045, 12, 10, 1), M.bark);
      this.willow.add(trunk);
      const L: [number, number, number, number, number][] = [[0, 2.5, 0, 0.7, 0.8]];
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; L.push([Math.cos(a) * 0.5, 2.38 + (k % 2) * 0.12, Math.sin(a) * 0.5, 0.48, 0.75]); }
      for (let k = 0; k < 26; k++) { // hanging strands, thin and of different lengths
        const a = (k / 26) * Math.PI * 2 + 0.2, rr = 0.6 + 0.24 * ((k * 7) % 3) / 2, len = 0.5 + 0.32 * ((k * 5) % 4) / 3;
        L.push([Math.cos(a) * rr, 2.22 - len * 0.62, Math.sin(a) * rr, 0.095, len / 0.095]);
      }
      for (const [x, y, z, rr, sy] of L) {
        const m = new THREE.Mesh(lobeGeo(0), this.wLeafS);
        m.position.set(x, y, z); m.scale.set(rr, rr * sy, rr); m.castShadow = true; m.receiveShadow = false;
        this.willowLeaf.push(m); this.willow.add(m);
      }
      for (const [a, y] of [[0.4, 1.7], [2.5, 1.9], [4.4, 1.75]]) {
        const br = new THREE.Mesh(taperTube([V(0, y, 0), V(Math.cos(a) * 0.35, y + 0.35, Math.sin(a) * 0.35), V(Math.cos(a) * 0.6, y + 0.45, Math.sin(a) * 0.6)], 0.035, 0.015, 6, 6), M.bark);
        this.willow.add(br);
      }
      this.rootBall = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), lam("rootBall", () => ({ color: "#7a5638" })));
      this.rootBall.scale.set(1, 0.66, 1); this.rootBall.position.y = 0.0;
      this.willow.add(this.rootBall);
      this.willow.traverse((o) => { o.castShadow = true; o.receiveShadow = !this.willowLeaf.includes(o as THREE.Mesh); });
      R.add(this.willow);
    }

    // ================= the cut-away soil bank and trunk =================
    {
      const [tx, , tz] = TRUNK, Y = SOIL_TOP;
      const soilM = lam("soilFace", () => ({ map: soilFaceHD() }));
      b.add(quad(V(tx - 60, 0, tz), V(tx + 60, 0, tz), V(tx + 60, Y, tz), V(tx - 60, Y, tz), 5, 1), soilM);
      b.add(boxGeo(V(tx - 60, 0, tz - 80), V(tx + 60, Y, tz - 0.03), 0), M.grass); // top + sides grass (its front sits just behind the painted soil face)
      b.add(flat(tx - 60, tx + 60, tz - 80, tz, Y + 0.004, 4), M.grass);
      b.add(flat(tx - 60, tx + 60, tz, tz + 40, 0.01, 2), M.soil); // trench floor
      // trunk: back half-cylinder of bark + the cut face (water tubes)
      const half = new THREE.CylinderGeometry(TRUNK_R, TRUNK_R * 1.05, 16, 40, 1, true, Math.PI / 2, Math.PI); // back half (z < 0)
      half.translate(0, 8, 0);
      const bark2 = lam("barkTrunk", () => ({ map: rep(barkHD(), 4, 4) }));
      b.add(half, bark2, M4(tx, Y, tz));
      const face = lam("cutFace", () => ({ map: rep(cutFaceHD(), 1, 16 / (2 * TRUNK_R)) }));
      b.add(quad(V(tx - TRUNK_R, Y, tz + 0.002), V(tx + TRUNK_R, Y, tz + 0.002), V(tx + TRUNK_R, Y + 16, tz + 0.002), V(tx - TRUNK_R, Y + 16, tz + 0.002)), face);
      // roots: half-buried tapered tubes along the soil face
      // roots: tapered tubes half sunk into the soil face, each with two rootlets
      const rootM = lam("rootM", () => ({ color: "#86573a" }));
      ROOTS.forEach(({ pts, r0 }, k) => {
        b.add(taperTube(pts.map(([x, y]) => V(tx + x, y, tz - 0.06)), r0, 0.035, 32, 12, 1), rootM);
        for (const at of [0.45, 0.7]) {
          const i = Math.floor(at * (pts.length - 1)), [x, y] = pts[i], s = k % 2 ? 1 : -1;
          b.add(taperTube([V(tx + x, y, tz - 0.06), V(tx + x + s * 0.35, y - 0.25, tz - 0.06), V(tx + x + s * 0.55, y - 0.65, tz - 0.06)], 0.07, 0.02, 10, 8), rootM);
        }
      });
      // canopy over the cut trunk (behind the face)
      const tl = [0, 1, 2, 3].map((i) => lam("leafHD" + i, () => ({ color: ["#5aa83c", "#4c9a37", "#69b545", "#55a243"][i] })));
      const lobes: [number, number, number, number][] = [[0, 24.5, -2.5, 4.6], [-4, 23, -2.2, 3.4], [4.2, 23.4, -2.4, 3.6], [-2, 27, -3, 3.2], [2.4, 27.2, -2.8, 3.0], [-6.2, 21.2, -3, 2.4], [6.4, 21.6, -3, 2.6]];
      const cb = new Batch(), cg = new THREE.Group();
      lobes.forEach(([x, y, z, rr], i) => cb.add(hiLobe, tl[i % 4], M4(tx + x, y, tz + z, rr, rr * 0.9, rr)));
      cb.build(cg); cg.traverse((o) => { o.receiveShadow = false; }); R.add(cg);
      for (const [a, len] of [[-0.6, 5], [0.5, 5.5], [-1.0, 4]] as const) // branches leaving the trunk top
        b.add(taperTube([V(tx + Math.sin(a) * 0.8, Y + 14, tz - 1.6), V(tx + Math.sin(a) * len * 0.6, Y + 16, tz - 2), V(tx + Math.sin(a) * len, Y + 17.5, tz - 2.4)], 0.5, 0.18, 10, 10), M.bark);
      for (let i = 0; i < 20; i++) { const x = tx - 50 + r() * 100, z = tz - 15 - r() * 60; if (Math.abs(x - tx) > 9) prop(b, kit, trees[i % 5], x, Y, z, 9 + r() * 5, r() * 6); }
    }

    // ================= the giant leaf in the sky =================
    {
      const lm = lam("leafBig", () => ({ map: leafHD(), side: THREE.DoubleSide }));
      const g = new THREE.Group();
      const hero = new THREE.Mesh(leafGeo(LEAF_L, LEAF_W, LEAF_CURL, LEAF_ARCH), lm); // the blade arches toward the lens, the edges curl back
      hero.castShadow = true; hero.receiveShadow = true;
      g.add(hero);
      g.position.set(LEAF[0], LEAF[1] - LEAF_L / 2, LEAF[2]); g.rotation.z = LEAF_TILT;
      R.add(g);
      // stalk + twig + neighbour leaves (smaller, behind)
      const lb = leafPoint(0, 0, 0);
      b.add(taperTube([V(lb[0], lb[1] + 0.1, lb[2]), V(lb[0] - 0.2, lb[1] - 1.0, lb[2] - 0.3), V(lb[0] - 0.7, lb[1] - 2.0, lb[2] - 0.8)], 0.07, 0.11, 10, 8), lam("stalk", () => ({ color: "#7aa64a" })));
      b.add(taperTube([V(lb[0] - 4.5, lb[1] - 3.6, lb[2] - 1.5), V(lb[0] - 0.7, lb[1] - 2.1, lb[2] - 0.85), V(lb[0] + 3.0, lb[1] - 1.4, lb[2] - 0.6), V(lb[0] + 6.5, lb[1] - 0.2, lb[2] - 1.0)], 0.32, 0.14, 24, 12), M.bark);
      const others: [number, number, number, number, number, number][] = [[-3.4, -1.0, -2.0, 0.75, -0.6, 0.3], [3.3, -0.4, -2.4, 0.8, 0.7, -0.3], [-2.0, 2.6, -3.5, 0.7, -0.3, 0.5], [2.6, 3.2, -4.0, 0.65, 0.4, -0.4], [0.6, -3.6, -2.8, 0.6, 0.2, 0.6], [-4.8, 2.0, -5.5, 0.8, -0.8, 0.2], [5.4, 1.4, -5.0, 0.8, 0.9, 0.1]];
      for (const [x, y, z, s, rz, ry] of others) {
        const m = new THREE.Mesh(leafGeo(LEAF_L * s, LEAF_W * s, LEAF_CURL * s, LEAF_ARCH * s), lm);
        m.position.set(LEAF[0] + x, LEAF[1] + y - (LEAF_L * s) / 2, LEAF[2] + z); m.rotation.set(0.2, ry, rz);
        m.castShadow = true; m.receiveShadow = true;
        R.add(m);
      }
    }

    b.build(R);
    setSight([]);
  }

  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    if (s.place === "leaf") { this.fog.near = 60; this.fog.far = 420; } // the leaf hangs 30 m up: keep the neighbours clear
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    // clouds ride with the camera (always far away, slow drift)
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      const a = (i / this.clouds.length) * Math.PI * 2 + 0.3 + t * 0.002, d = 620 + (i % 3) * 60, w = 130 + (i % 4) * 30;
      m.position.set(cam.position.x + Math.cos(a) * d, 90 + (i % 4) * 45 + (s.place === "leaf" ? 30 : 0), cam.position.z + Math.sin(a) * d);
      m.scale.set(w, w / 2, 1);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- court: balance, pans, weights, heap, willow ----
    this.poseCourt(id, f);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, f, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (p.face) { e2.mesh.rotation.set(0, 0, 0); e2.mesh.quaternion.setFromEuler(new THREE.Euler(p.face[0], p.face[1], p.face[2] + (p.rot ?? 0))); }
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }

  private poseCourt(id: number, f: number) {
    const th = beamAngle(id, f), [sx, , sz] = SCALE;
    this.beam.rotation.set(0, SCALE_YAW, th);
    const ends = [-1, 1].map((sgn) => V(...beamEnd(sgn, th)));
    const panY = ends.map((e) => e.y - STRING);
    this.pans.forEach((p, i) => p.position.set(ends[i].x, panY[i], ends[i].z));
    // three strings per pan from the beam end to the pan rim
    const tmpQ = new THREE.Quaternion(), up = V(0, 1, 0), d = V(0, 0, 0);
    for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5, rim = V(ends[i].x + Math.cos(a) * 0.38, panY[i] + 0.03, ends[i].z + Math.sin(a) * 0.38);
      d.subVectors(ends[i], rim);
      const m = this.strings[i * 3 + k];
      m.position.copy(rim); m.quaternion.copy(tmpQ.setFromUnitVectors(up, d.clone().normalize())); m.scale.set(1, d.length(), 1);
    }
    // iron weights on the right pan (the newest load drops in over 8 frames)
    const L = panLoad(id, f), Lnext = panLoad(id, Math.max(f, L.drop));
    let n = L.weights, fall = 0;
    if (f >= L.drop - 8 && f < L.drop) { n = Lnext.weights; fall = ((L.drop - f) / 8) ** 2 * 0.9; }
    const big = id === 7, wr = big ? 0.17 : 0.12, wh = big ? 0.12 : 0.085, per = big ? 4 : 4;
    const cols = big ? [[0, 0], [0.2, 0.12], [-0.2, 0.12], [0, -0.2]] : [[0, 0], [0.16, 0.1], [-0.16, 0.1]];
    for (let i = 0; i < 24; i++) {
      if (i < n) {
        const ci = Math.floor(i / per) % cols.length, li = i % per, [ox, oz] = cols[ci];
        const lift = (L.drop > -900 && (L.weights === 0 || f < L.drop)) ? fall : 0;
        this.weights.setMatrixAt(i, this.m4.compose(V(ends[1].x + ox, panY[1] + 0.03 + li * wh + lift + Math.floor(i / (per * cols.length)) * per * wh, ends[1].z + oz), new THREE.Quaternion(), V(wr, wh * 0.94, wr)));
      } else this.weights.setMatrixAt(i, this.m4.compose(V(0, -100, 0), new THREE.Quaternion(), V(0.001, 0.001, 0.001)));
    }
    this.weights.instanceMatrix.needsUpdate = true;
    // soil heap on the left pan (weighing the soil)
    this.heap.visible = L.left === "soil";
    this.heap.position.set(ends[0].x, panY[0] + 0.03 + 0.15, ends[0].z);
    // pot soil shows once the willow is planted
    const w = willow(id, f);
    this.potSoil.visible = true;
    // the willow
    const g = w.g, scl = 0.27 + 0.73 * g;
    this.willow.visible = w.at !== "none" && w.at !== "hand";
    this.willow.scale.setScalar(scl);
    this.willow.rotation.set(0, 0.4, 0);
    this.rootBall.visible = w.at !== "pot";
    const leafM = w.season === "autumn" ? this.wLeafA : this.wLeafS;
    for (const m of this.willowLeaf) m.material = leafM;
    // autumn thins the curtains (leaves falling)
    this.willowLeaf.forEach((m, i) => { m.visible = i < 7 || w.season !== "autumn" || i % 3 !== 0; });
    if (w.at === "pot") this.willow.position.set(POT[0], POT[1] + POT_H - 0.06, POT[2]);
    else if (w.at === "pan") this.willow.position.set(ends[0].x, panY[0] + 0.03 + 0.2 * scl, ends[0].z);
    else if (w.at === "ground") this.willow.position.set(POT[0] - 0.9, 0.2 * scl, POT[2] + 0.5);
    else if (w.at === "lying") {
      this.willow.position.set(POT[0] + 0.2, 0.36, POT[2] + 1.6);
      this.willow.rotation.set(0, 0.25, Math.PI / 2 - 0.08);
    }
  }
}
