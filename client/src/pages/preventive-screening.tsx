import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useSEO } from "@/hooks/use-seo";
import {
  ShieldCheck,
  Heart,
  Bone,
  Eye,
  Brain,
  Activity,
  Baby,
  Syringe,
  Printer,
  Search,
  Filter,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  Stethoscope,
  Droplets,
  Ribbon,
  LucideIcon,
  ExternalLink,
} from "lucide-react";

type Sex = "male" | "female";
type RiskLevel = "routine" | "high-risk" | "conditional";

interface Screening {
  name: string;
  description: string;
  ageStart: number;
  ageEnd: number;
  sex: Sex | "all";
  frequency: string;
  grade: string;
  source: string;
  category: string;
  riskLevel: RiskLevel;
  conditions?: string;
  icon: LucideIcon;
}

interface Vaccine {
  name: string;
  ageGroup: string;
  ageStart: number;
  ageEnd: number;
  doses: string;
  schedule: string;
  notes: string;
  catchUp?: string;
}

interface StateRegistry {
  state: string;
  abbrev: string;
  registryName: string;
  url: string;
  phone?: string;
}

const SCREENINGS: Screening[] = [
  {
    name: "CT Coronary Calcium Score",
    description: "Non-contrast CT scan to detect calcified plaque in coronary arteries. Helps assess cardiovascular risk beyond traditional risk factors.",
    ageStart: 40,
    ageEnd: 75,
    sex: "male",
    frequency: "One-time or as directed by provider based on risk assessment",
    grade: "Not yet graded by USPSTF; ACC/AHA recommend for intermediate-risk adults",
    source: "ACC/AHA 2019 Primary Prevention Guidelines",
    category: "cardiovascular",
    riskLevel: "conditional",
    conditions: "Consider for intermediate 10-year ASCVD risk (7.5%–20%)",
    icon: Heart,
  },
  {
    name: "CT Coronary Calcium Score",
    description: "Non-contrast CT scan to detect calcified plaque in coronary arteries for women, typically starting later than men due to later onset of cardiovascular risk.",
    ageStart: 45,
    ageEnd: 75,
    sex: "female",
    frequency: "One-time or as directed by provider based on risk assessment",
    grade: "Not yet graded by USPSTF; ACC/AHA recommend for intermediate-risk adults",
    source: "ACC/AHA 2019 Primary Prevention Guidelines",
    category: "cardiovascular",
    riskLevel: "conditional",
    conditions: "Consider for intermediate 10-year ASCVD risk (7.5%–20%)",
    icon: Heart,
  },
  {
    name: "Colorectal Cancer Screening",
    description: "Multiple options: Colonoscopy (every 10 years), Cologuard/stool DNA (every 3 years), Shield blood test (every 3 years), FIT (annually), or CT colonography (every 5 years).",
    ageStart: 45,
    ageEnd: 75,
    sex: "all",
    frequency: "Colonoscopy every 10 yrs | Cologuard every 3 yrs | Shield blood test every 3 yrs | FIT annually",
    grade: "A (ages 45–49) / A (ages 50–75)",
    source: "USPSTF 2021",
    category: "cancer",
    riskLevel: "routine",
    icon: Activity,
  },
  {
    name: "PSA Screening (Prostate Cancer)",
    description: "Prostate-specific antigen blood test for prostate cancer screening. Shared decision-making between patient and provider recommended.",
    ageStart: 50,
    ageEnd: 70,
    sex: "male",
    frequency: "Every 1–2 years per shared decision-making with provider",
    grade: "C (ages 55–69); D (ages 70+). AUA recommends shared decision at 55–69.",
    source: "USPSTF 2018 / AUA 2023",
    category: "cancer",
    riskLevel: "conditional",
    conditions: "Earlier screening (age 40–45) for high-risk: African American men, family history",
    icon: Stethoscope,
  },
  {
    name: "Mammogram (Breast Cancer)",
    description: "Breast cancer screening via mammography. Biennial screening recommended for average-risk women.",
    ageStart: 40,
    ageEnd: 74,
    sex: "female",
    frequency: "Every 2 years (biennial)",
    grade: "B",
    source: "USPSTF 2024",
    category: "cancer",
    riskLevel: "routine",
    icon: Ribbon,
  },
  {
    name: "Pap Smear / Cervical Cancer Screening",
    description: "Cervical cancer screening with Pap smear, HPV test, or both. Start at age 21 or within 3 years of becoming sexually active.",
    ageStart: 21,
    ageEnd: 65,
    sex: "female",
    frequency: "Pap every 3 yrs (21–29) | Pap + HPV co-test every 5 yrs or Pap every 3 yrs (30–65)",
    grade: "A",
    source: "USPSTF 2018",
    category: "cancer",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "Cholesterol / Lipid Screening",
    description: "Fasting lipid panel to assess cardiovascular risk. Universal screening recommended for children ages 9–11 and again at 17–21. Adults screened based on risk.",
    ageStart: 10,
    ageEnd: 999,
    sex: "all",
    frequency: "Ages 9–11: once | Ages 17–21: once | Adults 20+: every 4–6 yrs (more often if risk factors)",
    grade: "B (adults 40–75 with risk factors)",
    source: "USPSTF / AAP / ACC/AHA 2018",
    category: "cardiovascular",
    riskLevel: "routine",
    icon: Droplets,
  },
  {
    name: "Blood Pressure Screening",
    description: "Screening for hypertension in adults. Confirm elevated readings with ambulatory or home monitoring.",
    ageStart: 18,
    ageEnd: 999,
    sex: "all",
    frequency: "Annually (every visit if ≥40 or at increased risk)",
    grade: "A",
    source: "USPSTF 2021",
    category: "cardiovascular",
    riskLevel: "routine",
    icon: Heart,
  },
  {
    name: "Type 2 Diabetes Screening",
    description: "Screening for prediabetes and type 2 diabetes with fasting glucose, HbA1c, or oral glucose tolerance test.",
    ageStart: 35,
    ageEnd: 70,
    sex: "all",
    frequency: "Every 3 years (if normal results); more often if overweight/obese",
    grade: "B",
    source: "USPSTF 2021",
    category: "metabolic",
    riskLevel: "routine",
    conditions: "Screen earlier if overweight/obese with additional risk factors",
    icon: Activity,
  },
  {
    name: "Bone Density (DEXA Scan)",
    description: "Dual-energy X-ray absorptiometry to screen for osteoporosis in postmenopausal women and older adults at increased fracture risk.",
    ageStart: 60,
    ageEnd: 999,
    sex: "female",
    frequency: "Every 2 years for postmenopausal women; baseline at age 65 (or 60 if risk factors)",
    grade: "B (women ≥65; younger postmenopausal women with risk factors)",
    source: "USPSTF 2018",
    category: "musculoskeletal",
    riskLevel: "routine",
    conditions: "Postmenopausal women; earlier if risk factors (low body weight, smoking, family history, steroid use)",
    icon: Bone,
  },
  {
    name: "Lung Cancer Screening (Low-Dose CT)",
    description: "Annual low-dose CT scan for adults with heavy smoking history.",
    ageStart: 50,
    ageEnd: 80,
    sex: "all",
    frequency: "Annually",
    grade: "B",
    source: "USPSTF 2021",
    category: "cancer",
    riskLevel: "high-risk",
    conditions: "20+ pack-year history AND currently smoke or quit within past 15 years",
    icon: Activity,
  },
  {
    name: "Abdominal Aortic Aneurysm (AAA) Screening",
    description: "One-time ultrasound screening for abdominal aortic aneurysm.",
    ageStart: 65,
    ageEnd: 75,
    sex: "male",
    frequency: "One-time",
    grade: "B",
    source: "USPSTF 2019",
    category: "cardiovascular",
    riskLevel: "conditional",
    conditions: "Men who have ever smoked",
    icon: Heart,
  },
  {
    name: "Depression Screening",
    description: "Screening for major depressive disorder using validated tools (PHQ-9).",
    ageStart: 12,
    ageEnd: 999,
    sex: "all",
    frequency: "Annually or as clinically indicated",
    grade: "B",
    source: "USPSTF 2016",
    category: "mental-health",
    riskLevel: "routine",
    icon: Brain,
  },
  {
    name: "Anxiety Screening",
    description: "Screening for anxiety disorders using validated questionnaires (GAD-7).",
    ageStart: 8,
    ageEnd: 64,
    sex: "all",
    frequency: "Periodically",
    grade: "B",
    source: "USPSTF 2023",
    category: "mental-health",
    riskLevel: "routine",
    icon: Brain,
  },
  {
    name: "Vision Screening",
    description: "Screening for visual acuity in children and older adults.",
    ageStart: 3,
    ageEnd: 5,
    sex: "all",
    frequency: "At least once between ages 3–5",
    grade: "B",
    source: "USPSTF 2017",
    category: "vision",
    riskLevel: "routine",
    icon: Eye,
  },
  {
    name: "Hepatitis B Screening",
    description: "Screen for hepatitis B virus infection in adolescents and adults at increased risk.",
    ageStart: 15,
    ageEnd: 999,
    sex: "all",
    frequency: "One-time (or periodic if ongoing risk)",
    grade: "B",
    source: "USPSTF 2020",
    category: "infectious",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "Hepatitis C Screening",
    description: "One-time screening for hepatitis C virus in all adults aged 18–79.",
    ageStart: 18,
    ageEnd: 79,
    sex: "all",
    frequency: "One-time",
    grade: "B",
    source: "USPSTF 2020",
    category: "infectious",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "HIV Screening",
    description: "Screen for human immunodeficiency virus infection in adolescents and adults 15–65.",
    ageStart: 15,
    ageEnd: 65,
    sex: "all",
    frequency: "At least once; more often if at increased risk",
    grade: "A",
    source: "USPSTF 2019",
    category: "infectious",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "STI Screening (Chlamydia & Gonorrhea)",
    description: "Screen sexually active women aged 24 and younger, and older women at increased risk.",
    ageStart: 15,
    ageEnd: 24,
    sex: "female",
    frequency: "Annually if sexually active",
    grade: "B",
    source: "USPSTF 2021",
    category: "infectious",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "Osteoporosis Screening (Men)",
    description: "DEXA scan for men at increased fracture risk, typically age 70+.",
    ageStart: 70,
    ageEnd: 999,
    sex: "male",
    frequency: "Per clinical judgment based on risk factors",
    grade: "I (insufficient evidence for routine); consider if risk factors present",
    source: "USPSTF / Endocrine Society",
    category: "musculoskeletal",
    riskLevel: "conditional",
    conditions: "Consider if: low body weight, previous fracture, steroid use, hypogonadism",
    icon: Bone,
  },
  {
    name: "Skin Cancer Screening",
    description: "Visual skin examination for suspicious lesions. Self-examination and clinical exam.",
    ageStart: 18,
    ageEnd: 999,
    sex: "all",
    frequency: "Self-exam regularly; clinical exam per provider judgment",
    grade: "I (insufficient evidence for general population)",
    source: "USPSTF / AAD recommends for high-risk individuals",
    category: "cancer",
    riskLevel: "conditional",
    conditions: "Higher risk: fair skin, family history, multiple moles, sun exposure history",
    icon: ShieldCheck,
  },
  {
    name: "Prediabetes Screening (Children/Adolescents)",
    description: "Screen overweight/obese children aged 10+ with additional risk factors.",
    ageStart: 10,
    ageEnd: 17,
    sex: "all",
    frequency: "Every 3 years if risk factors present",
    grade: "ADA recommendation",
    source: "ADA 2024 Standards of Care",
    category: "metabolic",
    riskLevel: "high-risk",
    conditions: "BMI ≥85th percentile AND: family history of T2DM, maternal gestational diabetes, race/ethnicity risk",
    icon: Activity,
  },
  {
    name: "Statin Therapy Evaluation",
    description: "Assess adults aged 40–75 for cardiovascular risk and statin use based on 10-year ASCVD risk.",
    ageStart: 40,
    ageEnd: 75,
    sex: "all",
    frequency: "Per risk calculation; reassess every 4–6 years",
    grade: "B (≥10% risk) / C (7.5–10% risk)",
    source: "USPSTF 2022",
    category: "cardiovascular",
    riskLevel: "routine",
    icon: Heart,
  },
  {
    name: "Aspirin for Preeclampsia Prevention",
    description: "Low-dose aspirin after 12 weeks of gestation for women at high risk of preeclampsia.",
    ageStart: 18,
    ageEnd: 45,
    sex: "female",
    frequency: "Daily during pregnancy if high-risk",
    grade: "B",
    source: "USPSTF 2021",
    category: "pregnancy",
    riskLevel: "high-risk",
    conditions: "History of preeclampsia, multifetal pregnancy, chronic hypertension, type 1/2 diabetes, kidney disease",
    icon: Baby,
  },
  {
    name: "Gestational Diabetes Screening",
    description: "Screen pregnant persons at 24 weeks of gestation.",
    ageStart: 18,
    ageEnd: 45,
    sex: "female",
    frequency: "At 24 weeks gestation",
    grade: "B",
    source: "USPSTF 2021",
    category: "pregnancy",
    riskLevel: "routine",
    icon: Baby,
  },
  {
    name: "Newborn Screening Panel",
    description: "State-mandated screening for metabolic, endocrine, hemoglobin, and other conditions at birth.",
    ageStart: 0,
    ageEnd: 0,
    sex: "all",
    frequency: "At birth (24–48 hours)",
    grade: "Mandated by state law",
    source: "HRSA RUSP / State regulations",
    category: "pediatric",
    riskLevel: "routine",
    icon: Baby,
  },
  {
    name: "Lead Screening (Children)",
    description: "Blood lead level testing for children at risk of lead exposure.",
    ageStart: 1,
    ageEnd: 5,
    sex: "all",
    frequency: "At ages 1 and 2 (or per state law); risk assessment at each well visit",
    grade: "Recommended by CDC/AAP",
    source: "CDC / AAP 2021",
    category: "pediatric",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "Hearing Screening (Newborn)",
    description: "Universal newborn hearing screening before hospital discharge.",
    ageStart: 0,
    ageEnd: 0,
    sex: "all",
    frequency: "At birth (before 1 month); diagnostic by 3 months",
    grade: "B",
    source: "USPSTF 2024",
    category: "pediatric",
    riskLevel: "routine",
    icon: ShieldCheck,
  },
  {
    name: "Scoliosis Screening (Adolescents)",
    description: "Check for abnormal spinal curvature during growth spurts.",
    ageStart: 10,
    ageEnd: 18,
    sex: "all",
    frequency: "Girls: ages 10–12 | Boys: ages 13–14",
    grade: "I (USPSTF); recommended by AAP/AAOS",
    source: "AAP / AAOS",
    category: "musculoskeletal",
    riskLevel: "routine",
    icon: Bone,
  },
];

const VACCINE_SCHEDULE: Vaccine[] = [
  { name: "Hepatitis B (HepB)", ageGroup: "Birth", ageStart: 0, ageEnd: 0, doses: "3 doses", schedule: "Birth, 1 month, 6 months", notes: "First dose within 24 hours of birth" },
  { name: "Rotavirus (RV)", ageGroup: "2–6 months", ageStart: 0, ageEnd: 0, doses: "2–3 doses", schedule: "2, 4 months (Rotarix) or 2, 4, 6 months (RotaTeq)", notes: "First dose by 15 weeks; series complete by 8 months" },
  { name: "DTaP (Diphtheria, Tetanus, Pertussis)", ageGroup: "2 months – 6 years", ageStart: 0, ageEnd: 6, doses: "5 doses", schedule: "2, 4, 6, 15–18 months, 4–6 years", notes: "Do not give DTaP to ages 7+" },
  { name: "Hib (Haemophilus influenzae type b)", ageGroup: "2–15 months", ageStart: 0, ageEnd: 1, doses: "3–4 doses", schedule: "2, 4, (6 if PRP-OMP), 12–15 months", notes: "Depends on vaccine brand" },
  { name: "PCV15 / PCV20 (Pneumococcal)", ageGroup: "2–15 months", ageStart: 0, ageEnd: 1, doses: "4 doses", schedule: "2, 4, 6, 12–15 months", notes: "PCV15 followed by PPSV23 if high-risk" },
  { name: "IPV (Polio)", ageGroup: "2 months – 6 years", ageStart: 0, ageEnd: 6, doses: "4 doses", schedule: "2, 4, 6–18 months, 4–6 years", notes: "Final dose on or after 4th birthday" },
  { name: "Influenza (Flu)", ageGroup: "6 months+", ageStart: 0, ageEnd: 999, doses: "Annually", schedule: "Every fall/winter season", notes: "2 doses first season for children <9 yrs; 1 dose annually thereafter" },
  { name: "MMR (Measles, Mumps, Rubella)", ageGroup: "12 months – 6 years", ageStart: 1, ageEnd: 6, doses: "2 doses", schedule: "12–15 months, 4–6 years", notes: "Catch-up: give 2 doses at least 28 days apart", catchUp: "2 doses 28+ days apart if not previously vaccinated" },
  { name: "Varicella (Chickenpox)", ageGroup: "12 months – 12 years", ageStart: 1, ageEnd: 12, doses: "2 doses", schedule: "12–15 months, 4–6 years", notes: "Catch-up: give 2 doses at least 3 months apart for ages <13", catchUp: "2 doses 3+ months apart if <13 yrs" },
  { name: "Hepatitis A (HepA)", ageGroup: "12–23 months", ageStart: 1, ageEnd: 2, doses: "2 doses", schedule: "12–23 months, 2nd dose 6 months after first", notes: "Catch-up through age 18 if not previously vaccinated" },
  { name: "HPV (Human Papillomavirus)", ageGroup: "9–26 years", ageStart: 9, ageEnd: 26, doses: "2–3 doses", schedule: "2 doses (6–12 months apart) if started before 15; 3 doses if 15+", notes: "FDA approved up to age 45 for shared decision-making" },
  { name: "Meningococcal ACWY (MenACWY)", ageGroup: "11–18 years", ageStart: 11, ageEnd: 18, doses: "2 doses", schedule: "11–12 years, booster at 16", notes: "Required for college entry in most states" },
  { name: "Meningococcal B (MenB)", ageGroup: "16–23 years", ageStart: 16, ageEnd: 23, doses: "2–3 doses", schedule: "Preferred at 16–18 years; shared decision-making", notes: "Especially for college students, complement deficiency, asplenia" },
  { name: "Tdap (Tetanus, Diphtheria, Pertussis)", ageGroup: "11+ years", ageStart: 11, ageEnd: 999, doses: "1 dose + Td boosters", schedule: "1 dose at 11–12 years; Td booster every 10 years", notes: "1 dose each pregnancy (27–36 weeks gestation)" },
  { name: "Shingles (Recombinant Zoster / Shingrix)", ageGroup: "50+ years", ageStart: 50, ageEnd: 999, doses: "2 doses", schedule: "2 doses, 2–6 months apart", notes: "Recommended even if previously received Zostavax or had shingles" },
  { name: "Pneumococcal (PCV20 or PCV15+PPSV23)", ageGroup: "65+ years", ageStart: 65, ageEnd: 999, doses: "1 dose (PCV20) or series", schedule: "1 dose PCV20 OR PCV15 followed by PPSV23", notes: "Earlier if immunocompromised, asplenia, cochlear implant, CSF leak" },
  { name: "COVID-19", ageGroup: "6 months+", ageStart: 0, ageEnd: 999, doses: "Updated annually", schedule: "Per CDC guidance; updated vaccine each fall", notes: "Check CDC for current formulation and schedule" },
  { name: "RSV Vaccine (Abrysvo)", ageGroup: "60+ years / Pregnancy 32–36 wks", ageStart: 60, ageEnd: 999, doses: "1 dose", schedule: "Single dose; shared decision-making for 60+", notes: "Pregnant persons: 1 dose at 32–36 weeks (Sep–Jan) to protect infant" },
  { name: "Mpox (JYNNEOS)", ageGroup: "18+ at risk", ageStart: 18, ageEnd: 999, doses: "2 doses", schedule: "2 doses, 28 days apart", notes: "Recommended for at-risk populations per CDC guidance" },
];

const VACCINE_AGE_GROUPS = [
  { label: "Birth – 12 months", minAge: 0, maxAge: 1 },
  { label: "1 – 6 years", minAge: 1, maxAge: 6 },
  { label: "7 – 12 years", minAge: 7, maxAge: 12 },
  { label: "13 – 18 years", minAge: 13, maxAge: 18 },
  { label: "19 – 26 years", minAge: 19, maxAge: 26 },
  { label: "27 – 49 years", minAge: 27, maxAge: 49 },
  { label: "50 – 64 years", minAge: 50, maxAge: 64 },
  { label: "65+ years", minAge: 65, maxAge: 999 },
];

const STATE_REGISTRIES: StateRegistry[] = [
  { state: "Alabama", abbrev: "AL", registryName: "ImmPRINT", url: "https://www.alabamapublichealth.gov/immunization/immprint.html" },
  { state: "Alaska", abbrev: "AK", registryName: "VacTrAK", url: "https://prior.prior.health.alaska.gov/prior/index.jsf" },
  { state: "Arizona", abbrev: "AZ", registryName: "ASIIS", url: "https://asiis.azdhs.gov/" },
  { state: "Arkansas", abbrev: "AR", registryName: "WebIZ", url: "https://www.healthy.arkansas.gov/programs-services/topics/immunizations" },
  { state: "California", abbrev: "CA", registryName: "CAIR2", url: "https://cairweb.org/" },
  { state: "Colorado", abbrev: "CO", registryName: "CIIS", url: "https://cdphe.colorado.gov/ciis" },
  { state: "Connecticut", abbrev: "CT", registryName: "CT WiZ", url: "https://portal.ct.gov/DPH/Immunizations/Immunization--CT-WiZ" },
  { state: "Delaware", abbrev: "DE", registryName: "DelVAX", url: "https://dhss.delaware.gov/dhss/dph/dpc/immunize.html" },
  { state: "Florida", abbrev: "FL", registryName: "Florida SHOTS", url: "https://www.flshotsusers.com/" },
  { state: "Georgia", abbrev: "GA", registryName: "GRITS", url: "https://dph.georgia.gov/grits" },
  { state: "Hawaii", abbrev: "HI", registryName: "HIR", url: "https://health.hawaii.gov/docd/vaccines-immunizations/" },
  { state: "Idaho", abbrev: "ID", registryName: "IRIS", url: "https://iris.dhw.idaho.gov/" },
  { state: "Illinois", abbrev: "IL", registryName: "I-CARE", url: "https://dph.illinois.gov/topics-services/prevention-wellness/immunization/icare.html" },
  { state: "Indiana", abbrev: "IN", registryName: "CHIRP", url: "https://chirp.in.gov/" },
  { state: "Iowa", abbrev: "IA", registryName: "IRIS", url: "https://iris.iowa.gov/" },
  { state: "Kansas", abbrev: "KS", registryName: "WebIZ/KSWebIZ", url: "https://www.kdhe.ks.gov/284/Kansas-Immunization-Registry" },
  { state: "Kentucky", abbrev: "KY", registryName: "KYIR", url: "https://chfs.ky.gov/agencies/dph/dehp/idb/Pages/kyir.aspx" },
  { state: "Louisiana", abbrev: "LA", registryName: "LINKS", url: "https://links.la.gov/" },
  { state: "Maine", abbrev: "ME", registryName: "ImmPact2", url: "https://www.maine.gov/dhhs/mecdc/infectious-disease/immunization/immpact.shtml" },
  { state: "Maryland", abbrev: "MD", registryName: "ImmuNet", url: "https://phpa.health.maryland.gov/OIDEOR/IMMUN/Pages/immunet.aspx" },
  { state: "Massachusetts", abbrev: "MA", registryName: "MIIS", url: "https://www.mass.gov/massachusetts-immunization-information-system-miis" },
  { state: "Michigan", abbrev: "MI", registryName: "MCIR", url: "https://www.mcir.org/" },
  { state: "Minnesota", abbrev: "MN", registryName: "MIIC", url: "https://www.health.state.mn.us/people/immunize/miic/index.html" },
  { state: "Mississippi", abbrev: "MS", registryName: "MIIX", url: "https://msdh.ms.gov/msdhsite/_static/14,0,71.html" },
  { state: "Missouri", abbrev: "MO", registryName: "ShowMeVax", url: "https://health.mo.gov/living/wellness/immunizations/showmevax.php" },
  { state: "Montana", abbrev: "MT", registryName: "imMTrax", url: "https://dphhs.mt.gov/publichealth/immunization/immtrax" },
  { state: "Nebraska", abbrev: "NE", registryName: "NESIIS", url: "https://dhhs.ne.gov/Pages/Immunization-Program.aspx" },
  { state: "Nevada", abbrev: "NV", registryName: "WebIZ", url: "https://dpbh.nv.gov/Programs/Immunization/" },
  { state: "New Hampshire", abbrev: "NH", registryName: "VINI", url: "https://www.dhhs.nh.gov/dphs/immunization/" },
  { state: "New Jersey", abbrev: "NJ", registryName: "NJIIS", url: "https://www.nj.gov/health/cd/imm/njiis/" },
  { state: "New Mexico", abbrev: "NM", registryName: "NMSIIS", url: "https://nmhealth.org/about/erd/ideb/siis/" },
  { state: "New York", abbrev: "NY", registryName: "NYSIIS/CIR", url: "https://www.health.ny.gov/prevention/immunization/information_system/" },
  { state: "North Carolina", abbrev: "NC", registryName: "CVMS", url: "https://immunize.nc.gov/" },
  { state: "North Dakota", abbrev: "ND", registryName: "NDIIS", url: "https://www.health.nd.gov/immunize/north-dakota-immunization-information-system-ndiis" },
  { state: "Ohio", abbrev: "OH", registryName: "ImpactSIIS", url: "https://odh.ohio.gov/know-our-programs/immunization/impactsiis" },
  { state: "Oklahoma", abbrev: "OK", registryName: "OSIIS", url: "https://oklahoma.gov/health/health-education/immunization-service/osiis.html" },
  { state: "Oregon", abbrev: "OR", registryName: "ALERT IIS", url: "https://www.oregon.gov/oha/PH/PREVENTIONWELLNESS/VACCINESIMMUNIZATION/Pages/alert.aspx" },
  { state: "Pennsylvania", abbrev: "PA", registryName: "PA-SIIS / PhilaVax", url: "https://www.health.pa.gov/topics/programs/immunizations/Pages/SIIS.aspx" },
  { state: "Rhode Island", abbrev: "RI", registryName: "KIDSNET", url: "https://health.ri.gov/programs/detail.php?pgm_id=1066" },
  { state: "South Carolina", abbrev: "SC", registryName: "SIMON", url: "https://scdhec.gov/health/vaccinations-immunizations" },
  { state: "South Dakota", abbrev: "SD", registryName: "SDIIS", url: "https://doh.sd.gov/diseases/immunization/iis.aspx" },
  { state: "Tennessee", abbrev: "TN", registryName: "TennIIS", url: "https://www.tn.gov/health/health-program-areas/immunization-program/ip/tenniis.html" },
  { state: "Texas", abbrev: "TX", registryName: "ImmTrac2", url: "https://www.dshs.texas.gov/immunization/immtrac/" },
  { state: "Utah", abbrev: "UT", registryName: "USIIS", url: "https://usiis.utah.gov/" },
  { state: "Vermont", abbrev: "VT", registryName: "IMR", url: "https://www.healthvermont.gov/immunizations-testing/immunization/immunization-registry" },
  { state: "Virginia", abbrev: "VA", registryName: "VIIS", url: "https://www.vdh.virginia.gov/immunization/viis/" },
  { state: "Washington", abbrev: "WA", registryName: "WA IIS", url: "https://www.doh.wa.gov/YouandYourFamily/Immunization/ImmunizationInformationSystem" },
  { state: "West Virginia", abbrev: "WV", registryName: "WVSIIS", url: "https://oeps.wv.gov/immunizations/Pages/default.aspx" },
  { state: "Wisconsin", abbrev: "WI", registryName: "WIR", url: "https://www.dhs.wisconsin.gov/immunization/wir.htm" },
  { state: "Wyoming", abbrev: "WY", registryName: "WyIR", url: "https://health.wyo.gov/publichealth/immunization/wyir/" },
  { state: "District of Columbia", abbrev: "DC", registryName: "DOCIIS", url: "https://dchealth.dc.gov/service/immunization-registry" },
];

const CATEGORIES: Record<string, { label: string; color: string }> = {
  cardiovascular: { label: "Cardiovascular", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  cancer: { label: "Cancer", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  metabolic: { label: "Metabolic", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  musculoskeletal: { label: "Musculoskeletal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  "mental-health": { label: "Mental Health", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  vision: { label: "Vision", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  infectious: { label: "Infectious Disease", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  pregnancy: { label: "Pregnancy", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300" },
  pediatric: { label: "Pediatric", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
};

function ScreeningsTab() {
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<Sex | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    return SCREENINGS.filter((s) => {
      if (age !== "" && (age < s.ageStart || age > s.ageEnd)) return false;
      if (sex && s.sex !== "all" && s.sex !== sex) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase()) && !s.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [age, sex, categoryFilter, searchTerm]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Filter by Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="screen-age" className="text-xs">Age</Label>
              <Input
                id="screen-age"
                type="number"
                placeholder="Enter age"
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : "")}
                data-testid="input-screening-age"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as Sex | "")}>
                <SelectTrigger data-testid="select-screening-sex">
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-screening-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search screenings..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                  data-testid="input-screening-search"
                />
              </div>
            </div>
          </div>
          {(age !== "" || sex || categoryFilter !== "all" || searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => { setAge(""); setSex(""); setCategoryFilter("all"); setSearchTerm(""); }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {SCREENINGS.length} screenings
          {age !== "" && ` for age ${age}`}
          {sex && ` (${sex})`}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-screenings">
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((s, i) => {
          const IconComp = s.icon;
          const catStyle = CATEGORIES[s.category];
          return (
            <Card key={i} data-testid={`screening-card-${i}`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-primary/10">
                    <IconComp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-sm">{s.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${catStyle?.color || ""}`}>{catStyle?.label || s.category}</Badge>
                          <Badge variant={s.riskLevel === "routine" ? "secondary" : "outline"} className="text-xs">
                            {s.riskLevel === "routine" ? "Routine" : s.riskLevel === "high-risk" ? "High-Risk Only" : "Conditional"}
                          </Badge>
                          {s.sex !== "all" && (
                            <Badge variant="outline" className="text-xs">{s.sex === "male" ? "Men" : "Women"}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium text-muted-foreground">Ages</span>
                        <p className="text-sm font-semibold">
                          {s.ageStart === 0 && s.ageEnd === 0 ? "Birth" : `${s.ageStart}${s.ageEnd >= 999 ? "+" : `–${s.ageEnd}`}`}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                    <div className="grid gap-1 text-xs">
                      <div className="flex items-start gap-1.5">
                        <span className="font-medium text-foreground shrink-0">Frequency:</span>
                        <span className="text-muted-foreground">{s.frequency}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-medium text-foreground shrink-0">Grade:</span>
                        <span className="text-muted-foreground">{s.grade}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-medium text-foreground shrink-0">Source:</span>
                        <span className="text-muted-foreground">{s.source}</span>
                      </div>
                      {s.conditions && (
                        <div className="flex items-start gap-1.5 mt-1 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-amber-700 dark:text-amber-300">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{s.conditions}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No screenings match your filters</p>
            <p className="text-sm mt-1">Try adjusting the age, sex, or category filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VaccineTab() {
  const [expandedGroup, setExpandedGroup] = useState<string | undefined>(undefined);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Comprehensive immunization schedule based on CDC/ACIP recommendations, grouped by age.
      </p>

      <Accordion type="single" collapsible value={expandedGroup} onValueChange={setExpandedGroup} className="w-full">
        {VACCINE_AGE_GROUPS.map((group, gIdx) => {
          const groupVaccines = VACCINE_SCHEDULE.filter(
            (v) => v.ageStart <= group.maxAge && v.ageEnd >= group.minAge
          );
          if (groupVaccines.length === 0) return null;
          return (
            <AccordionItem key={gIdx} value={`group-${gIdx}`}>
              <AccordionTrigger className="hover:no-underline" data-testid={`accordion-vaccine-group-${gIdx}`}>
                <div className="flex items-center gap-2 flex-1">
                  <Syringe className="h-4 w-4 text-primary" />
                  <span className="font-medium">{group.label}</span>
                  <Badge variant="secondary" className="ml-auto mr-4 text-xs">{groupVaccines.length} vaccines</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pl-6">
                  {groupVaccines.map((v, vIdx) => (
                    <div key={vIdx} className="border rounded-lg p-3 space-y-1.5" data-testid={`vaccine-item-${gIdx}-${vIdx}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{v.name}</h4>
                        <Badge variant="outline" className="text-xs">{v.doses}</Badge>
                      </div>
                      <div className="grid gap-1 text-xs">
                        <div className="flex items-start gap-1.5">
                          <span className="font-medium shrink-0">Schedule:</span>
                          <span className="text-muted-foreground">{v.schedule}</span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="font-medium shrink-0">Notes:</span>
                          <span className="text-muted-foreground">{v.notes}</span>
                        </div>
                        {v.catchUp && (
                          <div className="flex items-start gap-1.5 mt-1 p-1.5 bg-blue-50 dark:bg-blue-950/30 rounded text-blue-700 dark:text-blue-300">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Catch-up: {v.catchUp}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-vaccines">
        <Printer className="h-4 w-4 mr-2" /> Print Schedule
      </Button>
    </div>
  );
}

function RegistryTab() {
  const [searchState, setSearchState] = useState("");

  const filtered = useMemo(() => {
    if (!searchState) return STATE_REGISTRIES;
    const term = searchState.toLowerCase();
    return STATE_REGISTRIES.filter(
      (r) =>
        r.state.toLowerCase().includes(term) ||
        r.abbrev.toLowerCase() === term ||
        r.registryName.toLowerCase().includes(term)
    );
  }, [searchState]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Find your state's immunization information system (IIS) to view or share your vaccination records.
      </p>

      <div className="relative max-w-sm">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input
          placeholder="Search by state name or abbreviation..."
          value={searchState}
          onChange={(e) => setSearchState(e.target.value)}
          className="pl-8"
          data-testid="input-registry-search"
        />
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">State</TableHead>
              <TableHead>Registry Name</TableHead>
              <TableHead className="w-[100px] text-right">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={i} data-testid={`registry-row-${r.abbrev.toLowerCase()}`}>
                <TableCell className="font-medium">
                  {r.state} <span className="text-muted-foreground">({r.abbrev})</span>
                </TableCell>
                <TableCell className="text-sm">{r.registryName}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" data-testid={`link-registry-${r.abbrev.toLowerCase()}`}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  No states match "{searchState}"
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PreventiveScreeningPage() {
  useSEO({
    title: "Preventive Screening & Immunizations | Tabula Medica",
    description: "Comprehensive preventive health screening guidelines by age and sex, vaccination schedules, and state immunization registry directory",
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ShieldCheck className="h-7 w-7 text-primary" />
            Preventive Screening & Immunizations
          </h1>
          <p className="text-muted-foreground mt-1">
            USPSTF, ACC/AHA, and CDC guidelines for preventive care — personalized by age and sex
          </p>
        </div>

        <Tabs defaultValue="screenings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="screenings" data-testid="tab-screenings" className="gap-2">
              <Stethoscope className="h-4 w-4" /> Screenings
            </TabsTrigger>
            <TabsTrigger value="vaccines" data-testid="tab-vaccines" className="gap-2">
              <Syringe className="h-4 w-4" /> Vaccines
            </TabsTrigger>
            <TabsTrigger value="registries" data-testid="tab-registries" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> State Registries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="screenings" className="mt-6">
            <ScreeningsTab />
          </TabsContent>

          <TabsContent value="vaccines" className="mt-6">
            <VaccineTab />
          </TabsContent>

          <TabsContent value="registries" className="mt-6">
            <RegistryTab />
          </TabsContent>
        </Tabs>

        <Card className="border-muted">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                This information is for educational reference only based on published USPSTF, ACC/AHA, AAP, ADA, and CDC/ACIP guidelines. 
                It does not constitute medical advice. Consult your healthcare provider for personalized screening and immunization recommendations. 
                Guidelines are updated periodically — always verify with the latest published recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
