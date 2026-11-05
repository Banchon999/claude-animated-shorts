"""Synthesised sound effects for the Lantern Leap ad. No voice, no music: SFX only.
Reads audio/events.json (exported from src/timeline.ts) and writes public/sfx_mix.wav (48 kHz stereo, exact video length)."""
import json, wave, sys, pathlib
import numpy as np

SR = 48000
rs = np.random.RandomState(7)
root = pathlib.Path(__file__).resolve().parent.parent
ev = json.load(open(root / "audio" / "events.json"))
FPS, TOTAL = ev["fps"], ev["total"]
N = int(TOTAL / FPS * SR)

def t(d): return np.arange(int(d * SR)) / SR
def env(n, a=0.003, r=0.08, p=1.0):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    nr = max(1, min(n, int(r * SR))); e[-nr:] *= np.linspace(1, 0, nr) ** p
    return e
def decay(n, k): return np.exp(-np.arange(n) / SR * k)
def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def lp_fast(x, fc, k=1):  # cheap repeated box smoothing (fast, numpy only)
    w = max(1, int(SR / fc / 2)); ker = np.ones(w) / w
    for _ in range(k): x = np.convolve(x, ker, mode="same")
    return x
def noise(d): return rs.uniform(-1, 1, int(d * SR))
def sine(freq, d): 
    f = np.broadcast_to(freq, (int(d * SR),)) if np.isscalar(freq) else freq
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def sweep(f0, f1, d, curve=1.0):
    u = np.linspace(0, 1, int(d * SR)) ** curve; return sine(f0 + (f1 - f0) * u, d)
def bell(freq, d, k=7.0):
    x = sine(freq, d) + 0.5 * sine(freq * 2.01, d) * decay(int(d * SR), k * 1.8) + 0.25 * sine(freq * 3.97, d) * decay(int(d * SR), k * 2.8)
    return x * decay(int(d * SR), k) * env(int(d * SR), 0.002, 0.02)

def step(p):
    d = 0.09; n = int(d * SR)
    x = lp_fast(noise(d), 900 + 400 * p) * 0.9 + sine(95 + 18 * p, d) * decay(n, 40) * 0.8
    return x * decay(n, 38) * 0.55
def jump(h):
    d = 0.18; n = int(d * SR)
    return (sweep(260, 520 + 60 * h, d, 0.8) * 0.45 + lp_fast(noise(d), 2500) * 0.35 * np.sin(np.linspace(0, np.pi, n))) * env(n, 0.004, 0.07)
def land(_):
    d = 0.16; n = int(d * SR)
    return (sweep(130, 55, d) * 0.9 + lp_fast(noise(d), 1100) * 0.6) * decay(n, 24) * 0.9
def squish(_):
    d = 0.22; n = int(d * SR); u = np.linspace(0, 1, n)
    wob = sine(520 - 380 * u + 60 * np.sin(u * 40), d)
    pop = lp_fast(noise(0.03), 4000) 
    x = wob * decay(n, 14) * 0.7; x[:len(pop)] += pop * 0.6
    return x
SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]  # major pentatonic steps
def orb(p):
    i = int(p) % len(SCALE); f = 523.25 * 2 ** (SCALE[i] / 12)
    a = bell(f, 0.45, 8.0) * 0.45; b = bell(f * 1.5, 0.3, 11.0) * 0.12; a[: len(b)] += b
    return a
def rumble(frames):
    d = frames / FPS; n = int(d * SR); u = np.linspace(0, 1, n)
    x = lp_fast(noise(d), 160, 2) * 6 + sine(42 + 14 * u, d) * 0.9
    crack = (rs.rand(n) > 0.9993).astype(float); crack = lp_fast(crack * 8, 700) * 12
    return (x * 0.75 + crack * 0.35) * (0.25 + 0.75 * u ** 1.5) * env(n, 0.05, 0.25)
def slam(_):
    d = 0.9; n = int(d * SR)
    boom = sweep(120, 34, d, 0.5) * decay(n, 5.2)
    crunch = lp_fast(noise(d), 1500) * decay(n, 9)
    tail = lp_fast(noise(d), 300, 2) * 3 * decay(n, 3.5)
    return (boom * 1.0 + crunch * 0.55 + tail * 0.4) * 0.95
def charge(frames):
    d = frames / FPS; n = int(d * SR); u = np.linspace(0, 1, n)
    x = sine(180 + 2200 * u ** 2.2, d) * 0.4 + sine((180 + 2200 * u ** 2.2) * 1.5, d) * 0.15
    sh = lp_fast(noise(d), 4000) * (0.1 + 0.5 * u) * np.sin(2 * np.pi * (14 + 30 * u) * t(d)) ** 2
    return (x + sh) * (0.1 + 0.9 * u ** 1.3) * env(n, 0.02, 0.01)
def burst(_):
    d = 1.6; n = int(d * SR)
    boom = sweep(180, 40, 1.1, 0.4); boom = np.pad(boom, (0, n - len(boom))) * decay(n, 3.2)
    air = lp_fast(noise(d), 6000) * decay(n, 4.5) * 0.6
    ch = sum(bell(f, 1.4, 3.2) for f in (523.25, 659.25, 783.99, 1046.5)) * 0.18
    ch = np.pad(ch, (0, n - len(ch)))
    return boom * 1.0 + air + ch
def crumble(frames):
    d = frames / FPS; n = int(d * SR); x = np.zeros(n)
    for k in range(70):
        s = int(abs(rs.beta(1.2, 2.6)) * (n - 3000)); L = rs.randint(1200, 3200)
        c = lp_fast(rs.uniform(-1, 1, L), rs.randint(500, 2500)) * decay(L, rs.uniform(25, 60)); x[s:s + L] += c * rs.uniform(0.3, 1.0)
    return x * 0.9 * env(n, 0.01, 0.3) + lp_fast(noise(d), 250, 2) * 2.4 * decay(n, 2.2) * 0.35
def sting(_):
    out = np.zeros(int(1.4 * SR))
    for i, st in enumerate([0, 4, 7, 12, 16]):
        b = bell(523.25 * 2 ** (st / 12), 0.9, 4.5) * 0.35; s = int(i * 0.075 * SR); out[s:s + len(b)] += b[: len(out) - s]
    return out
def logo(_):
    d = 1.8; n = int(d * SR)
    hit = sweep(150, 45, 0.7, 0.5); hit = np.pad(hit, (0, n - len(hit))) * decay(n, 4.5)
    ch = sum(bell(f, 1.6, 2.8) for f in (261.63, 392.0, 523.25, 783.99)) * 0.2; ch = np.pad(ch, (0, n - len(ch)))
    shim = lp_fast(noise(d), 8000) * decay(n, 5) * 0.35
    return hit * 0.95 + ch + shim
def wind(total):
    d = total / FPS; n = int(d * SR); u = np.linspace(0, 1, n)
    x = lp_fast(noise(d), 380, 2) * 5; x *= 0.55 + 0.45 * np.sin(2 * np.pi * 0.23 * t(d) + 1.0)
    return x * 0.09 * np.minimum(1, u * 6) * (1 - 0.7 * np.clip((u - 0.8) / 0.2, 0, 1))

FN = dict(step=step, jump=jump, land=land, squish=squish, orb=orb, rumble=rumble, slam=slam, charge=charge, burst=burst, crumble=crumble, sting=sting, logo=logo, wind=wind)
GAIN = dict(step=0.55, jump=0.6, land=0.7, squish=0.9, orb=0.6, rumble=0.75, slam=1.0, charge=0.65, burst=1.0, crumble=0.8, sting=0.75, logo=0.9, wind=1.0)
mix = np.zeros((N + SR * 3, 2))
for e in ev["events"]:
    x = FN[e["name"]](e.get("p", 0)) * GAIN[e["name"]]
    s = int(e["f"] / FPS * SR) - int(0.004 * SR)  # sounds start 4 ms early so the transient lands on the frame
    s = max(0, s); pan = {"step": 0.0, "orb": 0.12 * np.sin(e["f"])}.get(e["name"], 0.0)
    L = min(len(x), len(mix) - s); x = x[:L]
    mix[s:s + L, 0] += x * (1 - max(0, pan)); mix[s:s + L, 1] += x * (1 + min(0, pan))
mix = mix[:N]
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
mix *= 0.89 / max(1e-6, np.abs(mix).max())
out = root / "public" / "sfx_mix.wav"; out.parent.mkdir(exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", out, f"{N / SR:.2f}s", "peak", float(np.abs(mix).max()))
