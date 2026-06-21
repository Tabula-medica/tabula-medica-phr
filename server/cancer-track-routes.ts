import { Router } from "express";
import { storage } from "./storage";
import {
  insertCancerBasicsSchema,
  insertCancerTimelineEntrySchema,
  insertCancerDocumentSchema,
  CancerBasics,
  CancerTimelineEntry,
  CancerDocument,
  cancerFolderTypes,
  CancerFolderType,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { verifyCaregiverConsent } from "./caregiver-permissions-routes";

const router = Router();

const cancerBasicsStore: Map<string, CancerBasics> = new Map();
const cancerTimelineStore: Map<string, CancerTimelineEntry> = new Map();
const cancerDocumentsStore: Map<string, CancerDocument> = new Map();

function initializeSampleData() {
  const sampleCancerId = "cancer-1";
  const sampleProfileId = "profile-default";
  
  if (!cancerBasicsStore.has(sampleCancerId)) {
    cancerBasicsStore.set(sampleCancerId, {
      id: sampleCancerId,
      profileId: sampleProfileId,
      cancerType: "breast",
      subtype: "Invasive Ductal Carcinoma",
      stage: "IIA",
      diagnosisDate: "2024-03-15",
      biomarkers: [
        { name: "ER (Estrogen Receptor)", value: "Positive (95%)", status: "positive", testedAt: "2024-03-20" },
        { name: "PR (Progesterone Receptor)", value: "Positive (85%)", status: "positive", testedAt: "2024-03-20" },
        { name: "HER2/neu", value: "Negative (IHC 1+)", status: "negative", testedAt: "2024-03-20" },
        { name: "Ki-67 Proliferation Index", value: "15% (Low)", status: "positive", testedAt: "2024-03-20" },
        { name: "BRCA1 Gene Mutation", value: "Not Detected", status: "negative", testedAt: "2024-03-25" },
        { name: "BRCA2 Gene Mutation", value: "Not Detected", status: "negative", testedAt: "2024-03-25" },
        { name: "Oncotype DX Recurrence Score", value: "18 (Low Risk)", status: "positive", testedAt: "2024-04-05" },
        { name: "PD-L1 Expression", value: "Negative (<1%)", status: "negative", testedAt: "2024-03-22" },
        { name: "PIK3CA Mutation", value: "Not Detected", status: "negative", testedAt: "2024-03-25" },
        { name: "Tumor Grade", value: "Grade 2 (Moderately Differentiated)", status: "positive", testedAt: "2024-03-20" },
        { name: "Lymphovascular Invasion", value: "Not Identified", status: "negative", testedAt: "2024-04-01" },
        { name: "Surgical Margins", value: "Negative (Clear)", status: "negative", testedAt: "2024-04-01" },
      ],
      treatmentCenters: [
        { name: "City Cancer Center", address: "123 Medical Dr, City, ST 12345", phone: "(555) 123-4567", isPrimary: true },
        { name: "University Medical Center Oncology", address: "456 University Ave, City, ST 12346", phone: "(555) 987-6543", isPrimary: false },
      ],
      oncologists: [
        { name: "Dr. Sarah Johnson", specialty: "Medical Oncology", facility: "City Cancer Center", phone: "(555) 123-4568", isPrimary: true },
        { name: "Dr. Michael Chen", specialty: "Radiation Oncology", facility: "City Cancer Center", phone: "(555) 123-4569", isPrimary: false },
        { name: "Dr. Emily Roberts", specialty: "Surgical Oncology / Breast Surgery", facility: "City Cancer Center", phone: "(555) 123-4570", isPrimary: false },
        { name: "Dr. Amanda Williams", specialty: "Genetic Counseling", facility: "University Medical Center", phone: "(555) 987-6544", isPrimary: false },
        { name: "Dr. Robert Kim", specialty: "Pathology", facility: "City Cancer Center Pathology", phone: "(555) 123-4571", isPrimary: false },
      ],
      notes: "ER+/PR+/HER2- (Luminal A subtype). Low Oncotype DX score indicates low recurrence risk and reduced benefit from chemotherapy. BRCA1/2 negative - no hereditary component detected. This is a summary for informational purposes only and not medical advice.",
      isActive: true,
      inRemission: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const timelineEntries: CancerTimelineEntry[] = [
      {
        id: "timeline-0",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        treatmentType: "diagnosis",
        title: "Cancer Diagnosis - Invasive Ductal Carcinoma",
        startDate: "2024-03-15",
        isOngoing: false,
        facility: "City Cancer Center",
        provider: "Dr. Sarah Johnson",
        details: {
          outcome: "Stage IIA - ER+/PR+/HER2-",
        },
        notes: "Initial cancer diagnosis confirmed via biopsy. Invasive Ductal Carcinoma, Stage IIA, Biomarkers: ER+/PR+/HER2-. Refer to pathology report for complete details.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "timeline-1",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        treatmentType: "surgery",
        title: "Lumpectomy with Sentinel Node Biopsy",
        startDate: "2024-04-01",
        isOngoing: false,
        facility: "City Cancer Center",
        provider: "Dr. Emily Roberts",
        details: {
          surgeryType: "Lumpectomy",
          surgeonName: "Dr. Emily Roberts",
          outcome: "Procedure completed per surgical report",
        },
        sideEffects: [
          { name: "Post-surgical pain", severity: "moderate", startedAt: "2024-04-01", resolvedAt: "2024-04-15", isOngoing: false },
        ],
        notes: "Surgical procedure completed on scheduled date.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "timeline-2",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        treatmentType: "chemotherapy",
        title: "AC-T Chemotherapy Regimen",
        startDate: "2024-05-01",
        endDate: "2024-09-15",
        isOngoing: false,
        facility: "City Cancer Center",
        provider: "Dr. Sarah Johnson",
        details: {
          drugs: ["Doxorubicin (Adriamycin)", "Cyclophosphamide", "Paclitaxel (Taxol)"],
          cycleNumber: 8,
          totalCycles: 8,
          outcome: "All cycles completed per schedule",
        },
        sideEffects: [
          { name: "Nausea", severity: "moderate", startedAt: "2024-05-01", resolvedAt: "2024-09-20", isOngoing: false },
          { name: "Fatigue", severity: "moderate", startedAt: "2024-05-01", resolvedAt: "2024-10-01", isOngoing: false },
          { name: "Hair loss", severity: "moderate", startedAt: "2024-05-15", isOngoing: false },
          { name: "Neuropathy", severity: "mild", startedAt: "2024-07-01", isOngoing: true },
        ],
        notes: "Chemotherapy cycles 1-6 completed per protocol.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "timeline-3",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        treatmentType: "radiation",
        title: "Whole Breast Radiation",
        startDate: "2024-10-01",
        endDate: "2024-11-15",
        isOngoing: false,
        facility: "City Cancer Center",
        provider: "Dr. Michael Chen",
        details: {
          radiationSite: "Left breast",
          radiationDose: "50 Gy",
          radiationFractions: 25,
          outcome: "All sessions completed per schedule",
        },
        sideEffects: [
          { name: "Skin irritation", severity: "mild", startedAt: "2024-10-15", resolvedAt: "2024-12-01", isOngoing: false },
          { name: "Fatigue", severity: "mild", startedAt: "2024-10-20", resolvedAt: "2024-12-15", isOngoing: false },
        ],
        notes: "Radiation sessions completed per treatment schedule.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "timeline-4",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        treatmentType: "hormone_therapy",
        title: "Tamoxifen Therapy",
        startDate: "2024-11-20",
        isOngoing: true,
        facility: "City Cancer Center",
        provider: "Dr. Sarah Johnson",
        details: {
          drugs: ["Tamoxifen 20mg daily"],
        },
        sideEffects: [
          { name: "Hot flashes", severity: "mild", startedAt: "2024-12-01", isOngoing: true },
        ],
        notes: "Hormone therapy initiated on scheduled timeline.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    timelineEntries.forEach(entry => cancerTimelineStore.set(entry.id, entry));

    const documents: CancerDocument[] = [
      {
        id: "doc-1",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "pathology_reports",
        title: "Initial Biopsy Pathology Report",
        fileName: "biopsy-pathology-2024-03-15.pdf",
        documentDate: "2024-03-15",
        provider: "Dr. Lisa Park",
        facility: "City Cancer Center Pathology",
        summary: "Invasive ductal carcinoma, Grade 2, ER+/PR+/HER2-",
        tags: ["biopsy", "diagnosis", "IDC"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-2",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "imaging",
        title: "Diagnostic Mammogram & Ultrasound",
        fileName: "mammogram-ultrasound-2024-03-10.pdf",
        documentDate: "2024-03-10",
        provider: "Dr. James Wilson",
        facility: "City Cancer Center Imaging",
        summary: "1.8cm mass in left breast, upper outer quadrant",
        tags: ["mammogram", "ultrasound", "diagnosis"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-3",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "treatment_surgery",
        title: "Lumpectomy Operative Report",
        fileName: "lumpectomy-op-note-2024-04-01.pdf",
        documentDate: "2024-04-01",
        provider: "Dr. Emily Roberts",
        facility: "City Cancer Center",
        summary: "Lumpectomy with sentinel node biopsy performed",
        tags: ["surgery", "lumpectomy", "sentinel node"],
        isAutoFiled: false,
        linkedTimelineEntryId: "timeline-1",
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-4",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "chemo_orders",
        title: "AC-T Chemotherapy Orders",
        fileName: "chemo-orders-2024-05-01.pdf",
        documentDate: "2024-05-01",
        provider: "Dr. Sarah Johnson",
        facility: "City Cancer Center",
        summary: "AC-T regimen: 4 cycles AC followed by 4 cycles T",
        tags: ["chemotherapy", "AC-T", "treatment plan"],
        isAutoFiled: false,
        linkedTimelineEntryId: "timeline-2",
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-5",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "labs",
        title: "CBC - Pre-Chemo Cycle 1",
        fileName: "cbc-2024-05-01.pdf",
        documentDate: "2024-05-01",
        provider: "City Cancer Center Lab",
        facility: "City Cancer Center",
        summary: "WBC 6.2, Hgb 13.5, Plt 245 - All values within normal limits",
        tags: ["labs", "CBC", "pre-treatment"],
        isAutoFiled: true,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "system",
      },
      {
        id: "doc-6",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "molecular_biomarkers",
        title: "BRCA1/BRCA2 Genetic Testing Results",
        fileName: "genetic-testing-brca-2024-03-25.pdf",
        documentDate: "2024-03-25",
        provider: "Dr. Amanda Williams",
        facility: "University Medical Center Genetics",
        summary: "BRCA1/BRCA2 mutations not detected. No pathogenic variants identified. Hereditary breast cancer syndrome not indicated.",
        tags: ["genetics", "BRCA", "hereditary", "genetic testing"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-7",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "molecular_biomarkers",
        title: "Oncotype DX Breast Recurrence Score",
        fileName: "oncotype-dx-2024-04-05.pdf",
        documentDate: "2024-04-05",
        provider: "Genomic Health / Exact Sciences",
        facility: "City Cancer Center",
        summary: "Recurrence Score: 18 (Low Risk). 10-year distant recurrence risk: 7%. Limited benefit expected from adjuvant chemotherapy.",
        tags: ["oncotype", "genomic", "recurrence score", "prognosis"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-8",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "tumor_board_notes",
        title: "Multidisciplinary Tumor Board Discussion",
        fileName: "tumor-board-2024-03-28.pdf",
        documentDate: "2024-03-28",
        provider: "Tumor Board Committee",
        facility: "City Cancer Center",
        summary: "Case reviewed by multidisciplinary team. Recommendation: Lumpectomy + sentinel node biopsy, followed by adjuvant radiation and endocrine therapy. Chemotherapy benefit limited per Oncotype DX.",
        tags: ["tumor board", "multidisciplinary", "treatment plan"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "provider",
      },
      {
        id: "doc-9",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "imaging_pet_ct",
        title: "Baseline PET/CT Scan",
        fileName: "pet-ct-baseline-2024-03-22.pdf",
        documentDate: "2024-03-22",
        provider: "Dr. Jennifer Lee",
        facility: "City Cancer Center Imaging",
        summary: "FDG-avid left breast mass. No evidence of distant metastatic disease. Axillary lymph nodes unremarkable. Consistent with Stage IIA disease.",
        tags: ["PET", "CT", "staging", "baseline", "imaging"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-10",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "imaging_mri",
        title: "Breast MRI with Contrast",
        fileName: "breast-mri-2024-03-18.pdf",
        documentDate: "2024-03-18",
        provider: "Dr. Jennifer Lee",
        facility: "City Cancer Center Imaging",
        summary: "1.8 cm enhancing mass in left breast upper outer quadrant. No additional suspicious lesions. No chest wall involvement.",
        tags: ["MRI", "breast imaging", "staging"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-11",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "treatment_radiation",
        title: "Radiation Therapy Treatment Summary",
        fileName: "radiation-summary-2024-11-15.pdf",
        documentDate: "2024-11-15",
        provider: "Dr. Michael Chen",
        facility: "City Cancer Center Radiation Oncology",
        summary: "Whole breast radiation completed. Total dose: 50 Gy in 25 fractions. Boost to lumpectomy cavity: 10 Gy in 5 fractions. Treatment tolerated well.",
        tags: ["radiation", "treatment summary", "completion"],
        isAutoFiled: false,
        linkedTimelineEntryId: "timeline-3",
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-12",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "labs_tumor_markers",
        title: "CA 27-29 Tumor Marker - Baseline",
        fileName: "ca27-29-baseline-2024-04-10.pdf",
        documentDate: "2024-04-10",
        provider: "City Cancer Center Lab",
        facility: "City Cancer Center",
        summary: "CA 27-29: 22 U/mL (Reference: <38 U/mL). Within normal limits. Baseline established for surveillance.",
        tags: ["tumor marker", "CA 27-29", "baseline", "surveillance"],
        isAutoFiled: true,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "system",
      },
      {
        id: "doc-13",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "survivorship_care_plan",
        title: "Survivorship Care Plan",
        fileName: "survivorship-care-plan-2024-12-01.pdf",
        documentDate: "2024-12-01",
        provider: "Dr. Sarah Johnson",
        facility: "City Cancer Center",
        summary: "Comprehensive survivorship plan including: Tamoxifen 20mg daily x 5 years, annual mammogram, clinical exams every 6 months x 2 years then annually, bone density monitoring.",
        tags: ["survivorship", "care plan", "follow-up", "monitoring"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-14",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "infusion_summaries",
        title: "Chemotherapy Infusion Summary - Cycle 1",
        fileName: "chemo-infusion-cycle1-2024-05-01.pdf",
        documentDate: "2024-05-01",
        provider: "Dr. Sarah Johnson",
        facility: "City Cancer Center Infusion Center",
        summary: "AC Cycle 1 administered. Doxorubicin 60mg/m² + Cyclophosphamide 600mg/m². Pre-medications given. Tolerated well, no immediate reactions.",
        tags: ["chemotherapy", "infusion", "AC regimen", "cycle 1"],
        isAutoFiled: false,
        linkedTimelineEntryId: "timeline-2",
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
      {
        id: "doc-15",
        profileId: sampleProfileId,
        cancerId: sampleCancerId,
        folderType: "notes_medical_oncology",
        title: "Medical Oncology Follow-up Note",
        fileName: "oncology-followup-2025-01-15.pdf",
        documentDate: "2025-01-15",
        provider: "Dr. Sarah Johnson",
        facility: "City Cancer Center",
        summary: "3-month post-treatment follow-up. Patient tolerating Tamoxifen. Mild hot flashes managed with lifestyle modifications. No concerning symptoms. Continue current regimen.",
        tags: ["follow-up", "oncology", "post-treatment", "surveillance"],
        isAutoFiled: false,
        uploadedAt: new Date().toISOString(),
        uploadedBy: "patient",
      },
    ];

    documents.forEach(doc => cancerDocumentsStore.set(doc.id, doc));
  }
}

initializeSampleData();

router.get("/api/cancer-track/profiles/:profileId", (req, res) => {
  const { profileId } = req.params;
  const cancers = Array.from(cancerBasicsStore.values()).filter(c => c.profileId === profileId);
  res.json(cancers);
});

router.get("/api/cancer-track/:cancerId", (req, res) => {
  const { cancerId } = req.params;
  const cancer = cancerBasicsStore.get(cancerId);
  if (!cancer) {
    return res.status(404).json({ error: "Cancer track not found" });
  }
  res.json(cancer);
});

router.post("/api/cancer-track", (req, res) => {
  const parseResult = insertCancerBasicsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const cancer: CancerBasics = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  cancerBasicsStore.set(id, cancer);
  res.status(201).json(cancer);
});

router.patch("/api/cancer-track/:cancerId", (req, res) => {
  const { cancerId } = req.params;
  const existing = cancerBasicsStore.get(cancerId);
  if (!existing) {
    return res.status(404).json({ error: "Cancer track not found" });
  }

  const updated: CancerBasics = {
    ...existing,
    ...req.body,
    id: cancerId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  cancerBasicsStore.set(cancerId, updated);
  res.json(updated);
});

router.get("/api/cancer-track/:cancerId/timeline", (req, res) => {
  const { cancerId } = req.params;
  const entries = Array.from(cancerTimelineStore.values())
    .filter(e => e.cancerId === cancerId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  res.json(entries);
});

router.post("/api/cancer-track/:cancerId/timeline", (req, res) => {
  const { cancerId } = req.params;
  const parseResult = insertCancerTimelineEntrySchema.safeParse({ ...req.body, cancerId });
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const entry: CancerTimelineEntry = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  cancerTimelineStore.set(id, entry);
  res.status(201).json(entry);
});

router.patch("/api/cancer-track/:cancerId/timeline/:entryId", (req, res) => {
  const { entryId } = req.params;
  const existing = cancerTimelineStore.get(entryId);
  if (!existing) {
    return res.status(404).json({ error: "Timeline entry not found" });
  }

  const updated: CancerTimelineEntry = {
    ...existing,
    ...req.body,
    id: entryId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  cancerTimelineStore.set(entryId, updated);
  res.json(updated);
});

router.delete("/api/cancer-track/:cancerId/timeline/:entryId", (req, res) => {
  const { entryId } = req.params;
  if (!cancerTimelineStore.has(entryId)) {
    return res.status(404).json({ error: "Timeline entry not found" });
  }
  cancerTimelineStore.delete(entryId);
  res.status(204).send();
});

router.get("/api/cancer-track/:cancerId/documents", (req, res) => {
  const { cancerId } = req.params;
  const { folder } = req.query;
  
  let documents = Array.from(cancerDocumentsStore.values()).filter(d => d.cancerId === cancerId);
  
  if (folder && cancerFolderTypes.includes(folder as CancerFolderType)) {
    documents = documents.filter(d => d.folderType === folder);
  }
  
  documents.sort((a, b) => new Date(b.documentDate).getTime() - new Date(a.documentDate).getTime());
  res.json(documents);
});

router.get("/api/cancer-track/:cancerId/folders", (req, res) => {
  const { cancerId } = req.params;
  const documents = Array.from(cancerDocumentsStore.values()).filter(d => d.cancerId === cancerId);
  
  const folderCounts: Record<string, number> = {};
  cancerFolderTypes.forEach(folder => {
    folderCounts[folder] = documents.filter(d => d.folderType === folder).length;
  });
  
  res.json(folderCounts);
});

router.post("/api/cancer-track/:cancerId/documents", (req, res) => {
  const { cancerId } = req.params;
  const parseResult = insertCancerDocumentSchema.safeParse({ ...req.body, cancerId });
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const document: CancerDocument = {
    ...parseResult.data,
    id,
    uploadedAt: new Date().toISOString(),
    uploadedBy: "patient",
  };

  cancerDocumentsStore.set(id, document);
  res.status(201).json(document);
});

router.post("/api/cancer-track/suggest-folder", (req, res) => {
  const { fileName, documentText } = req.body;
  
  const lowercaseText = (documentText || fileName || "").toLowerCase();
  
  let suggestedFolder: CancerFolderType = "other";
  let confidence = 0.5;
  
  if (/pathology|biopsy|histology|cytology/.test(lowercaseText)) {
    suggestedFolder = "pathology_reports";
    confidence = 0.9;
  } else if (/ct scan|mri|pet|imaging|mammogram|ultrasound|x-ray|radiology/.test(lowercaseText)) {
    suggestedFolder = "imaging";
    confidence = 0.9;
  } else if (/oncology|oncologist|cancer care|treatment plan/.test(lowercaseText)) {
    suggestedFolder = "oncology_notes";
    confidence = 0.8;
  } else if (/chemo|chemotherapy|regimen|drug order/.test(lowercaseText)) {
    suggestedFolder = "chemo_orders";
    confidence = 0.9;
  } else if (/infusion|infused|treatment session/.test(lowercaseText)) {
    suggestedFolder = "infusion_summaries";
    confidence = 0.85;
  } else if (/radiation|radiotherapy|treatment summary|gy|gray/.test(lowercaseText)) {
    suggestedFolder = "treatment_radiation";
    confidence = 0.85;
  } else if (/operative|surgery|surgical|procedure|resection/.test(lowercaseText)) {
    suggestedFolder = "treatment_surgery";
    confidence = 0.9;
  } else if (/tumor board|multidisciplinary|mdt/.test(lowercaseText)) {
    suggestedFolder = "tumor_board_notes";
    confidence = 0.9;
  } else if (/lab|cbc|cmp|tumor marker|cea|ca-125|psa|afp/.test(lowercaseText)) {
    suggestedFolder = "labs";
    confidence = 0.85;
  } else if (/survivorship|follow.up|surveillance|after treatment/.test(lowercaseText)) {
    suggestedFolder = "survivorship_care_plan";
    confidence = 0.8;
  } else if (/complication|late effect|long.term|chronic/.test(lowercaseText)) {
    suggestedFolder = "complications";
    confidence = 0.75;
  }
  
  res.json({
    suggestedFolder,
    confidence,
    isCancerRelated: confidence > 0.6,
  });
});

router.post("/api/cancer-track/:cancerId/timeline/caregiver", async (req, res) => {
  const { cancerId } = req.params;
  const { caregiverId, caregiverName, ...entryData } = req.body;
  
  if (!caregiverId || !caregiverName) {
    return res.status(400).json({ error: "Caregiver ID and name are required" });
  }

  const cancer = cancerBasicsStore.get(cancerId);
  if (!cancer) {
    return res.status(404).json({ error: "Cancer track not found" });
  }

  const consentCheck = verifyCaregiverConsent(caregiverId, cancer.profileId, "cancer_track", "add_entries");
  if (!consentCheck.hasPermission) {
    return res.status(403).json({ error: "Permission denied", message: consentCheck.message });
  }

  const parseResult = insertCancerTimelineEntrySchema.safeParse({
    ...entryData,
    cancerId,
    profileId: cancer.profileId,
  });
  
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const entry: CancerTimelineEntry = {
    ...parseResult.data,
    id,
    notes: `[Added by caregiver: ${caregiverName}] ${parseResult.data.notes || ""}`,
    createdAt: now,
    updatedAt: now,
  };

  cancerTimelineStore.set(id, entry);
  
  res.status(201).json({
    ...entry,
    addedByCaregiver: true,
    caregiverName,
  });
});

router.post("/api/cancer-track/:cancerId/documents/caregiver", async (req, res) => {
  const { cancerId } = req.params;
  const { caregiverId, caregiverName, ...documentData } = req.body;
  
  if (!caregiverId || !caregiverName) {
    return res.status(400).json({ error: "Caregiver ID and name are required" });
  }

  const cancer = cancerBasicsStore.get(cancerId);
  if (!cancer) {
    return res.status(404).json({ error: "Cancer track not found" });
  }

  const consentCheck = verifyCaregiverConsent(caregiverId, cancer.profileId, "cancer_track", "add_entries");
  if (!consentCheck.hasPermission) {
    return res.status(403).json({ error: "Permission denied", message: consentCheck.message });
  }

  const parseResult = insertCancerDocumentSchema.safeParse({
    ...documentData,
    cancerId,
    profileId: cancer.profileId,
    uploadedBy: `caregiver:${caregiverName}`,
  });
  
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const document: CancerDocument = {
    ...parseResult.data,
    id,
    notes: parseResult.data.notes 
      ? `[Added by caregiver: ${caregiverName}] ${parseResult.data.notes}` 
      : `[Added by caregiver: ${caregiverName}]`,
    uploadedAt: now,
    uploadedBy: "caregiver",
  };

  cancerDocumentsStore.set(id, document);
  
  res.status(201).json({
    ...document,
    addedByCaregiver: true,
    caregiverName,
  });
});

router.get("/api/cancer-track/:cancerId/caregiver-summary", (req, res) => {
  const { cancerId } = req.params;
  const cancer = cancerBasicsStore.get(cancerId);
  
  if (!cancer) {
    return res.status(404).json({ error: "Cancer track not found" });
  }

  const timelineEntries = Array.from(cancerTimelineStore.values())
    .filter(e => e.cancerId === cancerId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const documents = Array.from(cancerDocumentsStore.values())
    .filter(d => d.cancerId === cancerId);

  const ongoingTreatments = timelineEntries.filter(e => e.isOngoing);
  const recentEntries = timelineEntries.slice(0, 5);
  const activeSideEffects = timelineEntries
    .flatMap(e => e.sideEffects || [])
    .filter(se => se.isOngoing);

  res.json({
    cancerType: cancer.cancerType,
    subtype: cancer.subtype,
    stage: cancer.stage,
    diagnosisDate: cancer.diagnosisDate,
    isActive: cancer.isActive,
    inRemission: cancer.inRemission,
    totalTimelineEntries: timelineEntries.length,
    totalDocuments: documents.length,
    ongoingTreatments: ongoingTreatments.map(t => ({
      id: t.id,
      title: t.title,
      treatmentType: t.treatmentType,
      startDate: t.startDate,
      facility: t.facility,
      provider: t.provider,
    })),
    recentEntries: recentEntries.map(e => ({
      id: e.id,
      title: e.title,
      treatmentType: e.treatmentType,
      startDate: e.startDate,
      endDate: e.endDate,
      isOngoing: e.isOngoing,
    })),
    activeSideEffects: activeSideEffects.map(se => ({
      name: se.name,
      severity: se.severity,
      startedAt: se.startedAt,
    })),
    lastUpdated: timelineEntries[0]?.updatedAt || cancer.updatedAt,
  });
});

export default router;
