#!/usr/bin/env python3
"""
Synthea Family Generator for Tabula Medica beta testing.

Generates 50 synthetic FHIR R4 patients organized into 15 families,
adds Patient.link and RelatedPerson resources for family relationships,
tags every record with the synthetic-data meta tag for production-vs-test
segregation, and outputs FHIR Bundle JSON files ready for Fasten Health
webhook ingestion.

Prerequisites:
    git clone https://github.com/synthetichealth/synthea ~/synthea
    cd ~/synthea && ./gradlew build check test  (one-time, ~3 min)

    Java 11+ required for Synthea.
    Python 3.9+ required for this script.

Usage:
    python3 synthea_family_generator.py --synthea-dir ~/synthea --out ./out

Output:
    ./out/families/
        family_001/
            01_father.json     # FHIR Bundle
            02_mother.json
            03_child_1.json
            ...
        family_002/
            ...
    ./out/manifest.json        # All families + relationships index

Demographic balance (per Beta Recruitment doc):
    - 30% under-18 (test minor accounts model)
    - 40% adult primary persona
    - 20% senior 60+ (test elderly-parent caregiver flow)
    - 10% complex multi-condition (test deduplication-heavy flow)
"""

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

# -------------------- CONFIG --------------------

TOTAL_PATIENTS = 50
TOTAL_FAMILIES = 15
SEED = 12345

SYNTHETIC_TAG = {
    "system": "https://tabulamedica.health/test-data",
    "code": "synthetic",
    "display": "Synthetic test data — Synthea-generated. NOT real PHI.",
}

# Family archetypes — distribution roughly matches demographic balance target.
FAMILY_ARCHETYPES = [
    # 5 nuclear families with minor children (tests minor accounts)
    {"father": "adult", "mother": "adult", "children": ["minor", "minor"]},
    {"father": "adult", "mother": "adult", "children": ["minor"]},
    {"father": "adult", "mother": "adult", "children": ["minor", "minor", "minor"]},
    {"father": "adult", "mother": "adult", "children": ["minor"]},
    {"father": "adult", "mother": "adult", "children": ["minor", "minor"]},
    # 3 multi-generational (tests elderly-parent caregiver flow)
    {"father": "adult", "mother": "adult", "grandparent": "senior"},
    {"father": "adult", "mother": "adult", "grandparent": "senior", "children": ["minor"]},
    {"single_parent": "adult", "grandparent": "senior", "children": ["minor", "minor"]},
    # 3 senior couples (tests senior-only caregiver scenario)
    {"husband": "senior", "wife": "senior"},
    {"husband": "senior", "wife": "senior"},
    {"husband": "senior", "wife": "senior_complex"},  # complex multi-condition
    # 2 single adults (tests individual flows)
    {"individual": "adult"},
    {"individual": "adult_complex"},  # complex multi-condition
    # 2 spouse-only (no children)
    {"husband": "adult", "wife": "adult"},
    {"husband": "adult", "wife": "adult_complex"},
]


# -------------------- SYNTHEA CONFIG --------------------

SYNTHEA_AGE_BANDS = {
    "minor": (1, 17),
    "adult": (25, 55),
    "adult_complex": (35, 60),  # multi-condition; Synthea rolls modules
    "senior": (65, 85),
    "senior_complex": (70, 92),
}


def run_synthea(
    synthea_dir: Path, count: int, seed: int, out_dir: Path, age_min: int, age_max: int
) -> List[Path]:
    """Run Synthea once for a given age band; return list of generated FHIR JSON files."""
    cmd = [
        "./run_synthea",
        "-p", str(count),
        "-s", str(seed),
        "-a", f"{age_min}-{age_max}",
        "--exporter.fhir.export", "true",
        "--exporter.hospital.fhir.export", "false",
        "--exporter.practitioner.fhir.export", "false",
        "--exporter.fhir.transaction_bundle", "true",
        "--exporter.baseDirectory", str(out_dir.resolve()),
    ]
    result = subprocess.run(
        cmd, cwd=synthea_dir, capture_output=True, text=True, timeout=600
    )
    if result.returncode != 0:
        print(f"Synthea failed (age {age_min}-{age_max}):\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    fhir_dir = out_dir / "fhir"
    return sorted(fhir_dir.glob("*.json"))


def add_synthetic_tag(bundle: Dict[str, Any]) -> None:
    """Add the synthetic-data meta tag to every resource in the bundle."""
    for entry in bundle.get("entry", []):
        resource = entry.get("resource", {})
        meta = resource.setdefault("meta", {})
        tags = meta.setdefault("tag", [])
        if not any(t.get("code") == "synthetic" for t in tags):
            tags.append(SYNTHETIC_TAG)


def find_patient_resource(bundle: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for entry in bundle.get("entry", []):
        resource = entry.get("resource", {})
        if resource.get("resourceType") == "Patient":
            return resource
    return None


def make_related_person(
    patient_id: str,
    related_to_patient_id: str,
    relationship_code: str,
    relationship_display: str,
) -> Dict[str, Any]:
    """Build a FHIR RelatedPerson resource expressing a family relationship."""
    return {
        "resourceType": "RelatedPerson",
        "id": str(uuid.uuid4()),
        "meta": {"tag": [SYNTHETIC_TAG]},
        "patient": {"reference": f"Patient/{patient_id}"},
        "relationship": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
                        "code": relationship_code,
                        "display": relationship_display,
                    }
                ]
            }
        ],
        "extension": [
            {
                "url": "https://tabulamedica.health/extension/related-patient-id",
                "valueString": related_to_patient_id,
            }
        ],
    }


# Relationship codes per HL7 v3 RoleCode
RELATIONSHIPS = {
    "spouse": ("SPS", "Spouse"),
    "parent": ("PRN", "Parent"),
    "child": ("CHILD", "Child"),
    "grandparent": ("GRPRN", "Grandparent"),
}


def link_family(patients_by_role: Dict[str, Dict[str, Any]], bundle_by_role: Dict[str, Dict[str, Any]]) -> None:
    """
    Add Patient.link and RelatedPerson resources tying family members together.
    patients_by_role maps role labels (e.g., 'father', 'mother', 'child_1') to Patient resources.
    bundle_by_role maps role labels to their FHIR Bundle.
    Mutates bundles in place.
    """
    roles = list(patients_by_role.keys())

    def add_relationship(from_role: str, to_role: str, rel_key: str):
        from_pid = patients_by_role[from_role]["id"]
        to_pid = patients_by_role[to_role]["id"]
        code, display = RELATIONSHIPS[rel_key]
        # Add Patient.link
        from_patient = patients_by_role[from_role]
        from_patient.setdefault("link", []).append({
            "other": {"reference": f"Patient/{to_pid}"},
            "type": "seealso",
        })
        # Add RelatedPerson resource to from_role's bundle
        rp = make_related_person(from_pid, to_pid, code, display)
        bundle_by_role[from_role]["entry"].append({
            "fullUrl": f"urn:uuid:{rp['id']}",
            "resource": rp,
        })

    # Spouse relationships (bidirectional)
    spouse_pairs = [("father", "mother"), ("husband", "wife")]
    for r1, r2 in spouse_pairs:
        if r1 in roles and r2 in roles:
            add_relationship(r1, r2, "spouse")
            add_relationship(r2, r1, "spouse")

    # Parent-child relationships
    parents = [r for r in roles if r in ("father", "mother", "single_parent", "husband", "wife")]
    children = [r for r in roles if r.startswith("child")]
    for parent_role in parents:
        for child_role in children:
            add_relationship(parent_role, child_role, "child")
            add_relationship(child_role, parent_role, "parent")

    # Grandparent
    if "grandparent" in roles:
        for parent_role in parents:
            add_relationship("grandparent", parent_role, "child")
            add_relationship(parent_role, "grandparent", "parent")
        for child_role in children:
            add_relationship("grandparent", child_role, "child")
            add_relationship(child_role, "grandparent", "grandparent")


def build_families(
    synthea_dir: Path, work_dir: Path, out_dir: Path
) -> Dict[str, Any]:
    """Generate, label, link, and write all 15 families."""
    work_dir.mkdir(parents=True, exist_ok=True)
    families_out_dir = out_dir / "families"
    families_out_dir.mkdir(parents=True, exist_ok=True)

    # First pass: figure out how many of each age band we need across all families
    age_band_counts: Dict[str, int] = {}
    family_specs = []
    for fam_idx, archetype in enumerate(FAMILY_ARCHETYPES, start=1):
        roles_needed = []
        for role_label, age_band in archetype.items():
            # Children list -> expand
            if isinstance(age_band, list):
                for child_idx, ab in enumerate(age_band, start=1):
                    role_name = f"child_{child_idx}"
                    roles_needed.append((role_name, ab))
                    age_band_counts[ab] = age_band_counts.get(ab, 0) + 1
            else:
                roles_needed.append((role_label, age_band))
                age_band_counts[age_band] = age_band_counts.get(age_band, 0) + 1
        family_specs.append({"id": f"family_{fam_idx:03d}", "roles": roles_needed})

    print(f"Patients per age band needed: {age_band_counts}")

    # Second pass: run Synthea once per age band
    bundles_by_band: Dict[str, List[Path]] = {}
    for band, count in age_band_counts.items():
        amin, amax = SYNTHEA_AGE_BANDS[band]
        band_work_dir = work_dir / band
        if band_work_dir.exists():
            shutil.rmtree(band_work_dir)
        band_work_dir.mkdir(parents=True, exist_ok=True)
        print(f"\nRunning Synthea: {count} patient(s), age {amin}-{amax} ({band})...")
        files = run_synthea(synthea_dir, count, SEED + hash(band) % 10000,
                            band_work_dir, amin, amax)
        # Filter Patient bundles only (Synthea writes hospital/practitioner files in same dir)
        patient_files = [f for f in files if "hospitalInformation" not in f.name and "practitionerInformation" not in f.name]
        bundles_by_band[band] = patient_files
        print(f"  Generated {len(patient_files)} patient bundle(s)")

    # Third pass: assign bundles to family roles, link, and write
    band_pointers: Dict[str, int] = {b: 0 for b in age_band_counts}
    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "tag": SYNTHETIC_TAG,
        "total_families": len(family_specs),
        "total_patients": sum(age_band_counts.values()),
        "families": [],
    }

    for fam_spec in family_specs:
        fam_id = fam_spec["id"]
        fam_dir = families_out_dir / fam_id
        fam_dir.mkdir(parents=True, exist_ok=True)

        patients_by_role: Dict[str, Dict[str, Any]] = {}
        bundle_by_role: Dict[str, Dict[str, Any]] = {}

        for idx, (role_label, age_band) in enumerate(fam_spec["roles"], start=1):
            ptr = band_pointers[age_band]
            src = bundles_by_band[age_band][ptr]
            band_pointers[age_band] += 1

            with open(src, "r") as f:
                bundle = json.load(f)

            add_synthetic_tag(bundle)
            patient = find_patient_resource(bundle)
            if patient is None:
                continue

            patients_by_role[role_label] = patient
            bundle_by_role[role_label] = bundle

        # Link family members
        link_family(patients_by_role, bundle_by_role)

        # Write per-role bundles
        family_manifest = {
            "id": fam_id,
            "members": [],
        }
        for idx, (role_label, age_band) in enumerate(fam_spec["roles"], start=1):
            if role_label not in bundle_by_role:
                continue
            bundle = bundle_by_role[role_label]
            patient = patients_by_role[role_label]
            out_filename = f"{idx:02d}_{role_label}.json"
            out_path = fam_dir / out_filename
            with open(out_path, "w") as f:
                json.dump(bundle, f, indent=2)
            family_manifest["members"].append({
                "role": role_label,
                "age_band": age_band,
                "patient_id": patient["id"],
                "patient_name": patient.get("name", [{}])[0].get("text") or
                    " ".join((patient.get("name", [{}])[0].get("given", []) +
                              [patient.get("name", [{}])[0].get("family", "")])).strip(),
                "file": str(out_path.relative_to(out_dir)),
            })
        manifest["families"].append(family_manifest)
        print(f"  Wrote {fam_id} ({len(family_manifest['members'])} members)")

    # Write manifest
    manifest_path = out_dir / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written to: {manifest_path}")
    print(f"Output root: {out_dir.resolve()}")
    return manifest


# -------------------- INGESTION HELPER --------------------

INGESTION_DOC = """
========================================================================
INGESTION INTO FASTEN HEALTH WEBHOOK (test environment)
========================================================================

Each generated FHIR Bundle JSON in ./out/families/family_NNN/ can be POSTed
directly to your Fasten Health test webhook endpoint. Suggested loop:

    import requests, json
    from pathlib import Path

    WEBHOOK_URL = "https://tabulamedica.health/api/fasten/webhook/test"
    SECRET = os.environ["FASTEN_WEBHOOK_SECRET"]  # for HMAC signing

    for bundle_file in Path("./out/families").rglob("*.json"):
        with open(bundle_file) as f:
            bundle = json.load(f)
        # Sign per Standard Webhooks spec (SHA-256 HMAC of payload)
        ...
        r = requests.post(WEBHOOK_URL, json=bundle, headers=headers, timeout=30)
        print(bundle_file.name, r.status_code)

Reminders:
- Tag query at ingestion: `bundle.entry[*].resource.meta.tag[code=synthetic]`
  -> route to test-only data plane, never production tables
- Idempotency: hash bundle.id; skip if seen (Fasten retries; you'll get dupes)
- Rate limit: 5 req/sec to your own webhook to avoid backpressure issues
"""


def main():
    parser = argparse.ArgumentParser(
        description="Generate Synthea-based synthetic family FHIR data for Tabula Medica."
    )
    parser.add_argument("--synthea-dir", type=Path, required=True,
                        help="Path to a Synthea checkout (cloned + gradle-built)")
    parser.add_argument("--out", type=Path, default=Path("./out"),
                        help="Output directory (default: ./out)")
    parser.add_argument("--work", type=Path, default=Path("./synthea-work"),
                        help="Scratch directory for Synthea raw output")
    args = parser.parse_args()

    if not (args.synthea_dir / "run_synthea").exists():
        print(f"Error: {args.synthea_dir} does not look like a Synthea checkout "
              f"(no run_synthea script found).", file=sys.stderr)
        print(f"  git clone https://github.com/synthetichealth/synthea {args.synthea_dir}",
              file=sys.stderr)
        sys.exit(1)

    args.out.mkdir(parents=True, exist_ok=True)
    args.work.mkdir(parents=True, exist_ok=True)

    random.seed(SEED)

    print(f"Synthea dir:  {args.synthea_dir.resolve()}")
    print(f"Output dir:   {args.out.resolve()}")
    print(f"Working dir:  {args.work.resolve()}")
    print(f"Target:       {TOTAL_FAMILIES} families, ~{TOTAL_PATIENTS} patients")
    print(f"All bundles tagged: {SYNTHETIC_TAG['system']}|{SYNTHETIC_TAG['code']}")
    print()

    manifest = build_families(args.synthea_dir, args.work, args.out)

    print("\n" + "=" * 72)
    print(f"DONE. {manifest['total_families']} families, "
          f"{sum(len(f['members']) for f in manifest['families'])} patients.")
    print("=" * 72)
    print(INGESTION_DOC)


if __name__ == "__main__":
    main()