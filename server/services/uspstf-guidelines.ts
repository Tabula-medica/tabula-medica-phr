import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export interface USPSTFRecommendation {
  id: string;
  title: string;
  grade: "A" | "B" | "C" | "D" | "I";
  category: string;
  ageRange: { min: number; max: number };
  gender: "all" | "male" | "female";
  frequency: string;
  description: string;
  rationale: string;
  riskFactors?: string[];
}

const uspstfGuidelines: USPSTFRecommendation[] = [
  // Grade A - High Certainty of Substantial Net Benefit
  {
    id: "colorectal-screening",
    title: "Colorectal Cancer Screening",
    grade: "A",
    category: "Cancer Screening",
    ageRange: { min: 45, max: 75 },
    gender: "all",
    frequency: "Every 10 years (colonoscopy) or annually (FIT/FOBT)",
    description: "Screen for colorectal cancer using stool-based tests, colonoscopy, or other approved methods.",
    rationale: "Screening can detect colorectal cancer early when treatment is most effective and can prevent cancer by finding and removing precancerous polyps."
  },
  {
    id: "cervical-screening",
    title: "Cervical Cancer Screening",
    grade: "A",
    category: "Cancer Screening",
    ageRange: { min: 21, max: 65 },
    gender: "female",
    frequency: "Every 3 years (Pap) or every 5 years (hrHPV or co-testing)",
    description: "Screen for cervical cancer with cytology (Pap smear) alone every 3 years, or with high-risk HPV testing.",
    rationale: "Regular screening significantly reduces cervical cancer incidence and mortality."
  },
  {
    id: "hypertension-screening",
    title: "Blood Pressure Screening",
    grade: "A",
    category: "Cardiovascular",
    ageRange: { min: 18, max: 120 },
    gender: "all",
    frequency: "Annually or as recommended by provider",
    description: "Screen for high blood pressure in adults 18 years or older.",
    rationale: "Early detection of hypertension allows for lifestyle modifications and treatment to prevent cardiovascular disease."
  },
  {
    id: "diabetes-screening",
    title: "Prediabetes and Type 2 Diabetes Screening",
    grade: "B",
    category: "Metabolic",
    ageRange: { min: 35, max: 70 },
    gender: "all",
    frequency: "Every 3 years",
    description: "Screen for prediabetes and type 2 diabetes in adults aged 35 to 70 years who have overweight or obesity.",
    rationale: "Early intervention in prediabetes can prevent or delay type 2 diabetes development.",
    riskFactors: ["Overweight", "Obesity", "Family history of diabetes"]
  },
  {
    id: "lung-cancer-screening",
    title: "Lung Cancer Screening",
    grade: "B",
    category: "Cancer Screening",
    ageRange: { min: 50, max: 80 },
    gender: "all",
    frequency: "Annually",
    description: "Annual screening with low-dose CT for adults with a 20 pack-year smoking history who currently smoke or quit within the past 15 years.",
    rationale: "Early detection through LDCT screening reduces lung cancer mortality in high-risk individuals.",
    riskFactors: ["Current smoker", "Former smoker (quit within 15 years)", "20+ pack-year history"]
  },
  {
    id: "breast-cancer-screening",
    title: "Breast Cancer Screening",
    grade: "B",
    category: "Cancer Screening",
    ageRange: { min: 40, max: 74 },
    gender: "female",
    frequency: "Every 2 years",
    description: "Biennial screening mammography for women aged 40 to 74 years.",
    rationale: "Mammography screening reduces breast cancer mortality."
  },
  {
    id: "osteoporosis-screening",
    title: "Osteoporosis Screening",
    grade: "B",
    category: "Bone Health",
    ageRange: { min: 65, max: 120 },
    gender: "female",
    frequency: "Bone measurement testing",
    description: "Screen for osteoporosis with bone measurement testing in women 65 years and older and in younger postmenopausal women at increased risk.",
    rationale: "Early detection allows for treatment to prevent fractures."
  },
  {
    id: "depression-screening",
    title: "Depression Screening",
    grade: "B",
    category: "Mental Health",
    ageRange: { min: 12, max: 120 },
    gender: "all",
    frequency: "Annually or as clinically indicated",
    description: "Screen for depression in the general adult population, including pregnant and postpartum women.",
    rationale: "Depression screening can lead to early treatment and improved outcomes."
  },
  {
    id: "statin-prevention",
    title: "Statin Use for CVD Prevention",
    grade: "B",
    category: "Cardiovascular",
    ageRange: { min: 40, max: 75 },
    gender: "all",
    frequency: "As clinically indicated",
    description: "Adults aged 40-75 with 1+ CVD risk factors and 10-year CVD risk ≥10% should consider statin therapy.",
    rationale: "Statins reduce cardiovascular events in adults at increased risk.",
    riskFactors: ["Dyslipidemia", "Diabetes", "Hypertension", "Smoking"]
  },
  {
    id: "hepatitis-c-screening",
    title: "Hepatitis C Screening",
    grade: "B",
    category: "Infectious Disease",
    ageRange: { min: 18, max: 79 },
    gender: "all",
    frequency: "One-time screening (more if at continued risk)",
    description: "Screen for hepatitis C virus infection in adults aged 18 to 79 years.",
    rationale: "Effective treatments can cure HCV and prevent liver disease progression."
  },
  {
    id: "hiv-screening",
    title: "HIV Screening",
    grade: "A",
    category: "Infectious Disease",
    ageRange: { min: 15, max: 65 },
    gender: "all",
    frequency: "At least once; more frequently for high-risk individuals",
    description: "Screen for HIV infection in adolescents and adults aged 15 to 65 years.",
    rationale: "Early diagnosis enables treatment that improves outcomes and reduces transmission."
  },
  {
    id: "abdominal-aortic-aneurysm",
    title: "Abdominal Aortic Aneurysm Screening",
    grade: "B",
    category: "Cardiovascular",
    ageRange: { min: 65, max: 75 },
    gender: "male",
    frequency: "One-time ultrasound",
    description: "One-time screening for abdominal aortic aneurysm with ultrasonography in men aged 65 to 75 years who have ever smoked.",
    rationale: "Screening can detect AAA before rupture, allowing for elective repair.",
    riskFactors: ["Ever smoked"]
  },
  {
    id: "falls-prevention",
    title: "Falls Prevention Exercise",
    grade: "B",
    category: "Injury Prevention",
    ageRange: { min: 65, max: 120 },
    gender: "all",
    frequency: "Ongoing",
    description: "Exercise interventions to prevent falls in community-dwelling adults 65 years or older at increased fall risk.",
    rationale: "Exercise programs reduce falls and fall-related injuries in older adults."
  },
  {
    id: "aspirin-preeclampsia",
    title: "Aspirin for Preeclampsia Prevention",
    grade: "B",
    category: "Pregnancy",
    ageRange: { min: 12, max: 50 },
    gender: "female",
    frequency: "Daily during pregnancy (after 12 weeks)",
    description: "Low-dose aspirin (81 mg/day) after 12 weeks of gestation for pregnant persons at high risk for preeclampsia.",
    rationale: "Low-dose aspirin reduces the risk of preeclampsia and related complications.",
    riskFactors: ["History of preeclampsia", "Multifetal gestation", "Chronic hypertension", "Type 1 or 2 diabetes", "Kidney disease", "Autoimmune disease"]
  },
  {
    id: "folic-acid-supplementation",
    title: "Folic Acid Supplementation",
    grade: "A",
    category: "Pregnancy",
    ageRange: { min: 15, max: 45 },
    gender: "female",
    frequency: "Daily",
    description: "All persons planning or capable of pregnancy should take a daily supplement containing 0.4 to 0.8 mg of folic acid.",
    rationale: "Folic acid supplementation prevents neural tube defects."
  },
  {
    id: "skin-cancer-counseling",
    title: "Skin Cancer Prevention Counseling",
    grade: "B",
    category: "Cancer Prevention",
    ageRange: { min: 6, max: 24 },
    gender: "all",
    frequency: "As clinically indicated",
    description: "Counsel young adults, adolescents, children, and parents about minimizing UV radiation exposure.",
    rationale: "Sun protection behaviors reduce skin cancer risk."
  },
  {
    id: "tobacco-cessation",
    title: "Tobacco Cessation Interventions",
    grade: "A",
    category: "Behavioral",
    ageRange: { min: 18, max: 120 },
    gender: "all",
    frequency: "At every visit for tobacco users",
    description: "Ask all adults about tobacco use, advise them to stop using tobacco, and provide behavioral interventions and FDA-approved pharmacotherapy.",
    rationale: "Tobacco cessation significantly reduces mortality and morbidity."
  },
  {
    id: "unhealthy-alcohol-screening",
    title: "Unhealthy Alcohol Use Screening",
    grade: "B",
    category: "Behavioral",
    ageRange: { min: 18, max: 120 },
    gender: "all",
    frequency: "Annually",
    description: "Screen adults 18 years or older for unhealthy alcohol use and provide brief behavioral counseling.",
    rationale: "Brief interventions can reduce unhealthy alcohol consumption."
  },
  {
    id: "obesity-screening",
    title: "Obesity Screening and Counseling",
    grade: "B",
    category: "Metabolic",
    ageRange: { min: 6, max: 120 },
    gender: "all",
    frequency: "Annually",
    description: "Screen for obesity and offer or refer patients with obesity to intensive behavioral interventions.",
    rationale: "Intensive behavioral interventions can lead to weight loss and improved health outcomes."
  },
  {
    id: "anxiety-screening",
    title: "Anxiety Screening",
    grade: "B",
    category: "Mental Health",
    ageRange: { min: 8, max: 64 },
    gender: "all",
    frequency: "Annually or as clinically indicated",
    description: "Screen for anxiety disorders in adults, including pregnant and postpartum persons.",
    rationale: "Early detection enables appropriate treatment and management of anxiety disorders."
  }
];

export interface PatientProfile {
  age: number;
  gender: "male" | "female" | "other";
  riskFactors?: string[];
  smokingHistory?: {
    status: "never" | "former" | "current";
    packYears?: number;
    quitYearsAgo?: number;
  };
  pregnant?: boolean;
  conditions?: string[];
}

class USPSTFGuidelinesService {
  getRecommendationsForPatient(profile: PatientProfile): {
    applicable: USPSTFRecommendation[];
    conditional: USPSTFRecommendation[];
    summary: string;
    noCdsCompliance: string;
  } {
    const applicable: USPSTFRecommendation[] = [];
    const conditional: USPSTFRecommendation[] = [];

    for (const guideline of uspstfGuidelines) {
      // Check age range
      if (profile.age < guideline.ageRange.min || profile.age > guideline.ageRange.max) {
        continue;
      }

      // Check gender
      if (guideline.gender !== "all") {
        if (guideline.gender === "female" && profile.gender !== "female") continue;
        if (guideline.gender === "male" && profile.gender !== "male") continue;
      }

      // Check risk factors if required
      if (guideline.riskFactors && guideline.riskFactors.length > 0) {
        const hasRiskFactor = guideline.riskFactors.some(rf => 
          profile.riskFactors?.some(prf => prf.toLowerCase().includes(rf.toLowerCase())) ||
          profile.conditions?.some(c => c.toLowerCase().includes(rf.toLowerCase()))
        );
        
        // Special handling for smoking-related screenings
        if (guideline.id === "lung-cancer-screening") {
          const smokingQualifies = profile.smokingHistory && 
            (profile.smokingHistory.status === "current" || 
              (profile.smokingHistory.status === "former" && 
               (profile.smokingHistory.quitYearsAgo || 0) <= 15)) &&
            (profile.smokingHistory.packYears || 0) >= 20;
          
          if (smokingQualifies) {
            applicable.push(guideline);
          } else if (profile.smokingHistory?.status !== "never") {
            conditional.push(guideline);
          }
          continue;
        }

        if (hasRiskFactor) {
          applicable.push(guideline);
        } else {
          conditional.push(guideline);
        }
      } else {
        applicable.push(guideline);
      }
    }

    // Sort by grade (A first, then B)
    applicable.sort((a, b) => a.grade.localeCompare(b.grade));
    conditional.sort((a, b) => a.grade.localeCompare(b.grade));

    const summary = this.generateSummary(profile, applicable);

    return {
      applicable,
      conditional,
      summary,
      noCdsCompliance: "EDUCATIONAL INFORMATION ONLY. These USPSTF recommendations are for general health education purposes. They do NOT constitute medical advice, diagnosis, or treatment recommendations. Always consult with your healthcare provider for personalized medical decisions."
    };
  }

  private generateSummary(profile: PatientProfile, recommendations: USPSTFRecommendation[]): string {
    const categories = new Map<string, number>();
    recommendations.forEach(r => {
      categories.set(r.category, (categories.get(r.category) || 0) + 1);
    });

    const gradeACnt = recommendations.filter(r => r.grade === "A").length;
    const gradeBCnt = recommendations.filter(r => r.grade === "B").length;

    const categoryList: string[] = [];
    categories.forEach((_, key) => categoryList.push(key));
    return `Based on the profile (age ${profile.age}, ${profile.gender}), there are ${recommendations.length} applicable USPSTF preventive care recommendations: ${gradeACnt} Grade A (strongly recommended) and ${gradeBCnt} Grade B (recommended). Key categories include ${categoryList.slice(0, 3).join(", ")}.`;
  }

  async getAIEnhancedRecommendations(profile: PatientProfile): Promise<{
    recommendations: USPSTFRecommendation[];
    aiSummary: string;
    educationalNotes: string[];
    noCdsCompliance: string;
  }> {
    const baseRecommendations = this.getRecommendationsForPatient(profile);
    const NO_CDS_DISCLAIMER = "EDUCATIONAL INFORMATION ONLY. This content explains what preventive screenings are and why they exist. It is NOT medical advice, NOT a recommendation to get any specific screening, and NOT a substitute for talking to your doctor. Your healthcare provider will determine what screenings are right for you.";

    if (!aiEnabled) {
      return {
        recommendations: baseRecommendations.applicable,
        aiSummary: baseRecommendations.summary + " " + NO_CDS_DISCLAIMER,
        educationalNotes: [
          "Talk to your healthcare provider about which screenings are appropriate for you",
          "Your doctor will consider your individual health history when making screening decisions",
          "These guidelines are general information, not personalized medical advice"
        ],
        noCdsCompliance: NO_CDS_DISCLAIMER
      };
    }

    try {
      const content = (await generatePhiSafeText({
        system: `You are a health education assistant providing ONLY FACTUAL EDUCATIONAL information about what USPSTF preventive care screenings are and what they measure.

ABSOLUTE RULES - VIOLATIONS WILL CAUSE HARM:
1. NEVER say someone "should" get a screening
2. NEVER recommend, suggest, or advise any action
3. NEVER interpret results or health status
4. ONLY explain what each screening measures and its general purpose
5. ALWAYS direct users to consult their healthcare provider
6. Use phrases like "This screening measures..." NOT "You should get..."

You must end EVERY response with: "[DISCLAIMER: Educational information only. Consult your healthcare provider for medical advice.]"

Output format - provide ONLY:
1. A 2-sentence factual description of what these screenings measure (not who should get them)
2. 3 educational notes about understanding preventive care (not advice about getting care)`,
        user: `Explain the following preventive screenings for educational purposes only:
${baseRecommendations.applicable.map(r => `- ${r.title}: ${r.description}`).join("\n")}

Remember: Only factual explanations of what these screenings are. No recommendations.`,
        maxTokens: 400
      })) || "";
      const parts = content.split(/Notes?:|Educational|DISCLAIMER/i);
      let summary = (parts[0]?.trim() || baseRecommendations.summary);
      
      // Ensure disclaimer is always appended
      if (!summary.includes("DISCLAIMER") && !summary.includes("educational")) {
        summary += " " + NO_CDS_DISCLAIMER;
      }

      return {
        recommendations: baseRecommendations.applicable,
        aiSummary: summary,
        educationalNotes: [
          "Talk to your healthcare provider about which screenings are appropriate for you",
          "Your doctor will consider your individual health history when making screening decisions",
          "These guidelines are general information, not personalized medical advice"
        ],
        noCdsCompliance: NO_CDS_DISCLAIMER
      };
    } catch (error) {
      console.error("Error generating AI recommendations:", error);
      return {
        recommendations: baseRecommendations.applicable,
        aiSummary: baseRecommendations.summary + " " + NO_CDS_DISCLAIMER,
        educationalNotes: [
          "Talk to your healthcare provider about which screenings are appropriate for you",
          "Your doctor will consider your individual health history"
        ],
        noCdsCompliance: NO_CDS_DISCLAIMER
      };
    }
  }

  getAllGuidelines(): USPSTFRecommendation[] {
    return uspstfGuidelines;
  }

  getGuidelinesByCategory(category: string): USPSTFRecommendation[] {
    return uspstfGuidelines.filter(g => g.category.toLowerCase() === category.toLowerCase());
  }

  getCategories(): string[] {
    return [...new Set(uspstfGuidelines.map(g => g.category))];
  }
}

export const uspstfGuidelinesService = new USPSTFGuidelinesService();
