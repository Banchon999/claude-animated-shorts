import React from "react";
import { Composition } from "remotion";
import { TreeShort, TREE_FRAMES } from "./videos/tree/Tree";

export const Root: React.FC = () => (
  <Composition id="TreeShort" component={TreeShort} durationInFrames={TREE_FRAMES} fps={30} width={1080} height={1920} />
);
