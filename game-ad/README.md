# Lantern Leap - 2.5D game ad (original)

A 26 s vertical teaser for an invented 2.5D platformer ("Lantern Leap"): flat ink-outlined cartoon cards in a three.js world,
gliding/cutting camera, impact kicks, synthesised SFX only (no voice-over, no music). Rendered with Remotion.

- `src/timeline.ts` - the single timeline (hero path, jumps, stomps, boss slams, burst). Picture and sound both read it.
- `src/world.ts`, `src/draw.ts`, `src/cam.ts`, `src/Ad.tsx` - scene, cards, camera, composition + logo card.
- `audio/sfx.py` - numpy-synthesised SFX placed from `audio/events.json` (exported from the timeline) -> `public/sfx_mix.wav`.
- `.github/workflows/render-game-ad.yml` (repo root) - renders the mp4 on GitHub Actions and uploads it as an artifact.

## Run it
GitHub: Actions -> "Render game ad" -> Run workflow (scale 1 = 1080x1920, 1.3333 = 2K). Download the `lantern-leap-ad` artifact.

Local: `npm ci && pip install numpy && npm run render` (needs Node 22, Python 3, Chrome).
Stills for quick checks: `scripts/stills.sh 30 120 360 515 700`.

Change the story by editing `src/timeline.ts` (frames) and re-running `npm run audio`; the sounds follow the timeline.
