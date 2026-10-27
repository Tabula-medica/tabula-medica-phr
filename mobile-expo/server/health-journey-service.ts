export interface JourneyMilestoneTemplate {
  title: string;
  description: string;
  phase: number;
  pointsReward: number;
}

const BASE_MILESTONES: ReadonlyArray<JourneyMilestoneTemplate> = [
  { title: "Getting Started", description: "Learn the basics of managing your condition", phase: 1, pointsReward: 50 },
  { title: "Building Habits", description: "Establish daily health routines", phase: 1, pointsReward: 75 },
  { title: "Tracking Progress", description: "Start logging your health metrics", phase: 2, pointsReward: 100 },
  { title: "Understanding Your Body", description: "Learn to recognize important signals", phase: 2, pointsReward: 100 },
  { title: "Making Adjustments", description: "Fine-tune your approach based on data", phase: 3, pointsReward: 125 },
  { title: "Building Confidence", description: "Take control of your health decisions", phase: 3, pointsReward: 125 },
  { title: "Long-term Success", description: "Maintain your healthy habits", phase: 4, pointsReward: 150 },
  { title: "Sharing Knowledge", description: "Help others on their journey", phase: 4, pointsReward: 200 },
];

export function generateJourneyMilestones(
  _journeyType: string,
  _conditions: ReadonlyArray<string>,
): JourneyMilestoneTemplate[] {
  return BASE_MILESTONES.map((m) => ({ ...m }));
}
