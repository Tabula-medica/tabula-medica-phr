# Synthea Family Generator

Script: `scripts/synthea_family_generator.py`

Generates 50 synthetic FHIR R4 patients organized into 15 families, every
resource tagged `system=https://tabulamedica.health/test-data | code=synthetic`
so the ingestion path can route them to the test data plane and never near
production tables.

## Why this is run locally, not in CI/Replit

Synthea is a Java application that requires:

- Java 11+ (JDK)
- A `git clone` of `synthetichealth/synthea` (~150 MB)
- A first-time gradle build (`./gradlew build check test`, ~3 min)
- Then per-run generation time (~30 s per age band, ~5 min total for 50 patients)

The Replit dev container does not ship Java. Set this up on a workstation
or a CI runner with the JDK installed.

## One-time setup

```bash
# 1. Java (macOS)
brew install --cask temurin
java -version   # confirm 11+

# 2. Synthea checkout + build
git clone https://github.com/synthetichealth/synthea ~/synthea
cd ~/synthea
./gradlew build check test
```

## Generate the 15 families

```bash
cd /path/to/tabula-medica-repo
python3 scripts/synthea_family_generator.py \
    --synthea-dir ~/synthea \
    --out ./out/synthetic-families
```

Output:

```
out/synthetic-families/
  manifest.json                # full index of families and members
  families/
    family_001/01_father.json  # FHIR Bundle (transaction)
    family_001/02_mother.json
    family_001/03_child_1.json
    ...
```

Every resource carries:

```json
"meta": {
  "tag": [{
    "system": "https://tabulamedica.health/test-data",
    "code": "synthetic",
    "display": "Synthetic test data — Synthea-generated. NOT real PHI."
  }]
}
```

Family relationships are expressed two ways for downstream consumers:

1. `Patient.link[].other` references with `type: seealso`
2. Dedicated `RelatedPerson` resources with HL7 v3 RoleCode (`SPS`, `PRN`,
   `CHILD`, `GRPRN`) plus a custom extension carrying the related
   patient id.

## Loading into Tabula Medica's test data plane

The end of the script prints the recommended ingestion loop. Two non-negotiable
guardrails on the receiving side:

1. **Tag check at ingestion**: reject the bundle if no resource carries the
   `synthetic` tag. This prevents accidentally posting a real-PHI bundle to the
   test endpoint.
2. **Routing**: the test webhook must write to a separate Postgres schema
   (or at minimum a separate set of tables prefixed `test_`). It must never
   touch the production `patients`, `observations`, or `fhir_resources` tables.

## Demographic distribution

Targets from the Beta Recruitment doc:

| Cohort | Share | Tests |
|---|---|---|
| Under-18 | 30% | minor accounts model + age-of-majority transition |
| Adult primary persona | 40% | core caregiver / patient flow |
| Senior 60+ | 20% | elderly-parent caregiver flow |
| Complex multi-condition | 10% | dedup-heavy flow |

The 15 family archetypes baked into the script (5 nuclear with minor children,
3 multi-generational, 3 senior couples, 2 single adults, 2 spouse-only) hit
this distribution.
