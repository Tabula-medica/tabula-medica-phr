/**
 * Guideline-driven lab panel catalog.
 *
 * Turns an indication ("elevated liver enzymes", "fatigue", "annual wellness")
 * into a LOINC-coded set of tests a clinician can review and order, with the
 * guideline behind each panel recorded on the panel itself.
 *
 * ── Why panels are tiered ──
 * The naive version of this feature is a flat list per indication, and it is
 * actively harmful. Ordering ceruloplasmin, alpha-1 antitrypsin and an
 * autoimmune screen on every patient with a mildly raised ALT generates false
 * positives at a far higher rate than it finds Wilson disease, and each false
 * positive buys the patient a specialist referral and a biopsy conversation.
 *
 * So every panel separates:
 *   - `first-line`  — ordered up front for this indication
 *   - `reflex`      — ordered only when a stated trigger fires
 *
 * Each reflex test carries the `trigger` that justifies it, so the UI can show
 * *why* a second-tier test is being proposed instead of presenting thirty
 * checkboxes of equal weight.
 *
 * ── What this is not ──
 * This is decision support, not an order set. Nothing here is a substitute for
 * the clinician's judgement, and the panels encode common adult ambulatory
 * practice rather than any single society's protocol verbatim. Frequencies are
 * starting points; the patient in front of you governs.
 */

/** Where a panel's content comes from, so a reviewer can check it. */
export type GuidelineSource =
  | "USPSTF"
  | "ADA-Standards-of-Care"
  | "ACC-AHA"
  | "AASLD"
  | "ACR"
  | "ASH"
  | "General-Internal-Medicine";

export type TestTier = "first-line" | "reflex";

export type SpecimenType = "blood" | "urine" | "stool" | "imaging" | "other";

export interface LabTest {
  /** LOINC code. The panel-level codes are used where one exists. */
  loinc: string;
  name: string;
  /** Short clinician-facing label for a dense pick list. */
  shortName: string;
  specimen: SpecimenType;
  tier: TestTier;
  /** Why this test is in the panel. Shown on hover / read aloud by voice. */
  rationale: string;
  /**
   * For `reflex` tests only: the condition that justifies ordering it.
   * Required by `validateLabPanelCatalog` — a reflex test with no trigger is
   * indistinguishable from a first-line test and defeats the tiering.
   */
  trigger?: string;
  /** True when the patient must fast. Drives patient instructions. */
  fasting?: boolean;
}

export interface LabPanel {
  id: LabPanelId;
  name: string;
  /** The clinical situation this panel answers. */
  indication: string;
  guideline: GuidelineSource;
  /** Suggested repeat interval, or null for a one-off workup. */
  intervalMonths: number | null;
  /** Free-text notes a clinician should see before ordering. */
  notes: string[];
  tests: LabTest[];
}

export type LabPanelId =
  | "annual-wellness"
  | "hypertension"
  | "diabetes"
  | "anemia"
  | "liver-enzyme-elevation"
  | "arthritis"
  | "fatigue";

// ── Shared tests ────────────────────────────────────────────────────────────
// Defined once and reused so the same test carries the same LOINC everywhere.
// A panel may re-tier a shared test via `asReflex`/`asFirstLine`.

const CBC: LabTest = {
  loinc: "58410-2",
  name: "CBC panel with differential, blood",
  shortName: "CBC with diff",
  specimen: "blood",
  tier: "first-line",
  rationale: "Screens for anemia, infection, and haematologic abnormality.",
};

const CMP: LabTest = {
  loinc: "24323-8",
  name: "Comprehensive metabolic panel",
  shortName: "CMP",
  specimen: "blood",
  tier: "first-line",
  rationale:
    "Renal function, electrolytes, glucose, and hepatic enzymes in one draw.",
  // Deliberately NOT marked fasting. A CMP drawn for renal or hepatic
  // indications does not require it; only the glucose component benefits, and
  // marking the whole panel fasting would send patients home hungry for an
  // arthritis or liver workup that never needed it.
};

const BMP: LabTest = {
  loinc: "51990-0",
  name: "Basic metabolic panel",
  shortName: "BMP",
  specimen: "blood",
  tier: "first-line",
  rationale: "Renal function and electrolytes.",
};

const LIPID: LabTest = {
  loinc: "57698-3",
  name: "Lipid panel with direct LDL",
  shortName: "Lipid panel",
  specimen: "blood",
  tier: "first-line",
  rationale: "Cardiovascular risk stratification.",
  fasting: true,
};

const TSH: LabTest = {
  loinc: "3016-3",
  name: "Thyrotropin (TSH), serum",
  shortName: "TSH",
  specimen: "blood",
  tier: "first-line",
  rationale: "Thyroid dysfunction is a common and treatable mimic.",
};

const HBA1C: LabTest = {
  loinc: "4548-4",
  name: "Hemoglobin A1c / Hemoglobin.total, blood",
  shortName: "HbA1c",
  specimen: "blood",
  tier: "first-line",
  rationale: "Glycaemic control over the preceding ~3 months.",
};

const FERRITIN: LabTest = {
  loinc: "2276-4",
  name: "Ferritin, serum",
  shortName: "Ferritin",
  specimen: "blood",
  tier: "first-line",
  rationale:
    "Most sensitive single test for iron deficiency; an acute-phase reactant, so interpret alongside CRP.",
};

const B12: LabTest = {
  loinc: "2132-9",
  name: "Cobalamin (Vitamin B12), serum",
  shortName: "Vitamin B12",
  specimen: "blood",
  tier: "first-line",
  rationale: "Deficiency causes macrocytic anaemia and neuropathy.",
};

const CRP: LabTest = {
  loinc: "1988-5",
  name: "C-reactive protein, serum",
  shortName: "CRP",
  specimen: "blood",
  tier: "first-line",
  rationale: "Non-specific marker of inflammation.",
};

const ESR: LabTest = {
  loinc: "30341-2",
  name: "Erythrocyte sedimentation rate",
  shortName: "ESR",
  specimen: "blood",
  tier: "first-line",
  rationale: "Non-specific marker of inflammation; complements CRP.",
};

const URINE_ACR: LabTest = {
  loinc: "9318-7",
  name: "Albumin/Creatinine ratio, urine",
  shortName: "Urine ACR",
  specimen: "urine",
  tier: "first-line",
  rationale: "Detects early kidney damage before creatinine rises.",
};

/** Re-tier a shared test for a panel where it is second-line. */
function asReflex(test: LabTest, trigger: string): LabTest {
  return { ...test, tier: "reflex", trigger };
}

/** Re-tier a shared test for a panel where it is first-line. */
function asFirstLine(test: LabTest): LabTest {
  const { trigger: _trigger, ...rest } = test;
  return { ...rest, tier: "first-line" };
}

// ── The panels ──────────────────────────────────────────────────────────────

export const LAB_PANELS: readonly LabPanel[] = [
  {
    id: "annual-wellness",
    name: "Annual Wellness",
    indication: "Routine adult preventive visit with no specific complaint.",
    guideline: "USPSTF",
    intervalMonths: 12,
    notes: [
      "USPSTF does not endorse a universal annual blood panel — most of the value of the wellness visit is in age- and risk-based screening, not in broad lab testing.",
      "Lipid and glycaemic testing are risk- and age-dependent; the tests below are the common ambulatory default, not a mandate.",
      "Cancer screening (mammography, cervical, colorectal, lung) is scheduled separately, not drawn here.",
    ],
    tests: [
      CBC,
      CMP,
      LIPID,
      asReflex(
        HBA1C,
        "Age 35–70 with BMI ≥25, or any diabetes risk factor (USPSTF diabetes screening).",
      ),
      asReflex(
        TSH,
        "Symptoms of thyroid dysfunction, or known thyroid disease. Not recommended as universal screening.",
      ),
    ],
  },

  {
    id: "hypertension",
    name: "Hypertension — initial evaluation",
    indication:
      "Newly diagnosed or uncontrolled hypertension; baseline and target-organ assessment.",
    guideline: "ACC-AHA",
    intervalMonths: 12,
    notes: [
      "The purpose is to establish baseline renal function, screen for target-organ damage, and detect secondary causes.",
      "A 12-lead ECG is part of the standard initial evaluation and is not a laboratory test.",
      "Consider secondary-cause workup in resistant hypertension, onset before age 30, or hypokalaemia without diuretics.",
    ],
    tests: [
      CMP,
      LIPID,
      URINE_ACR,
      {
        loinc: "34534-8",
        name: "12-lead ECG",
        shortName: "ECG (12-lead)",
        specimen: "other",
        tier: "first-line",
        rationale: "Screens for left ventricular hypertrophy and prior infarct.",
      },
      asReflex(
        TSH,
        "Clinical suspicion of thyroid-related hypertension.",
      ),
      {
        loinc: "2160-0",
        name: "Creatinine, serum",
        shortName: "Creatinine (repeat)",
        specimen: "blood",
        tier: "reflex",
        trigger: "Starting or titrating an ACE inhibitor or ARB — recheck at 1–2 weeks.",
        rationale: "RAAS blockade can cause an acute rise in creatinine and potassium.",
      },
      {
        loinc: "2823-3",
        name: "Potassium, serum",
        shortName: "Potassium (repeat)",
        specimen: "blood",
        tier: "reflex",
        trigger: "Starting or titrating an ACE inhibitor, ARB, or aldosterone antagonist.",
        rationale: "Hyperkalaemia is the dose-limiting toxicity of RAAS blockade.",
      },
      {
        loinc: "8693-4",
        name: "Aldosterone/Renin ratio",
        shortName: "Aldosterone:renin ratio",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Resistant hypertension, onset before age 30, or spontaneous/diuretic-induced hypokalaemia.",
        rationale: "Screens for primary aldosteronism, the commonest secondary cause.",
      },
    ],
  },

  {
    id: "diabetes",
    name: "Diabetes — monitoring",
    indication: "Established type 1 or type 2 diabetes; routine surveillance.",
    guideline: "ADA-Standards-of-Care",
    intervalMonths: 6,
    notes: [
      "HbA1c is checked twice yearly at goal and quarterly when therapy has changed or the patient is above goal.",
      "Urine albumin:creatinine and eGFR are checked at least annually in type 2 from diagnosis, and in type 1 from 5 years after diagnosis.",
      "Dilated retinal examination and comprehensive foot examination are part of annual care but are not laboratory tests.",
    ],
    tests: [
      HBA1C,
      CMP,
      URINE_ACR,
      LIPID,
      {
        loinc: "62238-1",
        name: "Glomerular filtration rate, estimated",
        shortName: "eGFR",
        specimen: "blood",
        tier: "first-line",
        rationale: "Stages diabetic kidney disease and governs metformin dosing.",
      },
      asReflex(
        B12,
        "Long-term metformin therapy — metformin causes B12 malabsorption.",
      ),
      asReflex(
        TSH,
        "Type 1 diabetes — screen for co-existing autoimmune thyroid disease.",
      ),
    ],
  },

  {
    id: "anemia",
    name: "Anemia — workup",
    indication: "Confirmed low haemoglobin; determine the mechanism.",
    guideline: "ASH",
    intervalMonths: null,
    notes: [
      "Let the MCV direct the workup: microcytic points to iron deficiency or thalassaemia, macrocytic to B12/folate or marrow disease, normocytic to chronic disease, renal cause, or bleeding.",
      "Iron deficiency anaemia in an adult male or a post-menopausal female is gastrointestinal blood loss until proven otherwise, and warrants endoscopic evaluation regardless of how it responds to iron.",
      "Ferritin is an acute-phase reactant; a normal ferritin does not exclude iron deficiency when inflammation is present — check transferrin saturation.",
    ],
    tests: [
      CBC,
      FERRITIN,
      {
        loinc: "2498-4",
        name: "Iron, serum",
        shortName: "Serum iron",
        specimen: "blood",
        tier: "first-line",
        rationale: "Part of the iron studies used to compute transferrin saturation.",
      },
      {
        loinc: "2500-7",
        name: "Iron binding capacity, total (TIBC)",
        shortName: "TIBC",
        specimen: "blood",
        tier: "first-line",
        rationale: "Rises in iron deficiency; needed for transferrin saturation.",
      },
      {
        loinc: "2502-3",
        name: "Iron saturation, transferrin",
        shortName: "Transferrin saturation",
        specimen: "blood",
        tier: "first-line",
        rationale:
          "More reliable than ferritin when inflammation is present; <20% suggests iron deficiency.",
      },
      {
        loinc: "17849-1",
        name: "Reticulocytes/100 erythrocytes",
        shortName: "Reticulocyte count",
        specimen: "blood",
        tier: "first-line",
        rationale:
          "Separates underproduction from haemolysis or blood loss — the single most informative early test.",
      },
      asReflex(B12, "MCV >100 fL, or neurological symptoms."),
      {
        loinc: "2284-8",
        name: "Folate, serum",
        shortName: "Folate",
        specimen: "blood",
        tier: "reflex",
        trigger: "MCV >100 fL.",
        rationale: "Folate deficiency causes macrocytic anaemia.",
      },
      {
        loinc: "4576-5",
        name: "Hemoglobin A2, blood",
        shortName: "Hemoglobin electrophoresis",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Microcytosis with normal iron studies, or relevant ancestry (Mediterranean, South Asian, South-East Asian, African).",
        rationale: "Identifies thalassaemia trait and other haemoglobinopathies.",
      },
      {
        loinc: "14338-8",
        name: "Haptoglobin, serum",
        shortName: "Haptoglobin",
        specimen: "blood",
        tier: "reflex",
        trigger: "Elevated reticulocyte count — suspected haemolysis.",
        rationale: "Falls in intravascular haemolysis.",
      },
      {
        loinc: "2532-0",
        name: "Lactate dehydrogenase, serum",
        shortName: "LDH",
        specimen: "blood",
        tier: "reflex",
        trigger: "Suspected haemolysis.",
        rationale: "Rises with haemolysis and with ineffective erythropoiesis.",
      },
      {
        loinc: "2335-8",
        name: "Occult blood, stool",
        shortName: "Faecal occult blood",
        specimen: "stool",
        tier: "reflex",
        trigger: "Iron deficiency anaemia — evaluate for gastrointestinal blood loss.",
        rationale:
          "Adjunct only. A negative result does NOT remove the need for endoscopy in unexplained iron deficiency.",
      },
    ],
  },

  {
    id: "liver-enzyme-elevation",
    name: "Elevated Liver Enzymes — workup",
    indication:
      "Persistently raised aminotransferases (ALT/AST) or cholestatic enzymes on a previous panel.",
    guideline: "AASLD",
    intervalMonths: null,
    notes: [
      "Confirm the abnormality is persistent before working it up — a single mildly raised ALT often normalises on repeat.",
      "Take a medication, supplement, and alcohol history first. Drug-induced injury and alcohol are the commonest causes and cost nothing to find.",
      "The pattern directs the workup: hepatocellular (ALT/AST dominant) versus cholestatic (ALP/GGT dominant) are different differentials.",
      "Wilson disease testing is reserved for patients under roughly 40; ceruloplasmin is a poor screening test in older adults.",
    ],
    tests: [
      {
        loinc: "24325-3",
        name: "Hepatic function panel",
        shortName: "Hepatic panel (repeat)",
        specimen: "blood",
        tier: "first-line",
        rationale:
          "Confirms persistence and establishes the hepatocellular vs cholestatic pattern.",
      },
      CBC,
      {
        loinc: "5196-1",
        name: "Hepatitis B surface antigen",
        shortName: "HBsAg",
        specimen: "blood",
        tier: "first-line",
        rationale: "Chronic hepatitis B is a common and treatable cause.",
      },
      {
        loinc: "16128-1",
        name: "Hepatitis C virus antibody",
        shortName: "HCV antibody",
        specimen: "blood",
        tier: "first-line",
        rationale: "Chronic hepatitis C is common, treatable, and often silent.",
      },
      {
        loinc: "5195-3",
        name: "Hepatitis B surface antibody",
        shortName: "Anti-HBs",
        specimen: "blood",
        tier: "first-line",
        rationale: "Establishes immunity or prior exposure.",
      },
      asFirstLine({
        ...FERRITIN,
        rationale:
          "Markedly raised ferritin with high transferrin saturation suggests haemochromatosis.",
      }),
      {
        loinc: "2502-3",
        name: "Iron saturation, transferrin",
        shortName: "Transferrin saturation",
        specimen: "blood",
        tier: "first-line",
        rationale: "Screening test for hereditary haemochromatosis (>45% suggestive).",
      },
      {
        loinc: "30341-2",
        name: "Abdominal ultrasound",
        shortName: "Abdominal ultrasound",
        specimen: "imaging",
        tier: "first-line",
        rationale:
          "Detects steatosis, biliary obstruction, cirrhosis, and focal lesions.",
      },
      {
        loinc: "5048-4",
        name: "Antinuclear antibody, serum",
        shortName: "ANA",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Hepatocellular pattern with negative viral serology — evaluating autoimmune hepatitis.",
        rationale: "Positive in most autoimmune hepatitis.",
      },
      {
        loinc: "31112-6",
        name: "Smooth muscle antibody, serum",
        shortName: "Anti-smooth muscle antibody",
        specimen: "blood",
        tier: "reflex",
        trigger: "Suspected autoimmune hepatitis.",
        rationale: "Relatively specific for type 1 autoimmune hepatitis.",
      },
      {
        loinc: "1825-9",
        name: "Antimitochondrial antibody, serum",
        shortName: "Antimitochondrial antibody",
        specimen: "blood",
        tier: "reflex",
        trigger: "Cholestatic pattern (ALP/GGT dominant).",
        rationale: "Highly specific for primary biliary cholangitis.",
      },
      {
        loinc: "2350-7",
        name: "Ceruloplasmin, serum",
        shortName: "Ceruloplasmin",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Age under ~40 with unexplained hepatitis — screening for Wilson disease.",
        rationale:
          "Low in Wilson disease. Poor specificity, which is why it is not first-line.",
      },
      {
        loinc: "1825-0",
        name: "Alpha-1-antitrypsin, serum",
        shortName: "Alpha-1 antitrypsin",
        specimen: "blood",
        tier: "reflex",
        trigger: "Unexplained chronic liver disease after first-line workup is negative.",
        rationale: "Alpha-1 antitrypsin deficiency causes chronic liver disease.",
      },
      {
        loinc: "13964-2",
        name: "Tissue transglutaminase IgA antibody",
        shortName: "Tissue transglutaminase IgA",
        specimen: "blood",
        tier: "reflex",
        trigger: "Unexplained transaminase elevation — coeliac disease is an under-recognised cause.",
        rationale: "Coeliac disease can present with isolated transaminitis.",
      },
    ],
  },

  {
    id: "arthritis",
    name: "Arthritis — inflammatory workup",
    indication:
      "Joint pain with features suggesting inflammatory rather than degenerative arthritis.",
    guideline: "ACR",
    intervalMonths: null,
    notes: [
      "Osteoarthritis is a clinical and radiographic diagnosis — it does not need serology, and testing an osteoarthritic patient mostly generates false positives.",
      "Order this panel when the history suggests inflammation: morning stiffness over an hour, small-joint or symmetrical involvement, joint swelling, or systemic features.",
      "A positive ANA or rheumatoid factor in a low-probability patient is far more likely to be a false positive than disease. Interpret against pre-test probability.",
      "Acute monoarthritis is a different problem: arthrocentesis to exclude septic arthritis takes priority over any blood test.",
    ],
    tests: [
      ESR,
      CRP,
      CBC,
      CMP,
      {
        loinc: "11572-5",
        name: "Rheumatoid factor, serum",
        shortName: "Rheumatoid factor",
        specimen: "blood",
        tier: "first-line",
        rationale:
          "Supports rheumatoid arthritis, but is positive in other conditions and in healthy older adults.",
      },
      {
        loinc: "53028-1",
        name: "Cyclic citrullinated peptide antibody, serum",
        shortName: "Anti-CCP",
        specimen: "blood",
        tier: "first-line",
        rationale:
          "Considerably more specific for rheumatoid arthritis than rheumatoid factor.",
      },
      {
        loinc: "3084-1",
        name: "Urate, serum",
        shortName: "Uric acid",
        specimen: "blood",
        tier: "first-line",
        rationale:
          "Supports gout, though it may be normal during an acute attack — a normal level does not exclude it.",
      },
      {
        loinc: "5048-4",
        name: "Antinuclear antibody, serum",
        shortName: "ANA",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Features suggesting connective tissue disease — rash, serositis, Raynaud, cytopenias, renal involvement.",
        rationale:
          "Sensitive but non-specific for lupus and related disease. Not a screening test for undifferentiated joint pain.",
      },
      {
        loinc: "31208-2",
        name: "Borrelia burgdorferi antibody, serum",
        shortName: "Lyme serology",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Residence in or travel to a Lyme-endemic area with a compatible mono/oligoarthritis, especially the knee.",
        rationale: "Lyme arthritis is treatable and easily missed outside endemic areas.",
      },
      {
        loinc: "6349-5",
        name: "Crystals identified, synovial fluid",
        shortName: "Synovial fluid analysis",
        specimen: "other",
        tier: "reflex",
        trigger:
          "Acute monoarthritis or an effusion — cell count, Gram stain, culture, and crystals.",
        rationale:
          "The only way to distinguish septic arthritis from crystal arthropathy. Takes priority in acute monoarthritis.",
      },
      {
        loinc: "51595-7",
        name: "HLA-B27 antigen",
        shortName: "HLA-B27",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Inflammatory back pain, enthesitis, uveitis, or psoriasis — suspected spondyloarthropathy.",
        rationale: "Supports axial spondyloarthritis in the right clinical setting.",
      },
    ],
  },

  {
    id: "fatigue",
    name: "Fatigue — initial workup",
    indication: "Persistent fatigue without a localising cause on history and examination.",
    guideline: "General-Internal-Medicine",
    intervalMonths: null,
    notes: [
      "A careful history and examination identify the cause far more often than the laboratory does. Screen for depression, sleep apnoea, and medication side effects before broadening testing.",
      "The first-line set below is deliberately small. Broad undirected panels in fatigue mostly generate incidental findings that lead to more testing without improving outcomes.",
      "Red flags — weight loss, fever, night sweats, lymphadenopathy — change this from a screening problem to a diagnostic one and warrant a directed workup.",
    ],
    tests: [
      CBC,
      CMP,
      TSH,
      asFirstLine({
        ...FERRITIN,
        rationale:
          "Iron deficiency causes fatigue before it causes anaemia; ferritin catches it earlier than the CBC.",
      }),
      asReflex(HBA1C, "Diabetes risk factors, or symptoms of hyperglycaemia."),
      asReflex(B12, "Macrocytosis, neuropathy, vegan diet, or long-term metformin or PPI use."),
      {
        loinc: "14635-7",
        name: "25-hydroxyvitamin D3, serum",
        shortName: "Vitamin D (25-OH)",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Risk factors for deficiency — limited sun exposure, malabsorption, osteoporosis. Not recommended as universal screening.",
        rationale:
          "Widely ordered and weakly supported in isolated fatigue; included as reflex rather than first-line for that reason.",
      },
      {
        loinc: "56888-1",
        name: "HIV 1+2 antibody and p24 antigen",
        shortName: "HIV Ag/Ab",
        specimen: "blood",
        tier: "reflex",
        trigger:
          "Not previously screened (USPSTF recommends one-off screening age 15–65), or risk factors present.",
        rationale: "HIV can present as isolated constitutional fatigue.",
      },
      {
        loinc: "13964-2",
        name: "Tissue transglutaminase IgA antibody",
        shortName: "Tissue transglutaminase IgA",
        specimen: "blood",
        tier: "reflex",
        trigger: "Gastrointestinal symptoms, iron deficiency, or a family history of coeliac disease.",
        rationale: "Coeliac disease commonly presents as fatigue with iron deficiency.",
      },
      {
        loinc: "1988-5",
        name: "C-reactive protein, serum",
        shortName: "CRP",
        specimen: "blood",
        tier: "reflex",
        trigger: "Constitutional red flags — weight loss, fever, or night sweats.",
        rationale: "Screens for an occult inflammatory or neoplastic process.",
      },
    ],
  },
];

// ── Lookup helpers ──────────────────────────────────────────────────────────

const PANELS_BY_ID = new Map<string, LabPanel>(
  LAB_PANELS.map((p) => [p.id, p]),
);

export function getLabPanel(id: string): LabPanel | null {
  return PANELS_BY_ID.get(id) ?? null;
}

export function listLabPanels(): Array<{
  id: LabPanelId;
  name: string;
  indication: string;
  guideline: GuidelineSource;
  firstLineCount: number;
  reflexCount: number;
}> {
  return LAB_PANELS.map((p) => ({
    id: p.id,
    name: p.name,
    indication: p.indication,
    guideline: p.guideline,
    firstLineCount: p.tests.filter((t) => t.tier === "first-line").length,
    reflexCount: p.tests.filter((t) => t.tier === "reflex").length,
  }));
}

export interface ResolvedPanel {
  panel: LabPanel;
  firstLine: LabTest[];
  reflex: LabTest[];
  /** True if any first-line test needs a fasting specimen. */
  requiresFasting: boolean;
  /** Patient-facing preparation note, or null when none is needed. */
  patientPreparation: string | null;
}

/**
 * Resolve a panel into what to order now versus what to hold in reserve.
 *
 * `includeReflex` exists for the clinician who has already decided the trigger
 * applies. It defaults to false, because the default behaviour of this feature
 * must be the small panel, not the big one.
 */
export function resolvePanel(
  id: string,
  opts: { includeReflex?: boolean } = {},
): ResolvedPanel | null {
  const panel = getLabPanel(id);
  if (!panel) return null;

  const firstLine = panel.tests.filter((t) => t.tier === "first-line");
  const reflex = panel.tests.filter((t) => t.tier === "reflex");
  const ordered = opts.includeReflex ? [...firstLine, ...reflex] : firstLine;
  const requiresFasting = ordered.some((t) => t.fasting === true);

  return {
    panel,
    firstLine,
    reflex,
    requiresFasting,
    patientPreparation: requiresFasting
      ? "Fast for 9–12 hours before the draw. Water and prescribed medication are fine unless told otherwise."
      : null,
  };
}

/** Deduplicate tests across panels by LOINC, keeping the first occurrence. */
export function mergePanels(ids: string[]): LabTest[] {
  const seen = new Set<string>();
  const merged: LabTest[] = [];
  for (const id of ids) {
    const panel = getLabPanel(id);
    if (!panel) continue;
    for (const test of panel.tests) {
      // Key on LOINC + tier so a test that is first-line in one panel and
      // reflex in another does not silently collapse into the reflex version.
      const key = `${test.loinc}:${test.tier}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(test);
    }
  }
  return merged;
}

/**
 * Structural checks over the catalog. Run as a test rather than at import so a
 * malformed entry fails CI instead of taking down the server at boot.
 */
export function validateLabPanelCatalog(): string[] {
  const problems: string[] = [];

  for (const panel of LAB_PANELS) {
    if (panel.tests.length === 0) {
      problems.push(`${panel.id}: has no tests`);
    }
    if (!panel.tests.some((t) => t.tier === "first-line")) {
      problems.push(`${panel.id}: has no first-line test`);
    }
    if (panel.notes.length === 0) {
      problems.push(`${panel.id}: has no clinician notes`);
    }
    for (const test of panel.tests) {
      if (test.tier === "reflex" && !test.trigger) {
        problems.push(
          `${panel.id}/${test.shortName}: reflex test has no trigger, which makes it indistinguishable from first-line`,
        );
      }
      if (test.tier === "first-line" && test.trigger) {
        problems.push(
          `${panel.id}/${test.shortName}: first-line test carries a trigger, which is contradictory`,
        );
      }
      if (!/^\d{1,5}-\d$/.test(test.loinc)) {
        problems.push(
          `${panel.id}/${test.shortName}: "${test.loinc}" is not a well-formed LOINC code`,
        );
      }
      if (!test.rationale) {
        problems.push(`${panel.id}/${test.shortName}: has no rationale`);
      }
    }
  }

  return problems;
}
