import * as THREE from "three";
import { ARCS, BOSS_X, BURST, GAPS, ORBS, SLAMS, SLIMES, STOMPS, TOTAL, clamp01, heroX, heroY, inAir, smooth } from "./timeline";
import { glowTexture, golemFaceTextures, heroTextures, slimeTextures } from "./draw";

const rng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const col = (h: string) => new THREE.Color(h);
const lerpCol = (a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) => out.copy(a).lerp(b, clamp01(t));
const INKC = 0x1a1220;

const toonMap = (() => { const d = new Uint8Array([70, 150, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (c: string | number) => new THREE.MeshToonMaterial({ color: c, gradientMap: toonMap });
const inkMat = new THREE.MeshBasicMaterial({ color: INKC, side: THREE.BackSide });
/** inverted-hull outline: grows each axis by a constant world width w */
const outline = (m: THREE.Mesh, w = 0.09) => {
  m.geometry.computeBoundingBox();
  const s = new THREE.Vector3(); m.geometry.boundingBox!.getSize(s);
  const h = new THREE.Mesh(m.geometry, inkMat);
  h.scale.set((s.x + 2 * w) / Math.max(s.x, 1e-3), (s.y + 2 * w) / Math.max(s.y, 1e-3), (s.z + 2 * w) / Math.max(s.z, 1e-3));
  m.add(h); return m;
};
const box = (w: number, h: number, d: number, c: string | number, ow = 0.09) => outline(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(c)), ow);

// sky colour keys [frame, top, bottom, fog]
const SKY: [number, string, string, string][] = [
  [0, "#4b3a94", "#ff9a5c", "#e58a6a"],
  [250, "#3a2a7a", "#ff8a54", "#d9786a"],
  [300, "#1b1235", "#7a2c4a", "#4a2442"],
  [505, "#150d2a", "#5a2040", "#3a1c3c"],
  [545, "#6aa0e8", "#ffd99a", "#ffd0a0"],
  [660, "#7fb2f0", "#ffe7b0", "#ffdcae"],
];

export class World {
  root = new THREE.Group();
  scene: THREE.Scene;
  sky: THREE.Mesh;
  skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
  hemi = new THREE.HemisphereLight(0xffffff, 0x443355, 1.0);
  sun = new THREE.DirectionalLight(0xfff0d0, 2.0);
  lantern = new THREE.PointLight(0xffd27a, 9, 10, 1.8);
  hero!: THREE.Mesh; heroShadow!: THREE.Mesh; lanternHalo!: THREE.Sprite;
  heroT = heroTextures(); slimeT = slimeTextures(); golemT = golemFaceTextures(); glow = glowTexture();
  slimes: { m: THREE.Mesh; s: (typeof SLIMES)[number] }[] = [];
  orbs: { g: THREE.Group; halo: THREE.Sprite; sparks: THREE.Sprite[]; o: (typeof ORBS)[number] }[] = [];
  golem = new THREE.Group(); parts: { m: THREE.Object3D; base: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3 }[] = [];
  armR = new THREE.Group(); armL = new THREE.Group(); head!: THREE.Mesh; faceMat!: THREE.MeshBasicMaterial;
  rings: THREE.Mesh[] = []; debris: THREE.Mesh[] = []; dust: THREE.Sprite[] = [];
  burstSphere!: THREE.Mesh; flies!: THREE.Points; fireBase: Float32Array;
  pit: THREE.Mesh[] = [];
  private tmp = new THREE.Color(); private tmp2 = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xe58a6a, 30, 190);
    this.root.add(this.hemi, this.sun, this.sun.target, this.lantern);
    // sky dome
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float t = smoothstep(-0.05,0.65,h); gl_FragColor = vec4(mix(bot,top,t),1.); }",
    }));
    this.root.add(this.sky);
    this.buildGround(); this.buildScenery(); this.buildHero(); this.buildOrbs(); this.buildSlimes(); this.buildGolem(); this.buildFx();
    this.fireBase = new Float32Array(0);
  }

  private buildGround() {
    const end = BOSS_X + 90, start = -50;
    let x = start;
    const edges = [...GAPS.flatMap(([a, b]) => [[a, b]]), [end, end]].sort((p, q) => p[0] - q[0]);
    for (const [a, b] of edges) {
      const len = a - x;
      if (len > 0.1) {
        const top = box(len, 0.7, 6, "#62b84c", 0.1); top.position.set(x + len / 2, -0.35, 0); this.root.add(top);
        const dirt = box(len, 9, 6, "#8a5636", 0.1); dirt.position.set(x + len / 2, -5.2, 0); this.root.add(dirt);
        const lip = box(len + 0.2, 0.26, 6.3, "#86d65a", 0.05); lip.position.set(x + len / 2, 0.0, 0); this.root.add(lip);
      }
      x = b;
    }
    // glowing mist in the pits
    for (const [a, b] of GAPS) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a + 6, 8), new THREE.MeshBasicMaterial({ color: 0xff7a3a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set((a + b) / 2, -3.2, 0.5); this.root.add(m); this.pit.push(m);
      const v = new THREE.Mesh(new THREE.BoxGeometry(b - a, 10, 6), new THREE.MeshBasicMaterial({ color: 0x1a0d20 })); v.position.set((a + b) / 2, -5, 0); this.root.add(v);
    }
    // floating stepping stones near the long gap (decor in z-3)
    const r = rng(7);
    for (let i = 0; i < 14; i++) { const s = box(2 + r() * 3, 0.8, 2.5, "#7c6a8a", 0.07); s.position.set(r() * (BOSS_X + 40), 2 + r() * 12, -6 - r() * 8); this.root.add(s); }
  }

  private buildScenery() {
    const r = rng(11);
    const N = 150;
    const cone = new THREE.ConeGeometry(1, 1, 7), trunk = new THREE.CylinderGeometry(0.25, 0.35, 1, 6);
    const leaves = new THREE.InstancedMesh(cone, new THREE.MeshToonMaterial({ gradientMap: toonMap, color: 0xffffff }), N * 3);
    const hull = new THREE.InstancedMesh(cone, inkMat, N * 3);
    const trunks = new THREE.InstancedMesh(trunk, toon("#5a3a2a"), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const x = -45 + (i / N) * (BOSS_X + 150) + r() * 3, z = -6 - r() * 14, sc = 0.55 + r() * 0.5;
      const hue = ["#2f8f6a", "#2a7f78", "#3da05a", "#2d6f8a"][Math.floor(r() * 4)];
      for (let k = 0; k < 3; k++) {
        const w = (3.6 - k * 0.9) * sc, h = (3.2 - k * 0.2) * sc, y = (1.6 + k * 1.9) * sc;
        m.compose(p.set(x, y, z), q, s.set(w, h, w)); leaves.setMatrixAt(i * 3 + k, m); leaves.setColorAt(i * 3 + k, c.set(hue).offsetHSL(0, 0, k * 0.04));
        m.compose(p.set(x, y, z), q, s.set(w * 1.07, h * 1.06, w * 1.07)); hull.setMatrixAt(i * 3 + k, m);
      }
      m.compose(p.set(x, 0.7 * sc, z), q, s.set(sc * 1.4, 1.6 * sc, sc * 1.4)); trunks.setMatrixAt(i, m);
    }
    this.root.add(leaves, hull, trunks);
    // distant hills (3 parallax layers)
    const layers: [number, number, string][] = [[-40, 26, "#6a4f93"], [-80, 44, "#7a5f9d"], [-140, 70, "#8d74ad"]];
    for (const [z, hh, cc] of layers) for (let i = 0; i < 14; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: cc }));
      hill.scale.set(hh * (1.4 + r()), hh * (0.7 + r() * 0.5), hh * 0.6); hill.position.set(-100 + i * ((BOSS_X + 340) / 14) + r() * 20, -hh * 0.3, z); this.root.add(hill);
    }
    // grass tufts, flowers and rocks along the path (instanced) so the flat ground reads as a place
    const T = 420, blade = new THREE.ConeGeometry(0.16, 0.7, 5), tufts = new THREE.InstancedMesh(blade, new THREE.MeshToonMaterial({ gradientMap: toonMap, color: 0xffffff }), T);
    const bloom = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 90);
    for (let i = 0; i < T; i++) {
      const x = -45 + r() * (BOSS_X + 120), z = -2.8 + r() * 5.6, k = 0.7 + r() * 1.1;
      m.compose(p.set(x, 0.3 * k, z), q, s.set(k, k, k)); tufts.setMatrixAt(i, m); tufts.setColorAt(i, c.set(["#7fd35a", "#9be06a", "#58b84c"][i % 3]));
    }
    for (let i = 0; i < 90; i++) {
      const x = -45 + r() * (BOSS_X + 120), z = -2.8 + r() * 5.6;
      m.compose(p.set(x, 0.55, z), q, s.set(1, 1, 1)); bloom.setMatrixAt(i, m); bloom.setColorAt(i, c.set(["#ffd84a", "#ff7aa8", "#ffffff", "#8ad8ff"][i % 4]));
    }
    this.root.add(tufts, bloom);
  }

  private buildHero() {
    const H = 2.3, W = H * (512 / 768);
    const g = new THREE.PlaneGeometry(W, H); g.translate(0, H / 2 - (H * 38) / 768, 0);
    this.hero = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.heroT.run[0], transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }));
    this.root.add(this.hero);
    this.heroShadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.heroShadow.rotation.x = -Math.PI / 2; this.root.add(this.heroShadow);
    this.lanternHalo = this.sprite(0xffd27a, 3);
  }
  private sprite(color: number, size: number, opacity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.setScalar(size); this.root.add(s); return s;
  }
  private buildOrbs() {
    for (const o of ORBS) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd84a })); g.add(core);
      const hull = new THREE.Mesh(new THREE.SphereGeometry(0.335, 16, 12), inkMat); g.add(hull);
      this.root.add(g);
      const halo = this.sprite(0xffcf55, 1.9, 0.9);
      const sparks = [0, 1, 2, 3, 4, 5].map(() => this.sprite(0xfff2b0, 0.5, 0));
      this.orbs.push({ g, halo, sparks, o });
    }
  }
  private buildSlimes() {
    const w = 1.9, h = w * 0.75;
    for (const s of SLIMES) {
      const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2 - h * 0.05, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: this.slimeT.ok, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide }));
      m.position.set(s.x, 0, 0.3); this.root.add(m); this.slimes.push({ m, s });
    }
  }
  private buildGolem() {
    const stone = "#b3adc4", dark = "#8f89a8", gl = this.golem;
    const add = (o: THREE.Object3D, rx = 1, ry = 0.3, rz = 0.3) => { gl.add(o); this.parts.push({ m: o, base: o.position.clone(), v: new THREE.Vector3((Math.random() - 0.5) * rx, 0.6 + Math.random() * ry, (Math.random() - 0.5) * rz), spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5) }); };
    const legL = box(3, 5, 4, dark, 0.16); legL.position.set(-2.1, 2.5, 0); add(legL);
    const legR = box(3, 5, 4, dark, 0.16); legR.position.set(2.1, 2.5, 0); add(legR);
    const torso = box(8, 6.5, 6, stone, 0.18); torso.position.set(0, 8.2, 0); add(torso);
    const head = box(3.8, 3.4, 3.8, stone, 0.14); head.position.set(0, 12.9, 0.3); add(head); this.head = head;
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.golemT[0] });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.1), this.faceMat); face.position.set(0, 0, 1.93); head.add(face);
    // glowing crack on the chest
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.8, 0.2), new THREE.MeshBasicMaterial({ color: 0xff7a3a })); crack.position.set(0.8, 0, 3.05); torso.add(crack);
    // arms: pivot at the shoulder, hanging along -y; the fist box is at the end
    for (const [arm, sx] of [[this.armR, -1], [this.armL, 1]] as const) {
      arm.position.set(sx * 4.9, 10.4, sx < 0 ? 0.6 : -0.6);
      const up = box(2.2, 6, 2.2, stone, 0.14); up.position.y = -3; arm.add(up);
      const fist = box(3.4, 3.4, 3.4, dark, 0.16); fist.position.y = -7.4; arm.add(fist);
      gl.add(arm); this.parts.push({ m: arm, base: arm.position.clone(), v: new THREE.Vector3(sx * 0.7, 0.9, 0.3), spin: new THREE.Vector3(0.2, 0.1, sx * 0.8) });
    }
    gl.position.set(BOSS_X, 0, -0.8); gl.scale.setScalar(0.85); this.root.add(gl);
  }
  private buildFx() {
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.position.y = 0.08; this.root.add(r); this.rings.push(r);
    }
    for (let i = 0; i < 40; i++) { const d = box(0.5, 0.5, 0.5, "#7a7288", 0.04); d.visible = false; this.root.add(d); this.debris.push(d); }
    for (let i = 0; i < 24; i++) this.dust.push(this.sprite(0xd8c7a8, 3, 0));
    this.burstSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.root.add(this.burstSphere);
    const n = 70, pos = new Float32Array(n * 3);
    this.fireBase = new Float32Array(n * 3).map((_, i) => { const r = rng(i * 13 + 5); return r(); });
    this.flies = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ map: this.glow, size: 0.7, color: 0xfff0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flies.frustumCulled = false; this.root.add(this.flies);
  }

  /** pose everything for frame f, camera-relative billboards need the camera position */
  update(f: number, cam: THREE.Camera) {
    const hx = heroX(f), hy = heroY(f);
    // sky + light
    let i = 0; while (i < SKY.length - 2 && f > SKY[i + 1][0]) i++;
    const a = SKY[i], b = SKY[i + 1], t = smooth((f - a[0]) / (b[0] - a[0]));
    lerpCol(col(a[1]), col(b[1]), t, this.skyU.top.value); lerpCol(col(a[2]), col(b[2]), t, this.skyU.bot.value);
    lerpCol(col(a[3]), col(b[3]), t, this.tmp); (this.scene.fog as THREE.Fog).color.copy(this.tmp); (this.scene.fog as THREE.Fog).near = 30; (this.scene.fog as THREE.Fog).far = lerp(150, 230, smooth((f - 520) / 60));
    this.hemi.color.copy(this.skyU.top.value).lerp(new THREE.Color(0xffffff), 0.45); this.hemi.groundColor.copy(this.skyU.bot.value).multiplyScalar(0.55);
    const boss = smooth((f - 280) / 25) * (1 - smooth((f - 505) / 25));
    this.hemi.intensity = lerp(1.2, 1.0, boss) + 0.2 * smooth((f - 520) / 40);
    this.sun.color.set(boss > 0.5 ? 0xdfe6ff : f > 520 ? 0xfff2cf : 0xffc58a);
    this.sun.intensity = lerp(1.9, 1.7, boss) + 0.8 * smooth((f - 520) / 40);
    this.sun.position.set(hx - 18, 22, 20); this.sun.target.position.set(hx, 0, 0);
    this.sky.position.copy(cam.position);

    // hero
    const vy = heroY(f + 1) - heroY(f - 1);
    const faceCam = Math.atan2(cam.position.x - hx, cam.position.z);
    this.hero.rotation.y = THREE.MathUtils.clamp(faceCam, -1.2, 1.2);
    const arc = ARCS.find((a) => f > a.f0 && f < a.f1);
    let tex = this.heroT.run[Math.floor(((f % 22) / 22) * 8)];
    if (f >= 560) tex = this.heroT.win; else if (f >= 482 && f <= 548) tex = this.heroT.charge; else if (arc) tex = vy > 0 ? this.heroT.jump : this.heroT.fall; else if (f > 335) tex = this.heroT.run[0];
    if (f % 83 < 3 && !arc && f > 335 && f < 482) tex = this.heroT.blink;
    (this.hero.material as THREE.MeshBasicMaterial).map = tex;
    let sy = 1, sx = 1;
    if (arc) { sy = 1 + clamp01(Math.abs(vy) / 0.7) * 0.12; sx = 1 / sy; }
    for (const a2 of ARCS) { const d = f - a2.f1; if (d >= 0 && d < 6) { const k = (1 - d / 6); sy = 1 - 0.16 * k; sx = 1 + 0.18 * k; } }
    if (f < 270 && !arc) { const bob = Math.sin(((f % 11) / 11) * Math.PI); sy = 1 + 0.03 * bob; }
    this.hero.scale.set(sx, sy, 1);
    const kb = f > 335 && f < 482 ? Math.sin(f * 0.9) * 0.0 : 0;
    this.hero.position.set(hx + kb, hy, 0);
    this.heroShadow.position.set(hx, 0.04, 0); this.heroShadow.scale.setScalar(Math.max(0.3, 1.2 - hy * 0.18)); (this.heroShadow.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.max(0.2, 1 - hy * 0.12);
    // lantern
    const raised = f >= 482 ? 1 : 0;
    const lx = hx + 0.62, ly = hy + (raised ? 2.15 : 0.9 + (f < 270 && !arc ? Math.sin(((f % 11) / 11) * Math.PI) * 0.05 : 0));
    const charge = smooth((f - 482) / 33), bur = f >= BURST ? Math.exp(-(f - BURST) / 35) : 0;
    this.lantern.position.set(lx, ly, 0.9); this.lantern.intensity = 9 + 2 * Math.sin(f * 0.7) + 45 * charge * (f < BURST ? 1 : 0) + 170 * bur; this.lantern.distance = 10 + 30 * bur;
    this.lanternHalo.position.set(lx, ly, -0.4); this.lanternHalo.scale.setScalar(1.9 + 1.5 * charge + 14 * bur + 0.12 * Math.sin(f * 0.8)); (this.lanternHalo.material as THREE.SpriteMaterial).opacity = 0.7;

    // orbs
    for (const ob of this.orbs) {
      const o = ob.o, p = [heroX(o.f) + 0.55, heroY(o.f) + 1.0 + 0.15 * Math.sin(o.f * 0.2)] as const;
      const d = f - o.f;
      ob.g.position.set(p[0], p[1] + 0.12 * Math.sin((f + o.f) * 0.15), 0.1); ob.halo.position.copy(ob.g.position);
      const pop = d >= 0 ? clamp01(d / 7) : 0;
      ob.g.visible = d < 7 && f > o.f - 140; ob.halo.visible = ob.g.visible;
      ob.g.scale.setScalar(d >= 0 ? 1 + pop * 1.2 : 1); ob.halo.scale.setScalar(d >= 0 ? 1.9 + pop * 3 : 1.9 + 0.2 * Math.sin(f * 0.3 + o.f)); (ob.halo.material as THREE.SpriteMaterial).opacity = d >= 0 ? 0.9 * (1 - pop) : 0.8;
      ob.sparks.forEach((s, k) => { const ang = (k / ob.sparks.length) * Math.PI * 2 + o.f, r = d >= 0 ? pop * 1.6 : 0; s.position.set(p[0] + Math.cos(ang) * r, p[1] + Math.sin(ang) * r, 0.2); (s.material as THREE.SpriteMaterial).opacity = d >= 0 && d < 12 ? 1 - d / 12 : 0; });
    }
    // slimes
    for (const { m, s } of this.slimes) {
      const d = f - s.f, wob = 1 + 0.05 * Math.sin(f * 0.35 + s.x);
      m.rotation.y = this.hero.rotation.y;
      if (d < 0) { (m.material as THREE.MeshBasicMaterial).map = this.slimeT.ok; m.scale.set(1 / wob, wob, 1); m.visible = true; }
      else { (m.material as THREE.MeshBasicMaterial).map = this.slimeT.flat; const k = clamp01(d / 14); m.scale.set(1 + 0.35 * (1 - k) + 0.1, Math.max(0.001, 0.35 * (1 - smooth((d - 6) / 12))), 1); m.visible = d < 20; }
    }
    // golem rise + arms
    const rise = smooth((f - 270) / 60);
    const shake = f > 270 && f < 340 ? (1 - rise) * 0.35 : 0;
    this.golem.position.set(BOSS_X + Math.sin(f * 2.1) * shake, -13 * (1 - rise), -0.8);
    this.golem.visible = true;
    const sh = BOSS_X - 4.9 * 0.85, L = 11.4 * 0.85;
    const slamTarget = (s: number) => { const tx = heroX(s) - 0.4; return Math.asin(clamp01((sh - tx) / L)); };
    let armA = 0.14, headAng = 0, glowI = 0;
    for (const s of SLAMS) {
      const ts = slamTarget(s), up = 2.75;
      if (f >= s - 24 && f < s - 7) { armA = lerp(0.14, up, smooth((f - (s - 24)) / 17)); glowI = 0.5; }
      else if (f >= s - 7 && f <= s) { armA = lerp(up, ts, Math.pow((f - (s - 7)) / 7, 2.2)); glowI = 1; }
      else if (f > s && f < s + 16) { armA = ts; glowI = 1; }
      else if (f >= s + 16 && f < s + 34) { armA = lerp(ts, 0.14, smooth((f - s - 16) / 18)); glowI = 0.5; }
    }
    // after the 3rd slam the golem winds both fists up for a double smash that never lands (the burst hits first)
    if (f >= 476 && f < BURST) { armA = lerp(0.14, 3.0, smooth((f - 476) / 30)); glowI = 1; }
    this.armR.rotation.z = armA;
    this.armL.rotation.z = f >= 476 && f < BURST ? armA : 0.14 + 0.05 * Math.sin(f * 0.1);
    this.head.rotation.x = 0.05 * Math.sin(f * 0.12) + (armA > 1 ? -0.18 : 0.12 * (armA > 0.5 ? 1 : 0));
    this.faceMat.map = this.golemT[glowI >= 1 ? 2 : glowI > 0 ? 1 : 0];
    // crumble
    const cr = f - (BURST + 6);
    for (const p of this.parts) {
      if (cr > 0) {
        const tt = cr / 30, g = 9.8 * tt * tt * 0.5 * 3;
        p.m.position.set(p.base.x + p.v.x * tt * 14, p.base.y + p.v.y * tt * 9 - g, p.base.z + p.v.z * tt * 6);
        p.m.rotation.x = p.spin.x * tt * 5; p.m.rotation.y = p.spin.y * tt * 5; if (!(p.m === this.armL || p.m === this.armR)) p.m.rotation.z = p.spin.z * tt * 5;
        const s = 1 - smooth((cr - 36) / 30); p.m.scale.setScalar(Math.max(0.001, s));
      } else if (p.m !== this.armL && p.m !== this.armR) { p.m.position.copy(p.base); p.m.rotation.set(0, 0, 0); p.m.scale.setScalar(1); } else { p.m.scale.setScalar(1); }
    }
    if (cr > 80) this.golem.visible = false;

    // shock rings, debris, dust for each slam + stomps
    const ev = [...SLAMS.map((s) => ({ f: s, x: heroX(s) - 0.4, big: 1 })), ...STOMPS.map((s) => ({ f: s, x: heroX(s), big: 0.35 }))];
    this.rings.forEach((r) => ((r.material as THREE.MeshBasicMaterial).opacity = 0));
    let rIdx = 0;
    for (const e of ev) { const d = f - e.f; if (d >= 0 && d < 26 && rIdx < 3) { const r = this.rings[rIdx++]; const k = d / 26; r.position.x = e.x; r.scale.setScalar(0.5 + k * 11 * e.big); (r.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8; } }
    const r2 = rng(99);
    this.debris.forEach((d, k) => {
      const e = SLAMS[k % 3], dt = f - e; const vx = (r2() - 0.5) * 9, vy = 5 + r2() * 7, vz = (r2() - 0.2) * 5;
      if (dt >= 0 && dt < 40) { const t2 = dt / 30; d.visible = true; d.position.set(heroX(e) - 0.4 + vx * t2, 0.4 + vy * t2 - 9.8 * t2 * t2 * 1.3, vz * t2); d.rotation.set(t2 * vx, t2 * vz, t2 * vy); d.scale.setScalar(Math.max(0.01, 1 - dt / 40)); } else d.visible = false;
    });
    this.dust.forEach((s, k) => {
      const e = ev[k % ev.length], d = f - e.f;
      const m = s.material as THREE.SpriteMaterial;
      if (d >= 0 && d < 30) { const t2 = d / 30, side = (k % 2 ? 1 : -1) * (1 + (k % 5) * 0.8); s.position.set(e.x + side * t2 * 4 * (0.4 + e.big), 0.5 + t2 * 1.5, 0.8 + (k % 3) * 0.4); s.scale.setScalar(2 + t2 * 4 * e.big + 1); m.opacity = (1 - t2) * 0.55 * Math.min(1, e.big + 0.3); } else m.opacity = 0;
    });
    // burst
    const bd = f - BURST;
    const bm = this.burstSphere.material as THREE.MeshBasicMaterial;
    if (bd >= 0 && bd < 40) { const k = bd / 40; this.burstSphere.position.set(lx, ly, 0); this.burstSphere.scale.setScalar(0.5 + 55 * Math.pow(k, 0.6)); bm.opacity = (1 - k) * 0.7; } else bm.opacity = 0;

    // fireflies (drift around the hero, warmer and brighter after the boss)
    const pos = this.flies.geometry.getAttribute("position") as THREE.BufferAttribute, n = pos.count;
    for (let k = 0; k < n; k++) {
      const a1 = this.fireBase[k * 3], a2 = this.fireBase[k * 3 + 1], a3 = this.fireBase[k * 3 + 2];
      pos.setXYZ(k, hx - 8 + a1 * 36 + Math.sin(f * 0.03 + a2 * 20) * 1.4, 0.8 + a2 * 7 + Math.sin(f * 0.05 + a3 * 30) * 0.8, -3 + a3 * 8 - 1);
    }
    pos.needsUpdate = true; (this.flies.material as THREE.PointsMaterial).opacity = f > 300 && f < 515 ? 0.35 : 0.95; (this.flies.material as THREE.PointsMaterial).size = 0.7 + (f > 520 ? 0.5 : 0);
    this.pit.forEach((m, k) => ((m.material as THREE.MeshBasicMaterial).opacity = 0.42 + 0.12 * Math.sin(f * 0.1 + k)));
    return { hx, hy };
  }
}
export { TOTAL, inAir };
