"""ekg14cardio FHIR service — Cloud Run compatible.

POST /analyze  : .npz upload → FHIR R4 transaction bundle
GET  /demo     : synthetic case → FHIR R4 transaction bundle  (?ef=60&hr=72&mr_jet=false&ar_jet=false)
GET  /health   : liveness probe

HIPAA posture: no waveform data, patient IDs, or PHI is written to any log.
Log lines contain only job IDs (UUID) and timing.
"""
from __future__ import annotations

import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone

import numpy as np
from fastapi import FastAPI, Form, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from ekg14cardio.synth import make_case
from ekg14cardio.cli import run_pipeline, _report_from_dict
from ekg14cardio.fhir import report_to_bundle

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=_LOG_LEVEL, format="%(levelname)s %(message)s")
log = logging.getLogger("ekg14svc")

app = FastAPI(title="ekg14cardio FHIR service", version="0.1.0")


def _bundle_response(report_dict: dict, narrative: str, patient_id: str, device_id: str) -> JSONResponse:
    rep = _report_from_dict(report_dict)
    bundle = report_to_bundle(
        rep,
        patient_id=patient_id,
        device_id=device_id,
        when=datetime.now(timezone.utc),
        narrative=narrative or report_dict.get("narrative", {}).get("text"),
    )
    return JSONResponse(content=bundle, media_type="application/fhir+json")


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/demo")
def demo(
    ef: float = 60.0,
    hr: float = 72.0,
    mr_jet: bool = False,
    ar_jet: bool = False,
    use_llm: bool = True,
    patient_id: str = "demo-patient",
    device_id: str = "ekg14-cardio",
):
    job = str(uuid.uuid4())[:8]
    log.info("demo job=%s ef=%.0f hr=%.0f mr=%s ar=%s", job, ef, hr, mr_jet, ar_jet)
    case = make_case(hr_bpm=hr, ef_pct=ef, mr_jet=mr_jet, ar_jet=ar_jet)
    d = {
        "ecg": case.ecg,            "fs_ecg": case.fs_ecg,
        "scg": case.scg,            "fs_scg": case.fs_scg,
        "pcg": case.pcg,            "fs_pcg": case.fs_pcg,
        "mmode": case.mmode,        "mmode_mm_per_px": case.mmode_mm_per_px,
        "mmode_fs_cols": case.mmode_fs_cols,
        "a4c": case.a4c,            "a2c": case.a2c,
        "frame_times_s": case.frame_times_s,
        "bmode_mm_per_px": case.bmode_mm_per_px,
        "aortic_spec": case.aortic_spec,
        "mitral_spec": case.mitral_spec,
        "velocities_cm_s": case.velocities_cm_s,
        "doppler_fs_cols": case.doppler_fs_cols,
    }
    report_dict, narrative = run_pipeline(d, use_llm=use_llm)
    log.info("demo job=%s done ef_cat=%s needs_review=%s", job, report_dict.get("ef_category"), report_dict.get("needs_review"))
    return _bundle_response(report_dict, narrative, patient_id, device_id)


@app.post("/analyze")
async def analyze(
    npz_file: UploadFile = File(...),
    patient_id: str = Form(...),
    device_id: str = Form("ekg14-cardio"),
    use_llm: bool = Form(True),
):
    if not npz_file.filename or not npz_file.filename.endswith(".npz"):
        raise HTTPException(status_code=400, detail="npz_file must be a .npz file")

    job = str(uuid.uuid4())[:8]
    log.info("analyze job=%s device=%s", job, device_id)  # patient_id never logged

    raw = await npz_file.read()
    if len(raw) > 200 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 200 MB)")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".npz", delete=False) as tmp:
            tmp.write(raw)
            tmp_path = tmp.name
        data = dict(np.load(tmp_path, allow_pickle=False))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read .npz: {exc}") from exc
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    report_dict, narrative = run_pipeline(data, use_llm=use_llm)
    log.info("analyze job=%s done ef_cat=%s needs_review=%s", job, report_dict.get("ef_category"), report_dict.get("needs_review"))
    return _bundle_response(report_dict, narrative, patient_id, device_id)
