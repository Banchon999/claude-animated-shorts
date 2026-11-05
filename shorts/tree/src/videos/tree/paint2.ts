// Hand-painted textures for "Made of Thin Air" (same canvas style as paint.ts: flat storybook colour, broad soft
// variation, painted seams as dark tints, no photographic noise): bark, the cut trunk face with its water tubes, the
// soil bank, the giant leaf, stump rings, terracotta, soil crumbs, the balance dial.
import { ctex } from "./paint";

const TAU = Math.PI * 2;
const U = (r: () => number, a: number, b: number) => a + (b - a) * r();
const blotch = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, sx: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.save(); g.translate(x, y); g.scale(sx, 1); g.translate(-x, -y);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); g.restore();
};

/** bark: 512 px around x 1024 px up = 1 tile per ~1.4 m around / 2.8 m up; vertical furrows that wander and split */
export const barkHD = () => ctex("barkHD2", 512, 1024, (g, r) => {
  g.fillStyle = "#8a5f40"; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 14; i++) blotch(g, U(r, 0, 512), U(r, 0, 1024), U(r, 80, 200), 0.6, r() > 0.5 ? "160,112,76" : "104,70,46", 0.4);
  g.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    let x = (i / 26) * 512 + U(r, -6, 6);
    const w = U(r, 5, 11);
    g.strokeStyle = "rgba(62,38,30,0.78)"; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, -20);
    for (let y = 0; y <= 1044; y += 44) { x += U(r, -7, 7); g.lineTo(x, y); }
    g.stroke();
    // lit ridge beside each furrow
    g.strokeStyle = "rgba(196,150,108,0.28)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x + w, -20); for (let y = 0; y <= 1044; y += 88) g.lineTo(x + w + U(r, -4, 4), y); g.stroke();
  }
  for (let i = 0; i < 30; i++) { // cross checks
    const x = U(r, 0, 512), y = U(r, 0, 1024);
    g.strokeStyle = "rgba(62,38,30,0.5)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + U(r, 8, 18), y + U(r, -3, 3)); g.stroke();
  }
});

/** where the water tubes run on the cut trunk face, as fractions of the face width (0 = left bark, 1 = right) */
export const TUBES = [0.13, 0.2, 0.27, 0.34, 0.66, 0.73, 0.8, 0.87];
/** cut face of the trunk: bark rim, a thin green-tan living layer, sapwood with pale-blue water tubes, darker
 *  heartwood in the middle; 1024 x 1024 = the face width x one tile up (repeat in y) */
export const cutFaceHD = () => ctex("cutFace", 1024, 1024, (g, r) => {
  const W = 1024, H = 1024;
  const gr = g.createLinearGradient(0, 0, W, 0);
  for (const [k, c] of [[0, "#5a3a28"], [0.05, "#5a3a28"], [0.055, "#9fae6a"], [0.075, "#d9b98a"], [0.36, "#e7c896"], [0.42, "#b57a4a"],
    [0.58, "#b57a4a"], [0.64, "#e7c896"], [0.925, "#d9b98a"], [0.945, "#9fae6a"], [0.95, "#5a3a28"], [1, "#5a3a28"]] as const) gr.addColorStop(k, c);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // grain lines
  for (let i = 0; i < 70; i++) {
    let x = U(r, 0.08, 0.92) * W;
    g.strokeStyle = `rgba(120,76,44,${U(r, 0.12, 0.28)})`; g.lineWidth = U(r, 1.5, 3.5);
    g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= H; y += 64) { x += U(r, -3, 3); g.lineTo(x, y); } g.stroke();
  }
  // water tubes (xylem): pale blue channels with soft dark edges; continuous top to bottom so the tile repeats
  for (const t of TUBES) {
    const x = t * W;
    g.fillStyle = "rgba(70,40,30,0.55)"; g.fillRect(x - 17, 0, 34, H);
    g.fillStyle = "#a9ddf2"; g.fillRect(x - 12, 0, 24, H);
    g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(x - 8, 0, 5, H);
    for (let y = 40; y < H; y += 128) { g.fillStyle = "rgba(70,40,30,0.35)"; g.fillRect(x - 12, y, 24, 4); }
  }
  // phloem: thin sugar channel just inside the bark (warm cream)
  for (const x of [0.065 * W, 0.935 * W]) { g.fillStyle = "rgba(255,236,170,0.8)"; g.fillRect(x - 5, 0, 10, H); }
});

/** cut bank of soil: 2048 x 512 = 24 m x 6 m; grass lip at the top, dark topsoil, brown subsoil, clay, pebbles */
export const soilFaceHD = () => ctex("soilFace", 2048, 512, (g, r) => {
  const W = 2048, H = 512;
  const gr = g.createLinearGradient(0, 0, 0, H);
  for (const [k, c] of [[0, "#4c8a34"], [0.035, "#4c8a34"], [0.04, "#5a3d2b"], [0.3, "#6b4630"], [0.55, "#86583a"], [0.8, "#a06a42"], [1, "#a8744a"]] as const) gr.addColorStop(k, c);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) blotch(g, U(r, 0, W), U(r, 40, H), U(r, 30, 110), 2.2, r() > 0.5 ? "150,100,64" : "70,46,32", 0.3);
  // layer seams
  for (const y0 of [0.3, 0.56, 0.8]) {
    g.strokeStyle = "rgba(50,30,24,0.35)"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, y0 * H);
    for (let x = 0; x <= W; x += 64) g.lineTo(x, y0 * H + U(r, -8, 8));
    g.stroke();
  }
  // pebbles
  for (let i = 0; i < 160; i++) {
    const x = U(r, 0, W), y = U(r, 60, H - 10), rx = U(r, 4, 14);
    g.fillStyle = ["#b9a58a", "#9c8c78", "#cbb79a"][i % 3]; g.strokeStyle = "rgba(45,30,28,0.8)"; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(x, y, rx, rx * U(r, 0.55, 0.8), U(r, 0, 3), 0, TAU); g.fill(); g.stroke();
  }
  // grass blades over the lip
  g.strokeStyle = "#3f7a2c"; g.lineWidth = 3; g.lineCap = "round";
  for (let x = 0; x < W; x += 7) { const h = U(r, 6, 18); g.beginPath(); g.moveTo(x, 18); g.lineTo(x + U(r, -4, 4), 18 + h); g.stroke(); }
});

/** the giant leaf's surface (mapped on its own outline geometry, uv 0..1 over the bounding box, base at v = 0) */
export const leafHD = () => ctex("leafHD_big", 1024, 1024, (g, r) => {
  const W = 1024, H = 1024;
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, "#4f9a35"); gr.addColorStop(0.5, "#6cb544"); gr.addColorStop(1, "#4f9a35");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 18; i++) blotch(g, U(r, 0, W), U(r, 0, H), U(r, 60, 160), 1, r() > 0.5 ? "140,200,90" : "60,120,40", 0.25);
  // midrib (canvas y down = leaf tip at the top)
  g.strokeStyle = "#cfe59a"; g.lineWidth = 16; g.lineCap = "round";
  g.beginPath(); g.moveTo(W / 2, H); g.quadraticCurveTo(W / 2 + 12, H / 2, W / 2, 20); g.stroke();
  g.strokeStyle = "rgba(60,100,40,0.5)"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W / 2 + 9, H); g.quadraticCurveTo(W / 2 + 21, H / 2, W / 2 + 9, 20); g.stroke();
  // side veins
  for (let i = 0; i < 9; i++) {
    const y = H * (0.9 - i * 0.095);
    for (const s of [-1, 1]) {
      g.strokeStyle = "rgba(205,232,150,0.85)"; g.lineWidth = 7;
      g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W / 2 + s * W * 0.2, y - H * 0.04, W / 2 + s * W * 0.42, y - H * 0.13); g.stroke();
    }
  }
});

/** stump top: 1024 x 1024, bark edge, sapwood, ~22 growth rings (slightly off-centre and wobbly), heart, cracks */
export const RINGS = 22;
export const ringsHD = () => ctex("ringsTop", 1024, 1024, (g, r) => {
  const C = 512, cx = 528, cy = 500;
  g.fillStyle = "#5a3a28"; g.beginPath(); g.arc(C, C, 510, 0, TAU); g.fill();
  g.fillStyle = "#e9c99a"; g.beginPath(); g.arc(C, C, 472, 0, TAU); g.fill();
  const ph = [U(r, 0, TAU), U(r, 0, TAU)];
  for (let k = RINGS; k >= 1; k--) {
    const rad = (k / RINGS) * 452;
    const t = k / RINGS, ox = cx + (C - cx) * t, oy = cy + (C - cy) * t;
    g.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * TAU, w = 1 + 0.025 * Math.sin(3 * a + ph[0] + k) + 0.015 * Math.sin(5 * a + ph[1]);
      const x = ox + rad * w * Math.cos(a), y = oy + rad * w * Math.sin(a);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.fillStyle = k % 2 ? "#e2bd88" : "#ebcb98"; g.fill();
    g.strokeStyle = "rgba(140,84,48,0.85)"; g.lineWidth = 5; g.stroke();
  }
  g.fillStyle = "#c08a58"; g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.fill();
  for (let i = 0; i < 3; i++) { // drying cracks
    const a = U(r, 0, TAU);
    g.strokeStyle = "rgba(70,40,30,0.75)"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(cx + 40 * Math.cos(a), cy + 40 * Math.sin(a)); g.lineTo(cx + U(r, 160, 300) * Math.cos(a + 0.05), cy + U(r, 160, 300) * Math.sin(a + 0.05)); g.stroke();
  }
});

/** terracotta pot: bands + mottling; 1024 around x 512 up */
export const terracottaHD = () => ctex("terracotta", 1024, 512, (g, r) => {
  g.fillStyle = "#c46a42"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 24; i++) blotch(g, U(r, 0, 1024), U(r, 0, 512), U(r, 30, 90), 1.6, r() > 0.5 ? "214,140,96" : "150,80,52", 0.3);
  for (const y of [70, 96, 440]) { g.fillStyle = "rgba(110,52,34,0.45)"; g.fillRect(0, y, 1024, 8); }
  g.fillStyle = "rgba(230,170,120,0.35)"; g.fillRect(0, 0, 1024, 60);
});

/** soil crumbs (pot top, heaps, sacks spilling): 512 x 512 */
export const soilTopHD = () => ctex("soilTop", 512, 512, (g, r) => {
  g.fillStyle = "#5d3f2c"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const x = U(r, 0, 512), y = U(r, 0, 512), s = U(r, 2, 7);
    g.fillStyle = r() > 0.5 ? "rgba(122,86,60,0.8)" : "rgba(52,34,26,0.8)";
    g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
  }
});

/** balance dial plate: 512 x 256, brass with tick marks and a zero mark at the top centre */
export const dialHD = () => ctex("dial", 512, 256, (g) => {
  g.fillStyle = "#d9b45a"; g.beginPath(); g.moveTo(16, 250); g.arc(256, 250, 240, Math.PI, 0); g.closePath(); g.fill();
  g.strokeStyle = "#5a4020"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#f3e1a8"; g.beginPath(); g.moveTo(52, 250); g.arc(256, 250, 204, Math.PI, 0); g.closePath(); g.fill();
  g.lineCap = "round";
  for (let i = -10; i <= 10; i++) {
    const a = -Math.PI / 2 + i * 0.07, big = i % 5 === 0;
    g.strokeStyle = i === 0 ? "#c0353a" : "#3a2a1a"; g.lineWidth = i === 0 ? 10 : big ? 6 : 3.5;
    g.beginPath(); g.moveTo(256 + 200 * Math.cos(a), 250 + 200 * Math.sin(a)); g.lineTo(256 + (big ? 150 : 172) * Math.cos(a), 250 + (big ? 150 : 172) * Math.sin(a)); g.stroke();
  }
});

/** iron weight top / side: dark slate with a painted highlight band; 256 x 128 */
export const ironHD = () => ctex("ironW", 256, 128, (g) => {
  g.fillStyle = "#555a66"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "rgba(200,205,215,0.35)"; g.fillRect(40, 0, 36, 128);
  g.fillStyle = "rgba(20,20,30,0.25)"; g.fillRect(170, 0, 60, 128);
});
