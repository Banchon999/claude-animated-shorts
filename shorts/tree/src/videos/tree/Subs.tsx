// Subtitle cards (the film has no voice): Fredoka SemiBold, white with a thick plum outline (the characters' ink
// colour), key words in warm yellow, a 5-frame pop-in and a 4-frame fade-out. Placed in the lower middle of the
// frame, above the bottom ~20 % that phone UIs cover. Sizes are in the 1080 x 1920 design space.
import React, { useEffect, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { SUBS } from "./story";

const FAMILY = "FredokaSubs";
const useFont = () => {
  const [handle] = useState(() => delayRender("subtitle font"));
  useEffect(() => {
    const ff = new FontFace(FAMILY, `url(${staticFile("fonts/Fredoka.ttf")})`, { weight: "300 700" });
    ff.load().then((f) => { (document.fonts as unknown as Set<FontFace>).add(f); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);
};

const parts = (text: string) => text.split("*").map((s, i) => ({ s, hi: i % 2 === 1 }));

export const Subs: React.FC = () => {
  useFont();
  const f = useCurrentFrame();
  const sub = SUBS.find((s) => f >= s.a && f < s.b);
  if (!sub) return null;
  const k = f - sub.a, left = sub.b - 1 - f;
  const pop = k < 5 ? [0.82, 0.95, 1.05, 1.02, 1.0][k] : 1;
  const alpha = Math.min(1, (k + 1) / 3, (left + 1) / 4);
  const big = sub.text.length < 16;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center" }}>
      <div style={{
        position: "absolute", top: 1262, width: 940, textAlign: "center", fontFamily: FAMILY, fontWeight: 600,
        fontSize: big ? 92 : 70, lineHeight: 1.14, color: "#ffffff", letterSpacing: 0.5,
        WebkitTextStroke: `${big ? 20 : 16}px #241726`, paintOrder: "stroke fill",
        textShadow: "0 7px 0 rgba(36,23,38,0.55)", transform: `scale(${pop})`, opacity: alpha,
      }}>
        {parts(sub.text).map((p, i) => <span key={i} style={{ color: p.hi ? "#ffd84a" : "#ffffff" }}>{p.s}</span>)}
      </div>
    </AbsoluteFill>
  );
};
