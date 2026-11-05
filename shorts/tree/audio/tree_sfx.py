# Sound for "Made of Thin Air": no voice and no music (by request), so the synthesized effects + ambience carry the
# film. Every event is timed to the picture (frame numbers from story.ts / cast.ts) and rendered into one stereo
# 48 kHz mix, normalised to -14 LUFS integrated (YouTube Shorts) with a -1 dBTP true-peak ceiling.
# Usage: python audio/tree_sfx.py <out.wav>
import math
import sys
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, pan, st, place, fades, widen, make_ir, convolve_st, integrated, momentary_max,
                 true_peak, norm_to, colored, smooth_noise, modal, phase, write_wav)
import sfx_gen as G
from instruments import glock, pluck

FPS = 30
TOTAL = 1800
DUR = TOTAL / FPS
N = ns(DUR)
F = lambda f: f / FPS  # frame -> seconds


def hh(i, s=0):
    """same hash as cast.ts (JS Math.sin): per-object random in [0, 1)"""
    v = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - math.floor(v)


# ------------------------------------------------------------------ small synths of our own
def ding(r, f0=1320, dur=1.6):
    """brass balance ringing as it settles: bell partials, slow beat"""
    y = modal(dur, [(f0, 1.0, 0.7), (f0 * 2.01, 0.45, 0.35), (f0 * 2.76, 0.3, 0.25), (f0 * 4.1, 0.15, 0.12), (f0 * 0.5, 0.2, 0.5)], r)
    return fades(y * (1 + 0.15 * np.sin(2 * np.pi * 3.1 * tt(dur))), 0.001, 0.2)


def clank(r, heavy=1.0):
    """iron weight landing on a brass pan"""
    d = 0.7
    t = tt(d)
    body = modal(d, [(r.uniform(380, 460), 0.9, 0.09), (r.uniform(900, 1100), 0.6, 0.06), (r.uniform(1900, 2300), 0.4, 0.04), (r.uniform(3300, 3900), 0.25, 0.02)], r)
    pan_ring = modal(d, [(r.uniform(700, 760), 0.4, 0.25), (r.uniform(1650, 1750), 0.25, 0.18)], r)
    thud = np.exp(-t / 0.04) * np.sin(phase(70 * (1 + 0.5 * np.exp(-t / 0.01)))) * 1.2 * heavy
    hit = bp(r.standard_normal(len(t)), 800, 7000, 1) * np.exp(-t / 0.003) * 0.8
    return fades(body + pan_ring + thud + hit, 0.0, 0.1)


def beam_creak(r, dur=1.4):
    return G.creak(dur, r, 140, 90, G.SMALLMETAL, [(0, 0), (0.1, 1), (0.6, 0.6), (1, 0)], rough=0.08, noise=0.02, scale=0.6)


def pop(r, f0=900, dur=0.12):
    """cute bubble pop (a molecule arriving)"""
    t = tt(dur)
    y = np.sin(phase(f0 * (1 + 1.4 * np.exp(-t / 0.012)))) * np.exp(-t / 0.03)
    return fades(y + 0.15 * bp(r.standard_normal(len(t)), 2000, 8000, 1) * np.exp(-t / 0.004), 0.0005, 0.02)


def gulp(r, f0=260):
    """a leaf mouth gulping: low wet pop with a falling 'glk'"""
    d = 0.22
    t = tt(d)
    y = np.sin(phase(f0 * (1.6 - 0.9 * np.minimum(1, t / 0.08)))) * np.exp(-t / 0.05)
    y += 0.4 * np.sin(phase(f0 * 2.3 * (1 + 0.6 * np.exp(-t / 0.01)))) * np.exp(-t / 0.02)
    return fades(y, 0.002, 0.03)


def boing(r, f0=180, dur=0.9):
    """cartoon spring 'boing' for the punch line"""
    t = tt(dur)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 9 * t))
    y = (np.sin(phase(f)) + 0.3 * np.sin(2 * phase(f))) * np.exp(-t / 0.35)
    return fades(y, 0.002, 0.15)


def tick(r):
    t = tt(0.06)
    return modal(0.06, [(3400, 0.8, 0.008), (5200, 0.4, 0.004)], r) + bp(r.standard_normal(len(t)), 3000, 9000, 1) * np.exp(-t / 0.002) * 0.4


def slurp(r, dur=2.6):
    """straw sipping: bubbly, gurgly noise band rising, in pulls"""
    n = ns(dur)
    t = np.arange(n) / SR
    pulls = np.clip(np.sin(2 * np.pi * 1.6 * t) * 1.6, 0, 1) ** 0.6
    nz = bp(colored(n, r, 0.6), 500, 2600, 2) * (0.5 + 0.5 * smooth_noise(n, r, 18))
    b = G.bubbles(dur, r, 26, 500, 1800, (0.006, 0.02), pulls, (6, 14))
    y = (nz * 0.5 + b) * pulls
    return fades(y, 0.05, 0.2)


def shimmer(r, dur=1.4, base=1760):
    """airy sparkle: a few high glock notes + breathy noise swell"""
    y = np.zeros(ns(dur))
    for k, (dt, f) in enumerate([(0.0, base), (0.07, base * 1.25), (0.14, base * 1.5), (0.22, base * 2)]):
        g = glock(f, 0.35, r, dur - dt)
        y[ns(dt): ns(dt) + len(g)] += g[: len(y) - ns(dt)]
    t = tt(dur)
    y += hp(colored(len(t), r, 0.2), 5000) * np.sin(np.pi * np.minimum(1, t / dur)) ** 2 * 0.08
    return fades(y, 0.001, 0.2)


def inhale(r, dur=1.5):
    """a big happy breath in (nose) and a short 'ahh' out"""
    n = ns(dur)
    t = np.arange(n) / SR
    env = np.clip(t / 0.9, 0, 1) ** 1.5 * (t < 1.0) + (t >= 1.0) * np.exp(-(t - 1.0) / 0.12)
    y = bp(colored(n, r, 0.4), 700, 5500, 2) * env * 0.8
    m = ns(0.45)
    ah = G.vox(240.0 * np.linspace(1.05, 0.92, m), G.vowel_track(m, [(0, "a"), (0.45, "A")]), np.sin(np.linspace(0, np.pi, m)) ** 0.7, r, scale=1.25, breath=0.4)
    y[ns(1.02): ns(1.02) + len(ah)] += ah[: n - ns(1.02)] * 0.6
    return fades(y, 0.01, 0.1)


def zap(r, dur=0.6):
    """sunbeam hit: rising sparkle sweep + soft crack"""
    t = tt(dur)
    sw = np.sin(phase(600 + 5200 * (t / dur) ** 1.5)) * np.sin(np.pi * t / dur) ** 2 * 0.35
    crack = bp(r.standard_normal(len(t)), 1500, 9000, 1) * np.exp(-np.maximum(0, t - 0.32) / 0.01) * (t > 0.32) * 0.9
    return fades(sw + crack, 0.002, 0.08)


def rustle(dur, r, level=1.0):
    n = ns(dur)
    g = np.clip(smooth_noise(n, r, 2.5), 0, None) ** 2
    out = np.stack([bp(colored(n, r, 0.3), 1500, 7000, 2) * g for _ in range(2)]) * level
    return out


def rumble(dur, r):
    n = ns(dur)
    return st(lp(colored(n, r, 1.6), 140, 2) * (0.8 + 0.2 * smooth_noise(n, r, 0.2)))


# ------------------------------------------------------------------ the cue list
def build():
    R = rng(1648)
    rr = lambda: rng(int(R.integers(1 << 30)))
    mix = np.zeros((2, N))
    ev = lambda x, t, lufs, p=0.0: place(mix, pan_any(norm_to(x, lufs), p), t)
    bed = lambda x, a, b, lufs, fin=0.25, fout=0.3: place(mix, fades(norm_to(st(x)[:, : ns(F(b) - F(a))], lufs, "integrated"), fin, fout), F(a))

    def pan_any(x, p):
        return pan(x, p) if np.asarray(x).ndim == 1 else x

    # ---- ambience beds per place (integrated loudness, crossfaded on the shot changes)
    def meadow(dur, seed):
        r = rng(seed)
        x = G.breeze(dur, r, 1.0, 0.15, 900)
        x += pan(G.bird_chirps(dur, r, 0.6, "sparrow") * 0.12, 0.5) + pan(G.bird_chirps(dur, r, 0.25, "blackbird") * 0.1, -0.5)
        x += rustle(dur, r, 0.35)
        return x
    def court(dur, seed):
        r = rng(seed)
        x = G.breeze(dur, r, 0.7, 0.12, 700)
        x += pan(G.bird_chirps(dur, r, 0.35, "sparrow") * 0.08, 0.6) + pan(G.bird_chirps(dur, r, 0.15, "blackbird") * 0.06, -0.4)
        return x
    bed(meadow(4.3, 1), 0, 128, -30)
    bed(court(17.5, 2), 118, 512, -32)
    bed(G.breeze(2.4, rr(), 1.6, 0.5, 1200) + rustle(2.4, rr(), 1.0), 505, 575, -27)        # autumn gusts
    bed(court(16.2, 3), 566, 1054, -32)
    bed(rumble(6.3, rr()) + st(G.water_bed(6.3, rr(), 0.4, 0.5)) * 0.4, 1046, 1234, -31)   # underground
    bed(G.breeze(9.8, rr(), 0.8, 0.2, 2200) * 0.9 + rustle(9.8, rr(), 0.3), 1226, 1524, -33)  # high air at the leaf
    bed(meadow(6.6, 4), 1516, 1714, -30)
    bed(court(3.2, 5), 1706, 1800, -32, 0.25, 0.6)

    # ---- hook: molecules pop into the canopy, the push-in whoosh
    for i in range(14):
        per = 3.2 + 1.5 * hh(i, 4)
        k = 0
        while True:
            t = (0.85 - hh(i, 5)) * per + k * per  # arrival (u = 0.85) times
            k += 1
            if t > F(118): break
            if t > 0.1: ev(pop(rr(), 700 + 500 * hh(i, 8)), t, -30 - 3 * hh(i, 9), (hh(i, 1) - 0.5) * 1.4)
    ev(G.whoosh(1.4, rr(), 0.7, 300, 1800, 0.8, 0.3), F(56) - 0.55, -26)
    # flash into the 1640s: bright swish + chime
    ev(G.whoosh(0.7, rr(), 0.18, 900, 5000, 0.7, 0.2, 0.3), F(120) - 0.18, -22)
    ev(shimmer(rr(), 1.6, 1568), F(120), -26, 0.2)

    # ---- the doctor walks out on cobbles (stroll 0.9 Hz: footfalls at phase 0 and 0.5)
    t = F(126) + 0.1
    while t < F(214):
        ev(G.stroll_step(rr(), 0.7), t, -30 + 4 * min(1, (t - F(126)) / 2.5), 0.05)
        t += 1 / 1.8

    # ---- weighing: clank + beam creak + ding
    for d, heavy, n in [(300, 0.5, 1), (390, 1.0, 4), (700, 1.6, 7)]:
        for j in range(n):
            ev(clank(rr(), heavy), F(d) - 0.01 + j * 0.045 * (1 + 0.5 * hh(j, d)), -17 + (2 if heavy > 1.2 else 0) - 1.5 * j / max(1, n), 0.25)
        ev(beam_creak(rr(), 1.2), F(d) + 0.03, -27, 0.2)
        ev(ding(rr(), 1320 if d < 700 else 1180, 2.0), F(d) + 0.5, -24, 0.2)
    ev(G.whoosh(0.5, rr(), 0.25, 400, 2400, 0.8, 0.12), F(300) - 0.25, -28, 0.3)   # weight falling in
    ev(G.whoosh(0.5, rr(), 0.25, 300, 2000, 0.8, 0.12), F(390) - 0.25, -26, 0.3)
    ev(G.whoosh(0.6, rr(), 0.3, 250, 1800, 0.8, 0.12), F(700) - 0.3, -23, 0.3)
    # soil poured onto the pan (heap appears at 360): a sandy pour
    n = ns(0.9)
    sand = bp(colored(n, rr(), 0.3), 600, 6000, 2) * np.sin(np.linspace(0, np.pi, n)) ** 0.8
    ev(sand, F(358), -26, -0.2)

    # ---- time-lapse: watering, seasons, growth
    for a, b in [(452, 508), (572, 628)]:
        dur = F(b) - F(a)
        water = bp(colored(ns(dur), rr(), 0.2), 900, 6500, 2) * 0.4 + G.bubbles(dur, rr(), 22, 900, 3000, (0.004, 0.012))
        ev(fades(water, 0.1, 0.2), F(a), -26, -0.25)
    ev(G.whoosh(1.0, rr(), 0.5, 500, 3000, 0.9, 0.25), F(450) - 0.5, -26)
    for k in range(10):  # growth: rising soft plucks (time passing)
        ev(pluck(392 * 2 ** ((k * 2) / 12), 0.6, rr(), 0.6, 0.6), F(452) + k * 0.6, -31 + k * 0.3, (k % 2 - 0.5) * 0.4)
    ev(G.whoosh(1.0, rr(), 0.5, 400, 2500, 0.9, 0.3), F(510) - 0.5, -27)
    ev(G.whoosh(1.0, rr(), 0.5, 500, 3000, 0.9, 0.3), F(570) - 0.5, -27)
    ev(pan(G.bird_chirps(2.0, rr(), 2.5, "sparrow"), 0.3), F(572), -27)
    ev(G.whoosh(0.9, rr(), 0.45, 400, 2400, 0.8, 0.2), F(630) - 0.45, -25)
    # the doctor gasps at the slammed beam (willow on the pan)
    ev(G.whoa(rr()), F(640), -25, -0.25)
    ev(beam_creak(rr(), 2.0), F(632), -26, 0.1)

    # ---- the needle: tiny ticks; then the punch line
    for k, d in enumerate([792, 800, 809, 817]):
        ev(tick(rr()), F(d), -30 - 2 * k, 0.0)
    ev(boing(rr(), 170), F(842), -18)
    ev(G.whoosh(0.4, rr(), 0.2, 600, 3000, 0.8, 0.1), F(840) - 0.2, -24)
    for k in range(6):  # dizzy stars twinkling
        ev(glock(2093 * 2 ** ((k % 3) * 4 / 12), 0.4, rr(), 0.6), F(850) + k * 0.28, -30, (k % 2 - 0.5))
    # luckily (scratch) / unluckily: tilt up to the air
    ev(G.stroll_step(rr(), 1.5) * 0.4, F(906), -32)
    ev(G.whoosh(1.6, rr(), 0.9, 300, 2600, 0.9, 0.4, 0.25), F(980) - 0.6, -24)
    ev(shimmer(rr(), 1.8, 1318), F(990), -28, -0.2)
    for i in range(10): ev(pop(rr(), 800 + 400 * hh(i, 3)), F(1000) + i * 0.13 + 0.07 * hh(i, 4), -32, (hh(i, 1) - 0.5) * 1.6)

    # ---- underground: drop slurps up the roots and the trunk
    ev(G.whoosh(1.0, rr(), 0.5, 200, 1200, 0.8, 0.3), F(1050) - 0.5, -24)
    for i in range(12): ev(gulp(rr(), 420 + 160 * hh(i, 2)) * 0.6, F(1058) + i * 0.48 + 0.2 * hh(i, 3), -31, (hh(i, 5) - 0.5) * 1.2)
    ev(slurp(rr(), 3.6), F(1118), -23)
    ev(G.whoosh(1.4, rr(), 0.7, 300, 2600, 0.8, 0.3), F(1124), -26)

    # ---- the leaf: every mouth gulps on its own rhythm (cast.ts mouthOpen: arrival at phase 0.75, period 1.8 s)
    ev(G.whoosh(1.0, rr(), 0.5, 600, 4000, 0.9, 0.25, 0.3), F(1230) - 0.5, -25)
    MOUTH_X = [-0.55, 0.6, -0.7, 0.5, -0.4, 0.35, 0.85, -0.95, 0.0]
    for k in range(9):
        per = 1.8
        for m in range(-1, 8):
            t = (0.75 - hh(k, 4)) * per + m * per
            if F(1232) < t < F(1408):
                ev(gulp(rr(), 230 + 70 * hh(k, 6)), t, -24 - 2 * hh(k, 7), MOUTH_X[k] * 0.8)
    # sunlight splits it
    ev(zap(rr()), F(1428) - 0.32, -20, 0.2)
    ev(shimmer(rr(), 1.5, 2093), F(1430), -25, 0.3)
    ev(pop(rr(), 520, 0.2), F(1430), -22)
    for k in range(9):  # sugar rings sliding down: descending plucks
        ev(pluck(784 * 2 ** (-(k * 2) / 12), 0.55, rr(), 0.5, 0.7), F(1468) + k * 0.18, -28, 0.15 * (k % 3 - 1))

    # ---- hill: the kid breathes in; the rings light one after another
    ev(G.whoosh(1.0, rr(), 0.5, 400, 2400, 0.9, 0.25), F(1520) - 0.5, -26)
    ev(inhale(rr(), 1.6), F(1528), -21)
    for i in range(5): ev(pop(rr(), 900 + 300 * hh(i, 2)), F(1560) + i * 0.33, -31, (hh(i, 3) - 0.5))
    for k in range(7):
        ev(glock(523.25 * 2 ** ([0, 4, 7, 12, 16, 19, 24][k] / 12), 0.45, rr(), 1.2), F(1606) + k * 0.47, -27, 0.1 * (k % 3 - 1))
    ev(G.stroll_step(rr(), 0.3), F(1654), -34)

    # ---- the end: crane up into the sky, closing chime
    ev(G.whoosh(2.0, rr(), 1.2, 250, 3000, 1.0, 0.5, 0.3), F(1742) - 0.2, -23)
    ev(shimmer(rr(), 1.8, 1046.5), F(1760), -24)
    for i in range(8): ev(pop(rr(), 700 + 500 * hh(i, 7)), F(1748) + i * 0.17, -32, (hh(i, 8) - 0.5) * 1.6)
    return mix


def limiter(x, ceil_db=-1.0, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    # release: run a one-pole on the reduction
    kr = 1 - np.exp(-1 / (rel * SR))
    if not (g < 1.0).any():
        return x
    out = np.ones(n)
    cur = 1.0
    for i in range(n):
        gi = g[i]
        if gi < 1.0 or cur < 1.0:
            cur = min(gi, cur + (1 - cur) * kr)
            if cur > 0.99999: cur = 1.0
            out[i] = cur
    g = ndimage.uniform_filter1d(out, 2 * La + 1, mode="nearest")
    return x * np.minimum(g, 1.0)[None, :]


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "mix.wav"
    x = build()
    # a little shared room so the synthesized events sit together
    ir = make_ir(0.9, 7)
    x = x + 0.12 * convolve_st(x, ir)[:, : x.shape[1]]
    x = norm_to(x, -14.0, "integrated")
    x = limiter(x, -1.2)
    x = norm_to(x, -14.0, "integrated")
    x = limiter(x, -1.2)
    print(f"integrated {integrated(x):.1f} LUFS, true peak {true_peak(x):.1f} dBTP, {x.shape[1] / SR:.3f} s")
    write_wav(out, x, 24)
