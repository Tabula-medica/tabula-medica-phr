"""DHB wire-protocol parser for the DextroHeart acquisition bench.

# IEC 62304 Class B — ekg14cardio v0.1.0 (Tabula Medica LLC)
# Measurement function only; no automated clinical decision.

Supports both protocol generations:

  DHB1 / dextroheart.capture/1 (legacy)
    Magic: 'DHB1', version=1, channel_count=10, profile_code=0 (at offset 24)
    Layout matches the original 14-lead device (I, II, V1-V6, V4R, V8)

  DHB2 / dextroheart.capture/2 (current, Bench ≥ 0.2)
    Magic: 'DHB2', version=2, profile_code at offset 24 selects the lead map

Packet layout (offsets in bytes):
  0       4     Magic ('DHB1' or 'DHB2')
  4       1     Protocol version (1 or 2)
  5       1     Channel count (profile-dependent)
  6       4     Sequence number (uint32 LE)
  10      8     Absolute sample clock (uint64 LE, total samples from session start)
  18      2     Sample rate Hz (uint16 LE, must be 1000)
  20      2     Frames per packet (uint16 LE, 1–5)
  22      2     Electrode lead-off bitmask (uint16 LE)
  24      2     Profile code (uint16 LE): 0=legacy14, 1=standard12, 2=right14,
                  3=posterior15, 4=combined17
  26      N     Frame payload: frames × channels × 3-byte signed 24-bit LE integers
  26+N    4     CRC-32 (ISO 3309, 0xEDB88320) of all preceding bytes

Derived leads for all profiles (Goldberger/Einthoven):
  III = II - I
  aVR = -(I + II) / 2
  aVL = I - II / 2
  aVF = II - I / 2
"""
from __future__ import annotations

import struct
import zlib
from dataclasses import dataclass, field
from typing import Dict, List, Sequence, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Lead / profile tables (mirrors DH_PROFILES in the bench HTML)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _Profile:
    code: int
    id: str
    channels: Tuple[str, ...]  # acquisition channel names in order
    leads: Tuple[str, ...]     # displayed lead names in order

_PROFILES_BY_CODE: Dict[int, _Profile] = {
    0: _Profile(0, "legacy14",  ("I","II","V1","V2","V3","V4","V5","V6","V4R","V8"),
                                 ("I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6","V4R","V8")),
    1: _Profile(1, "standard12",("I","II","V1","V2","V3","V4","V5","V6"),
                                 ("I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6")),
    2: _Profile(2, "right14",   ("I","II","V1","V2","V3","V4","V5","V6","V3R","V4R"),
                                 ("I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6","V3R","V4R")),
    3: _Profile(3, "posterior15",("I","II","V1","V2","V3","V4","V5","V6","V7","V8","V9"),
                                 ("I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6","V7","V8","V9")),
    4: _Profile(4, "combined17", ("I","II","V1","V2","V3","V4","V5","V6","V3R","V4R","V7","V8","V9"),
                                 ("I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6","V3R","V4R","V7","V8","V9")),
}
_PROFILES_BY_ID: Dict[str, _Profile] = {p.id: p for p in _PROFILES_BY_CODE.values()}

_SAMPLE_RATE_HZ = 1000

# Convenience aliases for the legacy default
CHANNEL_ORDER = _PROFILES_BY_CODE[0].channels
LEAD_ORDER    = _PROFILES_BY_CODE[0].leads


def profile_by_code(code: int) -> _Profile:
    if code not in _PROFILES_BY_CODE:
        raise DHBDecodeError(f"unknown profile code {code}")
    return _PROFILES_BY_CODE[code]


def profile_by_id(pid: str) -> _Profile:
    if pid not in _PROFILES_BY_ID:
        raise DHBDecodeError(f"unknown profile id {pid!r}")
    return _PROFILES_BY_ID[pid]


# ---------------------------------------------------------------------------
# Packet decode
# ---------------------------------------------------------------------------

@dataclass
class DHBPacket:
    sequence: int
    first_sample: int           # absolute sample clock
    frames: List[List[int]]     # list of frames; each frame = list of channel ints (µV)
    lead_off: int               # electrode lead-off bitmask
    profile_id: str = "legacy14"


class DHBDecodeError(ValueError):
    """Raised when a DHB packet fails structural or CRC validation."""


def _crc32(data: bytes | bytearray) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


def decode_packet(buf: bytes | bytearray) -> DHBPacket:
    """Parse and validate one DHB1 or DHB2 binary packet.

    Raises DHBDecodeError on any structural or CRC violation.
    """
    if not isinstance(buf, (bytes, bytearray)):
        raise DHBDecodeError("packet must be bytes or bytearray")
    n = len(buf)
    if n < 34 or n > 225:
        raise DHBDecodeError(f"invalid packet length {n}: expected 34–225")

    expected_crc = struct.unpack_from("<I", buf, n - 4)[0]
    actual_crc = _crc32(buf[: n - 4])
    if expected_crc != actual_crc:
        raise DHBDecodeError(f"CRC mismatch: expected {expected_crc:#010x} got {actual_crc:#010x}")

    # Magic and version
    if buf[0:3] != b"DHB":
        raise DHBDecodeError(f"bad magic prefix {buf[0:3]!r}")
    magic4 = chr(buf[3])
    version = buf[4]

    profile_code = struct.unpack_from("<H", buf, 24)[0]

    if magic4 == "1" and version == 1 and profile_code == 0:
        # DHB1 legacy packet
        pass
    elif magic4 == "2" and version == 2 and 1 <= profile_code <= 4:
        # DHB2 current packet
        pass
    else:
        raise DHBDecodeError(
            f"unsupported protocol metadata: magic=DHB{magic4}, version={version}, "
            f"profile_code={profile_code}"
        )

    prof = profile_by_code(profile_code)
    ch = len(prof.channels)

    if buf[5] != ch:
        raise DHBDecodeError(f"channel count {buf[5]} disagrees with profile {prof.id!r} ({ch})")

    seq, = struct.unpack_from("<I", buf, 6)
    first_sample, = struct.unpack_from("<Q", buf, 10)
    sample_rate, = struct.unpack_from("<H", buf, 18)
    frame_count, = struct.unpack_from("<H", buf, 20)
    lead_off, = struct.unpack_from("<H", buf, 22)

    if sample_rate != _SAMPLE_RATE_HZ:
        raise DHBDecodeError(f"unsupported sample rate {sample_rate}")
    if not (1 <= frame_count <= 5):
        raise DHBDecodeError(f"invalid frame count {frame_count}")

    expected_len = 30 + frame_count * ch * 3
    if n != expected_len:
        raise DHBDecodeError(f"payload length mismatch: got {n}, expected {expected_len}")

    frames: List[List[int]] = []
    pos = 26
    for _ in range(frame_count):
        frame: List[int] = []
        for _ in range(ch):
            raw = buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)
            frame.append(raw - 0x1000000 if raw & 0x800000 else raw)
            pos += 3
        frames.append(frame)

    return DHBPacket(
        sequence=seq,
        first_sample=first_sample,
        frames=frames,
        lead_off=lead_off,
        profile_id=prof.id,
    )


def derive_leads(channels: Sequence[int | float], profile_id: str = "legacy14") -> Tuple[float, ...]:
    """Derive all displayed leads from acquisition channels.

    Input order: as defined in the profile's channel list.
    Output order: as defined in the profile's lead list.
    Derivation: III=II-I, aVR=-(I+II)/2, aVL=I-II/2, aVF=II-I/2 (Goldberger/Einthoven).
    """
    i, ii = float(channels[0]), float(channels[1])
    return (
        i,              # I
        ii,             # II
        ii - i,         # III
        -(i + ii) / 2,  # aVR
        i - ii / 2,     # aVL
        ii - i / 2,     # aVF
        *channels[2:],  # V-channel passthrough (profile-dependent)
    )


# ---------------------------------------------------------------------------
# Session decode
# ---------------------------------------------------------------------------

@dataclass
class CaptureSession:
    """Decoded and validated 10-second DHB acquisition session."""

    session_id: str
    started_at: str
    profile_id: str
    channel_names: Tuple[str, ...]      # acquisition channel names
    lead_names: Tuple[str, ...]         # displayed lead names
    lead_waveforms: np.ndarray          # shape (n_leads, 10000), µV, int32
    channel_waveforms: np.ndarray       # shape (n_channels, 10000), µV, int32
    heart_rate_bpm_configured: int | None = None
    flags: List[str] = field(default_factory=list)

    def to_npz_dict(self) -> dict:
        """Return a dict compatible with ekg14cardio.cli.run_pipeline().

        ECG key maps to lead_waveforms in mV (float32).
        """
        n = self.channel_waveforms.shape[1]
        return {
            "ecg": self.lead_waveforms.astype(np.float32) * 1e-3,  # µV → mV
            "fs_ecg": np.float32(_SAMPLE_RATE_HZ),
            "r_times_s": np.array([], dtype=np.float32),
            "lead_names": list(self.lead_names),
            "session_id": self.session_id,
            "started_at": self.started_at,
        }


class DHBSessionError(ValueError):
    """Raised when a session-level integrity check fails."""


def decode_session(
    packets: List[bytes | bytearray],
    *,
    session_id: str = "",
    started_at: str = "",
    heart_rate_bpm_configured: int | None = None,
    allow_lead_off: bool = False,
) -> CaptureSession:
    """Decode and validate a complete 10-second DHB capture session.

    All packets in the list must belong to the same profile.

    Args:
        packets:                    2000 raw binary packets (5 frames/packet × 1000 Hz × 10 s)
        session_id:                 opaque session identifier (not logged)
        started_at:                 ISO-8601 capture timestamp
        heart_rate_bpm_configured:  synthetic scenario BPM if available
        allow_lead_off:             if False any non-zero lead-off mask raises DHBSessionError

    Returns:
        CaptureSession with lead waveforms ready for run_pipeline()
    """
    if not packets:
        raise DHBSessionError("empty packet list")
    if len(packets) != 2000:
        raise DHBSessionError(f"incomplete capture: {len(packets)} packets, expected 2000")

    n_samples = 2000 * 5
    flags: List[str] = []
    expected_clock = 0
    profile_id: str | None = None

    # First pass: determine profile from first packet
    first_pkt = decode_packet(packets[0])
    profile_id = first_pkt.profile_id
    prof = profile_by_id(profile_id)
    ch_count = len(prof.channels)

    channels = np.zeros((ch_count, n_samples), dtype=np.int32)

    for i, raw in enumerate(packets):
        pkt = decode_packet(raw)
        if pkt.profile_id != profile_id:
            raise DHBSessionError(
                f"mixed profiles in session: packet {i} has {pkt.profile_id!r}, "
                f"expected {profile_id!r}"
            )
        if pkt.sequence != i:
            raise DHBSessionError(f"sequence discontinuity at {i}: got {pkt.sequence}")
        if pkt.first_sample != expected_clock:
            raise DHBSessionError(
                f"sample clock discontinuity at seq {i}: expected {expected_clock}, "
                f"got {pkt.first_sample}"
            )
        if pkt.lead_off and not allow_lead_off:
            raise DHBSessionError(
                f"electrode lead-off at seq {i} (mask {pkt.lead_off:#06x})"
            )
        if len(pkt.frames) != 5:
            raise DHBSessionError(f"expected 5 frames, got {len(pkt.frames)} at seq {i}")

        for fi, frame in enumerate(pkt.frames):
            col = i * 5 + fi
            for ci, val in enumerate(frame):
                if val in (-8388608, 8388607):
                    if "adc_saturation" not in flags:
                        flags.append("adc_saturation")
                channels[ci, col] = val
        expected_clock += 5

    # Flat channel check (range > 10 LSB required)
    for ci, name in enumerate(prof.channels):
        span = int(channels[ci].max()) - int(channels[ci].min())
        if span < 10:
            flag = f"flat_channel_{name}"
            if flag not in flags:
                flags.append(flag)

    # Derive leads (vectorized)
    n_leads = len(prof.leads)
    leads = np.zeros((n_leads, n_samples), dtype=np.int32)
    i_ch, ii_ch = channels[0], channels[1]
    leads[0] = i_ch
    leads[1] = ii_ch
    leads[2] = ii_ch - i_ch                         # III
    leads[3] = -(i_ch.astype(np.int64) + ii_ch.astype(np.int64)) // 2  # aVR
    leads[4] = i_ch - ii_ch // 2                    # aVL
    leads[5] = ii_ch - i_ch // 2                    # aVF
    leads[6:] = channels[2:]                         # V-channel passthrough

    return CaptureSession(
        session_id=session_id,
        started_at=started_at,
        profile_id=profile_id,
        channel_names=prof.channels,
        lead_names=prof.leads,
        lead_waveforms=leads,
        channel_waveforms=channels,
        heart_rate_bpm_configured=heart_rate_bpm_configured,
        flags=flags,
    )


def load_bench_json(capture: dict) -> CaptureSession:
    """Parse a DextroHeart bench capture JSON (schema capture/1 or capture/2).

    Bench 0.1 produces dextroheart.capture/1 (legacy14, 10 channels).
    Bench 0.2+ produces dextroheart.capture/2 (profile-aware, 8–13 channels).
    """
    import base64

    schema = capture.get("schema", "")
    if schema not in ("dextroheart.capture/1", "dextroheart.capture/2"):
        raise DHBSessionError(f"unsupported capture schema: {schema!r}")
    if capture.get("origin") != "synthetic":
        raise DHBSessionError("only synthetic bench captures are accepted by this loader")

    raw_packets = [base64.b64decode(p) for p in capture["packets"]]
    return decode_session(
        raw_packets,
        session_id=capture.get("session_id", ""),
        started_at=capture.get("started_at", ""),
        heart_rate_bpm_configured=capture.get("scenario", {}).get("heart_rate_bpm"),
    )
