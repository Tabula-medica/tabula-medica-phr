"""M-mode LV analysis from the mid-sternal ultrasound tile (parasternal long-axis, PLAX window).

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.

Input: M-mode image `img` shaped (depth_px, time_px), 8-bit or float intensities, with
`depth_mm_per_px` and `fs_lines` (lines per second). ECG R-peak times (seconds, same clock) gate
end-diastole (ED = R peak) and end-systole (ES = minimum cavity diameter following R, or AC time).

Method:
    1. Column-wise detection of the two endocardial borders of the LV cavity (septal + posterior wall)
       using the strongest intensity gradients bracketing the low-intensity cavity around the expected depth.
    2. LVIDd at ED, LVIDs at ES -> Teichholz volumes:
           V = 7.0 * D^3 / (2.4 + D)           (D in cm, V in mL)
       EF = (EDV - ESV) / EDV ; FS = (LVIDd - LVIDs) / LVIDd
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy import ndimage

from ._util import otsu_threshold


@dataclass
class MModeResult:
    lvidd_mm: float
    lvids_mm: float
    edv_ml: float
    esv_ml: float
    ef_pct: float
    fs_pct: float
    n_beats: int
    border_septal_px: np.ndarray = field(default_factory=lambda: np.array([]))
    border_posterior_px: np.ndarray = field(default_factory=lambda: np.array([]))
    quality: float = 0.0
    flags: list[str] = field(default_factory=list)


def teichholz_volume(d_mm: float) -> float:
    d = d_mm / 10.0
    return 7.0 * d ** 3 / (2.4 + d)


def track_cavity_borders(img: np.ndarray, expected_center_px: int | None = None, search_half_px: int | None = None):
    """Return (septal_px, posterior_px) arrays, one per time column.

    For each column, the cavity is the darkest contiguous run around the expected centre; its edges are refined
    to the max positive/negative vertical gradient within +-6 px.
    """
    img = np.asarray(img, dtype=float)
    img = ndimage.gaussian_filter(img, sigma=(2.0, 1.5))
    H, W = img.shape
    c = H // 2 if expected_center_px is None else int(expected_center_px)
    r = H // 3 if search_half_px is None else int(search_half_px)
    g = np.gradient(img, axis=0)
    sept, post = np.zeros(W, int), np.zeros(W, int)
    prev_s, prev_p = None, None
    lo, hi = max(0, c - r), min(H, c + r)
    thr = otsu_threshold(img[lo:hi, :])          # one global cavity/tissue threshold for the search band
    for t in range(W):
        col = img[lo:hi, t]
        dark = col <= thr
        # pick dark run nearest to previous centre (or search centre)
        centre = c if prev_s is None else (prev_s + prev_p) // 2
        best, best_d = None, 1e9
        i = 0
        while i < len(dark):
            if dark[i]:
                j = i
                while j < len(dark) and dark[j]:
                    j += 1
                mid = lo + (i + j) // 2
                if j - i >= 3 and abs(mid - centre) < best_d:
                    best, best_d = (lo + i, lo + j - 1), abs(mid - centre)
                i = j
            else:
                i += 1
        if best is None:
            s, p = (prev_s, prev_p) if prev_s is not None else (c - r // 2, c + r // 2)
        else:
            s, p = best
            # refine septal edge: strongest negative gradient (bright->dark going deeper) just above s
            a, b = max(0, s - 6), min(H - 1, s + 6)
            s = a + int(np.argmin(g[a:b + 1, t]))
            a, b = max(0, p - 6), min(H - 1, p + 6)
            p = a + int(np.argmax(g[a:b + 1, t]))
            if p <= s + 2:
                s, p = best
        sept[t], post[t] = s, p
        prev_s, prev_p = s, p
    # temporal smoothing
    sept = ndimage.median_filter(sept, size=5)
    post = ndimage.median_filter(post, size=5)
    return sept, post


def analyze_mmode(
    img: np.ndarray,
    depth_mm_per_px: float,
    fs_lines: float,
    r_peak_times_s: np.ndarray,
    t0_s: float = 0.0,
    expected_center_px: int | None = None,
) -> MModeResult:
    sept, post = track_cavity_borders(img, expected_center_px)
    diam_mm = (post - sept).astype(float) * depth_mm_per_px
    W = len(diam_mm)
    lvidd, lvids = [], []
    r_cols = [int(round((t - t0_s) * fs_lines)) for t in np.asarray(r_peak_times_s, float)]
    r_cols = [c for c in r_cols if 0 <= c < W]
    for i, c in enumerate(r_cols):
        nxt = r_cols[i + 1] if i + 1 < len(r_cols) else W
        if nxt - c < int(0.3 * fs_lines):
            continue
        ed = float(np.max(diam_mm[max(0, c - int(0.02 * fs_lines)) : c + int(0.04 * fs_lines) + 1]))
        es_window = diam_mm[c + int(0.15 * fs_lines) : min(nxt, c + int(0.50 * fs_lines))]
        if len(es_window) == 0:
            continue
        es = float(np.min(es_window))
        if 20.0 <= ed <= 90.0 and 10.0 <= es < ed:
            lvidd.append(ed)
            lvids.append(es)
    flags: list[str] = []
    if not lvidd:
        return MModeResult(np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 0, sept, post, 0.0, ["no_valid_beats"])
    d, s = float(np.median(lvidd)), float(np.median(lvids))
    edv, esv = teichholz_volume(d), teichholz_volume(s)
    ef = 100.0 * (edv - esv) / edv
    fsp = 100.0 * (d - s) / d
    q = float(len(lvidd) / max(1, len(r_cols)))
    if q < 0.6:
        flags.append("low_beat_yield")
    if d > 60:
        flags.append("lv_dilated")
    if ef < 50:
        flags.append("reduced_ef_mmode")
    return MModeResult(d, s, edv, esv, ef, fsp, len(lvidd), sept, post, q, flags)
