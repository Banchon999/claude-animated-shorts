// Flat 2D "cards" (hero, slime, golem face) drawn with Canvas2D and ink outlines, placed in the 3D world as billboards.
import * as THREE from "three";

export const INK = "#241726";
const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const fillStroke = (g: CanvasRenderingContext2D, fill: string, lw = 9) => { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); };

export type Pose = "run" | "jump" | "fall" | "win" | "charge";

/** Pip, the lantern fox. Canvas 512x768, soles at y=730. phase = run cycle 0..1. */
export const drawHero = (pose: Pose, phase: number, blink = false): HTMLCanvasElement => {
  const c = mk(512, 768), g = c.getContext("2d")!;
  g.translate(256, 0);
  const sw = Math.sin(phase * Math.PI * 2);
  const air = pose === "jump" || pose === "fall" || pose === "win" || pose === "charge";
  // tail
  g.beginPath(); g.moveTo(-60, 520); g.bezierCurveTo(-190, 520, -230, 380 - (pose === "jump" ? 40 : 0), -170, 300); g.bezierCurveTo(-140, 380, -110, 410, -50, 450); g.closePath(); fillStroke(g, "#f08a2b");
  g.beginPath(); g.moveTo(-170, 300); g.bezierCurveTo(-200, 330, -210, 370, -190, 400); g.bezierCurveTo(-160, 380, -150, 340, -170, 300); g.fillStyle = "#fff4dc"; g.fill();
  // legs
  const leg = (ox: number, a: number, back: boolean) => {
    const kx = ox + (air ? (back ? -30 : 30) : a * 55), ky = 650 - (air ? 20 : Math.abs(a) * 10);
    const fx = ox + (air ? (back ? -45 : 55) : a * 95), fy = air ? 660 : 730 - Math.max(0, -a) * 55;
    g.beginPath(); g.moveTo(ox, 590); g.lineTo(kx, ky); g.lineTo(fx, fy); g.lineWidth = 34; g.strokeStyle = INK; g.lineCap = "round"; g.lineJoin = "round"; g.stroke();
    g.lineWidth = 20; g.strokeStyle = back ? "#a8561a" : "#f08a2b"; g.stroke();
    g.beginPath(); g.ellipse(fx + 14, fy + 2, 32, 17, 0, 0, Math.PI * 2); fillStroke(g, back ? "#5a2e1a" : "#6d3a1e", 8);
  };
  leg(-24, -sw, true); 
  // body
  g.beginPath(); g.ellipse(0, 490, 120, 150, 0, 0, Math.PI * 2); fillStroke(g, "#f5992f", 10);
  g.beginPath(); g.ellipse(14, 520, 70, 100, 0, 0, Math.PI * 2); g.fillStyle = "#fff0d2"; g.fill();
  leg(26, sw, false);
  // scarf
  g.beginPath(); g.moveTo(-100, 392); g.quadraticCurveTo(0, 440, 100, 392); g.lineTo(96, 440); g.quadraticCurveTo(0, 490, -96, 440); g.closePath(); fillStroke(g, "#d9363e", 9);
  g.beginPath(); g.moveTo(-96, 430); g.quadraticCurveTo(-170 - sw * 20, 470, -190 - sw * 30, 540); g.lineTo(-140 - sw * 20, 520); g.quadraticCurveTo(-120, 480, -78, 452); g.closePath(); fillStroke(g, "#d9363e", 8);
  // head
  g.beginPath(); g.moveTo(-8, 230); g.bezierCurveTo(-150, 235, -170, 330, -120, 395); g.bezierCurveTo(-60, 440, 70, 440, 120, 395); g.bezierCurveTo(170, 330, 150, 235, 8, 230); g.closePath(); fillStroke(g, "#f5992f", 10);
  // ears
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 70, 262); g.lineTo(s * 128, 140 - (pose === "jump" ? 10 : 0)); g.lineTo(s * 20, 238); g.closePath(); fillStroke(g, "#f5992f", 9); g.beginPath(); g.moveTo(s * 70, 245); g.lineTo(s * 108, 170); g.lineTo(s * 44, 238); g.closePath(); g.fillStyle = "#ffd9b0"; g.fill(); }
  // muzzle + face
  g.beginPath(); g.ellipse(22, 372, 62, 40, 0, 0, Math.PI * 2); g.fillStyle = "#fff0d2"; g.fill();
  const ey = 338 - (pose === "jump" ? 6 : 0);
  for (const s of [-1, 1]) {
    const ex = 26 + s * 42;
    if (blink) { g.beginPath(); g.moveTo(ex - 18, ey); g.lineTo(ex + 18, ey); g.lineWidth = 8; g.strokeStyle = INK; g.stroke(); continue; }
    g.beginPath(); g.ellipse(ex, ey, 17, pose === "win" ? 12 : 24, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  }
  g.beginPath(); g.ellipse(22, 372, 12, 8, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
  g.beginPath(); g.arc(22, 378, pose === "win" || pose === "charge" ? 26 : 14, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  // lantern arm + lantern
  const lx = 150, ly = pose === "win" || pose === "charge" ? 250 : 480 + sw * 14;
  g.beginPath(); g.moveTo(70, 470); g.lineTo(lx - 10, ly + 30); g.lineWidth = 30; g.strokeStyle = INK; g.stroke(); g.lineWidth = 17; g.strokeStyle = "#f5992f"; g.stroke();
  g.beginPath(); g.moveTo(lx, ly - 52); g.lineTo(lx, ly); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  const gr = g.createRadialGradient(lx, ly + 40, 4, lx, ly + 40, 52); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.4, "#ffe58a"); gr.addColorStop(1, "#ffb43a");
  g.beginPath(); g.roundRect(lx - 30, ly, 60, 80, 14); fillStroke(g, gr as unknown as string, 8);
  g.beginPath(); g.moveTo(lx - 34, ly); g.lineTo(lx, ly - 22); g.lineTo(lx + 34, ly); g.closePath(); fillStroke(g, "#5b3b2a", 7);
  return c;
};

export const heroTextures = () => {
  const run = Array.from({ length: 8 }, (_, i) => tex(drawHero("run", i / 8)));
  return { run, jump: tex(drawHero("jump", 0)), fall: tex(drawHero("fall", 0)), win: tex(drawHero("win", 0)), charge: tex(drawHero("charge", 0)), blink: tex(drawHero("run", 0, true)) };
};

/** Gloop slimes, 2 states: happy / squashed-angry. 512x384. */
export const drawSlime = (squashed: boolean, hue = "#7be06a"): HTMLCanvasElement => {
  const c = mk(512, 384), g = c.getContext("2d")!;
  g.translate(256, 0);
  g.beginPath(); g.moveTo(-200, 350); g.bezierCurveTo(-210, 150, -90, 40, 0, 40); g.bezierCurveTo(90, 40, 210, 150, 200, 350); g.closePath(); fillStroke(g, hue, 11);
  g.beginPath(); g.ellipse(-70, 130, 44, 24, -0.5, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,.55)"; g.fill();
  const ey = 230;
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(s * 60, ey, 30, squashed ? 12 : 36, 0, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.ellipse(s * 60 - s * 4, ey + 4, 11, squashed ? 8 : 15, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    g.beginPath(); g.moveTo(s * 100, ey - 54); g.lineTo(s * 24, ey - (squashed ? 30 : 56) + (squashed ? 0 : 14)); g.lineWidth = 9; g.strokeStyle = INK; g.stroke();
  }
  g.beginPath(); if (squashed) { g.arc(0, 318, 36, 1.15 * Math.PI, 1.85 * Math.PI); } else { g.arc(0, 288, 34, 0.1 * Math.PI, 0.9 * Math.PI); } g.lineWidth = 8; g.strokeStyle = INK; g.stroke();
  return c;
};
export const slimeTextures = () => ({ ok: tex(drawSlime(false)), flat: tex(drawSlime(true)) });

/** Golem face (angry glowing eyes), 512x512, for the boss head's front. */
export const drawGolemFace = (glow: number): HTMLCanvasElement => {
  const c = mk(512, 512), g = c.getContext("2d")!;
  g.fillStyle = "#6c6577"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#4a4455"; g.lineWidth = 8;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(40 + i * 80, 0); g.lineTo(60 + i * 70, 512); g.stroke(); }
  const col = `rgb(255,${Math.round(90 + 140 * glow)},${Math.round(40 + 120 * glow)})`;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(256 + s * 40, 200); g.lineTo(256 + s * 150, 150); g.lineTo(256 + s * 140, 250); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 12; g.strokeStyle = INK; g.stroke();
  }
  g.beginPath(); g.moveTo(150, 380); g.lineTo(200, 350); g.lineTo(256, 385); g.lineTo(312, 350); g.lineTo(362, 380); g.lineWidth = 14; g.strokeStyle = INK; g.stroke();
  g.lineWidth = 16; g.strokeRect(8, 8, 496, 496);
  return c;
};
export const golemFaceTextures = () => [0, 0.5, 1].map((v) => tex(drawGolemFace(v)));

/** soft round glow sprite for halos / fireflies / burst */
export const glowTexture = () => {
  const c = mk(128, 128), g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return tex(c);
};
