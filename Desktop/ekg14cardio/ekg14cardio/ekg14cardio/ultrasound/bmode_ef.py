"""B-mode EF: Simpson's biplane method of discs (ASE/EACVI 2015 recommendation).

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.

The device's apical tile (near V4/V5) captures A4C and A2C cine loops. An endocardial segmenter
(`Segmenter` protocol) returns one closed LV contour per frame; ED/ES frames are chosen by ECG R-peak
gating (ED) and minimum cavity area (ES). Volumes use 20 discs along the long axis:

    V = (pi/4) * (L/20) * sum_i ( a_i * b_i )      biplane: a_i from A4C, b_i from A2C at the same level
    single-plane: V = (pi/4) * (L/20) * sum_i d_i^2

A built-in `ThresholdSegmenter` (region-growing from a seed inside the cavity) is included so the
pipeline runs end-to-end without a neural network; swap in an ONNX/torch model via `OnnxSegmenter`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np
from scipy import ndimage

from ._util import otsu_threshold


class Segmenter(Protocol):
    def __call__(self, frame: np.ndarray) -> np.ndarray:  # returns boolean LV cavity mask (H, W)
        ...


class ThresholdSegmenter:
    """Region-grow the hypoechoic LV cavity from a seed; apex/annulus closed with morphological ops."""

    def __init__(self, seed_xy: tuple[int, int] | None = None, smooth: float = 1.5):
        self.seed_xy = seed_xy
        self.smooth = smooth

    def __call__(self, frame: np.ndarray) -> np.ndarray:
        f = ndimage.gaussian_filter(np.asarray(frame, float), self.smooth)
        H, W = f.shape
        thr = otsu_threshold(f)
        dark = f <= thr
        dark = ndimage.binary_opening(dark, iterations=1)
        lab, n = ndimage.label(dark)
        if n == 0:
            return np.zeros_like(dark)
        if self.seed_xy is None:
            # choose the largest dark component in the central 60% of the image
            cy, cx = H // 2, W // 2
            sizes = ndimage.sum(dark, lab, index=np.arange(1, n + 1))
            best = None
            for k in np.argsort(sizes)[::-1]:
                ys, xs = np.nonzero(lab == k + 1)
                if abs(ys.mean() - cy) < 0.3 * H and abs(xs.mean() - cx) < 0.3 * W:
                    best = k + 1
                    break
            if best is None:
                best = int(np.argmax(sizes)) + 1
            mask = lab == best
        else:
            x, y = self.seed_xy
            k = lab[y, x]
            mask = lab == k if k > 0 else np.zeros_like(dark)
        mask = ndimage.binary_closing(mask, iterations=1)
        mask = ndimage.binary_fill_holes(mask)
        return mask


class OnnxSegmenter:
    """Wrap an ONNX LV-segmentation model (e.g. trained on EchoNet-Dynamic / CAMUS). Input NCHW float 0..1."""

    def __init__(self, model_path: str, input_size: tuple[int, int] = (112, 112), threshold: float = 0.5):
        import onnxruntime as ort  # optional dependency

        self.sess = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0].name
        self.size = input_size
        self.threshold = threshold

    def __call__(self, frame: np.ndarray) -> np.ndarray:
        f = np.asarray(frame, float)
        H, W = f.shape
        zoom = (self.size[0] / H, self.size[1] / W)
        x = ndimage.zoom(f, zoom, order=1)
        x = (x - x.min()) / (x.max() - x.min() + 1e-9)
        x = np.repeat(x[None, None], 3, axis=1).astype(np.float32)
        y = self.sess.run(None, {self.inp: x})[0]
        prob = 1 / (1 + np.exp(-y[0, 0])) if y.min() < 0 or y.max() > 1 else y[0, 0]
        m = ndimage.zoom(prob, (H / self.size[0], W / self.size[1]), order=1) > self.threshold
        return m


@dataclass
class BModeResult:
    edv_ml: float
    esv_ml: float
    ef_pct: float
    sv_ml: float
    method: str                      # "biplane" | "single_plane_a4c"
    ed_frame_a4c: int
    es_frame_a4c: int
    ed_frame_a2c: int | None = None
    es_frame_a2c: int | None = None
    long_axis_mm: float = np.nan
    quality: float = 0.0
    flags: list[str] = field(default_factory=list)


def _axis_and_discs(mask: np.ndarray, mm_per_px: float, n_discs: int = 20):
    """Long axis from apex (top-most cavity pixel) to the mid-point of the base (bottom-most row); disc widths."""
    ys, xs = np.nonzero(mask)
    if len(ys) < 50:
        return np.nan, np.full(n_discs, np.nan)
    y_apex = ys.min()
    base_rows = ys >= np.percentile(ys, 97)
    y_base = int(np.median(ys[base_rows]))
    x_base = float(np.median(xs[base_rows]))
    x_apex = float(np.median(xs[ys <= y_apex + 2]))
    L_px = float(np.hypot(y_base - y_apex, x_base - x_apex))
    if L_px < 10:
        return np.nan, np.full(n_discs, np.nan)
    # Sample widths perpendicular to the axis at n_discs levels
    ux, uy = (x_base - x_apex) / L_px, (y_base - y_apex) / L_px
    px, py = -uy, ux  # perpendicular
    widths = np.zeros(n_discs)
    H, W = mask.shape
    for i in range(n_discs):
        f = (i + 0.5) / n_discs
        cx, cy = x_apex + ux * L_px * f, y_apex + uy * L_px * f
        w = 0
        for sgn in (+1, -1):
            k = 0
            while True:
                x, y = int(round(cx + sgn * px * k)), int(round(cy + sgn * py * k))
                if not (0 <= x < W and 0 <= y < H) or not mask[y, x]:
                    break
                k += 1
            w += k
        widths[i] = w
    return L_px * mm_per_px, widths * mm_per_px


def simpson_single_plane(mask: np.ndarray, mm_per_px: float, n_discs: int = 20) -> tuple[float, float]:
    L_mm, d_mm = _axis_and_discs(mask, mm_per_px, n_discs)
    if not np.isfinite(L_mm):
        return np.nan, np.nan
    v_mm3 = (np.pi / 4.0) * (L_mm / n_discs) * np.nansum(d_mm ** 2)
    return v_mm3 / 1000.0, L_mm


def simpson_biplane(mask_a4c: np.ndarray, mask_a2c: np.ndarray, mm_per_px: float, n_discs: int = 20) -> tuple[float, float]:
    L4, a = _axis_and_discs(mask_a4c, mm_per_px, n_discs)
    L2, b = _axis_and_discs(mask_a2c, mm_per_px, n_discs)
    if not (np.isfinite(L4) and np.isfinite(L2)):
        return np.nan, np.nan
    L = max(L4, L2)
    v_mm3 = (np.pi / 4.0) * (L / n_discs) * np.nansum(a * b)
    return v_mm3 / 1000.0, L


def _select_ed_es(masks: list[np.ndarray], frame_times_s: np.ndarray, r_peak_times_s: np.ndarray):
    """ED = frame nearest each R peak; ES = minimum-area frame within 150-500 ms after that R."""
    areas = np.array([m.sum() for m in masks], float)
    pairs = []
    for r in r_peak_times_s:
        if r < frame_times_s[0] or r > frame_times_s[-1]:
            continue
        ed = int(np.argmin(np.abs(frame_times_s - r)))
        w = np.nonzero((frame_times_s >= r + 0.15) & (frame_times_s <= r + 0.50))[0]
        if len(w) == 0:
            continue
        es = int(w[np.argmin(areas[w])])
        if areas[ed] > 0 and areas[es] > 0 and areas[es] < areas[ed]:
            pairs.append((ed, es))
    return pairs


def analyze_bmode(
    a4c: np.ndarray,
    frame_times_a4c_s: np.ndarray,
    r_peak_times_s: np.ndarray,
    mm_per_px: float,
    segmenter: Segmenter | None = None,
    a2c: np.ndarray | None = None,
    frame_times_a2c_s: np.ndarray | None = None,
) -> BModeResult:
    """a4c / a2c: cine arrays (n_frames, H, W). Frame times and R-peak times share one clock (seconds)."""
    seg = segmenter or ThresholdSegmenter()
    m4 = [seg(f) for f in a4c]
    pairs4 = _select_ed_es(m4, np.asarray(frame_times_a4c_s, float), np.asarray(r_peak_times_s, float))
    flags: list[str] = []
    if not pairs4:
        return BModeResult(np.nan, np.nan, np.nan, np.nan, "none", -1, -1, flags=["no_valid_beats"])

    edvs, esvs, Ls = [], [], []
    method = "single_plane_a4c"
    pairs2 = []
    m2 = None
    if a2c is not None and frame_times_a2c_s is not None:
        m2 = [seg(f) for f in a2c]
        pairs2 = _select_ed_es(m2, np.asarray(frame_times_a2c_s, float), np.asarray(r_peak_times_s, float))
        if pairs2:
            method = "biplane"

    for k, (ed4, es4) in enumerate(pairs4):
        if method == "biplane":
            ed2, es2 = pairs2[min(k, len(pairs2) - 1)]
            edv, L = simpson_biplane(m4[ed4], m2[ed2], mm_per_px)
            esv, _ = simpson_biplane(m4[es4], m2[es2], mm_per_px)
        else:
            edv, L = simpson_single_plane(m4[ed4], mm_per_px)
            esv, _ = simpson_single_plane(m4[es4], mm_per_px)
        if np.isfinite(edv) and np.isfinite(esv) and 30 <= edv <= 400 and 5 <= esv < edv:
            edvs.append(edv); esvs.append(esv); Ls.append(L)
    if not edvs:
        return BModeResult(np.nan, np.nan, np.nan, np.nan, method, pairs4[0][0], pairs4[0][1], flags=["volumes_out_of_range"])
    edv, esv = float(np.median(edvs)), float(np.median(esvs))
    ef = 100.0 * (edv - esv) / edv
    q = len(edvs) / max(1, len(pairs4))
    if method != "biplane":
        flags.append("single_plane_only")
    if ef < 40:
        flags.append("reduced_ef_bmode")
    ed4, es4 = pairs4[0]
    ed2, es2 = (pairs2[0] if pairs2 else (None, None))
    return BModeResult(edv, esv, ef, edv - esv, method, ed4, es4, ed2, es2, float(np.median(Ls)), float(q), flags)
