export interface CVXEntry {
  code: string;
  shortName: string;
  fullName: string;
  vaccineGroup: string;
  status: "active" | "inactive" | "never_active" | "non_us";
  tradenames?: string[];
  aliases?: string[];
  abbreviations?: string[];
  manufacturers?: string[];
}

const CVX_REGISTRY: Map<string, CVXEntry> = new Map([
  ["01", { code: "01", shortName: "DTP", fullName: "DTP", vaccineGroup: "DTP", status: "inactive" }],
  ["02", { code: "02", shortName: "OPV", fullName: "Polio (OPV)", vaccineGroup: "Polio", status: "inactive" }],
  ["03", { code: "03", shortName: "MMR", fullName: "Measles, Mumps, Rubella", vaccineGroup: "MMR", status: "active", tradenames: ["M-M-R II", "Priorix"], aliases: ["MMR Vaccine"], abbreviations: ["MMR"] }],
  ["05", { code: "05", shortName: "Measles", fullName: "Measles Virus Vaccine", vaccineGroup: "MMR", status: "inactive" }],
  ["06", { code: "06", shortName: "Rubella", fullName: "Rubella Virus Vaccine", vaccineGroup: "MMR", status: "inactive" }],
  ["07", { code: "07", shortName: "Mumps", fullName: "Mumps Virus Vaccine", vaccineGroup: "MMR", status: "inactive" }],
  ["08", { code: "08", shortName: "Hep B Peds", fullName: "Hepatitis B, pediatric/adolescent", vaccineGroup: "HepB", status: "active", tradenames: ["Recombivax HB Pediatric", "Engerix-B Pediatric"], aliases: ["Hep B", "HBV"], abbreviations: ["HEPB"] }],
  ["09", { code: "09", shortName: "Td Peds", fullName: "Td (pediatric)", vaccineGroup: "Td/Tdap", status: "inactive" }],
  ["10", { code: "10", shortName: "IPV", fullName: "Inactivated Poliovirus", vaccineGroup: "Polio", status: "active", tradenames: ["IPOL"], aliases: ["Polio Vaccine"], abbreviations: ["IPV"] }],
  ["17", { code: "17", shortName: "Hib", fullName: "Hib, unspecified formulation", vaccineGroup: "Hib", status: "active", aliases: ["Haemophilus influenzae type b"], abbreviations: ["HIB"] }],
  ["18", { code: "18", shortName: "Rabies IM", fullName: "Rabies, intramuscular", vaccineGroup: "Rabies", status: "active" }],
  ["19", { code: "19", shortName: "BCG", fullName: "BCG", vaccineGroup: "BCG", status: "active" }],
  ["20", { code: "20", shortName: "DTaP", fullName: "DTaP", vaccineGroup: "DTaP", status: "active", tradenames: ["Infanrix", "Daptacel"], aliases: ["Diphtheria, Tetanus, Pertussis"], abbreviations: ["DTAP"] }],
  ["21", { code: "21", shortName: "Varicella", fullName: "Varicella (Chickenpox)", vaccineGroup: "Varicella", status: "active", tradenames: ["Varivax"], aliases: ["Chickenpox Vaccine", "VZV"], abbreviations: ["VAR"] }],
  ["22", { code: "22", shortName: "DTP-Hib", fullName: "DTP-Hib", vaccineGroup: "DTP/Hib", status: "inactive" }],
  ["24", { code: "24", shortName: "Anthrax", fullName: "Anthrax Vaccine", vaccineGroup: "Anthrax", status: "active" }],
  ["25", { code: "25", shortName: "Typhoid oral", fullName: "Typhoid oral", vaccineGroup: "Typhoid", status: "active" }],
  ["26", { code: "26", shortName: "Cholera", fullName: "Cholera, live oral", vaccineGroup: "Cholera", status: "active" }],
  ["27", { code: "27", shortName: "Botulinum", fullName: "Botulinum antitoxin", vaccineGroup: "Botulism", status: "active" }],
  ["29", { code: "29", shortName: "CMVIG", fullName: "CMV Immune Globulin", vaccineGroup: "CMV", status: "active" }],
  ["30", { code: "30", shortName: "HBIG", fullName: "Hepatitis B Immune Globulin", vaccineGroup: "HBIG", status: "active" }],
  ["33", { code: "33", shortName: "PPSV23", fullName: "Pneumococcal Polysaccharide (23-valent)", vaccineGroup: "Pneumococcal", status: "active", tradenames: ["Pneumovax 23"], aliases: ["Pneumonia Vaccine"], abbreviations: ["PPSV23", "PPV23"] }],
  ["34", { code: "34", shortName: "RIG", fullName: "Rabies Immune Globulin", vaccineGroup: "RIG", status: "active" }],
  ["35", { code: "35", shortName: "TT", fullName: "Tetanus Toxoid", vaccineGroup: "Tetanus", status: "active" }],
  ["36", { code: "36", shortName: "VZIG", fullName: "Varicella-Zoster Immune Globulin", vaccineGroup: "Varicella", status: "active" }],
  ["37", { code: "37", shortName: "Yellow Fever", fullName: "Yellow Fever", vaccineGroup: "Yellow Fever", status: "active" }],
  ["40", { code: "40", shortName: "Rabies ID", fullName: "Rabies, intradermal", vaccineGroup: "Rabies", status: "active" }],
  ["41", { code: "41", shortName: "Typhoid parenteral", fullName: "Typhoid, parenteral", vaccineGroup: "Typhoid", status: "active" }],
  ["43", { code: "43", shortName: "Hep B adult", fullName: "Hepatitis B, adult dosage", vaccineGroup: "HepB", status: "active", tradenames: ["Engerix-B Adult", "Recombivax HB Adult"] }],
  ["44", { code: "44", shortName: "Hep B dialysis", fullName: "Hepatitis B, dialysis patient dosage", vaccineGroup: "HepB", status: "active" }],
  ["45", { code: "45", shortName: "Hep B NOS", fullName: "Hepatitis B, unspecified formulation", vaccineGroup: "HepB", status: "active" }],
  ["48", { code: "48", shortName: "Hib-PRP-T", fullName: "Hib (PRP-T)", vaccineGroup: "Hib", status: "active", tradenames: ["ActHIB", "Hiberix"] }],
  ["49", { code: "49", shortName: "Hib-PRP-OMP", fullName: "Hib (PRP-OMP)", vaccineGroup: "Hib", status: "active", tradenames: ["PedvaxHIB"] }],
  ["50", { code: "50", shortName: "DTaP-Hib", fullName: "DTaP-Hib", vaccineGroup: "DTaP/Hib", status: "active" }],
  ["52", { code: "52", shortName: "Hep A adult", fullName: "Hepatitis A, adult dosage", vaccineGroup: "HepA", status: "active", tradenames: ["Havrix", "Vaqta"], aliases: ["Hep A"], abbreviations: ["HEPA"] }],
  ["53", { code: "53", shortName: "Typhoid ViCPs", fullName: "Typhoid Vi capsular polysaccharide", vaccineGroup: "Typhoid", status: "active" }],
  ["55", { code: "55", shortName: "TIG", fullName: "Tetanus Immune Globulin", vaccineGroup: "TIG", status: "active" }],
  ["62", { code: "62", shortName: "HPV4", fullName: "HPV, quadrivalent", vaccineGroup: "HPV", status: "inactive", tradenames: ["Gardasil"], aliases: ["HPV Vaccine"], abbreviations: ["HPV4"] }],
  ["75", { code: "75", shortName: "Smallpox", fullName: "Vaccinia (Smallpox)", vaccineGroup: "Smallpox/Mpox", status: "active" }],
  ["83", { code: "83", shortName: "Hep A Peds", fullName: "Hepatitis A, pediatric/adolescent", vaccineGroup: "HepA", status: "active" }],
  ["85", { code: "85", shortName: "Hep A NOS", fullName: "Hepatitis A, unspecified", vaccineGroup: "HepA", status: "active" }],
  ["88", { code: "88", shortName: "Flu NOS", fullName: "Influenza, unspecified", vaccineGroup: "Influenza", status: "active" }],
  ["89", { code: "89", shortName: "Polio NOS", fullName: "Polio, unspecified", vaccineGroup: "Polio", status: "inactive" }],
  ["90", { code: "90", shortName: "Rabies NOS", fullName: "Rabies, unspecified", vaccineGroup: "Rabies", status: "active" }],
  ["91", { code: "91", shortName: "Typhoid NOS", fullName: "Typhoid, unspecified", vaccineGroup: "Typhoid", status: "active" }],
  ["93", { code: "93", shortName: "RSV-Mab", fullName: "RSV-MAb (Synagis/palivizumab)", vaccineGroup: "RSV", status: "active", tradenames: ["Synagis"] }],
  ["94", { code: "94", shortName: "MMRV", fullName: "Measles, Mumps, Rubella, Varicella", vaccineGroup: "MMR", status: "active", tradenames: ["ProQuad"], abbreviations: ["MMRV"] }],
  ["104", { code: "104", shortName: "Hep A-B", fullName: "Hepatitis A and B", vaccineGroup: "HepA/HepB", status: "active", tradenames: ["Twinrix"] }],
  ["106", { code: "106", shortName: "DTaP 5th", fullName: "DTaP, 5th dose", vaccineGroup: "DTaP", status: "active" }],
  ["107", { code: "107", shortName: "DTaP 4th", fullName: "DTaP, 4th dose", vaccineGroup: "DTaP", status: "active" }],
  ["108", { code: "108", shortName: "MenACWY NOS", fullName: "Meningococcal, unspecified", vaccineGroup: "Meningococcal", status: "active" }],
  ["109", { code: "109", shortName: "Pneumo NOS", fullName: "Pneumococcal, unspecified", vaccineGroup: "Pneumococcal", status: "active" }],
  ["110", { code: "110", shortName: "DTaP-HepB-IPV", fullName: "DTaP-HepB-IPV (Pediarix)", vaccineGroup: "DTaP/HepB/IPV", status: "active", tradenames: ["Pediarix"] }],
  ["111", { code: "111", shortName: "FluMist", fullName: "Influenza, live, intranasal", vaccineGroup: "Influenza", status: "active", tradenames: ["FluMist"] }],
  ["112", { code: "112", shortName: "TT adsorbed", fullName: "Tetanus Toxoid, adsorbed", vaccineGroup: "Tetanus", status: "active" }],
  ["113", { code: "113", shortName: "Td", fullName: "Td (adult)", vaccineGroup: "Td/Tdap", status: "active", tradenames: ["Tenivac", "Tdvax"], aliases: ["Tetanus, Diphtheria", "Tetanus Booster"], abbreviations: ["TD"] }],
  ["114", { code: "114", shortName: "MenACWY-D", fullName: "Meningococcal ACWY-D", vaccineGroup: "Meningococcal", status: "active", tradenames: ["Menactra"], abbreviations: ["MENACWY"] }],
  ["115", { code: "115", shortName: "Tdap", fullName: "Tetanus, Diphtheria, Pertussis", vaccineGroup: "Td/Tdap", status: "active", tradenames: ["Adacel", "Boostrix"], abbreviations: ["TDAP"] }],
  ["116", { code: "116", shortName: "RV NOS", fullName: "Rotavirus, unspecified", vaccineGroup: "Rotavirus", status: "active" }],
  ["118", { code: "118", shortName: "HPV2", fullName: "HPV, bivalent", vaccineGroup: "HPV", status: "inactive", tradenames: ["Cervarix"] }],
  ["119", { code: "119", shortName: "RV5", fullName: "Rotavirus, pentavalent", vaccineGroup: "Rotavirus", status: "active", tradenames: ["RotaTeq"] }],
  ["120", { code: "120", shortName: "DTaP-IPV-Hib", fullName: "DTaP-IPV/Hib (Pentacel)", vaccineGroup: "DTaP/Hib/IPV", status: "active", tradenames: ["Pentacel"] }],
  ["121", { code: "121", shortName: "Zoster live", fullName: "Zoster (Shingles), live", vaccineGroup: "Shingles", status: "inactive", tradenames: ["Zostavax"] }],
  ["122", { code: "122", shortName: "RV1", fullName: "Rotavirus, monovalent", vaccineGroup: "Rotavirus", status: "active", tradenames: ["Rotarix"] }],
  ["130", { code: "130", shortName: "DTaP-IPV", fullName: "DTaP-IPV", vaccineGroup: "DTaP/IPV", status: "active" }],
  ["133", { code: "133", shortName: "PCV13", fullName: "Pneumococcal Conjugate (13-valent)", vaccineGroup: "Pneumococcal", status: "active", tradenames: ["Prevnar 13"], abbreviations: ["PCV13"] }],
  ["135", { code: "135", shortName: "Flu HD", fullName: "Influenza, high-dose seasonal", vaccineGroup: "Influenza", status: "active", tradenames: ["Fluzone High-Dose"] }],
  ["136", { code: "136", shortName: "MenACWY-CRM", fullName: "Meningococcal ACWY-CRM", vaccineGroup: "Meningococcal", status: "active", tradenames: ["Menveo"] }],
  ["137", { code: "137", shortName: "HPV NOS", fullName: "HPV, unspecified", vaccineGroup: "HPV", status: "active" }],
  ["138", { code: "138", shortName: "Td adult", fullName: "Td (adult)", vaccineGroup: "Td/Tdap", status: "active" }],
  ["139", { code: "139", shortName: "Td adult PF", fullName: "Td (adult, preservative-free)", vaccineGroup: "Td/Tdap", status: "active" }],
  ["140", { code: "140", shortName: "Flu IIV", fullName: "Influenza, seasonal, injectable, preservative-free", vaccineGroup: "Influenza", status: "active", tradenames: ["Fluzone", "Fluarix", "Flucelvax"], aliases: ["Flu Shot", "Seasonal Flu"] }],
  ["141", { code: "141", shortName: "Flu IIV", fullName: "Influenza, seasonal, injectable", vaccineGroup: "Influenza", status: "active", tradenames: ["Fluzone", "Fluarix"] }],
  ["142", { code: "142", shortName: "TT NOS", fullName: "Tetanus Toxoid, unspecified", vaccineGroup: "Tetanus", status: "active" }],
  ["144", { code: "144", shortName: "Flu ID", fullName: "Influenza, intradermal", vaccineGroup: "Influenza", status: "active" }],
  ["146", { code: "146", shortName: "DTaP-IPV", fullName: "DTaP-IPV (Kinrix/Quadracel)", vaccineGroup: "DTaP/IPV", status: "active", tradenames: ["Kinrix", "Quadracel"] }],
  ["149", { code: "149", shortName: "FluMist Quad", fullName: "Influenza, live, intranasal, quadrivalent", vaccineGroup: "Influenza", status: "active", tradenames: ["FluMist Quadrivalent"] }],
  ["150", { code: "150", shortName: "Flu IIV4", fullName: "Influenza, injectable, quadrivalent, preservative-free", vaccineGroup: "Influenza", status: "active" }],
  ["152", { code: "152", shortName: "PCV15", fullName: "Pneumococcal Conjugate (15-valent)", vaccineGroup: "Pneumococcal", status: "active", tradenames: ["Vaxneuvance"], abbreviations: ["PCV15"] }],
  ["153", { code: "153", shortName: "Flu ccIIV4", fullName: "Influenza, injectable, MDCK", vaccineGroup: "Influenza", status: "active", tradenames: ["Flucelvax Quadrivalent"] }],
  ["155", { code: "155", shortName: "Flu RIV4", fullName: "Influenza, recombinant, quadrivalent", vaccineGroup: "Influenza", status: "active", tradenames: ["Flublok Quadrivalent"] }],
  ["158", { code: "158", shortName: "Flu ccIIV", fullName: "Influenza, cell-based", vaccineGroup: "Influenza", status: "active" }],
  ["161", { code: "161", shortName: "Flu IIV4", fullName: "Influenza, injectable, quadrivalent", vaccineGroup: "Influenza", status: "active" }],
  ["162", { code: "162", shortName: "MenB-4C", fullName: "Meningococcal B (4C)", vaccineGroup: "Meningococcal", status: "active", tradenames: ["Bexsero"], abbreviations: ["MENB"] }],
  ["163", { code: "163", shortName: "MenB-FHbp", fullName: "Meningococcal B (FHbp)", vaccineGroup: "Meningococcal", status: "active", tradenames: ["Trumenba"] }],
  ["164", { code: "164", shortName: "MenB NOS", fullName: "Meningococcal B, unspecified", vaccineGroup: "Meningococcal", status: "active" }],
  ["165", { code: "165", shortName: "HPV9", fullName: "HPV, 9-valent", vaccineGroup: "HPV", status: "active", tradenames: ["Gardasil 9"], aliases: ["HPV Vaccine"], abbreviations: ["HPV9"] }],
  ["168", { code: "168", shortName: "Flu aIIV3", fullName: "Influenza, trivalent, adjuvanted", vaccineGroup: "Influenza", status: "active", tradenames: ["Fluad"] }],
  ["171", { code: "171", shortName: "Flu aIIV4", fullName: "Influenza, quadrivalent, adjuvanted", vaccineGroup: "Influenza", status: "active", tradenames: ["Fluad Quadrivalent"] }],
  ["172", { code: "172", shortName: "Cholera WC-rBS", fullName: "Cholera, WC-rBS", vaccineGroup: "Cholera", status: "active" }],
  ["183", { code: "183", shortName: "Yellow Fever NOS", fullName: "Yellow Fever, unspecified", vaccineGroup: "Yellow Fever", status: "active" }],
  ["185", { code: "185", shortName: "Flu RIV4 HD", fullName: "Influenza, recombinant, high-dose", vaccineGroup: "Influenza", status: "active" }],
  ["186", { code: "186", shortName: "Flu ccIIV4 PF", fullName: "Influenza, injectable, MDCK, preservative-free", vaccineGroup: "Influenza", status: "active" }],
  ["187", { code: "187", shortName: "Zoster recomb", fullName: "Zoster (Shingles), recombinant", vaccineGroup: "Shingles", status: "active", tradenames: ["Shingrix"], aliases: ["Shingles Vaccine"] }],
  ["188", { code: "188", shortName: "Zoster NOS", fullName: "Zoster (Shingles), unspecified", vaccineGroup: "Shingles", status: "active" }],
  ["189", { code: "189", shortName: "Hep B CpG", fullName: "Hepatitis B, CpG-adjuvanted", vaccineGroup: "HepB", status: "active", tradenames: ["Heplisav-B"] }],
  ["191", { code: "191", shortName: "Flu HD PF", fullName: "Influenza, HD, preservative-free", vaccineGroup: "Influenza", status: "active" }],
  ["192", { code: "192", shortName: "Flu HD QIV", fullName: "Influenza, HD, quadrivalent", vaccineGroup: "Influenza", status: "active" }],
  ["193", { code: "193", shortName: "Flu RIV QIV", fullName: "Influenza, recombinant, quadrivalent", vaccineGroup: "Influenza", status: "active" }],
  ["194", { code: "194", shortName: "Flu SH", fullName: "Influenza, southern hemisphere", vaccineGroup: "Influenza", status: "active" }],
  ["197", { code: "197", shortName: "Flu HD aIIV", fullName: "Influenza, HD, adjuvanted", vaccineGroup: "Influenza", status: "active", tradenames: ["Fluzone High-Dose"] }],
  ["200", { code: "200", shortName: "Flu SH QIV", fullName: "Influenza, SH, quadrivalent", vaccineGroup: "Influenza", status: "active" }],
  ["201", { code: "201", shortName: "RSV NOS", fullName: "RSV, unspecified", vaccineGroup: "RSV", status: "active" }],
  ["202", { code: "202", shortName: "RSVPreF", fullName: "RSV, maternal (Abrysvo)", vaccineGroup: "RSV", status: "active", tradenames: ["Abrysvo"] }],
  ["203", { code: "203", shortName: "MenACWY-TT", fullName: "Meningococcal ACWY-TT", vaccineGroup: "Meningococcal", status: "active", tradenames: ["MenQuadfi"] }],
  ["205", { code: "205", shortName: "Flu aIIV4", fullName: "Influenza, quadrivalent, adjuvanted", vaccineGroup: "Influenza", status: "active" }],
  ["206", { code: "206", shortName: "Jynneos", fullName: "Smallpox monkeypox (Jynneos)", vaccineGroup: "Smallpox/Mpox", status: "active", tradenames: ["Jynneos"] }],
  ["207", { code: "207", shortName: "COVID Moderna", fullName: "COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5 mL (Moderna)", vaccineGroup: "COVID-19", status: "active", tradenames: ["Spikevax"], manufacturers: ["Moderna"] }],
  ["208", { code: "208", shortName: "COVID Pfizer", fullName: "COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL (Pfizer)", vaccineGroup: "COVID-19", status: "active", tradenames: ["Comirnaty"], manufacturers: ["Pfizer-BioNTech"] }],
  ["212", { code: "212", shortName: "COVID Janssen", fullName: "COVID-19, viral vector (Janssen/J&J)", vaccineGroup: "COVID-19", status: "inactive", tradenames: ["Janssen"], manufacturers: ["Janssen"] }],
  ["213", { code: "213", shortName: "COVID NOS", fullName: "COVID-19, unspecified", vaccineGroup: "COVID-19", status: "active" }],
  ["215", { code: "215", shortName: "PCV15", fullName: "Pneumococcal Conjugate (15-valent)", vaccineGroup: "Pneumococcal", status: "active", tradenames: ["Vaxneuvance"] }],
  ["216", { code: "216", shortName: "PCV20", fullName: "Pneumococcal Conjugate (20-valent)", vaccineGroup: "Pneumococcal", status: "active", tradenames: ["Prevnar 20"], abbreviations: ["PCV20"] }],
  ["217", { code: "217", shortName: "COVID Pfizer Peds", fullName: "COVID-19, mRNA (Pfizer), pediatric 6m-4y", vaccineGroup: "COVID-19", status: "active", manufacturers: ["Pfizer-BioNTech"] }],
  ["218", { code: "218", shortName: "COVID Pfizer 5-11", fullName: "COVID-19, mRNA (Pfizer), ages 5-11", vaccineGroup: "COVID-19", status: "active", manufacturers: ["Pfizer-BioNTech"] }],
  ["219", { code: "219", shortName: "COVID Pfizer boost", fullName: "COVID-19, mRNA (Pfizer), booster", vaccineGroup: "COVID-19", status: "active", manufacturers: ["Pfizer-BioNTech"] }],
  ["221", { code: "221", shortName: "COVID Moderna Peds", fullName: "COVID-19, mRNA (Moderna), pediatric", vaccineGroup: "COVID-19", status: "active", manufacturers: ["Moderna"] }],
  ["227", { code: "227", shortName: "COVID Pfizer bivalent", fullName: "COVID-19, mRNA (Pfizer), bivalent BA.4/BA.5", vaccineGroup: "COVID-19", status: "inactive", manufacturers: ["Pfizer-BioNTech"] }],
  ["228", { code: "228", shortName: "COVID Moderna bivalent", fullName: "COVID-19, mRNA (Moderna), bivalent BA.4/BA.5", vaccineGroup: "COVID-19", status: "inactive", manufacturers: ["Moderna"] }],
  ["229", { code: "229", shortName: "COVID Pfizer 2024-25", fullName: "COVID-19, mRNA (Pfizer), 2024-2025 formula", vaccineGroup: "COVID-19", status: "active", manufacturers: ["Pfizer-BioNTech"] }],
  ["230", { code: "230", shortName: "COVID Moderna 2024-25", fullName: "COVID-19, mRNA (Moderna), 2024-2025 formula", vaccineGroup: "COVID-19", status: "active", manufacturers: ["Moderna"] }],
  ["305", { code: "305", shortName: "RSV", fullName: "Respiratory Syncytial Virus Vaccine", vaccineGroup: "RSV", status: "active" }],
]);

export function lookupCVX(code: string): CVXEntry | undefined {
  const normalized = code.replace(/^CVX[-\s]*/i, "").replace(/^0+(?=\d{2})/, "").padStart(2, "0");
  return CVX_REGISTRY.get(normalized);
}

export function normalizeCVXCode(code: string): string {
  return code.replace(/^CVX[-\s]*/i, "").replace(/^0+(?=\d{2})/, "").padStart(2, "0");
}

export function getVaccineGroup(code: string): string | undefined {
  const entry = lookupCVX(code);
  return entry?.vaccineGroup;
}

export function cvxCodesMatchByGroup(code1: string, code2: string): boolean {
  const group1 = getVaccineGroup(code1);
  const group2 = getVaccineGroup(code2);
  if (!group1 || !group2) return false;
  return group1 === group2;
}

export function cvxCodesExactMatch(code1: string, code2: string): boolean {
  return normalizeCVXCode(code1) === normalizeCVXCode(code2);
}

export function findCVXByName(name: string): CVXEntry | undefined {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const entry of CVX_REGISTRY.values()) {
    const entryNames = [
      entry.shortName,
      entry.fullName,
      ...(entry.tradenames || []),
      ...(entry.aliases || []),
      ...(entry.abbreviations || []),
    ];
    for (const n of entryNames) {
      if (n.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized) {
        return entry;
      }
    }
  }
  for (const entry of CVX_REGISTRY.values()) {
    const entryNames = [
      entry.shortName,
      entry.fullName,
      ...(entry.tradenames || []),
      ...(entry.aliases || []),
    ];
    for (const n of entryNames) {
      const normalizedEntry = n.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized.includes(normalizedEntry) || normalizedEntry.includes(normalized)) {
        return entry;
      }
    }
  }
  return undefined;
}

export function getAllCVXForGroup(group: string): CVXEntry[] {
  const results: CVXEntry[] = [];
  for (const entry of CVX_REGISTRY.values()) {
    if (entry.vaccineGroup === group) {
      results.push(entry);
    }
  }
  return results;
}

export function getAllVaccineGroups(): string[] {
  const groups = new Set<string>();
  for (const entry of CVX_REGISTRY.values()) {
    groups.add(entry.vaccineGroup);
  }
  return Array.from(groups).sort();
}

export function getAllActiveCVXCodes(): CVXEntry[] {
  const results: CVXEntry[] = [];
  for (const entry of CVX_REGISTRY.values()) {
    if (entry.status === "active") {
      results.push(entry);
    }
  }
  return results;
}

export function resolveCVXFromInput(input: string): CVXEntry | undefined {
  if (/^\d{1,3}$/.test(input.trim())) {
    return lookupCVX(input.trim());
  }
  if (/^CVX[-\s]*\d+$/i.test(input.trim())) {
    return lookupCVX(input.trim());
  }
  return findCVXByName(input);
}

export { CVX_REGISTRY };
