"""Seismocardiography (SCG) + phonocardiography (PCG) from the mid-sternal sensor tile.

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.


Sensor tile sits on the sternum between V4R and V4 (approx. 4th intercostal space, mid-sternal line):
    - 3-axis MEMS accelerometer (dorso-ventral axis = SCG), 500 Hz-1 kHz
    - MEMS microphone / contact PCG, 2-4 kHz

Outputs per beat, referenced to the ECG R-peak / Q onset:
    MC  mitral valve closure          (SCG, near S1)
    AO  aortic valve opening          (SCG, largest positive peak 40-120 ms after R)
    AC  aortic valve closure          (SCG, near S2)
    MO  mitral valve opening          (SCG, 50-150 ms after AC)
Derived systolic time intervals:
    PEP  = Q onset -> AO              (pre-ejection period)
    LVET = AO -> AC                   (left-ventricular ejection time)
    PEP/LVET                          (inversely related to EF)
EF estimate (Weissler/Garrard regression):  EF% = 1.125 - 1.25 * (PEP/LVET), expressed 0-100.
    Valid as a screening estimate only; the ultrasound tile supplies the measured EF.

Murmur screen: PCG spectral energy in systole (S1->S2) and diastole (S2->next S1) in 100-600 Hz,
relative to S1/S2 energy; sustained elevated ratio flags a possible murmur (systolic / diastolic).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy import signal as sps


@dataclass
class TimingResult:
    n_beats: int
    pep_ms: float
    lvet_ms: float
    pep_lvet: float
    ef_estimate_pct: float
    s1_s2_ms: float                      # electromechanical systole proxy (S1->S2)
    ivrt_ms: float                       # AC -> MO
    systolic_murmur_score: float         # 0..1
    diastolic_murmur_score: float        # 0..1
    beat_fiducials: dict = field(default_factory=dict)   # arrays per fiducial (ms after R)
    quality: float = 0.0
    flags: list[str] = field(default_factory=list)


def _bp(x, fs, lo, hi, order=3):
    nyq = 0.5 * fs
    hi = min(hi, 0.95 * nyq)
    b, a = sps.butter(order, [lo / nyq, hi / nyq], btype="band")
    return sps.filtfilt(b, a, x)


def _shannon_envelope(x: np.ndarray, fs: float, smooth_ms: float = 20.0) -> np.ndarray:
    x = x / (np.max(np.abs(x)) + 1e-12)
    e = -(x ** 2) * np.log(x ** 2 + 1e-12)
    win = max(1, int(smooth_ms / 1000 * fs))
    return np.convolve(e, np.ones(win) / win, mode="same")


def _ms(n: int, fs: float) -> float:
    return 1000.0 * n / fs


def analyze_scg_pcg(
    scg: np.ndarray | None,
    pcg: np.ndarray | None,
    fs_scg: float,
    fs_pcg: float,
    r_peaks: np.ndarray,
    fs_ecg: float,
    qrs_onsets: np.ndarray | None = None,
) -> TimingResult:
    """All sample-index inputs are converted to seconds internally; streams may have different rates."""
    r_t = np.asarray(r_peaks, dtype=float) / fs_ecg
    q_t = (np.asarray(qrs_onsets, dtype=float) / fs_ecg) if qrs_onsets is not None else r_t - 0.035
    flags: list[str] = []
    fid = {k: [] for k in ("MC", "AO", "AC", "MO", "S1", "S2")}
    pep, lvet, ivrt, s1s2 = [], [], [], []
    sys_scores, dia_scores = [], []

    scg_f = _bp(np.asarray(scg, float), fs_scg, 4.0, 40.0) if scg is not None else None
    pcg_f = _bp(np.asarray(pcg, float), fs_pcg, 25.0, 400.0) if pcg is not None else None
    pcg_env = _shannon_envelope(pcg_f, fs_pcg) if pcg_f is not None else None
    pcg_mur = _bp(np.asarray(pcg, float), fs_pcg, 100.0, 600.0) if pcg is not None else None

    for i in range(len(r_t) - 1):
        r0, r1, q0 = r_t[i], r_t[i + 1], q_t[i]
        rr = r1 - r0
        if not (0.3 < rr < 2.0):
            continue
        s1 = s2 = ao = ac = mc = mo = None

        # --- PCG: S1 near R (0-120 ms), S2 at 250-450 ms (scaled with RR) ---
        if pcg_env is not None:
            a, b = int(r0 * fs_pcg), int(min(r1, r0 + 0.14) * fs_pcg)
            if b > a:
                s1 = r0 + np.argmax(pcg_env[a:b]) / fs_pcg
            lo, hi = r0 + 0.22, r0 + min(0.50, 0.55 * rr)
            a, b = int(lo * fs_pcg), int(hi * fs_pcg)
            if b > a:
                s2 = lo + np.argmax(pcg_env[a:b]) / fs_pcg

        # --- SCG fiducials ---
        if scg_f is not None:
            seg_a, seg_b = int(r0 * fs_scg), int(min(r1, r0 + 0.60) * fs_scg)
            seg = scg_f[seg_a:seg_b]
            if len(seg) > int(0.2 * fs_scg):
                t = np.arange(len(seg)) / fs_scg
                # AO: largest positive peak 40-150 ms after R
                m = (t >= 0.040) & (t <= 0.150)
                if m.any():
                    ao = r0 + t[m][np.argmax(seg[m])]
                    # MC: last local minimum before AO (10-80 ms)
                    mm = (t >= 0.010) & (t < (ao - r0))
                    if mm.any():
                        mc = r0 + t[mm][np.argmin(seg[mm])]
                # AC: largest |peak| in 250-450 ms, biased to S2 if available
                lo, hi = (0.25, min(0.50, 0.55 * rr)) if s2 is None else (s2 - r0 - 0.03, s2 - r0 + 0.03)
                m = (t >= lo) & (t <= hi)
                if m.any():
                    ac = r0 + t[m][np.argmax(np.abs(seg[m]))]
                    # MO: first prominent positive peak 50-150 ms after AC
                    m2 = (t >= (ac - r0) + 0.05) & (t <= (ac - r0) + 0.15)
                    if m2.any():
                        mo = r0 + t[m2][np.argmax(seg[m2])]

        # fallback: if no SCG but PCG, approximate AO ~ S1 + 30 ms, AC ~ S2
        if ao is None and s1 is not None:
            ao = s1 + 0.030
        if ac is None and s2 is not None:
            ac = s2

        if ao is not None and ac is not None and ac > ao:
            pep.append(1000 * (ao - q0))
            lvet.append(1000 * (ac - ao))
            for k, v in (("MC", mc), ("AO", ao), ("AC", ac), ("MO", mo), ("S1", s1), ("S2", s2)):
                fid[k].append(1000 * (v - r0) if v is not None else np.nan)
            if mo is not None:
                ivrt.append(1000 * (mo - ac))
            if s1 is not None and s2 is not None:
                s1s2.append(1000 * (s2 - s1))

            # murmur scoring on PCG between S1/S2 (or AO/AC)
            if pcg_mur is not None:
                t1, t2 = (s1 if s1 else ao), (s2 if s2 else ac)
                e = pcg_mur ** 2
                def band_e(a, b):
                    ia, ib = int(a * fs_pcg), int(b * fs_pcg)
                    return float(np.mean(e[ia:ib])) if ib > ia else 0.0
                heart_sound = band_e(t1 - 0.02, t1 + 0.04) + band_e(t2 - 0.02, t2 + 0.04) + 1e-12
                mid_sys = band_e(t1 + 0.06, t2 - 0.04)
                mid_dia = band_e(t2 + 0.08, min(r1 - 0.05, t2 + 0.35))
                sys_scores.append(mid_sys / heart_sound)
                dia_scores.append(mid_dia / heart_sound)

    n = len(pep)
    if n == 0:
        return TimingResult(0, np.nan, np.nan, np.nan, np.nan, np.nan, np.nan, 0.0, 0.0, {}, 0.0, ["no_valid_beats"])

    pep_m, lvet_m = float(np.median(pep)), float(np.median(lvet))
    ratio = pep_m / lvet_m if lvet_m > 0 else np.nan
    ef = float(np.clip(100.0 * (1.125 - 1.25 * ratio), 5.0, 85.0)) if np.isfinite(ratio) else np.nan
    # score: ratio of mid-systolic to heart-sound energy; ~0.1 clean, >0.35 suspicious. Map to 0..1.
    sys_s = float(np.clip((np.median(sys_scores) - 0.10) / 0.40, 0, 1)) if sys_scores else 0.0
    dia_s = float(np.clip((np.median(dia_scores) - 0.10) / 0.40, 0, 1)) if dia_scores else 0.0
    quality = float(n / max(1, len(r_t) - 1))
    if quality < 0.7:
        flags.append("low_beat_yield")
    if np.std(lvet) > 40:
        flags.append("lvet_variability")
    if ratio > 0.45:
        flags.append("elevated_pep_lvet")
    if sys_s > 0.5:
        flags.append("possible_systolic_murmur")
    if dia_s > 0.5:
        flags.append("possible_diastolic_murmur")
    return TimingResult(
        n_beats=n, pep_ms=pep_m, lvet_ms=lvet_m, pep_lvet=float(ratio), ef_estimate_pct=ef,
        s1_s2_ms=float(np.median(s1s2)) if s1s2 else np.nan,
        ivrt_ms=float(np.median(ivrt)) if ivrt else np.nan,
        systolic_murmur_score=sys_s, diastolic_murmur_score=dia_s,
        beat_fiducials={k: np.array(v) for k, v in fid.items()}, quality=quality, flags=flags,
    )
