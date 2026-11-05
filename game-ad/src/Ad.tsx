import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Audio, staticFile, getInputProps } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { World } from "./world";
import { camAt } from "./cam";
import { BURST, LOGO_HIT, TOTAL } from "./timeline";

const fontFamily = "Impact, 'Arial Black', 'Liberation Sans', 'DejaVu Sans', sans-serif";
export const AD_FRAMES = TOTAL;

const Inner: React.FC = () => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(scene), [scene]);
  const c = camAt(f);
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(...c.pos); cam.up.set(Math.sin(c.roll), Math.cos(c.roll), 0); cam.lookAt(...c.look);
  if (cam.fov !== c.fov) { cam.fov = c.fov; cam.updateProjectionMatrix(); }
  world.update(f, cam);
  return <primitive object={world.root} dispose={null} />;
};

const Logo: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - LOGO_HIT, fps, config: { damping: 9, stiffness: 120, mass: 0.8 } });
  const sub = spring({ frame: f - (LOGO_HIT + 30), fps, config: { damping: 14 } });
  if (f < LOGO_HIT - 2) return null;
  const base: React.CSSProperties = { fontFamily, fontWeight: 900, color: "#fff7df", textAlign: "center", lineHeight: 0.92, WebkitTextStroke: "14px #241726", paintOrder: "stroke fill", textShadow: "0 14px 0 #241726, 0 0 60px rgba(255,200,90,.65)" };
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: "translateY(-120px)" }}>
      <div style={{ ...base, fontSize: 200, transform: `scale(${s}) rotate(${(1 - s) * -6 - 3}deg)`, opacity: s > 0 ? 1 : 0 }}>LANTERN<br /><span style={{ color: "#ffb43a" }}>LEAP</span></div>
      <div style={{ ...base, fontSize: 76, marginTop: 70, WebkitTextStroke: "9px #241726", transform: `translateY(${(1 - sub) * 60}px)`, opacity: sub, letterSpacing: 6 }}>COMING SOON</div>
    </AbsoluteFill>
  );
};

export const LanternLeapAd: React.FC = () => {
  const f = useCurrentFrame();
  const flash = interpolate(f, [BURST - 1, BURST, BURST + 4, BURST + 14], [0, 0.95, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeIn = interpolate(f, [0, 8], [1, 0], { extrapolateRight: "clamp" });
  const withAudio = !(getInputProps() as { silent?: boolean }).silent;
  return (
    <AbsoluteFill style={{ background: "#241726" }}>
      <ThreeCanvas width={1080} height={1920} gl={{ antialias: true, powerPreference: "high-performance" }} camera={{ fov: 54, near: 0.2, far: 1500 }}>
        <Inner />
      </ThreeCanvas>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(20,8,30,.55) 100%)" }} />
      {flash > 0 && <AbsoluteFill style={{ background: "#fff6d8", opacity: flash }} />}
      <Logo />
      {fadeIn > 0 && <AbsoluteFill style={{ background: "#000", opacity: fadeIn }} />}
      {withAudio ? <Audio src={staticFile("sfx_mix.wav")} /> : null}
    </AbsoluteFill>
  );
};
