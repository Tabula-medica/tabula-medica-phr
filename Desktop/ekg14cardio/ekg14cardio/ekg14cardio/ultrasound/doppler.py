"""Doppler valve analysis (PW/CW spectral Doppler + colour Doppler regurgitant-area screen).

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.

Spectral input: `spec` shaped (n_velocity_bins, n_time_cols), magnitude; `velocities_cm_s` per row (signed,
positive = toward the transducer); `fs_cols` columns/sec. ECG R-peak times gate each beat.

Per valve we compute from the envelope v(t):
    Vmax (m/s), peak gradient dP = 4 * Vmax^2 (mmHg, simplified Bernoulli), mean gradient over ejection,
    VTI (cm) = integral of |v| dt over the flow window.
Mitral inflow: E and A peaks (E in first 60% of diastole, A after the P-wave window), E/A, E deceleration time.
Aortic: AV Vmax, mean gradient, AVA (cm^2) by continuity = (CSA_LVOT * VTI_LVOT) / VTI_AV when LVOT data given.
Regurgitation screen:
    - spectral: reverse-direction flow with |v| > 2.0 m/s during the wrong phase (systole for MR across mitral;
      diastole for AR across aortic) -> jet detected, plus pressure-half-time for AR severity.
    - colour: regurgitant-jet area / atrial area ratio (jet mask supplied by colour-Doppler pipeline).
Stenosis grading (ASE 2017, simplified):
    AS: Vmax >= 4.0 m/s or mean dP >= 40 mmHg or AVA <= 1.0 cm^2 -> severe; Vmax 3-3.9 -> moderate; 2.6-2.9 -> mild.
    MS: mean gradient >= 10 severe, 5-10 moderate (<5 mild) at HR 60-80.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy import ndimage


@dataclass
class ValveDoppler:
    valve: str                        # "aortic" | "mitral" | "tricuspid" | "pulmonic"
    vmax_m_s: float
    peak_gradient_mmHg: float
    mean_gradient_mmHg: float
    vti_cm: float
    e_m_s: float = np.nan             # mitral/tricuspid only
    a_m_s: float = np.nan
    e_a_ratio: float = np.nan
    decel_time_ms: float = np.nan
    regurg_detected: bool = False
    regurg_vmax_m_s: float = np.nan
    regurg_pht_ms: float = np.nan     # pressure half-time (AR / MS)
    regurg_jet_area_ratio: float = np.nan
    stenosis_grade: str = "none"
    regurg_grade: str = "none"
    n_beats: int = 0
    flags: list[str] = field(default_factory=list)


@dataclass
class DopplerResult:
    valves: dict[str, ValveDoppler]
    ava_cm2: float = np.nan
    flags: list[str] = field(default_factory=list)


def spectral_envelope(spec: np.ndarray, velocities_cm_s: np.ndarray, direction: int, frac: float = 0.15) -> np.ndarray:
    """Max-velocity envelope (cm/s) per column on one side of baseline. direction=+1 toward, -1 away.

    Envelope = outermost velocity bin whose power exceeds max(`frac` x column peak, 3 x global noise floor),
    where the noise floor is estimated from the outermost 20% of velocity bins (rarely contain true flow).
    """
    spec = ndimage.gaussian_filter(np.asarray(spec, float), sigma=(1.0, 0.5))
    v = np.asarray(velocities_cm_s, float)
    side = (v > 0) if direction > 0 else (v < 0)
    env = np.zeros(spec.shape[1])
    if not side.any():
        return env
    edge = np.abs(v) >= np.percentile(np.abs(v), 80)
    noise = float(np.percentile(spec[edge], 95)) if edge.any() else 0.0
    rows = np.nonzero(side)[0]
    sub = spec[rows]
    order = np.argsort(np.abs(v[rows]))[::-1]  # from outermost (highest |v|) inward
    for t in range(spec.shape[1]):
        col = sub[:, t]
        pk = col.max()
        if pk <= 0:
            continue
        thr = max(frac * pk, 1.5 * noise)
        for k in order:
            if col[k] >= thr:
                env[t] = abs(v[rows][k])
                break
    return env


def _beat_windows(r_times: np.ndarray, fs_cols: float, n_cols: int, t0: float = 0.0):
    out = []
    for i in range(len(r_times) - 1):
        a, b = int((r_times[i] - t0) * fs_cols), int((r_times[i + 1] - t0) * fs_cols)
        if 0 <= a < b <= n_cols and (b - a) > int(0.3 * fs_cols):
            out.append((a, b))
    return out


def _pht_ms(env_cm_s: np.ndarray, fs_cols: float) -> float:
    """Pressure half-time: time for the peak velocity to fall to peak/sqrt(2), fitted on a linear slope."""
    if len(env_cm_s) < 3 or env_cm_s.max() <= 0:
        return np.nan
    ip = int(np.argmax(env_cm_s))
    target = env_cm_s[ip] / np.sqrt(2.0)
    seg = env_cm_s[ip:]
    below = np.nonzero(seg <= target)[0]
    if len(below) == 0:
        # extrapolate linear fit of the deceleration
        t = np.arange(len(seg)) / fs_cols
        if len(seg) < 3:
            return np.nan
        slope = np.polyfit(t, seg, 1)[0]
        return np.nan if slope >= 0 else 1000.0 * (env_cm_s[ip] - target) / (-slope)
    return 1000.0 * below[0] / fs_cols


def analyze_aortic(spec, velocities, fs_cols, r_times, t0=0.0, forward_dir=-1) -> ValveDoppler:
    """Apical-5C / PLAX aortic PW/CW. Forward (ejection) flow is away from an apical transducer (dir -1)."""
    fwd = spectral_envelope(spec, velocities, forward_dir)
    rev = spectral_envelope(spec, velocities, -forward_dir)
    vmax, mean_g, vti, ar_v, ar_pht, n = [], [], [], [], [], 0
    for a, b in _beat_windows(np.asarray(r_times, float), fs_cols, spec.shape[1], t0):
        sys_a, sys_b = a + int(0.05 * fs_cols), a + int(min(0.45, 0.55 * (b - a) / fs_cols) * fs_cols)
        e = fwd[sys_a:sys_b] / 100.0  # m/s
        if len(e) == 0 or e.max() < 0.3:
            continue
        flow = e > 0.25 * e.max()
        vmax.append(e.max())
        mean_g.append(np.mean(4.0 * e[flow] ** 2))
        vti.append(100.0 * np.sum(e[flow]) / fs_cols)  # cm
        # AR: reverse flow during diastole
        dia = rev[sys_b:b] / 100.0
        if len(dia) and dia.max() > 2.0:
            ar_v.append(dia.max())
            ar_pht.append(_pht_ms(rev[sys_b:b], fs_cols))
        n += 1
    res = ValveDoppler("aortic", np.nan, np.nan, np.nan, np.nan, n_beats=n)
    if n == 0:
        res.flags.append("no_ejection_signal")
        return res
    res.vmax_m_s = float(np.median(vmax))
    res.peak_gradient_mmHg = 4.0 * res.vmax_m_s ** 2
    res.mean_gradient_mmHg = float(np.median(mean_g))
    res.vti_cm = float(np.median(vti))
    if res.vmax_m_s >= 4.0 or res.mean_gradient_mmHg >= 40:
        res.stenosis_grade = "severe"
    elif res.vmax_m_s >= 3.0:
        res.stenosis_grade = "moderate"
    elif res.vmax_m_s >= 2.6:
        res.stenosis_grade = "mild"
    if len(ar_v) >= max(1, n // 3):
        res.regurg_detected = True
        res.regurg_vmax_m_s = float(np.median(ar_v))
        pht = float(np.nanmedian(ar_pht)) if np.isfinite(ar_pht).any() else np.nan
        res.regurg_pht_ms = pht
        res.regurg_grade = "severe" if pht < 200 else "moderate" if pht < 500 else "mild"
        res.flags.append("aortic_regurgitation")
    return res


def analyze_mitral(spec, velocities, fs_cols, r_times, t0=0.0, inflow_dir=+1) -> ValveDoppler:
    """Apical-4C mitral inflow PW (toward transducer, dir +1); MR = reverse jet in systole."""
    inflow = spectral_envelope(spec, velocities, inflow_dir)
    rev = spectral_envelope(spec, velocities, -inflow_dir)
    E, A, EA, DT, mg, vti, mr_v, pht, n = [], [], [], [], [], [], [], [], 0
    for a, b in _beat_windows(np.asarray(r_times, float), fs_cols, spec.shape[1], t0):
        rr = (b - a) / fs_cols
        sys_end = a + int(min(0.45, 0.50 * rr) * fs_cols)
        dia = inflow[sys_end:b] / 100.0
        if len(dia) < 5 or dia.max() < 0.3:
            continue
        nd = len(dia)
        e_win = dia[: int(0.6 * nd)]
        a_win = dia[int(0.6 * nd) :]
        e_i = int(np.argmax(e_win)); e_v = float(e_win[e_i])
        a_v = float(a_win.max()) if len(a_win) else np.nan
        E.append(e_v); A.append(a_v)
        if np.isfinite(a_v) and a_v > 0.1:
            EA.append(e_v / a_v)
        # deceleration time: from E peak to baseline extrapolation
        post = e_win[e_i:]
        if len(post) > 3:
            k = min(len(post), int(0.12 * fs_cols))
            t = np.arange(k) / fs_cols
            slope = np.polyfit(t, post[:k], 1)[0]
            if slope < 0:
                DT.append(1000.0 * e_v / (-slope))
        flow = dia > 0.25 * dia.max()
        mg.append(np.mean(4.0 * dia[flow] ** 2))
        vti.append(100.0 * np.sum(dia[flow]) / fs_cols)
        pht.append(_pht_ms(inflow[sys_end:b], fs_cols))
        sysj = rev[a + int(0.03 * fs_cols) : sys_end] / 100.0
        if len(sysj) and sysj.max() > 2.0:
            mr_v.append(sysj.max())
        n += 1
    res = ValveDoppler("mitral", np.nan, np.nan, np.nan, np.nan, n_beats=n)
    if n == 0:
        res.flags.append("no_inflow_signal")
        return res
    res.e_m_s, res.a_m_s = float(np.median(E)), float(np.nanmedian(A))
    res.e_a_ratio = float(np.median(EA)) if EA else np.nan
    res.decel_time_ms = float(np.median(DT)) if DT else np.nan
    res.vmax_m_s = res.e_m_s
    res.peak_gradient_mmHg = 4.0 * res.vmax_m_s ** 2
    res.mean_gradient_mmHg = float(np.median(mg))
    res.vti_cm = float(np.median(vti))
    p = float(np.nanmedian(pht)) if np.isfinite(pht).any() else np.nan
    if res.mean_gradient_mmHg >= 10 or (np.isfinite(p) and p >= 220):
        res.stenosis_grade = "severe"
    elif res.mean_gradient_mmHg >= 5:
        res.stenosis_grade = "moderate"
    elif np.isfinite(p) and p > 130:
        res.stenosis_grade = "mild"
    if len(mr_v) >= max(1, n // 3):
        res.regurg_detected = True
        res.regurg_vmax_m_s = float(np.median(mr_v))
        res.regurg_grade = "indeterminate"  # needs colour-jet area / PISA for grading
        res.flags.append("mitral_regurgitation")
    if np.isfinite(res.e_a_ratio):
        if res.e_a_ratio < 0.8 and res.decel_time_ms > 200:
            res.flags.append("grade1_diastolic_dysfunction_pattern")
        elif res.e_a_ratio > 2.0 and res.decel_time_ms < 160:
            res.flags.append("restrictive_filling_pattern")
    return res


def grade_regurg_by_jet_area(jet_mask: np.ndarray, chamber_mask: np.ndarray) -> tuple[float, str]:
    """Colour Doppler: regurgitant jet area / receiving-chamber area. <20% mild, 20-40% moderate, >40% severe."""
    ja, ca = float(jet_mask.sum()), float(chamber_mask.sum())
    if ca <= 0:
        return np.nan, "none"
    r = ja / ca
    return r, "severe" if r > 0.40 else "moderate" if r > 0.20 else "mild" if r > 0.0 else "none"


def analyze_doppler(
    r_times: np.ndarray,
    fs_cols: float,
    aortic_spec: np.ndarray | None = None,
    mitral_spec: np.ndarray | None = None,
    velocities_cm_s: np.ndarray | None = None,
    t0: float = 0.0,
    lvot_diameter_mm: float | None = None,
    lvot_vti_cm: float | None = None,
    mr_jet_mask: np.ndarray | None = None,
    la_mask: np.ndarray | None = None,
    ar_jet_mask: np.ndarray | None = None,
    lvot_mask: np.ndarray | None = None,
) -> DopplerResult:
    valves: dict[str, ValveDoppler] = {}
    flags: list[str] = []
    if aortic_spec is not None:
        valves["aortic"] = analyze_aortic(aortic_spec, velocities_cm_s, fs_cols, r_times, t0)
        if ar_jet_mask is not None and lvot_mask is not None:
            r, g = grade_regurg_by_jet_area(ar_jet_mask, lvot_mask)
            valves["aortic"].regurg_jet_area_ratio = r
            if valves["aortic"].regurg_detected or r > 0.05:
                valves["aortic"].regurg_detected = True
                valves["aortic"].regurg_grade = g
    if mitral_spec is not None:
        valves["mitral"] = analyze_mitral(mitral_spec, velocities_cm_s, fs_cols, r_times, t0)
        if mr_jet_mask is not None and la_mask is not None:
            r, g = grade_regurg_by_jet_area(mr_jet_mask, la_mask)
            valves["mitral"].regurg_jet_area_ratio = r
            if valves["mitral"].regurg_detected or r > 0.05:
                valves["mitral"].regurg_detected = True
                valves["mitral"].regurg_grade = g
    ava = np.nan
    if "aortic" in valves and lvot_diameter_mm and lvot_vti_cm and np.isfinite(valves["aortic"].vti_cm) and valves["aortic"].vti_cm > 0:
        csa = np.pi * (lvot_diameter_mm / 20.0) ** 2  # cm^2
        ava = csa * lvot_vti_cm / valves["aortic"].vti_cm
        if ava <= 1.0:
            valves["aortic"].stenosis_grade = "severe"
            flags.append("ava_severe")
    for v in valves.values():
        flags.extend(v.flags)
    return DopplerResult(valves, float(ava), flags)
