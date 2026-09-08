# Longevity & Preventive Health Protocol

**Protocol version:** 2026.09 · **Owner:** Tabula Medica clinical content · **Status:** educational reference, not clinical decision support

This document is the human-readable twin of `shared/longevity-preventive.ts`. The module is the source of truth for the app (PHR tab, clinician chart subtab, `/longevity-preventive-health` page, `/api/longevity-preventive`); this page is for practice use: visit planning, patient handouts, staff training, and the WorldEHR mirror. Update both together and bump the version.

Everything below is age- and risk-adjusted by the module. The tables show the default adult windows; the "earlier if" column lists the risk flags that pull a start age forward in the app.

---

## 1. Practice one-pager (print this)

**The five numbers that matter most for lifespan**

| Domain | Target | Why |
|---|---|---|
| ApoB | < 80 mg/dL (< 60 if CAC > 0, diabetes or CVD) | Counts every atherogenic particle; cumulative exposure drives ASCVD |
| Blood pressure (home avg) | < 120/80 optimal, < 130/80 target (AHA/ACC 2025) | Largest modifiable driver of stroke, HF, CKD and dementia |
| HbA1c / fasting insulin | HbA1c < 5.6 %, fasting insulin < 8 µIU/mL | Insulin resistance precedes diabetes by ~10 years |
| VO₂ max | Top quartile for age and sex | Strongest single predictor of all-cause mortality |
| Grip strength | Men ≥ 40 kg, women ≥ 25 kg (sarcopenia < 27 / < 16) | Proxy for whole-body strength; each 5 kg drop ≈ +16 % mortality |

**Once-in-a-lifetime tests everyone should have:** Lp(a) · hepatitis C antibody · HIV · hepatitis B triple panel · (men 65–75 who ever smoked) AAA ultrasound · (40–75 with intermediate risk) coronary calcium score.

**Every year:** BP · mood check (PHQ-2/GAD-2) · alcohol/tobacco review · flu (+ COVID per season) · dental · from 65: cognitive screen, falls/gait/strength, hearing.

**Lifestyle prescription:** 150–300 min/week zone 2 + 2–3 strength sessions + 1 interval session + daily balance after 50 · protein 1.2–1.6 g/kg · fibre 25–38 g · sleep 7–9 h with regular timing · no nicotine · alcohol minimal (< 7/14 drinks/week, never binge) · social connection · hearing/vision/BP for the brain.

---

## 2. Screening schedule (US default; international differences noted)

| Screening | Who / when | Cadence | Grade & source | Earlier if |
|---|---|---|---|---|
| Blood pressure | All adults 18+ | Yearly; 3–6-monthly if elevated | USPSTF A; AHA/ACC 2025 | — |
| Lipid panel + ApoB | All adults 20+ | Every 4–6 y if optimal; yearly if treated | USPSTF B (40–75 statin assessment); NLA 2024 | — |
| Lipoprotein(a) | All adults, once | Once | NLA 2024; EAS 2022 | — |
| HbA1c / fasting glucose | 35–70 | Every 3 y (yearly if prediabetes) | USPSTF B; ADA 2026 | BMI ≥ 25 (≥ 23 Asian), HTN, family history → from 18. International: from 30 (India NP-NCD yearly) |
| eGFR + urine ACR | Diabetes, HTN, CVD, CKD, or 60+ | Yearly | KDIGO 2024; ADA | — |
| Coronary calcium (CAC) | 40–75 with intermediate/uncertain risk | Once; repeat 3–5 y if zero with persisting risk | ACC/AHA IIa | Shared decision |
| Colorectal | 45–75 | Colonoscopy 10 y / FIT yearly / stool DNA 1–3 y | USPSTF A (50–75), B (45–49) | First-degree relative → from 40 or 10 y before their diagnosis. International: 50–74, FIT 2-yearly |
| Mammography | Women 40–74 | Every 2 y | USPSTF B (2024) | Family history breast/ovarian → genetics + MRI from 30. International: 50–69 |
| Cervical | Women 21–65 | Cytology 3 y (21–29); primary HPV 5 y (30–65), self-collection OK | USPSTF A | International (WHO): HPV DNA 5–10 y from 30 |
| Low-dose CT lung | 50–80, ≥ 20 pack-years, current or quit ≤ 15 y | Yearly | USPSTF B | — |
| PSA | Men 55–69 | Every 2 y if chosen | USPSTF C (shared decision) | Black ancestry or family history → discuss from 40–45 |
| AAA ultrasound | Men 65–75 who ever smoked | Once | USPSTF B | — |
| DXA bone density | Women 65+; men 70+ | Every 2 y | USPSTF B (2025); BHOF | Postmenopausal < 65 with FRAX ≥ 8.4 % major fracture |
| Hepatitis C Ab | 18–79 | Once | USPSTF B | — |
| HIV | 15–65 | Once (yearly if ongoing risk) | USPSTF A | — |
| Hepatitis B triple panel | All adults | Once | CDC 2023 | — |
| Depression / anxiety | 18+ | Yearly (PHQ-2 → PHQ-9; GAD-2 → GAD-7) | USPSTF B | — |
| Alcohol / tobacco / nicotine | 18+ | Yearly (AUDIT-C, ask about vaping) | USPSTF A/B | — |
| Cognitive screen | 65+ | Yearly (Mini-Cog / MoCA) | USPSTF I; Medicare AWV | Concerns at any age |
| Hearing & vision | Hearing 50+ (3-yearly, yearly from 65); dilated eye exam 65+ (1–2 y) | As stated | AAO; ACHIEVE 2023 | Diabetes → yearly retinal exam from diagnosis |
| Falls / gait / strength | 65+ | Yearly (gait speed, 30-s chair stand, single-leg stance, grip) | USPSTF B; CDC STEADI | — |
| Skin | Risk-based | Monthly self-exam; yearly clinician exam if high risk | USPSTF I | Shared decision |
| Dental | All adults | Every 6–12 months | ADA | — |

---

## 3. Adult immunizations (ACIP 2025–26; WHO/national for international)

| Vaccine | Who | Schedule |
|---|---|---|
| Influenza | All adults | Every autumn; high-dose or adjuvanted from 65 |
| COVID-19 | All adults; strongly 65+ and high-risk | Updated seasonal dose (shared clinical decision for low-risk under 65, ACIP 2025) |
| RSV | 75+; 50–74 with a risk condition (ACIP 2025) | Single dose, no booster yet |
| Recombinant zoster | 50+ (19+ if immunocompromised) | 2 doses, 2–6 months apart |
| Pneumococcal (PCV20 / PCV21) | 50+ (ACIP Oct 2024) or risk conditions | Single conjugate dose |
| Tdap / Td | All adults | Tdap once, then Td/Tdap every 10 y; Tdap each pregnancy |
| HPV | Through 26; shared decision 27–45 | Complete series |
| Hepatitis B | 19–59 universal; 60+ risk-based | 2- or 3-dose series after triple panel |

---

## 4. Longevity biomarker targets ("optimal", not merely "in range")

| Marker | Optimal | Concern beyond | Cadence | Note |
|---|---|---|---|---|
| ApoB | < 80 mg/dL | > 100 | Yearly | < 60 if CAC > 0, diabetes, CVD |
| LDL-C | < 100 mg/dL | > 130 | With ApoB | < 70 if high risk |
| Lp(a) | < 75 nmol/L | ≥ 125 | Once | High Lp(a) → lower ApoB harder |
| Triglycerides | < 100 mg/dL | > 150 | Yearly | Insulin-resistance marker |
| HDL-C | Men > 40, women > 50 mg/dL | < 35 / < 40 | Yearly | Low flags risk; drugs to raise it don't help |
| HbA1c | < 5.6 % | > 6.4 % | 1–3 y (3–6 mo if diabetes) | 5.7–6.4 prediabetes |
| Fasting glucose | 70–99 mg/dL | > 125 | With HbA1c | — |
| Fasting insulin | < 8 µIU/mL | > 15 | Yearly if metabolic risk | Rises a decade before glucose |
| HOMA-IR | < 1.5 | > 2.5 | Calculated | glucose × insulin ÷ 405 |
| hs-CRP | < 1.0 mg/L | > 3.0 | Yearly | Repeat if > 10 (acute illness) |
| Homocysteine | < 10 µmol/L | > 15 | Once | Folate/B12/B6-responsive |
| eGFR (creatinine + cystatin C) | ≥ 90 | < 60 | Yearly | Cystatin C corrects for muscle mass |
| Urine ACR | < 10 mg/g | > 30 | Yearly if DM/HTN/CKD | 10–30 already predicts CV events |
| ALT | Men < 30, women < 25 U/L | > 40 / > 35 | Yearly | MASLD hides in "normal" 30–40; FIB-4 if raised |
| GGT | < 30 U/L | > 50 | Yearly | Alcohol, fatty liver |
| Uric acid | Men < 6.0, women < 5.5 mg/dL | > 7.0 | Yearly | Fructose, HTN, kidney risk |
| Vitamin D (25-OH) | 30–60 ng/mL | < 20 or > 100 | Once, after correction | Routine testing not endorsed for healthy adults (Endocrine Soc 2024) |
| Vitamin B12 | > 400 pg/mL | < 200 | 1–3 y if vegetarian, metformin, PPI, 65+ | MMA if 200–400 + symptoms |
| Ferritin | Men 40–200, women 30–150 ng/mL | < 15 or > 300 | Yearly if menstruating, vegetarian, fatigued | < 30 is deficiency; > 300 → haemochromatosis check |
| Omega-3 index | > 8 % | < 4 % | Once, after diet change | — |
| TSH | 0.5–4.0 mIU/L | < 0.1 or > 10 | 5-yearly from 35 | Add FT4, antibodies if abnormal |
| Home BP | < 120/80 | ≥ 130/90 | Weekly home readings | AHA/ACC 2025 |
| Waist-to-height | < 0.5 | > 0.6 | 6–12 months | Beats BMI for visceral fat |
| Body fat (DEXA) | Men 10–20 %, women 18–28 % | > 25 % / > 35 % | Yearly | Track ALMI: men ≥ 7.0, women ≥ 5.5 kg/m² |

SI conversions used by the app: LDL/HDL × 0.02586 mmol/L; triglycerides × 0.01129; glucose × 0.0555; HbA1c × 10.929 mmol/mol; ApoB × 0.01 g/L; vitamin D × 2.496 nmol/L; uric acid × 59.48 µmol/L.

---

## 5. Functional & fitness markers

| Test | Target (men / women) | Cadence | Evidence |
|---|---|---|---|
| VO₂ max | 40s ≥ 45 / 38 · 50s ≥ 40 / 33 · 60s ≥ 35 / 29 · 70s ≥ 30 / 25 mL/kg/min (top quartile) | 1–2 y | Low → below-average fitness halves mortality (JAMA Netw Open 2018) |
| Grip strength | ≥ 40 / ≥ 25 kg; sarcopenia < 27 / < 16 | Yearly | PURE: −5 kg ≈ +16 % mortality; EWGSOP2 |
| Gait speed (4 m) | ≥ 1.0 m/s healthy, ≥ 1.3 best survival, < 0.8 frailty | Yearly from 60 | JAMA 2011 |
| 30-s chair stand | 60–64 ≥ 14 / 12 · 65–69 ≥ 12 / 11 · 70–74 ≥ 12 / 10 · 75–79 ≥ 11 / 10 · 80+ ≥ 10 / 9 | Yearly from 60 | CDC STEADI norms |
| Single-leg stance | ≥ 10 s (≥ 30 s excellent) | Yearly from 50 | Failure → +84 % mortality over 7 y (BJSM 2022) |
| Push-ups | ≥ 40 (men) linked to 96 % fewer CV events vs < 10; ≥ 20 floor · women ≥ 15 full / 30 modified | Yearly | JAMA Netw Open 2019 |
| Dead hang | ≥ 60 s / ≥ 40 s | Yearly | Grip endurance + shoulder integrity |
| ALMI (DEXA) | ≥ 7.0 / ≥ 5.5 kg/m² | Yearly from 40 | EWGSOP2 |

---

## 6. Lifestyle pillars and check-ins

1. **Move** — 150–300 min/week moderate (zone 2) or 75–150 vigorous; resistance 2–3 days/week; one interval session; daily balance after 50; ≥ 7,000 steps most days.
2. **Eat** — Mediterranean/DASH pattern; protein 1.2–1.6 g/kg/day spread over meals (higher end after 60); fibre 25–38 g; sodium < 2,300 mg (ideal 1,500); ultra-processed food < 10 % of calories; added sugar < 25 g/day.
3. **Sleep** — 7–9 h, bed/wake within ±30 min, no alcohol within 3 h of bed; STOP-BANG ≥ 3 → sleep study.
4. **Avoid** — no tobacco or nicotine; alcohol < 7 (women) / < 14 (men) drinks/week, 3+ alcohol-free days, never binge (US Surgeon General 2025).
5. **Connect** — social contact most days, a stated purpose, yearly PHQ-2/GAD-2; treat loneliness as a risk factor.
6. **Protect the brain** — correct hearing and vision promptly, BP < 130/80 from midlife, demanding learning, physical activity (Lancet Commission 2024: 14 modifiable factors ≈ 45 % of dementia).
7. **Environment** — daily SPF 30+, PM2.5 plan for bad-air days, seat belts, helmets, firearms locked and unloaded.

---

## 7. Suggested visit structure (30–40 min longevity visit)

| Minute | Block | Output |
|---|---|---|
| 0–5 | Profile & risk flags (age, sex, smoking, BMI, FHx, conditions) | App profile card → plan generated |
| 5–12 | Review "Due now" and "Discuss" items | Orders / shared-decision notes |
| 12–20 | Biomarker review against optimal targets | Prioritised 3 targets for the year |
| 20–28 | Functional testing in room: grip, chair stand, single-leg stance, gait | Recorded in Fitness tab |
| 28–35 | Lifestyle prescription: pick 2 check-ins per pillar | Patient handout (print / copy summary) |
| 35–40 | Vaccines due, next visit date | Recall set |

Billing pointers (US): Medicare Annual Wellness Visit (G0438/G0439) covers the cognitive, falls, depression and screening-schedule elements; 99401–99404 for preventive counselling; 96127 for PHQ-9/GAD-7; Lp(a), ApoB, hs-CRP and cystatin C are commonly covered with a documented risk indication.

---

## 8. Regional notes for the WorldEHR mirror

- **Guideline set** is a runtime switch (`region: "us" | "international"`). International mode uses WHO/EU windows (mammography 50–69, colorectal 50–74 FIT, cervical HPV DNA from 30, diabetes screening from 30) and WHO vaccine framing with "verify national schedule".
- **Units** are a separate switch; India and the US use conventional (mg/dL), most of Europe and Asia-Pacific use SI.
- **Asian ancestry** lowers the overweight cut-point to BMI 23 for the diabetes-screening trigger.
- **ABDM (India)**: NP-NCD calls for yearly HTN, diabetes and oral/breast/cervical cancer screening from age 30; the international profile already starts diabetes screening at 30. Map plan items to ABDM Health Information Types (Wellness Record / Immunization Record) when the HIP bridge is enabled.
- **Mirroring**: copy `shared/longevity-preventive.ts` verbatim into the WorldEHR shared package (no imports to rewrite), keep `LONGEVITY_PROTOCOL_VERSION` in lock-step, and port `tests/longevity-preventive.spec.ts` alongside it.

---

## 9. Sources

- USPSTF A/B recommendations, 2018–2025 (breast 2024; osteoporosis 2025; falls 2024; anxiety 2023; colorectal 2021; lung 2021; diabetes 2021; statins 2022)
- AHA/ACC 2025 High Blood Pressure Guideline; ACC/AHA 2019 Primary Prevention; 2018 Cholesterol Guideline
- National Lipid Association 2024 Lp(a) statement; EAS 2022 Lp(a) consensus
- American Diabetes Association Standards of Care 2026; KDIGO 2024 CKD Guideline
- CDC ACIP Adult Immunization Schedule 2025–26; CDC MMWR March 2023 (hepatitis B universal screening)
- EWGSOP2 sarcopenia consensus; CDC STEADI; World Falls Guidelines 2022
- Lancet Commission on Dementia 2024; ACHIEVE trial (Lancet 2023); SPRINT-MIND
- WHO 2020 Physical Activity Guidelines; WHO HEARTS/PEN; WHO cervical cancer elimination 2021; ESC 2021 CVD Prevention (SCORE2); EU Council 2022 cancer screening recommendation
- Endocrine Society 2024 Vitamin D guideline; PROT-AGE 2013; US Surgeon General 2025 advisory on alcohol and cancer
- Mandsager et al. JAMA Netw Open 2018 (fitness and mortality); Leong et al. Lancet 2015 (PURE grip); Studenski et al. JAMA 2011 (gait speed); Araujo et al. BJSM 2022 (single-leg stance); Yang et al. JAMA Netw Open 2019 (push-ups)

*Disclaimer: this protocol summarises published guidance for educational and workflow purposes. It does not replace clinical judgement, individual risk assessment or local regulatory requirements.*
