import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { updrsAssessmentsTable } from "@shared/schema";
import { phiDb as defaultPhiDb, encryptPhiRow, decryptPhiRows } from "../storage/phi-storage";

const DISCLAIMER =
  "This Unified Parkinson's Disease Rating Scale (UPDRS) tool is for educational tracking purposes only. It does not constitute medical advice or a diagnosis, and scoring requires clinical training to administer reliably. Always review results and any change in symptoms with a movement disorder specialist or treating clinician.";

export interface UPDRSItemDefinition {
  id: string;
  number: string;
  label: string;
  side?: "right" | "left";
  maxScore: number;
  anchors: string[];
}

export type UPDRSScores = Record<string, number>;

export interface HoehnYahrStageInfo {
  stage: number;
  description: string;
}

export interface UPDRSScaleDefinition {
  partI: UPDRSItemDefinition[];
  partII: UPDRSItemDefinition[];
  partIII: UPDRSItemDefinition[];
  partIV: UPDRSItemDefinition[];
  hoehnYahrStages: HoehnYahrStageInfo[];
  disclaimer: string;
}

export interface UPDRSAssessment {
  id: string;
  profileId: string;
  scores: UPDRSScores;
  hoehnYahrStage: number;
  partITotal: number;
  partIITotal: number;
  partIIITotal: number;
  partIVTotal: number;
  motorTotal: number;
  grandTotal: number;
  previousGrandTotal?: number;
  changeFromPrevious?: number;
  trend?: "improved" | "worsened" | "stable" | "baseline";
  notes?: string;
  assessedAt: string;
  disclaimer: string;
}

function item(number: string, label: string, anchors: string[], opts: { side?: "right" | "left"; maxScore?: number } = {}): UPDRSItemDefinition {
  const side = opts.side;
  return {
    id: side ? `p${number}-${side === "right" ? "r" : "l"}` : `p${number}`,
    number,
    label: side ? `${label} (${side === "right" ? "Right" : "Left"})` : label,
    side,
    maxScore: opts.maxScore ?? anchors.length - 1,
    anchors,
  };
}

const STANDARD_5 = (labels: [string, string, string, string, string]) => labels;

const PART_I: UPDRSItemDefinition[] = [
  item("1", "Intellectual impairment", STANDARD_5([
    "None",
    "Mild forgetfulness with partial recollection of events, no other difficulties",
    "Moderate memory loss with disorientation, moderate difficulty handling complex problems",
    "Severe memory loss with disorientation to time and often place",
    "Severe memory loss with orientation only to person",
  ])),
  item("2", "Thought disorder (dementia or drug intoxication)", STANDARD_5([
    "None",
    "Vivid dreaming",
    "\"Benign\" hallucinations with insight retained",
    "Occasional to frequent hallucinations or delusions without insight; may interfere with daily activities",
    "Persistent hallucinations, delusions, or florid psychosis",
  ])),
  item("3", "Depression", STANDARD_5([
    "None",
    "Periods of sadness or guilt greater than normal, never sustained for days or weeks",
    "Sustained depression (1 week or more)",
    "Sustained depression with vegetative symptoms (insomnia, anorexia, weight loss, loss of interest)",
    "Sustained depression with vegetative symptoms and suicidal thoughts or intent",
  ])),
  item("4", "Motivation / initiative", STANDARD_5([
    "Normal",
    "Less assertive than usual, more passive",
    "Loss of initiative or disinterest in elective (non-routine) activities",
    "Loss of initiative or disinterest in day-to-day (routine) activities",
    "Withdrawn, complete loss of motivation",
  ])),
];

const PART_II: UPDRSItemDefinition[] = [
  item("5", "Speech", STANDARD_5([
    "Normal",
    "Mildly affected, no difficulty being understood",
    "Moderately affected, sometimes asked to repeat statements",
    "Severely affected, frequently asked to repeat statements",
    "Unintelligible most of the time",
  ])),
  item("6", "Salivation", STANDARD_5([
    "Normal",
    "Slight but definite excess of saliva, may have nighttime drooling",
    "Moderately excessive saliva, may have minimal drooling",
    "Marked excess of saliva with some drooling",
    "Marked drooling, requires constant tissue or handkerchief",
  ])),
  item("7", "Swallowing", STANDARD_5([
    "Normal",
    "Rare choking",
    "Occasional choking",
    "Requires soft food",
    "Requires NG tube or gastrostomy feeding",
  ])),
  item("8", "Handwriting", STANDARD_5([
    "Normal",
    "Slightly slow or small",
    "Moderately slow or small, all words legible",
    "Severely affected, not all words legible",
    "Illegible",
  ])),
  item("9", "Cutting food and handling utensils", STANDARD_5([
    "Normal",
    "Somewhat slow and clumsy, but no help needed",
    "Can cut most foods, although clumsy and slow; some help needed",
    "Food must be cut by someone, but can still feed slowly",
    "Needs to be fed",
  ])),
  item("10", "Dressing", STANDARD_5([
    "Normal",
    "Somewhat slow, but no help needed",
    "Occasional assistance with buttons or sleeves",
    "Considerable help required, but can do some things alone",
    "Helpless",
  ])),
  item("11", "Hygiene", STANDARD_5([
    "Normal",
    "Somewhat slow, but no help needed",
    "Needs help to shower or bathe, or is very slow",
    "Requires assistance for washing, brushing teeth, combing hair, or using the toilet",
    "Foley catheter or other mechanical aid",
  ])),
  item("12", "Turning in bed and adjusting bed clothes", STANDARD_5([
    "Normal",
    "Somewhat slow and clumsy, but no help needed",
    "Can turn alone or adjust sheets, but with great difficulty",
    "Can initiate but not turn or adjust sheets alone",
    "Helpless",
  ])),
  item("13", "Falling (unrelated to freezing)", STANDARD_5([
    "None",
    "Rare falling",
    "Occasionally falls, less than once per day",
    "Falls an average of once daily",
    "Falls more than once daily",
  ])),
  item("14", "Freezing when walking", STANDARD_5([
    "None",
    "Rare freezing when walking, may have start hesitation",
    "Occasional freezing when walking",
    "Frequent freezing, occasional falls from freezing",
    "Frequent falls from freezing",
  ])),
  item("15", "Walking", STANDARD_5([
    "Normal",
    "Mild difficulty, may not swing arms or may tend to drag a leg",
    "Moderate difficulty, but requires little or no assistance",
    "Severe disturbance requiring assistance",
    "Cannot walk at all, even with assistance",
  ])),
  item("16", "Tremor (symptomatic, any body part)", STANDARD_5([
    "Absent",
    "Slight and infrequently present",
    "Moderate, bothersome to patient",
    "Severe, interferes with many activities",
    "Marked, interferes with most activities",
  ])),
  item("17", "Sensory complaints related to parkinsonism", STANDARD_5([
    "None",
    "Occasionally has numbness, tingling, or mild aching",
    "Frequently has numbness, tingling, or aching; not distressing",
    "Frequent painful sensations",
    "Excruciating pain",
  ])),
];

const BRADYKINESIA_ANCHORS: [string, string, string, string, string] = [
  "Normal",
  "Mild slowing and/or reduction in amplitude",
  "Moderately impaired, definite and early fatiguing, may have occasional arrests",
  "Severely impaired, frequent hesitation in initiating or arrests in ongoing movement",
  "Can barely perform the task",
];

const REST_TREMOR_ANCHORS: [string, string, string, string, string] = [
  "Absent",
  "Slight and infrequently present",
  "Mild in amplitude and persistent, or moderate in amplitude but only intermittently present",
  "Moderate in amplitude and present most of the time",
  "Marked in amplitude and present most of the time",
];

const RIGIDITY_ANCHORS: [string, string, string, string, string] = [
  "Absent",
  "Slight, or detectable only when activated by mirror or other movements",
  "Mild to moderate",
  "Marked, but full range of motion easily achieved",
  "Severe, range of motion achieved with difficulty",
];

const PART_III: UPDRSItemDefinition[] = [
  item("18", "Speech", STANDARD_5([
    "Normal",
    "Slight loss of expression, diction, and/or volume",
    "Monotone, slurred but understandable, moderately impaired",
    "Marked impairment, difficult to understand",
    "Unintelligible",
  ])),
  item("19", "Facial expression", STANDARD_5([
    "Normal",
    "Minimal hypomimia, could be normal \"poker face\"",
    "Slight but definitely abnormal diminution of facial expression",
    "Moderate hypomimia, lips parted some of the time",
    "Masked or fixed facies with severe or complete loss of facial expression; lips parted 1/4 inch or more",
  ])),
  item("20", "Tremor at rest — face, lips, chin", REST_TREMOR_ANCHORS),
  item("20", "Tremor at rest — hands", REST_TREMOR_ANCHORS, { side: "right" }),
  item("20", "Tremor at rest — hands", REST_TREMOR_ANCHORS, { side: "left" }),
  item("20", "Tremor at rest — feet", REST_TREMOR_ANCHORS, { side: "right" }),
  item("20", "Tremor at rest — feet", REST_TREMOR_ANCHORS, { side: "left" }),
  item("21", "Action or postural tremor of hands", STANDARD_5([
    "Absent",
    "Slight, present with action",
    "Moderate in amplitude, present with action",
    "Moderate in amplitude with posture holding as well as action",
    "Marked in amplitude, interferes with feeding",
  ]), { side: "right" }),
  item("21", "Action or postural tremor of hands", STANDARD_5([
    "Absent",
    "Slight, present with action",
    "Moderate in amplitude, present with action",
    "Moderate in amplitude with posture holding as well as action",
    "Marked in amplitude, interferes with feeding",
  ]), { side: "left" }),
  item("22", "Rigidity — neck", RIGIDITY_ANCHORS),
  item("22", "Rigidity — upper extremity", RIGIDITY_ANCHORS, { side: "right" }),
  item("22", "Rigidity — upper extremity", RIGIDITY_ANCHORS, { side: "left" }),
  item("22", "Rigidity — lower extremity", RIGIDITY_ANCHORS, { side: "right" }),
  item("22", "Rigidity — lower extremity", RIGIDITY_ANCHORS, { side: "left" }),
  item("23", "Finger taps", BRADYKINESIA_ANCHORS, { side: "right" }),
  item("23", "Finger taps", BRADYKINESIA_ANCHORS, { side: "left" }),
  item("24", "Hand movements (open/close fist)", BRADYKINESIA_ANCHORS, { side: "right" }),
  item("24", "Hand movements (open/close fist)", BRADYKINESIA_ANCHORS, { side: "left" }),
  item("25", "Rapid alternating movements of hands", BRADYKINESIA_ANCHORS, { side: "right" }),
  item("25", "Rapid alternating movements of hands", BRADYKINESIA_ANCHORS, { side: "left" }),
  item("26", "Leg agility", BRADYKINESIA_ANCHORS, { side: "right" }),
  item("26", "Leg agility", BRADYKINESIA_ANCHORS, { side: "left" }),
  item("27", "Arising from chair", STANDARD_5([
    "Normal",
    "Slow, or may need more than one attempt",
    "Pushes self up from arms of seat",
    "Tends to fall back and may have to try more than once, but can arise without assistance",
    "Unable to arise without help",
  ])),
  item("28", "Posture", STANDARD_5([
    "Normal",
    "Not quite erect, slightly stooped; could be normal for an older person",
    "Moderately stooped posture, definitely abnormal",
    "Severely stooped posture with kyphosis",
    "Marked flexion with extreme abnormality of posture",
  ])),
  item("29", "Gait", STANDARD_5([
    "Normal",
    "Walks slowly, may shuffle with short steps, no festination or propulsion",
    "Walks with difficulty, but requires little or no assistance; some festination, short steps, or propulsion",
    "Severe disturbance of gait, requiring assistance",
    "Cannot walk at all, even with assistance",
  ])),
  item("30", "Postural stability (response to sudden posterior displacement)", STANDARD_5([
    "Normal",
    "Retropulsion, but recovers unaided",
    "Absence of postural response, would fall if not caught by examiner",
    "Very unstable, tends to lose balance spontaneously",
    "Unable to stand without assistance",
  ])),
  item("31", "Body bradykinesia and hypokinesia (slowness, hesitancy, decreased arm swing, small amplitude, poverty of movement)", STANDARD_5([
    "None",
    "Minimal slowness, giving movement a deliberate character; could be normal for some persons; possibly reduced amplitude",
    "Mild degree of slowness and poverty of movement that is definitely abnormal; alternatively, some reduced amplitude",
    "Moderate slowness, poverty, or small amplitude of movement",
    "Marked slowness, poverty, or small amplitude of movement",
  ])),
];

const PART_IV: UPDRSItemDefinition[] = [
  item("32", "Dyskinesia duration — proportion of waking day", STANDARD_5([
    "None (0% of day)",
    "1-25% of day",
    "26-50% of day",
    "51-75% of day",
    "76-100% of day",
  ])),
  item("33", "Dyskinesia disability", STANDARD_5([
    "Not disabling",
    "Mildly disabling",
    "Moderately disabling",
    "Severely disabling",
    "Completely disabling",
  ])),
  item("34", "Painful dyskinesias", STANDARD_5([
    "No painful dyskinesias",
    "Slight",
    "Moderate",
    "Severe",
    "Marked",
  ])),
  item("35", "Presence of early morning dystonia", ["No", "Yes"], { maxScore: 1 }),
  item("36", "\"Off\" periods are predictable", ["No", "Yes"], { maxScore: 1 }),
  item("37", "\"Off\" periods are unpredictable", ["No", "Yes"], { maxScore: 1 }),
  item("38", "\"Off\" periods come on suddenly (within seconds)", ["No", "Yes"], { maxScore: 1 }),
  item("39", "Proportion of waking day spent \"off\" on average", STANDARD_5([
    "None (0% of day)",
    "1-25% of day",
    "26-50% of day",
    "51-75% of day",
    "76-100% of day",
  ])),
  item("40", "Anorexia, nausea, or vomiting", ["No", "Yes"], { maxScore: 1 }),
  item("41", "Sleep disturbances (insomnia or hypersomnolence)", ["No", "Yes"], { maxScore: 1 }),
  item("42", "Symptomatic orthostasis", ["No", "Yes"], { maxScore: 1 }),
];

const HOEHN_YAHR_STAGES: HoehnYahrStageInfo[] = [
  { stage: 0, description: "No signs of disease" },
  { stage: 1, description: "Unilateral disease only" },
  { stage: 1.5, description: "Unilateral disease plus axial involvement" },
  { stage: 2, description: "Bilateral disease, without impairment of balance" },
  { stage: 2.5, description: "Mild bilateral disease with recovery on the pull (retropulsion) test" },
  { stage: 3, description: "Mild to moderate bilateral disease; some postural instability; physically independent" },
  { stage: 4, description: "Severe disability; still able to walk or stand unassisted" },
  { stage: 5, description: "Wheelchair bound or bedridden unless aided" },
];

const ALL_ITEMS = [...PART_I, ...PART_II, ...PART_III, ...PART_IV];
const VALID_HY_STAGES = new Set(HOEHN_YAHR_STAGES.map(s => s.stage));

function sumPart(items: UPDRSItemDefinition[], scores: UPDRSScores): number {
  return items.reduce((sum, i) => sum + (scores[i.id] ?? 0), 0);
}

export class UpdrsInputError extends Error {}

const TABLE = "updrsAssessmentsTable";
const MAX_NOTES_LENGTH = 2000;

export function createUpdrsAssessmentService(phiDb: typeof defaultPhiDb = defaultPhiDb) {
  async function getHistory(profileId: string, limit?: number): Promise<UPDRSAssessment[]> {
    const query = phiDb
      .select()
      .from(updrsAssessmentsTable)
      .where(eq(updrsAssessmentsTable.userId, profileId))
      .orderBy(desc(updrsAssessmentsTable.assessedAt));
    const rows = limit ? await query.limit(limit) : await query;
    return decryptPhiRows(TABLE, rows).map(r => r.updrsResult as unknown as UPDRSAssessment);
  }

  async function getLatest(profileId: string): Promise<UPDRSAssessment | undefined> {
    return (await getHistory(profileId, 1))[0];
  }

  async function calculateAssessment(profileId: string, rawScores: UPDRSScores, hoehnYahrStage: number, notes?: string): Promise<UPDRSAssessment> {
    if (!VALID_HY_STAGES.has(hoehnYahrStage)) {
      throw new UpdrsInputError(`Invalid Hoehn and Yahr stage: ${hoehnYahrStage}`);
    }
    if (notes !== undefined && (typeof notes !== "string" || notes.length > MAX_NOTES_LENGTH)) {
      throw new UpdrsInputError(`Notes must be text of at most ${MAX_NOTES_LENGTH} characters`);
    }

    const scores: UPDRSScores = {};
    for (const def of ALL_ITEMS) {
      const value = rawScores[def.id];
      if (value === undefined) continue;
      if (!Number.isInteger(value) || value < 0 || value > def.maxScore) {
        throw new UpdrsInputError(`Score for item ${def.number} (${def.label}) must be an integer between 0 and ${def.maxScore}`);
      }
      scores[def.id] = value;
    }

    const partITotal = sumPart(PART_I, scores);
    const partIITotal = sumPart(PART_II, scores);
    const partIIITotal = sumPart(PART_III, scores);
    const partIVTotal = sumPart(PART_IV, scores);
    const motorTotal = partIITotal + partIIITotal;
    const grandTotal = partITotal + partIITotal + partIIITotal + partIVTotal;

    const previous = await getLatest(profileId);
    const previousGrandTotal = previous?.grandTotal;
    let trend: UPDRSAssessment["trend"] = "baseline";
    let changeFromPrevious: number | undefined;
    if (previousGrandTotal !== undefined) {
      changeFromPrevious = grandTotal - previousGrandTotal;
      if (changeFromPrevious > 0) trend = "worsened";
      else if (changeFromPrevious < 0) trend = "improved";
      else trend = "stable";
    }

    const assessment: UPDRSAssessment = {
      id: randomUUID(),
      profileId,
      scores,
      hoehnYahrStage,
      partITotal,
      partIITotal,
      partIIITotal,
      partIVTotal,
      motorTotal,
      grandTotal,
      previousGrandTotal,
      changeFromPrevious,
      trend,
      notes,
      assessedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };

    await phiDb.insert(updrsAssessmentsTable).values(encryptPhiRow(TABLE, {
      id: assessment.id,
      userId: profileId,
      updrsResult: assessment as unknown as Record<string, unknown>,
      assessedAt: new Date(assessment.assessedAt),
    }));

    return assessment;
  }

  return {
    getScaleDefinition(): UPDRSScaleDefinition {
      return {
        partI: PART_I,
        partII: PART_II,
        partIII: PART_III,
        partIV: PART_IV,
        hoehnYahrStages: HOEHN_YAHR_STAGES,
        disclaimer: DISCLAIMER,
      };
    },
    calculateAssessment,
    getHistory: (profileId: string) => getHistory(profileId),
    getLatest,
  };
}

export const updrsAssessmentService = createUpdrsAssessmentService();
