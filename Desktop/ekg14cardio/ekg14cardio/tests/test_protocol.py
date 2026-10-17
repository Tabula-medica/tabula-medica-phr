"""Protocol decode tests for DHB1 (legacy) and DHB2 (multi-profile) packet formats.

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.
"""
from __future__ import annotations

import struct
import zlib
from typing import List

import numpy as np
import pytest

from ekg14cardio.protocol import (
    CaptureSession,
    DHBDecodeError,
    DHBSessionError,
    _PROFILES_BY_CODE,
    _SAMPLE_RATE_HZ,
    decode_packet,
    decode_session,
    derive_leads,
    profile_by_code,
)

# ---------------------------------------------------------------------------
# Packet builder helpers
# ---------------------------------------------------------------------------

def _crc32(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def _build_packet(
    *,
    profile_code: int,
    sequence: int,
    frames: List[List[int]],
    lead_off: int = 0,
    first_sample: int | None = None,
) -> bytes:
    """Encode one valid DHB1/DHB2 packet for testing."""
    prof = profile_by_code(profile_code)
    ch = len(prof.channels)
    fc = len(frames)
    assert all(len(f) == ch for f in frames), "frame channel count mismatch"

    is_legacy = profile_code == 0
    magic4 = b"1" if is_legacy else b"2"
    version = 1 if is_legacy else 2
    if first_sample is None:
        first_sample = sequence * fc

    header = (
        b"DHB"
        + magic4
        + bytes([version, ch])
        + struct.pack("<I", sequence)
        + struct.pack("<Q", first_sample)
        + struct.pack("<H", _SAMPLE_RATE_HZ)
        + struct.pack("<H", fc)
        + struct.pack("<H", lead_off)
        + struct.pack("<H", profile_code)
    )
    assert len(header) == 26

    payload = bytearray()
    for frame in frames:
        for val in frame:
            b = val & 0xFFFFFF
            payload += bytes([b & 0xFF, (b >> 8) & 0xFF, (b >> 16) & 0xFF])

    body = header + bytes(payload)
    crc = struct.pack("<I", _crc32(body))
    return body + crc


def _make_session_packets(
    *,
    profile_code: int,
    channels: np.ndarray,  # shape (n_ch, 10000)
    lead_off: int = 0,
) -> List[bytes]:
    """Encode 10 000 samples (2000 pkts × 5 frames) into a DHB packet stream."""
    n_ch, n_samp = channels.shape
    assert n_samp == 10_000
    pkts: List[bytes] = []
    for seq in range(2000):
        frames = []
        for fi in range(5):
            col = seq * 5 + fi
            frames.append([int(channels[ci, col]) for ci in range(n_ch)])
        pkts.append(_build_packet(
            profile_code=profile_code,
            sequence=seq,
            frames=frames,
            lead_off=lead_off,
        ))
    return pkts


def _synthetic_ecg_channel(n: int, hr_bpm: float, seed: int = 0) -> np.ndarray:
    """Return a 1-D numpy int32 ECG-like signal with PQRST at the given rate.

    Amplitudes (µV): R=800, Q=-150, S=-200, P=100, T=290.  The T-wave is
    placed at 0.35×RR after the R-peak so it is always inside the RR interval.
    """
    rng = np.random.default_rng(seed)
    sig = np.zeros(n, dtype=np.float64)
    rr = _SAMPLE_RATE_HZ / hr_bpm  # samples per beat

    # Wave offsets relative to R (samples), scaled to current RR
    def _gauss(center: float, amp: float, width: float, arr: np.ndarray) -> None:
        t = np.arange(n)
        for r_idx in np.arange(rr / 2, n, rr):
            c = r_idx + center
            arr += amp * np.exp(-0.5 * ((t - c) / width) ** 2)

    _gauss(-0.065 * rr, 100,   0.025 * rr, sig)   # P
    _gauss(-0.015 * rr, -150,  0.010 * rr, sig)   # Q
    _gauss( 0.0,         800,  0.012 * rr, sig)   # R
    _gauss( 0.020 * rr, -200,  0.012 * rr, sig)   # S
    _gauss( 0.350 * rr,  290,  0.040 * rr, sig)   # T  ← scales with RR

    sig += rng.normal(0, 5, n)
    return sig.astype(np.int32)


# ---------------------------------------------------------------------------
# Single-packet decode tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("profile_code", [0, 1, 2, 3, 4])
def test_decode_single_packet_all_profiles(profile_code: int) -> None:
    prof = profile_by_code(profile_code)
    ch = len(prof.channels)
    frames = [[i * 100 + ci * 10 for ci in range(ch)] for i in range(5)]
    pkt = _build_packet(profile_code=profile_code, sequence=0, frames=frames)
    result = decode_packet(pkt)
    assert result.sequence == 0
    assert result.profile_id == prof.id
    assert len(result.frames) == 5
    for fi, frame in enumerate(result.frames):
        assert frame == frames[fi]


def test_decode_packet_crc_failure() -> None:
    pkt = bytearray(_build_packet(profile_code=2, sequence=0,
                                   frames=[[100 * ci for ci in range(10)]] * 5))
    pkt[-2] ^= 0xFF  # corrupt one byte
    with pytest.raises(DHBDecodeError, match="CRC"):
        decode_packet(bytes(pkt))


def test_decode_packet_wrong_magic() -> None:
    prof = profile_by_code(2)
    frames = [[100] * 10] * 5
    pkt = bytearray(_build_packet(profile_code=2, sequence=0, frames=frames))
    pkt[0] = ord("X")  # break magic
    body = bytes(pkt[:-4])
    crc = struct.pack("<I", _crc32(body))
    with pytest.raises(DHBDecodeError, match="magic"):
        decode_packet(body + crc)


def test_decode_packet_signed_24bit_roundtrip() -> None:
    """Verify negative and large positive values survive encode→decode."""
    ch = 10
    vals = [-8_000_000, -1, 0, 1, 7_999_999]
    frame = vals[:ch] + [0] * (ch - len(vals))
    pkt = _build_packet(profile_code=2, sequence=0, frames=[frame] * 5)
    result = decode_packet(pkt)
    for decoded_val, original_val in zip(result.frames[0], frame):
        assert decoded_val == original_val


# ---------------------------------------------------------------------------
# Session decode tests
# ---------------------------------------------------------------------------

def _clean_session(profile_code: int) -> CaptureSession:
    prof = profile_by_code(profile_code)
    ch = len(prof.channels)
    rng = np.random.default_rng(42)
    channels = rng.integers(-5000, 5000, size=(ch, 10_000), dtype=np.int32)
    pkts = _make_session_packets(profile_code=profile_code, channels=channels)
    return decode_session(pkts, session_id="test", started_at="2026-10-17T00:00:00Z")


@pytest.mark.parametrize("profile_code", [0, 1, 2, 3, 4])
def test_session_decode_all_profiles(profile_code: int) -> None:
    prof = profile_by_code(profile_code)
    sess = _clean_session(profile_code)
    assert sess.profile_id == prof.id
    assert sess.lead_waveforms.shape == (len(prof.leads), 10_000)
    assert sess.channel_waveforms.shape == (len(prof.channels), 10_000)


def test_session_lead_derivation_right14() -> None:
    """III/aVR/aVL/aVF must satisfy Goldberger/Einthoven relations."""
    prof = profile_by_code(2)
    rng = np.random.default_rng(7)
    channels = rng.integers(-3000, 3000, size=(10, 10_000), dtype=np.int32)
    pkts = _make_session_packets(profile_code=2, channels=channels)
    sess = decode_session(pkts)
    leads = sess.lead_waveforms
    i_ch, ii_ch = leads[0].astype(np.int64), leads[1].astype(np.int64)
    # III = II - I
    np.testing.assert_array_equal(leads[2], (ii_ch - i_ch).astype(np.int32))
    # aVL = I - II/2
    np.testing.assert_array_equal(leads[4], (i_ch - ii_ch // 2).astype(np.int32))


def test_session_sequence_discontinuity() -> None:
    prof = profile_by_code(2)
    ch = len(prof.channels)
    frames = [[100] * ch] * 5
    pkts = [_build_packet(profile_code=2, sequence=i, frames=frames) for i in range(2000)]
    # Swap two packets to break sequence continuity
    pkts[500], pkts[501] = pkts[501], pkts[500]
    with pytest.raises(DHBSessionError, match="sequence"):
        decode_session(pkts)


def test_session_lead_off_rejected() -> None:
    prof = profile_by_code(2)
    ch = len(prof.channels)
    pkts = [
        _build_packet(profile_code=2, sequence=i,
                      frames=[[0] * ch] * 5,
                      lead_off=0x0001 if i == 100 else 0)
        for i in range(2000)
    ]
    with pytest.raises(DHBSessionError, match="lead-off"):
        decode_session(pkts)


def test_session_lead_off_allowed() -> None:
    prof = profile_by_code(2)
    ch = len(prof.channels)
    rng = np.random.default_rng(1)
    channels = rng.integers(-5000, 5000, size=(ch, 10_000), dtype=np.int32)
    pkts = _make_session_packets(profile_code=2, channels=channels)
    # Inject a lead-off mask on one packet
    pkt_bytes = bytearray(pkts[100])
    struct.pack_into("<H", pkt_bytes, 22, 0x0002)
    body = bytes(pkt_bytes[:-4])
    pkts[100] = body + struct.pack("<I", _crc32(body))
    sess = decode_session(pkts, allow_lead_off=True)
    assert sess is not None


def test_session_mixed_profiles_rejected() -> None:
    prof2 = profile_by_code(2)
    prof3 = profile_by_code(3)
    ch2, ch3 = len(prof2.channels), len(prof3.channels)
    pkts2 = [_build_packet(profile_code=2, sequence=i, frames=[[0] * ch2] * 5)
             for i in range(2000)]
    pkts3 = [_build_packet(profile_code=3, sequence=i, frames=[[0] * ch3] * 5)
             for i in range(2000)]
    mixed = pkts2[:1000] + pkts3[1000:]
    with pytest.raises(DHBSessionError, match="mixed profiles"):
        decode_session(mixed)


def test_session_flat_channel_flagged() -> None:
    ch = len(profile_by_code(2).channels)
    channels = np.zeros((ch, 10_000), dtype=np.int32)
    channels[0] = 1000  # lead I has some range
    channels[1] = 500   # lead II has some range
    pkts = _make_session_packets(profile_code=2, channels=channels)
    sess = decode_session(pkts, allow_lead_off=True)
    # V-channels are flat (range < 10 LSB) → should be flagged
    assert any("flat_channel" in f for f in sess.flags)


# ---------------------------------------------------------------------------
# T-wave preservation at different heart rates
# ---------------------------------------------------------------------------

_T_WAVE_MIN_AMP_UV = 150  # minimum acceptable T-wave amplitude after decode


@pytest.mark.parametrize("hr_bpm", [60, 100, 140])
def test_t_wave_preserved_right14(hr_bpm: float) -> None:
    """T-wave amplitude on lead II survives DHB2 encode→decode at 60/100/140 bpm."""
    ch = len(profile_by_code(2).channels)
    channels = np.zeros((ch, 10_000), dtype=np.int32)
    # Lead I (ch0) and II (ch1) carry a realistic ECG signal
    channels[0] = _synthetic_ecg_channel(10_000, hr_bpm, seed=0)
    channels[1] = _synthetic_ecg_channel(10_000, hr_bpm, seed=1)
    for ci in range(2, ch):
        channels[ci] = _synthetic_ecg_channel(10_000, hr_bpm, seed=ci + 2) // 2

    pkts = _make_session_packets(profile_code=2, channels=channels)
    sess = decode_session(pkts)

    rr_samples = int(_SAMPLE_RATE_HZ / hr_bpm * 60)
    ii = sess.lead_waveforms[1].astype(np.float64)

    # Identify a clean beat window: skip first RR, look at second beat
    r_approx = rr_samples // 2
    t_start = r_approx + int(0.20 * rr_samples)
    t_end   = r_approx + int(0.55 * rr_samples)
    t_peak = float(ii[t_start:t_end].max())

    assert t_peak > _T_WAVE_MIN_AMP_UV, (
        f"T-wave peak {t_peak:.0f} µV too small at {hr_bpm} bpm "
        f"(expected > {_T_WAVE_MIN_AMP_UV} µV)"
    )


@pytest.mark.parametrize("hr_bpm", [60, 100, 140])
@pytest.mark.parametrize("profile_code", [1, 2, 3, 4])
def test_t_wave_preserved_all_profiles(hr_bpm: float, profile_code: int) -> None:
    """T-wave preserved across all DHB2 profiles at each test BPM."""
    ch = len(profile_by_code(profile_code).channels)
    channels = np.zeros((ch, 10_000), dtype=np.int32)
    channels[0] = _synthetic_ecg_channel(10_000, hr_bpm, seed=0)
    channels[1] = _synthetic_ecg_channel(10_000, hr_bpm, seed=1)
    for ci in range(2, ch):
        channels[ci] = _synthetic_ecg_channel(10_000, hr_bpm, seed=ci + 2) // 2

    pkts = _make_session_packets(profile_code=profile_code, channels=channels)
    sess = decode_session(pkts)

    rr_samples = int(_SAMPLE_RATE_HZ / hr_bpm * 60)
    ii = sess.lead_waveforms[1].astype(np.float64)
    r_approx = rr_samples // 2
    t_peak = float(ii[r_approx + int(0.20 * rr_samples):
                      r_approx + int(0.55 * rr_samples)].max())

    assert t_peak > _T_WAVE_MIN_AMP_UV, (
        f"Profile {sess.profile_id}: T-wave {t_peak:.0f} µV at {hr_bpm} bpm "
        f"(expected > {_T_WAVE_MIN_AMP_UV} µV)"
    )


# ---------------------------------------------------------------------------
# derive_leads scalar API
# ---------------------------------------------------------------------------

def test_derive_leads_goldberger() -> None:
    i, ii = 100.0, 60.0
    ch = [i, ii] + [10.0 * k for k in range(1, 9)]  # 10 channels
    leads = derive_leads(ch, "legacy14")
    assert leads[0] == pytest.approx(i)
    assert leads[1] == pytest.approx(ii)
    assert leads[2] == pytest.approx(ii - i)           # III
    assert leads[3] == pytest.approx(-(i + ii) / 2)   # aVR
    assert leads[4] == pytest.approx(i - ii / 2)      # aVL
    assert leads[5] == pytest.approx(ii - i / 2)      # aVF
    # V passthrough
    for k in range(6, len(leads)):
        assert leads[k] == ch[k - 4], f"lead index {k}"
