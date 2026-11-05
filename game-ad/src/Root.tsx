import React from "react";
import { Composition } from "remotion";
import { LanternLeapAd, AD_FRAMES } from "./Ad";

export const Root: React.FC = () => (
  <Composition id="LanternLeapAd" component={LanternLeapAd} durationInFrames={AD_FRAMES} fps={30} width={1080} height={1920} />
);
