# usage: python scripts/tile.py out.jpg img1 img2 ... (tiles side by side, 5 per row, 300 px wide, frame label)
import sys
from PIL import Image, ImageDraw
out, ims = sys.argv[1], sys.argv[2:]
W = 300; H = int(W * 16 / 9); n = 5
rows = (len(ims) + n - 1) // n
S = Image.new("RGB", (W * min(n, len(ims)), H * rows), "black"); d = ImageDraw.Draw(S)
for i, p in enumerate(ims):
    x, y = (i % n) * W, (i // n) * H
    S.paste(Image.open(p).convert("RGB").resize((W, H)), (x, y))
    d.rectangle([x, y, x + 60, y + 16], fill="black"); d.text((x + 3, y + 2), p.split("_")[-1].split(".")[0], fill="yellow")
S.save(out, quality=85)
