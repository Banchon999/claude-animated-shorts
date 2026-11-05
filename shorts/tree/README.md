# Made of Thin Air (example short)

A 60 s vertical short made with this skill: how a tree works and lives, told through van Helmont's 1640s willow
experiment. **No voice:** subtitles + synthesized sound effects only (no music).

| Path | What it is |
|---|---|
| `SCRIPT.md` | Facts with sources + the subtitle script with frame ranges |
| `src/videos/tree/` | The short: `story.ts` (shots, cameras, subtitles, story state), `world.ts` (hill + oak, 1640s courtyard + balance, cut-away trunk, giant leaf), `cast.ts` (doctor, kid, molecules, drops), `toon.ts` (2D drawing), `Subs.tsx`, `Tree.tsx`; look code (ink, lens blur, grade, two-tone shading) from `templates/bridge/` |
| `audio/tree_sfx.py` | All sound: ambience beds + timed events, mixed to -14 LUFS / -1 dBTP |
| `scripts/stills.mjs` | Look-check stills: `node scripts/stills.mjs out/s/x_ 60,300 0.5` |
| `scripts/short_qa.py`, `scripts/shots.json` | Frame-by-frame QA of the final |

## Render on GitHub Actions (no GPU needed)
`.github/workflows/render-tree-short.yml` runs on every push that touches `shorts/tree/` (or by hand from the
Actions tab). It renders the 1800 frames at 1440x2560 in 20 parallel jobs (software WebGL), synthesizes the sound,
stitches everything without re-encoding, checks the frame count and runs the QA. Download **TreeShort-2K** from the
run's artifacts.

## Render locally
```bash
npm ci
python audio/tree_sfx.py out/mix.wav
npx remotion render src/index.ts TreeShort out/video.mp4 --scale=1.3333333333333333 --crf=16 --timeout=600000
ffmpeg -i out/video.mp4 -i out/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k out/final.mp4
```
The subtitle font is Fredoka (SIL Open Font License, `public/fonts/OFL.txt`).
