"""ECG processing for the 14-lead device.

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.

Lead order (device convention, 14 channels):
    0 I, 1 II, 2 III, 3 aVR, 4 aVL, 5 aVF, 6 V1, 7 V2, 8 V3, 9 V4, 10 V5, 11 V6, 12 V4R, 13 V8

Only lead II (or the lead with the best QRS energy) is needed for the timing reference used by the
cardiac module; the full 12/14-lead morphology analysis lives in the app's standard ECG pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy import signal as sps

LEAD_NAMES = ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6", "V4R", "V8"]


@dataclass
class EcgResult:
    fs: float
    r_peaks: np.ndarray            # sample indices
    rr_ms: np.ndarray              # RR intervals (ms)
    hr_bpm: float
    hr_sdnn_ms: float
    qrs_onset: np.ndarray          # sample indices (Q onset) aligned with r_peaks
    lead_used: str
    quality: float                 # 0..1 (fraction of beats with plausible RR)
    flags: list[str] = field(default_factory=list)


def bandpass(x: np.ndarray, fs: float, lo: float = 0.5, hi: float = 40.0, order: int = 3) -> np.ndarray:
    nyq = 0.5 * fs
    b, a = sps.butter(order, [lo / nyq, min(hi, 0.95 * nyq) / nyq], btype="band")
    return sps.filtfilt(b, a, x)


def pick_lead(ecg: np.ndarray) -> int:
    """Pick the lead whose signal is sharpest (highest derivative-to-amplitude ratio) — a cheap QRS-clarity proxy."""
    best, best_i = -1.0, 1 if ecg.shape[0] > 1 else 0
    for i in range(ecg.shape[0]):
        x = ecg[i] - np.mean(ecg[i])
        if np.std(x) < 1e-9:
            continue
        score = np.std(np.diff(x)) / (np.std(x) + 1e-12)
        if score > best:
            best, best_i = score, i
    return best_i


def detect_r_peaks(x: np.ndarray, fs: float) -> np.ndarray:
    """Pan-Tompkins style detector: bandpass -> derivative -> square -> moving integration -> adaptive threshold."""
    x = np.asarray(x, dtype=float)
    xf = bandpass(x, fs, 5.0, 20.0)
    d = np.diff(xf, prepend=xf[0])
    sq = d * d
    win = max(1, int(0.150 * fs))
    integ = np.convolve(sq, np.ones(win) / win, mode="same")
    refractory = int(0.200 * fs)
    thr = 0.3 * np.max(integ[: int(min(len(integ), 3 * fs))]) if len(integ) else 0.0
    peaks, _ = sps.find_peaks(integ, height=thr, distance=refractory)
    # adaptive refinement: re-threshold on median of found peaks
    if len(peaks) >= 3:
        thr = 0.4 * np.median(integ[peaks])
        peaks, _ = sps.find_peaks(integ, height=thr, distance=refractory)
    # snap to the true R maximum (abs) within +-60 ms on the bandpassed signal
    r = []
    half = int(0.060 * fs)
    for p in peaks:
        lo, hi = max(0, p - half), min(len(xf), p + half + 1)
        seg = xf[lo:hi]
        if len(seg) == 0:
            continue
        r.append(lo + int(np.argmax(np.abs(seg))))
    r = np.unique(np.array(r, dtype=int))
    return r


def qrs_onsets(x: np.ndarray, fs: float, r_peaks: np.ndarray) -> np.ndarray:
    """Q onset: walk back from R until slope magnitude falls below 10% of peak slope for 10 ms."""
    xf = bandpass(x, fs, 0.5, 40.0)
    slope = np.abs(np.gradient(xf))
    hold = max(1, int(0.010 * fs))
    out = []
    for r in r_peaks:
        lo = max(0, r - int(0.120 * fs))
        seg = slope[lo : r + 1]
        if len(seg) < hold + 1:
            out.append(lo)
            continue
        thr = 0.10 * seg.max()
        onset = lo
        run = 0
        for i in range(len(seg) - 1, -1, -1):
            run = run + 1 if seg[i] < thr else 0
            if run >= hold:
                onset = lo + i + hold - 1
                break
        out.append(onset)
    return np.array(out, dtype=int)


def analyze_ecg(ecg: np.ndarray, fs: float, lead: int | str | None = None) -> EcgResult:
    """ecg: (n_leads, n_samples) or (n_samples,) array in mV."""
    ecg = np.atleast_2d(np.asarray(ecg, dtype=float))
    if isinstance(lead, str):
        lead = LEAD_NAMES.index(lead)
    if lead is None:
        lead = pick_lead(ecg) if ecg.shape[0] > 1 else 0
    x = ecg[lead]
    r = detect_r_peaks(x, fs)
    flags: list[str] = []
    if len(r) < 2:
        return EcgResult(fs, r, np.array([]), float("nan"), float("nan"), r, LEAD_NAMES[lead] if lead < 14 else str(lead), 0.0, ["insufficient_beats"])
    rr = np.diff(r) / fs * 1000.0
    ok = (rr > 300) & (rr < 2000)
    quality = float(ok.mean())
    hr = 60000.0 / np.median(rr[ok]) if ok.any() else float("nan")
    sdnn = float(np.std(rr[ok])) if ok.sum() > 1 else float("nan")
    if quality < 0.8:
        flags.append("irregular_or_noisy_rr")
    if hr < 50:
        flags.append("bradycardia")
    if hr > 100:
        flags.append("tachycardia")
    onsets = qrs_onsets(x, fs, r)
    return EcgResult(fs, r, rr, float(hr), sdnn, onsets, LEAD_NAMES[lead] if lead < 14 else str(lead), quality, flags)
