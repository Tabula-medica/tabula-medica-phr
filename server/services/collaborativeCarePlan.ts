import type {
  CollaborativeCarePlan,
  CarePlanContributor,
  CarePlanVersion,
  CarePlanChange,
  CarePlanAcknowledgment,
  CarePlanSuggestion,
  InsertCollaborativeCarePlan,
  InsertCarePlanContributor,
  InsertCarePlanVersion,
  InsertCarePlanChange,
  InsertCarePlanAcknowledgment,
  InsertCarePlanSuggestion,
  CarePlanChangeType,
  SuggestionStatus,
  UserRole,
  CarePlanGoal,
  CarePlanIntervention,
} from "@shared/schema";
import { generatePhiSafeText } from "./ai-gateway";

const carePlans = new Map<string, CollaborativeCarePlan>();
const contributors = new Map<string, CarePlanContributor>();
const versions = new Map<string, CarePlanVersion>();
const changes = new Map<string, CarePlanChange>();
const acknowledgments = new Map<string, CarePlanAcknowledgment>();
const suggestions = new Map<string, CarePlanSuggestion>();

const aiEnabled = true;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createCollaborativeCarePlan(
  data: InsertCollaborativeCarePlan,
  creatorId: string,
  creatorName: string
): CollaborativeCarePlan {
  const id = generateId("ccp");
  const now = new Date().toISOString();
  
  const carePlan: CollaborativeCarePlan = {
    id,
    patientId: data.patientId,
    patientName: data.patientName,
    title: data.title,
    description: data.description,
    category: data.category,
    status: data.status || "draft",
    startDate: data.startDate,
    targetEndDate: (data as any).targetEndDate,
    goals: data.goals || [],
    interventions: data.interventions || [],
    progressNotes: [],
    careTeam: data.careTeam || [],
    conditions: data.conditions || [],
    createdBy: creatorId,
    createdByName: creatorName,
    createdAt: now,
    updatedAt: now,
    currentVersionNumber: 1,
    pendingSuggestionsCount: 0,
    contributorCount: 1,
    isLocked: false,
  };
  
  carePlans.set(id, carePlan);
  
  const contributor: CarePlanContributor = {
    id: generateId("contrib"),
    carePlanId: id,
    userId: creatorId,
    userName: creatorName,
    userRole: "provider",
    contributorRole: "owner",
    canEdit: true,
    canApprove: true,
    addedBy: creatorId,
    addedAt: now,
    isActive: true,
  };
  contributors.set(contributor.id, contributor);
  
  const version = createVersion(id, carePlan, creatorId, creatorName, "Initial care plan created");
  
  recordChange({
    carePlanId: id,
    versionId: version.id,
    changeType: "created",
    fieldPath: "",
    newValue: JSON.stringify({ title: data.title }),
    changedBy: creatorId,
    changedByName: creatorName,
    changedByRole: "provider",
    reason: "Care plan created",
  });
  
  return carePlan;
}

export function getCollaborativeCarePlan(id: string): CollaborativeCarePlan | undefined {
  return carePlans.get(id);
}

export function getCarePlansByPatient(patientId: string): CollaborativeCarePlan[] {
  return Array.from(carePlans.values())
    .filter(cp => cp.patientId === patientId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getCarePlansByContributor(userId: string): CollaborativeCarePlan[] {
  const userContributions = Array.from(contributors.values())
    .filter(c => c.userId === userId && c.isActive);
  
  return userContributions
    .map(c => carePlans.get(c.carePlanId))
    .filter((cp): cp is CollaborativeCarePlan => cp !== undefined)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getAllCollaborativeCarePlans(): CollaborativeCarePlan[] {
  return Array.from(carePlans.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function updateCollaborativeCarePlan(
  id: string,
  updates: Partial<CollaborativeCarePlan>,
  userId: string,
  userName: string,
  userRole: UserRole,
  reason?: string
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(id);
  if (!carePlan) return null;
  
  if (carePlan.isLocked && carePlan.lockedBy !== userId) {
    throw new Error(`Care plan is locked by ${carePlan.lockedBy}`);
  }
  
  const changesList: InsertCarePlanChange[] = [];
  const now = new Date().toISOString();
  
  if (updates.title && updates.title !== carePlan.title) {
    changesList.push({
      carePlanId: id,
      changeType: "title_updated",
      fieldPath: "title",
      previousValue: carePlan.title,
      newValue: updates.title,
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
      reason,
    });
  }
  
  if (updates.description !== undefined && updates.description !== carePlan.description) {
    changesList.push({
      carePlanId: id,
      changeType: "description_updated",
      fieldPath: "description",
      previousValue: carePlan.description || "",
      newValue: updates.description || "",
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
      reason,
    });
  }
  
  if (updates.status && updates.status !== carePlan.status) {
    changesList.push({
      carePlanId: id,
      changeType: "status_changed",
      fieldPath: "status",
      previousValue: carePlan.status,
      newValue: updates.status,
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
      reason,
    });
  }
  
  const updated: CollaborativeCarePlan = {
    ...carePlan,
    ...updates,
    id,
    patientId: carePlan.patientId,
    createdBy: carePlan.createdBy,
    createdAt: carePlan.createdAt,
    updatedAt: now,
    currentVersionNumber: carePlan.currentVersionNumber + 1,
  };
  
  carePlans.set(id, updated);
  
  if (changesList.length > 0) {
    const version = createVersion(
      id,
      updated,
      userId,
      userName,
      changesList.map(c => c.changeType).join(", ")
    );
    
    changesList.forEach(change => {
      recordChange({ ...change, versionId: version.id });
    });
  }
  
  return updated;
}

export function addGoalToCarePlan(
  carePlanId: string,
  goal: CarePlanGoal,
  userId: string,
  userName: string,
  userRole: UserRole
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return null;
  
  const updatedGoals = [...carePlan.goals, goal];
  
  const updated = updateCollaborativeCarePlan(
    carePlanId,
    { goals: updatedGoals },
    userId,
    userName,
    userRole,
    `Added goal: ${goal.description}`
  );
  
  if (updated) {
    recordChange({
      carePlanId,
      changeType: "goal_added",
      fieldPath: `goals[${updatedGoals.length - 1}]`,
      newValue: JSON.stringify(goal),
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
      reason: `Added goal: ${goal.description}`,
    });
  }
  
  return updated;
}

export function updateGoalInCarePlan(
  carePlanId: string,
  goalId: string,
  updates: Partial<CarePlanGoal>,
  userId: string,
  userName: string,
  userRole: UserRole
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return null;
  
  const goalIndex = carePlan.goals.findIndex(g => g.id === goalId);
  if (goalIndex === -1) return null;
  
  const previousGoal = carePlan.goals[goalIndex];
  const updatedGoal = { ...previousGoal, ...updates };
  const updatedGoals = [...carePlan.goals];
  updatedGoals[goalIndex] = updatedGoal;
  
  const updated = updateCollaborativeCarePlan(
    carePlanId,
    { goals: updatedGoals },
    userId,
    userName,
    userRole,
    `Updated goal: ${updatedGoal.description}`
  );
  
  if (updated) {
    recordChange({
      carePlanId,
      changeType: "goal_updated",
      fieldPath: `goals[${goalIndex}]`,
      previousValue: JSON.stringify(previousGoal),
      newValue: JSON.stringify(updatedGoal),
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
    });
  }
  
  return updated;
}

export function removeGoalFromCarePlan(
  carePlanId: string,
  goalId: string,
  userId: string,
  userName: string,
  userRole: UserRole
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return null;
  
  const goalIndex = carePlan.goals.findIndex(g => g.id === goalId);
  if (goalIndex === -1) return null;
  
  const removedGoal = carePlan.goals[goalIndex];
  const updatedGoals = carePlan.goals.filter(g => g.id !== goalId);
  
  const updated = updateCollaborativeCarePlan(
    carePlanId,
    { goals: updatedGoals },
    userId,
    userName,
    userRole,
    `Removed goal: ${removedGoal.description}`
  );
  
  if (updated) {
    recordChange({
      carePlanId,
      changeType: "goal_removed",
      fieldPath: `goals[${goalIndex}]`,
      previousValue: JSON.stringify(removedGoal),
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
    });
  }
  
  return updated;
}

export function addInterventionToCarePlan(
  carePlanId: string,
  intervention: CarePlanIntervention,
  userId: string,
  userName: string,
  userRole: UserRole
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return null;
  
  const updatedInterventions = [...carePlan.interventions, intervention];
  
  const updated = updateCollaborativeCarePlan(
    carePlanId,
    { interventions: updatedInterventions },
    userId,
    userName,
    userRole,
    `Added intervention: ${intervention.description}`
  );
  
  if (updated) {
    recordChange({
      carePlanId,
      changeType: "intervention_added",
      fieldPath: `interventions[${updatedInterventions.length - 1}]`,
      newValue: JSON.stringify(intervention),
      changedBy: userId,
      changedByName: userName,
      changedByRole: userRole,
    });
  }
  
  return updated;
}

export function addContributor(data: InsertCarePlanContributor): CarePlanContributor | null {
  const carePlan = carePlans.get(data.carePlanId);
  if (!carePlan) return null;
  
  const existing = Array.from(contributors.values()).find(
    c => c.carePlanId === data.carePlanId && c.userId === data.userId && c.isActive
  );
  if (existing) return existing;
  
  const contributor: CarePlanContributor = {
    id: generateId("contrib"),
    carePlanId: data.carePlanId,
    userId: data.userId,
    userName: data.userName,
    userRole: data.userRole,
    contributorRole: data.contributorRole,
    canEdit: data.canEdit ?? false,
    canApprove: data.canApprove ?? false,
    addedBy: data.addedBy,
    addedAt: new Date().toISOString(),
    isActive: true,
  };
  
  contributors.set(contributor.id, contributor);
  
  carePlan.contributorCount++;
  carePlans.set(carePlan.id, carePlan);
  
  return contributor;
}

export function removeContributor(contributorId: string): boolean {
  const contributor = contributors.get(contributorId);
  if (!contributor) return false;
  
  contributor.isActive = false;
  contributors.set(contributorId, contributor);
  
  const carePlan = carePlans.get(contributor.carePlanId);
  if (carePlan) {
    carePlan.contributorCount = Math.max(0, carePlan.contributorCount - 1);
    carePlans.set(carePlan.id, carePlan);
  }
  
  return true;
}

export function getContributors(carePlanId: string): CarePlanContributor[] {
  return Array.from(contributors.values())
    .filter(c => c.carePlanId === carePlanId && c.isActive);
}

export function getContributorAccess(carePlanId: string, userId: string): CarePlanContributor | undefined {
  return Array.from(contributors.values()).find(
    c => c.carePlanId === carePlanId && c.userId === userId && c.isActive
  );
}

function createVersion(
  carePlanId: string,
  snapshot: CollaborativeCarePlan,
  createdBy: string,
  createdByName: string,
  changesSummary: string
): CarePlanVersion {
  const existingVersions = getVersionHistory(carePlanId);
  const versionNumber = existingVersions.length + 1;
  
  const version: CarePlanVersion = {
    id: generateId("ver"),
    carePlanId,
    versionNumber,
    snapshot: JSON.stringify(snapshot),
    createdBy,
    createdByName,
    createdAt: new Date().toISOString(),
    changesSummary,
    changesCount: 1,
  };
  
  versions.set(version.id, version);
  return version;
}

export function getVersionHistory(carePlanId: string): CarePlanVersion[] {
  return Array.from(versions.values())
    .filter(v => v.carePlanId === carePlanId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function getVersion(versionId: string): CarePlanVersion | undefined {
  return versions.get(versionId);
}

export function getVersionSnapshot(versionId: string): CollaborativeCarePlan | null {
  const version = versions.get(versionId);
  if (!version) return null;
  
  try {
    return JSON.parse(version.snapshot) as CollaborativeCarePlan;
  } catch {
    return null;
  }
}

function recordChange(data: InsertCarePlanChange): CarePlanChange {
  const change: CarePlanChange = {
    id: generateId("change"),
    carePlanId: data.carePlanId,
    versionId: data.versionId,
    changeType: data.changeType,
    fieldPath: data.fieldPath,
    previousValue: data.previousValue,
    newValue: data.newValue,
    changedBy: data.changedBy,
    changedByName: data.changedByName,
    changedByRole: data.changedByRole,
    changedAt: new Date().toISOString(),
    reason: data.reason,
  };
  
  changes.set(change.id, change);
  return change;
}

export function getChangeHistory(carePlanId: string): CarePlanChange[] {
  return Array.from(changes.values())
    .filter(c => c.carePlanId === carePlanId)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}

export function acknowledgeCarePlan(data: InsertCarePlanAcknowledgment): CarePlanAcknowledgment | null {
  const carePlan = carePlans.get(data.carePlanId);
  if (!carePlan) return null;
  
  const latestVersion = getVersionHistory(data.carePlanId)[0];
  if (!latestVersion) return null;
  
  const acknowledgment: CarePlanAcknowledgment = {
    id: generateId("ack"),
    carePlanId: data.carePlanId,
    versionId: data.versionId || latestVersion.id,
    patientId: data.patientId,
    patientName: data.patientName,
    acknowledgedAt: new Date().toISOString(),
    signature: data.signature,
    acknowledgedVia: data.acknowledgedVia,
    witnessName: data.witnessName,
    notes: data.notes,
    ipAddress: data.ipAddress,
  };
  
  acknowledgments.set(acknowledgment.id, acknowledgment);
  
  carePlan.lastAcknowledgedVersionId = acknowledgment.versionId;
  carePlan.lastAcknowledgedAt = acknowledgment.acknowledgedAt;
  carePlans.set(carePlan.id, carePlan);
  
  recordChange({
    carePlanId: data.carePlanId,
    versionId: acknowledgment.versionId,
    changeType: "acknowledged",
    fieldPath: "acknowledgment",
    newValue: JSON.stringify({
      patientName: data.patientName,
      acknowledgedVia: data.acknowledgedVia,
    }),
    changedBy: data.patientId,
    changedByName: data.patientName,
    changedByRole: "patient",
    reason: "Patient acknowledged care plan",
  });
  
  return acknowledgment;
}

export function getAcknowledgments(carePlanId: string): CarePlanAcknowledgment[] {
  return Array.from(acknowledgments.values())
    .filter(a => a.carePlanId === carePlanId)
    .sort((a, b) => new Date(b.acknowledgedAt).getTime() - new Date(a.acknowledgedAt).getTime());
}

export function getPatientAcknowledgments(patientId: string): CarePlanAcknowledgment[] {
  return Array.from(acknowledgments.values())
    .filter(a => a.patientId === patientId)
    .sort((a, b) => new Date(b.acknowledgedAt).getTime() - new Date(a.acknowledgedAt).getTime());
}

export async function generateAISuggestions(
  carePlanId: string,
  patientData: {
    recentVitals?: { name: string; value: string; trend: string }[];
    labResults?: { name: string; value: string; status: string }[];
    medications?: { name: string; adherence: number }[];
    conditions?: string[];
  }
): Promise<CarePlanSuggestion[]> {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return [];
  
  const generatedSuggestions: CarePlanSuggestion[] = [];
  
  if (aiEnabled) {
    try {
      const prompt = `You are a clinical decision support AI. Analyze this care plan and patient data to suggest improvements.

Care Plan:
- Title: ${carePlan.title}
- Status: ${carePlan.status}
- Category: ${carePlan.category}
- Goals: ${JSON.stringify(carePlan.goals.map(g => ({ description: g.description, status: g.status, targetDate: g.targetDate })))}
- Interventions: ${JSON.stringify(carePlan.interventions.map(i => ({ description: i.description, frequency: i.frequency, status: i.status })))}
- Conditions: ${carePlan.conditions.join(", ")}

Patient Data:
- Recent Vitals: ${JSON.stringify(patientData.recentVitals || [])}
- Lab Results: ${JSON.stringify(patientData.labResults || [])}
- Medication Adherence: ${JSON.stringify(patientData.medications || [])}

Provide 2-3 specific, actionable suggestions to improve this care plan based on the patient's current health data. Format as JSON array with objects containing: suggestionType (goal_adjustment, intervention_add, intervention_modify, new_goal), title, description, rationale, priority (high, medium, low), confidence (0-100).`;

      const content = await generatePhiSafeText({
        user: prompt,
        responseMimeType: "application/json",
        maxTokens: 1000,
      });

      if (content) {
        const parsed = JSON.parse(content);
        const aiSuggestions = Array.isArray(parsed) ? parsed : parsed.suggestions || [];
        
        for (const s of aiSuggestions) {
          const suggestion: CarePlanSuggestion = {
            id: generateId("sug"),
            carePlanId,
            patientId: carePlan.patientId,
            suggestionType: s.suggestionType || "goal_adjustment",
            title: s.title || "AI Suggestion",
            description: s.description || "",
            rationale: s.rationale || "",
            evidenceBasis: s.evidenceBasis || [],
            suggestedChanges: s.suggestedChanges || [],
            priority: s.priority || "medium",
            confidence: s.confidence || 70,
            basedOnMetrics: patientData.recentVitals?.map(v => ({
              metricName: v.name,
              currentValue: v.value,
              trend: v.trend as "improving" | "stable" | "worsening",
            })) || [],
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          
          suggestions.set(suggestion.id, suggestion);
          generatedSuggestions.push(suggestion);
        }
      }
    } catch (error) {
      console.error("[CollaborativeCarePlan] AI suggestion error:", error);
    }
  }
  
  if (generatedSuggestions.length === 0) {
    const fallbackSuggestions = generateFallbackSuggestions(carePlan, patientData);
    fallbackSuggestions.forEach(s => {
      suggestions.set(s.id, s);
      generatedSuggestions.push(s);
    });
  }
  
  const cp = carePlans.get(carePlanId);
  if (cp) {
    cp.pendingSuggestionsCount = generatedSuggestions.filter(s => s.status === "pending").length;
    carePlans.set(carePlanId, cp);
  }
  
  return generatedSuggestions;
}

function generateFallbackSuggestions(
  carePlan: CollaborativeCarePlan,
  patientData: {
    recentVitals?: { name: string; value: string; trend: string }[];
    labResults?: { name: string; value: string; status: string }[];
    medications?: { name: string; adherence: number }[];
    conditions?: string[];
  }
): CarePlanSuggestion[] {
  const suggestions: CarePlanSuggestion[] = [];
  const now = new Date().toISOString();
  
  if (patientData.medications?.some(m => m.adherence < 80)) {
    suggestions.push({
      id: generateId("sug"),
      carePlanId: carePlan.id,
      patientId: carePlan.patientId,
      suggestionType: "intervention_add",
      title: "Add Medication Adherence Support",
      description: "Consider adding medication reminder interventions to improve adherence rates.",
      rationale: "Patient shows medication adherence below 80% for some medications. Studies show structured reminder programs can improve adherence by 15-20%.",
      evidenceBasis: ["JAMA Internal Medicine 2017", "Patient engagement research"],
      suggestedChanges: [{
        fieldPath: "interventions",
        suggestedValue: "Add daily medication reminder calls or app notifications",
      }],
      priority: "high",
      confidence: 85,
      basedOnMetrics: patientData.medications?.filter(m => m.adherence < 80).map(m => ({
        metricName: `${m.name} Adherence`,
        currentValue: `${m.adherence}%`,
        targetValue: "90%",
        trend: "worsening" as const,
      })) || [],
      status: "pending",
      createdAt: now,
    });
  }
  
  if (patientData.recentVitals?.some(v => v.trend === "worsening")) {
    const worseningVitals = patientData.recentVitals.filter(v => v.trend === "worsening");
    suggestions.push({
      id: generateId("sug"),
      carePlanId: carePlan.id,
      patientId: carePlan.patientId,
      suggestionType: "goal_adjustment",
      title: "Adjust Goals Based on Vital Trends",
      description: `Consider reviewing goals related to ${worseningVitals.map(v => v.name).join(", ")} due to worsening trends.`,
      rationale: "Vital sign trends indicate potential need for care plan adjustment to prevent complications.",
      evidenceBasis: ["Clinical monitoring guidelines"],
      suggestedChanges: [{
        fieldPath: "goals",
        suggestedValue: "Review and adjust targets based on current vital trends",
      }],
      priority: "medium",
      confidence: 75,
      basedOnMetrics: worseningVitals.map(v => ({
        metricName: v.name,
        currentValue: v.value,
        trend: "worsening" as const,
      })),
      status: "pending",
      createdAt: now,
    });
  }
  
  const overdueGoals = carePlan.goals.filter(g => 
    g.status === "in_progress" && g.targetDate && new Date(g.targetDate) < new Date()
  );
  
  if (overdueGoals.length > 0) {
    suggestions.push({
      id: generateId("sug"),
      carePlanId: carePlan.id,
      patientId: carePlan.patientId,
      suggestionType: "goal_adjustment",
      title: "Review Overdue Goals",
      description: `${overdueGoals.length} goal(s) are past their target date and may need timeline adjustment.`,
      rationale: "Overdue goals should be reviewed to determine if they need new target dates or modified approaches.",
      evidenceBasis: ["Care plan management best practices"],
      suggestedChanges: overdueGoals.map(g => ({
        fieldPath: `goals[${g.id}].targetDate`,
        currentValue: g.targetDate,
        suggestedValue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })),
      priority: "medium",
      confidence: 90,
      basedOnMetrics: overdueGoals.map(g => ({
        metricName: g.description.substring(0, 30),
        currentValue: g.targetDate || "N/A",
        trend: "worsening" as const,
      })),
      status: "pending",
      createdAt: now,
    });
  }
  
  return suggestions;
}

export function getSuggestions(carePlanId: string, status?: SuggestionStatus): CarePlanSuggestion[] {
  return Array.from(suggestions.values())
    .filter(s => s.carePlanId === carePlanId && (!status || s.status === status))
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export function reviewSuggestion(
  suggestionId: string,
  status: SuggestionStatus,
  reviewerId: string,
  reviewerName: string,
  notes?: string
): CarePlanSuggestion | null {
  const suggestion = suggestions.get(suggestionId);
  if (!suggestion) return null;
  
  suggestion.status = status;
  suggestion.reviewedBy = reviewerId;
  suggestion.reviewedByName = reviewerName;
  suggestion.reviewedAt = new Date().toISOString();
  suggestion.reviewNotes = notes;
  
  suggestions.set(suggestionId, suggestion);
  
  const carePlan = carePlans.get(suggestion.carePlanId);
  if (carePlan) {
    carePlan.pendingSuggestionsCount = Array.from(suggestions.values())
      .filter(s => s.carePlanId === carePlan.id && s.status === "pending").length;
    carePlans.set(carePlan.id, carePlan);
  }
  
  return suggestion;
}

export function applySuggestion(
  suggestionId: string,
  userId: string,
  userName: string,
  userRole: UserRole
): { success: boolean; carePlan?: CollaborativeCarePlan; error?: string } {
  const suggestion = suggestions.get(suggestionId);
  if (!suggestion) return { success: false, error: "Suggestion not found" };
  
  const carePlan = carePlans.get(suggestion.carePlanId);
  if (!carePlan) return { success: false, error: "Care plan not found" };
  
  suggestion.status = "implemented";
  suggestion.reviewedBy = userId;
  suggestion.reviewedByName = userName;
  suggestion.reviewedAt = new Date().toISOString();
  suggestions.set(suggestionId, suggestion);
  
  recordChange({
    carePlanId: carePlan.id,
    changeType: "suggestion_applied",
    fieldPath: suggestion.suggestedChanges[0]?.fieldPath || "suggestion",
    previousValue: suggestion.suggestedChanges[0]?.currentValue,
    newValue: suggestion.suggestedChanges[0]?.suggestedValue,
    changedBy: userId,
    changedByName: userName,
    changedByRole: userRole,
    reason: `Applied AI suggestion: ${suggestion.title}`,
  });
  
  const updated = updateCollaborativeCarePlan(
    carePlan.id,
    { updatedAt: new Date().toISOString() },
    userId,
    userName,
    userRole,
    `Applied AI suggestion: ${suggestion.title}`
  );
  
  return { success: true, carePlan: updated || undefined };
}

export function lockCarePlan(
  carePlanId: string,
  userId: string,
  reason: string
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return null;
  
  carePlan.isLocked = true;
  carePlan.lockedBy = userId;
  carePlan.lockedAt = new Date().toISOString();
  carePlan.lockReason = reason;
  
  carePlans.set(carePlanId, carePlan);
  return carePlan;
}

export function unlockCarePlan(
  carePlanId: string,
  userId: string
): CollaborativeCarePlan | null {
  const carePlan = carePlans.get(carePlanId);
  if (!carePlan) return null;
  
  if (carePlan.lockedBy !== userId) {
    throw new Error("Only the user who locked the care plan can unlock it");
  }
  
  carePlan.isLocked = false;
  carePlan.lockedBy = undefined;
  carePlan.lockedAt = undefined;
  carePlan.lockReason = undefined;
  
  carePlans.set(carePlanId, carePlan);
  return carePlan;
}

function initializeSampleData(): void {
  const sampleCarePlan: CollaborativeCarePlan = {
    id: "ccp-sample-1",
    patientId: "patient-1",
    patientName: "John Smith",
    title: "Diabetes Management Plan",
    description: "Comprehensive care plan for managing Type 2 Diabetes with focus on blood sugar control and lifestyle modifications.",
    category: "chronic_disease",
    status: "active",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    targetEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    goals: [
      {
        id: "goal-1",
        description: "Maintain HbA1c below 7%",
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
        priority: "high",
        progress: 65,
        metrics: [{ name: "HbA1c", target: "< 7%", current: "7.2%", unit: "%" }],
      },
      {
        id: "goal-2",
        description: "Achieve 150 minutes of moderate exercise weekly",
        targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
        priority: "medium",
        progress: 60,
        metrics: [{ name: "Weekly Exercise", target: "150 min", current: "90 min", unit: "minutes" }],
      },
    ],
    interventions: [
      {
        id: "int-1",
        goalId: "goal-1",
        description: "Daily blood glucose monitoring",
        frequency: "twice daily",
        assignedTo: "patient",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "in_progress",
      },
      {
        id: "int-2",
        goalId: "goal-2",
        description: "Weekly progress check with care coordinator",
        frequency: "weekly",
        assignedTo: "care-coord",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: "scheduled",
      },
    ],
    progressNotes: [],
    careTeam: [
      { id: "ct-1", name: "Dr. Sarah Smith", role: "primary_physician", specialty: "Endocrinology", isPrimary: true, email: "dr.smith@hospital.org" },
      { id: "ct-2", name: "Nurse Johnson", role: "nurse", isPrimary: false, email: "nurse.johnson@hospital.org" },
    ],
    conditions: ["Type 2 Diabetes", "Hypertension"],
    createdBy: "dr-smith",
    createdByName: "Dr. Sarah Smith",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    currentVersionNumber: 3,
    pendingSuggestionsCount: 2,
    contributorCount: 3,
    isLocked: false,
  };
  
  carePlans.set(sampleCarePlan.id, sampleCarePlan);
  
  const sampleContributors: CarePlanContributor[] = [
    {
      id: "contrib-1",
      carePlanId: "ccp-sample-1",
      userId: "dr-smith",
      userName: "Dr. Sarah Smith",
      userRole: "provider",
      contributorRole: "owner",
      canEdit: true,
      canApprove: true,
      addedBy: "dr-smith",
      addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    },
    {
      id: "contrib-2",
      carePlanId: "ccp-sample-1",
      userId: "nurse-johnson",
      userName: "Nurse Johnson",
      userRole: "provider",
      contributorRole: "editor",
      canEdit: true,
      canApprove: false,
      addedBy: "dr-smith",
      addedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    },
    {
      id: "contrib-3",
      carePlanId: "ccp-sample-1",
      userId: "patient-1",
      userName: "John Smith",
      userRole: "patient",
      contributorRole: "viewer",
      canEdit: false,
      canApprove: false,
      addedBy: "dr-smith",
      addedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    },
  ];
  
  sampleContributors.forEach(c => contributors.set(c.id, c));
  
  const sampleVersion: CarePlanVersion = {
    id: "ver-1",
    carePlanId: "ccp-sample-1",
    versionNumber: 1,
    snapshot: JSON.stringify(sampleCarePlan),
    createdBy: "dr-smith",
    createdByName: "Dr. Sarah Smith",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    changesSummary: "Initial care plan created",
    changesCount: 1,
  };
  
  versions.set(sampleVersion.id, sampleVersion);
  
  const sampleSuggestions: CarePlanSuggestion[] = [
    {
      id: "sug-1",
      carePlanId: "ccp-sample-1",
      patientId: "patient-1",
      suggestionType: "intervention_add",
      title: "Add Dietary Consultation",
      description: "Based on recent lab results, consider adding a dietary consultation to support blood sugar management.",
      rationale: "HbA1c trending slightly above target. Dietary modifications can help achieve better glycemic control.",
      evidenceBasis: ["ADA Standards of Care 2024", "Diabetes nutrition therapy guidelines"],
      suggestedChanges: [
        {
          fieldPath: "interventions",
          suggestedValue: "Monthly consultation with registered dietitian for meal planning and carb counting education",
        },
      ],
      priority: "medium",
      confidence: 82,
      basedOnMetrics: [
        { metricName: "HbA1c", currentValue: "7.2%", targetValue: "< 7%", trend: "stable" },
      ],
      status: "pending",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "sug-2",
      carePlanId: "ccp-sample-1",
      patientId: "patient-1",
      suggestionType: "goal_adjustment",
      title: "Adjust Exercise Goal Target Date",
      description: "Current exercise goal may need extended timeline based on patient's gradual progress.",
      rationale: "Patient achieving 60% of exercise target. Extending timeline may improve adherence and prevent discouragement.",
      evidenceBasis: ["Behavioral change research", "Exercise prescription guidelines"],
      suggestedChanges: [
        {
          fieldPath: "goals[1].targetDate",
          currentValue: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          suggestedValue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      priority: "low",
      confidence: 75,
      basedOnMetrics: [
        { metricName: "Weekly Exercise", currentValue: "90 min", targetValue: "150 min", trend: "improving" },
      ],
      status: "pending",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
  
  sampleSuggestions.forEach(s => suggestions.set(s.id, s));
}

initializeSampleData();

console.log("[CollaborativeCarePlan] Service initialized with sample data");
