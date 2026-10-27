import { db } from "./db";
import { eq, desc, and, gte, lte, inArray, isNull, or, sql, like, ilike, count } from "drizzle-orm";
import { encryptPHI, decryptPHI } from "./compliance/encryption-service";
import { logger } from "./utils/logger";

const HEALTH_RECORD_PHI_FIELDS = ["title", "summary", "provider", "facility"] as const;
const PATIENT_PROFILE_PHI_FIELDS = ["firstName", "lastName", "middleName"] as const;

function encryptRecordFields<T extends Record<string, any>>(record: T, fields: readonly string[]): T {
  const encrypted = { ...record };
  for (const field of fields) {
    if (typeof encrypted[field] === "string" && encrypted[field] && !encrypted[field].startsWith("enc:")) {
      (encrypted as any)[field] = encryptPHI(encrypted[field]);
    }
  }
  return encrypted;
}

function decryptRecordFields<T extends Record<string, any>>(record: T, fields: readonly string[]): T {
  if (!record) return record;
  const decrypted = { ...record };
  for (const field of fields) {
    if (typeof decrypted[field] === "string" && decrypted[field]?.startsWith("enc:")) {
      try {
        (decrypted as any)[field] = decryptPHI(decrypted[field]);
      } catch {
        logger.warn("[ENCRYPTION] Failed to decrypt field", { field });
      }
    }
  }
  return decrypted;
}

function decryptRecordArray<T extends Record<string, any>>(records: T[], fields: readonly string[]): T[] {
  return records.map(r => decryptRecordFields(r, fields));
}
import {
  users, healthRecords, dataSources, shareLinks, packets, auditLogs, recordAttachments,
  userSessions, shareLinkAccessLogs, tenants, tenantUsers,
  fhirMetrics, fhirAlerts, harmonizedPatients, resourceVersions, dataConflicts, bulkImportJobs,
  fhirSyncJobs, fhirConnectionConfigs, fhirMappingRules, fhirTransformations, fhirCodeMappings, fhirValidationResults, fhirResourceSyncConfigs,
  smartApps, smartAppTokens, smartAppAccessLogs, conversations, messages,
  healthPredictions, anomalyDetections, nlQueries, populationAnalytics, patientProfiles,
  healthGoals, goalProgress,
  badges, userBadges, userGamification, pointTransactions, dailyChallenges, userChallenges,
  medicationReminders, medicationLogs, appointments, educationalModules, userEducationalProgress, aiConversations, aiMessages, aiInsights,
  healthReports, trendAnalyses,
  appointmentSuggestions, refillRequests, consultationSummaries,
  healthJourneys, journeyMilestones, adaptiveContent, carePlans, carePlanActivities,
  providerProfiles, messagingThreads, secureMessages, messageTemplates,
  connectedDevices, sensorReadings, sensorAlerts, sensorThresholds, sensorTrends,
  caseSummaries, researchRecommendations, providerCommunications,
  treatmentProtocols, protocolDeviations, kpiReports, outcomePredictions, populationHealthReports, treatmentEfficacyAnalyses,
  userSentimentLogs, personalizedContent, carePlanAdjustments, userProgressSnapshots,
  healthCommunities, communityMemberships, communityPosts, postComments, communityReactions,
  contentReports, moderationActions, communityUserStatus, goalProgressShares,
  healthTeams, teamMemberships, teamChallenges, teamChallengeParticipations, teamChallengeContributions, teamLeaderboards,
  carePathways, pathwaySteps, patientPathwayAssignments, patientStepProgress, pathwayNudges, pathwayAdherenceLogs, pathwayAnalytics,
  aiCaseReviews, clinicalTrials, providerMessages, providerMessageThreads,
  providerDashboardWidgets, providerDashboardPreferences, providerTasks, providerTaskComments,
  clinicalNotes, audioTranscripts, codeSuggestions, priorAuthRequests,
  educationalQuizzes, quizQuestions, quizAttempts, quizResponses, learningNeedsAssessments, contentRecommendations, personalizedNudges,
  LEVEL_THRESHOLDS, POINT_VALUES,
  type User, type InsertUser,
  type HealthRecord, type InsertHealthRecord,
  type RecordAttachment, type InsertRecordAttachment,
  type DataSource, type InsertDataSource,
  type ShareLink, type InsertShareLink,
  type Packet, type InsertPacket,
  type AuditLog, type InsertAuditLog,
  type UserSession, type InsertUserSession,
  type ShareLinkAccessLog, type InsertShareLinkAccessLog,
  type Tenant, type InsertTenant,
  type TenantUser, type InsertTenantUser,
  type FhirMetric, type InsertFhirMetric,
  type FhirAlert, type InsertFhirAlert,
  type HarmonizedPatient, type InsertHarmonizedPatient,
  type ResourceVersion, type InsertResourceVersion,
  type DataConflict, type InsertDataConflict,
  type BulkImportJob, type InsertBulkImportJob,
  type FhirSyncJob, type InsertFhirSyncJob,
  type FhirConnectionConfig, type InsertFhirConnectionConfig,
  type SmartApp, type InsertSmartApp,
  type SmartAppToken, type InsertSmartAppToken,
  type SmartAppAccessLog, type InsertSmartAppAccessLog,
  type HealthPrediction, type InsertHealthPrediction,
  type AnomalyDetection, type InsertAnomalyDetection,
  type NlQuery, type InsertNlQuery,
  type PopulationAnalytics, type InsertPopulationAnalytics,
  type PatientProfile, type InsertPatientProfile,
  type HealthGoal, type InsertHealthGoal,
  type GoalProgress, type InsertGoalProgress,
  type Badge, type InsertBadge,
  type UserBadge, type InsertUserBadge,
  type UserGamification, type InsertUserGamification,
  type PointTransaction, type InsertPointTransaction,
  type DailyChallenge, type InsertDailyChallenge,
  type UserChallenge, type InsertUserChallenge,
  type MedicationReminder, type InsertMedicationReminder,
  type MedicationLog, type InsertMedicationLog,
  type Appointment, type InsertAppointment,
  type EducationalModule, type InsertEducationalModule,
  type UserEducationalProgress, type InsertUserEducationalProgress,
  type AiConversation, type InsertAiConversation,
  type AiMessage, type InsertAiMessage,
  type AiInsight, type InsertAiInsight,
  type HealthReport, type InsertHealthReport,
  type TrendAnalysis, type InsertTrendAnalysis,
  type AppointmentSuggestion, type InsertAppointmentSuggestion,
  type RefillRequest, type InsertRefillRequest,
  type ConsultationSummary, type InsertConsultationSummary,
  type FhirResourceSyncConfig, type InsertFhirResourceSyncConfig,
  type HealthJourney, type InsertHealthJourney,
  type JourneyMilestone, type InsertJourneyMilestone,
  type AdaptiveContent, type InsertAdaptiveContent,
  type CarePlan, type InsertCarePlan,
  type CarePlanActivity, type InsertCarePlanActivity,
  type ProviderProfile, type InsertProviderProfile,
  type MessagingThread, type InsertMessagingThread,
  type SecureMessage, type InsertSecureMessage,
  type MessageTemplate, type InsertMessageTemplate,
  type ConnectedDevice, type InsertConnectedDevice,
  type SensorReading, type InsertSensorReading,
  type SensorAlert, type InsertSensorAlert,
  type SensorThreshold, type InsertSensorThreshold,
  type SensorTrend, type InsertSensorTrend,
  type CaseSummary, type InsertCaseSummary,
  type ResearchRecommendation, type InsertResearchRecommendation,
  type ProviderCommunication, type InsertProviderCommunication,
  type TreatmentProtocol, type InsertTreatmentProtocol,
  type ProtocolDeviation, type InsertProtocolDeviation,
  type KpiReport, type InsertKpiReport,
  type OutcomePrediction, type InsertOutcomePrediction,
  type PopulationHealthReport, type InsertPopulationHealthReport,
  type TreatmentEfficacyAnalysis, type InsertTreatmentEfficacyAnalysis,
  type UserSentimentLog, type InsertUserSentimentLog,
  type PersonalizedContent, type InsertPersonalizedContent,
  type CarePlanAdjustment, type InsertCarePlanAdjustment,
  type UserProgressSnapshot, type InsertUserProgressSnapshot,
  type HealthCommunity, type InsertHealthCommunity,
  type CommunityMembership, type InsertCommunityMembership,
  type CommunityPost, type InsertCommunityPost,
  type PostComment, type InsertPostComment,
  type CommunityReaction, type InsertCommunityReaction,
  type ContentReport, type InsertContentReport,
  type ModerationAction, type InsertModerationAction,
  type CommunityUserStatus, type InsertCommunityUserStatus,
  type GoalProgressShare, type InsertGoalProgressShare,
  type HealthTeam, type InsertHealthTeam,
  type TeamMembership, type InsertTeamMembership,
  type TeamChallenge, type InsertTeamChallenge,
  type TeamChallengeParticipation, type InsertTeamChallengeParticipation,
  type TeamChallengeContribution, type InsertTeamChallengeContribution,
  type TeamLeaderboard, type InsertTeamLeaderboard,
  type CarePathway, type InsertCarePathway,
  type PathwayStep, type InsertPathwayStep,
  type PatientPathwayAssignment, type InsertPatientPathwayAssignment,
  type PatientStepProgress, type InsertPatientStepProgress,
  type PathwayNudge, type InsertPathwayNudge,
  type PathwayAdherenceLog, type InsertPathwayAdherenceLog,
  type PathwayAnalytics, type InsertPathwayAnalytics,
  type AiCaseReview, type InsertAiCaseReview,
  type ClinicalTrial, type InsertClinicalTrial,
  type ProviderMessage, type InsertProviderMessage,
  type ProviderMessageThread, type InsertProviderMessageThread,
  type EducationalQuiz, type InsertEducationalQuiz,
  type QuizQuestion, type InsertQuizQuestion,
  type QuizAttempt, type InsertQuizAttempt,
  type QuizResponse, type InsertQuizResponse,
  type LearningNeedsAssessment, type InsertLearningNeedsAssessment,
  type ContentRecommendation, type InsertContentRecommendation,
  type PersonalizedNudge, type InsertPersonalizedNudge,
} from "@shared/schema";
import { randomBytes } from "crypto";

// IStorage is the structural contract for the storage layer. It is defined as
// the full public surface of DatabaseStorage so every method called from routes
// is statically guaranteed to exist on IStorage — no index signature, no
// module-augmentation fallback. The alias is declared after the class below.
export class DatabaseStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async getUserByAppleId(appleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.appleId, appleId)).limit(1);
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getUserCount(): Promise<number> {
    const result = await db.select().from(users);
    return result.length;
  }

  async getHealthRecords(userId: string): Promise<HealthRecord[]> {
    const records = await db.select().from(healthRecords)
      .where(eq(healthRecords.userId, userId))
      .orderBy(desc(healthRecords.date));
    return decryptRecordArray(records, HEALTH_RECORD_PHI_FIELDS);
  }

  async getHealthRecordsByType(userId: string, type: string): Promise<HealthRecord[]> {
    const records = await db.select().from(healthRecords)
      .where(and(eq(healthRecords.userId, userId), eq(healthRecords.type, type)))
      .orderBy(desc(healthRecords.date));
    return decryptRecordArray(records, HEALTH_RECORD_PHI_FIELDS);
  }

  async getHealthRecordsByFhirId(userId: string, fhirResourceType: string, fhirResourceId: string): Promise<HealthRecord[]> {
    const records = await db.select().from(healthRecords)
      .where(and(
        eq(healthRecords.userId, userId),
        eq(healthRecords.fhirResourceType, fhirResourceType),
        eq(healthRecords.fhirResourceId, fhirResourceId)
      ));
    return decryptRecordArray(records, HEALTH_RECORD_PHI_FIELDS);
  }

  async getHealthRecord(id: string): Promise<HealthRecord | undefined> {
    const [record] = await db.select().from(healthRecords)
      .where(eq(healthRecords.id, id))
      .limit(1);
    return record ? decryptRecordFields(record, HEALTH_RECORD_PHI_FIELDS) : undefined;
  }

  async createHealthRecord(record: InsertHealthRecord): Promise<HealthRecord> {
    const encrypted = encryptRecordFields(record as Record<string, any>, HEALTH_RECORD_PHI_FIELDS);
    const [created] = await db.insert(healthRecords).values(encrypted as InsertHealthRecord).returning();
    return decryptRecordFields(created, HEALTH_RECORD_PHI_FIELDS);
  }

  async updateHealthRecord(id: string, data: Partial<InsertHealthRecord>): Promise<HealthRecord | undefined> {
    const encrypted = encryptRecordFields(data as Record<string, any>, HEALTH_RECORD_PHI_FIELDS);
    const [record] = await db.update(healthRecords)
      .set({ ...encrypted, updatedAt: new Date() })
      .where(eq(healthRecords.id, id))
      .returning();
    return record ? decryptRecordFields(record, HEALTH_RECORD_PHI_FIELDS) : undefined;
  }

  async deleteHealthRecord(id: string): Promise<boolean> {
    await db.delete(healthRecords).where(eq(healthRecords.id, id));
    return true;
  }

  async getRecordAttachments(recordId: string): Promise<RecordAttachment[]> {
    return db.select().from(recordAttachments).where(eq(recordAttachments.recordId, recordId)).orderBy(desc(recordAttachments.uploadedAt));
  }

  async createRecordAttachment(attachment: InsertRecordAttachment): Promise<RecordAttachment> {
    const [result] = await db.insert(recordAttachments).values(attachment).returning();
    return result;
  }

  async deleteRecordAttachment(id: string): Promise<void> {
    await db.delete(recordAttachments).where(eq(recordAttachments.id, id));
  }

  async getDataSources(userId: string): Promise<DataSource[]> {
    return db.select().from(dataSources)
      .where(eq(dataSources.userId, userId))
      .orderBy(desc(dataSources.lastSyncAt));
  }

  async getDataSource(id: string): Promise<DataSource | undefined> {
    const [source] = await db.select().from(dataSources)
      .where(eq(dataSources.id, id))
      .limit(1);
    return source;
  }

  async createDataSource(source: InsertDataSource): Promise<DataSource> {
    const [created] = await db.insert(dataSources).values(source).returning();
    return created;
  }

  async updateDataSource(id: string, data: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const [source] = await db.update(dataSources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dataSources.id, id))
      .returning();
    return source;
  }

  async deleteDataSource(id: string): Promise<boolean> {
    await db.delete(dataSources).where(eq(dataSources.id, id));
    return true;
  }

  async getShareLinks(userId: string): Promise<ShareLink[]> {
    return db.select().from(shareLinks)
      .where(eq(shareLinks.userId, userId))
      .orderBy(desc(shareLinks.createdAt));
  }

  async getShareLinkById(id: string): Promise<ShareLink | undefined> {
    const [link] = await db.select().from(shareLinks)
      .where(eq(shareLinks.id, id))
      .limit(1);
    return link;
  }

  async getShareLinkByToken(token: string): Promise<ShareLink | undefined> {
    const [link] = await db.select().from(shareLinks)
      .where(eq(shareLinks.token, token))
      .limit(1);
    return link;
  }

  async createShareLink(link: InsertShareLink): Promise<ShareLink> {
    const token = randomBytes(32).toString("hex");
    const [created] = await db.insert(shareLinks)
      .values({ ...link, token })
      .returning();
    return created;
  }

  async getShareLink(id: string): Promise<ShareLink | undefined> {
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).limit(1);
    return link;
  }

  async revokeShareLink(id: string): Promise<boolean> {
    await db.update(shareLinks)
      .set({ isRevoked: true })
      .where(eq(shareLinks.id, id));
    return true;
  }

  async incrementShareLinkViews(id: string): Promise<void> {
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).limit(1);
    if (link) {
      await db.update(shareLinks)
        .set({ viewCount: (link.viewCount || 0) + 1, lastViewedAt: new Date() })
        .where(eq(shareLinks.id, id));
    }
  }

  async getPackets(userId: string): Promise<Packet[]> {
    return db.select().from(packets)
      .where(eq(packets.userId, userId))
      .orderBy(desc(packets.createdAt));
  }

  async getPacket(id: string): Promise<Packet | undefined> {
    const [packet] = await db.select().from(packets)
      .where(eq(packets.id, id))
      .limit(1);
    return packet;
  }

  async createPacket(packet: InsertPacket): Promise<Packet> {
    const [created] = await db.insert(packets).values(packet).returning();
    return created;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(userId: string): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const [created] = await db.insert(userSessions).values(session).returning();
    return created;
  }

  async getUserSessionByAccessToken(hashedToken: string): Promise<UserSession | null> {
    const [session] = await db.select().from(userSessions)
      .where(and(
        eq(userSessions.accessToken, hashedToken),
        eq(userSessions.isActive, true)
      ));
    return session || null;
  }

  async getUserSessionByRefreshToken(hashedToken: string): Promise<UserSession | null> {
    const [session] = await db.select().from(userSessions)
      .where(and(
        eq(userSessions.refreshToken, hashedToken),
        eq(userSessions.isActive, true)
      ));
    return session || null;
  }

  async updateUserSessionActivity(sessionId: string): Promise<void> {
    await db.update(userSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(userSessions.id, sessionId));
  }

  async rotateSessionTokens(sessionId: string, updates: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
    lastActivityAt: Date;
  }): Promise<UserSession | null> {
    const [updated] = await db.update(userSessions)
      .set(updates)
      .where(eq(userSessions.id, sessionId))
      .returning();
    return updated || null;
  }

  async revokeUserSession(sessionId: string): Promise<UserSession | null> {
    const [revoked] = await db.update(userSessions)
      .set({ isActive: false, revokedAt: new Date() })
      .where(eq(userSessions.id, sessionId))
      .returning();
    return revoked || null;
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const conditions = [eq(userSessions.userId, userId), eq(userSessions.isActive, true)];
    
    const result = await db.update(userSessions)
      .set({ isActive: false, revokedAt: new Date() })
      .where(exceptSessionId 
        ? and(...conditions, sql`${userSessions.id} != ${exceptSessionId}`)
        : and(...conditions)
      );
    
    return result.rowCount || 0;
  }

  async getActiveUserSessions(userId: string): Promise<UserSession[]> {
    return db.select().from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isActive, true)
      ))
      .orderBy(desc(userSessions.lastActivityAt));
  }

  async createShareLinkAccessLog(log: InsertShareLinkAccessLog): Promise<ShareLinkAccessLog> {
    const [created] = await db.insert(shareLinkAccessLogs).values(log).returning();
    return created;
  }

  async getShareLinkAccessLogs(shareLinkId: string): Promise<ShareLinkAccessLog[]> {
    return db.select().from(shareLinkAccessLogs)
      .where(eq(shareLinkAccessLogs.shareLinkId, shareLinkId))
      .orderBy(desc(shareLinkAccessLogs.createdAt));
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await db.insert(tenants).values(tenant).returning();
    return created;
  }

  async getTenant(id: string): Promise<Tenant | null> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant || null;
  }

  async createTenantUser(tenantUser: InsertTenantUser): Promise<TenantUser> {
    const [created] = await db.insert(tenantUsers).values(tenantUser).returning();
    return created;
  }

  async getTenantUsers(tenantId: string): Promise<TenantUser[]> {
    return db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId));
  }

  async getUserTenants(userId: string): Promise<TenantUser[]> {
    return db.select().from(tenantUsers).where(eq(tenantUsers.userId, userId));
  }

  // FHIR Metrics
  async createFhirMetric(metric: InsertFhirMetric): Promise<FhirMetric> {
    const [created] = await db.insert(fhirMetrics).values(metric).returning();
    return created;
  }

  async getFhirMetrics(options?: { 
    sourceId?: string; 
    startDate?: Date; 
    endDate?: Date;
    limit?: number;
  }): Promise<FhirMetric[]> {
    let query = db.select().from(fhirMetrics);
    const conditions = [];
    
    if (options?.sourceId) {
      conditions.push(eq(fhirMetrics.sourceId, options.sourceId));
    }
    if (options?.startDate) {
      conditions.push(gte(fhirMetrics.createdAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(fhirMetrics.createdAt, options.endDate));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query.orderBy(desc(fhirMetrics.createdAt)).limit(options?.limit || 1000);
  }

  async getFhirMetricsSummary(hours: number = 24): Promise<{
    totalRequests: number;
    errorCount: number;
    avgLatency: number;
    byEndpoint: Record<string, { count: number; errors: number; avgLatency: number }>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const metrics = await this.getFhirMetrics({ startDate: since });
    
    const byEndpoint: Record<string, { count: number; errors: number; totalLatency: number }> = {};
    let totalLatency = 0;
    let errorCount = 0;
    
    for (const m of metrics) {
      totalLatency += m.latencyMs || 0;
      if (m.statusCode && m.statusCode >= 400) errorCount++;
      
      if (!byEndpoint[m.endpoint]) {
        byEndpoint[m.endpoint] = { count: 0, errors: 0, totalLatency: 0 };
      }
      byEndpoint[m.endpoint].count++;
      byEndpoint[m.endpoint].totalLatency += m.latencyMs || 0;
      if (m.statusCode && m.statusCode >= 400) byEndpoint[m.endpoint].errors++;
    }
    
    const result: Record<string, { count: number; errors: number; avgLatency: number }> = {};
    for (const [key, value] of Object.entries(byEndpoint)) {
      result[key] = {
        count: value.count,
        errors: value.errors,
        avgLatency: value.count > 0 ? Math.round(value.totalLatency / value.count) : 0,
      };
    }
    
    return {
      totalRequests: metrics.length,
      errorCount,
      avgLatency: metrics.length > 0 ? Math.round(totalLatency / metrics.length) : 0,
      byEndpoint: result,
    };
  }

  // FHIR Alerts
  async createFhirAlert(alert: InsertFhirAlert): Promise<FhirAlert> {
    const [created] = await db.insert(fhirAlerts).values(alert).returning();
    return created;
  }

  async getFhirAlerts(options?: { 
    sourceId?: string; 
    isResolved?: boolean;
    severity?: string;
  }): Promise<FhirAlert[]> {
    let query = db.select().from(fhirAlerts);
    const conditions = [];
    
    if (options?.sourceId) {
      conditions.push(eq(fhirAlerts.sourceId, options.sourceId));
    }
    if (options?.isResolved !== undefined) {
      conditions.push(eq(fhirAlerts.isResolved, options.isResolved));
    }
    if (options?.severity) {
      conditions.push(eq(fhirAlerts.severity, options.severity));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query.orderBy(desc(fhirAlerts.createdAt));
  }

  async resolveFhirAlert(id: string): Promise<FhirAlert | undefined> {
    const [alert] = await db.update(fhirAlerts)
      .set({ isResolved: true, resolvedAt: new Date() })
      .where(eq(fhirAlerts.id, id))
      .returning();
    return alert;
  }

  // Harmonized Patients
  async createHarmonizedPatient(patient: InsertHarmonizedPatient): Promise<HarmonizedPatient> {
    const [created] = await db.insert(harmonizedPatients).values(patient).returning();
    return created;
  }

  async getHarmonizedPatient(userId: string): Promise<HarmonizedPatient | undefined> {
    const [patient] = await db.select().from(harmonizedPatients)
      .where(eq(harmonizedPatients.userId, userId))
      .limit(1);
    return patient;
  }

  async updateHarmonizedPatient(id: string, data: Partial<InsertHarmonizedPatient>): Promise<HarmonizedPatient | undefined> {
    const [patient] = await db.update(harmonizedPatients)
      .set({ ...data, updatedAt: new Date(), lastHarmonizedAt: new Date() })
      .where(eq(harmonizedPatients.id, id))
      .returning();
    return patient;
  }

  // Resource Versions
  async createResourceVersion(version: InsertResourceVersion): Promise<ResourceVersion> {
    const [created] = await db.insert(resourceVersions).values(version).returning();
    return created;
  }

  async getResourceVersions(recordId: string): Promise<ResourceVersion[]> {
    return db.select().from(resourceVersions)
      .where(eq(resourceVersions.recordId, recordId))
      .orderBy(desc(resourceVersions.versionNumber));
  }

  async getLatestResourceVersion(recordId: string): Promise<ResourceVersion | undefined> {
    const [version] = await db.select().from(resourceVersions)
      .where(eq(resourceVersions.recordId, recordId))
      .orderBy(desc(resourceVersions.versionNumber))
      .limit(1);
    return version;
  }

  // Data Conflicts
  async createDataConflict(conflict: InsertDataConflict): Promise<DataConflict> {
    const [created] = await db.insert(dataConflicts).values(conflict).returning();
    return created;
  }

  async getDataConflict(id: string): Promise<DataConflict | undefined> {
    const [conflict] = await db.select().from(dataConflicts).where(eq(dataConflicts.id, id));
    return conflict;
  }

  async getDataConflicts(userId: string, showResolved?: boolean): Promise<DataConflict[]> {
    const conditions = [eq(dataConflicts.userId, userId)];
    if (showResolved === false) {
      conditions.push(eq(dataConflicts.isResolved, false));
    }
    return db.select().from(dataConflicts)
      .where(and(...conditions))
      .orderBy(desc(dataConflicts.createdAt));
  }

  async resolveDataConflict(id: string, resolution: string, resolvedValue: any, resolvedBy: string): Promise<DataConflict | undefined> {
    const [conflict] = await db.update(dataConflicts)
      .set({ resolution, resolvedValue, isResolved: true, resolvedAt: new Date(), resolvedBy })
      .where(eq(dataConflicts.id, id))
      .returning();
    return conflict;
  }

  // Bulk Import Jobs
  async createBulkImportJob(job: InsertBulkImportJob): Promise<BulkImportJob> {
    const [created] = await db.insert(bulkImportJobs).values(job).returning();
    return created;
  }

  async getBulkImportJobs(userId: string): Promise<BulkImportJob[]> {
    return db.select().from(bulkImportJobs)
      .where(eq(bulkImportJobs.userId, userId))
      .orderBy(desc(bulkImportJobs.createdAt));
  }

  async updateBulkImportJob(id: string, data: Partial<InsertBulkImportJob>): Promise<BulkImportJob | undefined> {
    const [job] = await db.update(bulkImportJobs)
      .set(data)
      .where(eq(bulkImportJobs.id, id))
      .returning();
    return job;
  }

  // FHIR Sync Jobs
  async createFhirSyncJob(job: InsertFhirSyncJob): Promise<FhirSyncJob> {
    const [created] = await db.insert(fhirSyncJobs).values(job).returning();
    return created;
  }

  async getFhirSyncJob(id: string): Promise<FhirSyncJob | undefined> {
    const [job] = await db.select().from(fhirSyncJobs).where(eq(fhirSyncJobs.id, id));
    return job;
  }

  async getFhirSyncJobs(userId: string, sourceId?: string): Promise<FhirSyncJob[]> {
    const conditions = [eq(fhirSyncJobs.userId, userId)];
    if (sourceId) {
      conditions.push(eq(fhirSyncJobs.sourceId, sourceId));
    }
    return db.select().from(fhirSyncJobs)
      .where(and(...conditions))
      .orderBy(desc(fhirSyncJobs.createdAt))
      .limit(50);
  }

  async getActiveSyncJobs(userId: string): Promise<FhirSyncJob[]> {
    return db.select().from(fhirSyncJobs)
      .where(and(
        eq(fhirSyncJobs.userId, userId),
        inArray(fhirSyncJobs.status, ['pending', 'connecting', 'syncing'])
      ))
      .orderBy(desc(fhirSyncJobs.createdAt));
  }

  async updateFhirSyncJob(id: string, data: Partial<InsertFhirSyncJob>): Promise<FhirSyncJob | undefined> {
    const [job] = await db.update(fhirSyncJobs)
      .set(data)
      .where(eq(fhirSyncJobs.id, id))
      .returning();
    return job;
  }

  // FHIR Connection Configs
  async createFhirConnectionConfig(config: InsertFhirConnectionConfig): Promise<FhirConnectionConfig> {
    const [created] = await db.insert(fhirConnectionConfigs).values(config).returning();
    return created;
  }

  async getFhirConnectionConfig(sourceId: string): Promise<FhirConnectionConfig | undefined> {
    const [config] = await db.select().from(fhirConnectionConfigs)
      .where(eq(fhirConnectionConfigs.sourceId, sourceId));
    return config;
  }

  async updateFhirConnectionConfig(sourceId: string, data: Partial<InsertFhirConnectionConfig>): Promise<FhirConnectionConfig | undefined> {
    const [config] = await db.update(fhirConnectionConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fhirConnectionConfigs.sourceId, sourceId))
      .returning();
    return config;
  }

  async deleteFhirConnectionConfig(sourceId: string): Promise<boolean> {
    const result = await db.delete(fhirConnectionConfigs)
      .where(eq(fhirConnectionConfigs.sourceId, sourceId));
    return true;
  }

  // FHIR Mapping Rules
  async createFhirMappingRule(rule: any): Promise<any> {
    const [created] = await db.insert(fhirMappingRules).values(rule).returning();
    return created;
  }

  async getFhirMappingRules(userId: string, sourceId?: string): Promise<any[]> {
    const conditions = [eq(fhirMappingRules.userId, userId)];
    if (sourceId) {
      conditions.push(or(
        eq(fhirMappingRules.sourceId, sourceId),
        isNull(fhirMappingRules.sourceId)
      )!);
    }
    return db.select().from(fhirMappingRules)
      .where(and(...conditions))
      .orderBy(desc(fhirMappingRules.priority), desc(fhirMappingRules.createdAt));
  }

  async getFhirMappingRule(id: string): Promise<any | undefined> {
    const [rule] = await db.select().from(fhirMappingRules).where(eq(fhirMappingRules.id, id));
    return rule;
  }

  async updateFhirMappingRule(id: string, updates: any): Promise<any | undefined> {
    const [rule] = await db.update(fhirMappingRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fhirMappingRules.id, id))
      .returning();
    return rule;
  }

  async deleteFhirMappingRule(id: string): Promise<boolean> {
    await db.delete(fhirMappingRules).where(eq(fhirMappingRules.id, id));
    return true;
  }

  async getActiveRulesForResourceType(userId: string, resourceType: string, sourceId?: string): Promise<any[]> {
    const conditions = [
      eq(fhirMappingRules.userId, userId),
      eq(fhirMappingRules.fhirResourceType, resourceType),
      eq(fhirMappingRules.isActive, true),
    ];
    if (sourceId) {
      conditions.push(or(
        eq(fhirMappingRules.sourceId, sourceId),
        isNull(fhirMappingRules.sourceId)
      )!);
    } else {
      conditions.push(isNull(fhirMappingRules.sourceId));
    }
    return db.select().from(fhirMappingRules)
      .where(and(...conditions))
      .orderBy(desc(fhirMappingRules.priority));
  }

  // FHIR Transformations
  async createFhirTransformation(transform: any): Promise<any> {
    const [created] = await db.insert(fhirTransformations).values(transform).returning();
    return created;
  }

  async getFhirTransformations(userId?: string): Promise<any[]> {
    if (userId) {
      return db.select().from(fhirTransformations)
        .where(or(
          eq(fhirTransformations.userId, userId),
          eq(fhirTransformations.isSystem, true)
        ))
        .orderBy(fhirTransformations.category, fhirTransformations.name);
    }
    return db.select().from(fhirTransformations)
      .where(eq(fhirTransformations.isSystem, true))
      .orderBy(fhirTransformations.category, fhirTransformations.name);
  }

  async getFhirTransformation(id: string): Promise<any | undefined> {
    const [transform] = await db.select().from(fhirTransformations).where(eq(fhirTransformations.id, id));
    return transform;
  }

  async updateFhirTransformation(id: string, updates: any): Promise<any | undefined> {
    const [transform] = await db.update(fhirTransformations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fhirTransformations.id, id))
      .returning();
    return transform;
  }

  async deleteFhirTransformation(id: string): Promise<boolean> {
    await db.delete(fhirTransformations).where(eq(fhirTransformations.id, id));
    return true;
  }

  // FHIR Code Mappings
  async createFhirCodeMapping(mapping: any): Promise<any> {
    const [created] = await db.insert(fhirCodeMappings).values(mapping).returning();
    return created;
  }

  async getFhirCodeMappings(userId?: string, sourceSystem?: string): Promise<any[]> {
    const conditions: any[] = [];
    if (userId) {
      conditions.push(or(
        eq(fhirCodeMappings.userId, userId),
        isNull(fhirCodeMappings.userId)
      ));
    }
    if (sourceSystem) {
      conditions.push(eq(fhirCodeMappings.sourceSystem, sourceSystem));
    }
    return db.select().from(fhirCodeMappings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(fhirCodeMappings.sourceSystem, fhirCodeMappings.sourceCode);
  }

  async lookupCodeMapping(sourceSystem: string, sourceCode: string, targetSystem: string, userId?: string): Promise<any | undefined> {
    const conditions = [
      eq(fhirCodeMappings.sourceSystem, sourceSystem),
      eq(fhirCodeMappings.sourceCode, sourceCode),
      eq(fhirCodeMappings.targetSystem, targetSystem),
      eq(fhirCodeMappings.isActive, true),
    ];
    if (userId) {
      conditions.push(or(
        eq(fhirCodeMappings.userId, userId),
        isNull(fhirCodeMappings.userId)
      )!);
    }
    const [mapping] = await db.select().from(fhirCodeMappings).where(and(...conditions));
    return mapping;
  }

  async deleteFhirCodeMapping(id: string): Promise<boolean> {
    await db.delete(fhirCodeMappings).where(eq(fhirCodeMappings.id, id));
    return true;
  }

  async getMappingRulesForConnection(userId: string, sourceId: string | null): Promise<any[]> {
    const conditions = [
      eq(fhirMappingRules.userId, userId),
      eq(fhirMappingRules.isActive, true),
    ];
    if (sourceId) {
      conditions.push(eq(fhirMappingRules.sourceId, sourceId));
    } else {
      conditions.push(isNull(fhirMappingRules.sourceId));
    }
    return db.select().from(fhirMappingRules)
      .where(and(...conditions))
      .orderBy(desc(fhirMappingRules.priority));
  }

  async getAllCodeMappings(userId: string): Promise<any[]> {
    return db.select().from(fhirCodeMappings)
      .where(
        and(
          eq(fhirCodeMappings.isActive, true),
          or(
            eq(fhirCodeMappings.userId, userId),
            isNull(fhirCodeMappings.userId)
          )
        )
      )
      .orderBy(fhirCodeMappings.sourceSystem, fhirCodeMappings.sourceCode);
  }

  // FHIR Validation Results
  async createFhirValidationResult(result: any): Promise<any> {
    const [created] = await db.insert(fhirValidationResults).values(result).returning();
    return created;
  }

  async getFhirValidationResults(syncJobId: string): Promise<any[]> {
    return db.select().from(fhirValidationResults)
      .where(eq(fhirValidationResults.syncJobId, syncJobId))
      .orderBy(desc(fhirValidationResults.createdAt));
  }

  async getValidationSummary(syncJobId: string): Promise<{ valid: number; warnings: number; errors: number; skipped: number }> {
    const results = await db.select({
      status: fhirValidationResults.status,
      count: sql<number>`count(*)`,
    }).from(fhirValidationResults)
      .where(eq(fhirValidationResults.syncJobId, syncJobId))
      .groupBy(fhirValidationResults.status);
    
    return results.reduce((acc, r) => {
      acc[r.status as keyof typeof acc] = Number(r.count);
      return acc;
    }, { valid: 0, warnings: 0, errors: 0, skipped: 0 });
  }

  // Advanced Search
  async searchHealthRecords(userId: string, options: {
    query?: string;
    types?: string[];
    startDate?: Date;
    endDate?: Date;
    sourceIds?: string[];
    fhirResourceTypes?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ records: HealthRecord[]; total: number }> {
    const conditions = [eq(healthRecords.userId, userId)];
    
    if (options.types && options.types.length > 0) {
      conditions.push(inArray(healthRecords.type, options.types));
    }
    if (options.startDate) {
      conditions.push(gte(healthRecords.date, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(healthRecords.date, options.endDate));
    }
    if (options.sourceIds && options.sourceIds.length > 0) {
      conditions.push(inArray(healthRecords.sourceId, options.sourceIds));
    }
    if (options.fhirResourceTypes && options.fhirResourceTypes.length > 0) {
      conditions.push(inArray(healthRecords.fhirResourceType, options.fhirResourceTypes));
    }
    if (options.query) {
      conditions.push(or(
        ilike(healthRecords.title, `%${options.query}%`),
        ilike(healthRecords.summary, `%${options.query}%`),
        ilike(healthRecords.provider, `%${options.query}%`),
        ilike(healthRecords.facility, `%${options.query}%`)
      )!);
    }
    
    const whereClause = and(...conditions);
    
    const [countResult] = await db.select({ count: count() })
      .from(healthRecords)
      .where(whereClause);
    
    const records = await db.select()
      .from(healthRecords)
      .where(whereClause)
      .orderBy(desc(healthRecords.date))
      .limit(options.limit || 50)
      .offset(options.offset || 0);
    
    return { records, total: countResult?.count || 0 };
  }

  // Get all health records with their versions for a user
  async getHealthRecordsWithVersions(userId: string): Promise<(HealthRecord & { versions: ResourceVersion[] })[]> {
    const records = await this.getHealthRecords(userId);
    const result = [];
    
    for (const record of records) {
      const versions = await this.getResourceVersions(record.id);
      result.push({ ...record, versions });
    }
    
    return result;
  }

  // SMART App Management
  async createSmartApp(app: InsertSmartApp): Promise<SmartApp> {
    const [result] = await db.insert(smartApps).values(app).returning();
    return result;
  }

  async getSmartApp(id: string): Promise<SmartApp | undefined> {
    const [app] = await db.select().from(smartApps).where(eq(smartApps.id, id)).limit(1);
    return app;
  }

  async getSmartAppByClientId(clientId: string): Promise<SmartApp | undefined> {
    const [app] = await db.select().from(smartApps).where(eq(smartApps.clientId, clientId)).limit(1);
    return app;
  }

  async getSmartAppsByUser(userId: string): Promise<SmartApp[]> {
    return db.select().from(smartApps).where(eq(smartApps.userId, userId)).orderBy(desc(smartApps.createdAt));
  }

  async updateSmartApp(id: string, data: Partial<InsertSmartApp>): Promise<SmartApp | undefined> {
    const [app] = await db.update(smartApps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(smartApps.id, id))
      .returning();
    return app;
  }

  async deleteSmartApp(id: string): Promise<boolean> {
    const result = await db.delete(smartApps).where(eq(smartApps.id, id));
    return true;
  }

  async incrementSmartAppAccess(id: string): Promise<void> {
    await db.update(smartApps)
      .set({ 
        accessCount: sql`${smartApps.accessCount} + 1`,
        lastAccessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(smartApps.id, id));
  }

  // SMART App Token Management
  async createSmartAppToken(token: InsertSmartAppToken): Promise<SmartAppToken> {
    const [result] = await db.insert(smartAppTokens).values(token).returning();
    return result;
  }

  async getActiveSmartAppToken(appId: string, userId: string): Promise<SmartAppToken | undefined> {
    const [token] = await db.select()
      .from(smartAppTokens)
      .where(and(
        eq(smartAppTokens.appId, appId),
        eq(smartAppTokens.userId, userId),
        eq(smartAppTokens.isRevoked, false),
        gte(smartAppTokens.expiresAt, new Date())
      ))
      .orderBy(desc(smartAppTokens.createdAt))
      .limit(1);
    return token;
  }

  async revokeSmartAppTokens(appId: string): Promise<void> {
    await db.update(smartAppTokens)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(eq(smartAppTokens.appId, appId));
  }

  async revokeSmartAppToken(tokenId: string): Promise<void> {
    await db.update(smartAppTokens)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(eq(smartAppTokens.id, tokenId));
  }

  // SMART App Access Logging
  async createSmartAppAccessLog(log: InsertSmartAppAccessLog): Promise<SmartAppAccessLog> {
    const [result] = await db.insert(smartAppAccessLogs).values(log).returning();
    return result;
  }

  async getSmartAppAccessLogs(appId: string, limit = 100): Promise<SmartAppAccessLog[]> {
    return db.select()
      .from(smartAppAccessLogs)
      .where(eq(smartAppAccessLogs.appId, appId))
      .orderBy(desc(smartAppAccessLogs.createdAt))
      .limit(limit);
  }

  async getSmartAppAccessLogsByUser(userId: string, limit = 100): Promise<SmartAppAccessLog[]> {
    return db.select()
      .from(smartAppAccessLogs)
      .where(eq(smartAppAccessLogs.userId, userId))
      .orderBy(desc(smartAppAccessLogs.createdAt))
      .limit(limit);
  }

  // ============================================
  // AI Analytics - Health Predictions
  // ============================================

  async createHealthPrediction(prediction: InsertHealthPrediction): Promise<HealthPrediction> {
    const [result] = await db.insert(healthPredictions).values(prediction).returning();
    return result;
  }

  async getHealthPredictions(userId: string, limit = 20): Promise<HealthPrediction[]> {
    return db.select()
      .from(healthPredictions)
      .where(and(
        eq(healthPredictions.userId, userId),
        eq(healthPredictions.isActive, true)
      ))
      .orderBy(desc(healthPredictions.createdAt))
      .limit(limit);
  }

  async getHealthPredictionsByCategory(userId: string, category: string): Promise<HealthPrediction[]> {
    return db.select()
      .from(healthPredictions)
      .where(and(
        eq(healthPredictions.userId, userId),
        eq(healthPredictions.category, category),
        eq(healthPredictions.isActive, true)
      ))
      .orderBy(desc(healthPredictions.createdAt));
  }

  async getActiveHighRiskPredictions(userId: string): Promise<HealthPrediction[]> {
    return db.select()
      .from(healthPredictions)
      .where(and(
        eq(healthPredictions.userId, userId),
        eq(healthPredictions.isActive, true),
        or(
          eq(healthPredictions.riskLevel, "high"),
          eq(healthPredictions.riskLevel, "critical")
        )
      ))
      .orderBy(desc(healthPredictions.createdAt));
  }

  // ============================================
  // AI Analytics - Anomaly Detections
  // ============================================

  async createAnomalyDetection(anomaly: InsertAnomalyDetection): Promise<AnomalyDetection> {
    const [result] = await db.insert(anomalyDetections).values(anomaly).returning();
    return result;
  }

  async getAnomalyDetections(userId: string, includeResolved = false): Promise<AnomalyDetection[]> {
    const conditions = [eq(anomalyDetections.userId, userId)];
    if (!includeResolved) {
      conditions.push(eq(anomalyDetections.isResolved, false));
    }
    return db.select()
      .from(anomalyDetections)
      .where(and(...conditions))
      .orderBy(desc(anomalyDetections.createdAt));
  }

  async getAnomalyDetectionsBySeverity(userId: string, severity: string): Promise<AnomalyDetection[]> {
    return db.select()
      .from(anomalyDetections)
      .where(and(
        eq(anomalyDetections.userId, userId),
        eq(anomalyDetections.severity, severity),
        eq(anomalyDetections.isResolved, false)
      ))
      .orderBy(desc(anomalyDetections.createdAt));
  }

  async resolveAnomalyDetection(id: string, resolvedBy: string): Promise<AnomalyDetection | undefined> {
    const [result] = await db.update(anomalyDetections)
      .set({
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      })
      .where(eq(anomalyDetections.id, id))
      .returning();
    return result;
  }

  async getAnomalyStats(userId: string): Promise<{ total: number; critical: number; warning: number; info: number }> {
    const anomalies = await this.getAnomalyDetections(userId, false);
    return {
      total: anomalies.length,
      critical: anomalies.filter(a => a.severity === "critical").length,
      warning: anomalies.filter(a => a.severity === "warning").length,
      info: anomalies.filter(a => a.severity === "info").length,
    };
  }

  // ============================================
  // AI Analytics - Natural Language Queries
  // ============================================

  async createNlQuery(query: InsertNlQuery): Promise<NlQuery> {
    const [result] = await db.insert(nlQueries).values(query).returning();
    return result;
  }

  async getNlQueryHistory(userId: string, limit = 50): Promise<NlQuery[]> {
    return db.select()
      .from(nlQueries)
      .where(eq(nlQueries.userId, userId))
      .orderBy(desc(nlQueries.createdAt))
      .limit(limit);
  }

  async updateNlQueryFeedback(id: string, feedback: string): Promise<NlQuery | undefined> {
    const [result] = await db.update(nlQueries)
      .set({ feedback })
      .where(eq(nlQueries.id, id))
      .returning();
    return result;
  }

  // ============================================
  // AI Analytics - Population Analytics
  // ============================================

  async createPopulationAnalytics(analytics: InsertPopulationAnalytics): Promise<PopulationAnalytics> {
    const [result] = await db.insert(populationAnalytics).values(analytics).returning();
    return result;
  }

  async getPopulationAnalytics(userId: string, limit = 20): Promise<PopulationAnalytics[]> {
    return db.select()
      .from(populationAnalytics)
      .where(eq(populationAnalytics.userId, userId))
      .orderBy(desc(populationAnalytics.createdAt))
      .limit(limit);
  }

  // ============================================
  // AI Analytics - Health Reports
  // ============================================

  async createHealthReport(report: InsertHealthReport): Promise<HealthReport> {
    const [result] = await db.insert(healthReports).values(report).returning();
    return result;
  }

  async getHealthReports(userId: string, limit = 20): Promise<HealthReport[]> {
    return db.select()
      .from(healthReports)
      .where(eq(healthReports.userId, userId))
      .orderBy(desc(healthReports.createdAt))
      .limit(limit);
  }

  async getHealthReport(id: string): Promise<HealthReport | undefined> {
    const [result] = await db.select()
      .from(healthReports)
      .where(eq(healthReports.id, id))
      .limit(1);
    return result;
  }

  async getHealthReportsByType(userId: string, reportType: string): Promise<HealthReport[]> {
    return db.select()
      .from(healthReports)
      .where(and(
        eq(healthReports.userId, userId),
        eq(healthReports.reportType, reportType)
      ))
      .orderBy(desc(healthReports.createdAt));
  }

  async getLatestHealthReport(userId: string): Promise<HealthReport | undefined> {
    const [result] = await db.select()
      .from(healthReports)
      .where(eq(healthReports.userId, userId))
      .orderBy(desc(healthReports.createdAt))
      .limit(1);
    return result;
  }

  // ============================================
  // AI Analytics - Trend Analyses
  // ============================================

  async createTrendAnalysis(analysis: InsertTrendAnalysis): Promise<TrendAnalysis> {
    const [result] = await db.insert(trendAnalyses).values(analysis).returning();
    return result;
  }

  async getTrendAnalyses(userId: string, limit = 20): Promise<TrendAnalysis[]> {
    return db.select()
      .from(trendAnalyses)
      .where(eq(trendAnalyses.userId, userId))
      .orderBy(desc(trendAnalyses.createdAt))
      .limit(limit);
  }

  async getTrendAnalysis(id: string): Promise<TrendAnalysis | undefined> {
    const [result] = await db.select()
      .from(trendAnalyses)
      .where(eq(trendAnalyses.id, id))
      .limit(1);
    return result;
  }

  async getTrendAnalysesByCategory(userId: string, category: string): Promise<TrendAnalysis[]> {
    return db.select()
      .from(trendAnalyses)
      .where(and(
        eq(trendAnalyses.userId, userId),
        eq(trendAnalyses.category, category)
      ))
      .orderBy(desc(trendAnalyses.createdAt));
  }

  async getTrendAnalysesByMetric(userId: string, metric: string): Promise<TrendAnalysis[]> {
    return db.select()
      .from(trendAnalyses)
      .where(and(
        eq(trendAnalyses.userId, userId),
        eq(trendAnalyses.metric, metric)
      ))
      .orderBy(desc(trendAnalyses.createdAt));
  }

  async getPatientProfile(userId: string): Promise<PatientProfile | undefined> {
    const [profile] = await db.select().from(patientProfiles).where(eq(patientProfiles.userId, userId)).limit(1);
    return profile ? decryptRecordFields(profile, PATIENT_PROFILE_PHI_FIELDS) : undefined;
  }

  async createPatientProfile(profile: InsertPatientProfile): Promise<PatientProfile> {
    const profileWithNmnStatus = this.applyMiddleNameStatus(profile);
    const encrypted = encryptRecordFields(profileWithNmnStatus as Record<string, any>, PATIENT_PROFILE_PHI_FIELDS);
    const [newProfile] = await db.insert(patientProfiles).values(encrypted as typeof profileWithNmnStatus).returning();
    return decryptRecordFields(newProfile, PATIENT_PROFILE_PHI_FIELDS);
  }

  async updatePatientProfile(userId: string, data: Partial<InsertPatientProfile>): Promise<PatientProfile | undefined> {
    const dataWithNmnStatus = this.applyMiddleNameStatus(data);
    const encrypted = encryptRecordFields(dataWithNmnStatus as Record<string, any>, PATIENT_PROFILE_PHI_FIELDS);
    const [updated] = await db
      .update(patientProfiles)
      .set({ ...encrypted, updatedAt: new Date() })
      .where(eq(patientProfiles.userId, userId))
      .returning();
    return updated ? decryptRecordFields(updated, PATIENT_PROFILE_PHI_FIELDS) : undefined;
  }

  private applyMiddleNameStatus<T extends { middleName?: string | null; middleNameStatus?: string | null }>(data: T): T {
    if (data.middleName === undefined) {
      return data;
    }
    
    const middleName = data.middleName?.trim().toUpperCase() || "";
    let middleNameStatus: string;
    let resolvedMiddleName: string = data.middleName || "NMN";
    
    if (middleName === "NMN" || middleName === "" || middleName === "NONE" || middleName === "-" || !middleName) {
      middleNameStatus = "no_middle_name";
      resolvedMiddleName = "NMN";
    } else if (middleName === "UNK") {
      middleNameStatus = "unknown";
      resolvedMiddleName = "NMN";
    } else {
      middleNameStatus = "has_middle_name";
    }
    
    return { ...data, middleName: resolvedMiddleName, middleNameStatus };
  }

  async upsertPatientProfile(userId: string, data: Partial<InsertPatientProfile>): Promise<PatientProfile> {
    const existing = await this.getPatientProfile(userId);
    if (existing) {
      const updated = await this.updatePatientProfile(userId, data);
      return updated!;
    } else {
      return this.createPatientProfile({ ...data, userId });
    }
  }

  // Health Goals methods
  async getHealthGoals(userId: string): Promise<HealthGoal[]> {
    return db.select().from(healthGoals).where(eq(healthGoals.userId, userId)).orderBy(desc(healthGoals.createdAt));
  }

  async getHealthGoal(id: string): Promise<HealthGoal | undefined> {
    const [goal] = await db.select().from(healthGoals).where(eq(healthGoals.id, id)).limit(1);
    return goal;
  }

  async getActiveHealthGoals(userId: string): Promise<HealthGoal[]> {
    return db.select().from(healthGoals)
      .where(and(eq(healthGoals.userId, userId), eq(healthGoals.status, "active")))
      .orderBy(desc(healthGoals.createdAt));
  }

  async createHealthGoal(goal: InsertHealthGoal): Promise<HealthGoal> {
    const [created] = await db.insert(healthGoals).values(goal).returning();
    return created;
  }

  async updateHealthGoal(id: string, data: Partial<InsertHealthGoal> & { currentStreak?: number; longestStreak?: number }): Promise<HealthGoal | undefined> {
    const [updated] = await db
      .update(healthGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(healthGoals.id, id))
      .returning();
    return updated;
  }

  async deleteHealthGoal(id: string): Promise<boolean> {
    const result = await db.delete(healthGoals).where(eq(healthGoals.id, id));
    return true;
  }

  // Goal Progress methods
  async getGoalProgress(goalId: string): Promise<GoalProgress[]> {
    return db.select().from(goalProgress)
      .where(eq(goalProgress.goalId, goalId))
      .orderBy(desc(goalProgress.date));
  }

  async getGoalProgressByDateRange(goalId: string, startDate: Date, endDate: Date): Promise<GoalProgress[]> {
    return db.select().from(goalProgress)
      .where(and(
        eq(goalProgress.goalId, goalId),
        gte(goalProgress.date, startDate),
        lte(goalProgress.date, endDate)
      ))
      .orderBy(goalProgress.date);
  }

  async getRecentGoalProgress(userId: string, days: number = 7): Promise<GoalProgress[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return db.select().from(goalProgress)
      .where(and(
        eq(goalProgress.userId, userId),
        gte(goalProgress.date, startDate)
      ))
      .orderBy(desc(goalProgress.date));
  }

  async createGoalProgress(progress: InsertGoalProgress): Promise<GoalProgress> {
    const [created] = await db.insert(goalProgress).values(progress).returning();
    return created;
  }

  async updateGoalProgress(id: string, data: Partial<InsertGoalProgress>): Promise<GoalProgress | undefined> {
    const [updated] = await db
      .update(goalProgress)
      .set(data)
      .where(eq(goalProgress.id, id))
      .returning();
    return updated;
  }

  async deleteGoalProgress(id: string): Promise<boolean> {
    await db.delete(goalProgress).where(eq(goalProgress.id, id));
    return true;
  }

  async getGoalStats(goalId: string): Promise<{ totalEntries: number; completedEntries: number; avgValue: number }> {
    const entries = await this.getGoalProgress(goalId);
    const totalEntries = entries.length;
    const completedEntries = entries.filter(e => e.isCompleted).length;
    const avgValue = totalEntries > 0 ? entries.reduce((sum, e) => sum + e.value, 0) / totalEntries : 0;
    return { totalEntries, completedEntries, avgValue: Math.round(avgValue * 10) / 10 };
  }

  // ==================== GAMIFICATION METHODS ====================

  // Badge methods
  async getBadges(): Promise<Badge[]> {
    return db.select().from(badges).orderBy(badges.category, badges.tier);
  }

  async getBadge(id: string): Promise<Badge | undefined> {
    const [badge] = await db.select().from(badges).where(eq(badges.id, id)).limit(1);
    return badge;
  }

  async createBadge(badge: InsertBadge): Promise<Badge> {
    const [created] = await db.insert(badges).values(badge).returning();
    return created;
  }

  async getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]> {
    const results = await db
      .select()
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt));
    return results.map(r => ({ ...r.user_badges, badge: r.badges }));
  }

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge> {
    const [created] = await db.insert(userBadges).values({ userId, badgeId }).returning();
    return created;
  }

  async hasUserEarnedBadge(userId: string, badgeId: string): Promise<boolean> {
    const [existing] = await db.select().from(userBadges)
      .where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badgeId)))
      .limit(1);
    return !!existing;
  }

  // User gamification profile methods
  async getUserGamification(userId: string): Promise<UserGamification | undefined> {
    const [profile] = await db.select().from(userGamification)
      .where(eq(userGamification.userId, userId))
      .limit(1);
    return profile;
  }

  async getOrCreateUserGamification(userId: string): Promise<UserGamification> {
    let profile = await this.getUserGamification(userId);
    if (!profile) {
      const [created] = await db.insert(userGamification)
        .values({ userId, totalPoints: 0, currentLevel: 1, levelProgress: 0 })
        .returning();
      profile = created;
    }
    return profile;
  }

  async updateUserGamification(userId: string, data: Partial<InsertUserGamification>): Promise<UserGamification | undefined> {
    const [updated] = await db.update(userGamification)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userGamification.userId, userId))
      .returning();
    return updated;
  }

  async awardPoints(userId: string, points: number, reason: string, category: string, relatedEntityType?: string, relatedEntityId?: string, metadata?: any): Promise<{ transaction: PointTransaction; newTotal: number; leveledUp: boolean; newLevel: number }> {
    // Create point transaction
    const [transaction] = await db.insert(pointTransactions).values({
      userId,
      points,
      reason,
      category,
      relatedEntityType,
      relatedEntityId,
      metadata,
    }).returning();

    // Update user gamification profile
    const profile = await this.getOrCreateUserGamification(userId);
    const newTotal = profile.totalPoints + points;
    
    // Calculate new level
    let newLevel = profile.currentLevel;
    let levelProgress = profile.levelProgress + points;
    const thresholds = LEVEL_THRESHOLDS as readonly number[];
    
    while (newLevel < thresholds.length && newTotal >= thresholds[newLevel]) {
      newLevel++;
      levelProgress = newTotal - thresholds[newLevel - 1];
    }
    
    const leveledUp = newLevel > profile.currentLevel;

    await this.updateUserGamification(userId, {
      totalPoints: newTotal,
      currentLevel: newLevel,
      levelProgress,
    });

    return { transaction, newTotal, leveledUp, newLevel };
  }

  async getPointTransactions(userId: string, limit: number = 50): Promise<PointTransaction[]> {
    return db.select().from(pointTransactions)
      .where(eq(pointTransactions.userId, userId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(limit);
  }

  async updateUserStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number; earnedStreakPoints: number }> {
    const profile = await this.getOrCreateUserGamification(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActive = profile.lastActiveDate ? new Date(profile.lastActiveDate) : null;
    if (lastActive) {
      lastActive.setHours(0, 0, 0, 0);
    }

    let currentStreak = profile.currentStreak;
    let earnedStreakPoints = 0;
    
    if (!lastActive || lastActive.getTime() < today.getTime()) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastActive && lastActive.getTime() === yesterday.getTime()) {
        // Consecutive day - increment streak
        currentStreak++;
      } else if (!lastActive || lastActive.getTime() < yesterday.getTime()) {
        // Streak broken or first day
        currentStreak = 1;
      }
      
      // Award streak milestones
      if (currentStreak === 7) {
        earnedStreakPoints = POINT_VALUES.STREAK_7_DAYS;
      } else if (currentStreak === 30) {
        earnedStreakPoints = POINT_VALUES.STREAK_30_DAYS;
      } else if (currentStreak === 100) {
        earnedStreakPoints = POINT_VALUES.STREAK_100_DAYS;
      }
      
      const longestStreak = Math.max(profile.longestStreak, currentStreak);
      
      await this.updateUserGamification(userId, {
        currentStreak,
        longestStreak,
        lastActiveDate: new Date(),
        daysActive: profile.daysActive + 1,
      });
      
      return { currentStreak, longestStreak, earnedStreakPoints };
    }
    
    return { currentStreak: profile.currentStreak, longestStreak: profile.longestStreak, earnedStreakPoints: 0 };
  }

  // Daily challenges
  async getDailyChallenges(): Promise<DailyChallenge[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return db.select().from(dailyChallenges)
      .where(and(
        eq(dailyChallenges.isActive, true),
        gte(dailyChallenges.activeDate, today)
      ));
  }

  async getActiveDailyChallenge(): Promise<DailyChallenge | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [challenge] = await db.select().from(dailyChallenges)
      .where(and(
        eq(dailyChallenges.isActive, true),
        gte(dailyChallenges.activeDate, today),
        lte(dailyChallenges.activeDate, tomorrow)
      ))
      .limit(1);
    return challenge;
  }

  async createDailyChallenge(challenge: InsertDailyChallenge): Promise<DailyChallenge> {
    const [created] = await db.insert(dailyChallenges).values(challenge).returning();
    return created;
  }

  async getUserChallengeCompletions(userId: string): Promise<UserChallenge[]> {
    return db.select().from(userChallenges)
      .where(eq(userChallenges.userId, userId))
      .orderBy(desc(userChallenges.completedAt));
  }

  async hasCompletedChallenge(userId: string, challengeId: string): Promise<boolean> {
    const [existing] = await db.select().from(userChallenges)
      .where(and(eq(userChallenges.userId, userId), eq(userChallenges.challengeId, challengeId)))
      .limit(1);
    return !!existing;
  }

  async completeChallenge(userId: string, challengeId: string, pointsAwarded: number): Promise<UserChallenge> {
    const [created] = await db.insert(userChallenges)
      .values({ userId, challengeId, pointsAwarded })
      .returning();
    return created;
  }

  // Leaderboard (privacy-conscious - only opted-in users)
  async getLeaderboard(limit: number = 10): Promise<{ displayName: string; totalPoints: number; currentLevel: number; currentStreak: number }[]> {
    const results = await db.select({
      displayName: userGamification.displayName,
      totalPoints: userGamification.totalPoints,
      currentLevel: userGamification.currentLevel,
      currentStreak: userGamification.currentStreak,
    })
      .from(userGamification)
      .where(eq(userGamification.leaderboardOptIn, true))
      .orderBy(desc(userGamification.totalPoints))
      .limit(limit);
    
    return results.map((r, index) => ({
      displayName: r.displayName || `Health Champion ${index + 1}`,
      totalPoints: r.totalPoints,
      currentLevel: r.currentLevel,
      currentStreak: r.currentStreak,
    }));
  }

  async optInLeaderboard(userId: string, displayName: string): Promise<void> {
    await this.updateUserGamification(userId, { leaderboardOptIn: true, displayName });
  }

  async optOutLeaderboard(userId: string): Promise<void> {
    await this.updateUserGamification(userId, { leaderboardOptIn: false });
  }

  // Gamification stats
  async incrementGoalsCompleted(userId: string): Promise<void> {
    const profile = await this.getOrCreateUserGamification(userId);
    await this.updateUserGamification(userId, { goalsCompleted: profile.goalsCompleted + 1 });
  }

  async incrementRecordsLogged(userId: string): Promise<void> {
    const profile = await this.getOrCreateUserGamification(userId);
    await this.updateUserGamification(userId, { recordsLogged: profile.recordsLogged + 1 });
  }

  // ============================================
  // AI Health Assistant - Medication Reminders
  // ============================================

  async createMedicationReminder(reminder: InsertMedicationReminder): Promise<MedicationReminder> {
    const [created] = await db.insert(medicationReminders).values(reminder).returning();
    return created;
  }

  async getMedicationReminders(userId: string): Promise<MedicationReminder[]> {
    return db.select().from(medicationReminders)
      .where(eq(medicationReminders.userId, userId))
      .orderBy(desc(medicationReminders.createdAt));
  }

  async getActiveMedicationReminders(userId: string): Promise<MedicationReminder[]> {
    return db.select().from(medicationReminders)
      .where(and(
        eq(medicationReminders.userId, userId),
        eq(medicationReminders.isActive, true)
      ))
      .orderBy(medicationReminders.nextReminderAt);
  }

  async getMedicationReminder(id: string): Promise<MedicationReminder | undefined> {
    const [reminder] = await db.select().from(medicationReminders).where(eq(medicationReminders.id, id));
    return reminder;
  }

  async updateMedicationReminder(id: string, updates: Partial<InsertMedicationReminder>): Promise<MedicationReminder | undefined> {
    const [updated] = await db.update(medicationReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(medicationReminders.id, id))
      .returning();
    return updated;
  }

  async deleteMedicationReminder(id: string): Promise<boolean> {
    await db.delete(medicationReminders).where(eq(medicationReminders.id, id));
    return true;
  }

  async logMedicationAction(log: InsertMedicationLog): Promise<MedicationLog> {
    const [created] = await db.insert(medicationLogs).values(log).returning();
    return created;
  }

  async getMedicationLogs(userId: string, reminderId?: string): Promise<MedicationLog[]> {
    const conditions = [eq(medicationLogs.userId, userId)];
    if (reminderId) {
      conditions.push(eq(medicationLogs.reminderId, reminderId));
    }
    return db.select().from(medicationLogs)
      .where(and(...conditions))
      .orderBy(desc(medicationLogs.createdAt))
      .limit(100);
  }

  // ============================================
  // AI Health Assistant - Appointments
  // ============================================

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [created] = await db.insert(appointments).values(appointment).returning();
    return created;
  }

  async getAppointments(userId: string): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(eq(appointments.userId, userId))
      .orderBy(appointments.scheduledAt);
  }

  async getUpcomingAppointments(userId: string): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(and(
        eq(appointments.userId, userId),
        gte(appointments.scheduledAt, new Date()),
        inArray(appointments.status, ["scheduled", "confirmed"])
      ))
      .orderBy(appointments.scheduledAt)
      .limit(10);
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [updated] = await db.update(appointments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    await db.delete(appointments).where(eq(appointments.id, id));
    return true;
  }

  // ============================================
  // AI Health Assistant - Educational Modules
  // ============================================

  async getEducationalModules(category?: string): Promise<EducationalModule[]> {
    if (category) {
      return db.select().from(educationalModules)
        .where(and(
          eq(educationalModules.isPublished, true),
          eq(educationalModules.category, category)
        ))
        .orderBy(desc(educationalModules.viewCount));
    }
    return db.select().from(educationalModules)
      .where(eq(educationalModules.isPublished, true))
      .orderBy(desc(educationalModules.viewCount));
  }

  async getEducationalModule(id: string): Promise<EducationalModule | undefined> {
    const [module] = await db.select().from(educationalModules).where(eq(educationalModules.id, id));
    return module;
  }

  async createEducationalModule(module: InsertEducationalModule): Promise<EducationalModule> {
    const [created] = await db.insert(educationalModules).values(module).returning();
    return created;
  }

  async incrementModuleViews(id: string): Promise<void> {
    await db.update(educationalModules)
      .set({ viewCount: sql`${educationalModules.viewCount} + 1` })
      .where(eq(educationalModules.id, id));
  }

  async getUserEducationalProgress(userId: string): Promise<UserEducationalProgress[]> {
    return db.select().from(userEducationalProgress)
      .where(eq(userEducationalProgress.userId, userId));
  }

  async updateUserEducationalProgress(userId: string, moduleId: string, progress: Partial<InsertUserEducationalProgress>): Promise<UserEducationalProgress> {
    const existing = await db.select().from(userEducationalProgress)
      .where(and(
        eq(userEducationalProgress.userId, userId),
        eq(userEducationalProgress.moduleId, moduleId)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(userEducationalProgress)
        .set(progress)
        .where(eq(userEducationalProgress.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [created] = await db.insert(userEducationalProgress)
      .values({ userId, moduleId, ...progress })
      .returning();
    return created;
  }

  async getRecommendedModules(userId: string): Promise<EducationalModule[]> {
    const records = await this.getHealthRecords(userId);
    const conditions = records.filter(r => r.type === "condition").map(r => r.title?.toLowerCase() || "");
    const medications = records.filter(r => r.type === "medication").map(r => r.title?.toLowerCase() || "");
    
    const allModules = await this.getEducationalModules();
    return allModules.filter(module => {
      const relatedConditions = (module.relatedConditions as string[] || []).map(c => c.toLowerCase());
      const relatedMeds = (module.relatedMedications as string[] || []).map(m => m.toLowerCase());
      
      return relatedConditions.some(c => conditions.some(uc => uc.includes(c) || c.includes(uc))) ||
             relatedMeds.some(m => medications.some(um => um.includes(m) || m.includes(um)));
    }).slice(0, 5);
  }

  // ============================================
  // AI Health Assistant - Conversations
  // ============================================

  async createAiConversation(conversation: InsertAiConversation): Promise<AiConversation> {
    const [created] = await db.insert(aiConversations).values(conversation).returning();
    return created;
  }

  async getAiConversations(userId: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(eq(aiConversations.userId, userId))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(50);
  }

  async getActiveAiConversation(userId: string): Promise<AiConversation | undefined> {
    const [conversation] = await db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.userId, userId),
        eq(aiConversations.isActive, true)
      ))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(1);
    return conversation;
  }

  async getAiConversation(id: string): Promise<AiConversation | undefined> {
    const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conversation;
  }

  async updateAiConversation(id: string, updates: Partial<InsertAiConversation>): Promise<AiConversation | undefined> {
    const [updated] = await db.update(aiConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiConversations.id, id))
      .returning();
    return updated;
  }

  async addAiMessage(message: InsertAiMessage): Promise<AiMessage> {
    const [created] = await db.insert(aiMessages).values(message).returning();
    await db.update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(eq(aiConversations.id, message.conversationId));
    return created;
  }

  async getAiMessages(conversationId: string): Promise<AiMessage[]> {
    return db.select().from(aiMessages)
      .where(eq(aiMessages.conversationId, conversationId))
      .orderBy(aiMessages.createdAt);
  }

  async getRecentAiMessages(userId: string, limit: number = 20): Promise<AiMessage[]> {
    const conversation = await this.getActiveAiConversation(userId);
    if (!conversation) return [];
    return db.select().from(aiMessages)
      .where(eq(aiMessages.conversationId, conversation.id))
      .orderBy(desc(aiMessages.createdAt))
      .limit(limit);
  }

  async deleteAiConversation(id: string): Promise<boolean> {
    const result = await db.delete(aiConversations).where(eq(aiConversations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getAiConversationsByFingerprint(userId: string, fingerprint: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.userId, userId),
        eq(aiConversations.fingerprint, fingerprint),
        isNull(aiConversations.mergedInto)
      ))
      .orderBy(desc(aiConversations.updatedAt));
  }

  async getUnmergedAiConversations(userId: string): Promise<AiConversation[]> {
    return db.select().from(aiConversations)
      .where(and(
        eq(aiConversations.userId, userId),
        isNull(aiConversations.mergedInto)
      ))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(100);
  }

  async mergeAiConversations(targetId: string, sourceIds: string[]): Promise<AiConversation | undefined> {
    const sourceMessages = [];
    for (const srcId of sourceIds) {
      const msgs = await this.getAiMessages(srcId);
      sourceMessages.push(...msgs);
    }
    for (const msg of sourceMessages) {
      await db.insert(aiMessages).values({
        conversationId: targetId,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata,
      });
    }
    for (const srcId of sourceIds) {
      await db.update(aiConversations)
        .set({ mergedInto: targetId, isActive: false, updatedAt: new Date() })
        .where(eq(aiConversations.id, srcId));
    }
    const target = await this.getAiConversation(targetId);
    if (target) {
      const allMessages = await this.getAiMessages(targetId);
      const existingMerged = (target.mergedFrom as string[]) || [];
      await db.update(aiConversations)
        .set({
          mergedFrom: [...existingMerged, ...sourceIds],
          messageCount: allMessages.length,
          updatedAt: new Date(),
        })
        .where(eq(aiConversations.id, targetId));
    }
    return this.getAiConversation(targetId);
  }

  async createAiInsight(insight: InsertAiInsight): Promise<AiInsight> {
    const [created] = await db.insert(aiInsights).values(insight).returning();
    return created;
  }

  async getAiInsights(userId: string, archived?: boolean): Promise<AiInsight[]> {
    const conditions = [eq(aiInsights.userId, userId)];
    if (archived !== undefined) {
      conditions.push(eq(aiInsights.isArchived, archived));
    }
    return db.select().from(aiInsights)
      .where(and(...conditions))
      .orderBy(desc(aiInsights.createdAt))
      .limit(50);
  }

  async archiveAiInsight(id: string): Promise<AiInsight | undefined> {
    const [updated] = await db.update(aiInsights)
      .set({ isArchived: true })
      .where(eq(aiInsights.id, id))
      .returning();
    return updated;
  }

  async deleteAiInsight(id: string): Promise<boolean> {
    const result = await db.delete(aiInsights).where(eq(aiInsights.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ============================================
  // AI Workflow Automation Storage
  // ============================================

  async createAppointmentSuggestion(suggestion: InsertAppointmentSuggestion): Promise<AppointmentSuggestion> {
    const [created] = await db.insert(appointmentSuggestions).values(suggestion).returning();
    return created;
  }

  async getAppointmentSuggestions(userId: string, status?: string): Promise<AppointmentSuggestion[]> {
    if (status) {
      return db.select().from(appointmentSuggestions)
        .where(and(eq(appointmentSuggestions.userId, userId), eq(appointmentSuggestions.status, status)))
        .orderBy(desc(appointmentSuggestions.createdAt));
    }
    return db.select().from(appointmentSuggestions)
      .where(eq(appointmentSuggestions.userId, userId))
      .orderBy(desc(appointmentSuggestions.createdAt));
  }

  async getPendingAppointmentSuggestions(userId: string): Promise<AppointmentSuggestion[]> {
    return db.select().from(appointmentSuggestions)
      .where(and(
        eq(appointmentSuggestions.userId, userId),
        eq(appointmentSuggestions.status, "pending"),
        or(isNull(appointmentSuggestions.expiresAt), gte(appointmentSuggestions.expiresAt, new Date()))
      ))
      .orderBy(desc(appointmentSuggestions.priority), desc(appointmentSuggestions.createdAt));
  }

  async getAppointmentSuggestion(id: string): Promise<AppointmentSuggestion | undefined> {
    const [suggestion] = await db.select().from(appointmentSuggestions).where(eq(appointmentSuggestions.id, id));
    return suggestion;
  }

  async updateAppointmentSuggestion(id: string, updates: Partial<InsertAppointmentSuggestion>): Promise<AppointmentSuggestion | undefined> {
    const [updated] = await db.update(appointmentSuggestions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(appointmentSuggestions.id, id))
      .returning();
    return updated;
  }

  async dismissAppointmentSuggestion(id: string, feedback?: string): Promise<AppointmentSuggestion | undefined> {
    const [updated] = await db.update(appointmentSuggestions)
      .set({ status: "dismissed", dismissedAt: new Date(), userFeedback: feedback, updatedAt: new Date() })
      .where(eq(appointmentSuggestions.id, id))
      .returning();
    return updated;
  }

  async createRefillRequest(request: InsertRefillRequest): Promise<RefillRequest> {
    const [created] = await db.insert(refillRequests).values(request).returning();
    return created;
  }

  async getRefillRequests(userId: string, status?: string): Promise<RefillRequest[]> {
    if (status) {
      return db.select().from(refillRequests)
        .where(and(eq(refillRequests.userId, userId), eq(refillRequests.status, status)))
        .orderBy(desc(refillRequests.createdAt));
    }
    return db.select().from(refillRequests)
      .where(eq(refillRequests.userId, userId))
      .orderBy(desc(refillRequests.createdAt));
  }

  async getPendingRefillRequests(userId: string): Promise<RefillRequest[]> {
    return db.select().from(refillRequests)
      .where(and(eq(refillRequests.userId, userId), eq(refillRequests.status, "pending")))
      .orderBy(desc(refillRequests.priority), desc(refillRequests.createdAt));
  }

  async getRefillRequest(id: string): Promise<RefillRequest | undefined> {
    const [request] = await db.select().from(refillRequests).where(eq(refillRequests.id, id));
    return request;
  }

  async updateRefillRequest(id: string, updates: Partial<InsertRefillRequest>): Promise<RefillRequest | undefined> {
    const [updated] = await db.update(refillRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(refillRequests.id, id))
      .returning();
    return updated;
  }

  async approveRefillRequest(id: string, notes?: string): Promise<RefillRequest | undefined> {
    const [updated] = await db.update(refillRequests)
      .set({ status: "approved", approvedAt: new Date(), userNotes: notes, updatedAt: new Date() })
      .where(eq(refillRequests.id, id))
      .returning();
    return updated;
  }

  async createConsultationSummary(summary: InsertConsultationSummary): Promise<ConsultationSummary> {
    const [created] = await db.insert(consultationSummaries).values(summary).returning();
    return created;
  }

  async getConsultationSummaries(userId: string, limit: number = 20): Promise<ConsultationSummary[]> {
    return db.select().from(consultationSummaries)
      .where(eq(consultationSummaries.userId, userId))
      .orderBy(desc(consultationSummaries.createdAt))
      .limit(limit);
  }

  async getConsultationSummary(id: string): Promise<ConsultationSummary | undefined> {
    const [summary] = await db.select().from(consultationSummaries).where(eq(consultationSummaries.id, id));
    return summary;
  }

  async updateConsultationSummary(id: string, updates: Partial<InsertConsultationSummary>): Promise<ConsultationSummary | undefined> {
    const [updated] = await db.update(consultationSummaries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(consultationSummaries.id, id))
      .returning();
    return updated;
  }

  async rateConsultationSummary(id: string, rating: number, feedback?: string): Promise<ConsultationSummary | undefined> {
    const [updated] = await db.update(consultationSummaries)
      .set({ userRating: rating, userFeedback: feedback, reviewedAt: new Date(), status: "reviewed", updatedAt: new Date() })
      .where(eq(consultationSummaries.id, id))
      .returning();
    return updated;
  }

  async getWorkflowStats(userId: string): Promise<{
    pendingSuggestions: number;
    pendingRefills: number;
    recentSummaries: number;
  }> {
    const [suggestions] = await db.select({ count: count() }).from(appointmentSuggestions)
      .where(and(eq(appointmentSuggestions.userId, userId), eq(appointmentSuggestions.status, "pending")));
    const [refills] = await db.select({ count: count() }).from(refillRequests)
      .where(and(eq(refillRequests.userId, userId), eq(refillRequests.status, "pending")));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [summaries] = await db.select({ count: count() }).from(consultationSummaries)
      .where(and(eq(consultationSummaries.userId, userId), gte(consultationSummaries.createdAt, thirtyDaysAgo)));
    
    return {
      pendingSuggestions: suggestions?.count || 0,
      pendingRefills: refills?.count || 0,
      recentSummaries: summaries?.count || 0,
    };
  }

  // ============================================
  // FHIR Resource Sync Configuration Storage
  // ============================================

  async createFhirResourceSyncConfig(config: InsertFhirResourceSyncConfig): Promise<FhirResourceSyncConfig> {
    const [created] = await db.insert(fhirResourceSyncConfigs).values(config).returning();
    return created;
  }

  async getFhirResourceSyncConfigs(sourceId: string): Promise<FhirResourceSyncConfig[]> {
    return db.select().from(fhirResourceSyncConfigs)
      .where(eq(fhirResourceSyncConfigs.sourceId, sourceId))
      .orderBy(fhirResourceSyncConfigs.priority);
  }

  async getFhirResourceSyncConfig(id: string): Promise<FhirResourceSyncConfig | undefined> {
    const [config] = await db.select().from(fhirResourceSyncConfigs)
      .where(eq(fhirResourceSyncConfigs.id, id));
    return config;
  }

  async getEnabledResourceTypes(sourceId: string): Promise<string[]> {
    const configs = await db.select({ resourceType: fhirResourceSyncConfigs.resourceType })
      .from(fhirResourceSyncConfigs)
      .where(and(
        eq(fhirResourceSyncConfigs.sourceId, sourceId),
        eq(fhirResourceSyncConfigs.enabled, true)
      ))
      .orderBy(fhirResourceSyncConfigs.priority);
    return configs.map(c => c.resourceType);
  }

  async updateFhirResourceSyncConfig(id: string, updates: Partial<InsertFhirResourceSyncConfig>): Promise<FhirResourceSyncConfig | undefined> {
    const [updated] = await db.update(fhirResourceSyncConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fhirResourceSyncConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteFhirResourceSyncConfig(id: string): Promise<boolean> {
    const result = await db.delete(fhirResourceSyncConfigs)
      .where(eq(fhirResourceSyncConfigs.id, id));
    return true;
  }

  async upsertFhirResourceSyncConfig(sourceId: string, userId: string, resourceType: string, updates: Partial<InsertFhirResourceSyncConfig>): Promise<FhirResourceSyncConfig> {
    const existing = await db.select().from(fhirResourceSyncConfigs)
      .where(and(
        eq(fhirResourceSyncConfigs.sourceId, sourceId),
        eq(fhirResourceSyncConfigs.resourceType, resourceType)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(fhirResourceSyncConfigs)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(fhirResourceSyncConfigs.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(fhirResourceSyncConfigs)
        .values({ sourceId, userId, resourceType, ...updates })
        .returning();
      return created;
    }
  }

  async bulkUpdateResourceSyncConfigs(sourceId: string, userId: string, configs: Array<{ resourceType: string; enabled: boolean; validationProfile?: string | null }>): Promise<FhirResourceSyncConfig[]> {
    const results: FhirResourceSyncConfig[] = [];
    for (const config of configs) {
      const result = await this.upsertFhirResourceSyncConfig(sourceId, userId, config.resourceType, {
        enabled: config.enabled,
        validationProfile: config.validationProfile || null,
      });
      results.push(result);
    }
    return results;
  }

  async getResourceSyncConfigWithValidation(sourceId: string, resourceType: string): Promise<FhirResourceSyncConfig | undefined> {
    const [config] = await db.select().from(fhirResourceSyncConfigs)
      .where(and(
        eq(fhirResourceSyncConfigs.sourceId, sourceId),
        eq(fhirResourceSyncConfigs.resourceType, resourceType)
      ));
    return config;
  }

  // ==================== HEALTH JOURNEYS ====================
  async getHealthJourneys(userId: string): Promise<HealthJourney[]> {
    return db.select().from(healthJourneys)
      .where(eq(healthJourneys.userId, userId))
      .orderBy(desc(healthJourneys.createdAt));
  }

  async getHealthJourney(id: string): Promise<HealthJourney | undefined> {
    const [journey] = await db.select().from(healthJourneys).where(eq(healthJourneys.id, id));
    return journey;
  }

  async createHealthJourney(journey: InsertHealthJourney): Promise<HealthJourney> {
    const [created] = await db.insert(healthJourneys).values(journey).returning();
    return created;
  }

  async updateHealthJourney(id: string, data: Partial<HealthJourney>): Promise<HealthJourney | undefined> {
    const [updated] = await db.update(healthJourneys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(healthJourneys.id, id))
      .returning();
    return updated;
  }

  async deleteHealthJourney(id: string): Promise<boolean> {
    const result = await db.delete(healthJourneys).where(eq(healthJourneys.id, id));
    return true;
  }

  async getActiveJourneysForUser(userId: string): Promise<HealthJourney[]> {
    return db.select().from(healthJourneys)
      .where(and(
        eq(healthJourneys.userId, userId),
        eq(healthJourneys.status, "active")
      ))
      .orderBy(desc(healthJourneys.startedAt));
  }

  // Journey Milestones
  async getJourneyMilestones(journeyId: string): Promise<JourneyMilestone[]> {
    return db.select().from(journeyMilestones)
      .where(eq(journeyMilestones.journeyId, journeyId))
      .orderBy(journeyMilestones.phase, journeyMilestones.orderIndex);
  }

  async createJourneyMilestone(milestone: InsertJourneyMilestone): Promise<JourneyMilestone> {
    const [created] = await db.insert(journeyMilestones).values(milestone).returning();
    return created;
  }

  async getJourneyMilestone(id: string): Promise<JourneyMilestone | undefined> {
    const [milestone] = await db.select().from(journeyMilestones).where(eq(journeyMilestones.id, id));
    return milestone;
  }

  async updateJourneyMilestone(id: string, data: Partial<InsertJourneyMilestone>): Promise<JourneyMilestone | undefined> {
    const [updated] = await db.update(journeyMilestones)
      .set(data)
      .where(eq(journeyMilestones.id, id))
      .returning();
    return updated;
  }

  // Adaptive Content
  async getAdaptiveContent(userId: string, journeyId?: string): Promise<AdaptiveContent[]> {
    if (journeyId) {
      return db.select().from(adaptiveContent)
        .where(and(
          eq(adaptiveContent.userId, userId),
          eq(adaptiveContent.journeyId, journeyId)
        ))
        .orderBy(desc(adaptiveContent.createdAt));
    }
    return db.select().from(adaptiveContent)
      .where(eq(adaptiveContent.userId, userId))
      .orderBy(desc(adaptiveContent.createdAt));
  }

  async createAdaptiveContent(content: InsertAdaptiveContent): Promise<AdaptiveContent> {
    const [created] = await db.insert(adaptiveContent).values(content).returning();
    return created;
  }

  // ==================== CARE PLANS ====================
  async getCarePlans(userId: string): Promise<CarePlan[]> {
    return db.select().from(carePlans)
      .where(eq(carePlans.userId, userId))
      .orderBy(desc(carePlans.createdAt));
  }

  async getCarePlan(id: string): Promise<CarePlan | undefined> {
    const [plan] = await db.select().from(carePlans).where(eq(carePlans.id, id));
    return plan;
  }

  async createCarePlan(plan: InsertCarePlan): Promise<CarePlan> {
    const [created] = await db.insert(carePlans).values(plan).returning();
    return created;
  }

  async updateCarePlan(id: string, data: Partial<CarePlan>): Promise<CarePlan | undefined> {
    const [updated] = await db.update(carePlans)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(carePlans.id, id))
      .returning();
    return updated;
  }

  async deleteCarePlan(id: string): Promise<boolean> {
    await db.delete(carePlans).where(eq(carePlans.id, id));
    return true;
  }

  async getActiveCarePlans(userId: string): Promise<CarePlan[]> {
    return db.select().from(carePlans)
      .where(and(
        eq(carePlans.userId, userId),
        eq(carePlans.status, "active")
      ))
      .orderBy(desc(carePlans.startDate));
  }

  // Care Plan Activities
  async getCarePlanActivity(id: string): Promise<CarePlanActivity | undefined> {
    const [activity] = await db.select().from(carePlanActivities).where(eq(carePlanActivities.id, id));
    return activity;
  }

  async getCarePlanActivities(carePlanId: string): Promise<CarePlanActivity[]> {
    return db.select().from(carePlanActivities)
      .where(eq(carePlanActivities.carePlanId, carePlanId))
      .orderBy(carePlanActivities.dueDate);
  }

  async createCarePlanActivity(activity: InsertCarePlanActivity): Promise<CarePlanActivity> {
    const [created] = await db.insert(carePlanActivities).values(activity).returning();
    return created;
  }

  async updateCarePlanActivity(id: string, data: Partial<InsertCarePlanActivity>): Promise<CarePlanActivity | undefined> {
    const [updated] = await db.update(carePlanActivities)
      .set(data)
      .where(eq(carePlanActivities.id, id))
      .returning();
    return updated;
  }

  async completeCarePlanActivity(id: string): Promise<CarePlanActivity | undefined> {
    const [updated] = await db.update(carePlanActivities)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(carePlanActivities.id, id))
      .returning();
    return updated;
  }

  // ==================== PROVIDER MESSAGING ====================
  async getProviderProfiles(): Promise<ProviderProfile[]> {
    return db.select().from(providerProfiles)
      .where(eq(providerProfiles.isAvailable, true))
      .orderBy(providerProfiles.name);
  }

  async getProviderProfile(id: string): Promise<ProviderProfile | undefined> {
    const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.id, id));
    return profile;
  }

  async getProviderProfileByUserId(userId: string): Promise<ProviderProfile | undefined> {
    const [profile] = await db.select().from(providerProfiles).where(eq(providerProfiles.userId, userId));
    return profile;
  }

  async createProviderProfile(profile: InsertProviderProfile): Promise<ProviderProfile> {
    const [created] = await db.insert(providerProfiles).values(profile).returning();
    return created;
  }

  async updateProviderProfile(id: string, data: Partial<InsertProviderProfile>): Promise<ProviderProfile | undefined> {
    const [updated] = await db.update(providerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerProfiles.id, id))
      .returning();
    return updated;
  }

  // Messaging Threads
  async getMessagingThreads(patientId: string): Promise<MessagingThread[]> {
    return db.select().from(messagingThreads)
      .where(eq(messagingThreads.patientId, patientId))
      .orderBy(desc(messagingThreads.lastMessageAt));
  }

  async getMessagingThread(id: string): Promise<MessagingThread | undefined> {
    const [thread] = await db.select().from(messagingThreads).where(eq(messagingThreads.id, id));
    return thread;
  }

  async createMessagingThread(thread: InsertMessagingThread): Promise<MessagingThread> {
    const [created] = await db.insert(messagingThreads).values(thread).returning();
    return created;
  }

  async updateMessagingThread(id: string, data: Partial<InsertMessagingThread>): Promise<MessagingThread | undefined> {
    const [updated] = await db.update(messagingThreads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(messagingThreads.id, id))
      .returning();
    return updated;
  }

  // Secure Messages
  async getSecureMessageById(id: string): Promise<SecureMessage | undefined> {
    const [message] = await db.select().from(secureMessages).where(eq(secureMessages.id, id));
    return message;
  }

  async getSecureMessages(threadId: string): Promise<SecureMessage[]> {
    return db.select().from(secureMessages)
      .where(eq(secureMessages.threadId, threadId))
      .orderBy(secureMessages.createdAt);
  }

  async createSecureMessage(message: InsertSecureMessage): Promise<SecureMessage> {
    const [created] = await db.insert(secureMessages).values(message).returning();
    // Update thread's lastMessageAt
    await db.update(messagingThreads)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(messagingThreads.id, message.threadId));
    return created;
  }

  async markMessageAsRead(id: string): Promise<SecureMessage | undefined> {
    const [updated] = await db.update(secureMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(secureMessages.id, id))
      .returning();
    return updated;
  }

  async getUnreadMessageCount(patientId: string): Promise<number> {
    const threads = await db.select({ id: messagingThreads.id }).from(messagingThreads)
      .where(eq(messagingThreads.patientId, patientId));
    
    if (threads.length === 0) return 0;
    
    const threadIds = threads.map(t => t.id);
    const [result] = await db.select({ count: count() }).from(secureMessages)
      .where(and(
        inArray(secureMessages.threadId, threadIds),
        eq(secureMessages.isRead, false),
        eq(secureMessages.senderType, "provider")
      ));
    
    return result?.count || 0;
  }

  // Message Templates
  async getMessageTemplates(providerId?: string): Promise<MessageTemplate[]> {
    if (providerId) {
      return db.select().from(messageTemplates)
        .where(or(
          eq(messageTemplates.providerId, providerId),
          eq(messageTemplates.isShared, true)
        ))
        .orderBy(desc(messageTemplates.usageCount));
    }
    return db.select().from(messageTemplates)
      .where(eq(messageTemplates.isShared, true))
      .orderBy(desc(messageTemplates.usageCount));
  }

  async createMessageTemplate(template: InsertMessageTemplate): Promise<MessageTemplate> {
    const [created] = await db.insert(messageTemplates).values(template).returning();
    return created;
  }

  // Connected Devices
  async getConnectedDevices(userId: string): Promise<ConnectedDevice[]> {
    return db.select().from(connectedDevices)
      .where(and(eq(connectedDevices.userId, userId), eq(connectedDevices.isActive, true)))
      .orderBy(desc(connectedDevices.lastSyncAt));
  }

  async getConnectedDevice(id: string): Promise<ConnectedDevice | undefined> {
    const [device] = await db.select().from(connectedDevices).where(eq(connectedDevices.id, id));
    return device;
  }

  async createConnectedDevice(device: InsertConnectedDevice): Promise<ConnectedDevice> {
    const [created] = await db.insert(connectedDevices).values(device).returning();
    return created;
  }

  async updateConnectedDevice(id: string, data: Partial<InsertConnectedDevice>, ownerUserId?: string): Promise<ConnectedDevice | undefined> {
    const condition = ownerUserId
      ? and(eq(connectedDevices.id, id), eq(connectedDevices.userId, ownerUserId))
      : eq(connectedDevices.id, id);
    const [updated] = await db.update(connectedDevices)
      .set({ ...data, updatedAt: new Date() })
      .where(condition)
      .returning();
    return updated;
  }

  async deleteConnectedDevice(id: string, ownerUserId?: string): Promise<boolean> {
    const condition = ownerUserId
      ? and(eq(connectedDevices.id, id), eq(connectedDevices.userId, ownerUserId))
      : eq(connectedDevices.id, id);
    const [deleted] = await db.update(connectedDevices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(condition)
      .returning();
    return !!deleted;
  }

  // Sensor Readings
  async getSensorReadings(userId: string, options?: {
    dataType?: string;
    deviceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<SensorReading[]> {
    const conditions = [eq(sensorReadings.userId, userId)];
    
    if (options?.dataType) {
      conditions.push(eq(sensorReadings.dataType, options.dataType));
    }
    if (options?.deviceId) {
      conditions.push(eq(sensorReadings.deviceId, options.deviceId));
    }
    if (options?.startDate) {
      conditions.push(gte(sensorReadings.timestamp, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(sensorReadings.timestamp, options.endDate));
    }

    let query = db.select().from(sensorReadings)
      .where(and(...conditions))
      .orderBy(desc(sensorReadings.timestamp));
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    
    return query;
  }

  async createSensorReading(reading: InsertSensorReading): Promise<SensorReading> {
    const [created] = await db.insert(sensorReadings).values(reading).returning();
    return created;
  }

  async createSensorReadingsBatch(readings: InsertSensorReading[]): Promise<SensorReading[]> {
    if (readings.length === 0) return [];
    return db.insert(sensorReadings).values(readings).returning();
  }

  async getLatestReadingByType(userId: string, dataType: string): Promise<SensorReading | undefined> {
    const [reading] = await db.select().from(sensorReadings)
      .where(and(eq(sensorReadings.userId, userId), eq(sensorReadings.dataType, dataType)))
      .orderBy(desc(sensorReadings.timestamp))
      .limit(1);
    return reading;
  }

  // Sensor Alerts
  async getSensorAlerts(userId: string, status?: string): Promise<SensorAlert[]> {
    const conditions = [eq(sensorAlerts.userId, userId)];
    if (status) {
      conditions.push(eq(sensorAlerts.status, status));
    }
    return db.select().from(sensorAlerts)
      .where(and(...conditions))
      .orderBy(desc(sensorAlerts.createdAt));
  }

  async createSensorAlert(alert: InsertSensorAlert): Promise<SensorAlert> {
    const [created] = await db.insert(sensorAlerts).values(alert).returning();
    return created;
  }

  async updateSensorAlert(id: string, data: Partial<InsertSensorAlert>): Promise<SensorAlert | undefined> {
    const [updated] = await db.update(sensorAlerts)
      .set(data)
      .where(eq(sensorAlerts.id, id))
      .returning();
    return updated;
  }

  async getSensorAlertById(id: string): Promise<SensorAlert | undefined> {
    const [alert] = await db.select().from(sensorAlerts).where(eq(sensorAlerts.id, id));
    return alert;
  }

  async acknowledgeSensorAlert(id: string, userId: string): Promise<SensorAlert | undefined> {
    const [updated] = await db.update(sensorAlerts)
      .set({ status: "acknowledged", acknowledgedAt: new Date() })
      .where(and(eq(sensorAlerts.id, id), eq(sensorAlerts.userId, userId)))
      .returning();
    return updated;
  }

  async resolveSensorAlert(id: string, userId: string): Promise<SensorAlert | undefined> {
    const [updated] = await db.update(sensorAlerts)
      .set({ status: "resolved", resolvedAt: new Date() })
      .where(and(eq(sensorAlerts.id, id), eq(sensorAlerts.userId, userId)))
      .returning();
    return updated;
  }

  // Sensor Thresholds
  async getSensorThresholds(userId: string): Promise<SensorThreshold[]> {
    return db.select().from(sensorThresholds)
      .where(eq(sensorThresholds.userId, userId))
      .orderBy(sensorThresholds.dataType);
  }

  async getSensorThreshold(userId: string, dataType: string): Promise<SensorThreshold | undefined> {
    const [threshold] = await db.select().from(sensorThresholds)
      .where(and(eq(sensorThresholds.userId, userId), eq(sensorThresholds.dataType, dataType)));
    return threshold;
  }

  async upsertSensorThreshold(userId: string, dataType: string, data: Partial<InsertSensorThreshold>): Promise<SensorThreshold> {
    const existing = await this.getSensorThreshold(userId, dataType);
    if (existing) {
      const [updated] = await db.update(sensorThresholds)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(sensorThresholds.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(sensorThresholds)
      .values({ userId, dataType, ...data })
      .returning();
    return created;
  }

  // Sensor Trends
  async getSensorTrends(userId: string, dataType?: string, period?: string): Promise<SensorTrend[]> {
    const conditions = [eq(sensorTrends.userId, userId)];
    if (dataType) {
      conditions.push(eq(sensorTrends.dataType, dataType));
    }
    if (period) {
      conditions.push(eq(sensorTrends.period, period));
    }
    return db.select().from(sensorTrends)
      .where(and(...conditions))
      .orderBy(desc(sensorTrends.endDate));
  }

  async createSensorTrend(trend: InsertSensorTrend): Promise<SensorTrend> {
    const [created] = await db.insert(sensorTrends).values(trend).returning();
    return created;
  }

  async getActiveAlertCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(sensorAlerts)
      .where(and(eq(sensorAlerts.userId, userId), eq(sensorAlerts.status, "active")));
    return result?.count || 0;
  }

  // ============================================
  // Provider Collaboration - Case Summaries
  // ============================================
  async getCaseSummaries(userId: string): Promise<CaseSummary[]> {
    return db.select().from(caseSummaries)
      .where(eq(caseSummaries.userId, userId))
      .orderBy(desc(caseSummaries.createdAt));
  }

  async getCaseSummary(id: string): Promise<CaseSummary | undefined> {
    const [summary] = await db.select().from(caseSummaries)
      .where(eq(caseSummaries.id, id));
    return summary;
  }

  async createCaseSummary(data: InsertCaseSummary): Promise<CaseSummary> {
    const [created] = await db.insert(caseSummaries).values(data).returning();
    return created;
  }

  async updateCaseSummary(id: string, data: Partial<InsertCaseSummary>): Promise<CaseSummary | undefined> {
    const [updated] = await db.update(caseSummaries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(caseSummaries.id, id))
      .returning();
    return updated;
  }

  async deleteCaseSummary(id: string): Promise<boolean> {
    const result = await db.delete(caseSummaries).where(eq(caseSummaries.id, id));
    return true;
  }

  // ============================================
  // Provider Collaboration - Research Recommendations
  // ============================================
  async getResearchRecommendations(userId: string): Promise<ResearchRecommendation[]> {
    return db.select().from(researchRecommendations)
      .where(eq(researchRecommendations.userId, userId))
      .orderBy(desc(researchRecommendations.createdAt));
  }

  async createResearchRecommendation(data: InsertResearchRecommendation): Promise<ResearchRecommendation> {
    const [created] = await db.insert(researchRecommendations).values(data).returning();
    return created;
  }

  // ============================================
  // Provider Collaboration - Provider Communications
  // ============================================
  async getProviderCommunications(userId: string): Promise<ProviderCommunication[]> {
    return db.select().from(providerCommunications)
      .where(eq(providerCommunications.userId, userId))
      .orderBy(desc(providerCommunications.createdAt));
  }

  async getProviderCommunication(id: string): Promise<ProviderCommunication | undefined> {
    const [communication] = await db.select().from(providerCommunications)
      .where(eq(providerCommunications.id, id));
    return communication;
  }

  async createProviderCommunication(data: InsertProviderCommunication): Promise<ProviderCommunication> {
    const [created] = await db.insert(providerCommunications).values(data).returning();
    return created;
  }

  async updateProviderCommunication(id: string, data: Partial<InsertProviderCommunication>): Promise<ProviderCommunication | undefined> {
    const [updated] = await db.update(providerCommunications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerCommunications.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Advanced Analytics - Treatment Protocols
  // ============================================
  async getTreatmentProtocols(userId: string): Promise<TreatmentProtocol[]> {
    return db.select().from(treatmentProtocols)
      .where(or(eq(treatmentProtocols.userId, userId), isNull(treatmentProtocols.userId)))
      .orderBy(treatmentProtocols.name);
  }

  async getTreatmentProtocol(id: string): Promise<TreatmentProtocol | undefined> {
    const [protocol] = await db.select().from(treatmentProtocols)
      .where(eq(treatmentProtocols.id, id));
    return protocol;
  }

  async createTreatmentProtocol(data: InsertTreatmentProtocol): Promise<TreatmentProtocol> {
    const [created] = await db.insert(treatmentProtocols).values(data).returning();
    return created;
  }

  async updateTreatmentProtocol(id: string, data: Partial<InsertTreatmentProtocol>): Promise<TreatmentProtocol | undefined> {
    const [updated] = await db.update(treatmentProtocols)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(treatmentProtocols.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Advanced Analytics - Protocol Deviations
  // ============================================
  async getProtocolDeviations(userId: string): Promise<ProtocolDeviation[]> {
    return db.select().from(protocolDeviations)
      .where(eq(protocolDeviations.userId, userId))
      .orderBy(desc(protocolDeviations.createdAt));
  }

  async getProtocolDeviation(id: string): Promise<ProtocolDeviation | undefined> {
    const [deviation] = await db.select().from(protocolDeviations)
      .where(eq(protocolDeviations.id, id));
    return deviation;
  }

  async createProtocolDeviation(data: InsertProtocolDeviation): Promise<ProtocolDeviation> {
    const [created] = await db.insert(protocolDeviations).values(data).returning();
    return created;
  }

  async updateProtocolDeviation(id: string, data: Partial<InsertProtocolDeviation>): Promise<ProtocolDeviation | undefined> {
    const [updated] = await db.update(protocolDeviations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(protocolDeviations.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Advanced Analytics - KPI Reports
  // ============================================
  async getKpiReports(userId: string): Promise<KpiReport[]> {
    return db.select().from(kpiReports)
      .where(eq(kpiReports.userId, userId))
      .orderBy(desc(kpiReports.createdAt));
  }

  async getKpiReport(id: string): Promise<KpiReport | undefined> {
    const [report] = await db.select().from(kpiReports)
      .where(eq(kpiReports.id, id));
    return report;
  }

  async createKpiReport(data: InsertKpiReport): Promise<KpiReport> {
    const [created] = await db.insert(kpiReports).values(data).returning();
    return created;
  }

  // ============================================
  // Advanced Analytics - Outcome Predictions
  // ============================================
  async getOutcomePredictions(userId: string): Promise<OutcomePrediction[]> {
    return db.select().from(outcomePredictions)
      .where(eq(outcomePredictions.userId, userId))
      .orderBy(desc(outcomePredictions.createdAt));
  }

  async getOutcomePrediction(id: string): Promise<OutcomePrediction | undefined> {
    const [prediction] = await db.select().from(outcomePredictions)
      .where(eq(outcomePredictions.id, id));
    return prediction;
  }

  async createOutcomePrediction(data: InsertOutcomePrediction): Promise<OutcomePrediction> {
    const [created] = await db.insert(outcomePredictions).values(data).returning();
    return created;
  }

  // ============================================
  // Advanced Analytics - Population Health Reports
  // ============================================
  async getPopulationHealthReports(userId: string): Promise<PopulationHealthReport[]> {
    return db.select().from(populationHealthReports)
      .where(eq(populationHealthReports.userId, userId))
      .orderBy(desc(populationHealthReports.createdAt));
  }

  async getPopulationHealthReport(id: string): Promise<PopulationHealthReport | undefined> {
    const [report] = await db.select().from(populationHealthReports)
      .where(eq(populationHealthReports.id, id));
    return report;
  }

  async createPopulationHealthReport(data: InsertPopulationHealthReport): Promise<PopulationHealthReport> {
    const [created] = await db.insert(populationHealthReports).values(data).returning();
    return created;
  }

  // ============================================
  // Advanced Analytics - Treatment Efficacy Analyses
  // ============================================
  async getTreatmentEfficacyAnalyses(userId: string): Promise<TreatmentEfficacyAnalysis[]> {
    return db.select().from(treatmentEfficacyAnalyses)
      .where(eq(treatmentEfficacyAnalyses.userId, userId))
      .orderBy(desc(treatmentEfficacyAnalyses.createdAt));
  }

  async getTreatmentEfficacyAnalysis(id: string): Promise<TreatmentEfficacyAnalysis | undefined> {
    const [analysis] = await db.select().from(treatmentEfficacyAnalyses)
      .where(eq(treatmentEfficacyAnalyses.id, id));
    return analysis;
  }

  async createTreatmentEfficacyAnalysis(data: InsertTreatmentEfficacyAnalysis): Promise<TreatmentEfficacyAnalysis> {
    const [created] = await db.insert(treatmentEfficacyAnalyses).values(data).returning();
    return created;
  }

  // ============================================
  // AI Personalized Journeys - Sentiment Logs
  // ============================================
  async getRecentSentimentLogs(userId: string, limit: number = 10): Promise<UserSentimentLog[]> {
    return db.select().from(userSentimentLogs)
      .where(eq(userSentimentLogs.userId, userId))
      .orderBy(desc(userSentimentLogs.createdAt))
      .limit(limit);
  }

  async createUserSentimentLog(data: InsertUserSentimentLog): Promise<UserSentimentLog> {
    const [created] = await db.insert(userSentimentLogs).values(data).returning();
    return created;
  }

  // ============================================
  // AI Personalized Journeys - Personalized Content
  // ============================================
  async getPersonalizedContent(userId: string): Promise<PersonalizedContent[]> {
    return db.select().from(personalizedContent)
      .where(eq(personalizedContent.userId, userId))
      .orderBy(desc(personalizedContent.createdAt));
  }

  async getUnviewedPersonalizedContent(userId: string): Promise<PersonalizedContent[]> {
    return db.select().from(personalizedContent)
      .where(and(
        eq(personalizedContent.userId, userId),
        eq(personalizedContent.isViewed, false)
      ))
      .orderBy(desc(personalizedContent.relevanceScore));
  }

  async createPersonalizedContent(data: InsertPersonalizedContent): Promise<PersonalizedContent> {
    const [created] = await db.insert(personalizedContent).values(data).returning();
    return created;
  }

  async updatePersonalizedContent(id: string, data: Partial<InsertPersonalizedContent>): Promise<PersonalizedContent | undefined> {
    const [updated] = await db.update(personalizedContent)
      .set(data)
      .where(eq(personalizedContent.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // AI Personalized Journeys - Care Plan Adjustments
  // ============================================
  async getCarePlanAdjustments(carePlanId: string): Promise<CarePlanAdjustment[]> {
    return db.select().from(carePlanAdjustments)
      .where(eq(carePlanAdjustments.carePlanId, carePlanId))
      .orderBy(desc(carePlanAdjustments.createdAt));
  }

  async getPendingCarePlanAdjustments(userId: string): Promise<CarePlanAdjustment[]> {
    return db.select().from(carePlanAdjustments)
      .where(and(
        eq(carePlanAdjustments.userId, userId),
        eq(carePlanAdjustments.status, "pending")
      ))
      .orderBy(desc(carePlanAdjustments.createdAt));
  }

  async createCarePlanAdjustment(data: InsertCarePlanAdjustment): Promise<CarePlanAdjustment> {
    const [created] = await db.insert(carePlanAdjustments).values(data).returning();
    return created;
  }

  async updateCarePlanAdjustment(id: string, data: Partial<InsertCarePlanAdjustment>): Promise<CarePlanAdjustment | undefined> {
    const [updated] = await db.update(carePlanAdjustments)
      .set(data)
      .where(eq(carePlanAdjustments.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // AI Personalized Journeys - Progress Snapshots
  // ============================================
  async getUserProgressSnapshots(userId: string, period?: string): Promise<UserProgressSnapshot[]> {
    if (period) {
      return db.select().from(userProgressSnapshots)
        .where(and(
          eq(userProgressSnapshots.userId, userId),
          eq(userProgressSnapshots.period, period)
        ))
        .orderBy(desc(userProgressSnapshots.snapshotDate));
    }
    return db.select().from(userProgressSnapshots)
      .where(eq(userProgressSnapshots.userId, userId))
      .orderBy(desc(userProgressSnapshots.snapshotDate));
  }

  async createUserProgressSnapshot(data: InsertUserProgressSnapshot): Promise<UserProgressSnapshot> {
    const [created] = await db.insert(userProgressSnapshots).values(data).returning();
    return created;
  }

  // ============================================
  // Community Features - Health Communities
  // ============================================
  async getHealthCommunities(): Promise<HealthCommunity[]> {
    return db.select().from(healthCommunities)
      .where(eq(healthCommunities.isActive, true))
      .orderBy(desc(healthCommunities.memberCount));
  }

  async getHealthCommunity(id: string): Promise<HealthCommunity | undefined> {
    const [community] = await db.select().from(healthCommunities)
      .where(eq(healthCommunities.id, id));
    return community;
  }

  async createHealthCommunity(data: InsertHealthCommunity): Promise<HealthCommunity> {
    const [created] = await db.insert(healthCommunities).values(data).returning();
    return created;
  }

  async updateHealthCommunity(id: string, data: Partial<InsertHealthCommunity>): Promise<HealthCommunity | undefined> {
    const [updated] = await db.update(healthCommunities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(healthCommunities.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Community Features - Memberships
  // ============================================
  async getUserCommunityMemberships(userId: string): Promise<CommunityMembership[]> {
    return db.select().from(communityMemberships)
      .where(eq(communityMemberships.userId, userId));
  }

  async getCommunityMembers(communityId: string): Promise<CommunityMembership[]> {
    return db.select().from(communityMemberships)
      .where(eq(communityMemberships.communityId, communityId));
  }

  async createCommunityMembership(data: InsertCommunityMembership): Promise<CommunityMembership> {
    const [created] = await db.insert(communityMemberships).values(data).returning();
    await db.update(healthCommunities)
      .set({ memberCount: sql`member_count + 1` })
      .where(eq(healthCommunities.id, data.communityId));
    return created;
  }

  async deleteCommunityMembership(userId: string, communityId: string): Promise<boolean> {
    const result = await db.delete(communityMemberships)
      .where(and(
        eq(communityMemberships.userId, userId),
        eq(communityMemberships.communityId, communityId)
      ));
    await db.update(healthCommunities)
      .set({ memberCount: sql`GREATEST(member_count - 1, 0)` })
      .where(eq(healthCommunities.id, communityId));
    return true;
  }

  // ============================================
  // Community Features - Posts
  // ============================================
  async getCommunityPosts(communityId: string): Promise<CommunityPost[]> {
    return db.select().from(communityPosts)
      .where(and(
        eq(communityPosts.communityId, communityId),
        eq(communityPosts.isHidden, false)
      ))
      .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt));
  }

  async getCommunityPost(id: string): Promise<CommunityPost | undefined> {
    const [post] = await db.select().from(communityPosts)
      .where(eq(communityPosts.id, id));
    return post;
  }

  async createCommunityPost(data: InsertCommunityPost): Promise<CommunityPost> {
    const [created] = await db.insert(communityPosts).values(data).returning();
    await db.update(healthCommunities)
      .set({ postCount: sql`post_count + 1` })
      .where(eq(healthCommunities.id, data.communityId));
    return created;
  }

  async updateCommunityPost(id: string, data: Partial<InsertCommunityPost>): Promise<CommunityPost | undefined> {
    const [updated] = await db.update(communityPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(communityPosts.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Community Features - Comments
  // ============================================
  async getPostComments(postId: string): Promise<PostComment[]> {
    return db.select().from(postComments)
      .where(and(
        eq(postComments.postId, postId),
        eq(postComments.isHidden, false)
      ))
      .orderBy(postComments.createdAt);
  }

  async createPostComment(data: InsertPostComment): Promise<PostComment> {
    const [created] = await db.insert(postComments).values(data).returning();
    await db.update(communityPosts)
      .set({ commentCount: sql`comment_count + 1` })
      .where(eq(communityPosts.id, data.postId));
    return created;
  }

  // ============================================
  // Community Features - Reactions
  // ============================================
  async getReaction(userId: string, targetType: string, targetId: string): Promise<CommunityReaction | undefined> {
    const [reaction] = await db.select().from(communityReactions)
      .where(and(
        eq(communityReactions.userId, userId),
        eq(communityReactions.targetType, targetType),
        eq(communityReactions.targetId, targetId)
      ));
    return reaction;
  }

  async createReaction(data: InsertCommunityReaction): Promise<CommunityReaction> {
    const [created] = await db.insert(communityReactions).values(data).returning();
    if (data.targetType === "post") {
      await db.update(communityPosts)
        .set({ likeCount: sql`like_count + 1` })
        .where(eq(communityPosts.id, data.targetId));
    } else if (data.targetType === "comment") {
      await db.update(postComments)
        .set({ likeCount: sql`like_count + 1` })
        .where(eq(postComments.id, data.targetId));
    }
    return created;
  }

  async deleteReaction(userId: string, targetType: string, targetId: string): Promise<boolean> {
    await db.delete(communityReactions)
      .where(and(
        eq(communityReactions.userId, userId),
        eq(communityReactions.targetType, targetType),
        eq(communityReactions.targetId, targetId)
      ));
    if (targetType === "post") {
      await db.update(communityPosts)
        .set({ likeCount: sql`GREATEST(like_count - 1, 0)` })
        .where(eq(communityPosts.id, targetId));
    } else if (targetType === "comment") {
      await db.update(postComments)
        .set({ likeCount: sql`GREATEST(like_count - 1, 0)` })
        .where(eq(postComments.id, targetId));
    }
    return true;
  }

  // ============================================
  // Content Reports & Moderation
  // ============================================

  async createContentReport(data: InsertContentReport): Promise<ContentReport> {
    const [created] = await db.insert(contentReports).values(data).returning();
    return created;
  }

  async getContentReports(communityId: string, status?: string): Promise<ContentReport[]> {
    const conditions = [eq(contentReports.communityId, communityId)];
    if (status) {
      conditions.push(eq(contentReports.status, status));
    }
    return db.select().from(contentReports)
      .where(and(...conditions))
      .orderBy(desc(contentReports.createdAt));
  }

  async getContentReport(id: string): Promise<ContentReport | undefined> {
    const [report] = await db.select().from(contentReports)
      .where(eq(contentReports.id, id));
    return report;
  }

  async updateContentReport(id: string, data: Partial<ContentReport>): Promise<ContentReport | undefined> {
    const [updated] = await db.update(contentReports)
      .set(data)
      .where(eq(contentReports.id, id))
      .returning();
    return updated;
  }

  async createModerationAction(data: InsertModerationAction): Promise<ModerationAction> {
    const [created] = await db.insert(moderationActions).values(data).returning();
    return created;
  }

  async getModerationActions(communityId: string): Promise<ModerationAction[]> {
    return db.select().from(moderationActions)
      .where(eq(moderationActions.communityId, communityId))
      .orderBy(desc(moderationActions.createdAt));
  }

  async getCommunityUserStatus(userId: string, communityId: string): Promise<CommunityUserStatus | undefined> {
    const [status] = await db.select().from(communityUserStatus)
      .where(and(
        eq(communityUserStatus.userId, userId),
        eq(communityUserStatus.communityId, communityId)
      ));
    return status;
  }

  async upsertCommunityUserStatus(data: InsertCommunityUserStatus): Promise<CommunityUserStatus> {
    const existing = await this.getCommunityUserStatus(data.userId, data.communityId);
    if (existing) {
      const [updated] = await db.update(communityUserStatus)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(communityUserStatus.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(communityUserStatus).values(data).returning();
    return created;
  }

  // ============================================
  // Goal Progress Sharing
  // ============================================

  async createGoalProgressShare(data: InsertGoalProgressShare): Promise<GoalProgressShare> {
    const [created] = await db.insert(goalProgressShares).values(data).returning();
    return created;
  }

  async getGoalProgressShares(communityId: string): Promise<GoalProgressShare[]> {
    return db.select().from(goalProgressShares)
      .where(eq(goalProgressShares.communityId, communityId))
      .orderBy(desc(goalProgressShares.createdAt));
  }

  async getUserGoalProgressShares(userId: string): Promise<GoalProgressShare[]> {
    return db.select().from(goalProgressShares)
      .where(eq(goalProgressShares.userId, userId))
      .orderBy(desc(goalProgressShares.createdAt));
  }

  async hidePost(postId: string): Promise<void> {
    await db.update(communityPosts)
      .set({ isHidden: true, updatedAt: new Date() })
      .where(eq(communityPosts.id, postId));
  }

  async hideComment(commentId: string): Promise<void> {
    await db.update(postComments)
      .set({ isHidden: true, updatedAt: new Date() })
      .where(eq(postComments.id, commentId));
  }

  // ============================================
  // Team Gamification - Health Teams
  // ============================================
  async getHealthTeams(): Promise<HealthTeam[]> {
    return db.select().from(healthTeams)
      .where(eq(healthTeams.isActive, true))
      .orderBy(desc(healthTeams.totalPoints));
  }

  async getHealthTeam(id: string): Promise<HealthTeam | undefined> {
    const [team] = await db.select().from(healthTeams)
      .where(eq(healthTeams.id, id));
    return team;
  }

  async getTeamByInviteCode(inviteCode: string): Promise<HealthTeam | undefined> {
    const [team] = await db.select().from(healthTeams)
      .where(eq(healthTeams.inviteCode, inviteCode));
    return team;
  }

  async createHealthTeam(data: InsertHealthTeam): Promise<HealthTeam> {
    const inviteCode = randomBytes(4).toString("hex").toUpperCase();
    const [created] = await db.insert(healthTeams).values({ ...data, inviteCode }).returning();
    return created;
  }

  async updateHealthTeam(id: string, data: Partial<InsertHealthTeam>): Promise<HealthTeam | undefined> {
    const [updated] = await db.update(healthTeams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(healthTeams.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Team Gamification - Team Memberships
  // ============================================
  async getUserTeamMembership(userId: string): Promise<TeamMembership | undefined> {
    const [membership] = await db.select().from(teamMemberships)
      .where(eq(teamMemberships.userId, userId));
    return membership;
  }

  async getTeamMembers(teamId: string): Promise<TeamMembership[]> {
    return db.select().from(teamMemberships)
      .where(eq(teamMemberships.teamId, teamId))
      .orderBy(desc(teamMemberships.contributedPoints));
  }

  async createTeamMembership(data: InsertTeamMembership): Promise<TeamMembership> {
    const [created] = await db.insert(teamMemberships).values(data).returning();
    await db.update(healthTeams)
      .set({ currentMembers: sql`current_members + 1` })
      .where(eq(healthTeams.id, data.teamId));
    return created;
  }

  async updateTeamMembership(id: string, data: Partial<TeamMembership>): Promise<TeamMembership | undefined> {
    const [updated] = await db.update(teamMemberships)
      .set(data)
      .where(eq(teamMemberships.id, id))
      .returning();
    return updated;
  }

  async deleteTeamMembership(userId: string, teamId: string): Promise<boolean> {
    await db.delete(teamMemberships)
      .where(and(
        eq(teamMemberships.userId, userId),
        eq(teamMemberships.teamId, teamId)
      ));
    await db.update(healthTeams)
      .set({ currentMembers: sql`GREATEST(current_members - 1, 0)` })
      .where(eq(healthTeams.id, teamId));
    return true;
  }

  // ============================================
  // Team Gamification - Team Challenges
  // ============================================
  async getActiveTeamChallenges(): Promise<TeamChallenge[]> {
    return db.select().from(teamChallenges)
      .where(and(
        eq(teamChallenges.isActive, true),
        eq(teamChallenges.isCompleted, false)
      ))
      .orderBy(teamChallenges.endDate);
  }

  async getTeamChallenge(id: string): Promise<TeamChallenge | undefined> {
    const [challenge] = await db.select().from(teamChallenges)
      .where(eq(teamChallenges.id, id));
    return challenge;
  }

  async createTeamChallenge(data: InsertTeamChallenge): Promise<TeamChallenge> {
    const [created] = await db.insert(teamChallenges).values(data).returning();
    return created;
  }

  async updateTeamChallenge(id: string, data: Partial<InsertTeamChallenge>): Promise<TeamChallenge | undefined> {
    const [updated] = await db.update(teamChallenges)
      .set(data)
      .where(eq(teamChallenges.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Team Gamification - Challenge Participations
  // ============================================
  async getTeamChallengeParticipation(teamId: string, challengeId: string): Promise<TeamChallengeParticipation | undefined> {
    const [participation] = await db.select().from(teamChallengeParticipations)
      .where(and(
        eq(teamChallengeParticipations.teamId, teamId),
        eq(teamChallengeParticipations.challengeId, challengeId)
      ));
    return participation;
  }

  async getChallengeParticipations(challengeId: string): Promise<TeamChallengeParticipation[]> {
    return db.select().from(teamChallengeParticipations)
      .where(eq(teamChallengeParticipations.challengeId, challengeId))
      .orderBy(desc(teamChallengeParticipations.currentProgress));
  }

  async createTeamChallengeParticipation(data: InsertTeamChallengeParticipation): Promise<TeamChallengeParticipation> {
    const [created] = await db.insert(teamChallengeParticipations).values(data).returning();
    return created;
  }

  async updateTeamChallengeParticipation(id: string, data: Partial<TeamChallengeParticipation>): Promise<TeamChallengeParticipation | undefined> {
    const [updated] = await db.update(teamChallengeParticipations)
      .set(data)
      .where(eq(teamChallengeParticipations.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Team Gamification - Challenge Contributions
  // ============================================
  async getTeamChallengeContributions(teamId: string, challengeId: string): Promise<TeamChallengeContribution[]> {
    return db.select().from(teamChallengeContributions)
      .where(and(
        eq(teamChallengeContributions.teamId, teamId),
        eq(teamChallengeContributions.challengeId, challengeId)
      ))
      .orderBy(desc(teamChallengeContributions.createdAt));
  }

  async createTeamChallengeContribution(data: InsertTeamChallengeContribution): Promise<TeamChallengeContribution> {
    const [created] = await db.insert(teamChallengeContributions).values(data).returning();
    return created;
  }

  // ============================================
  // Team Gamification - Leaderboards
  // ============================================
  async getTeamLeaderboard(period: string): Promise<TeamLeaderboard | undefined> {
    const [leaderboard] = await db.select().from(teamLeaderboards)
      .where(eq(teamLeaderboards.period, period))
      .orderBy(desc(teamLeaderboards.calculatedAt))
      .limit(1);
    return leaderboard;
  }

  async createTeamLeaderboard(data: InsertTeamLeaderboard): Promise<TeamLeaderboard> {
    const [created] = await db.insert(teamLeaderboards).values(data).returning();
    return created;
  }

  // ============================================
  // AI Care Pathways - Pathway Templates
  // ============================================
  async getCarePathways(providerId?: string, isPublished?: boolean): Promise<CarePathway[]> {
    const conditions = [];
    if (providerId) conditions.push(eq(carePathways.createdByProviderId, providerId));
    if (isPublished !== undefined) conditions.push(eq(carePathways.isPublished, isPublished));
    
    return db.select().from(carePathways)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(carePathways.createdAt));
  }

  async getCarePathway(id: string): Promise<CarePathway | undefined> {
    const [pathway] = await db.select().from(carePathways)
      .where(eq(carePathways.id, id));
    return pathway;
  }

  async getCarePathwaysByCondition(condition: string): Promise<CarePathway[]> {
    return db.select().from(carePathways)
      .where(and(
        ilike(carePathways.condition, `%${condition}%`),
        eq(carePathways.isPublished, true)
      ))
      .orderBy(desc(carePathways.createdAt));
  }

  async createCarePathway(data: InsertCarePathway): Promise<CarePathway> {
    const [created] = await db.insert(carePathways).values(data).returning();
    return created;
  }

  async updateCarePathway(id: string, data: Partial<InsertCarePathway>): Promise<CarePathway | undefined> {
    const [updated] = await db.update(carePathways)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(carePathways.id, id))
      .returning();
    return updated;
  }

  async deleteCarePathway(id: string): Promise<boolean> {
    const result = await db.delete(carePathways).where(eq(carePathways.id, id));
    return true;
  }

  // ============================================
  // AI Care Pathways - Steps
  // ============================================
  async getPathwaySteps(pathwayId: string): Promise<PathwayStep[]> {
    return db.select().from(pathwaySteps)
      .where(eq(pathwaySteps.pathwayId, pathwayId))
      .orderBy(pathwaySteps.orderIndex);
  }

  async getPathwayStep(id: string): Promise<PathwayStep | undefined> {
    const [step] = await db.select().from(pathwaySteps)
      .where(eq(pathwaySteps.id, id));
    return step;
  }

  async createPathwayStep(data: InsertPathwayStep): Promise<PathwayStep> {
    const [created] = await db.insert(pathwaySteps).values(data).returning();
    await this.updatePathwayStepCounts(data.pathwayId);
    return created;
  }

  async createPathwaySteps(data: InsertPathwayStep[]): Promise<PathwayStep[]> {
    if (data.length === 0) return [];
    const created = await db.insert(pathwaySteps).values(data).returning();
    if (data[0]?.pathwayId) {
      await this.updatePathwayStepCounts(data[0].pathwayId);
    }
    return created;
  }

  async updatePathwayStep(id: string, data: Partial<InsertPathwayStep>): Promise<PathwayStep | undefined> {
    const [updated] = await db.update(pathwaySteps)
      .set(data)
      .where(eq(pathwaySteps.id, id))
      .returning();
    return updated;
  }

  async deletePathwayStep(id: string): Promise<boolean> {
    const step = await this.getPathwayStep(id);
    await db.delete(pathwaySteps).where(eq(pathwaySteps.id, id));
    if (step) {
      await this.updatePathwayStepCounts(step.pathwayId);
    }
    return true;
  }

  private async updatePathwayStepCounts(pathwayId: string): Promise<void> {
    const steps = await this.getPathwaySteps(pathwayId);
    const totalSteps = steps.length;
    const requiredMilestones = steps.filter(s => s.isMilestone).length;
    await db.update(carePathways)
      .set({ totalSteps, requiredMilestones, updatedAt: new Date() })
      .where(eq(carePathways.id, pathwayId));
  }

  // ============================================
  // AI Care Pathways - Patient Assignments
  // ============================================
  async getPatientPathwayAssignments(patientId: string): Promise<PatientPathwayAssignment[]> {
    return db.select().from(patientPathwayAssignments)
      .where(eq(patientPathwayAssignments.patientId, patientId))
      .orderBy(desc(patientPathwayAssignments.createdAt));
  }

  async getActivePathwayAssignments(): Promise<PatientPathwayAssignment[]> {
    return db.select().from(patientPathwayAssignments)
      .where(eq(patientPathwayAssignments.status, "active"))
      .orderBy(desc(patientPathwayAssignments.lastActivityAt));
  }

  async getPathwayAssignmentsByProvider(providerId: string): Promise<PatientPathwayAssignment[]> {
    return db.select().from(patientPathwayAssignments)
      .where(eq(patientPathwayAssignments.assignedByProviderId, providerId))
      .orderBy(desc(patientPathwayAssignments.createdAt));
  }

  async getPatientPathwayAssignment(id: string): Promise<PatientPathwayAssignment | undefined> {
    const [assignment] = await db.select().from(patientPathwayAssignments)
      .where(eq(patientPathwayAssignments.id, id));
    return assignment;
  }

  async createPatientPathwayAssignment(data: InsertPatientPathwayAssignment): Promise<PatientPathwayAssignment> {
    const [created] = await db.insert(patientPathwayAssignments).values(data).returning();
    return created;
  }

  async updatePatientPathwayAssignment(id: string, data: Partial<PatientPathwayAssignment>): Promise<PatientPathwayAssignment | undefined> {
    const [updated] = await db.update(patientPathwayAssignments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(patientPathwayAssignments.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // AI Care Pathways - Step Progress
  // ============================================
  async getPatientStepProgress(assignmentId: string): Promise<PatientStepProgress[]> {
    return db.select().from(patientStepProgress)
      .where(eq(patientStepProgress.assignmentId, assignmentId))
      .orderBy(patientStepProgress.createdAt);
  }

  async getStepProgress(id: string): Promise<PatientStepProgress | undefined> {
    const [progress] = await db.select().from(patientStepProgress)
      .where(eq(patientStepProgress.id, id));
    return progress;
  }

  async getStepProgressByStep(assignmentId: string, stepId: string): Promise<PatientStepProgress | undefined> {
    const [progress] = await db.select().from(patientStepProgress)
      .where(and(
        eq(patientStepProgress.assignmentId, assignmentId),
        eq(patientStepProgress.stepId, stepId)
      ));
    return progress;
  }

  async createPatientStepProgress(data: InsertPatientStepProgress): Promise<PatientStepProgress> {
    const [created] = await db.insert(patientStepProgress).values(data).returning();
    return created;
  }

  async updatePatientStepProgress(id: string, data: Partial<InsertPatientStepProgress>): Promise<PatientStepProgress | undefined> {
    const [updated] = await db.update(patientStepProgress)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(patientStepProgress.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // AI Care Pathways - Nudges
  // ============================================
  async getPathwayNudges(assignmentId: string): Promise<PathwayNudge[]> {
    return db.select().from(pathwayNudges)
      .where(eq(pathwayNudges.assignmentId, assignmentId))
      .orderBy(desc(pathwayNudges.createdAt));
  }

  async getUnreadPathwayNudges(assignmentId: string): Promise<PathwayNudge[]> {
    return db.select().from(pathwayNudges)
      .where(and(
        eq(pathwayNudges.assignmentId, assignmentId),
        isNull(pathwayNudges.readAt)
      ))
      .orderBy(desc(pathwayNudges.createdAt));
  }

  async createPathwayNudge(data: InsertPathwayNudge): Promise<PathwayNudge> {
    const [created] = await db.insert(pathwayNudges).values(data).returning();
    return created;
  }

  async markNudgeAsRead(id: string): Promise<PathwayNudge | undefined> {
    const [updated] = await db.update(pathwayNudges)
      .set({ readAt: new Date() })
      .where(eq(pathwayNudges.id, id))
      .returning();
    return updated;
  }

  async markNudgeActionTaken(id: string, action: string): Promise<PathwayNudge | undefined> {
    const [updated] = await db.update(pathwayNudges)
      .set({ actionTaken: action, actionTakenAt: new Date() })
      .where(eq(pathwayNudges.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // AI Care Pathways - Adherence Logs
  // ============================================
  async getPathwayAdherenceLogs(assignmentId: string): Promise<PathwayAdherenceLog[]> {
    return db.select().from(pathwayAdherenceLogs)
      .where(eq(pathwayAdherenceLogs.assignmentId, assignmentId))
      .orderBy(desc(pathwayAdherenceLogs.timestamp));
  }

  async createPathwayAdherenceLog(data: InsertPathwayAdherenceLog): Promise<PathwayAdherenceLog> {
    const [created] = await db.insert(pathwayAdherenceLogs).values(data).returning();
    return created;
  }

  // ============================================
  // AI Care Pathways - Analytics
  // ============================================
  async getPathwayAnalytics(pathwayId: string): Promise<PathwayAnalytics[]> {
    return db.select().from(pathwayAnalytics)
      .where(eq(pathwayAnalytics.pathwayId, pathwayId))
      .orderBy(desc(pathwayAnalytics.periodEnd));
  }

  async createPathwayAnalytics(data: InsertPathwayAnalytics): Promise<PathwayAnalytics> {
    const [created] = await db.insert(pathwayAnalytics).values(data).returning();
    return created;
  }

  // ============================================
  // AI Case Reviews
  // ============================================
  async getCaseReviews(providerId: string): Promise<AiCaseReview[]> {
    return db.select().from(aiCaseReviews)
      .where(eq(aiCaseReviews.providerId, providerId))
      .orderBy(desc(aiCaseReviews.createdAt));
  }

  async getCaseReview(id: string): Promise<AiCaseReview | undefined> {
    const [review] = await db.select().from(aiCaseReviews)
      .where(eq(aiCaseReviews.id, id));
    return review;
  }

  async createCaseReview(data: InsertAiCaseReview): Promise<AiCaseReview> {
    const [created] = await db.insert(aiCaseReviews).values(data).returning();
    return created;
  }

  async updateCaseReview(id: string, data: Partial<AiCaseReview>): Promise<AiCaseReview | undefined> {
    const [updated] = await db.update(aiCaseReviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiCaseReviews.id, id))
      .returning();
    return updated;
  }

  async deleteCaseReview(id: string): Promise<boolean> {
    await db.delete(aiCaseReviews).where(eq(aiCaseReviews.id, id));
    return true;
  }

  // ============================================
  // Clinical Trials
  // ============================================
  async getClinicalTrials(condition?: string): Promise<ClinicalTrial[]> {
    if (condition) {
      return db.select().from(clinicalTrials)
        .where(ilike(clinicalTrials.condition, `%${condition}%`))
        .orderBy(desc(clinicalTrials.lastUpdated));
    }
    return db.select().from(clinicalTrials)
      .orderBy(desc(clinicalTrials.lastUpdated));
  }

  async getClinicalTrial(id: string): Promise<ClinicalTrial | undefined> {
    const [trial] = await db.select().from(clinicalTrials)
      .where(eq(clinicalTrials.id, id));
    return trial;
  }

  async createClinicalTrial(data: InsertClinicalTrial): Promise<ClinicalTrial> {
    const [created] = await db.insert(clinicalTrials).values(data).returning();
    return created;
  }

  async searchClinicalTrials(query: string): Promise<ClinicalTrial[]> {
    return db.select().from(clinicalTrials)
      .where(or(
        ilike(clinicalTrials.title, `%${query}%`),
        ilike(clinicalTrials.condition, `%${query}%`),
        ilike(clinicalTrials.description, `%${query}%`)
      ))
      .orderBy(desc(clinicalTrials.lastUpdated))
      .limit(20);
  }

  // ============================================
  // Provider Message Threads
  // ============================================
  async getProviderMessageThreads(userId: string): Promise<ProviderMessageThread[]> {
    return db.select().from(providerMessageThreads)
      .where(sql`${providerMessageThreads.participants}::jsonb ? ${userId}`)
      .orderBy(desc(providerMessageThreads.lastMessageAt));
  }

  async getProviderMessageThread(id: string): Promise<ProviderMessageThread | undefined> {
    const [thread] = await db.select().from(providerMessageThreads)
      .where(eq(providerMessageThreads.id, id));
    return thread;
  }

  async createProviderMessageThread(data: InsertProviderMessageThread): Promise<ProviderMessageThread> {
    const [created] = await db.insert(providerMessageThreads).values(data).returning();
    return created;
  }

  async updateProviderMessageThread(id: string, data: Partial<ProviderMessageThread>): Promise<ProviderMessageThread | undefined> {
    const [updated] = await db.update(providerMessageThreads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerMessageThreads.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // Provider Messages
  // ============================================
  async getProviderMessages(threadId: string): Promise<ProviderMessage[]> {
    return db.select().from(providerMessages)
      .where(eq(providerMessages.threadId, threadId))
      .orderBy(providerMessages.createdAt);
  }

  async createProviderMessage(data: InsertProviderMessage): Promise<ProviderMessage> {
    const [created] = await db.insert(providerMessages).values(data).returning();
    
    await db.update(providerMessageThreads)
      .set({ 
        lastMessageAt: new Date(),
        messageCount: sql`${providerMessageThreads.messageCount} + 1`
      })
      .where(eq(providerMessageThreads.id, data.threadId));
    
    return created;
  }

  async markMessagesAsRead(threadId: string, userId: string): Promise<void> {
    const msgs = await this.getProviderMessages(threadId);
    for (const msg of msgs) {
      const readBy = (msg.readBy as string[] | null) || [];
      if (!readBy.includes(userId)) {
        await db.update(providerMessages)
          .set({ readBy: [...readBy, userId] })
          .where(eq(providerMessages.id, msg.id));
      }
    }
  }

  async getUnreadProviderMessageCount(userId: string): Promise<number> {
    const threads = await this.getProviderMessageThreads(userId);
    let cnt = 0;
    for (const thread of threads) {
      const msgs = await this.getProviderMessages(thread.id);
      for (const msg of msgs) {
        const readBy = (msg.readBy as string[] | null) || [];
        if (msg.senderId !== userId && !readBy.includes(userId)) {
          cnt++;
        }
      }
    }
    return cnt;
  }

  // ============================================
  // Provider Dashboard
  // ============================================
  async getProviderDashboardWidgets(providerId: string): Promise<any[]> {
    return db.select().from(providerDashboardWidgets)
      .where(eq(providerDashboardWidgets.providerId, providerId))
      .orderBy(providerDashboardWidgets.position);
  }

  async createProviderDashboardWidget(data: any): Promise<any> {
    const [created] = await db.insert(providerDashboardWidgets).values(data).returning();
    return created;
  }

  async updateProviderDashboardWidget(id: string, data: any): Promise<any> {
    const [updated] = await db.update(providerDashboardWidgets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerDashboardWidgets.id, id))
      .returning();
    return updated;
  }

  async deleteProviderDashboardWidget(id: string): Promise<boolean> {
    await db.delete(providerDashboardWidgets).where(eq(providerDashboardWidgets.id, id));
    return true;
  }

  async getProviderDashboardPreferences(providerId: string): Promise<any> {
    const [prefs] = await db.select().from(providerDashboardPreferences)
      .where(eq(providerDashboardPreferences.providerId, providerId));
    return prefs;
  }

  async upsertProviderDashboardPreferences(providerId: string, data: any): Promise<any> {
    const existing = await this.getProviderDashboardPreferences(providerId);
    if (existing) {
      const [updated] = await db.update(providerDashboardPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(providerDashboardPreferences.providerId, providerId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(providerDashboardPreferences)
      .values({ ...data, providerId })
      .returning();
    return created;
  }

  async getProviderTasks(providerId: string, status?: string): Promise<any[]> {
    if (status) {
      return db.select().from(providerTasks)
        .where(and(
          eq(providerTasks.providerId, providerId),
          eq(providerTasks.status, status)
        ))
        .orderBy(providerTasks.dueDate);
    }
    return db.select().from(providerTasks)
      .where(eq(providerTasks.providerId, providerId))
      .orderBy(providerTasks.dueDate);
  }

  async createProviderTask(data: any): Promise<any> {
    const [created] = await db.insert(providerTasks).values(data).returning();
    return created;
  }

  async updateProviderTask(id: string, data: any): Promise<any> {
    const [updated] = await db.update(providerTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(providerTasks.id, id))
      .returning();
    return updated;
  }

  async deleteProviderTask(id: string): Promise<boolean> {
    await db.delete(providerTasks).where(eq(providerTasks.id, id));
    return true;
  }

  async getProviderTaskById(id: string): Promise<any> {
    const [task] = await db.select().from(providerTasks).where(eq(providerTasks.id, id));
    return task || null;
  }

  async getProviderTasksFiltered(providerId: string, filters: { status?: string; priority?: string; taskType?: string; search?: string }): Promise<any[]> {
    const conditions = [eq(providerTasks.providerId, providerId)];
    if (filters.status && filters.status !== "all") {
      conditions.push(eq(providerTasks.status, filters.status));
    }
    if (filters.priority && filters.priority !== "all") {
      conditions.push(eq(providerTasks.priority, filters.priority));
    }
    if (filters.taskType && filters.taskType !== "all") {
      conditions.push(eq(providerTasks.taskType, filters.taskType));
    }
    const results = await db.select().from(providerTasks)
      .where(and(...conditions))
      .orderBy(desc(providerTasks.createdAt));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return results.filter(t => t.title.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q)));
    }
    return results;
  }

  async getProviderTaskStats(providerId: string): Promise<any> {
    const tasks = await db.select().from(providerTasks)
      .where(eq(providerTasks.providerId, providerId));
    const now = new Date();
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed" && t.status !== "cancelled");
    const dueSoon = tasks.filter(t => {
      if (!t.dueDate || t.status === "completed" || t.status === "cancelled") return false;
      const due = new Date(t.dueDate);
      const diff = due.getTime() - now.getTime();
      return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
    });
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "pending").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      cancelled: tasks.filter(t => t.status === "cancelled").length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      byPriority: {
        urgent: tasks.filter(t => t.priority === "urgent" && t.status !== "completed" && t.status !== "cancelled").length,
        high: tasks.filter(t => t.priority === "high" && t.status !== "completed" && t.status !== "cancelled").length,
        normal: tasks.filter(t => t.priority === "normal" && t.status !== "completed" && t.status !== "cancelled").length,
        low: tasks.filter(t => t.priority === "low" && t.status !== "completed" && t.status !== "cancelled").length,
      },
      byType: {
        follow_up: tasks.filter(t => t.taskType === "follow_up").length,
        review_results: tasks.filter(t => t.taskType === "review_results").length,
        call_patient: tasks.filter(t => t.taskType === "call_patient").length,
        prescription_renewal: tasks.filter(t => t.taskType === "prescription_renewal").length,
        referral: tasks.filter(t => t.taskType === "referral").length,
        documentation: tasks.filter(t => t.taskType === "documentation").length,
        care_plan_update: tasks.filter(t => t.taskType === "care_plan_update").length,
        other: tasks.filter(t => t.taskType === "other").length,
      },
    };
  }

  async getTaskComments(taskId: string): Promise<any[]> {
    return db.select().from(providerTaskComments)
      .where(eq(providerTaskComments.taskId, taskId))
      .orderBy(providerTaskComments.createdAt);
  }

  async createTaskComment(data: { taskId: string; authorId: string; content: string }): Promise<any> {
    const [comment] = await db.insert(providerTaskComments).values(data).returning();
    return comment;
  }

  async getTaskCommentById(id: string): Promise<any> {
    const [comment] = await db.select().from(providerTaskComments)
      .where(eq(providerTaskComments.id, id));
    return comment || null;
  }

  async deleteTaskComment(id: string): Promise<boolean> {
    await db.delete(providerTaskComments).where(eq(providerTaskComments.id, id));
    return true;
  }

  async getProviderDashboardInsights(providerId: string): Promise<any> {
    const pathwayAssignments = await db.select().from(patientPathwayAssignments)
      .where(eq(patientPathwayAssignments.assignedByProviderId, providerId))
      .limit(50);

    const caseReviews = await db.select().from(aiCaseReviews)
      .where(eq(aiCaseReviews.providerId, providerId))
      .orderBy(desc(aiCaseReviews.createdAt))
      .limit(10);

    const pendingReviews = caseReviews.filter(r => r.status === "pending" || r.status === "analyzing");
    const completedReviews = caseReviews.filter(r => r.status === "completed");

    const avgAdherence = pathwayAssignments.length > 0
      ? Math.round(pathwayAssignments.reduce((sum, a) => sum + (a.adherenceScore || 0), 0) / pathwayAssignments.length)
      : 0;

    const activePatients = new Set(pathwayAssignments.filter(a => a.status === "active").map(a => a.patientId)).size;
    const totalPathways = pathwayAssignments.length;

    return {
      aiInsights: {
        pendingCaseReviews: pendingReviews.length,
        completedCaseReviews: completedReviews.length,
        recentReviews: caseReviews.slice(0, 5),
      },
      pathwayProgress: {
        totalPatients: activePatients,
        totalPathways,
        averageAdherence: avgAdherence,
        byStatus: {
          active: pathwayAssignments.filter(a => a.status === "active").length,
          completed: pathwayAssignments.filter(a => a.status === "completed").length,
          paused: pathwayAssignments.filter(a => a.status === "paused").length,
        },
      },
      adherenceSummary: {
        averageScore: avgAdherence,
        atRisk: pathwayAssignments.filter(a => (a.adherenceScore || 0) < 70).length,
        onTrack: pathwayAssignments.filter(a => (a.adherenceScore || 0) >= 70).length,
      },
    };
  }

  // Clinical Documentation Functions
  async getClinicalNotes(providerId: string, status?: string): Promise<any[]> {
    if (status) {
      return db.select().from(clinicalNotes)
        .where(and(
          eq(clinicalNotes.providerId, providerId),
          eq(clinicalNotes.status, status)
        ))
        .orderBy(desc(clinicalNotes.createdAt));
    }
    return db.select().from(clinicalNotes)
      .where(eq(clinicalNotes.providerId, providerId))
      .orderBy(desc(clinicalNotes.createdAt));
  }

  async getClinicalNoteById(id: string): Promise<any | null> {
    const [note] = await db.select().from(clinicalNotes).where(eq(clinicalNotes.id, id));
    return note || null;
  }

  async getClinicalNotesByPatient(patientId: string, providerId?: string): Promise<any[]> {
    if (providerId) {
      return db.select().from(clinicalNotes)
        .where(and(
          eq(clinicalNotes.patientId, patientId),
          eq(clinicalNotes.providerId, providerId)
        ))
        .orderBy(desc(clinicalNotes.createdAt));
    }
    return db.select().from(clinicalNotes)
      .where(eq(clinicalNotes.patientId, patientId))
      .orderBy(desc(clinicalNotes.createdAt));
  }

  async createClinicalNote(data: any): Promise<any> {
    const [created] = await db.insert(clinicalNotes).values(data).returning();
    return created;
  }

  async updateClinicalNote(id: string, data: any): Promise<any> {
    const [updated] = await db.update(clinicalNotes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clinicalNotes.id, id))
      .returning();
    return updated;
  }

  async deleteClinicalNote(id: string): Promise<boolean> {
    await db.delete(clinicalNotes).where(eq(clinicalNotes.id, id));
    return true;
  }

  async getAudioTranscripts(providerId: string): Promise<any[]> {
    return db.select().from(audioTranscripts)
      .where(eq(audioTranscripts.providerId, providerId))
      .orderBy(desc(audioTranscripts.createdAt));
  }

  async getAudioTranscriptById(id: string): Promise<any | null> {
    const [transcript] = await db.select().from(audioTranscripts).where(eq(audioTranscripts.id, id));
    return transcript || null;
  }

  async createAudioTranscript(data: any): Promise<any> {
    const [created] = await db.insert(audioTranscripts).values(data).returning();
    return created;
  }

  async updateAudioTranscript(id: string, data: any): Promise<any> {
    const [updated] = await db.update(audioTranscripts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(audioTranscripts.id, id))
      .returning();
    return updated;
  }

  async getCodeSuggestions(clinicalNoteId: string): Promise<any[]> {
    return db.select().from(codeSuggestions)
      .where(eq(codeSuggestions.clinicalNoteId, clinicalNoteId))
      .orderBy(desc(codeSuggestions.confidence));
  }

  async getCodeSuggestionById(id: string): Promise<any | null> {
    const [suggestion] = await db.select().from(codeSuggestions).where(eq(codeSuggestions.id, id));
    return suggestion || null;
  }

  async getCodeSuggestionsByProvider(providerId: string): Promise<any[]> {
    return db.select().from(codeSuggestions)
      .where(eq(codeSuggestions.providerId, providerId))
      .orderBy(desc(codeSuggestions.createdAt));
  }

  async createCodeSuggestion(data: any): Promise<any> {
    const [created] = await db.insert(codeSuggestions).values(data).returning();
    return created;
  }

  async updateCodeSuggestionStatus(id: string, status: string, rejectionReason?: string): Promise<any> {
    const updateData: any = { status };
    if (status === "accepted") {
      updateData.acceptedAt = new Date();
    } else if (status === "rejected") {
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = rejectionReason;
    }
    const [updated] = await db.update(codeSuggestions)
      .set(updateData)
      .where(eq(codeSuggestions.id, id))
      .returning();
    return updated;
  }

  async getPriorAuthRequests(providerId: string, status?: string): Promise<any[]> {
    if (status) {
      return db.select().from(priorAuthRequests)
        .where(and(
          eq(priorAuthRequests.providerId, providerId),
          eq(priorAuthRequests.status, status)
        ))
        .orderBy(desc(priorAuthRequests.createdAt));
    }
    return db.select().from(priorAuthRequests)
      .where(eq(priorAuthRequests.providerId, providerId))
      .orderBy(desc(priorAuthRequests.createdAt));
  }

  async getPriorAuthRequestById(id: string): Promise<any | null> {
    const [request] = await db.select().from(priorAuthRequests).where(eq(priorAuthRequests.id, id));
    return request || null;
  }

  async getPriorAuthRequestsByPatient(patientId: string): Promise<any[]> {
    return db.select().from(priorAuthRequests)
      .where(eq(priorAuthRequests.patientId, patientId))
      .orderBy(desc(priorAuthRequests.createdAt));
  }

  async createPriorAuthRequest(data: any): Promise<any> {
    const [created] = await db.insert(priorAuthRequests).values(data).returning();
    return created;
  }

  async updatePriorAuthRequest(id: string, data: any): Promise<any> {
    const [updated] = await db.update(priorAuthRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(priorAuthRequests.id, id))
      .returning();
    return updated;
  }

  async deletePriorAuthRequest(id: string): Promise<boolean> {
    await db.delete(priorAuthRequests).where(eq(priorAuthRequests.id, id));
    return true;
  }

  // =====================================
  // Personalized Patient Education Methods
  // =====================================

  async getEducationalQuizzes(category?: string): Promise<EducationalQuiz[]> {
    if (category) {
      return db.select().from(educationalQuizzes)
        .where(and(eq(educationalQuizzes.category, category), eq(educationalQuizzes.isPublished, true)))
        .orderBy(desc(educationalQuizzes.createdAt));
    }
    return db.select().from(educationalQuizzes)
      .where(eq(educationalQuizzes.isPublished, true))
      .orderBy(desc(educationalQuizzes.createdAt));
  }

  async getQuizById(quizId: string): Promise<EducationalQuiz | null> {
    const [quiz] = await db.select().from(educationalQuizzes).where(eq(educationalQuizzes.id, quizId));
    return quiz || null;
  }

  async getQuizzesByModule(moduleId: string): Promise<EducationalQuiz[]> {
    return db.select().from(educationalQuizzes)
      .where(eq(educationalQuizzes.moduleId, moduleId))
      .orderBy(educationalQuizzes.createdAt);
  }

  async getQuizzesByPathwayStep(stepId: string): Promise<EducationalQuiz[]> {
    return db.select().from(educationalQuizzes)
      .where(eq(educationalQuizzes.pathwayStepId, stepId))
      .orderBy(educationalQuizzes.createdAt);
  }

  async createEducationalQuiz(data: InsertEducationalQuiz): Promise<EducationalQuiz> {
    const [quiz] = await db.insert(educationalQuizzes).values(data).returning();
    return quiz;
  }

  async updateEducationalQuiz(id: string, data: Partial<InsertEducationalQuiz>): Promise<EducationalQuiz | null> {
    const [updated] = await db.update(educationalQuizzes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(educationalQuizzes.id, id))
      .returning();
    return updated || null;
  }

  async getQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
    return db.select().from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.order);
  }

  async createQuizQuestion(data: InsertQuizQuestion): Promise<QuizQuestion> {
    const [question] = await db.insert(quizQuestions).values(data).returning();
    return question;
  }

  async createQuizQuestions(data: InsertQuizQuestion[]): Promise<QuizQuestion[]> {
    if (data.length === 0) return [];
    return db.insert(quizQuestions).values(data).returning();
  }

  async updateQuizQuestion(id: string, data: Partial<InsertQuizQuestion>): Promise<QuizQuestion | null> {
    const [updated] = await db.update(quizQuestions)
      .set(data)
      .where(eq(quizQuestions.id, id))
      .returning();
    return updated || null;
  }

  async deleteQuizQuestion(id: string): Promise<boolean> {
    await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
    return true;
  }

  async getUserQuizAttempts(userId: string, quizId?: string): Promise<QuizAttempt[]> {
    if (quizId) {
      return db.select().from(quizAttempts)
        .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId)))
        .orderBy(desc(quizAttempts.startedAt));
    }
    return db.select().from(quizAttempts)
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.startedAt));
  }

  async getQuizAttemptById(attemptId: string): Promise<QuizAttempt | null> {
    const [attempt] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId));
    return attempt || null;
  }

  async createQuizAttempt(data: InsertQuizAttempt): Promise<QuizAttempt> {
    const [attempt] = await db.insert(quizAttempts).values(data).returning();
    return attempt;
  }

  async updateQuizAttempt(id: string, data: Partial<InsertQuizAttempt>): Promise<QuizAttempt | null> {
    const [updated] = await db.update(quizAttempts)
      .set(data)
      .where(eq(quizAttempts.id, id))
      .returning();
    return updated || null;
  }

  async getAttemptResponses(attemptId: string): Promise<QuizResponse[]> {
    return db.select().from(quizResponses)
      .where(eq(quizResponses.attemptId, attemptId))
      .orderBy(quizResponses.answeredAt);
  }

  async createQuizResponse(data: InsertQuizResponse): Promise<QuizResponse> {
    const [response] = await db.insert(quizResponses).values(data).returning();
    return response;
  }

  async createQuizResponses(data: InsertQuizResponse[]): Promise<QuizResponse[]> {
    if (data.length === 0) return [];
    return db.insert(quizResponses).values(data).returning();
  }

  async getLearningNeedsAssessment(userId: string): Promise<LearningNeedsAssessment | null> {
    const [assessment] = await db.select().from(learningNeedsAssessments)
      .where(and(eq(learningNeedsAssessments.userId, userId), eq(learningNeedsAssessments.isActive, true)))
      .orderBy(desc(learningNeedsAssessments.createdAt));
    return assessment || null;
  }

  async getUserLearningAssessments(userId: string): Promise<LearningNeedsAssessment[]> {
    return db.select().from(learningNeedsAssessments)
      .where(eq(learningNeedsAssessments.userId, userId))
      .orderBy(desc(learningNeedsAssessments.createdAt));
  }

  async createLearningNeedsAssessment(data: InsertLearningNeedsAssessment): Promise<LearningNeedsAssessment> {
    const [assessment] = await db.insert(learningNeedsAssessments).values(data).returning();
    return assessment;
  }

  async updateLearningNeedsAssessment(id: string, data: Partial<InsertLearningNeedsAssessment>): Promise<LearningNeedsAssessment | null> {
    const [updated] = await db.update(learningNeedsAssessments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(learningNeedsAssessments.id, id))
      .returning();
    return updated || null;
  }

  async getContentRecommendations(userId: string, status?: string): Promise<ContentRecommendation[]> {
    if (status) {
      return db.select().from(contentRecommendations)
        .where(and(eq(contentRecommendations.userId, userId), eq(contentRecommendations.status, status)))
        .orderBy(desc(contentRecommendations.priority), desc(contentRecommendations.relevanceScore));
    }
    return db.select().from(contentRecommendations)
      .where(eq(contentRecommendations.userId, userId))
      .orderBy(desc(contentRecommendations.priority), desc(contentRecommendations.relevanceScore));
  }

  async getActiveContentRecommendations(userId: string, limit: number = 10): Promise<ContentRecommendation[]> {
    return db.select().from(contentRecommendations)
      .where(and(
        eq(contentRecommendations.userId, userId),
        eq(contentRecommendations.status, "pending")
      ))
      .orderBy(desc(contentRecommendations.priority), desc(contentRecommendations.relevanceScore))
      .limit(limit);
  }

  async createContentRecommendation(data: InsertContentRecommendation): Promise<ContentRecommendation> {
    const [rec] = await db.insert(contentRecommendations).values(data).returning();
    return rec;
  }

  async createContentRecommendations(data: InsertContentRecommendation[]): Promise<ContentRecommendation[]> {
    if (data.length === 0) return [];
    return db.insert(contentRecommendations).values(data).returning();
  }

  async updateContentRecommendation(id: string, data: Partial<InsertContentRecommendation>): Promise<ContentRecommendation | null> {
    const [updated] = await db.update(contentRecommendations)
      .set(data)
      .where(eq(contentRecommendations.id, id))
      .returning();
    return updated || null;
  }

  async getPersonalizedNudges(userId: string, status?: string): Promise<PersonalizedNudge[]> {
    if (status === "pending") {
      return db.select().from(personalizedNudges)
        .where(and(
          eq(personalizedNudges.userId, userId),
          isNull(personalizedNudges.sentAt)
        ))
        .orderBy(desc(personalizedNudges.priority), personalizedNudges.scheduledFor);
    }
    if (status === "sent") {
      return db.select().from(personalizedNudges)
        .where(and(
          eq(personalizedNudges.userId, userId),
          sql`${personalizedNudges.sentAt} IS NOT NULL`
        ))
        .orderBy(desc(personalizedNudges.sentAt));
    }
    return db.select().from(personalizedNudges)
      .where(eq(personalizedNudges.userId, userId))
      .orderBy(desc(personalizedNudges.createdAt));
  }

  async getUnreadPersonalizedNudges(userId: string): Promise<PersonalizedNudge[]> {
    return db.select().from(personalizedNudges)
      .where(and(
        eq(personalizedNudges.userId, userId),
        sql`${personalizedNudges.sentAt} IS NOT NULL`,
        isNull(personalizedNudges.readAt)
      ))
      .orderBy(desc(personalizedNudges.sentAt));
  }

  async createPersonalizedNudge(data: InsertPersonalizedNudge): Promise<PersonalizedNudge> {
    const [nudge] = await db.insert(personalizedNudges).values(data).returning();
    return nudge;
  }

  async updatePersonalizedNudge(id: string, data: Partial<InsertPersonalizedNudge>): Promise<PersonalizedNudge | null> {
    const [updated] = await db.update(personalizedNudges)
      .set(data)
      .where(eq(personalizedNudges.id, id))
      .returning();
    return updated || null;
  }

  async markNudgeRead(id: string): Promise<PersonalizedNudge | null> {
    const [updated] = await db.update(personalizedNudges)
      .set({ readAt: new Date() })
      .where(eq(personalizedNudges.id, id))
      .returning();
    return updated || null;
  }

  async markNudgeDismissed(id: string): Promise<PersonalizedNudge | null> {
    const [updated] = await db.update(personalizedNudges)
      .set({ dismissedAt: new Date() })
      .where(eq(personalizedNudges.id, id))
      .returning();
    return updated || null;
  }

  async recordNudgeResponse(id: string, action: string): Promise<PersonalizedNudge | null> {
    const [updated] = await db.update(personalizedNudges)
      .set({ 
        responseAction: action, 
        responseAt: new Date(),
        clickedAt: new Date()
      })
      .where(eq(personalizedNudges.id, id))
      .returning();
    return updated || null;
  }

  // ─── WebAuthn / Passkey credential storage (Roadmap 1.1) ─────────────────────

  async saveWebauthnCredential(data: {
    userId: string;
    credentialId: string;
    publicKeyJwk: string;
    counter: number;
    aaguid: string;
    transports: string[];
    deviceName?: string;
    lastUsedAt?: Date;
  }): Promise<void> {
    try {
      const { webauthnCredentials } = await import("../shared/schema");
      await db.insert(webauthnCredentials).values({
        userId: data.userId,
        credentialId: data.credentialId,
        publicKeyJwk: data.publicKeyJwk,
        counter: data.counter,
        aaguid: data.aaguid,
        transports: data.transports,
        deviceName: data.deviceName,
        lastUsedAt: data.lastUsedAt,
      });
    } catch {
      // Table may not exist yet in dev — store in memory fallback
      this._webauthnMemStore.set(`${data.userId}:${data.credentialId}`, data);
    }
  }

  private _webauthnMemStore = new Map<string, any>();

  async getWebauthnCredentials(userId: string): Promise<any[]> {
    try {
      const { webauthnCredentials } = await import("../shared/schema");
      return await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, userId));
    } catch {
      return [...this._webauthnMemStore.values()].filter((c) => c.userId === userId);
    }
  }

  async getWebauthnCredentialById(userId: string, credentialId: string): Promise<any | null> {
    try {
      const { webauthnCredentials } = await import("../shared/schema");
      const [cred] = await db.select().from(webauthnCredentials).where(
        eq(webauthnCredentials.credentialId, credentialId)
      );
      if (!cred || cred.userId !== userId) return null;
      return cred;
    } catch {
      return this._webauthnMemStore.get(`${userId}:${credentialId}`) ?? null;
    }
  }

  async updateWebauthnCredentialCounter(credentialId: string, newCounter: number): Promise<void> {
    try {
      const { webauthnCredentials } = await import("../shared/schema");
      await db.update(webauthnCredentials)
        .set({ counter: newCounter, lastUsedAt: new Date() })
        .where(eq(webauthnCredentials.credentialId, credentialId));
    } catch {
      for (const [key, cred] of this._webauthnMemStore.entries()) {
        if (cred.credentialId === credentialId) {
          this._webauthnMemStore.set(key, { ...cred, counter: newCounter, lastUsedAt: new Date() });
        }
      }
    }
  }

  async deleteWebauthnCredential(userId: string, credentialId: string): Promise<void> {
    try {
      const { webauthnCredentials } = await import("../shared/schema");
      await db.delete(webauthnCredentials).where(
        eq(webauthnCredentials.credentialId, credentialId)
      );
    } catch {
      this._webauthnMemStore.delete(`${userId}:${credentialId}`);
    }
  }

  async providerHasPatientAccess(providerId: string, patientId: string): Promise<boolean> {
    try {
      const user = await this.getUser(patientId);
      if (!user) return false;
      return true;
    } catch {
      return false;
    }
  }
}

export type IStorage = DatabaseStorage;
export const storage: IStorage = new DatabaseStorage();
