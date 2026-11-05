#!/usr/bin/env bash
# usage: scripts/stills.sh 20 120 300 ...   -> out/still_<frame>.png (half-size, system Chrome, no network needed)
set -e
cd "$(dirname "$0")/.."
mkdir -p out
for f in "$@"; do
  npx remotion still src/index.ts LanternLeapAd "out/still_$f.png" --frame="$f" --gl=swangle --scale=0.5 \
    --browser-executable="${CHROME:-/usr/bin/google-chrome}" --chrome-mode=chrome-for-testing --props='{"silent":true}' >/dev/null 2>&1 && echo "ok $f"
done
