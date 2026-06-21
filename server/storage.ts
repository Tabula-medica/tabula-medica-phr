import { randomUUID } from "crypto";
import {
  encryptConnectionForStorage,
  decryptConnectionFromStorage,
} from "./security/phi-encryption";
import type { 
  User, InsertUser, OnboardingStatus,
  EhrConnection, InsertEhrConnection,
  Patient, InsertPatient,
  MedicalRecord, InsertMedicalRecord,
  Medication, InsertMedication,
  VitalSign, InsertVitalSign,
  LabResult, InsertLabResult,
  Immunization, InsertImmunization,
  AdvancedHealthMetric, InsertAdvancedHealthMetric, AdvancedMetricType,
  ConditionSpecificPROM, InsertConditionSpecificPROM,
  DocumentInsight, InsertDocumentInsight,
  Allergy, InsertAllergy,
  Problem, InsertProblem,
  Appointment, InsertAppointment,
  UnifiedPatient, EhrPatientSource,
  Caregiver, InsertCaregiver,
  TwoFactorAuth, InsertTwoFactorAuth,
  UserSession, InsertUserSession,
  SecurityAuditLog, InsertSecurityAuditLog,
  SecurityNotification, InsertSecurityNotification,
  SecuritySettings, InsertSecuritySettings,
  OAuthPendingState, OAuthTokens, SmartLaunchContext,
  AssistantConversation, InsertAssistantConversation,
  AssistantMessage, InsertAssistantMessage,
  AssistantInsight, InsertAssistantInsight,
  CaregiverUpdateRequest, InsertCaregiverUpdateRequest,
  SharingRecipient, InsertSharingRecipient,
  DataSharingConsent, InsertDataSharingConsent,
  DefaultSharingPolicy, InsertDefaultSharingPolicy,
  ConsentAuditLog, InsertConsentAuditLog,
  ConsentSummary, PrivacyDashboardStats,
  DataCategory, AccessLevel,
  DeidentifiedDataset, InsertDeidentifiedDataset,
  DeidentificationAuditLog, InsertDeidentificationAuditLog,
  ResearchPreferences, InsertResearchPreferences,
  PhiIdentifier, ResearchPurpose,
  MedicationReminder, InsertMedicationReminder,
  MedicationAdherenceRecord, InsertMedicationAdherenceRecord,
  AdherenceStatistics,
  AdherenceCoachingSession, InsertAdherenceCoachingSession,
  DrugInteraction, InsertDrugInteraction,
  MedicationAIInsight, InsertMedicationAIInsight,
  HealthRiskAssessment, InsertHealthRiskAssessment,
  HealthCoachingSession, InsertHealthCoachingSession,
  PopulationHealthTrend, InsertPopulationHealthTrend,
  PersonalizedHealthInsight, InsertPersonalizedHealthInsight,
  CoachingMilestone,
  MessageThread, InsertMessageThread,
  SecureMessage, InsertSecureMessage,
  MessageAttachment, InsertMessageAttachment,
  WearableConnection, InsertWearableConnection,
  WearableDataRecord, InsertWearableDataRecord,
  WearableDataType, ExternalDataSource,
  wearablePlatformInfo, ehrPlatformInfo,
  HealthGoal, InsertHealthGoal,
  CarePlan, InsertCarePlan, CarePlanProgress, InsertCarePlanProgress,
  PlayerStats, PlayerBadge, StreakRecord, PointTransaction, MotivationalNudge,
  FamilyMedicalHistory, InsertFamilyMedicalHistory,
  LifestyleProfile, InsertLifestyleProfile,
  ExtendedAllergy, AllergyEmergencyInfo,
  Pharmacy, InsertPharmacy,
  Prescription, InsertPrescription, PrescriptionStatus,
  RefillRequest, InsertRefillRequest, RefillRequestStatus,
  PatientPharmacy, InsertPatientPharmacy,
  PrescriptionFillHistory, InsertPrescriptionFillHistory,
  PrescriptionTransferRequest, InsertPrescriptionTransferRequest, TransferRequestStatus,
  RefillStatusNotification, InsertRefillStatusNotification,
  PatientNotificationPreferences, InsertPatientNotificationPreferences,
  DrugInteractionCheckResult, InsertDrugInteractionCheck,
  PromQuestionnaire, InsertPromQuestionnaire, PromCategory, PromResponse, InsertPromResponse, PromTrend,
  PatientPromAssignment, InsertPatientPromAssignment,
  ProviderAlert, InsertProviderAlert, UpdateProviderAlert, AlertStatus,
  HealthTip, InsertHealthTip, HealthTipCategory,
  PatientHealthTip, InsertPatientHealthTip,
  PersonalizedHealthContent, PatientEngagementMetrics,
  TriageSession, InsertTriageSession,
  MedicalSummary, InsertMedicalSummary,
  PredictiveRiskForecast, InsertPredictiveRiskForecast,
  PatientRiskStratification, RecommendedIntervention,
  EducationContent, InsertEducationContent,
  EducationFAQ,
  EducationQuiz, InsertEducationQuiz,
  QuizAttempt, InsertQuizAttempt,
  LearningProgress, InsertLearningProgress,
  LearningStats, LearningStreak,
  EducationCategory,
  TelehealthSession, InsertTelehealthSession,
  ConsultationNote, InsertConsultationNote,
  SearchQuery, SearchResult, SearchFilters,
  PatientCohort, InsertCohort, CohortCriteria,
  PopulationHealthMetrics, PopulationRiskScore, RiskFactor,
  TreatmentEfficacy, AnalyticsReport, InsertReport, ReportSection,
  AtRiskPatient, AnalyticsDashboardData, RiskCategory,
  UspstfRecommendation, RecommendationCategory,
  CareGap, InsertCareGap, CareGapStatus, CareGapPriority,
  VaccinationRecord, InsertVaccination,
  ClaimsSummary, PatientPreventiveSummary,
  PatientOnboardingSession, InsertPatientOnboardingSession, OnboardingStep,
  RpmDeviceRegistration, InsertRpmDeviceRegistration,
  UploadedDocument, InsertUploadedDocument,
  PersonalHealthMetric, InsertPersonalHealthMetric, MetricGoal, InsertMetricGoal,
  SharedHealthData, InsertSharedHealthData,
  PatientHealthGoal, InsertPatientHealthGoal, PatientGoalProgress, InsertPatientGoalProgress,
  PatientGoalShare, InsertPatientGoalShare,
  InitialHealthAssessment, InsertHealthAssessment,
  EngagementMetric, InsertEngagementMetric,
  SatisfactionScore, InsertSatisfactionScore,
  SafetyIncident, InsertSafetyIncident,
  FeatureUsage, TaskSuccessMetric, ChurnPrediction,
  AnalyticsDashboardSummary,
  ExportPolicy, InsertExportPolicy, ExportRequest, ExportRequestStatus,
  ExportAuditEntry, ExportFormat, ExportDataType, UserRole,
  DataAccessPolicy, InsertDataAccessPolicy, PolicyViolation, InsertPolicyViolation,
  BreakTheGlassRecord, InsertBreakTheGlass, AccessGrant,
  DataClassificationTag, AccessContext, FhirResourceType, AccessAction,
  ConsentDocument, InsertConsentDocument, ConsentDocumentType,
  UserConsentRecord, InsertUserConsentRecord, UserConsentStatus,
  ConsentAnalyticsRecord, InsertConsentAnalyticsRecord, ConsentAnalyticsEvent,
  HealthMonitoringAlert, InsertHealthMonitoringAlert, HealthAlertStatus,
  InterventionRecommendation, InsertInterventionRecommendation, InterventionStatus,
  DocumentShare, InsertDocumentShare,
  DocumentAnnotation, InsertDocumentAnnotation,
  AnnotationReply, InsertAnnotationReply,
  CarePlanTask, InsertCarePlanTask, UpdateCarePlanTask,
  CarePlanProgressUpdate, InsertCarePlanProgressUpdate,
  CarePlanCollaborator, InsertCarePlanCollaborator,
  SharedNote, InsertSharedNote, UpdateSharedNote,
  NoteCollaborator, InsertNoteCollaborator,
  WhiteboardSession, InsertWhiteboard, UpdateWhiteboard,
  CollabMessageThread, InsertCollabMessageThread,
  ThreadParticipant, InsertThreadParticipant,
  ThreadMessage, InsertThreadMessage,
  Profile, InsertProfile, ProfileSummary, ProfileRelationshipType,
  UserActiveProfile, InsertUserActiveProfile,
  ProfileAnalyticsEvent, InsertProfileAnalyticsEvent, ProfileAnalyticsEventType,
  AuthAnalyticsEvent, InsertAuthAnalyticsEvent,
  ComplianceEvidence, InsertComplianceEvidence, ComplianceEvidenceCategory, SOC2TrustServiceCategory,
  ComplianceWeeklyReport, InsertComplianceWeeklyReport,
  RemediationWorkflow, InsertRemediationWorkflow, RemediationStatus,
  FhirApiPartner, InsertFhirApiPartner,
  FhirApiScopeGrant, InsertFhirApiScopeGrant,
  FhirApiAuditLog, InsertFhirApiAuditLog,
} from "@shared/schema";
import { defaultExportPolicies } from "@shared/schema";

// Aggregated data from all EHR sources for a unified patient
export interface AggregatedPatientData {
  unifiedPatient: UnifiedPatient;
  records: (MedicalRecord & { sourceFacility: string; sourcePlatform: string })[];
  medications: (Medication & { sourceFacility: string; sourcePlatform: string })[];
  vitals: (VitalSign & { sourceFacility: string; sourcePlatform: string })[];
  appointments: (Appointment & { sourceFacility: string; sourcePlatform: string })[];
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(userId: string, role: User["role"]): Promise<User | undefined>;
  updateUserLastLogin(userId: string): Promise<User | undefined>;
  updateUserPreferredLanguage(userId: string, languageCode: string): Promise<User | undefined>;
  updateUserProfile(userId: string, updates: Partial<Pick<User, "firstName" | "lastName" | "dateOfBirth" | "preferredLanguage">>): Promise<User | undefined>;

  // Profile Management (Family Health Records)
  getProfiles(userId: string): Promise<Profile[]>;
  getProfile(id: string): Promise<Profile | undefined>;
  getDefaultProfile(userId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | undefined>;
  deleteProfile(id: string): Promise<void>;
  getActiveProfile(userId: string): Promise<Profile | undefined>;
  setActiveProfile(userId: string, profileId: string): Promise<UserActiveProfile>;
  getProfileSummaries(userId: string): Promise<ProfileSummary[]>;
  createProfileAnalyticsEvent(event: InsertProfileAnalyticsEvent): Promise<ProfileAnalyticsEvent>;
  getProfileAnalyticsEvents(userId: string, profileId?: string): Promise<ProfileAnalyticsEvent[]>;

  // Auth Analytics Events
  createAuthAnalyticsEvent(event: InsertAuthAnalyticsEvent): Promise<AuthAnalyticsEvent>;
  getAuthAnalyticsEvents(userId?: string, eventType?: string): Promise<AuthAnalyticsEvent[]>;

  // EHR Connections
  getEhrConnections(userId?: string): Promise<EhrConnection[]>;
  getEhrConnection(id: string): Promise<EhrConnection | undefined>;
  createEhrConnection(connection: InsertEhrConnection): Promise<EhrConnection>;
  updateEhrConnection(id: string, updates: Partial<EhrConnection>): Promise<EhrConnection | undefined>;
  updateEhrConnectionTokens(id: string, tokens: OAuthTokens, smartContext?: SmartLaunchContext): Promise<EhrConnection | undefined>;
  deleteEhrConnection(id: string): Promise<void>;

  // OAuth Pending State (for PKCE flow)
  createOAuthPendingState(state: Omit<OAuthPendingState, "id" | "createdAt" | "expiresAt">): Promise<OAuthPendingState>;
  getOAuthPendingState(state: string): Promise<OAuthPendingState | undefined>;
  deleteOAuthPendingState(state: string): Promise<void>;
  cleanupExpiredOAuthStates(): Promise<void>;

  // Unified Patients (Master Patient Index)
  getUnifiedPatients(): Promise<UnifiedPatient[]>;
  getUnifiedPatient(id: string): Promise<UnifiedPatient | undefined>;
  getAggregatedPatientData(unifiedPatientId: string): Promise<AggregatedPatientData | undefined>;

  // Patients (EHR-specific records)
  getPatients(limit?: number): Promise<Patient[]>;
  getPatientsByConnection(connectionId: string): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  getPatientsByUnifiedId(unifiedPatientId: string): Promise<Patient[]>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  deletePatientsByConnection(connectionId: string): Promise<void>;

  // Medical Records
  getMedicalRecordsByPatient(patientId: string): Promise<MedicalRecord[]>;
  getMedicalRecordsByUnifiedPatient(unifiedPatientId: string): Promise<MedicalRecord[]>;
  getMedicalRecord(id: string): Promise<MedicalRecord | undefined>;
  softDeleteMedicalRecord(id: string, deletedBy: string): Promise<boolean>;
  createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord>;
  
  // Ownership-scoped medical record methods (IDOR protection)
  getMedicalRecordForUser(userId: string, id: string): Promise<MedicalRecord | undefined>;
  updateMedicalRecordForUser(userId: string, id: string, updates: Partial<MedicalRecord>): Promise<MedicalRecord | undefined>;
  deleteMedicalRecordForUser(userId: string, id: string): Promise<boolean>;
  getUserPatientIds(userId: string): Promise<string[]>;

  // Medications
  getMedicationsByPatient(patientId: string): Promise<Medication[]>;
  getMedicationsByUnifiedPatient(unifiedPatientId: string): Promise<Medication[]>;
  getMedication(id: string): Promise<Medication | undefined>;
  createMedication(medication: InsertMedication): Promise<Medication>;
  updateMedication(id: string, updates: Partial<Medication>): Promise<Medication | undefined>;

  // Vital Signs
  getVitalsByPatient(patientId: string): Promise<VitalSign[]>;
  getVitalsByUnifiedPatient(unifiedPatientId: string): Promise<VitalSign[]>;
  createVitalSign(vital: InsertVitalSign): Promise<VitalSign>;

  // Lab Results
  getLabResults(): Promise<LabResult[]>;
  getLabResultsByPatient(patientId: string): Promise<LabResult[]>;
  getLabResultsByUnifiedPatient(unifiedPatientId: string): Promise<LabResult[]>;
  createLabResult(lab: InsertLabResult): Promise<LabResult>;

  // Immunizations
  getImmunizations(patientId: string): Promise<Immunization[]>;
  getImmunization(id: string): Promise<Immunization | undefined>;
  createImmunization(immunization: InsertImmunization): Promise<Immunization>;
  updateImmunization(id: string, updates: Partial<Immunization>): Promise<Immunization | undefined>;
  deleteImmunization(id: string): Promise<void>;

  // Advanced Health Metrics
  getAdvancedHealthMetrics(patientId: string): Promise<AdvancedHealthMetric[]>;
  getAdvancedHealthMetricsByType(patientId: string, metricType: AdvancedMetricType): Promise<AdvancedHealthMetric[]>;
  getAdvancedHealthMetric(id: string): Promise<AdvancedHealthMetric | undefined>;
  createAdvancedHealthMetric(metric: InsertAdvancedHealthMetric): Promise<AdvancedHealthMetric>;
  deleteAdvancedHealthMetric(id: string): Promise<void>;

  // Condition-Specific PROMs
  getConditionSpecificPROMs(patientId: string): Promise<ConditionSpecificPROM[]>;
  getConditionSpecificPROMsByCondition(patientId: string, conditionType: string): Promise<ConditionSpecificPROM[]>;
  getConditionSpecificPROM(id: string): Promise<ConditionSpecificPROM | undefined>;
  createConditionSpecificPROM(prom: InsertConditionSpecificPROM): Promise<ConditionSpecificPROM>;
  updateConditionSpecificPROM(id: string, updates: Partial<ConditionSpecificPROM>): Promise<ConditionSpecificPROM | undefined>;

  // Document Insights
  getDocumentInsights(documentId: string): Promise<DocumentInsight | undefined>;
  getDocumentInsightsByPatient(patientId: string): Promise<DocumentInsight[]>;
  createDocumentInsight(insight: InsertDocumentInsight): Promise<DocumentInsight>;
  deleteDocumentInsight(id: string): Promise<boolean>;

  // Health Monitoring Alerts
  getHealthMonitoringAlerts(filters?: { patientId?: string; status?: string; severity?: string }): Promise<HealthMonitoringAlert[]>;
  getHealthMonitoringAlert(id: string): Promise<HealthMonitoringAlert | undefined>;
  createHealthMonitoringAlert(alert: InsertHealthMonitoringAlert): Promise<HealthMonitoringAlert>;
  updateHealthMonitoringAlert(id: string, updates: Partial<HealthMonitoringAlert>): Promise<HealthMonitoringAlert | undefined>;
  acknowledgeHealthAlert(id: string, userId: string, userName: string): Promise<HealthMonitoringAlert | undefined>;
  resolveHealthAlert(id: string, userId: string, notes: string): Promise<HealthMonitoringAlert | undefined>;
  escalateHealthAlert(id: string, escalatedTo: string): Promise<HealthMonitoringAlert | undefined>;

  // Intervention Recommendations
  getInterventionRecommendations(filters?: { patientId?: string; alertId?: string; status?: string }): Promise<InterventionRecommendation[]>;
  getInterventionRecommendation(id: string): Promise<InterventionRecommendation | undefined>;
  createInterventionRecommendation(intervention: InsertInterventionRecommendation): Promise<InterventionRecommendation>;
  updateInterventionRecommendation(id: string, updates: Partial<InterventionRecommendation>): Promise<InterventionRecommendation | undefined>;
  approveIntervention(id: string, userId: string): Promise<InterventionRecommendation | undefined>;
  completeIntervention(id: string, userId: string, notes: string): Promise<InterventionRecommendation | undefined>;

  // Allergies
  getAllergies(): Promise<Allergy[]>;
  getAllergiesByPatient(patientId: string): Promise<Allergy[]>;
  getAllergiesByUnifiedPatient(unifiedPatientId: string): Promise<Allergy[]>;
  createAllergy(allergy: InsertAllergy): Promise<Allergy>;

  // Problems (Conditions)
  getProblems(): Promise<Problem[]>;
  getProblemsByPatient(patientId: string): Promise<Problem[]>;
  getProblemsByUnifiedPatient(unifiedPatientId: string): Promise<Problem[]>;
  createProblem(problem: InsertProblem): Promise<Problem>;

  // Appointments
  getAppointments(): Promise<Appointment[]>;
  getUpcomingAppointments(): Promise<(Appointment & { patientName: string })[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;

  // Caregivers
  getCaregivers(patientUserId: string): Promise<Caregiver[]>;
  getCaregivingFor(caregiverUserId: string): Promise<(Caregiver & { patient: User | undefined })[]>;
  getCaregiver(id: string): Promise<Caregiver | undefined>;
  getCaregiverByToken(token: string): Promise<Caregiver | undefined>;
  createCaregiver(caregiver: InsertCaregiver): Promise<Caregiver>;
  updateCaregiver(id: string, updates: Partial<Caregiver>): Promise<Caregiver | undefined>;
  updateCaregiverPermissions(id: string, patientUserId: string, permissions: import("@shared/schema").UpdateCaregiverPermissions): Promise<Caregiver | undefined>;
  suspendCaregiver(id: string, patientUserId: string, reason: string): Promise<Caregiver | undefined>;
  reinstateCaregiver(id: string, patientUserId: string): Promise<Caregiver | undefined>;
  deleteCaregiver(id: string, patientUserId: string): Promise<void>;

  // Caregiver Access Logs
  getCaregiverAccessLogs(patientUserId: string, filters?: { caregiverId?: string; resourceType?: string; limit?: number }): Promise<import("@shared/schema").CaregiverAccessLog[]>;
  createCaregiverAccessLog(log: import("@shared/schema").InsertCaregiverAccessLog): Promise<import("@shared/schema").CaregiverAccessLog>;

  // Caregiver Access Requests
  getCaregiverAccessRequests(patientUserId: string, status?: string): Promise<import("@shared/schema").CaregiverAccessRequest[]>;
  getCaregiverAccessRequest(id: string): Promise<import("@shared/schema").CaregiverAccessRequest | undefined>;
  createCaregiverAccessRequest(request: import("@shared/schema").InsertCaregiverAccessRequest): Promise<import("@shared/schema").CaregiverAccessRequest>;
  reviewCaregiverAccessRequest(id: string, patientUserId: string, approved: boolean, notes?: string): Promise<import("@shared/schema").CaregiverAccessRequest | undefined>;

  // Two-Factor Authentication
  getTwoFactorAuth(userId: string): Promise<TwoFactorAuth | undefined>;
  createTwoFactorAuth(tfa: InsertTwoFactorAuth): Promise<TwoFactorAuth>;
  updateTwoFactorAuth(userId: string, updates: Partial<TwoFactorAuth>): Promise<TwoFactorAuth | undefined>;
  deleteTwoFactorAuth(userId: string): Promise<void>;

  // User Sessions
  getUserSessions(userId: string): Promise<UserSession[]>;
  getUserSession(id: string): Promise<UserSession | undefined>;
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  updateUserSession(id: string, updates: Partial<UserSession>): Promise<UserSession | undefined>;
  deleteUserSession(id: string, userId: string): Promise<void>;
  deleteAllUserSessions(userId: string, exceptSessionId?: string): Promise<void>;
  getAllSessions(): Promise<UserSession[]>;

  // Security Audit Log
  getSecurityAuditLogs(userId: string, limit?: number): Promise<SecurityAuditLog[]>;
  getAllSecurityAuditLogs(filters?: { userId?: string; profileId?: string; eventType?: string; startDate?: string; endDate?: string; limit?: number; userRole?: string; action?: string; resourceType?: string; searchQuery?: string }): Promise<SecurityAuditLog[]>;
  createSecurityAuditLog(log: InsertSecurityAuditLog): Promise<SecurityAuditLog>;

  // Security Notifications
  getSecurityNotifications(userId: string, unreadOnly?: boolean): Promise<SecurityNotification[]>;
  createSecurityNotification(notification: InsertSecurityNotification): Promise<SecurityNotification>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Security Settings
  getSecuritySettings(userId: string): Promise<SecuritySettings | undefined>;
  createOrUpdateSecuritySettings(userId: string, settings: Partial<InsertSecuritySettings>): Promise<SecuritySettings>;

  // AI Preferences
  getAIPreferences(userId: string): Promise<import("@shared/schema").AIPreferences | undefined>;
  createOrUpdateAIPreferences(userId: string, preferences: import("@shared/schema").UpdateAIPreferences): Promise<import("@shared/schema").AIPreferences>;

  // AI Medical Assistant Conversations
  getAssistantConversations(userId: string): Promise<AssistantConversation[]>;
  getAssistantConversation(id: string): Promise<AssistantConversation | undefined>;
  createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation>;
  updateAssistantConversation(id: string, updates: Partial<AssistantConversation>): Promise<AssistantConversation | undefined>;
  deleteAssistantConversation(id: string, userId: string): Promise<void>;

  // AI Medical Assistant Messages
  getAssistantMessages(conversationId: string): Promise<AssistantMessage[]>;
  createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage>;
  findDuplicateMessages(userId: string, fingerprint: string): Promise<AssistantMessage[]>;

  // AI Assistant Insights
  getAssistantInsights(userId: string): Promise<AssistantInsight[]>;
  getAssistantInsight(id: string): Promise<AssistantInsight | undefined>;
  createAssistantInsight(insight: InsertAssistantInsight): Promise<AssistantInsight>;
  deleteAssistantInsight(id: string, userId: string): Promise<void>;
  mergeConversations(targetId: string, sourceIds: string[], userId: string): Promise<AssistantConversation | undefined>;

  // Caregiver Update Requests
  getCaregiverUpdateRequests(patientUserId: string): Promise<CaregiverUpdateRequest[]>;
  getCaregiverUpdateRequestsForRecipient(recipientId: string): Promise<CaregiverUpdateRequest[]>;
  getCaregiverUpdateRequest(id: string): Promise<CaregiverUpdateRequest | undefined>;
  createCaregiverUpdateRequest(request: InsertCaregiverUpdateRequest & { aiGeneratedContext?: string }): Promise<CaregiverUpdateRequest>;
  updateCaregiverUpdateRequest(id: string, updates: Partial<CaregiverUpdateRequest>): Promise<CaregiverUpdateRequest | undefined>;

  // Care Team - get all caregivers for a patient
  getCareTeam(patientUserId: string): Promise<Caregiver[]>;

  // Privacy by Design - Sharing Recipients
  getSharingRecipients(patientUserId: string): Promise<SharingRecipient[]>;
  getSharingRecipient(id: string): Promise<SharingRecipient | undefined>;
  createSharingRecipient(recipient: InsertSharingRecipient): Promise<SharingRecipient>;
  updateSharingRecipient(id: string, updates: Partial<SharingRecipient>): Promise<SharingRecipient | undefined>;
  deleteSharingRecipient(id: string, patientUserId: string): Promise<void>;

  // Privacy by Design - Data Sharing Consents
  getDataSharingConsents(patientUserId: string): Promise<DataSharingConsent[]>;
  getDataSharingConsentsByRecipient(recipientId: string): Promise<DataSharingConsent[]>;
  getDataSharingConsent(id: string): Promise<DataSharingConsent | undefined>;
  getConsentForCategory(patientUserId: string, recipientId: string, category: DataCategory): Promise<DataSharingConsent | undefined>;
  createDataSharingConsent(consent: InsertDataSharingConsent): Promise<DataSharingConsent>;
  updateDataSharingConsent(id: string, updates: Partial<DataSharingConsent>): Promise<DataSharingConsent | undefined>;
  revokeDataSharingConsent(id: string, patientUserId: string): Promise<void>;
  bulkUpdateConsents(patientUserId: string, recipientId: string, consents: { category: DataCategory; accessLevel: AccessLevel }[]): Promise<DataSharingConsent[]>;

  // Privacy by Design - Default Sharing Policies
  getDefaultSharingPolicies(patientUserId: string): Promise<DefaultSharingPolicy[]>;
  getDefaultSharingPolicy(patientUserId: string, recipientType: string, category: DataCategory): Promise<DefaultSharingPolicy | undefined>;
  createOrUpdateDefaultPolicy(policy: InsertDefaultSharingPolicy): Promise<DefaultSharingPolicy>;

  // Privacy by Design - Consent Audit Log
  getConsentAuditLogs(patientUserId: string, limit?: number): Promise<ConsentAuditLog[]>;
  createConsentAuditLog(log: InsertConsentAuditLog): Promise<ConsentAuditLog>;

  // Privacy by Design - Dashboard Stats
  getConsentSummaries(patientUserId: string): Promise<ConsentSummary[]>;
  getPrivacyDashboardStats(patientUserId: string): Promise<PrivacyDashboardStats>;

  // Privacy by Design - Consent Check (for data access enforcement)
  checkConsent(patientUserId: string, recipientUserId: string, category: DataCategory): Promise<AccessLevel>;

  // De-identification Pipeline - Datasets
  getDeidentifiedDatasets(patientUserId: string): Promise<DeidentifiedDataset[]>;
  getDeidentifiedDatasetsByUser(patientUserId: string): Promise<DeidentifiedDataset[]>;
  getDeidentifiedDataset(id: string): Promise<DeidentifiedDataset | undefined>;
  createDeidentifiedDataset(dataset: InsertDeidentifiedDataset): Promise<DeidentifiedDataset>;
  updateDeidentifiedDataset(id: string, updates: Partial<DeidentifiedDataset>): Promise<DeidentifiedDataset | undefined>;
  deleteDeidentifiedDataset(id: string): Promise<void>;
  incrementDatasetDownloadCount(id: string): Promise<void>;

  // De-identification Pipeline - Audit Logs
  getDeidentificationAuditLogs(datasetId: string): Promise<DeidentificationAuditLog[]>;
  getDeidentificationAuditLogsByUser(patientUserId: string): Promise<DeidentificationAuditLog[]>;
  createDeidentificationAuditLog(log: InsertDeidentificationAuditLog): Promise<DeidentificationAuditLog>;

  // De-identification Pipeline - Research Preferences
  getResearchPreferences(patientUserId: string): Promise<ResearchPreferences | undefined>;
  createOrUpdateResearchPreferences(prefs: InsertResearchPreferences): Promise<ResearchPreferences>;

  // De-identification Pipeline - De-identified Data Storage
  setDeidentifiedData(datasetId: string, data: unknown[]): Promise<void>;
  getDeidentifiedData(datasetId: string): Promise<unknown[]>;

  // AI Medication Management - Reminders
  getMedicationReminders(patientId: string): Promise<MedicationReminder[]>;
  getMedicationReminder(id: string): Promise<MedicationReminder | undefined>;
  createMedicationReminder(reminder: InsertMedicationReminder): Promise<MedicationReminder>;
  updateMedicationReminder(id: string, updates: Partial<MedicationReminder>): Promise<MedicationReminder | undefined>;
  deleteMedicationReminder(id: string): Promise<void>;

  // AI Medication Management - Adherence Records
  getMedicationAdherenceRecords(patientId: string, medicationId?: string): Promise<MedicationAdherenceRecord[]>;
  createMedicationAdherenceRecord(record: InsertMedicationAdherenceRecord): Promise<MedicationAdherenceRecord>;
  getMedicationAdherenceStats(patientId: string, medicationId?: string, periodDays?: number): Promise<AdherenceStatistics>;

  // AI Medication Management - Adherence Coaching
  getAdherenceCoachingSessions(patientId: string): Promise<AdherenceCoachingSession[]>;
  getAdherenceCoachingSession(id: string): Promise<AdherenceCoachingSession | undefined>;
  createAdherenceCoachingSession(session: InsertAdherenceCoachingSession): Promise<AdherenceCoachingSession>;
  completeAdherenceCoachingSession(id: string): Promise<AdherenceCoachingSession | undefined>;

  // AI Medication Management - Drug Interactions
  getDrugInteractions(patientId: string): Promise<DrugInteraction[]>;
  getDrugInteraction(id: string): Promise<DrugInteraction | undefined>;
  createDrugInteraction(interaction: InsertDrugInteraction): Promise<DrugInteraction>;
  acknowledgeDrugInteraction(id: string, userId: string): Promise<DrugInteraction | undefined>;

  // AI Medication Management - Insights
  getMedicationAIInsights(patientId: string): Promise<MedicationAIInsight[]>;
  getMedicationAIInsight(id: string): Promise<MedicationAIInsight | undefined>;
  createMedicationAIInsight(insight: InsertMedicationAIInsight): Promise<MedicationAIInsight>;
  updateMedicationAIInsight(id: string, updates: Partial<MedicationAIInsight>): Promise<MedicationAIInsight | undefined>;
  dismissMedicationAIInsight(id: string): Promise<void>;

  // AI Health Insights - Risk Assessments
  getHealthRiskAssessments(patientId: string): Promise<HealthRiskAssessment[]>;
  getHealthRiskAssessment(id: string): Promise<HealthRiskAssessment | undefined>;
  createHealthRiskAssessment(assessment: InsertHealthRiskAssessment): Promise<HealthRiskAssessment>;
  acknowledgeHealthRiskAssessment(id: string): Promise<HealthRiskAssessment | undefined>;

  // AI Health Insights - Coaching Sessions
  getHealthCoachingSessions(patientId: string): Promise<HealthCoachingSession[]>;
  getHealthCoachingSession(id: string): Promise<HealthCoachingSession | undefined>;
  createHealthCoachingSession(session: InsertHealthCoachingSession): Promise<HealthCoachingSession>;
  updateHealthCoachingSession(id: string, updates: Partial<HealthCoachingSession>): Promise<HealthCoachingSession | undefined>;
  completeCoachingMilestone(sessionId: string, milestoneId: string): Promise<HealthCoachingSession | undefined>;

  // AI Health Insights - Population Trends
  getPopulationHealthTrends(): Promise<PopulationHealthTrend[]>;
  createPopulationHealthTrend(trend: InsertPopulationHealthTrend): Promise<PopulationHealthTrend>;

  // AI Health Insights - Personalized Insights
  getPersonalizedHealthInsights(patientId: string): Promise<PersonalizedHealthInsight[]>;
  getPersonalizedHealthInsight(id: string): Promise<PersonalizedHealthInsight | undefined>;
  createPersonalizedHealthInsight(insight: InsertPersonalizedHealthInsight): Promise<PersonalizedHealthInsight>;
  markPersonalizedInsightRead(id: string): Promise<PersonalizedHealthInsight | undefined>;
  dismissPersonalizedInsight(id: string): Promise<void>;

  // Predictive Health Analytics
  getPredictiveRiskForecasts(patientId: string): Promise<PredictiveRiskForecast[]>;
  getActiveRiskForecasts(patientId: string): Promise<PredictiveRiskForecast[]>;
  getPredictiveRiskForecast(id: string): Promise<PredictiveRiskForecast | undefined>;
  createPredictiveRiskForecast(forecast: InsertPredictiveRiskForecast & Partial<PredictiveRiskForecast>): Promise<PredictiveRiskForecast>;
  updatePredictiveRiskForecast(id: string, updates: Partial<PredictiveRiskForecast>): Promise<PredictiveRiskForecast | undefined>;
  acknowledgePredictiveRiskForecast(id: string, providerId: string): Promise<PredictiveRiskForecast | undefined>;
  getAllPatientRiskStratifications(): Promise<PatientRiskStratification[]>;
  getPatientRiskStratification(patientId: string): Promise<PatientRiskStratification | undefined>;
  getPendingForecasts(): Promise<PredictiveRiskForecast[]>;
  getUrgentInterventions(): Promise<{ patientId: string; patientName: string; intervention: RecommendedIntervention }[]>;

  // Secure Messaging - Message Threads
  getMessageThreads(patientId: string): Promise<MessageThread[]>;
  getMessageThread(id: string): Promise<MessageThread | undefined>;
  createMessageThread(thread: InsertMessageThread): Promise<MessageThread>;
  updateMessageThread(id: string, updates: Partial<MessageThread>): Promise<MessageThread | undefined>;
  archiveMessageThread(id: string): Promise<void>;
  closeMessageThread(id: string, closedBy: string): Promise<MessageThread | undefined>;

  // Secure Messaging - Messages
  getMessagesByThread(threadId: string): Promise<SecureMessage[]>;
  getSecureMessage(id: string): Promise<SecureMessage | undefined>;
  createSecureMessage(message: InsertSecureMessage): Promise<SecureMessage>;
  markMessageRead(id: string): Promise<SecureMessage | undefined>;
  markThreadMessagesRead(threadId: string, userId: string): Promise<void>;
  deleteSecureMessage(id: string): Promise<void>;

  // Secure Messaging - Attachments
  getMessageAttachments(messageId: string): Promise<MessageAttachment[]>;
  createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment>;
  deleteMessageAttachment(id: string): Promise<void>;

  // Wearable Device Connections
  getWearableConnections(userId: string): Promise<WearableConnection[]>;
  getWearableConnection(id: string): Promise<WearableConnection | undefined>;
  createWearableConnection(connection: InsertWearableConnection): Promise<WearableConnection>;
  updateWearableConnection(id: string, updates: Partial<WearableConnection>): Promise<WearableConnection | undefined>;
  deleteWearableConnection(id: string): Promise<void>;

  // Wearable Data Records
  getWearableDataRecords(userId: string, dataType?: WearableDataType, startDate?: string, endDate?: string): Promise<WearableDataRecord[]>;
  getWearableDataRecordsByConnection(connectionId: string): Promise<WearableDataRecord[]>;
  createWearableDataRecord(record: InsertWearableDataRecord): Promise<WearableDataRecord>;
  createWearableDataRecordsBatch(records: InsertWearableDataRecord[]): Promise<WearableDataRecord[]>;
  getLatestWearableData(userId: string, dataType: WearableDataType): Promise<WearableDataRecord | undefined>;

  // External Data Sources (unified view)
  getAllExternalDataSources(userId: string): Promise<ExternalDataSource[]>;

  // Health Goals
  getHealthGoals(patientId: string): Promise<HealthGoal[]>;
  getHealthGoal(id: string): Promise<HealthGoal | undefined>;
  createHealthGoal(goal: InsertHealthGoal): Promise<HealthGoal>;
  updateHealthGoal(id: string, updates: Partial<HealthGoal>, patientId: string): Promise<HealthGoal | undefined>;
  deleteHealthGoal(id: string, patientId: string): Promise<void>;

  // Care Plans
  getCarePlans(patientId: string): Promise<CarePlan[]>;
  getCarePlan(id: string): Promise<CarePlan | undefined>;
  getActiveCarePlans(patientId: string): Promise<CarePlan[]>;
  createCarePlan(plan: InsertCarePlan): Promise<CarePlan>;
  updateCarePlan(id: string, updates: Partial<CarePlan>): Promise<CarePlan | undefined>;
  deleteCarePlan(id: string): Promise<void>;
  addCarePlanProgress(carePlanId: string, progress: InsertCarePlanProgress): Promise<CarePlan | undefined>;
  updateCarePlanGoal(carePlanId: string, goalId: string, updates: Partial<CarePlan["goals"][0]>): Promise<CarePlan | undefined>;
  updateCarePlanIntervention(carePlanId: string, interventionId: string, updates: Partial<CarePlan["interventions"][0]>): Promise<CarePlan | undefined>;

  // Onboarding
  getOnboardingStatus(userId: string): Promise<OnboardingStatus | undefined>;
  updateOnboardingStatus(userId: string, status: Partial<OnboardingStatus>): Promise<OnboardingStatus>;
  completeOnboarding(userId: string, completedSteps: string[]): Promise<OnboardingStatus>;

  // Gamification
  getPlayerStats(patientId: string): Promise<PlayerStats | undefined>;
  createPlayerStats(stats: PlayerStats): Promise<PlayerStats>;
  updatePlayerStats(patientId: string, updates: Partial<PlayerStats>): Promise<PlayerStats | undefined>;
  getPlayerBadges(patientId: string): Promise<PlayerBadge[]>;
  awardBadge(badge: PlayerBadge): Promise<PlayerBadge>;
  markBadgeSeen(badgeId: string): Promise<void>;
  getStreakRecords(patientId: string): Promise<StreakRecord[]>;
  getStreakRecord(patientId: string, streakType: string): Promise<StreakRecord | undefined>;
  updateStreakRecord(streak: StreakRecord): Promise<StreakRecord>;
  getPointTransactions(patientId: string, limit?: number): Promise<PointTransaction[]>;
  addPointTransaction(transaction: PointTransaction): Promise<PointTransaction>;
  getMotivationalNudges(patientId: string): Promise<MotivationalNudge[]>;
  createNudge(nudge: MotivationalNudge): Promise<MotivationalNudge>;
  dismissNudge(nudgeId: string): Promise<void>;
  markNudgeRead(nudgeId: string): Promise<void>;
  getAllPlayerStats(): Promise<PlayerStats[]>;

  // Family Medical History
  getFamilyHistoryByPatient(patientId: string): Promise<FamilyMedicalHistory[]>;
  getFamilyHistory(id: string): Promise<FamilyMedicalHistory | undefined>;
  createFamilyHistory(history: InsertFamilyMedicalHistory): Promise<FamilyMedicalHistory>;
  updateFamilyHistory(id: string, updates: Partial<FamilyMedicalHistory>): Promise<FamilyMedicalHistory | undefined>;
  deleteFamilyHistory(id: string): Promise<void>;

  // Lifestyle Profile
  getLifestyleProfile(patientId: string): Promise<LifestyleProfile | undefined>;
  createOrUpdateLifestyleProfile(patientId: string, profile: InsertLifestyleProfile): Promise<LifestyleProfile>;

  // Extended Allergy with Emergency Info
  getExtendedAllergy(id: string): Promise<ExtendedAllergy | undefined>;
  getExtendedAllergiesByPatient(patientId: string): Promise<ExtendedAllergy[]>;
  updateAllergyEmergencyInfo(allergyId: string, emergencyInfo: AllergyEmergencyInfo): Promise<ExtendedAllergy | undefined>;

  // Prescription Management - Pharmacies
  getPharmacies(): Promise<Pharmacy[]>;
  getActivePharmacies(): Promise<Pharmacy[]>;
  getPharmacy(id: string): Promise<Pharmacy | undefined>;
  createPharmacy(pharmacy: InsertPharmacy): Promise<Pharmacy>;
  updatePharmacy(id: string, updates: Partial<Pharmacy>): Promise<Pharmacy | undefined>;
  deletePharmacy(id: string): Promise<void>;
  setPharmacyApiKey(pharmacyId: string, apiKey: string): Promise<boolean>;
  clearPharmacyApiKey(pharmacyId: string): Promise<boolean>;
  hasPharmacyApiKey(pharmacyId: string): Promise<boolean>;

  // Prescription Management - Patient Pharmacies
  getPatientPharmacies(patientId: string): Promise<PatientPharmacy[]>;
  addPatientPharmacy(patientPharmacy: InsertPatientPharmacy): Promise<PatientPharmacy>;
  removePatientPharmacy(patientId: string, pharmacyId: string): Promise<void>;
  setPatientPrimaryPharmacy(patientId: string, pharmacyId: string): Promise<PatientPharmacy | undefined>;

  // Prescription Management - Prescriptions
  getPrescriptions(patientId: string): Promise<Prescription[]>;
  getPrescription(id: string): Promise<Prescription | undefined>;
  createPrescription(prescription: InsertPrescription): Promise<Prescription>;
  updatePrescription(id: string, updates: Partial<Prescription>): Promise<Prescription | undefined>;
  cancelPrescription(id: string): Promise<Prescription | undefined>;
  getPrescriptionsByProvider(providerId: string): Promise<Prescription[]>;
  getActivePrescriptions(patientId: string): Promise<Prescription[]>;

  // Prescription Management - Refill Requests
  getRefillRequests(patientId: string): Promise<RefillRequest[]>;
  getRefillRequest(id: string): Promise<RefillRequest | undefined>;
  createRefillRequest(request: InsertRefillRequest): Promise<RefillRequest>;
  updateRefillRequest(id: string, updates: Partial<RefillRequest>): Promise<RefillRequest | undefined>;
  getRefillRequestsByStatus(status: RefillRequestStatus): Promise<RefillRequest[]>;
  getPendingRefillRequestsForProvider(): Promise<RefillRequest[]>;

  // Prescription Management - Fill History
  getPrescriptionFillHistory(prescriptionId: string): Promise<PrescriptionFillHistory[]>;
  createPrescriptionFillHistory(fill: InsertPrescriptionFillHistory): Promise<PrescriptionFillHistory>;

  // Prescription Transfer Requests
  getTransferRequests(patientId: string): Promise<PrescriptionTransferRequest[]>;
  getTransferRequest(id: string): Promise<PrescriptionTransferRequest | undefined>;
  createTransferRequest(request: InsertPrescriptionTransferRequest): Promise<PrescriptionTransferRequest>;
  updateTransferRequest(id: string, updates: Partial<PrescriptionTransferRequest>): Promise<PrescriptionTransferRequest | undefined>;
  getTransferRequestsByStatus(status: TransferRequestStatus): Promise<PrescriptionTransferRequest[]>;

  // Refill Status Notifications
  getPatientNotifications(patientId: string): Promise<RefillStatusNotification[]>;
  getUnreadNotifications(patientId: string): Promise<RefillStatusNotification[]>;
  createNotification(notification: InsertRefillStatusNotification): Promise<RefillStatusNotification>;
  markRefillNotificationRead(id: string): Promise<RefillStatusNotification | undefined>;
  markAllRefillNotificationsRead(patientId: string): Promise<void>;

  // Patient Notification Preferences
  getNotificationPreferences(patientId: string): Promise<PatientNotificationPreferences | undefined>;
  createOrUpdateNotificationPreferences(preferences: InsertPatientNotificationPreferences): Promise<PatientNotificationPreferences>;

  // Drug Interaction Checks
  getDrugInteractionChecks(patientId: string): Promise<DrugInteractionCheckResult[]>;
  getDrugInteractionCheck(id: string): Promise<DrugInteractionCheckResult | undefined>;
  createDrugInteractionCheck(check: DrugInteractionCheckResult): Promise<DrugInteractionCheckResult>;
  acknowledgeDrugInteractionCheck(id: string, providerNotes?: string): Promise<DrugInteractionCheckResult | undefined>;

  // PROM Questionnaires
  getPromQuestionnaires(): Promise<PromQuestionnaire[]>;
  getPromQuestionnaire(id: string): Promise<PromQuestionnaire | undefined>;
  getPromQuestionnairesByCategory(category: PromCategory): Promise<PromQuestionnaire[]>;
  createPromQuestionnaire(questionnaire: InsertPromQuestionnaire): Promise<PromQuestionnaire>;
  updatePromQuestionnaire(id: string, updates: Partial<PromQuestionnaire>): Promise<PromQuestionnaire | undefined>;

  // Patient PROM Assignments
  getPatientPromAssignments(patientId: string): Promise<PatientPromAssignment[]>;
  getPatientPromAssignment(id: string): Promise<PatientPromAssignment | undefined>;
  getDuePromAssignments(patientId: string): Promise<PatientPromAssignment[]>;
  createPatientPromAssignment(assignment: InsertPatientPromAssignment): Promise<PatientPromAssignment>;
  updatePatientPromAssignment(id: string, updates: Partial<PatientPromAssignment>): Promise<PatientPromAssignment | undefined>;
  deactivatePatientPromAssignment(id: string): Promise<void>;

  // PROM Responses
  getPromResponses(patientId: string): Promise<PromResponse[]>;
  getPromResponsesByQuestionnaire(patientId: string, questionnaireId: string): Promise<PromResponse[]>;
  getPromResponse(id: string): Promise<PromResponse | undefined>;
  createPromResponse(response: InsertPromResponse): Promise<PromResponse>;
  getPromTrends(patientId: string, questionnaireId?: string): Promise<PromTrend[]>;

  // Provider Alerts
  getProviderAlerts(providerId: string): Promise<ProviderAlert[]>;
  getProviderAlertsByPatient(patientId: string): Promise<ProviderAlert[]>;
  getProviderAlert(id: string): Promise<ProviderAlert | undefined>;
  createProviderAlert(alert: InsertProviderAlert): Promise<ProviderAlert>;
  updateProviderAlert(id: string, updates: UpdateProviderAlert): Promise<ProviderAlert | undefined>;
  getUnacknowledgedAlerts(providerId: string): Promise<ProviderAlert[]>;
  acknowledgeAlert(id: string, acknowledgedBy: string): Promise<ProviderAlert | undefined>;
  resolveAlert(id: string, resolvedBy: string, notes?: string): Promise<ProviderAlert | undefined>;

  // Health Tips
  getHealthTips(): Promise<HealthTip[]>;
  getHealthTipsByCategory(category: HealthTipCategory): Promise<HealthTip[]>;
  getHealthTip(id: string): Promise<HealthTip | undefined>;
  createHealthTip(tip: InsertHealthTip): Promise<HealthTip>;
  updateHealthTip(id: string, updates: Partial<HealthTip>): Promise<HealthTip | undefined>;

  // Patient Health Tips
  getPatientHealthTips(patientId: string): Promise<PatientHealthTip[]>;
  getUnreadPatientHealthTips(patientId: string): Promise<PatientHealthTip[]>;
  createPatientHealthTip(tip: InsertPatientHealthTip): Promise<PatientHealthTip>;
  markPatientHealthTipRead(id: string): Promise<PatientHealthTip | undefined>;
  bookmarkPatientHealthTip(id: string, bookmarked: boolean): Promise<PatientHealthTip | undefined>;
  ratePatientHealthTip(id: string, rating: number, comment?: string): Promise<PatientHealthTip | undefined>;

  // Personalized Health Content
  getPersonalizedHealthContent(patientId: string): Promise<PersonalizedHealthContent[]>;
  createPersonalizedHealthContent(content: PersonalizedHealthContent): Promise<PersonalizedHealthContent>;
  markPersonalizedContentRead(id: string): Promise<PersonalizedHealthContent | undefined>;
  ratePersonalizedContent(id: string, rating: number): Promise<PersonalizedHealthContent | undefined>;

  // Patient Engagement Metrics
  getPatientEngagementMetrics(patientId: string): Promise<PatientEngagementMetrics | undefined>;
  updatePatientEngagementMetrics(patientId: string, metrics: Partial<PatientEngagementMetrics>): Promise<PatientEngagementMetrics>;

  // AI Triage
  getTriageSessions(patientId: string): Promise<TriageSession[]>;
  getTriageSession(id: string): Promise<TriageSession | undefined>;
  createTriageSession(session: InsertTriageSession): Promise<TriageSession>;
  updateTriageSession(id: string, updates: Partial<TriageSession>): Promise<TriageSession | undefined>;
  getRecentTriageSessions(patientId: string, limit?: number): Promise<TriageSession[]>;

  // Medical Summaries
  getMedicalSummaries(patientId: string): Promise<MedicalSummary[]>;
  getMedicalSummary(id: string): Promise<MedicalSummary | undefined>;
  createMedicalSummary(summary: MedicalSummary): Promise<MedicalSummary>;
  getRecentMedicalSummaries(patientId: string, limit?: number): Promise<MedicalSummary[]>;

  // Education Content
  getEducationContent(patientId: string): Promise<EducationContent[]>;
  getEducationContentByCategory(patientId: string, category: EducationCategory): Promise<EducationContent[]>;
  getEducationContentItem(id: string): Promise<EducationContent | undefined>;
  createEducationContent(content: EducationContent): Promise<EducationContent>;
  deleteEducationContent(id: string): Promise<void>;

  // Education FAQs
  getEducationFAQs(patientId: string): Promise<EducationFAQ[]>;
  getEducationFAQsByCategory(patientId: string, category: EducationCategory): Promise<EducationFAQ[]>;
  createEducationFAQ(faq: EducationFAQ): Promise<EducationFAQ>;
  voteEducationFAQ(id: string, helpful: boolean): Promise<EducationFAQ | undefined>;

  // Education Quizzes
  getEducationQuizzes(patientId: string): Promise<EducationQuiz[]>;
  getEducationQuiz(id: string): Promise<EducationQuiz | undefined>;
  createEducationQuiz(quiz: EducationQuiz): Promise<EducationQuiz>;
  
  // Quiz Attempts
  getQuizAttempts(patientId: string): Promise<QuizAttempt[]>;
  getQuizAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]>;
  createQuizAttempt(attempt: QuizAttempt): Promise<QuizAttempt>;

  // Learning Progress
  getLearningProgress(patientId: string): Promise<LearningProgress[]>;
  getLearningProgressByContent(patientId: string, contentId: string): Promise<LearningProgress | undefined>;
  createLearningProgress(progress: LearningProgress): Promise<LearningProgress>;
  updateLearningProgress(id: string, updates: Partial<LearningProgress>): Promise<LearningProgress | undefined>;

  // Learning Stats
  getLearningStats(patientId: string): Promise<LearningStats | undefined>;
  getLearningStreak(patientId: string): Promise<LearningStreak | undefined>;
  updateLearningStreak(patientId: string, updates: Partial<LearningStreak>): Promise<LearningStreak>;

  // Telehealth Sessions
  getTelehealthSessions(patientId: string): Promise<TelehealthSession[]>;
  getTelehealthSessionsByProvider(providerId: string): Promise<TelehealthSession[]>;
  getTelehealthSession(id: string): Promise<TelehealthSession | undefined>;
  getTelehealthSessionByRoom(roomId: string): Promise<TelehealthSession | undefined>;
  createTelehealthSession(session: InsertTelehealthSession): Promise<TelehealthSession>;
  updateTelehealthSession(id: string, updates: Partial<TelehealthSession>): Promise<TelehealthSession | undefined>;
  getUpcomingTelehealthSessions(patientId: string): Promise<TelehealthSession[]>;
  getPendingTelehealthSessions(): Promise<TelehealthSession[]>;
  getTodayTelehealthSessions(today: string): Promise<TelehealthSession[]>;

  // Consultation Notes
  getConsultationNotes(patientId: string): Promise<ConsultationNote[]>;
  getConsultationNote(id: string): Promise<ConsultationNote | undefined>;
  getConsultationNoteBySession(sessionId: string): Promise<ConsultationNote | undefined>;
  createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote>;
  updateConsultationNote(id: string, updates: Partial<ConsultationNote>): Promise<ConsultationNote | undefined>;

  // Search
  searchPatientData(query: string, patientId?: string, filters?: SearchFilters): Promise<SearchResult[]>;
  saveSearchQuery(query: SearchQuery): Promise<SearchQuery>;
  getRecentSearches(userId: string, limit?: number): Promise<SearchQuery[]>;

  // Provider Analytics Dashboard
  getAnalyticsDashboardData(): Promise<AnalyticsDashboardData>;
  getPatientCohorts(providerId?: string): Promise<PatientCohort[]>;
  getPatientCohort(id: string): Promise<PatientCohort | undefined>;
  createPatientCohort(cohort: InsertCohort): Promise<PatientCohort>;
  updatePatientCohort(id: string, updates: Partial<PatientCohort>): Promise<PatientCohort | undefined>;
  deletePatientCohort(id: string): Promise<void>;
  getAtRiskPatients(riskLevel?: string, limit?: number): Promise<AtRiskPatient[]>;
  getPopulationHealthMetrics(periodType?: string): Promise<PopulationHealthMetrics | undefined>;
  getTreatmentEfficacyData(treatmentName?: string, cohortId?: string): Promise<TreatmentEfficacy[]>;
  getAnalyticsReports(type?: string): Promise<AnalyticsReport[]>;
  getAnalyticsReport(id: string): Promise<AnalyticsReport | undefined>;
  createAnalyticsReport(report: InsertReport): Promise<AnalyticsReport>;
  getConditionsList(): Promise<string[]>;
  getMedicationsList(): Promise<string[]>;

  // USPSTF Recommendations & Care Gaps
  getUspstfRecommendations(age?: number, gender?: string, category?: RecommendationCategory): Promise<UspstfRecommendation[]>;
  getUspstfRecommendation(id: string): Promise<UspstfRecommendation | undefined>;
  getPatientCareGaps(patientId: string, status?: CareGapStatus): Promise<CareGap[]>;
  getCareGap(id: string): Promise<CareGap | undefined>;
  createCareGap(careGap: InsertCareGap): Promise<CareGap>;
  updateCareGap(id: string, updates: Partial<CareGap>): Promise<CareGap | undefined>;
  getPatientVaccinations(patientId: string): Promise<VaccinationRecord[]>;
  createVaccination(vaccination: InsertVaccination): Promise<VaccinationRecord>;
  getPatientClaimsSummary(patientId: string): Promise<ClaimsSummary[]>;
  getPatientPreventiveSummary(patientId: string): Promise<PatientPreventiveSummary | undefined>;

  // Patient Onboarding
  getOnboardingSession(id: string): Promise<PatientOnboardingSession | undefined>;
  getOnboardingSessionByUser(userId: string): Promise<PatientOnboardingSession | undefined>;
  createOnboardingSession(session: InsertPatientOnboardingSession): Promise<PatientOnboardingSession>;
  updateOnboardingSession(id: string, updates: Partial<PatientOnboardingSession>): Promise<PatientOnboardingSession | undefined>;
  completeOnboardingSession(id: string): Promise<PatientOnboardingSession | undefined>;

  // RPM Device Registration
  getRpmDevices(sessionId: string): Promise<RpmDeviceRegistration[]>;
  getRpmDevicesByPatient(patientId: string): Promise<RpmDeviceRegistration[]>;
  getRpmDevice(id: string): Promise<RpmDeviceRegistration | undefined>;
  createRpmDevice(device: InsertRpmDeviceRegistration): Promise<RpmDeviceRegistration>;
  updateRpmDevice(id: string, updates: Partial<RpmDeviceRegistration>): Promise<RpmDeviceRegistration | undefined>;
  deleteRpmDevice(id: string): Promise<void>;

  // Uploaded Documents
  getUploadedDocuments(patientId: string): Promise<UploadedDocument[]>;
  getUploadedDocument(id: string): Promise<UploadedDocument | undefined>;
  createUploadedDocument(doc: InsertUploadedDocument): Promise<UploadedDocument>;
  updateUploadedDocument(id: string, updates: Partial<UploadedDocument>): Promise<UploadedDocument | undefined>;
  deleteUploadedDocument(id: string, patientId: string): Promise<void>;

  // Health Assessments
  getHealthAssessment(id: string): Promise<InitialHealthAssessment | undefined>;
  getHealthAssessmentBySession(sessionId: string): Promise<InitialHealthAssessment | undefined>;
  createHealthAssessment(assessment: InsertHealthAssessment): Promise<InitialHealthAssessment>;
  updateHealthAssessment(id: string, updates: Partial<InitialHealthAssessment>): Promise<InitialHealthAssessment | undefined>;

  // Personal Health Metrics
  getPersonalHealthMetrics(patientId: string, metricType?: string, startDate?: string, endDate?: string): Promise<PersonalHealthMetric[]>;
  getPersonalHealthMetric(id: string): Promise<PersonalHealthMetric | undefined>;
  createPersonalHealthMetric(metric: InsertPersonalHealthMetric): Promise<PersonalHealthMetric>;
  deletePersonalHealthMetric(id: string, patientId: string): Promise<void>;
  getMetricGoals(patientId: string): Promise<MetricGoal[]>;
  getMetricGoal(id: string): Promise<MetricGoal | undefined>;
  createMetricGoal(goal: InsertMetricGoal): Promise<MetricGoal>;
  updateMetricGoal(id: string, patientId: string, updates: Partial<MetricGoal>): Promise<MetricGoal | undefined>;
  deleteMetricGoal(id: string, patientId: string): Promise<void>;
  
  // Shared Health Data
  getSharedHealthData(patientId: string): Promise<SharedHealthData[]>;
  getSharedHealthDataByRecipient(recipientId: string): Promise<SharedHealthData[]>;
  createSharedHealthData(share: InsertSharedHealthData): Promise<SharedHealthData>;
  updateSharedHealthData(id: string, updates: Partial<SharedHealthData>): Promise<SharedHealthData | undefined>;
  revokeSharedHealthData(id: string, patientId: string): Promise<SharedHealthData | undefined>;

  // Patient Health Goals
  getPatientHealthGoals(patientId: string): Promise<PatientHealthGoal[]>;
  getPatientHealthGoal(id: string, patientId: string): Promise<PatientHealthGoal | undefined>;
  createPatientHealthGoal(patientId: string, goal: InsertPatientHealthGoal): Promise<PatientHealthGoal>;
  updatePatientHealthGoal(id: string, patientId: string, updates: Partial<PatientHealthGoal>): Promise<PatientHealthGoal | undefined>;
  deletePatientHealthGoal(id: string, patientId: string): Promise<void>;
  
  // Goal Progress
  getGoalProgress(goalId: string, patientId: string): Promise<PatientGoalProgress[]>;
  createGoalProgress(patientId: string, progress: InsertPatientGoalProgress): Promise<PatientGoalProgress | null>;
  
  // Goal Sharing
  sharePatientGoal(goalId: string, patientId: string, share: InsertPatientGoalShare): Promise<PatientGoalShare>;
  unsharePatientGoal(shareId: string, patientId: string): Promise<void>;

  // Analytics Dashboard
  getEngagementMetrics(filters?: { userId?: string; startDate?: string; endDate?: string; metricType?: string }): Promise<EngagementMetric[]>;
  createEngagementMetric(metric: InsertEngagementMetric): Promise<EngagementMetric>;
  getSatisfactionScores(filters?: { userId?: string; scoreType?: string; startDate?: string; endDate?: string }): Promise<SatisfactionScore[]>;
  createSatisfactionScore(score: InsertSatisfactionScore): Promise<SatisfactionScore>;
  getSafetyIncidents(filters?: { status?: string; severity?: string; startDate?: string; endDate?: string }): Promise<SafetyIncident[]>;
  getSafetyIncident(id: string): Promise<SafetyIncident | undefined>;
  createSafetyIncident(incident: InsertSafetyIncident): Promise<SafetyIncident>;
  updateSafetyIncident(id: string, updates: Partial<SafetyIncident>): Promise<SafetyIncident | undefined>;
  getFeatureUsageAnalytics(periodStart?: string, periodEnd?: string): Promise<FeatureUsage[]>;
  getTaskSuccessMetrics(periodStart?: string, periodEnd?: string): Promise<TaskSuccessMetric[]>;
  getChurnPredictions(riskLevel?: string): Promise<ChurnPrediction[]>;
  getAdminAnalyticsSummary(): Promise<AnalyticsDashboardSummary>;

  // Data Export Control
  getExportPolicies(): Promise<ExportPolicy[]>;
  getExportPolicy(id: string): Promise<ExportPolicy | undefined>;
  getExportPolicyForRole(role: UserRole): Promise<ExportPolicy | undefined>;
  createExportPolicy(policy: InsertExportPolicy): Promise<ExportPolicy>;
  updateExportPolicy(id: string, updates: Partial<ExportPolicy>): Promise<ExportPolicy | undefined>;
  deleteExportPolicy(id: string): Promise<void>;

  // Export Requests
  getExportRequests(filters?: { requesterId?: string; patientId?: string; status?: ExportRequestStatus }, allowUnscoped?: boolean): Promise<ExportRequest[]>;
  getExportRequest(id: string): Promise<ExportRequest | undefined>;
  createExportRequest(request: Omit<ExportRequest, "id" | "createdAt" | "updatedAt">): Promise<ExportRequest>;
  updateExportRequest(id: string, updates: Partial<ExportRequest>): Promise<ExportRequest | undefined>;
  approveExportRequest(id: string, approverId: string): Promise<ExportRequest | undefined>;
  denyExportRequest(id: string, approverId: string, reason: string): Promise<ExportRequest | undefined>;
  incrementExportDownloadCount(id: string): Promise<ExportRequest | undefined>;

  // Export Audit
  getExportAuditEntries(exportRequestId: string): Promise<ExportAuditEntry[]>;
  createExportAuditEntry(entry: Omit<ExportAuditEntry, "id" | "timestamp">): Promise<ExportAuditEntry>;
  getExportAuditReport(startDate: Date, endDate: Date): Promise<ExportAuditEntry[]>;

  // Data Access Policies (PHI/PII Controls)
  getDataAccessPolicies(filters?: { isActive?: boolean; targetRole?: UserRole }): Promise<DataAccessPolicy[]>;
  getDataAccessPolicy(id: string): Promise<DataAccessPolicy | undefined>;
  getApplicablePolicies(params: { 
    userRole: UserRole; 
    userId: string; 
    resourceType: FhirResourceType; 
    action: AccessAction;
    dataClassification?: DataClassificationTag;
  }): Promise<DataAccessPolicy[]>;
  createDataAccessPolicy(policy: InsertDataAccessPolicy): Promise<DataAccessPolicy>;
  updateDataAccessPolicy(id: string, updates: Partial<DataAccessPolicy>): Promise<DataAccessPolicy | undefined>;
  deleteDataAccessPolicy(id: string): Promise<void>;

  // Policy Violations
  getPolicyViolations(filters?: { userId?: string; policyId?: string; startDate?: string; endDate?: string }): Promise<PolicyViolation[]>;
  getPolicyViolation(id: string): Promise<PolicyViolation | undefined>;
  createPolicyViolation(violation: InsertPolicyViolation): Promise<PolicyViolation>;

  // Break-the-Glass Records
  getBreakTheGlassRecords(filters?: { userId?: string; patientId?: string; reviewStatus?: string }): Promise<BreakTheGlassRecord[]>;
  getBreakTheGlassRecord(id: string): Promise<BreakTheGlassRecord | undefined>;
  getActiveBreakTheGlass(userId: string, patientId: string): Promise<BreakTheGlassRecord | undefined>;
  createBreakTheGlassRecord(record: InsertBreakTheGlass): Promise<BreakTheGlassRecord>;
  deactivateBreakTheGlass(id: string, deactivatedBy: string): Promise<BreakTheGlassRecord | undefined>;
  reviewBreakTheGlass(id: string, reviewedBy: string, status: "approved" | "flagged" | "investigated", notes?: string): Promise<BreakTheGlassRecord | undefined>;

  // Access Grants
  getAccessGrants(filters?: { userId?: string; patientId?: string; isActive?: boolean }): Promise<AccessGrant[]>;
  getAccessGrant(id: string): Promise<AccessGrant | undefined>;
  createAccessGrant(grant: Omit<AccessGrant, "id" | "grantedAt">): Promise<AccessGrant>;
  revokeAccessGrant(id: string): Promise<AccessGrant | undefined>;

  // Consent Documents (GDPR/HIPAA Versioning)
  getConsentDocuments(filters?: { type?: ConsentDocumentType; isActive?: boolean }): Promise<ConsentDocument[]>;
  getConsentDocument(id: string): Promise<ConsentDocument | undefined>;
  getActiveConsentDocument(type: ConsentDocumentType): Promise<ConsentDocument | undefined>;
  getConsentDocumentVersions(type: ConsentDocumentType): Promise<ConsentDocument[]>;
  createConsentDocument(document: InsertConsentDocument): Promise<ConsentDocument>;
  updateConsentDocument(id: string, updates: Partial<ConsentDocument>): Promise<ConsentDocument | undefined>;
  deactivateConsentDocument(id: string): Promise<ConsentDocument | undefined>;

  // User Consent Records
  getUserConsentRecords(userId: string): Promise<UserConsentRecord[]>;
  getUserConsentRecord(id: string): Promise<UserConsentRecord | undefined>;
  getUserConsentForDocument(userId: string, documentType: ConsentDocumentType): Promise<UserConsentRecord | undefined>;
  createUserConsentRecord(record: InsertUserConsentRecord): Promise<UserConsentRecord>;
  updateUserConsentRecord(id: string, updates: Partial<UserConsentRecord>): Promise<UserConsentRecord | undefined>;
  withdrawUserConsent(id: string): Promise<UserConsentRecord | undefined>;
  getUserConsentStatus(userId: string): Promise<UserConsentStatus>;
  checkRequiredConsents(userId: string): Promise<{ allAccepted: boolean; missing: ConsentDocumentType[] }>;

  // Consent Analytics
  getConsentAnalytics(filters?: { documentType?: ConsentDocumentType; event?: ConsentAnalyticsEvent; startDate?: string; endDate?: string }): Promise<ConsentAnalyticsRecord[]>;
  createConsentAnalyticsRecord(record: InsertConsentAnalyticsRecord): Promise<ConsentAnalyticsRecord>;

  // Data Deduplication & Normalization
  getDedupGroups(userId: string, recordType?: import("@shared/schema").DedupRecordType): Promise<import("@shared/schema").DedupGroup[]>;
  getDedupGroup(id: string): Promise<import("@shared/schema").DedupGroup | undefined>;
  createDedupGroup(group: import("@shared/schema").InsertDedupGroup): Promise<import("@shared/schema").DedupGroup>;
  updateDedupGroup(id: string, updates: Partial<import("@shared/schema").DedupGroup>): Promise<import("@shared/schema").DedupGroup | undefined>;
  deleteDedupGroup(id: string): Promise<void>;

  // Dedup Conflicts
  getDedupConflicts(userId: string, status?: "pending" | "resolved" | "dismissed"): Promise<import("@shared/schema").DedupConflict[]>;
  getDedupConflictsByGroup(dedupGroupId: string): Promise<import("@shared/schema").DedupConflict[]>;
  getDedupConflict(id: string): Promise<import("@shared/schema").DedupConflict | undefined>;
  createDedupConflict(conflict: import("@shared/schema").InsertDedupConflict): Promise<import("@shared/schema").DedupConflict>;
  updateDedupConflict(id: string, updates: Partial<import("@shared/schema").DedupConflict>): Promise<import("@shared/schema").DedupConflict | undefined>;
  resolveDedupConflict(id: string, resolvedValue: string, resolvedBy: string, note?: string): Promise<import("@shared/schema").DedupConflict | undefined>;

  // Provenance Links
  getProvenanceLinksByGroup(dedupGroupId: string): Promise<import("@shared/schema").ProvenanceLink[]>;
  getProvenanceLinksByRecord(originalRecordId: string): Promise<import("@shared/schema").ProvenanceLink[]>;
  getProvenanceLink(id: string): Promise<import("@shared/schema").ProvenanceLink | undefined>;
  createProvenanceLink(link: import("@shared/schema").InsertProvenanceLink): Promise<import("@shared/schema").ProvenanceLink>;
  updateProvenanceLink(id: string, updates: Partial<import("@shared/schema").ProvenanceLink>): Promise<import("@shared/schema").ProvenanceLink | undefined>;
  deleteProvenanceLink(id: string): Promise<void>;

  // Document Sharing
  getDocumentShares(documentId: string): Promise<DocumentShare[]>;
  createDocumentShare(patientId: string, sharedById: string, data: InsertDocumentShare): Promise<DocumentShare>;
  revokeDocumentShare(shareId: string): Promise<void>;

  // Document Annotations
  getDocumentAnnotations(documentId: string): Promise<DocumentAnnotation[]>;
  createDocumentAnnotation(authorId: string, authorName: string, authorRole: string, data: InsertDocumentAnnotation): Promise<DocumentAnnotation>;
  deleteDocumentAnnotation(annotationId: string): Promise<void>;
  getAnnotationReplies(annotationId: string): Promise<AnnotationReply[]>;
  createAnnotationReply(authorId: string, authorName: string, authorRole: string, data: InsertAnnotationReply): Promise<AnnotationReply>;

  // Care Plan Tasks
  getCarePlanTasks(carePlanId: string): Promise<CarePlanTask[]>;
  createCarePlanTask(createdById: string, createdByName: string, data: InsertCarePlanTask): Promise<CarePlanTask>;
  updateCarePlanTask(taskId: string, updates: UpdateCarePlanTask): Promise<CarePlanTask | undefined>;
  deleteCarePlanTask(taskId: string): Promise<void>;

  // Care Plan Progress Updates
  getCarePlanProgressUpdates(carePlanId: string): Promise<CarePlanProgressUpdate[]>;
  createCarePlanProgressUpdate(authorId: string, authorName: string, authorRole: string, data: InsertCarePlanProgressUpdate): Promise<CarePlanProgressUpdate>;

  // Care Plan Collaborators
  getCarePlanCollaborators(carePlanId: string): Promise<CarePlanCollaborator[]>;
  addCarePlanCollaborator(addedById: string, data: InsertCarePlanCollaborator): Promise<CarePlanCollaborator>;
  removeCarePlanCollaborator(collaboratorId: string): Promise<void>;

  // Shared Notes
  getSharedNotes(patientId: string): Promise<SharedNote[]>;
  getSharedNote(noteId: string): Promise<SharedNote | undefined>;
  createSharedNote(patientId: string, createdById: string, createdByName: string, data: InsertSharedNote): Promise<SharedNote>;
  updateSharedNote(noteId: string, editorId: string, editorName: string, updates: UpdateSharedNote): Promise<SharedNote | undefined>;
  deleteSharedNote(noteId: string): Promise<void>;

  // Note Collaborators
  getNoteCollaborators(noteId: string): Promise<NoteCollaborator[]>;
  addNoteCollaborator(data: InsertNoteCollaborator): Promise<NoteCollaborator>;
  removeNoteCollaborator(collaboratorId: string): Promise<void>;

  // Whiteboard Sessions
  getWhiteboards(patientId: string): Promise<WhiteboardSession[]>;
  getWhiteboard(whiteboardId: string): Promise<WhiteboardSession | undefined>;
  createWhiteboard(patientId: string, createdById: string, createdByName: string, data: InsertWhiteboard): Promise<WhiteboardSession>;
  updateWhiteboard(whiteboardId: string, updates: UpdateWhiteboard): Promise<WhiteboardSession | undefined>;
  deleteWhiteboard(whiteboardId: string): Promise<void>;

  // Group Message Threads (Collaboration)
  getCollabMessageThreads(patientId: string): Promise<CollabMessageThread[]>;
  getCollabMessageThread(threadId: string): Promise<CollabMessageThread | undefined>;
  createCollabMessageThread(patientId: string, createdById: string, createdByName: string, data: InsertCollabMessageThread): Promise<CollabMessageThread>;

  // Thread Participants
  getThreadParticipants(threadId: string): Promise<ThreadParticipant[]>;
  addThreadParticipant(data: InsertThreadParticipant): Promise<ThreadParticipant>;
  removeThreadParticipant(participantId: string): Promise<void>;
  updateParticipantLastRead(participantId: string): Promise<void>;

  // Thread Messages
  getThreadMessages(threadId: string): Promise<ThreadMessage[]>;
  createThreadMessage(senderId: string, senderName: string, senderRole: string, data: InsertThreadMessage): Promise<ThreadMessage>;

  // SOC 2 Compliance Evidence
  getComplianceEvidence(filters?: { category?: ComplianceEvidenceCategory; soc2Category?: SOC2TrustServiceCategory; status?: string; limit?: number; offset?: number }): Promise<ComplianceEvidence[]>;
  getComplianceEvidenceById(id: string): Promise<ComplianceEvidence | undefined>;
  createComplianceEvidence(evidence: InsertComplianceEvidence): Promise<ComplianceEvidence>;
  updateComplianceEvidence(id: string, updates: Partial<ComplianceEvidence>): Promise<ComplianceEvidence | undefined>;
  deleteComplianceEvidence(id: string): Promise<void>;
  getComplianceEvidenceStats(): Promise<{ total: number; byCategory: Record<string, number>; bySoc2Category: Record<string, number>; byStatus: Record<string, number> }>;

  // Compliance Weekly Reports
  getComplianceWeeklyReports(limit?: number): Promise<ComplianceWeeklyReport[]>;
  getComplianceWeeklyReportById(id: string): Promise<ComplianceWeeklyReport | undefined>;
  createComplianceWeeklyReport(report: InsertComplianceWeeklyReport): Promise<ComplianceWeeklyReport>;
  updateComplianceWeeklyReport(id: string, updates: Partial<ComplianceWeeklyReport>): Promise<ComplianceWeeklyReport | undefined>;
  getLatestComplianceWeeklyReport(): Promise<ComplianceWeeklyReport | undefined>;

  // SOC 2 Automated Remediation Workflows
  getRemediationWorkflows(filters?: { status?: RemediationStatus; severity?: string; triggerType?: string; limit?: number }): Promise<RemediationWorkflow[]>;
  getRemediationWorkflow(id: string): Promise<RemediationWorkflow | undefined>;
  createRemediationWorkflow(workflow: InsertRemediationWorkflow): Promise<RemediationWorkflow>;
  updateRemediationWorkflow(id: string, updates: Partial<RemediationWorkflow>): Promise<RemediationWorkflow | undefined>;
  getRemediationStats(): Promise<{ total: number; byStatus: Record<string, number>; bySeverity: Record<string, number>; byTriggerType: Record<string, number>; activeCount: number; resolvedCount: number }>;

  // FHIR API Data Hub - Partners
  getFhirApiPartners(): Promise<FhirApiPartner[]>;
  getFhirApiPartner(id: string): Promise<FhirApiPartner | undefined>;
  getFhirApiPartnerByKeyHash(apiKeyHash: string): Promise<FhirApiPartner | undefined>;
  createFhirApiPartner(partner: InsertFhirApiPartner): Promise<FhirApiPartner>;
  updateFhirApiPartner(id: string, updates: Partial<FhirApiPartner>): Promise<FhirApiPartner | undefined>;
  deleteFhirApiPartner(id: string): Promise<void>;

  // FHIR API Data Hub - Scope Grants
  getFhirApiScopeGrants(patientUserId: string): Promise<FhirApiScopeGrant[]>;
  getFhirApiScopeGrantsByPartner(partnerId: string): Promise<FhirApiScopeGrant[]>;
  getFhirApiScopeGrantsForPatientAndPartner(patientUserId: string, partnerId: string): Promise<FhirApiScopeGrant[]>;
  createFhirApiScopeGrant(grant: InsertFhirApiScopeGrant): Promise<FhirApiScopeGrant>;
  updateFhirApiScopeGrant(id: string, updates: Partial<FhirApiScopeGrant>): Promise<FhirApiScopeGrant | undefined>;
  bulkUpdateFhirApiScopeGrants(patientUserId: string, partnerId: string, scopes: { scope: string; granted: boolean }[]): Promise<FhirApiScopeGrant[]>;

  // FHIR API Data Hub - Audit Logs
  getFhirApiAuditLogs(filters?: { partnerId?: string; patientEmail?: string; action?: string; limit?: number; offset?: number }): Promise<FhirApiAuditLog[]>;
  createFhirApiAuditLog(log: InsertFhirApiAuditLog): Promise<FhirApiAuditLog>;
  getFhirApiAuditStats(): Promise<{ total: number; byPartner: Record<string, number>; byAction: Record<string, number>; byStatusCode: Record<string, number> }>;

  // AI Admin Automation - Provider-Patient Authorization
  isProviderAuthorizedForPatient(providerUserId: string, patientId: string): Promise<boolean>;
  authorizeProviderForPatient(providerUserId: string, patientId: string): Promise<void>;
  revokeProviderPatientAuthorization(providerUserId: string, patientId: string): Promise<void>;
  getAuthorizedPatientsForProvider(providerUserId: string): Promise<string[]>;

  // AI Admin Automation - Request Ownership
  recordAiAdminRequestOwner(requestId: string, ownerUserId: string): Promise<void>;
  isAiAdminRequestOwner(requestId: string, userId: string): Promise<boolean>;

  // AI Admin Automation - Rate Limiting
  checkAndIncrementAiAdminRateLimit(userId: string, maxRequests: number, windowMs: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private ehrConnections: Map<string, EhrConnection> = new Map();
  private oauthPendingStates: Map<string, OAuthPendingState> = new Map();
  private caregivers: Map<string, Caregiver> = new Map();
  private caregiverAccessLogs: Map<string, import("@shared/schema").CaregiverAccessLog> = new Map();
  private caregiverAccessRequests: Map<string, import("@shared/schema").CaregiverAccessRequest> = new Map();
  private twoFactorAuths: Map<string, TwoFactorAuth> = new Map();
  private userSessions: Map<string, UserSession> = new Map();
  private securityAuditLogs: Map<string, SecurityAuditLog> = new Map();
  private securityNotifications: Map<string, SecurityNotification> = new Map();
  private securitySettings: Map<string, SecuritySettings> = new Map();
  private aiPreferences: Map<string, import("@shared/schema").AIPreferences> = new Map();
  private unifiedPatients: Map<string, UnifiedPatient> = new Map();
  private patients: Map<string, Patient> = new Map();
  private medicalRecords: Map<string, MedicalRecord> = new Map();
  private medications: Map<string, Medication> = new Map();
  private vitals: Map<string, VitalSign> = new Map();
  private labResults: Map<string, LabResult> = new Map();
  private immunizations: Map<string, Immunization> = new Map();
  private advancedHealthMetrics: Map<string, AdvancedHealthMetric> = new Map();
  private conditionSpecificPROMs: Map<string, ConditionSpecificPROM> = new Map();
  private documentInsights: Map<string, DocumentInsight> = new Map();
  private healthMonitoringAlerts: Map<string, HealthMonitoringAlert> = new Map();
  private interventionRecommendations: Map<string, InterventionRecommendation> = new Map();
  private allergies: Map<string, Allergy> = new Map();
  private problems: Map<string, Problem> = new Map();
  private appointments: Map<string, Appointment> = new Map();
  private providerPatientAuthorizations: Map<string, Set<string>> = new Map();
  private aiAdminRequestOwners: Map<string, string> = new Map();
  private aiAdminRateLimits: Map<string, { count: number; resetAt: number }> = new Map();
  private assistantConversations: Map<string, AssistantConversation> = new Map();
  private assistantMessages: Map<string, AssistantMessage> = new Map();
  private assistantInsights: Map<string, AssistantInsight> = new Map();
  private caregiverUpdateRequests: Map<string, CaregiverUpdateRequest> = new Map();
  private sharingRecipients: Map<string, SharingRecipient> = new Map();
  private dataSharingConsents: Map<string, DataSharingConsent> = new Map();
  private defaultSharingPolicies: Map<string, DefaultSharingPolicy> = new Map();
  private consentAuditLogs: Map<string, ConsentAuditLog> = new Map();
  private deidentifiedDatasets: Map<string, DeidentifiedDataset> = new Map();
  private deidentificationAuditLogs: Map<string, DeidentificationAuditLog> = new Map();
  private researchPreferences: Map<string, ResearchPreferences> = new Map();
  private deidentifiedData: Map<string, unknown[]> = new Map();
  private medicationReminders: Map<string, MedicationReminder> = new Map();
  private medicationAdherenceRecords: Map<string, MedicationAdherenceRecord> = new Map();
  private adherenceCoachingSessions: Map<string, AdherenceCoachingSession> = new Map();
  private drugInteractions: Map<string, DrugInteraction> = new Map();
  private medicationAIInsights: Map<string, MedicationAIInsight> = new Map();
  private healthRiskAssessments: Map<string, HealthRiskAssessment> = new Map();
  private healthCoachingSessions: Map<string, HealthCoachingSession> = new Map();
  private populationHealthTrends: Map<string, PopulationHealthTrend> = new Map();
  private personalizedHealthInsights: Map<string, PersonalizedHealthInsight> = new Map();
  private messageThreads: Map<string, MessageThread> = new Map();
  private secureMessages: Map<string, SecureMessage> = new Map();
  private messageAttachments: Map<string, MessageAttachment> = new Map();
  private wearableConnections: Map<string, WearableConnection> = new Map();
  private wearableDataRecords: Map<string, WearableDataRecord> = new Map();
  private healthGoals: Map<string, HealthGoal> = new Map();
  private carePlans: Map<string, CarePlan> = new Map();
  private onboardingStatuses: Map<string, OnboardingStatus> = new Map();
  private playerStats: Map<string, PlayerStats> = new Map();
  private playerBadges: Map<string, PlayerBadge> = new Map();
  private streakRecords: Map<string, StreakRecord> = new Map();
  private pointTransactions: Map<string, PointTransaction> = new Map();
  private motivationalNudges: Map<string, MotivationalNudge> = new Map();
  private familyMedicalHistories: Map<string, FamilyMedicalHistory> = new Map();
  private lifestyleProfiles: Map<string, LifestyleProfile> = new Map();
  private allergyEmergencyInfo: Map<string, AllergyEmergencyInfo> = new Map();
  private pharmacies: Map<string, Pharmacy> = new Map();
  private patientPharmacies: Map<string, PatientPharmacy> = new Map();
  private prescriptions: Map<string, Prescription> = new Map();
  private refillRequests: Map<string, RefillRequest> = new Map();
  private prescriptionFillHistory: Map<string, PrescriptionFillHistory> = new Map();
  private prescriptionTransferRequests: Map<string, PrescriptionTransferRequest> = new Map();
  private refillStatusNotifications: Map<string, RefillStatusNotification> = new Map();
  private patientNotificationPreferences: Map<string, PatientNotificationPreferences> = new Map();
  private drugInteractionChecks: Map<string, DrugInteractionCheckResult> = new Map();
  private promQuestionnaires: Map<string, PromQuestionnaire> = new Map();
  private patientPromAssignments: Map<string, PatientPromAssignment> = new Map();
  private promResponses: Map<string, PromResponse> = new Map();
  private providerAlerts: Map<string, ProviderAlert> = new Map();
  private healthTips: Map<string, HealthTip> = new Map();
  private patientHealthTips: Map<string, PatientHealthTip> = new Map();
  private personalizedHealthContents: Map<string, PersonalizedHealthContent> = new Map();
  private patientEngagementMetrics: Map<string, PatientEngagementMetrics> = new Map();
  private pharmacyApiKeys: Map<string, string> = new Map();
  private triageSessions: Map<string, TriageSession> = new Map();
  private medicalSummaries: Map<string, MedicalSummary> = new Map();
  private predictiveRiskForecasts: Map<string, PredictiveRiskForecast> = new Map();
  private educationContent: Map<string, EducationContent> = new Map();
  private educationFAQs: Map<string, EducationFAQ> = new Map();
  private educationQuizzes: Map<string, EducationQuiz> = new Map();
  private quizAttempts: Map<string, QuizAttempt> = new Map();
  private learningProgress: Map<string, LearningProgress> = new Map();
  private learningStreaks: Map<string, LearningStreak> = new Map();
  private telehealthSessions: Map<string, TelehealthSession> = new Map();
  private consultationNotes: Map<string, ConsultationNote> = new Map();
  private searchQueries: Map<string, SearchQuery> = new Map();
  private patientCohorts: Map<string, PatientCohort> = new Map();
  private populationRiskScores: Map<string, PopulationRiskScore> = new Map();
  private treatmentEfficacyRecords: Map<string, TreatmentEfficacy> = new Map();
  private analyticsReports: Map<string, AnalyticsReport> = new Map();
  private uspstfRecommendations: Map<string, UspstfRecommendation> = new Map();
  private careGaps: Map<string, CareGap> = new Map();
  private vaccinations: Map<string, VaccinationRecord> = new Map();
  private claimsSummaries: Map<string, ClaimsSummary> = new Map();
  private onboardingSessions: Map<string, PatientOnboardingSession> = new Map();
  private rpmDevices: Map<string, RpmDeviceRegistration> = new Map();
  private uploadedDocuments: Map<string, UploadedDocument> = new Map();
  private personalHealthMetrics: Map<string, PersonalHealthMetric> = new Map();
  private metricGoals: Map<string, MetricGoal> = new Map();
  private sharedHealthData: Map<string, SharedHealthData> = new Map();
  private patientHealthGoals: Map<string, PatientHealthGoal> = new Map();
  private patientGoalProgress: Map<string, PatientGoalProgress> = new Map();
  private healthAssessments: Map<string, InitialHealthAssessment> = new Map();
  private engagementMetrics: Map<string, EngagementMetric> = new Map();
  private satisfactionScores: Map<string, SatisfactionScore> = new Map();
  private safetyIncidents: Map<string, SafetyIncident> = new Map();
  private featureUsageData: Map<string, FeatureUsage> = new Map();
  private taskSuccessData: Map<string, TaskSuccessMetric> = new Map();
  private churnPredictions: Map<string, ChurnPrediction> = new Map();
  private exportPolicies: Map<string, ExportPolicy> = new Map();
  private exportRequests: Map<string, ExportRequest> = new Map();
  private exportAuditEntries: Map<string, ExportAuditEntry> = new Map();
  
  // Data Access Policy (PHI/PII Controls)
  private dataAccessPolicies: Map<string, DataAccessPolicy> = new Map();
  private policyViolations: Map<string, PolicyViolation> = new Map();
  private breakTheGlassRecords: Map<string, BreakTheGlassRecord> = new Map();
  private accessGrants: Map<string, AccessGrant> = new Map();
  
  // Consent Documents & User Consent Records (GDPR/HIPAA)
  private consentDocuments: Map<string, ConsentDocument> = new Map();
  private userConsentRecords: Map<string, UserConsentRecord> = new Map();
  private consentAnalyticsRecords: Map<string, ConsentAnalyticsRecord> = new Map();
  
  // Data Deduplication & Normalization
  private dedupGroups: Map<string, import("@shared/schema").DedupGroup> = new Map();
  private dedupConflicts: Map<string, import("@shared/schema").DedupConflict> = new Map();
  private provenanceLinks: Map<string, import("@shared/schema").ProvenanceLink> = new Map();
  
  // Profile Management (Family Health Records)
  private profiles: Map<string, Profile> = new Map();
  private userActiveProfiles: Map<string, UserActiveProfile> = new Map();
  private profileAnalyticsEvents: Map<string, ProfileAnalyticsEvent> = new Map();
  private authAnalyticsEvents: Map<string, AuthAnalyticsEvent> = new Map();
  
  // Collaboration features
  private documentShares: Map<string, DocumentShare> = new Map();
  private documentAnnotations: Map<string, DocumentAnnotation> = new Map();
  private annotationReplies: Map<string, AnnotationReply> = new Map();
  private carePlanTasks: Map<string, CarePlanTask> = new Map();
  private carePlanProgressUpdates: Map<string, CarePlanProgressUpdate> = new Map();
  private carePlanCollaborators: Map<string, CarePlanCollaborator> = new Map();
  private sharedNotes: Map<string, SharedNote> = new Map();
  private noteCollaborators: Map<string, NoteCollaborator> = new Map();
  private whiteboardSessions: Map<string, WhiteboardSession> = new Map();
  private collabMessageThreads: Map<string, CollabMessageThread> = new Map();
  private threadParticipants: Map<string, ThreadParticipant> = new Map();
  private threadMessages: Map<string, ThreadMessage> = new Map();

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this.seedData();
    }
  }

  private seedData() {
    // Sample user ID for sample data
    const sampleUserId = "current-user";
    
    // Seed EHR connections with FHIR configuration
    const epicConnection: EhrConnection = {
      id: randomUUID(),
      userId: sampleUserId,
      platform: "fastenhealth",
      facilityName: "Metro General Hospital",
      status: "connected",
      lastSync: new Date().toISOString(),
      patientCount: 3,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    };
    this.ehrConnections.set(epicConnection.id, epicConnection);

    const cernerConnection: EhrConnection = {
      id: randomUUID(),
      userId: sampleUserId,
      platform: "fastenhealth",
      facilityName: "Downtown Medical Center",
      status: "connected",
      lastSync: new Date(Date.now() - 86400000).toISOString(),
      patientCount: 3,
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    };
    this.ehrConnections.set(cernerConnection.id, cernerConnection);

    const allscriptsConnection: EhrConnection = {
      id: randomUUID(),
      userId: sampleUserId,
      platform: "fastenhealth",
      facilityName: "Springfield Urgent Care",
      status: "connected",
      lastSync: new Date(Date.now() - 2 * 86400000).toISOString(),
      patientCount: 2,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    };
    this.ehrConnections.set(allscriptsConnection.id, allscriptsConnection);

    // Create unified patients (Master Patient Index)
    // Sarah Johnson exists in Fasten Health and Cerner - demonstrating cross-platform matching
    const sarahUnifiedId = randomUUID();
    const jamesUnifiedId = randomUUID();
    const emilyUnifiedId = randomUUID();
    const robertUnifiedId = randomUUID();

    // Patient records from different EHR systems
    // Sarah Johnson - exists in BOTH Fasten Health and Cerner (same person, different facilities)
    const sarahEpic: Patient = {
      id: randomUUID(),
      unifiedPatientId: sarahUnifiedId,
      ehrConnectionId: epicConnection.id,
      mrn: "EPIC-001234",
      firstName: "Sarah",
      middleName: "Marie",
      lastName: "Johnson",
      dateOfBirth: "1985-03-15",
      gender: "female",
      email: "sarah.johnson@email.com",
      phone: "(555) 123-4567",
      address: "123 Oak Street, Springfield, IL 62701",
      insuranceProvider: "Blue Cross Blue Shield",
      insuranceId: "BCBS-789456",
      primaryPhysician: "Dr. Michael Chen",
    };
    this.patients.set(sarahEpic.id, sarahEpic);

    const sarahCerner: Patient = {
      id: randomUUID(),
      unifiedPatientId: sarahUnifiedId,
      ehrConnectionId: cernerConnection.id,
      mrn: "CERN-5678",
      firstName: "Sarah",
      middleName: "Marie",
      lastName: "Johnson",
      dateOfBirth: "1985-03-15",
      gender: "female",
      email: "sarah.johnson@email.com",
      phone: "(555) 123-4567",
      address: "123 Oak Street, Springfield, IL 62701",
      insuranceProvider: "Blue Cross Blue Shield",
      insuranceId: "BCBS-789456",
      primaryPhysician: "Dr. Jennifer Lee",
    };
    this.patients.set(sarahCerner.id, sarahCerner);

    // Create unified patient for Sarah with sources from both platforms
    const sarahUnified: UnifiedPatient = {
      id: sarahUnifiedId,
      firstName: "Sarah",
      middleName: "Marie",
      lastName: "Johnson",
      dateOfBirth: "1985-03-15",
      gender: "female",
      email: "sarah.johnson@email.com",
      phone: "(555) 123-4567",
      address: "123 Oak Street, Springfield, IL 62701",
      primaryInsurance: "Blue Cross Blue Shield",
      primaryPhysician: "Dr. Michael Chen",
      ehrSources: [
        {
          ehrConnectionId: epicConnection.id,
          platform: "fastenhealth",
          facilityName: "Metro General Hospital",
          mrn: "EPIC-001234",
          patientId: sarahEpic.id,
          lastSync: new Date().toISOString(),
        },
        {
          ehrConnectionId: cernerConnection.id,
          platform: "fastenhealth",
          facilityName: "Downtown Medical Center",
          mrn: "CERN-5678",
          patientId: sarahCerner.id,
          lastSync: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
      matchConfidence: "high",
      createdAt: new Date().toISOString(),
    };
    this.unifiedPatients.set(sarahUnifiedId, sarahUnified);

    // James Williams - exists in Fasten Health and Healthcare Provider
    const jamesEpic: Patient = {
      id: randomUUID(),
      unifiedPatientId: jamesUnifiedId,
      ehrConnectionId: epicConnection.id,
      mrn: "EPIC-001235",
      firstName: "James",
      middleName: "Edward",
      lastName: "Williams",
      dateOfBirth: "1972-08-22",
      gender: "male",
      email: "j.williams@email.com",
      phone: "(555) 234-5678",
      address: "456 Maple Avenue, Springfield, IL 62702",
      insuranceProvider: "Aetna",
      insuranceId: "AET-123789",
      primaryPhysician: "Dr. Sarah Martinez",
    };
    this.patients.set(jamesEpic.id, jamesEpic);

    const jamesSecondaryProvider: Patient = {
      id: randomUUID(),
      unifiedPatientId: jamesUnifiedId,
      ehrConnectionId: allscriptsConnection.id,
      mrn: "AS-9912",
      firstName: "James",
      middleName: "Edward",
      lastName: "Williams",
      dateOfBirth: "1972-08-22",
      gender: "male",
      email: "j.williams@email.com",
      phone: "(555) 234-5678",
      address: "456 Maple Avenue, Springfield, IL 62702",
      insuranceProvider: "Aetna",
      insuranceId: "AET-123789",
      primaryPhysician: "Dr. Robert Kim",
    };
    this.patients.set(jamesSecondaryProvider.id, jamesSecondaryProvider);

    const jamesUnified: UnifiedPatient = {
      id: jamesUnifiedId,
      firstName: "James",
      middleName: "Edward",
      lastName: "Williams",
      dateOfBirth: "1972-08-22",
      gender: "male",
      email: "j.williams@email.com",
      phone: "(555) 234-5678",
      address: "456 Maple Avenue, Springfield, IL 62702",
      primaryInsurance: "Aetna",
      primaryPhysician: "Dr. Sarah Martinez",
      ehrSources: [
        {
          ehrConnectionId: epicConnection.id,
          platform: "fastenhealth",
          facilityName: "Metro General Hospital",
          mrn: "EPIC-001235",
          patientId: jamesEpic.id,
          lastSync: new Date().toISOString(),
        },
        {
          ehrConnectionId: allscriptsConnection.id,
          platform: "fastenhealth",
          facilityName: "Springfield Urgent Care",
          mrn: "AS-9912",
          patientId: jamesSecondaryProvider.id,
          lastSync: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      ],
      matchConfidence: "high",
      createdAt: new Date().toISOString(),
    };
    this.unifiedPatients.set(jamesUnifiedId, jamesUnified);

    // Emily Brown - only in Fasten Health (single source)
    const emilyEpic: Patient = {
      id: randomUUID(),
      unifiedPatientId: emilyUnifiedId,
      ehrConnectionId: epicConnection.id,
      mrn: "EPIC-001236",
      firstName: "Emily",
      middleName: "Rose",
      lastName: "Brown",
      dateOfBirth: "1990-12-05",
      gender: "female",
      email: "emily.brown@email.com",
      phone: "(555) 345-6789",
      address: "789 Pine Road, Springfield, IL 62703",
      insuranceProvider: "UnitedHealthcare",
      insuranceId: "UHC-456123",
      primaryPhysician: "Dr. Michael Chen",
    };
    this.patients.set(emilyEpic.id, emilyEpic);

    const emilyUnified: UnifiedPatient = {
      id: emilyUnifiedId,
      firstName: "Emily",
      middleName: "Rose",
      lastName: "Brown",
      dateOfBirth: "1990-12-05",
      gender: "female",
      email: "emily.brown@email.com",
      phone: "(555) 345-6789",
      address: "789 Pine Road, Springfield, IL 62703",
      primaryInsurance: "UnitedHealthcare",
      primaryPhysician: "Dr. Michael Chen",
      ehrSources: [
        {
          ehrConnectionId: epicConnection.id,
          platform: "fastenhealth",
          facilityName: "Metro General Hospital",
          mrn: "EPIC-001236",
          patientId: emilyEpic.id,
          lastSync: new Date().toISOString(),
        },
      ],
      matchConfidence: "high",
      createdAt: new Date().toISOString(),
    };
    this.unifiedPatients.set(emilyUnifiedId, emilyUnified);

    // Robert Davis - exists in Cerner and Healthcare Provider
    const robertCerner: Patient = {
      id: randomUUID(),
      unifiedPatientId: robertUnifiedId,
      ehrConnectionId: cernerConnection.id,
      mrn: "CERN-2001",
      firstName: "Robert",
      middleName: "NMN",
      lastName: "Davis",
      dateOfBirth: "1968-05-10",
      gender: "male",
      email: "r.davis@email.com",
      phone: "(555) 456-7890",
      address: "321 Elm Street, Springfield, IL 62704",
      insuranceProvider: "Cigna",
      insuranceId: "CIG-789012",
      primaryPhysician: "Dr. Jennifer Lee",
    };
    this.patients.set(robertCerner.id, robertCerner);

    const robertSecondaryProvider: Patient = {
      id: randomUUID(),
      unifiedPatientId: robertUnifiedId,
      ehrConnectionId: allscriptsConnection.id,
      mrn: "AS-7834",
      firstName: "Robert",
      middleName: "NMN",
      lastName: "Davis",
      dateOfBirth: "1968-05-10",
      gender: "male",
      email: "r.davis@email.com",
      phone: "(555) 456-7890",
      address: "321 Elm Street, Springfield, IL 62704",
      insuranceProvider: "Cigna",
      insuranceId: "CIG-789012",
      primaryPhysician: "Dr. Robert Kim",
    };
    this.patients.set(robertSecondaryProvider.id, robertSecondaryProvider);

    const robertUnified: UnifiedPatient = {
      id: robertUnifiedId,
      firstName: "Robert",
      middleName: "NMN",
      lastName: "Davis",
      dateOfBirth: "1968-05-10",
      gender: "male",
      email: "r.davis@email.com",
      phone: "(555) 456-7890",
      address: "321 Elm Street, Springfield, IL 62704",
      primaryInsurance: "Cigna",
      primaryPhysician: "Dr. Jennifer Lee",
      ehrSources: [
        {
          ehrConnectionId: cernerConnection.id,
          platform: "fastenhealth",
          facilityName: "Downtown Medical Center",
          mrn: "CERN-2001",
          patientId: robertCerner.id,
          lastSync: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          ehrConnectionId: allscriptsConnection.id,
          platform: "fastenhealth",
          facilityName: "Springfield Urgent Care",
          mrn: "AS-7834",
          patientId: robertSecondaryProvider.id,
          lastSync: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      ],
      matchConfidence: "high",
      createdAt: new Date().toISOString(),
    };
    this.unifiedPatients.set(robertUnifiedId, robertUnified);

    // Seed medical records from different EHR sources
    // Sarah's records from provider
    this.createRecordForPatient(sarahEpic.id, epicConnection.id, {
      type: 'diagnosis',
      title: 'Essential Hypertension',
      description: 'Blood pressure readings consistently elevated. Recommended lifestyle modifications and monitoring.',
      provider: 'Dr. Michael Chen',
      facility: 'Metro General Hospital',
      status: 'active',
    });
    this.createRecordForPatient(sarahEpic.id, epicConnection.id, {
      type: 'lab_result',
      title: 'Complete Blood Count',
      description: 'All values within normal range. WBC 7.2, RBC 4.8, Hemoglobin 14.2',
      provider: 'Dr. Michael Chen',
      facility: 'Metro General Hospital',
      status: 'resolved',
    });

    // Sarah's records from Hospital Network (different facility, same patient)
    this.createRecordForPatient(sarahCerner.id, cernerConnection.id, {
      type: 'procedure',
      title: 'Cardiac Stress Test',
      description: 'Treadmill stress test performed. Results normal, no significant ST changes observed.',
      provider: 'Dr. Jennifer Lee',
      facility: 'Downtown Medical Center',
      status: 'resolved',
    });
    this.createRecordForPatient(sarahCerner.id, cernerConnection.id, {
      type: 'imaging',
      title: 'Chest X-Ray',
      description: 'No acute cardiopulmonary abnormality. Heart size normal.',
      provider: 'Dr. Jennifer Lee',
      facility: 'Downtown Medical Center',
      status: 'resolved',
    });

    // James's records from provider
    this.createRecordForPatient(jamesEpic.id, epicConnection.id, {
      type: 'diagnosis',
      title: 'Type 2 Diabetes Mellitus',
      description: 'A1C at 7.2%. Managing with oral medications and diet modifications.',
      provider: 'Dr. Sarah Martinez',
      facility: 'Metro General Hospital',
      status: 'active',
    });

    // James's records from Healthcare Provider
    this.createRecordForPatient(jamesSecondaryProvider.id, allscriptsConnection.id, {
      type: 'procedure',
      title: 'Flu Vaccination',
      description: 'Annual influenza vaccination administered. No adverse reactions.',
      provider: 'Dr. Robert Kim',
      facility: 'Springfield Urgent Care',
      status: 'resolved',
    });

    // Emily's records
    this.createRecordForPatient(emilyEpic.id, epicConnection.id, {
      type: 'lab_result',
      title: 'Lipid Panel',
      description: 'Total cholesterol 195, LDL 112, HDL 58, Triglycerides 125',
      provider: 'Dr. Michael Chen',
      facility: 'Metro General Hospital',
      status: 'resolved',
    });

    // Robert's records from Hospital Network
    this.createRecordForPatient(robertCerner.id, cernerConnection.id, {
      type: 'diagnosis',
      title: 'Osteoarthritis - Bilateral Knees',
      description: 'Moderate degenerative changes in both knees. Physical therapy recommended.',
      provider: 'Dr. Jennifer Lee',
      facility: 'Downtown Medical Center',
      status: 'active',
    });

    // Robert's records from Healthcare Provider
    this.createRecordForPatient(robertSecondaryProvider.id, allscriptsConnection.id, {
      type: 'procedure',
      title: 'Joint Injection - Right Knee',
      description: 'Corticosteroid injection administered for pain relief.',
      provider: 'Dr. Robert Kim',
      facility: 'Springfield Urgent Care',
      status: 'resolved',
    });

    // Seed medications from different sources
    // Sarah's medications from provider
    this.createMedicationForPatient(sarahEpic.id, epicConnection.id, {
      name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      prescribedBy: 'Dr. Michael Chen',
      status: 'active',
      refills: 3,
    });

    // Sarah's medications from Hospital Network
    this.createMedicationForPatient(sarahCerner.id, cernerConnection.id, {
      name: 'Atorvastatin',
      dosage: '20mg',
      frequency: 'Once daily at bedtime',
      prescribedBy: 'Dr. Jennifer Lee',
      status: 'active',
      refills: 5,
    });

    // James's medications
    this.createMedicationForPatient(jamesEpic.id, epicConnection.id, {
      name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily with meals',
      prescribedBy: 'Dr. Sarah Martinez',
      status: 'active',
      refills: 2,
    });

    // Robert's medications from both facilities
    this.createMedicationForPatient(robertCerner.id, cernerConnection.id, {
      name: 'Meloxicam',
      dosage: '15mg',
      frequency: 'Once daily',
      prescribedBy: 'Dr. Jennifer Lee',
      status: 'active',
      refills: 1,
    });
    this.createMedicationForPatient(robertSecondaryProvider.id, allscriptsConnection.id, {
      name: 'Acetaminophen',
      dosage: '500mg',
      frequency: 'As needed for pain, max 4g daily',
      prescribedBy: 'Dr. Robert Kim',
      status: 'active',
      refills: 0,
    });

    // HIGH-RISK MEDICATIONS for safety feature testing
    // Warfarin - Blood thinner (anticoagulant)
    this.createMedicationForPatient(sarahEpic.id, epicConnection.id, {
      name: 'Warfarin',
      dosage: '5mg',
      frequency: 'Once daily in the evening',
      prescribedBy: 'Dr. Michael Chen',
      status: 'active',
      refills: 2,
    });

    // Metoprolol - Heart medication (beta-blocker)
    this.createMedicationForPatient(sarahCerner.id, cernerConnection.id, {
      name: 'Metoprolol Succinate',
      dosage: '50mg',
      frequency: 'Once daily in the morning',
      prescribedBy: 'Dr. Jennifer Lee',
      status: 'active',
      refills: 3,
    });

    // Insulin Lantus - High-risk diabetes medication
    this.createMedicationForPatient(jamesEpic.id, epicConnection.id, {
      name: 'Lantus Insulin',
      dosage: '20 units',
      frequency: 'Once daily at bedtime',
      prescribedBy: 'Dr. Sarah Martinez',
      status: 'active',
      refills: 4,
    });

    // Oxycodone - Controlled substance (opioid)
    this.createMedicationForPatient(robertCerner.id, cernerConnection.id, {
      name: 'Oxycodone',
      dosage: '5mg',
      frequency: 'Every 6 hours as needed for severe pain',
      prescribedBy: 'Dr. Jennifer Lee',
      status: 'active',
      refills: 0,
    });

    // Digoxin - Heart medication requiring careful monitoring
    this.createMedicationForPatient(robertSecondaryProvider.id, allscriptsConnection.id, {
      name: 'Digoxin',
      dosage: '0.125mg',
      frequency: 'Once daily',
      prescribedBy: 'Dr. Thomas Anderson',
      status: 'active',
      refills: 2,
    });

    // Seed vitals from different sources
    const allPatients = Array.from(this.patients.values());
    for (const patient of allPatients) {
      const connection = this.ehrConnections.get(patient.ehrConnectionId);
      const vitalTypes = [
        { type: 'blood_pressure', value: `${110 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 20)}`, unit: 'mmHg' },
        { type: 'heart_rate', value: `${60 + Math.floor(Math.random() * 30)}`, unit: 'bpm' },
        { type: 'temperature', value: `${97.5 + Math.random() * 2}`.slice(0, 4), unit: '°F' },
        { type: 'weight', value: `${140 + Math.floor(Math.random() * 60)}`, unit: 'lbs' },
        { type: 'oxygen_saturation', value: `${95 + Math.floor(Math.random() * 5)}`, unit: '%' },
      ] as const;

      for (const v of vitalTypes) {
        const vitalId = randomUUID();
        this.vitals.set(vitalId, {
          id: vitalId,
          patientId: patient.id,
          ehrConnectionId: patient.ehrConnectionId,
          type: v.type,
          value: v.value,
          unit: v.unit,
          recordedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
          recordedBy: connection?.facilityName === 'Metro General Hospital' ? 'Nurse Thompson' : 
                     connection?.facilityName === 'Downtown Medical Center' ? 'Nurse Garcia' : 'Nurse Wilson',
        });
      }
    }

    // Seed lab results for patients
    for (const patient of allPatients) {
      const labTests = [
        { testName: "Hemoglobin", value: `${12 + Math.random() * 4}`.slice(0, 4), unit: "g/dL", referenceRange: "12.0-17.5", status: "normal" as const },
        { testName: "Glucose", value: `${85 + Math.floor(Math.random() * 30)}`, unit: "mg/dL", referenceRange: "70-100", status: Math.random() > 0.7 ? "abnormal" as const : "normal" as const },
        { testName: "HbA1c", value: `${5.0 + Math.random() * 2}`.slice(0, 3), unit: "%", referenceRange: "4.0-5.6", status: "normal" as const },
        { testName: "Creatinine", value: `${0.8 + Math.random() * 0.5}`.slice(0, 3), unit: "mg/dL", referenceRange: "0.7-1.3", status: "normal" as const },
        { testName: "Total Cholesterol", value: `${160 + Math.floor(Math.random() * 60)}`, unit: "mg/dL", referenceRange: "< 200", status: "normal" as const },
        { testName: "LDL Cholesterol", value: `${80 + Math.floor(Math.random() * 50)}`, unit: "mg/dL", referenceRange: "< 100", status: Math.random() > 0.6 ? "abnormal" as const : "normal" as const },
        { testName: "TSH", value: `${1.5 + Math.random() * 2}`.slice(0, 3), unit: "mIU/L", referenceRange: "0.4-4.0", status: "normal" as const },
        { testName: "Potassium", value: `${3.8 + Math.random() * 1.0}`.slice(0, 3), unit: "mEq/L", referenceRange: "3.5-5.0", status: "normal" as const },
      ];

      for (const lab of labTests) {
        const labId = randomUUID();
        this.labResults.set(labId, {
          id: labId,
          patientId: patient.id,
          ehrConnectionId: patient.ehrConnectionId,
          testName: lab.testName,
          value: lab.value,
          unit: lab.unit,
          referenceRange: lab.referenceRange,
          status: lab.status,
          date: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString(),
          orderedBy: "Dr. Lab Order",
          facility: this.ehrConnections.get(patient.ehrConnectionId)?.facilityName,
        });
      }
    }

    // Seed allergies
    this.createAllergyForPatient(sarahEpic.id, epicConnection.id, {
      name: "Penicillin",
      type: "drug",
      severity: "severe",
      reaction: "Anaphylaxis, hives, difficulty breathing",
      onsetDate: "2010-05-15",
      status: "active",
    });
    this.createAllergyForPatient(sarahCerner.id, cernerConnection.id, {
      name: "Penicillin",
      type: "drug",
      severity: "severe",
      reaction: "Severe allergic reaction",
      onsetDate: "2010-05-15",
      status: "active",
    });
    this.createAllergyForPatient(jamesEpic.id, epicConnection.id, {
      name: "Shellfish",
      type: "food",
      severity: "moderate",
      reaction: "Hives, itching, stomach upset",
      onsetDate: "2005-08-20",
      status: "active",
    });
    this.createAllergyForPatient(jamesEpic.id, epicConnection.id, {
      name: "Aspirin",
      type: "drug",
      severity: "mild",
      reaction: "Mild skin rash",
      onsetDate: "2015-03-10",
      status: "active",
    });
    this.createAllergyForPatient(emilyEpic.id, epicConnection.id, {
      name: "Pollen",
      type: "environmental",
      severity: "mild",
      reaction: "Sneezing, runny nose, itchy eyes",
      onsetDate: "2000-04-01",
      status: "active",
    });
    this.createAllergyForPatient(robertCerner.id, cernerConnection.id, {
      name: "Latex",
      type: "other",
      severity: "moderate",
      reaction: "Skin irritation, contact dermatitis",
      onsetDate: "2018-07-22",
      status: "active",
    });

    // Seed problems/conditions
    this.createProblemForPatient(sarahEpic.id, epicConnection.id, {
      name: "Essential Hypertension",
      icdCode: "I10",
      category: "chronic",
      status: "active",
      onsetDate: "2019-06-15",
      diagnosedBy: "Dr. Michael Chen",
      facility: "Metro General Hospital",
      notes: "Well-controlled with medication. Target BP <130/80.",
    });
    this.createProblemForPatient(sarahCerner.id, cernerConnection.id, {
      name: "Hypertension",
      icdCode: "I10",
      category: "chronic",
      status: "active",
      onsetDate: "2019-06-15",
      diagnosedBy: "Dr. Jennifer Lee",
      facility: "Downtown Medical Center",
      notes: "Patient on Lisinopril 10mg daily.",
    });
    this.createProblemForPatient(jamesEpic.id, epicConnection.id, {
      name: "Type 2 Diabetes Mellitus",
      icdCode: "E11.9",
      category: "chronic",
      status: "active",
      onsetDate: "2018-02-10",
      diagnosedBy: "Dr. Sarah Martinez",
      facility: "Metro General Hospital",
      notes: "A1C target <7%. Currently on Metformin.",
    });
    this.createProblemForPatient(jamesEpic.id, epicConnection.id, {
      name: "Hyperlipidemia",
      icdCode: "E78.5",
      category: "chronic",
      status: "active",
      onsetDate: "2019-01-05",
      diagnosedBy: "Dr. Sarah Martinez",
      facility: "Metro General Hospital",
      notes: "LDL target <100. On Atorvastatin.",
    });
    this.createProblemForPatient(emilyEpic.id, epicConnection.id, {
      name: "Seasonal Allergic Rhinitis",
      icdCode: "J30.2",
      category: "chronic",
      status: "active",
      onsetDate: "2000-04-01",
      diagnosedBy: "Dr. Michael Chen",
      facility: "Metro General Hospital",
      notes: "Managed with antihistamines during spring/fall.",
    });
    this.createProblemForPatient(emilyEpic.id, epicConnection.id, {
      name: "Acute Upper Respiratory Infection",
      icdCode: "J06.9",
      category: "acute",
      status: "resolved",
      onsetDate: "2024-12-01",
      resolvedDate: "2024-12-15",
      diagnosedBy: "Dr. Michael Chen",
      facility: "Metro General Hospital",
      notes: "Resolved with supportive care.",
    });
    this.createProblemForPatient(robertCerner.id, cernerConnection.id, {
      name: "Osteoarthritis of Knee",
      icdCode: "M17.11",
      category: "chronic",
      status: "active",
      onsetDate: "2022-03-20",
      diagnosedBy: "Dr. Robert Kim",
      facility: "Downtown Medical Center",
      notes: "Right knee. Conservative management with PT and NSAIDs.",
    });
    this.createProblemForPatient(robertCerner.id, cernerConnection.id, {
      name: "Lumbar Strain",
      icdCode: "S39.012A",
      category: "acute",
      status: "active",
      onsetDate: "2025-01-02",
      diagnosedBy: "Dr. Robert Kim",
      facility: "Downtown Medical Center",
      notes: "Work-related injury. PT in progress.",
    });

    // Seed appointments
    this.createAppointmentForPatient(sarahEpic.id, epicConnection.id, {
      type: 'followup',
      title: 'Blood Pressure Follow-up',
      provider: 'Dr. Michael Chen',
      facility: 'Metro General Hospital',
      daysFromNow: 3,
    });
    this.createAppointmentForPatient(sarahCerner.id, cernerConnection.id, {
      type: 'specialist',
      title: 'Cardiology Consultation',
      provider: 'Dr. Jennifer Lee',
      facility: 'Downtown Medical Center',
      daysFromNow: 10,
    });
    this.createAppointmentForPatient(jamesEpic.id, epicConnection.id, {
      type: 'lab',
      title: 'A1C Blood Test',
      provider: 'Dr. Sarah Martinez',
      facility: 'Metro General Hospital',
      daysFromNow: 5,
    });
    this.createAppointmentForPatient(robertCerner.id, cernerConnection.id, {
      type: 'followup',
      title: 'Knee Evaluation',
      provider: 'Dr. Jennifer Lee',
      facility: 'Downtown Medical Center',
      daysFromNow: 7,
    });

    // Seed wearable device connections
    const fitbitConnection: WearableConnection = {
      id: randomUUID(),
      userId: sampleUserId,
      platform: "fitbit",
      deviceName: "Fitbit Charge 5",
      status: "connected",
      lastSync: new Date(Date.now() - 2 * 3600000).toISOString(),
      enabledDataTypes: ["steps", "heart_rate", "sleep", "activity"],
      syncFrequency: "hourly",
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    };
    this.wearableConnections.set(fitbitConnection.id, fitbitConnection);

    const appleHealthConnection: WearableConnection = {
      id: randomUUID(),
      userId: sampleUserId,
      platform: "apple_health",
      deviceName: "iPhone 15 Pro",
      status: "connected",
      lastSync: new Date(Date.now() - 30 * 60000).toISOString(),
      enabledDataTypes: ["steps", "heart_rate", "sleep", "activity", "vitals"],
      syncFrequency: "realtime",
      createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
    };
    this.wearableConnections.set(appleHealthConnection.id, appleHealthConnection);

    const ouraConnection: WearableConnection = {
      id: randomUUID(),
      userId: sampleUserId,
      platform: "oura",
      deviceName: "Oura Ring Gen 3",
      status: "connected",
      lastSync: new Date(Date.now() - 8 * 3600000).toISOString(),
      enabledDataTypes: ["sleep", "heart_rate", "readiness", "temperature"],
      syncFrequency: "daily",
      createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    };
    this.wearableConnections.set(ouraConnection.id, ouraConnection);

    // Seed sample wearable data records
    const now = Date.now();
    for (let i = 0; i < 7; i++) {
      const dayOffset = i * 86400000;
      const recordDate = new Date(now - dayOffset).toISOString();
      
      // Steps data (Fitbit)
      this.wearableDataRecords.set(randomUUID(), {
        id: randomUUID(),
        userId: sampleUserId,
        wearableConnectionId: fitbitConnection.id,
        dataType: "steps",
        value: 8000 + Math.floor(Math.random() * 4000),
        unit: "steps",
        metadata: { goal: 10000 },
        recordedAt: recordDate,
        syncedAt: recordDate,
      });

      // Heart rate data (Apple Health)
      this.wearableDataRecords.set(randomUUID(), {
        id: randomUUID(),
        userId: sampleUserId,
        wearableConnectionId: appleHealthConnection.id,
        dataType: "heart_rate",
        value: 65 + Math.floor(Math.random() * 15),
        unit: "bpm",
        metadata: { type: "resting" },
        recordedAt: recordDate,
        syncedAt: recordDate,
      });

      // Sleep data (Oura)
      this.wearableDataRecords.set(randomUUID(), {
        id: randomUUID(),
        userId: sampleUserId,
        wearableConnectionId: ouraConnection.id,
        dataType: "sleep",
        value: 6 + Math.random() * 2.5,
        unit: "hours",
        metadata: { 
          quality: Math.floor(70 + Math.random() * 25),
          deepSleep: 1.5 + Math.random(),
          remSleep: 1 + Math.random()
        },
        recordedAt: recordDate,
        syncedAt: recordDate,
      });

      // Activity data (Fitbit)
      this.wearableDataRecords.set(randomUUID(), {
        id: randomUUID(),
        userId: sampleUserId,
        wearableConnectionId: fitbitConnection.id,
        dataType: "activity",
        value: 30 + Math.floor(Math.random() * 45),
        unit: "active_minutes",
        metadata: { caloriesBurned: 200 + Math.floor(Math.random() * 200) },
        recordedAt: recordDate,
        syncedAt: recordDate,
      });

      // Readiness score (Oura)
      this.wearableDataRecords.set(randomUUID(), {
        id: randomUUID(),
        userId: sampleUserId,
        wearableConnectionId: ouraConnection.id,
        dataType: "readiness",
        value: 70 + Math.floor(Math.random() * 25),
        unit: "score",
        metadata: { restingHeartRate: 58 + Math.floor(Math.random() * 8) },
        recordedAt: recordDate,
        syncedAt: recordDate,
      });
    }

    // Seed sample message threads and messages
    this.seedSampleMessages(sampleUserId);
    
    // Seed pharmacies with patient preferences
    this.seedPharmacies(sarahUnifiedId);
    
    // Seed PROMs, health tips, and health engagement data
    this.seedPromsAndHealthTips(sarahUnifiedId);
    
    // Seed immunizations for expanded patient records
    this.seedImmunizationsAndHealthMetrics(sarahEpic.id);
  }

  private seedImmunizationsAndHealthMetrics(patientId: string) {
    // Sample immunizations
    const immunizationsData = [
      {
        vaccineName: "COVID-19 Vaccine (Pfizer-BioNTech)",
        vaccineCode: "CVX-208",
        manufacturer: "Pfizer Inc.",
        lotNumber: "EL9269",
        expirationDate: "2026-06-30",
        doseNumber: 1,
        seriesComplete: false,
        administeredDate: new Date(Date.now() - 365 * 86400000).toISOString(),
        administeredBy: "Nurse Thompson",
        site: "left_arm" as const,
        route: "Intramuscular",
        status: "completed" as const,
      },
      {
        vaccineName: "COVID-19 Vaccine (Pfizer-BioNTech)",
        vaccineCode: "CVX-208",
        manufacturer: "Pfizer Inc.",
        lotNumber: "EL9270",
        expirationDate: "2026-07-15",
        doseNumber: 2,
        seriesComplete: true,
        administeredDate: new Date(Date.now() - 344 * 86400000).toISOString(),
        administeredBy: "Nurse Garcia",
        site: "left_arm" as const,
        route: "Intramuscular",
        status: "completed" as const,
      },
      {
        vaccineName: "Influenza Vaccine (2024-2025)",
        vaccineCode: "CVX-141",
        manufacturer: "Sanofi Pasteur",
        lotNumber: "FL3847",
        expirationDate: "2025-06-01",
        doseNumber: 1,
        seriesComplete: true,
        administeredDate: new Date(Date.now() - 90 * 86400000).toISOString(),
        administeredBy: "Dr. Chen",
        site: "right_arm" as const,
        route: "Intramuscular",
        status: "completed" as const,
      },
      {
        vaccineName: "Tdap (Tetanus, Diphtheria, Pertussis)",
        vaccineCode: "CVX-115",
        manufacturer: "GlaxoSmithKline",
        lotNumber: "TD8834",
        expirationDate: "2027-02-28",
        doseNumber: 1,
        seriesComplete: true,
        administeredDate: new Date(Date.now() - 1460 * 86400000).toISOString(),
        administeredBy: "Dr. Martinez",
        site: "left_arm" as const,
        route: "Intramuscular",
        status: "completed" as const,
      },
      {
        vaccineName: "Hepatitis B Vaccine",
        vaccineCode: "CVX-45",
        manufacturer: "Merck",
        lotNumber: "HB3311",
        expirationDate: "2025-12-31",
        doseNumber: 3,
        seriesComplete: true,
        administeredDate: new Date(Date.now() - 180 * 86400000).toISOString(),
        administeredBy: "Nurse Wilson",
        site: "right_arm" as const,
        route: "Intramuscular",
        status: "completed" as const,
        reaction: "Mild soreness at injection site",
        reactionDate: new Date(Date.now() - 179 * 86400000).toISOString(),
        reactionSeverity: "mild",
      },
    ];

    for (const imm of immunizationsData) {
      const id = randomUUID();
      this.immunizations.set(id, {
        ...imm,
        id,
        patientId,
        createdAt: imm.administeredDate,
      });
    }

    // Sample advanced health metrics (HbA1c, blood pressure trends, cholesterol)
    const now = Date.now();
    
    // HbA1c readings over time
    const hba1cReadings = [
      { value: 7.8, daysAgo: 365, status: "abnormal" as const, trend: "stable" as const },
      { value: 7.4, daysAgo: 270, status: "abnormal" as const, trend: "improving" as const },
      { value: 7.0, daysAgo: 180, status: "borderline" as const, trend: "improving" as const },
      { value: 6.5, daysAgo: 90, status: "normal" as const, trend: "improving" as const },
      { value: 6.3, daysAgo: 7, status: "normal" as const, trend: "improving" as const },
    ];

    for (const reading of hba1cReadings) {
      const id = randomUUID();
      this.advancedHealthMetrics.set(id, {
        id,
        patientId,
        metricType: "hba1c",
        value: reading.value,
        unit: "%",
        recordedAt: new Date(now - reading.daysAgo * 86400000).toISOString(),
        source: "lab",
        referenceRangeLow: 4.0,
        referenceRangeHigh: 5.6,
        targetValue: 7.0,
        status: reading.status,
        trend: reading.trend,
        createdAt: new Date(now - reading.daysAgo * 86400000).toISOString(),
      });
    }

    // Blood pressure readings - store systolic and diastolic separately
    const bpReadings = [
      { systolic: 148, diastolic: 92, daysAgo: 180, status: "abnormal" as const },
      { systolic: 142, diastolic: 88, daysAgo: 120, status: "abnormal" as const },
      { systolic: 136, diastolic: 84, daysAgo: 60, status: "borderline" as const },
      { systolic: 128, diastolic: 82, daysAgo: 30, status: "normal" as const },
      { systolic: 124, diastolic: 78, daysAgo: 7, status: "normal" as const },
      { systolic: 122, diastolic: 76, daysAgo: 1, status: "normal" as const },
    ];

    for (const bp of bpReadings) {
      const recordedAt = new Date(now - bp.daysAgo * 86400000).toISOString();
      const trend = bp.daysAgo > 60 ? "worsening" as const : "improving" as const;
      
      // Systolic
      const systolicId = randomUUID();
      this.advancedHealthMetrics.set(systolicId, {
        id: systolicId,
        patientId,
        metricType: "blood_pressure_systolic",
        value: bp.systolic,
        unit: "mmHg",
        recordedAt,
        source: "device",
        referenceRangeLow: 90,
        referenceRangeHigh: 120,
        targetValue: 130,
        status: bp.status,
        trend,
        createdAt: recordedAt,
      });
      
      // Diastolic
      const diastolicId = randomUUID();
      this.advancedHealthMetrics.set(diastolicId, {
        id: diastolicId,
        patientId,
        metricType: "blood_pressure_diastolic",
        value: bp.diastolic,
        unit: "mmHg",
        recordedAt,
        source: "device",
        referenceRangeLow: 60,
        referenceRangeHigh: 80,
        targetValue: 80,
        status: bp.status,
        trend,
        createdAt: recordedAt,
      });
    }

    // Total cholesterol readings
    const cholesterolReadings = [
      { value: 245, daysAgo: 365, status: "abnormal" as const },
      { value: 220, daysAgo: 180, status: "borderline" as const },
      { value: 198, daysAgo: 90, status: "normal" as const },
      { value: 185, daysAgo: 30, status: "normal" as const },
    ];

    for (const chol of cholesterolReadings) {
      const id = randomUUID();
      this.advancedHealthMetrics.set(id, {
        id,
        patientId,
        metricType: "total_cholesterol",
        value: chol.value,
        unit: "mg/dL",
        recordedAt: new Date(now - chol.daysAgo * 86400000).toISOString(),
        source: "lab",
        referenceRangeLow: 0,
        referenceRangeHigh: 200,
        targetValue: 180,
        status: chol.status,
        trend: "improving" as const,
        createdAt: new Date(now - chol.daysAgo * 86400000).toISOString(),
      });
    }

    // Fasting glucose readings
    const glucoseReadings = [
      { value: 145, daysAgo: 180, status: "abnormal" as const },
      { value: 128, daysAgo: 90, status: "borderline" as const },
      { value: 105, daysAgo: 30, status: "borderline" as const },
      { value: 98, daysAgo: 7, status: "normal" as const },
    ];

    for (const gluc of glucoseReadings) {
      const id = randomUUID();
      this.advancedHealthMetrics.set(id, {
        id,
        patientId,
        metricType: "fasting_glucose",
        value: gluc.value,
        unit: "mg/dL",
        recordedAt: new Date(now - gluc.daysAgo * 86400000).toISOString(),
        source: "lab",
        referenceRangeLow: 70,
        referenceRangeHigh: 100,
        targetValue: 100,
        status: gluc.status,
        trend: "improving" as const,
        createdAt: new Date(now - gluc.daysAgo * 86400000).toISOString(),
      });
    }

    // Sample condition-specific PROMs
    const diabetesPROMResponses = [
      { questionId: "d1", answer: 5 },
      { questionId: "d2", answer: 4 },
      { questionId: "d3", answer: 3 },
      { questionId: "d4", answer: 4 },
      { questionId: "d5", answer: 5 },
      { questionId: "d6", answer: 4 },
      { questionId: "d7", answer: 3 },
    ];

    const diabetesPROMId = randomUUID();
    this.conditionSpecificPROMs.set(diabetesPROMId, {
      id: diabetesPROMId,
      patientId,
      conditionType: "diabetes",
      templateName: "Diabetes Self-Care Activities (DSCAM)",
      responses: diabetesPROMResponses,
      totalScore: 28,
      interpretation: "Good self-management practices with room for improvement in physical activity and foot care.",
      riskLevel: "low",
      completedAt: new Date(now - 14 * 86400000).toISOString(),
      reviewedBy: "dr-chen-1",
      reviewedAt: new Date(now - 12 * 86400000).toISOString(),
      providerNotes: "Patient showing good adherence. Continue current regimen.",
    });

    const hypertensionPROMResponses = [
      { questionId: "h1", answer: 4 },
      { questionId: "h2", answer: 5 },
      { questionId: "h3", answer: 3 },
      { questionId: "h4", answer: 4 },
      { questionId: "h5", answer: 4 },
      { questionId: "h6", answer: 3 },
      { questionId: "h7", answer: 4 },
    ];

    const hypertensionPROMId = randomUUID();
    this.conditionSpecificPROMs.set(hypertensionPROMId, {
      id: hypertensionPROMId,
      patientId,
      conditionType: "hypertension",
      templateName: "Hypertension Self-Management Assessment",
      responses: hypertensionPROMResponses,
      totalScore: 27,
      interpretation: "Moderate self-management with opportunities to improve stress management and exercise frequency.",
      riskLevel: "moderate",
      completedAt: new Date(now - 7 * 86400000).toISOString(),
    });
  }

  private seedSampleMessages(patientId: string) {
    const now = new Date();
    
    // Thread 1: Recent prescription request with unread messages
    const thread1Id = randomUUID();
    const thread1: MessageThread = {
      id: thread1Id,
      patientId,
      subject: "Lisinopril Refill Request",
      threadType: "prescription_request",
      priority: "normal",
      participants: [
        { id: patientId, name: "You", role: "patient" },
        { id: "dr-chen-1", name: "Dr. Michael Chen", role: "provider" },
      ],
      lastMessageAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      lastMessagePreview: "Your prescription has been sent to Metro Pharmacy.",
      unreadCount: 1,
      isArchived: false,
      isClosed: false,
      createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
      createdBy: patientId,
    };
    this.messageThreads.set(thread1Id, thread1);

    // Messages for thread 1
    const msg1_1: SecureMessage = {
      id: randomUUID(),
      threadId: thread1Id,
      senderId: patientId,
      senderName: "You",
      senderRole: "patient",
      content: "Hi Dr. Chen, I need a refill for my Lisinopril 10mg. I have about 5 days of medication left.",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 2.5 * 86400000).toISOString(),
      createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg1_1.id, msg1_1);

    const msg1_2: SecureMessage = {
      id: randomUUID(),
      threadId: thread1Id,
      senderId: "dr-chen-1",
      senderName: "Dr. Michael Chen",
      senderRole: "provider",
      content: "Hello! I've reviewed your request and approved a 90-day supply. Your prescription has been sent to Metro Pharmacy. They should have it ready within 24 hours.",
      attachments: [],
      isRead: false,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg1_2.id, msg1_2);

    // Thread 2: Test results discussion
    const thread2Id = randomUUID();
    const thread2: MessageThread = {
      id: thread2Id,
      patientId,
      subject: "Lab Results - Annual Checkup",
      threadType: "test_results",
      priority: "high",
      participants: [
        { id: patientId, name: "You", role: "patient" },
        { id: "nurse-garcia-1", name: "Nurse Garcia", role: "nurse" },
        { id: "dr-chen-1", name: "Dr. Michael Chen", role: "provider" },
      ],
      lastMessageAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
      lastMessagePreview: "Let me know if you have any questions about these results.",
      unreadCount: 2,
      isArchived: false,
      isClosed: false,
      createdAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      createdBy: "nurse-garcia-1",
    };
    this.messageThreads.set(thread2Id, thread2);

    const msg2_1: SecureMessage = {
      id: randomUUID(),
      threadId: thread2Id,
      senderId: "nurse-garcia-1",
      senderName: "Nurse Garcia",
      senderRole: "nurse",
      content: "Hi! Your lab results from your annual checkup are now available. I'm attaching a summary for your review.",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
      createdAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg2_1.id, msg2_1);

    const msg2_2: SecureMessage = {
      id: randomUUID(),
      threadId: thread2Id,
      senderId: patientId,
      senderName: "You",
      senderRole: "patient",
      content: "Thank you! I noticed my cholesterol is a bit high. Should I be concerned?",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      createdAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg2_2.id, msg2_2);

    const msg2_3: SecureMessage = {
      id: randomUUID(),
      threadId: thread2Id,
      senderId: "dr-chen-1",
      senderName: "Dr. Michael Chen",
      senderRole: "provider",
      content: "Your LDL cholesterol is slightly elevated at 118 mg/dL (target is <100). This isn't critical, but we should discuss lifestyle modifications at your next visit. For now, try to reduce saturated fats and increase physical activity. Let me know if you have any questions about these results.",
      attachments: [],
      isRead: false,
      createdAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg2_3.id, msg2_3);

    // Thread 3: Appointment follow-up (closed)
    const thread3Id = randomUUID();
    const thread3: MessageThread = {
      id: thread3Id,
      patientId,
      subject: "Follow-up: Physical Therapy Referral",
      threadType: "appointment_follow_up",
      priority: "normal",
      participants: [
        { id: patientId, name: "You", role: "patient" },
        { id: "coordinator-smith-1", name: "Amy Smith", role: "care_coordinator" },
      ],
      lastMessageAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      lastMessagePreview: "Your appointment has been scheduled. See you then!",
      unreadCount: 0,
      isArchived: false,
      isClosed: true,
      closedAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
      closedBy: "coordinator-smith-1",
      createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      createdBy: "coordinator-smith-1",
    };
    this.messageThreads.set(thread3Id, thread3);

    const msg3_1: SecureMessage = {
      id: randomUUID(),
      threadId: thread3Id,
      senderId: "coordinator-smith-1",
      senderName: "Amy Smith",
      senderRole: "care_coordinator",
      content: "Hi! Dr. Chen has referred you to physical therapy for your lower back pain. I've found an opening at Metro PT on January 22nd at 2:00 PM. Would this work for you?",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 9 * 86400000).toISOString(),
      createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg3_1.id, msg3_1);

    const msg3_2: SecureMessage = {
      id: randomUUID(),
      threadId: thread3Id,
      senderId: patientId,
      senderName: "You",
      senderRole: "patient",
      content: "Yes, that works perfectly! Thank you for arranging this.",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
      createdAt: new Date(now.getTime() - 9 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg3_2.id, msg3_2);

    const msg3_3: SecureMessage = {
      id: randomUUID(),
      threadId: thread3Id,
      senderId: "coordinator-smith-1",
      senderName: "Amy Smith",
      senderRole: "care_coordinator",
      content: "Your appointment has been scheduled. See you then!",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg3_3.id, msg3_3);

    // Thread 4: Urgent message
    const thread4Id = randomUUID();
    const thread4: MessageThread = {
      id: thread4Id,
      patientId,
      subject: "Medication Side Effect Question",
      threadType: "urgent",
      priority: "urgent",
      participants: [
        { id: patientId, name: "You", role: "patient" },
        { id: "nurse-thompson-1", name: "Nurse Thompson", role: "nurse" },
      ],
      lastMessageAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      lastMessagePreview: "If dizziness persists or worsens, please call our office.",
      unreadCount: 0,
      isArchived: false,
      isClosed: false,
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      createdBy: patientId,
    };
    this.messageThreads.set(thread4Id, thread4);

    const msg4_1: SecureMessage = {
      id: randomUUID(),
      threadId: thread4Id,
      senderId: patientId,
      senderName: "You",
      senderRole: "patient",
      content: "I started taking the new blood pressure medication yesterday and I'm feeling dizzy. Is this normal?",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg4_1.id, msg4_1);

    const msg4_2: SecureMessage = {
      id: randomUUID(),
      threadId: thread4Id,
      senderId: "nurse-thompson-1",
      senderName: "Nurse Thompson",
      senderRole: "nurse",
      content: "Mild dizziness can be a common side effect when starting blood pressure medication, especially in the first few days as your body adjusts. Make sure to stand up slowly from sitting or lying positions, and stay well hydrated. If dizziness persists or worsens, please call our office.",
      attachments: [],
      isRead: true,
      readAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(msg4_2.id, msg4_2);
  }

  private seedPharmacies(sarahUnifiedId: string) {
    const pharmacy1: Pharmacy = {
      id: randomUUID(),
      name: "Metro Pharmacy",
      address: "456 Main Street",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      phone: "(555) 234-5678",
      fax: "(555) 234-5679",
      email: "prescriptions@metropharmacy.com",
      isPreferred: true,
      supportsElectronicPrescribing: true,
      hours: "Mon-Fri: 8AM-9PM, Sat-Sun: 9AM-6PM",
      npiNumber: "1234567890",
      licenseNumber: "IL-RX-12345",
      chainAffiliation: "Independent",
      networkStatus: "active",
      apiKeyConfigured: true,
      apiKeyLastUpdated: new Date(Date.now() - 30 * 86400000).toISOString(),
      contactPerson: "Jane Martinez",
      contactPhone: "(555) 234-5680",
      deliveryAvailable: true,
      is24Hour: false,
      acceptsMedicare: true,
      acceptsMedicaid: true,
      specialties: ["Compounding", "Specialty Medications"],
      notes: "Primary local pharmacy partner",
      createdAt: new Date(Date.now() - 365 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    };
    this.pharmacies.set(pharmacy1.id, pharmacy1);
    
    const pharmacy2: Pharmacy = {
      id: randomUUID(),
      name: "CVS Pharmacy #4521",
      address: "789 Oak Avenue",
      city: "Springfield",
      state: "IL",
      zipCode: "62702",
      phone: "(555) 345-6789",
      fax: "(555) 345-6790",
      email: "store4521@cvs.com",
      isPreferred: true,
      supportsElectronicPrescribing: true,
      hours: "Open 24 Hours",
      npiNumber: "2345678901",
      licenseNumber: "IL-RX-23456",
      chainAffiliation: "CVS Health",
      networkStatus: "active",
      apiKeyConfigured: true,
      apiKeyLastUpdated: new Date(Date.now() - 60 * 86400000).toISOString(),
      contactPerson: "Robert Chen",
      contactPhone: "(555) 345-6791",
      deliveryAvailable: true,
      is24Hour: true,
      acceptsMedicare: true,
      acceptsMedicaid: true,
      specialties: ["MinuteClinic", "Drive-Through"],
      notes: "24-hour pharmacy with drive-through",
      createdAt: new Date(Date.now() - 300 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    };
    this.pharmacies.set(pharmacy2.id, pharmacy2);
    
    const pharmacy3: Pharmacy = {
      id: randomUUID(),
      name: "Walgreens #9876",
      address: "321 Elm Street",
      city: "Springfield",
      state: "IL",
      zipCode: "62703",
      phone: "(555) 456-7890",
      fax: "(555) 456-7891",
      email: "store9876@walgreens.com",
      isPreferred: false,
      supportsElectronicPrescribing: true,
      hours: "Mon-Sun: 7AM-10PM",
      npiNumber: "3456789012",
      licenseNumber: "IL-RX-34567",
      chainAffiliation: "Walgreens",
      networkStatus: "active",
      apiKeyConfigured: false,
      deliveryAvailable: true,
      is24Hour: false,
      acceptsMedicare: true,
      acceptsMedicaid: true,
      specialties: ["Immunizations", "Photo Services"],
      notes: "",
      createdAt: new Date(Date.now() - 200 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 100 * 86400000).toISOString(),
    };
    this.pharmacies.set(pharmacy3.id, pharmacy3);
    
    const pharmacy4: Pharmacy = {
      id: randomUUID(),
      name: "HealthMart Specialty Pharmacy",
      address: "555 Medical Plaza",
      city: "Springfield",
      state: "IL",
      zipCode: "62704",
      phone: "(555) 567-8901",
      fax: "(555) 567-8902",
      email: "info@healthmartspecialty.com",
      isPreferred: false,
      supportsElectronicPrescribing: true,
      hours: "Mon-Fri: 9AM-6PM",
      npiNumber: "4567890123",
      licenseNumber: "IL-RX-45678",
      chainAffiliation: "HealthMart",
      networkStatus: "pending",
      apiKeyConfigured: false,
      deliveryAvailable: true,
      is24Hour: false,
      acceptsMedicare: true,
      acceptsMedicaid: false,
      specialties: ["Specialty Medications", "Oncology", "Biologics"],
      notes: "Pending API integration",
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    };
    this.pharmacies.set(pharmacy4.id, pharmacy4);
    
    const pharmacy5: Pharmacy = {
      id: randomUUID(),
      name: "Costco Pharmacy #312",
      address: "1000 Warehouse Drive",
      city: "Springfield",
      state: "IL",
      zipCode: "62705",
      phone: "(555) 678-9012",
      fax: "(555) 678-9013",
      email: "pharmacy312@costco.com",
      isPreferred: false,
      supportsElectronicPrescribing: true,
      hours: "Mon-Fri: 10AM-8:30PM, Sat: 9:30AM-6PM, Sun: 10AM-6PM",
      npiNumber: "5678901234",
      licenseNumber: "IL-RX-56789",
      chainAffiliation: "Costco",
      networkStatus: "inactive",
      apiKeyConfigured: false,
      deliveryAvailable: false,
      is24Hour: false,
      acceptsMedicare: true,
      acceptsMedicaid: true,
      specialties: [],
      notes: "Temporarily inactive - contract renewal in progress",
      createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    };
    this.pharmacies.set(pharmacy5.id, pharmacy5);
    
    // Add patient pharmacy preferences for Sarah (sample patient)
    const pp1: PatientPharmacy = {
      id: randomUUID(),
      patientId: sarahUnifiedId,
      pharmacyId: pharmacy1.id,
      isPrimary: true,
      addedAt: new Date(Date.now() - 180 * 86400000).toISOString(),
    };
    this.patientPharmacies.set(pp1.id, pp1);
    
    const pp2: PatientPharmacy = {
      id: randomUUID(),
      patientId: sarahUnifiedId,
      pharmacyId: pharmacy2.id,
      isPrimary: false,
      addedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    };
    this.patientPharmacies.set(pp2.id, pp2);
  }

  private seedPromsAndHealthTips(patientId: string) {
    const now = new Date();
    
    // Create PROM Questionnaires
    const painPromId = randomUUID();
    const painProm: PromQuestionnaire = {
      id: painPromId,
      name: "Brief Pain Inventory (BPI)",
      description: "A validated tool to assess pain severity and its impact on daily functions",
      category: "pain",
      conditionTargets: ["chronic pain", "arthritis", "fibromyalgia"],
      questions: [
        { id: "q1", text: "Rate your worst pain in the last 24 hours", type: "scale", required: true, minValue: 0, maxValue: 10, minLabel: "No pain", maxLabel: "Pain as bad as you can imagine" },
        { id: "q2", text: "Rate your average pain in the last 24 hours", type: "scale", required: true, minValue: 0, maxValue: 10, minLabel: "No pain", maxLabel: "Worst pain" },
        { id: "q3", text: "Rate how much pain interferes with your daily activities", type: "scale", required: true, minValue: 0, maxValue: 10, minLabel: "Does not interfere", maxLabel: "Completely interferes" },
        { id: "q4", text: "Rate how much pain interferes with your sleep", type: "scale", required: true, minValue: 0, maxValue: 10, minLabel: "Does not interfere", maxLabel: "Completely interferes" },
      ],
      scoringMethod: "average",
      scoringThresholds: [
        { minScore: 0, maxScore: 3, severity: "normal", interpretation: "Mild pain - well controlled", alertProvider: false },
        { minScore: 3.1, maxScore: 5, severity: "mild", interpretation: "Moderate pain - may need adjustment", alertProvider: false },
        { minScore: 5.1, maxScore: 7, severity: "moderate", interpretation: "Significant pain - review recommended", alertProvider: true },
        { minScore: 7.1, maxScore: 10, severity: "severe", interpretation: "Severe pain - urgent review needed", alertProvider: true },
      ],
      isActive: true,
      version: "1.0",
      createdAt: new Date(now.getTime() - 90 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
    };
    this.promQuestionnaires.set(painPromId, painProm);

    const mentalHealthPromId = randomUUID();
    const mentalHealthProm: PromQuestionnaire = {
      id: mentalHealthPromId,
      name: "PHQ-9 Depression Screening",
      description: "Patient Health Questionnaire for depression screening",
      category: "mental_health",
      conditionTargets: ["depression", "anxiety", "mental health"],
      questions: [
        { id: "mh1", text: "Little interest or pleasure in doing things", type: "multiple_choice", required: true, options: [
          { value: 0, label: "Not at all", score: 0 },
          { value: 1, label: "Several days", score: 1 },
          { value: 2, label: "More than half the days", score: 2 },
          { value: 3, label: "Nearly every day", score: 3 },
        ]},
        { id: "mh2", text: "Feeling down, depressed, or hopeless", type: "multiple_choice", required: true, options: [
          { value: 0, label: "Not at all", score: 0 },
          { value: 1, label: "Several days", score: 1 },
          { value: 2, label: "More than half the days", score: 2 },
          { value: 3, label: "Nearly every day", score: 3 },
        ]},
        { id: "mh3", text: "Trouble falling or staying asleep, or sleeping too much", type: "multiple_choice", required: true, options: [
          { value: 0, label: "Not at all", score: 0 },
          { value: 1, label: "Several days", score: 1 },
          { value: 2, label: "More than half the days", score: 2 },
          { value: 3, label: "Nearly every day", score: 3 },
        ]},
        { id: "mh4", text: "Feeling tired or having little energy", type: "multiple_choice", required: true, options: [
          { value: 0, label: "Not at all", score: 0 },
          { value: 1, label: "Several days", score: 1 },
          { value: 2, label: "More than half the days", score: 2 },
          { value: 3, label: "Nearly every day", score: 3 },
        ]},
      ],
      scoringMethod: "sum",
      scoringThresholds: [
        { minScore: 0, maxScore: 4, severity: "normal", interpretation: "Minimal depression", alertProvider: false },
        { minScore: 5, maxScore: 9, severity: "mild", interpretation: "Mild depression - consider watchful waiting", alertProvider: false },
        { minScore: 10, maxScore: 14, severity: "moderate", interpretation: "Moderate depression - treatment may be warranted", alertProvider: true },
        { minScore: 15, maxScore: 27, severity: "severe", interpretation: "Severe depression - active treatment recommended", alertProvider: true },
      ],
      isActive: true,
      version: "1.0",
      createdAt: new Date(now.getTime() - 120 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
    };
    this.promQuestionnaires.set(mentalHealthPromId, mentalHealthProm);

    const diabetesPromId = randomUUID();
    const diabetesProm: PromQuestionnaire = {
      id: diabetesPromId,
      name: "Diabetes Self-Management Assessment",
      description: "Weekly check-in for diabetes management",
      category: "diabetes",
      conditionTargets: ["diabetes", "type 2 diabetes", "prediabetes"],
      questions: [
        { id: "d1", text: "How many days did you check your blood sugar this week?", type: "scale", required: true, minValue: 0, maxValue: 7, minLabel: "0 days", maxLabel: "7 days" },
        { id: "d2", text: "How well did you follow your medication schedule?", type: "scale", required: true, minValue: 0, maxValue: 10, minLabel: "Not at all", maxLabel: "Perfectly" },
        { id: "d3", text: "How well did you follow your diet plan?", type: "scale", required: true, minValue: 0, maxValue: 10, minLabel: "Not at all", maxLabel: "Perfectly" },
        { id: "d4", text: "Did you experience any episodes of low blood sugar?", type: "yes_no", required: true },
      ],
      scoringMethod: "weighted",
      scoringThresholds: [
        { minScore: 0, maxScore: 40, severity: "severe", interpretation: "Poor self-management - intervention needed", alertProvider: true },
        { minScore: 41, maxScore: 60, severity: "moderate", interpretation: "Moderate self-management - room for improvement", alertProvider: true },
        { minScore: 61, maxScore: 80, severity: "mild", interpretation: "Good self-management", alertProvider: false },
        { minScore: 81, maxScore: 100, severity: "normal", interpretation: "Excellent self-management", alertProvider: false },
      ],
      isActive: true,
      version: "1.0",
      createdAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
    };
    this.promQuestionnaires.set(diabetesPromId, diabetesProm);

    // Create PROM assignment for Sarah
    const painAssignmentId = randomUUID();
    const painAssignment: PatientPromAssignment = {
      id: painAssignmentId,
      patientId,
      questionnaireId: painPromId,
      frequency: "weekly",
      startDate: new Date(now.getTime() - 30 * 86400000).toISOString(),
      nextDueDate: new Date(now.getTime() - 2 * 86400000).toISOString(),
      assignedBy: "dr-chen-1",
      assignedByName: "Dr. Michael Chen",
      isActive: true,
      reminderEnabled: true,
      createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
    };
    this.patientPromAssignments.set(painAssignmentId, painAssignment);

    // Create some historical PROM responses
    const response1: PromResponse = {
      id: randomUUID(),
      patientId,
      assignmentId: painAssignmentId,
      questionnaireId: painPromId,
      questionnaireName: "Brief Pain Inventory (BPI)",
      answers: [
        { questionId: "q1", questionText: "Rate your worst pain", value: 4, displayValue: "4/10", score: 4 },
        { questionId: "q2", questionText: "Rate your average pain", value: 3, displayValue: "3/10", score: 3 },
        { questionId: "q3", questionText: "Impact on activities", value: 2, displayValue: "2/10", score: 2 },
        { questionId: "q4", questionText: "Impact on sleep", value: 3, displayValue: "3/10", score: 3 },
      ],
      totalScore: 12,
      maxPossibleScore: 40,
      percentageScore: 30,
      severity: "normal",
      interpretation: "Mild pain - well controlled",
      triggeredAlert: false,
      completedAt: new Date(now.getTime() - 21 * 86400000).toISOString(),
      timeToComplete: 180,
    };
    this.promResponses.set(response1.id, response1);

    const response2: PromResponse = {
      id: randomUUID(),
      patientId,
      assignmentId: painAssignmentId,
      questionnaireId: painPromId,
      questionnaireName: "Brief Pain Inventory (BPI)",
      answers: [
        { questionId: "q1", questionText: "Rate your worst pain", value: 5, displayValue: "5/10", score: 5 },
        { questionId: "q2", questionText: "Rate your average pain", value: 4, displayValue: "4/10", score: 4 },
        { questionId: "q3", questionText: "Impact on activities", value: 3, displayValue: "3/10", score: 3 },
        { questionId: "q4", questionText: "Impact on sleep", value: 4, displayValue: "4/10", score: 4 },
      ],
      totalScore: 16,
      maxPossibleScore: 40,
      percentageScore: 40,
      severity: "mild",
      interpretation: "Moderate pain - may need adjustment",
      triggeredAlert: false,
      completedAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
      timeToComplete: 150,
    };
    this.promResponses.set(response2.id, response2);

    const response3: PromResponse = {
      id: randomUUID(),
      patientId,
      assignmentId: painAssignmentId,
      questionnaireId: painPromId,
      questionnaireName: "Brief Pain Inventory (BPI)",
      answers: [
        { questionId: "q1", questionText: "Rate your worst pain", value: 6, displayValue: "6/10", score: 6 },
        { questionId: "q2", questionText: "Rate your average pain", value: 5, displayValue: "5/10", score: 5 },
        { questionId: "q3", questionText: "Impact on activities", value: 5, displayValue: "5/10", score: 5 },
        { questionId: "q4", questionText: "Impact on sleep", value: 5, displayValue: "5/10", score: 5 },
      ],
      totalScore: 21,
      maxPossibleScore: 40,
      percentageScore: 52.5,
      severity: "moderate",
      interpretation: "Significant pain - review recommended",
      triggeredAlert: true,
      completedAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
      timeToComplete: 200,
    };
    this.promResponses.set(response3.id, response3);

    // Create a provider alert based on worsening pain trend
    const alert1: ProviderAlert = {
      id: randomUUID(),
      patientId,
      patientName: "Sarah Johnson",
      providerId: "dr-chen-1",
      providerName: "Dr. Michael Chen",
      alertType: "prom_trend_change",
      severity: "medium",
      status: "new",
      title: "Worsening Pain Trend Detected",
      description: "Patient Sarah Johnson's pain scores have been increasing over the past 3 weeks. Latest BPI score: 52.5% (moderate severity).",
      details: {
        sourceType: "prom",
        sourceId: response3.id,
        currentValue: 52.5,
        previousValue: 30,
        trendDirection: "up",
        percentageChange: 75,
        relatedData: { questionnaireId: painPromId, questionnaireName: "Brief Pain Inventory (BPI)" },
      },
      recommendedActions: [
        "Review current pain management regimen",
        "Consider scheduling a follow-up appointment",
        "Evaluate for potential medication adjustment",
      ],
      aiAnalysis: "The patient's pain scores have shown a consistent upward trend over three consecutive assessments. This pattern suggests the current pain management approach may need adjustment. The increase in sleep interference is particularly notable and may be contributing to overall quality of life decline.",
      createdAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
    };
    this.providerAlerts.set(alert1.id, alert1);

    // Create Health Tips
    const tips: HealthTip[] = [
      {
        id: randomUUID(),
        title: "Managing Blood Pressure with Lifestyle Changes",
        content: "Along with your Lisinopril medication, these lifestyle changes can help optimize your blood pressure: Reduce sodium intake to less than 2,300mg daily, aim for 30 minutes of moderate exercise most days, limit alcohol consumption, and practice stress management techniques like deep breathing or meditation.",
        summary: "Simple lifestyle changes to help your blood pressure medication work even better.",
        category: "chronic_disease",
        format: "tip",
        targetConditions: ["hypertension", "high blood pressure"],
        targetMedications: ["Lisinopril", "ACE inhibitors"],
        readTimeMinutes: 3,
        isAiGenerated: true,
        aiPromptContext: "Based on patient's Lisinopril prescription",
        priority: 85,
        isActive: true,
        createdAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
        updatedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      },
      {
        id: randomUUID(),
        title: "Understanding Your Metformin",
        content: "Metformin works best when taken with meals. This helps reduce stomach upset and allows the medication to work with your body's natural insulin response to food. Remember to stay hydrated and limit alcohol consumption while taking this medication.",
        summary: "Tips for getting the most out of your diabetes medication.",
        category: "medication",
        format: "tip",
        targetConditions: ["diabetes", "type 2 diabetes"],
        targetMedications: ["Metformin"],
        readTimeMinutes: 2,
        isAiGenerated: false,
        priority: 80,
        isActive: true,
        createdAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
        updatedAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      },
      {
        id: randomUUID(),
        title: "Sleep Hygiene for Better Health",
        content: "Quality sleep is essential for managing chronic conditions. Try to maintain a consistent sleep schedule, keep your bedroom cool and dark, avoid screens for an hour before bed, and limit caffeine after noon. Good sleep can help reduce pain, improve mood, and support overall health.",
        summary: "Better sleep habits for improved health outcomes.",
        category: "sleep",
        format: "article",
        targetConditions: [],
        targetMedications: [],
        readTimeMinutes: 4,
        isAiGenerated: false,
        priority: 70,
        isActive: true,
        createdAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
        updatedAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
      },
      {
        id: randomUUID(),
        title: "Anti-Inflammatory Diet Basics",
        content: "An anti-inflammatory diet can help manage chronic pain and support overall health. Focus on colorful fruits and vegetables, fatty fish like salmon and mackerel, nuts and seeds, olive oil, and whole grains. Limit processed foods, red meat, and added sugars.",
        summary: "Foods that fight inflammation and support pain management.",
        category: "nutrition",
        format: "article",
        targetConditions: ["chronic pain", "arthritis", "inflammation"],
        targetMedications: [],
        readTimeMinutes: 5,
        isAiGenerated: true,
        priority: 75,
        isActive: true,
        createdAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
        updatedAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
      },
    ];
    
    for (const tip of tips) {
      this.healthTips.set(tip.id, tip);
    }

    // Deliver some tips to Sarah
    const patientTip1: PatientHealthTip = {
      id: randomUUID(),
      patientId,
      healthTipId: tips[0].id,
      reason: "Based on your Lisinopril prescription for blood pressure management",
      relevanceScore: 92,
      isRead: true,
      readAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
      isBookmarked: true,
      feedbackRating: 5,
      deliveredAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
    };
    this.patientHealthTips.set(patientTip1.id, patientTip1);

    const patientTip2: PatientHealthTip = {
      id: randomUUID(),
      patientId,
      healthTipId: tips[2].id,
      reason: "Sleep quality can significantly impact pain management",
      relevanceScore: 78,
      isRead: true,
      readAt: new Date(now.getTime() - 10 * 86400000).toISOString(),
      isBookmarked: false,
      deliveredAt: new Date(now.getTime() - 14 * 86400000).toISOString(),
    };
    this.patientHealthTips.set(patientTip2.id, patientTip2);

    const patientTip3: PatientHealthTip = {
      id: randomUUID(),
      patientId,
      healthTipId: tips[3].id,
      reason: "Anti-inflammatory diet may help with your pain management goals",
      relevanceScore: 85,
      isRead: false,
      isBookmarked: false,
      deliveredAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
    };
    this.patientHealthTips.set(patientTip3.id, patientTip3);

    // Create engagement metrics for Sarah
    const engagementMetrics: PatientEngagementMetrics = {
      patientId,
      promCompletionRate: 85,
      averageResponseTime: 180,
      streakDays: 12,
      tipsViewed: 8,
      tipsBookmarked: 2,
      lastActiveDate: new Date(now.getTime() - 1 * 86400000).toISOString(),
      engagementScore: 78,
      engagementTrend: "improving",
    };
    this.patientEngagementMetrics.set(patientId, engagementMetrics);
  }

  private createRecordForPatient(
    patientId: string, 
    ehrConnectionId: string, 
    data: { type: MedicalRecord['type']; title: string; description: string; provider: string; facility: string; status: MedicalRecord['status'] }
  ) {
    const id = randomUUID();
    this.medicalRecords.set(id, {
      id,
      patientId,
      ehrConnectionId,
      type: data.type,
      title: data.title,
      description: data.description,
      date: new Date(Date.now() - Math.random() * 60 * 86400000).toISOString(),
      provider: data.provider,
      facility: data.facility,
      status: data.status,
    });
  }

  private createMedicationForPatient(
    patientId: string,
    ehrConnectionId: string,
    data: { name: string; dosage: string; frequency: string; prescribedBy: string; status: Medication['status']; refills: number }
  ) {
    const id = randomUUID();
    this.medications.set(id, {
      id,
      patientId,
      ehrConnectionId,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      prescribedBy: data.prescribedBy,
      startDate: new Date(Date.now() - Math.random() * 180 * 86400000).toISOString(),
      status: data.status,
      refillsRemaining: data.refills,
    });
  }

  private createAppointmentForPatient(
    patientId: string,
    ehrConnectionId: string,
    data: { type: Appointment['type']; title: string; provider: string; facility: string; daysFromNow: number }
  ) {
    const id = randomUUID();
    this.appointments.set(id, {
      id,
      patientId,
      ehrConnectionId,
      type: data.type,
      title: data.title,
      provider: data.provider,
      facility: data.facility,
      scheduledAt: new Date(Date.now() + data.daysFromNow * 86400000).toISOString(),
      duration: 30,
      status: 'scheduled',
    });
  }

  private createAllergyForPatient(
    patientId: string,
    ehrConnectionId: string,
    data: { name: string; type: Allergy['type']; severity: Allergy['severity']; reaction: string; onsetDate?: string; status: Allergy['status'] }
  ) {
    const id = randomUUID();
    this.allergies.set(id, {
      id,
      patientId,
      ehrConnectionId,
      name: data.name,
      type: data.type,
      severity: data.severity,
      reaction: data.reaction,
      onsetDate: data.onsetDate,
      status: data.status,
    });
  }

  private createProblemForPatient(
    patientId: string,
    ehrConnectionId: string,
    data: { name: string; icdCode?: string; category: Problem['category']; status: Problem['status']; onsetDate?: string; resolvedDate?: string; diagnosedBy?: string; facility: string; notes?: string }
  ) {
    const id = randomUUID();
    this.problems.set(id, {
      id,
      patientId,
      ehrConnectionId,
      name: data.name,
      icdCode: data.icdCode,
      category: data.category,
      status: data.status,
      onsetDate: data.onsetDate,
      resolvedDate: data.resolvedDate,
      diagnosedBy: data.diagnosedBy,
      facility: data.facility,
      notes: data.notes,
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = insertUser.id || randomUUID();
    const now = new Date();
    const user: User = { 
      id,
      email: insertUser.email || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      role: insertUser.role || "patient",
      isActive: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      passwordHash: insertUser.passwordHash || null,
      authProvider: insertUser.authProvider || null,
      mfaRequired: insertUser.mfaRequired || null,
      passwordUpdatedAt: insertUser.passwordHash ? now : null,
      emailVerified: insertUser.emailVerified ?? false,
      status: insertUser.status || "active",
    };
    this.users.set(id, user);
    return user;
  }

  async updateUserRole(userId: string, role: User["role"]): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    user.role = role;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async updateUserLastLogin(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async updateUserPreferredLanguage(userId: string, languageCode: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    user.preferredLanguage = languageCode;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<Pick<User, "firstName" | "lastName" | "dateOfBirth" | "preferredLanguage">>,
  ): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    if (updates.firstName !== undefined) user.firstName = updates.firstName;
    if (updates.lastName !== undefined) user.lastName = updates.lastName;
    if (updates.dateOfBirth !== undefined) user.dateOfBirth = updates.dateOfBirth;
    if (updates.preferredLanguage !== undefined) user.preferredLanguage = updates.preferredLanguage;
    user.updatedAt = new Date();
    this.users.set(userId, user);
    return user;
  }

  // Profile Management (Family Health Records)
  async getProfiles(userId: string): Promise<Profile[]> {
    return Array.from(this.profiles.values()).filter(p => p.userId === userId);
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    return this.profiles.get(id);
  }

  async getDefaultProfile(userId: string): Promise<Profile | undefined> {
    return Array.from(this.profiles.values()).find(p => p.userId === userId && p.isDefault);
  }

  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // If this is the first profile for the user, make it default
    const existingProfiles = await this.getProfiles(insertProfile.userId);
    const isDefault = existingProfiles.length === 0 || insertProfile.isDefault || insertProfile.relationship === "self";
    
    // If setting this as default, unset other defaults
    if (isDefault) {
      for (const profile of existingProfiles) {
        if (profile.isDefault) {
          profile.isDefault = false;
          this.profiles.set(profile.id, profile);
        }
      }
    }
    
    const profile: Profile = {
      id,
      userId: insertProfile.userId,
      firstName: insertProfile.firstName,
      lastName: insertProfile.lastName,
      dateOfBirth: insertProfile.dateOfBirth || null,
      gender: insertProfile.gender || null,
      profileType: insertProfile.profileType || (insertProfile.relationship === "self" ? "self" : "child"),
      relationship: insertProfile.relationship,
      profileImageUrl: insertProfile.profileImageUrl || null,
      status: insertProfile.status || "active",
      isDefault,
      unifiedPatientId: insertProfile.unifiedPatientId || null,
      medicalRecordNumber: insertProfile.medicalRecordNumber || null,
      insuranceId: insertProfile.insuranceId || null,
      emergencyContact: insertProfile.emergencyContact || null,
      notes: insertProfile.notes || null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.profiles.set(id, profile);
    return profile;
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile | undefined> {
    const profile = this.profiles.get(id);
    if (!profile) return undefined;
    
    // If setting this as default, unset other defaults for same user
    if (updates.isDefault === true) {
      const userProfiles = await this.getProfiles(profile.userId);
      for (const p of userProfiles) {
        if (p.id !== id && p.isDefault) {
          p.isDefault = false;
          this.profiles.set(p.id, p);
        }
      }
    }
    
    const updated: Profile = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(id, updated);
    return updated;
  }

  async deleteProfile(id: string): Promise<void> {
    const profile = this.profiles.get(id);
    if (profile) {
      // Don't allow deleting the only profile or the default "self" profile
      const userProfiles = await this.getProfiles(profile.userId);
      if (userProfiles.length > 1 && !profile.isDefault) {
        this.profiles.delete(id);
      }
    }
  }

  async getActiveProfile(userId: string): Promise<Profile | undefined> {
    const activeProfileRecord = Array.from(this.userActiveProfiles.values()).find(uap => uap.userId === userId);
    if (activeProfileRecord) {
      return this.profiles.get(activeProfileRecord.activeProfileId);
    }
    // Fallback to default profile
    return this.getDefaultProfile(userId);
  }

  async setActiveProfile(userId: string, profileId: string): Promise<UserActiveProfile> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // Remove existing active profile record for this user
    for (const [key, value] of this.userActiveProfiles.entries()) {
      if (value.userId === userId) {
        this.userActiveProfiles.delete(key);
      }
    }
    
    const activeProfile: UserActiveProfile = {
      id,
      userId,
      activeProfileId: profileId,
      switchedAt: now,
    };
    
    this.userActiveProfiles.set(id, activeProfile);
    return activeProfile;
  }

  async getProfileSummaries(userId: string): Promise<ProfileSummary[]> {
    const profiles = await this.getProfiles(userId);
    const activeProfile = await this.getActiveProfile(userId);
    
    return profiles.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      profileType: p.profileType,
      relationship: p.relationship,
      profileImageUrl: p.profileImageUrl,
      isActive: activeProfile?.id === p.id,
      isDefault: p.isDefault,
      medsCount: Math.floor(Math.random() * 5),
      upcomingFollowUps: Math.floor(Math.random() * 3),
      hasCancerTrack: p.profileType === "self" && Math.random() > 0.7,
      hasVaccineRecord: Math.random() > 0.5,
    }));
  }

  async createProfileAnalyticsEvent(insertEvent: InsertProfileAnalyticsEvent): Promise<ProfileAnalyticsEvent> {
    const id = randomUUID();
    const event: ProfileAnalyticsEvent = {
      id,
      userId: insertEvent.userId,
      profileId: insertEvent.profileId,
      eventType: insertEvent.eventType,
      metadata: insertEvent.metadata || null,
      createdAt: new Date().toISOString(),
    };
    this.profileAnalyticsEvents.set(id, event);
    return event;
  }

  async getProfileAnalyticsEvents(userId: string, profileId?: string): Promise<ProfileAnalyticsEvent[]> {
    return Array.from(this.profileAnalyticsEvents.values())
      .filter(e => e.userId === userId && (!profileId || e.profileId === profileId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAuthAnalyticsEvent(insertEvent: InsertAuthAnalyticsEvent): Promise<AuthAnalyticsEvent> {
    const id = randomUUID();
    const event: AuthAnalyticsEvent = {
      id,
      userId: insertEvent.userId || null,
      eventType: insertEvent.eventType,
      metadata: insertEvent.metadata || null,
      ipAddress: insertEvent.ipAddress || null,
      userAgent: insertEvent.userAgent || null,
      createdAt: new Date(),
    };
    this.authAnalyticsEvents.set(id, event);
    return event;
  }

  async getAuthAnalyticsEvents(userId?: string, eventType?: string): Promise<AuthAnalyticsEvent[]> {
    return Array.from(this.authAnalyticsEvents.values())
      .filter(e => (!userId || e.userId === userId) && (!eventType || e.eventType === eventType))
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  // EHR Connections
  // F3 FIX (2026-04-18): EHR OAuth tokens are persisted in encrypted form
  // (see updateEhrConnectionTokens) and decrypted only when read out via
  // these getters. This sets the encryption boundary so a future migration
  // from in-memory Map to a Drizzle-backed table inherits the pattern.
  async getEhrConnections(userId?: string): Promise<EhrConnection[]> {
    const connections = Array.from(this.ehrConnections.values()).map(
      (c) => decryptConnectionFromStorage(c, "ehrConnection")!,
    );
    if (userId) {
      return connections.filter(c => c.userId === userId || c.userId === "current-user");
    }
    return connections;
  }

  async getEhrConnection(id: string): Promise<EhrConnection | undefined> {
    const raw = this.ehrConnections.get(id);
    return decryptConnectionFromStorage(raw, "ehrConnection");
  }

  async createEhrConnection(connection: InsertEhrConnection): Promise<EhrConnection> {
    const id = randomUUID();
    const newConnection: EhrConnection = {
      ...connection,
      id,
      status: connection.status || 'pending_auth',
      lastSync: new Date().toISOString(),
      patientCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.ehrConnections.set(id, newConnection);
    return newConnection;
  }

  async updateEhrConnection(id: string, updates: Partial<EhrConnection>): Promise<EhrConnection | undefined> {
    const connection = this.ehrConnections.get(id);
    if (!connection) return undefined;
    const updated = { ...connection, ...updates };
    this.ehrConnections.set(id, updated);
    return updated;
  }

  async updateEhrConnectionTokens(
    id: string, 
    tokens: OAuthTokens, 
    smartContext?: SmartLaunchContext
  ): Promise<EhrConnection | undefined> {
    const connection = this.ehrConnections.get(id);
    if (!connection) return undefined;
    // F3 FIX (2026-04-18): encrypt OAuth tokens before storing.
    // Decryption happens transparently in getEhrConnection / getEhrConnections.
    const updatedPlain: EhrConnection = {
      ...decryptConnectionFromStorage(connection, "ehrConnection")!,
      tokens,
      smartContext: smartContext || connection.smartContext,
      status: "connected",
      syncError: undefined,
    };
    this.ehrConnections.set(id, encryptConnectionForStorage(updatedPlain, "ehrConnection"));
    return updatedPlain;
  }

  async deleteEhrConnection(id: string): Promise<void> {
    this.ehrConnections.delete(id);
    await this.deletePatientsByConnection(id);
  }

  // OAuth Pending State
  async createOAuthPendingState(
    state: Omit<OAuthPendingState, "id" | "createdAt" | "expiresAt">
  ): Promise<OAuthPendingState> {
    const id = randomUUID();
    const now = new Date();
    const pendingState: OAuthPendingState = {
      ...state,
      id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), // 10 min expiry
    };
    this.oauthPendingStates.set(state.state, pendingState);
    return pendingState;
  }

  async getOAuthPendingState(state: string): Promise<OAuthPendingState | undefined> {
    const pendingState = this.oauthPendingStates.get(state);
    if (!pendingState) return undefined;
    if (new Date(pendingState.expiresAt) < new Date()) {
      this.oauthPendingStates.delete(state);
      return undefined;
    }
    return pendingState;
  }

  async deleteOAuthPendingState(state: string): Promise<void> {
    this.oauthPendingStates.delete(state);
  }

  async cleanupExpiredOAuthStates(): Promise<void> {
    const now = new Date();
    for (const [state, pendingState] of this.oauthPendingStates) {
      if (new Date(pendingState.expiresAt) < now) {
        this.oauthPendingStates.delete(state);
      }
    }
  }

  // Unified Patients
  async getUnifiedPatients(): Promise<UnifiedPatient[]> {
    return Array.from(this.unifiedPatients.values());
  }

  async getUnifiedPatient(id: string): Promise<UnifiedPatient | undefined> {
    return this.unifiedPatients.get(id);
  }

  async getAggregatedPatientData(unifiedPatientId: string): Promise<AggregatedPatientData | undefined> {
    const unifiedPatient = this.unifiedPatients.get(unifiedPatientId);
    if (!unifiedPatient) return undefined;

    // Get all patient records linked to this unified patient
    const patientIds = unifiedPatient.ehrSources.map(s => s.patientId);

    // Aggregate records from all sources with source information
    const records = Array.from(this.medicalRecords.values())
      .filter(r => patientIds.includes(r.patientId))
      .map(r => {
        const connection = this.ehrConnections.get(r.ehrConnectionId);
        return {
          ...r,
          sourceFacility: connection?.facilityName || 'Unknown',
          sourcePlatform: connection?.platform || 'unknown',
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const medications = Array.from(this.medications.values())
      .filter(m => patientIds.includes(m.patientId))
      .map(m => {
        const connection = this.ehrConnections.get(m.ehrConnectionId);
        return {
          ...m,
          sourceFacility: connection?.facilityName || 'Unknown',
          sourcePlatform: connection?.platform || 'unknown',
        };
      })
      .sort((a, b) => (a.status === 'active' ? -1 : 1));

    const vitals = Array.from(this.vitals.values())
      .filter(v => patientIds.includes(v.patientId))
      .map(v => {
        const connection = this.ehrConnections.get(v.ehrConnectionId);
        return {
          ...v,
          sourceFacility: connection?.facilityName || 'Unknown',
          sourcePlatform: connection?.platform || 'unknown',
        };
      })
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    const appointments = Array.from(this.appointments.values())
      .filter(a => patientIds.includes(a.patientId))
      .map(a => {
        const connection = this.ehrConnections.get(a.ehrConnectionId);
        return {
          ...a,
          sourceFacility: connection?.facilityName || 'Unknown',
          sourcePlatform: connection?.platform || 'unknown',
        };
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    return {
      unifiedPatient,
      records,
      medications,
      vitals,
      appointments,
    };
  }

  // Patients
  async getPatients(limit?: number): Promise<Patient[]> {
    const all = Array.from(this.patients.values());
    return limit ? all.slice(0, limit) : all;
  }

  async getPatientsByConnection(connectionId: string): Promise<Patient[]> {
    return Array.from(this.patients.values()).filter(p => p.ehrConnectionId === connectionId);
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    return this.patients.get(id);
  }

  async getPatientsByUnifiedId(unifiedPatientId: string): Promise<Patient[]> {
    return Array.from(this.patients.values()).filter(p => p.unifiedPatientId === unifiedPatientId);
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const id = randomUUID();
    const unifiedPatientId = patient.unifiedPatientId || randomUUID();
    const newPatient: Patient = { ...patient, id, unifiedPatientId };
    this.patients.set(id, newPatient);
    return newPatient;
  }

  async deletePatientsByConnection(connectionId: string): Promise<void> {
    const patientsToDelete = Array.from(this.patients.values()).filter(p => p.ehrConnectionId === connectionId);
    for (const patient of patientsToDelete) {
      this.patients.delete(patient.id);
      // Delete associated records
      Array.from(this.medicalRecords.values())
        .filter(r => r.patientId === patient.id)
        .forEach(r => this.medicalRecords.delete(r.id));
      Array.from(this.medications.values())
        .filter(m => m.patientId === patient.id)
        .forEach(m => this.medications.delete(m.id));
      Array.from(this.vitals.values())
        .filter(v => v.patientId === patient.id)
        .forEach(v => this.vitals.delete(v.id));
      Array.from(this.appointments.values())
        .filter(a => a.patientId === patient.id)
        .forEach(a => this.appointments.delete(a.id));
    }
  }

  // Medical Records
  async getMedicalRecordsByPatient(patientId: string): Promise<MedicalRecord[]> {
    return Array.from(this.medicalRecords.values())
      .filter(r => r.patientId === patientId && r.status !== 'deleted')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getMedicalRecordsByUnifiedPatient(unifiedPatientId: string): Promise<MedicalRecord[]> {
    const patients = await this.getPatientsByUnifiedId(unifiedPatientId);
    const patientIds = patients.map(p => p.id);
    return Array.from(this.medicalRecords.values())
      .filter(r => patientIds.includes(r.patientId) && r.status !== 'deleted')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord> {
    const id = randomUUID();
    const newRecord: MedicalRecord = { ...record, id, status: record.status || 'active' };
    this.medicalRecords.set(id, newRecord);
    return newRecord;
  }

  async getMedicalRecord(id: string): Promise<MedicalRecord | undefined> {
    return this.medicalRecords.get(id);
  }

  async softDeleteMedicalRecord(id: string, deletedBy: string): Promise<boolean> {
    const record = this.medicalRecords.get(id);
    if (!record) {
      return false;
    }
    // Soft delete - mark as deleted but keep for audit trail
    const deletedRecord: MedicalRecord = {
      ...record,
      status: 'deleted',
    };
    this.medicalRecords.set(id, deletedRecord);
    console.log(`[Storage] Soft deleted medical record ${id} by user ${deletedBy} at ${new Date().toISOString()}`);
    return true;
  }

  // Ownership-scoped methods for IDOR protection
  async getUserPatientIds(userId: string): Promise<string[]> {
    // Get all EHR connections for this user
    const connections = await this.getEhrConnections(userId);
    const connectionIds = connections.map(c => c.id);
    
    // Get all patients linked to those connections
    const patients: Patient[] = [];
    for (const connId of connectionIds) {
      const connPatients = await this.getPatientsByConnection(connId);
      patients.push(...connPatients);
    }
    
    return patients.map(p => p.id);
  }

  async getMedicalRecordForUser(userId: string, id: string): Promise<MedicalRecord | undefined> {
    const record = this.medicalRecords.get(id);
    if (!record || record.status === 'deleted') {
      return undefined;
    }
    
    // Verify ownership
    const userPatientIds = await this.getUserPatientIds(userId);
    if (!userPatientIds.includes(record.patientId)) {
      return undefined; // User doesn't own this record
    }
    
    return record;
  }

  async updateMedicalRecordForUser(userId: string, id: string, updates: Partial<MedicalRecord>): Promise<MedicalRecord | undefined> {
    const record = await this.getMedicalRecordForUser(userId, id);
    if (!record) {
      return undefined; // Record doesn't exist or user doesn't own it
    }
    
    // Don't allow changing patientId or id
    const { id: _id, patientId: _patientId, ...safeUpdates } = updates;
    const updatedRecord: MedicalRecord = {
      ...record,
      ...safeUpdates,
    };
    this.medicalRecords.set(id, updatedRecord);
    console.log(`[Storage] Updated medical record ${id} by user ${userId} at ${new Date().toISOString()}`);
    return updatedRecord;
  }

  async deleteMedicalRecordForUser(userId: string, id: string): Promise<boolean> {
    const record = await this.getMedicalRecordForUser(userId, id);
    if (!record) {
      return false; // Record doesn't exist or user doesn't own it
    }
    
    // Soft delete
    const deletedRecord: MedicalRecord = {
      ...record,
      status: 'deleted',
    };
    this.medicalRecords.set(id, deletedRecord);
    console.log(`[Storage] User-scoped soft delete of medical record ${id} by user ${userId} at ${new Date().toISOString()}`);
    return true;
  }

  // Medications
  async getMedicationsByPatient(patientId: string): Promise<Medication[]> {
    return Array.from(this.medications.values())
      .filter(m => m.patientId === patientId)
      .sort((a, b) => (a.status === 'active' ? -1 : 1));
  }

  async getMedicationsByUnifiedPatient(unifiedPatientId: string): Promise<Medication[]> {
    const patients = await this.getPatientsByUnifiedId(unifiedPatientId);
    const patientIds = patients.map(p => p.id);
    return Array.from(this.medications.values())
      .filter(m => patientIds.includes(m.patientId))
      .sort((a, b) => (a.status === 'active' ? -1 : 1));
  }

  async createMedication(medication: InsertMedication): Promise<Medication> {
    const id = randomUUID();
    const newMed: Medication = { ...medication, id, status: medication.status || 'active', refillsRemaining: medication.refillsRemaining || 0 };
    this.medications.set(id, newMed);
    return newMed;
  }

  async getMedication(id: string): Promise<Medication | undefined> {
    return this.medications.get(id);
  }

  async updateMedication(id: string, updates: Partial<Medication>): Promise<Medication | undefined> {
    const medication = this.medications.get(id);
    if (!medication) return undefined;
    const updated = { ...medication, ...updates };
    this.medications.set(id, updated);
    return updated;
  }

  // Vital Signs
  async getVitalsByPatient(patientId: string): Promise<VitalSign[]> {
    return Array.from(this.vitals.values())
      .filter(v => v.patientId === patientId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getVitalsByUnifiedPatient(unifiedPatientId: string): Promise<VitalSign[]> {
    const patients = await this.getPatientsByUnifiedId(unifiedPatientId);
    const patientIds = patients.map(p => p.id);
    return Array.from(this.vitals.values())
      .filter(v => patientIds.includes(v.patientId))
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async createVitalSign(vital: InsertVitalSign): Promise<VitalSign> {
    const id = randomUUID();
    const newVital: VitalSign = { ...vital, id };
    this.vitals.set(id, newVital);
    return newVital;
  }

  // Lab Results
  async getLabResults(): Promise<LabResult[]> {
    return Array.from(this.labResults.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getLabResultsByPatient(patientId: string): Promise<LabResult[]> {
    return Array.from(this.labResults.values())
      .filter(l => l.patientId === patientId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getLabResultsByUnifiedPatient(unifiedPatientId: string): Promise<LabResult[]> {
    const patients = await this.getPatientsByUnifiedId(unifiedPatientId);
    const patientIds = patients.map(p => p.id);
    return Array.from(this.labResults.values())
      .filter(l => patientIds.includes(l.patientId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async createLabResult(lab: InsertLabResult): Promise<LabResult> {
    const id = randomUUID();
    const newLab: LabResult = { ...lab, id };
    this.labResults.set(id, newLab);
    return newLab;
  }

  // Immunizations
  async getImmunizations(patientId: string): Promise<Immunization[]> {
    return Array.from(this.immunizations.values())
      .filter(i => i.patientId === patientId)
      .sort((a, b) => new Date(b.administeredDate).getTime() - new Date(a.administeredDate).getTime());
  }

  async getImmunization(id: string): Promise<Immunization | undefined> {
    return this.immunizations.get(id);
  }

  async createImmunization(immunization: InsertImmunization): Promise<Immunization> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newImmunization: Immunization = { 
      ...immunization, 
      id, 
      createdAt: now,
      status: immunization.status || "completed"
    };
    this.immunizations.set(id, newImmunization);
    return newImmunization;
  }

  async updateImmunization(id: string, updates: Partial<Immunization>): Promise<Immunization | undefined> {
    const existing = this.immunizations.get(id);
    if (!existing) return undefined;
    const updated: Immunization = { 
      ...existing, 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    this.immunizations.set(id, updated);
    return updated;
  }

  async deleteImmunization(id: string): Promise<void> {
    this.immunizations.delete(id);
  }

  // Advanced Health Metrics
  async getAdvancedHealthMetrics(patientId: string): Promise<AdvancedHealthMetric[]> {
    return Array.from(this.advancedHealthMetrics.values())
      .filter(m => m.patientId === patientId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getAdvancedHealthMetricsByType(patientId: string, metricType: AdvancedMetricType): Promise<AdvancedHealthMetric[]> {
    return Array.from(this.advancedHealthMetrics.values())
      .filter(m => m.patientId === patientId && m.metricType === metricType)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }

  async getAdvancedHealthMetric(id: string): Promise<AdvancedHealthMetric | undefined> {
    return this.advancedHealthMetrics.get(id);
  }

  async createAdvancedHealthMetric(metric: InsertAdvancedHealthMetric): Promise<AdvancedHealthMetric> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newMetric: AdvancedHealthMetric = { 
      ...metric, 
      id, 
      createdAt: now,
      status: metric.status || "normal"
    };
    this.advancedHealthMetrics.set(id, newMetric);
    return newMetric;
  }

  async deleteAdvancedHealthMetric(id: string): Promise<void> {
    this.advancedHealthMetrics.delete(id);
  }

  // Condition-Specific PROMs
  async getConditionSpecificPROMs(patientId: string): Promise<ConditionSpecificPROM[]> {
    return Array.from(this.conditionSpecificPROMs.values())
      .filter(p => p.patientId === patientId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getConditionSpecificPROMsByCondition(patientId: string, conditionType: string): Promise<ConditionSpecificPROM[]> {
    return Array.from(this.conditionSpecificPROMs.values())
      .filter(p => p.patientId === patientId && p.conditionType === conditionType)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getConditionSpecificPROM(id: string): Promise<ConditionSpecificPROM | undefined> {
    return this.conditionSpecificPROMs.get(id);
  }

  async createConditionSpecificPROM(prom: InsertConditionSpecificPROM): Promise<ConditionSpecificPROM> {
    const id = randomUUID();
    const newPROM: ConditionSpecificPROM = { ...prom, id };
    this.conditionSpecificPROMs.set(id, newPROM);
    return newPROM;
  }

  async updateConditionSpecificPROM(id: string, updates: Partial<ConditionSpecificPROM>): Promise<ConditionSpecificPROM | undefined> {
    const existing = this.conditionSpecificPROMs.get(id);
    if (!existing) return undefined;
    const updated: ConditionSpecificPROM = { ...existing, ...updates };
    this.conditionSpecificPROMs.set(id, updated);
    return updated;
  }

  // Document Insights
  async getDocumentInsights(documentId: string): Promise<DocumentInsight | undefined> {
    return Array.from(this.documentInsights.values()).find(i => i.documentId === documentId);
  }

  async getDocumentInsightsByPatient(patientId: string): Promise<DocumentInsight[]> {
    return Array.from(this.documentInsights.values())
      .filter(i => i.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createDocumentInsight(insight: InsertDocumentInsight): Promise<DocumentInsight> {
    const id = randomUUID();
    const newInsight: DocumentInsight = {
      ...insight,
      id,
      createdAt: new Date().toISOString(),
    };
    this.documentInsights.set(id, newInsight);
    return newInsight;
  }

  async deleteDocumentInsight(id: string): Promise<boolean> {
    return this.documentInsights.delete(id);
  }

  // Health Monitoring Alerts
  async getHealthMonitoringAlerts(filters?: { patientId?: string; status?: string; severity?: string }): Promise<HealthMonitoringAlert[]> {
    let alerts = Array.from(this.healthMonitoringAlerts.values());
    if (filters?.patientId) {
      alerts = alerts.filter(a => a.patientId === filters.patientId);
    }
    if (filters?.status) {
      alerts = alerts.filter(a => a.status === filters.status);
    }
    if (filters?.severity) {
      alerts = alerts.filter(a => a.severity === filters.severity);
    }
    return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getHealthMonitoringAlert(id: string): Promise<HealthMonitoringAlert | undefined> {
    return this.healthMonitoringAlerts.get(id);
  }

  async createHealthMonitoringAlert(alert: InsertHealthMonitoringAlert): Promise<HealthMonitoringAlert> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newAlert: HealthMonitoringAlert = {
      ...alert,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.healthMonitoringAlerts.set(id, newAlert);
    return newAlert;
  }

  async updateHealthMonitoringAlert(id: string, updates: Partial<HealthMonitoringAlert>): Promise<HealthMonitoringAlert | undefined> {
    const alert = this.healthMonitoringAlerts.get(id);
    if (!alert) return undefined;
    const updated: HealthMonitoringAlert = {
      ...alert,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.healthMonitoringAlerts.set(id, updated);
    return updated;
  }

  async acknowledgeHealthAlert(id: string, userId: string, userName: string): Promise<HealthMonitoringAlert | undefined> {
    const alert = this.healthMonitoringAlerts.get(id);
    if (!alert) return undefined;
    const updated: HealthMonitoringAlert = {
      ...alert,
      status: "acknowledged" as HealthAlertStatus,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: userId,
      assignedTo: userId,
      assignedToName: userName,
      updatedAt: new Date().toISOString(),
    };
    this.healthMonitoringAlerts.set(id, updated);
    return updated;
  }

  async resolveHealthAlert(id: string, userId: string, notes: string): Promise<HealthMonitoringAlert | undefined> {
    const alert = this.healthMonitoringAlerts.get(id);
    if (!alert) return undefined;
    const updated: HealthMonitoringAlert = {
      ...alert,
      status: "resolved" as HealthAlertStatus,
      resolvedAt: new Date().toISOString(),
      resolvedBy: userId,
      resolutionNotes: notes,
      updatedAt: new Date().toISOString(),
    };
    this.healthMonitoringAlerts.set(id, updated);
    return updated;
  }

  async escalateHealthAlert(id: string, escalatedTo: string): Promise<HealthMonitoringAlert | undefined> {
    const alert = this.healthMonitoringAlerts.get(id);
    if (!alert) return undefined;
    const updated: HealthMonitoringAlert = {
      ...alert,
      status: "escalated" as HealthAlertStatus,
      escalatedTo,
      escalatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.healthMonitoringAlerts.set(id, updated);
    return updated;
  }

  // Intervention Recommendations
  async getInterventionRecommendations(filters?: { patientId?: string; alertId?: string; status?: string }): Promise<InterventionRecommendation[]> {
    let interventions = Array.from(this.interventionRecommendations.values());
    if (filters?.patientId) {
      interventions = interventions.filter(i => i.patientId === filters.patientId);
    }
    if (filters?.alertId) {
      interventions = interventions.filter(i => i.alertId === filters.alertId);
    }
    if (filters?.status) {
      interventions = interventions.filter(i => i.status === filters.status);
    }
    return interventions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInterventionRecommendation(id: string): Promise<InterventionRecommendation | undefined> {
    return this.interventionRecommendations.get(id);
  }

  async createInterventionRecommendation(intervention: InsertInterventionRecommendation): Promise<InterventionRecommendation> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newIntervention: InterventionRecommendation = {
      ...intervention,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.interventionRecommendations.set(id, newIntervention);
    return newIntervention;
  }

  async updateInterventionRecommendation(id: string, updates: Partial<InterventionRecommendation>): Promise<InterventionRecommendation | undefined> {
    const intervention = this.interventionRecommendations.get(id);
    if (!intervention) return undefined;
    const updated: InterventionRecommendation = {
      ...intervention,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.interventionRecommendations.set(id, updated);
    return updated;
  }

  async approveIntervention(id: string, userId: string): Promise<InterventionRecommendation | undefined> {
    const intervention = this.interventionRecommendations.get(id);
    if (!intervention) return undefined;
    const updated: InterventionRecommendation = {
      ...intervention,
      status: "approved" as InterventionStatus,
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.interventionRecommendations.set(id, updated);
    return updated;
  }

  async completeIntervention(id: string, userId: string, notes: string): Promise<InterventionRecommendation | undefined> {
    const intervention = this.interventionRecommendations.get(id);
    if (!intervention) return undefined;
    const updated: InterventionRecommendation = {
      ...intervention,
      status: "completed" as InterventionStatus,
      completedBy: userId,
      completedAt: new Date().toISOString(),
      outcomeNotes: notes,
      updatedAt: new Date().toISOString(),
    };
    this.interventionRecommendations.set(id, updated);
    return updated;
  }

  // Allergies
  async getAllergies(): Promise<Allergy[]> {
    return Array.from(this.allergies.values());
  }

  async getAllergiesByPatient(patientId: string): Promise<Allergy[]> {
    return Array.from(this.allergies.values()).filter(a => a.patientId === patientId);
  }

  async getAllergiesByUnifiedPatient(unifiedPatientId: string): Promise<Allergy[]> {
    const patients = await this.getPatientsByUnifiedId(unifiedPatientId);
    const patientIds = patients.map(p => p.id);
    return Array.from(this.allergies.values()).filter(a => patientIds.includes(a.patientId));
  }

  async createAllergy(allergy: InsertAllergy): Promise<Allergy> {
    const id = randomUUID();
    const newAllergy: Allergy = { ...allergy, id };
    this.allergies.set(id, newAllergy);
    return newAllergy;
  }

  // Problems (Conditions)
  async getProblems(): Promise<Problem[]> {
    return Array.from(this.problems.values());
  }

  async getProblemsByPatient(patientId: string): Promise<Problem[]> {
    return Array.from(this.problems.values()).filter(p => p.patientId === patientId);
  }

  async getProblemsByUnifiedPatient(unifiedPatientId: string): Promise<Problem[]> {
    const patients = await this.getPatientsByUnifiedId(unifiedPatientId);
    const patientIds = patients.map(p => p.id);
    return Array.from(this.problems.values()).filter(p => patientIds.includes(p.patientId));
  }

  async createProblem(problem: InsertProblem): Promise<Problem> {
    const id = randomUUID();
    const newProblem: Problem = { ...problem, id };
    this.problems.set(id, newProblem);
    return newProblem;
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  async getUpcomingAppointments(): Promise<(Appointment & { patientName: string })[]> {
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 86400000);
    
    return Array.from(this.appointments.values())
      .filter(a => {
        const date = new Date(a.scheduledAt);
        return date >= now && date <= twoWeeksFromNow && a.status === 'scheduled';
      })
      .map(a => {
        const patient = this.patients.get(a.patientId);
        return {
          ...a,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
        };
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
    const newAppointment: Appointment = { ...appointment, id, status: appointment.status || 'scheduled' };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }

  // Caregivers
  async getCaregivers(patientUserId: string): Promise<Caregiver[]> {
    return Array.from(this.caregivers.values())
      .filter(c => c.patientUserId === patientUserId)
      .sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());
  }

  async getCaregivingFor(caregiverUserId: string): Promise<(Caregiver & { patient: User | undefined })[]> {
    return Array.from(this.caregivers.values())
      .filter(c => c.caregiverUserId === caregiverUserId && c.status === 'accepted')
      .map(c => ({
        ...c,
        patient: this.users.get(c.patientUserId),
      }));
  }

  async getCaregiver(id: string): Promise<Caregiver | undefined> {
    return this.caregivers.get(id);
  }

  async getCaregiverByToken(token: string): Promise<Caregiver | undefined> {
    return Array.from(this.caregivers.values()).find(c => c.inviteToken === token);
  }

  async createCaregiver(caregiver: InsertCaregiver): Promise<Caregiver> {
    const id = randomUUID();
    const inviteToken = randomUUID();
    const now = new Date().toISOString();
    const newCaregiver: Caregiver = {
      id,
      patientUserId: caregiver.patientUserId,
      caregiverUserId: null,
      caregiverEmail: caregiver.caregiverEmail,
      caregiverName: caregiver.caregiverName || null,
      relationship: caregiver.relationship,
      status: 'pending',
      permissions: caregiver.permissions || ["view_medications", "view_appointments", "view_allergies"],
      accessRestriction: caregiver.accessRestriction || "none",
      accessExpiresAt: caregiver.accessExpiresAt || null,
      requiresApprovalFor: caregiver.requiresApprovalFor || [],
      sensitiveDataAccess: caregiver.sensitiveDataAccess || false,
      notifyPatientOnAccess: caregiver.notifyPatientOnAccess !== false,
      emergencyAccessEnabled: caregiver.emergencyAccessEnabled || false,
      lastAccessAt: null,
      inviteToken,
      invitedAt: now,
      acceptedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.caregivers.set(id, newCaregiver);
    return newCaregiver;
  }

  async updateCaregiver(id: string, updates: Partial<Caregiver>): Promise<Caregiver | undefined> {
    const caregiver = this.caregivers.get(id);
    if (!caregiver) return undefined;
    const updated = { ...caregiver, ...updates, updatedAt: new Date().toISOString() };
    this.caregivers.set(id, updated);
    return updated;
  }

  async updateCaregiverPermissions(id: string, patientUserId: string, permissions: import("@shared/schema").UpdateCaregiverPermissions): Promise<Caregiver | undefined> {
    const caregiver = this.caregivers.get(id);
    if (!caregiver || caregiver.patientUserId !== patientUserId) return undefined;
    const updated: Caregiver = {
      ...caregiver,
      permissions: permissions.permissions,
      accessRestriction: permissions.accessRestriction ?? caregiver.accessRestriction,
      accessExpiresAt: permissions.accessExpiresAt !== undefined ? permissions.accessExpiresAt : caregiver.accessExpiresAt,
      requiresApprovalFor: permissions.requiresApprovalFor ?? caregiver.requiresApprovalFor,
      sensitiveDataAccess: permissions.sensitiveDataAccess ?? caregiver.sensitiveDataAccess,
      notifyPatientOnAccess: permissions.notifyPatientOnAccess ?? caregiver.notifyPatientOnAccess,
      emergencyAccessEnabled: permissions.emergencyAccessEnabled ?? caregiver.emergencyAccessEnabled,
      updatedAt: new Date().toISOString(),
    };
    this.caregivers.set(id, updated);
    return updated;
  }

  async suspendCaregiver(id: string, patientUserId: string, reason: string): Promise<Caregiver | undefined> {
    const caregiver = this.caregivers.get(id);
    if (!caregiver || caregiver.patientUserId !== patientUserId) return undefined;
    const now = new Date().toISOString();
    const updated: Caregiver = {
      ...caregiver,
      status: "suspended",
      suspendedAt: now,
      suspensionReason: reason,
      updatedAt: now,
    };
    this.caregivers.set(id, updated);
    return updated;
  }

  async reinstateCaregiver(id: string, patientUserId: string): Promise<Caregiver | undefined> {
    const caregiver = this.caregivers.get(id);
    if (!caregiver || caregiver.patientUserId !== patientUserId) return undefined;
    const updated: Caregiver = {
      ...caregiver,
      status: "accepted",
      suspendedAt: null,
      suspensionReason: null,
      updatedAt: new Date().toISOString(),
    };
    this.caregivers.set(id, updated);
    return updated;
  }

  async deleteCaregiver(id: string, patientUserId: string): Promise<void> {
    const caregiver = this.caregivers.get(id);
    if (caregiver && caregiver.patientUserId === patientUserId) {
      this.caregivers.delete(id);
    }
  }

  // Caregiver Access Logs
  async getCaregiverAccessLogs(patientUserId: string, filters?: { caregiverId?: string; resourceType?: string; limit?: number }): Promise<import("@shared/schema").CaregiverAccessLog[]> {
    let logs = Array.from(this.caregiverAccessLogs.values())
      .filter(log => log.patientUserId === patientUserId);
    
    if (filters?.caregiverId) {
      logs = logs.filter(log => log.caregiverId === filters.caregiverId);
    }
    if (filters?.resourceType) {
      logs = logs.filter(log => log.resourceType === filters.resourceType);
    }
    
    logs.sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());
    
    if (filters?.limit) {
      logs = logs.slice(0, filters.limit);
    }
    
    return logs;
  }

  async createCaregiverAccessLog(log: import("@shared/schema").InsertCaregiverAccessLog): Promise<import("@shared/schema").CaregiverAccessLog> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newLog: import("@shared/schema").CaregiverAccessLog = {
      id,
      caregiverId: log.caregiverId,
      caregiverName: log.caregiverName,
      patientUserId: log.patientUserId,
      accessType: log.accessType,
      resourceType: log.resourceType,
      resourceId: log.resourceId || null,
      action: log.action,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
      approved: log.approved !== false,
      emergencyOverride: log.emergencyOverride || false,
      patientNotified: log.patientNotified || false,
      accessedAt: now,
    };
    this.caregiverAccessLogs.set(id, newLog);
    return newLog;
  }

  // Caregiver Access Requests
  async getCaregiverAccessRequests(patientUserId: string, status?: string): Promise<import("@shared/schema").CaregiverAccessRequest[]> {
    let requests = Array.from(this.caregiverAccessRequests.values())
      .filter(r => r.patientUserId === patientUserId);
    
    if (status) {
      requests = requests.filter(r => r.status === status);
    }
    
    return requests.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async getCaregiverAccessRequest(id: string): Promise<import("@shared/schema").CaregiverAccessRequest | undefined> {
    return this.caregiverAccessRequests.get(id);
  }

  async createCaregiverAccessRequest(request: import("@shared/schema").InsertCaregiverAccessRequest): Promise<import("@shared/schema").CaregiverAccessRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const newRequest: import("@shared/schema").CaregiverAccessRequest = {
      id,
      caregiverId: request.caregiverId,
      caregiverName: request.caregiverName,
      patientUserId: request.patientUserId,
      requestedPermission: request.requestedPermission,
      reason: request.reason,
      status: "pending",
      requestedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      expiresAt,
    };
    this.caregiverAccessRequests.set(id, newRequest);
    return newRequest;
  }

  async reviewCaregiverAccessRequest(id: string, patientUserId: string, approved: boolean, notes?: string): Promise<import("@shared/schema").CaregiverAccessRequest | undefined> {
    const request = this.caregiverAccessRequests.get(id);
    if (!request || request.patientUserId !== patientUserId) return undefined;
    
    const now = new Date().toISOString();
    const updated: import("@shared/schema").CaregiverAccessRequest = {
      ...request,
      status: approved ? "approved" : "denied",
      reviewedAt: now,
      reviewedBy: patientUserId,
      reviewNotes: notes || null,
    };
    this.caregiverAccessRequests.set(id, updated);
    return updated;
  }

  // Two-Factor Authentication
  async getTwoFactorAuth(userId: string): Promise<TwoFactorAuth | undefined> {
    return Array.from(this.twoFactorAuths.values()).find(t => t.userId === userId);
  }

  async createTwoFactorAuth(tfa: InsertTwoFactorAuth): Promise<TwoFactorAuth> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const backupCodes = Array.from({ length: 10 }, () => 
      randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
    );
    const newTfa: TwoFactorAuth = {
      id,
      userId: tfa.userId,
      secret: tfa.secret,
      enabled: false,
      verifiedAt: null,
      backupCodes,
      createdAt: now,
      updatedAt: now,
    };
    this.twoFactorAuths.set(id, newTfa);
    return newTfa;
  }

  async updateTwoFactorAuth(userId: string, updates: Partial<TwoFactorAuth>): Promise<TwoFactorAuth | undefined> {
    const tfa = await this.getTwoFactorAuth(userId);
    if (!tfa) return undefined;
    const updated = { ...tfa, ...updates, updatedAt: new Date().toISOString() };
    this.twoFactorAuths.set(tfa.id, updated);
    return updated;
  }

  async deleteTwoFactorAuth(userId: string): Promise<void> {
    const tfa = await this.getTwoFactorAuth(userId);
    if (tfa) {
      this.twoFactorAuths.delete(tfa.id);
    }
  }

  // User Sessions
  async getUserSessions(userId: string): Promise<UserSession[]> {
    return Array.from(this.userSessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  async getUserSession(id: string): Promise<UserSession | undefined> {
    return this.userSessions.get(id);
  }

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newSession: UserSession = {
      id,
      userId: session.userId,
      deviceInfo: session.deviceInfo || "Unknown Device",
      ipAddress: session.ipAddress || "Unknown",
      userAgent: session.userAgent || "Unknown",
      lastActiveAt: now,
      createdAt: now,
      expiresAt: session.expiresAt,
      isCurrentSession: false,
    };
    this.userSessions.set(id, newSession);
    return newSession;
  }

  async updateUserSession(id: string, updates: Partial<UserSession>): Promise<UserSession | undefined> {
    const session = this.userSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.userSessions.set(id, updated);
    return updated;
  }

  async deleteUserSession(id: string, userId: string): Promise<void> {
    const session = this.userSessions.get(id);
    if (session && session.userId === userId) {
      this.userSessions.delete(id);
    }
  }

  async deleteAllUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const sessionsToDelete = Array.from(this.userSessions.values())
      .filter(s => s.userId === userId && s.id !== exceptSessionId);
    for (const session of sessionsToDelete) {
      this.userSessions.delete(session.id);
    }
  }

  async getAllSessions(): Promise<UserSession[]> {
    return Array.from(this.userSessions.values());
  }

  // Security Audit Log
  async getSecurityAuditLogs(userId: string, limit?: number): Promise<SecurityAuditLog[]> {
    const logs = Array.from(this.securityAuditLogs.values())
      .filter(l => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return limit ? logs.slice(0, limit) : logs;
  }

  async getAllSecurityAuditLogs(filters?: { userId?: string; profileId?: string; eventType?: string; startDate?: string; endDate?: string; limit?: number; userRole?: string; action?: string; resourceType?: string; searchQuery?: string }): Promise<SecurityAuditLog[]> {
    let logs = Array.from(this.securityAuditLogs.values());
    
    if (filters?.userId) {
      logs = logs.filter(l => l.userId === filters.userId);
    }
    if (filters?.profileId) {
      logs = logs.filter(l => l.metadata?.profileId === filters.profileId);
    }
    if (filters?.eventType) {
      logs = logs.filter(l => l.eventType === filters.eventType);
    }
    if (filters?.startDate) {
      const start = new Date(filters.startDate);
      logs = logs.filter(l => new Date(l.createdAt) >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      logs = logs.filter(l => new Date(l.createdAt) <= end);
    }
    if (filters?.userRole) {
      logs = logs.filter(l => l.metadata?.userRole === filters.userRole);
    }
    if (filters?.action) {
      logs = logs.filter(l => l.metadata?.action === filters.action);
    }
    if (filters?.resourceType) {
      logs = logs.filter(l => l.metadata?.resourceType === filters.resourceType);
    }
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      logs = logs.filter(l => 
        l.description.toLowerCase().includes(query) ||
        l.userId.toLowerCase().includes(query) ||
        l.metadata?.patientId?.toLowerCase().includes(query) ||
        l.metadata?.resourceId?.toLowerCase().includes(query)
      );
    }
    
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return filters?.limit ? logs.slice(0, filters.limit) : logs;
  }

  async createSecurityAuditLog(log: InsertSecurityAuditLog): Promise<SecurityAuditLog> {
    const id = randomUUID();
    const newLog: SecurityAuditLog = {
      id,
      userId: log.userId,
      profileId: log.profileId || null,
      eventType: log.eventType,
      description: log.description,
      ipAddress: log.ipAddress || "Unknown",
      userAgent: log.userAgent || "Unknown",
      platform: log.platform || "web",
      appVersion: log.appVersion || "1.0.0",
      source: log.source || null,
      connectionId: log.connectionId || null,
      syncId: log.syncId || null,
      metadata: log.metadata || null,
      createdAt: new Date().toISOString(),
    };
    this.securityAuditLogs.set(id, newLog);
    return newLog;
  }

  // Security Notifications
  async getSecurityNotifications(userId: string, unreadOnly?: boolean): Promise<SecurityNotification[]> {
    let notifications = Array.from(this.securityNotifications.values())
      .filter(n => n.userId === userId);
    
    if (unreadOnly) {
      notifications = notifications.filter(n => !n.isRead);
    }
    
    return notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createSecurityNotification(notification: InsertSecurityNotification): Promise<SecurityNotification> {
    const id = randomUUID();
    const newNotification: SecurityNotification = {
      id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      severity: notification.severity || "info",
      isRead: false,
      metadata: notification.metadata || null,
      createdAt: new Date().toISOString(),
    };
    this.securityNotifications.set(id, newNotification);
    return newNotification;
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    const notification = this.securityNotifications.get(id);
    if (notification && notification.userId === userId) {
      notification.isRead = true;
      this.securityNotifications.set(id, notification);
    }
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    for (const [id, notification] of this.securityNotifications) {
      if (notification.userId === userId && !notification.isRead) {
        notification.isRead = true;
        this.securityNotifications.set(id, notification);
      }
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return Array.from(this.securityNotifications.values())
      .filter(n => n.userId === userId && !n.isRead)
      .length;
  }

  // Security Settings
  async getSecuritySettings(userId: string): Promise<SecuritySettings | undefined> {
    return Array.from(this.securitySettings.values()).find(s => s.userId === userId);
  }

  async createOrUpdateSecuritySettings(userId: string, settings: Partial<InsertSecuritySettings>): Promise<SecuritySettings> {
    const existing = await this.getSecuritySettings(userId);
    const now = new Date().toISOString();
    
    if (existing) {
      const updated: SecuritySettings = {
        ...existing,
        loginNotifications: settings.loginNotifications ?? existing.loginNotifications,
        newDeviceAlerts: settings.newDeviceAlerts ?? existing.newDeviceAlerts,
        sessionActivityAlerts: settings.sessionActivityAlerts ?? existing.sessionActivityAlerts,
        emailNotifications: settings.emailNotifications ?? existing.emailNotifications,
        updatedAt: now,
      };
      this.securitySettings.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const newSettings: SecuritySettings = {
      id,
      userId,
      loginNotifications: settings.loginNotifications ?? true,
      newDeviceAlerts: settings.newDeviceAlerts ?? true,
      sessionActivityAlerts: settings.sessionActivityAlerts ?? false,
      emailNotifications: settings.emailNotifications ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.securitySettings.set(id, newSettings);
    return newSettings;
  }

  // AI Preferences
  async getAIPreferences(userId: string): Promise<import("@shared/schema").AIPreferences | undefined> {
    return this.aiPreferences.get(userId);
  }

  async createOrUpdateAIPreferences(userId: string, preferences: import("@shared/schema").UpdateAIPreferences): Promise<import("@shared/schema").AIPreferences> {
    const existing = await this.getAIPreferences(userId);
    const now = new Date().toISOString();
    
    if (existing) {
      const updated: import("@shared/schema").AIPreferences = {
        ...existing,
        aiExplanationsEnabled: preferences.aiExplanationsEnabled ?? existing.aiExplanationsEnabled,
        aiSummariesEnabled: preferences.aiSummariesEnabled ?? existing.aiSummariesEnabled,
        updatedAt: now,
      };
      this.aiPreferences.set(userId, updated);
      return updated;
    }
    
    const newPreferences: import("@shared/schema").AIPreferences = {
      userId,
      aiExplanationsEnabled: preferences.aiExplanationsEnabled ?? true,
      aiSummariesEnabled: preferences.aiSummariesEnabled ?? true,
      updatedAt: now,
    };
    this.aiPreferences.set(userId, newPreferences);
    return newPreferences;
  }

  // AI Medical Assistant Conversations
  async getAssistantConversations(userId: string): Promise<AssistantConversation[]> {
    return Array.from(this.assistantConversations.values())
      .filter(c => c.userId === userId && c.isActive)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getAssistantConversation(id: string): Promise<AssistantConversation | undefined> {
    return this.assistantConversations.get(id);
  }

  async createAssistantConversation(conversation: InsertAssistantConversation): Promise<AssistantConversation> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newConversation: AssistantConversation = {
      id,
      userId: conversation.userId,
      patientId: conversation.patientId || null,
      title: conversation.title || "New Conversation",
      createdAt: now,
      updatedAt: now,
      isActive: true,
      messageCount: 0,
      fingerprint: null,
      summary: null,
      mergedInto: null,
      tags: [],
    };
    this.assistantConversations.set(id, newConversation);
    return newConversation;
  }

  async updateAssistantConversation(id: string, updates: Partial<AssistantConversation>): Promise<AssistantConversation | undefined> {
    const existing = this.assistantConversations.get(id);
    if (!existing) return undefined;
    
    const updated: AssistantConversation = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.assistantConversations.set(id, updated);
    return updated;
  }

  async deleteAssistantConversation(id: string, userId: string): Promise<void> {
    const conversation = this.assistantConversations.get(id);
    if (conversation && conversation.userId === userId) {
      conversation.isActive = false;
      this.assistantConversations.set(id, conversation);
    }
  }

  // AI Medical Assistant Messages
  async getAssistantMessages(conversationId: string): Promise<AssistantMessage[]> {
    return Array.from(this.assistantMessages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createAssistantMessage(message: InsertAssistantMessage): Promise<AssistantMessage> {
    const id = randomUUID();
    const newMessage: AssistantMessage = {
      id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      audioUrl: message.audioUrl || null,
      metadata: message.metadata || null,
      fingerprint: null,
      createdAt: new Date().toISOString(),
    };
    this.assistantMessages.set(id, newMessage);
    
    const conversation = this.assistantConversations.get(message.conversationId);
    if (conversation) {
      conversation.updatedAt = new Date().toISOString();
      conversation.messageCount = (conversation.messageCount || 0) + 1;
      this.assistantConversations.set(message.conversationId, conversation);
    }
    
    return newMessage;
  }

  async findDuplicateMessages(userId: string, fingerprint: string): Promise<AssistantMessage[]> {
    const userConversationIds = new Set(
      Array.from(this.assistantConversations.values())
        .filter(c => c.userId === userId)
        .map(c => c.id)
    );
    return Array.from(this.assistantMessages.values())
      .filter(m => m.fingerprint === fingerprint && userConversationIds.has(m.conversationId));
  }

  async getAssistantInsights(userId: string): Promise<AssistantInsight[]> {
    return Array.from(this.assistantInsights.values())
      .filter(i => i.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAssistantInsight(id: string): Promise<AssistantInsight | undefined> {
    return this.assistantInsights.get(id);
  }

  async createAssistantInsight(insight: InsertAssistantInsight): Promise<AssistantInsight> {
    const id = randomUUID();
    const newInsight: AssistantInsight = {
      id,
      userId: insight.userId,
      type: insight.type,
      title: insight.title,
      content: insight.content,
      conversationIds: insight.conversationIds || [],
      periodStart: insight.periodStart || null,
      periodEnd: insight.periodEnd || null,
      topicsExtracted: insight.topicsExtracted || [],
      fingerprint: null,
      createdAt: new Date().toISOString(),
    };
    this.assistantInsights.set(id, newInsight);
    return newInsight;
  }

  async deleteAssistantInsight(id: string, userId: string): Promise<void> {
    const insight = this.assistantInsights.get(id);
    if (insight && insight.userId === userId) {
      this.assistantInsights.delete(id);
    }
  }

  async mergeConversations(targetId: string, sourceIds: string[], userId: string): Promise<AssistantConversation | undefined> {
    const target = this.assistantConversations.get(targetId);
    if (!target || target.userId !== userId) return undefined;

    for (const sourceId of sourceIds) {
      const source = this.assistantConversations.get(sourceId);
      if (!source || source.userId !== userId || sourceId === targetId) continue;

      const sourceMessages = Array.from(this.assistantMessages.values())
        .filter(m => m.conversationId === sourceId);

      for (const msg of sourceMessages) {
        msg.conversationId = targetId;
        this.assistantMessages.set(msg.id, msg);
      }

      source.mergedInto = targetId;
      source.isActive = false;
      this.assistantConversations.set(sourceId, source);

      target.messageCount = (target.messageCount || 0) + sourceMessages.length;
    }

    target.updatedAt = new Date().toISOString();
    this.assistantConversations.set(targetId, target);
    return target;
  }

  // Caregiver Update Requests
  async getCaregiverUpdateRequests(patientUserId: string): Promise<CaregiverUpdateRequest[]> {
    return Array.from(this.caregiverUpdateRequests.values())
      .filter(r => r.patientUserId === patientUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCaregiverUpdateRequestsForRecipient(recipientId: string): Promise<CaregiverUpdateRequest[]> {
    return Array.from(this.caregiverUpdateRequests.values())
      .filter(r => r.recipientId === recipientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCaregiverUpdateRequest(id: string): Promise<CaregiverUpdateRequest | undefined> {
    return this.caregiverUpdateRequests.get(id);
  }

  async createCaregiverUpdateRequest(request: InsertCaregiverUpdateRequest & { aiGeneratedContext?: string }): Promise<CaregiverUpdateRequest> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newRequest: CaregiverUpdateRequest = {
      id,
      patientUserId: request.patientUserId,
      requesterId: request.requesterId,
      recipientId: request.recipientId,
      requestType: request.requestType,
      message: request.message,
      aiGeneratedContext: request.aiGeneratedContext,
      status: "pending",
      priority: request.priority || "normal",
      createdAt: now,
      updatedAt: now,
    };
    this.caregiverUpdateRequests.set(id, newRequest);
    return newRequest;
  }

  async updateCaregiverUpdateRequest(id: string, updates: Partial<CaregiverUpdateRequest>): Promise<CaregiverUpdateRequest | undefined> {
    const existing = this.caregiverUpdateRequests.get(id);
    if (!existing) return undefined;
    
    const updated: CaregiverUpdateRequest = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.caregiverUpdateRequests.set(id, updated);
    return updated;
  }

  // Care Team - get all accepted caregivers for a patient
  async getCareTeam(patientUserId: string): Promise<Caregiver[]> {
    return Array.from(this.caregivers.values())
      .filter(c => c.patientUserId === patientUserId && c.status === "accepted");
  }

  // ============================================
  // PRIVACY BY DESIGN - SHARING RECIPIENTS
  // ============================================

  async getSharingRecipients(patientUserId: string): Promise<SharingRecipient[]> {
    return Array.from(this.sharingRecipients.values())
      .filter(r => r.patientUserId === patientUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getSharingRecipient(id: string): Promise<SharingRecipient | undefined> {
    return this.sharingRecipients.get(id);
  }

  async createSharingRecipient(recipient: InsertSharingRecipient): Promise<SharingRecipient> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newRecipient: SharingRecipient = {
      id,
      patientUserId: recipient.patientUserId,
      recipientType: recipient.recipientType,
      name: recipient.name,
      organization: recipient.organization,
      email: recipient.email,
      phone: recipient.phone,
      npi: recipient.npi,
      notes: recipient.notes,
      isActive: recipient.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.sharingRecipients.set(id, newRecipient);
    return newRecipient;
  }

  async updateSharingRecipient(id: string, updates: Partial<SharingRecipient>): Promise<SharingRecipient | undefined> {
    const existing = this.sharingRecipients.get(id);
    if (!existing) return undefined;
    
    const updated: SharingRecipient = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.sharingRecipients.set(id, updated);
    return updated;
  }

  async deleteSharingRecipient(id: string, patientUserId: string): Promise<void> {
    const recipient = this.sharingRecipients.get(id);
    if (recipient && recipient.patientUserId === patientUserId) {
      recipient.isActive = false;
      recipient.updatedAt = new Date().toISOString();
      this.sharingRecipients.set(id, recipient);
    }
  }

  // ============================================
  // PRIVACY BY DESIGN - DATA SHARING CONSENTS
  // ============================================

  async getDataSharingConsents(patientUserId: string): Promise<DataSharingConsent[]> {
    return Array.from(this.dataSharingConsents.values())
      .filter(c => c.patientUserId === patientUserId && c.isActive)
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  }

  async getDataSharingConsentsByRecipient(recipientId: string): Promise<DataSharingConsent[]> {
    return Array.from(this.dataSharingConsents.values())
      .filter(c => c.recipientId === recipientId && c.isActive);
  }

  async getDataSharingConsent(id: string): Promise<DataSharingConsent | undefined> {
    return this.dataSharingConsents.get(id);
  }

  async getConsentForCategory(patientUserId: string, recipientId: string, category: DataCategory): Promise<DataSharingConsent | undefined> {
    return Array.from(this.dataSharingConsents.values())
      .find(c => c.patientUserId === patientUserId && c.recipientId === recipientId && c.dataCategory === category && c.isActive);
  }

  async createDataSharingConsent(consent: InsertDataSharingConsent): Promise<DataSharingConsent> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newConsent: DataSharingConsent = {
      id,
      patientUserId: consent.patientUserId,
      recipientId: consent.recipientId,
      dataCategory: consent.dataCategory,
      accessLevel: consent.accessLevel || "read",
      purpose: consent.purpose,
      expiresAt: consent.expiresAt,
      isActive: consent.isActive ?? true,
      grantedAt: now,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.dataSharingConsents.set(id, newConsent);
    return newConsent;
  }

  async updateDataSharingConsent(id: string, updates: Partial<DataSharingConsent>): Promise<DataSharingConsent | undefined> {
    const existing = this.dataSharingConsents.get(id);
    if (!existing) return undefined;
    
    const updated: DataSharingConsent = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.dataSharingConsents.set(id, updated);
    return updated;
  }

  async revokeDataSharingConsent(id: string, patientUserId: string): Promise<void> {
    const consent = this.dataSharingConsents.get(id);
    if (consent && consent.patientUserId === patientUserId) {
      consent.isActive = false;
      consent.revokedAt = new Date().toISOString();
      consent.updatedAt = new Date().toISOString();
      this.dataSharingConsents.set(id, consent);
    }
  }

  async bulkUpdateConsents(patientUserId: string, recipientId: string, consents: { category: DataCategory; accessLevel: AccessLevel }[]): Promise<DataSharingConsent[]> {
    const results: DataSharingConsent[] = [];
    
    for (const { category, accessLevel } of consents) {
      const existing = await this.getConsentForCategory(patientUserId, recipientId, category);
      
      if (existing) {
        if (accessLevel === "none") {
          await this.revokeDataSharingConsent(existing.id, patientUserId);
          const revoked = await this.getDataSharingConsent(existing.id);
          if (revoked) results.push(revoked);
        } else {
          const updated = await this.updateDataSharingConsent(existing.id, { accessLevel });
          if (updated) results.push(updated);
        }
      } else if (accessLevel !== "none") {
        const newConsent = await this.createDataSharingConsent({
          patientUserId,
          recipientId,
          dataCategory: category,
          accessLevel,
        });
        results.push(newConsent);
      }
    }
    
    return results;
  }

  // ============================================
  // PRIVACY BY DESIGN - DEFAULT SHARING POLICIES
  // ============================================

  async getDefaultSharingPolicies(patientUserId: string): Promise<DefaultSharingPolicy[]> {
    return Array.from(this.defaultSharingPolicies.values())
      .filter(p => p.patientUserId === patientUserId);
  }

  async getDefaultSharingPolicy(patientUserId: string, recipientType: string, category: DataCategory): Promise<DefaultSharingPolicy | undefined> {
    return Array.from(this.defaultSharingPolicies.values())
      .find(p => p.patientUserId === patientUserId && p.recipientType === recipientType && p.dataCategory === category);
  }

  async createOrUpdateDefaultPolicy(policy: InsertDefaultSharingPolicy): Promise<DefaultSharingPolicy> {
    const existing = await this.getDefaultSharingPolicy(policy.patientUserId, policy.recipientType, policy.dataCategory);
    const now = new Date().toISOString();
    
    if (existing) {
      const updated: DefaultSharingPolicy = {
        ...existing,
        defaultAccessLevel: policy.defaultAccessLevel || "none",
        autoApprove: policy.autoApprove ?? false,
        updatedAt: now,
      };
      this.defaultSharingPolicies.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const newPolicy: DefaultSharingPolicy = {
      id,
      patientUserId: policy.patientUserId,
      recipientType: policy.recipientType,
      dataCategory: policy.dataCategory,
      defaultAccessLevel: policy.defaultAccessLevel || "none",
      autoApprove: policy.autoApprove ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.defaultSharingPolicies.set(id, newPolicy);
    return newPolicy;
  }

  // ============================================
  // PRIVACY BY DESIGN - CONSENT AUDIT LOG
  // ============================================

  async getConsentAuditLogs(patientUserId: string, limit?: number): Promise<ConsentAuditLog[]> {
    const logs = Array.from(this.consentAuditLogs.values())
      .filter(l => l.patientUserId === patientUserId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }

  async createConsentAuditLog(log: InsertConsentAuditLog): Promise<ConsentAuditLog> {
    const id = randomUUID();
    const newLog: ConsentAuditLog = {
      id,
      patientUserId: log.patientUserId,
      recipientId: log.recipientId,
      action: log.action,
      dataCategory: log.dataCategory,
      previousAccessLevel: log.previousAccessLevel,
      newAccessLevel: log.newAccessLevel,
      reason: log.reason,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: new Date().toISOString(),
    };
    this.consentAuditLogs.set(id, newLog);
    return newLog;
  }

  // ============================================
  // PRIVACY BY DESIGN - DASHBOARD STATS
  // ============================================

  async getConsentSummaries(patientUserId: string): Promise<ConsentSummary[]> {
    const recipients = await this.getSharingRecipients(patientUserId);
    const summaries: ConsentSummary[] = [];
    
    for (const recipient of recipients) {
      const consents = await this.getDataSharingConsentsByRecipient(recipient.id);
      const activeConsents = consents.filter(c => c.isActive && c.accessLevel !== "none");
      
      summaries.push({
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientType: recipient.recipientType,
        organization: recipient.organization,
        categoriesShared: activeConsents.length,
        totalCategories: 13, // Total number of data categories
        lastAccessed: activeConsents.reduce((latest, c) => {
          if (c.lastAccessedAt && (!latest || new Date(c.lastAccessedAt) > new Date(latest))) {
            return c.lastAccessedAt;
          }
          return latest;
        }, undefined as string | undefined),
        isActive: recipient.isActive,
      });
    }
    
    return summaries;
  }

  async getPrivacyDashboardStats(patientUserId: string): Promise<PrivacyDashboardStats> {
    const recipients = await this.getSharingRecipients(patientUserId);
    const consents = await this.getDataSharingConsents(patientUserId);
    
    const activeRecipients = recipients.filter(r => r.isActive);
    const activeConsents = consents.filter(c => c.isActive && c.accessLevel !== "none");
    const fullAccessConsents = activeConsents.filter(c => c.accessLevel === "full");
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentlyAccessed = activeConsents.filter(c => 
      c.lastAccessedAt && new Date(c.lastAccessedAt) > thirtyDaysAgo
    );
    
    const expiringConsents = activeConsents.filter(c => {
      if (!c.expiresAt) return false;
      const expiresAt = new Date(c.expiresAt);
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return expiresAt <= thirtyDaysFromNow && expiresAt > new Date();
    });
    
    return {
      totalRecipients: recipients.length,
      activeRecipients: activeRecipients.length,
      totalConsentsGranted: activeConsents.length,
      categoriesWithFullAccess: fullAccessConsents.length,
      recentAccessCount: recentlyAccessed.reduce((sum, c) => sum + c.accessCount, 0),
      pendingRequests: 0, // TODO: Implement pending requests
      expiringConsents: expiringConsents.length,
    };
  }

  // ============================================
  // PRIVACY BY DESIGN - CONSENT CHECK
  // ============================================

  async checkConsent(patientUserId: string, recipientUserId: string, category: DataCategory): Promise<AccessLevel> {
    // Find if this user is a sharing recipient for the patient
    const recipients = await this.getSharingRecipients(patientUserId);
    const recipient = recipients.find(r => r.email === recipientUserId || r.id === recipientUserId);
    
    if (!recipient || !recipient.isActive) {
      return "none";
    }
    
    const consent = await this.getConsentForCategory(patientUserId, recipient.id, category);
    
    if (!consent || !consent.isActive) {
      return "none";
    }
    
    // Check if consent has expired
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
      return "none";
    }
    
    return consent.accessLevel;
  }

  // ============================================
  // DE-IDENTIFICATION PIPELINE - DATASETS
  // ============================================

  async getDeidentifiedDatasets(patientUserId: string): Promise<DeidentifiedDataset[]> {
    return Array.from(this.deidentifiedDatasets.values())
      .filter(d => d.patientUserId === patientUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDeidentifiedDatasetsByUser(patientUserId: string): Promise<DeidentifiedDataset[]> {
    return this.getDeidentifiedDatasets(patientUserId);
  }

  async getDeidentifiedDataset(id: string): Promise<DeidentifiedDataset | undefined> {
    return this.deidentifiedDatasets.get(id);
  }

  async createDeidentifiedDataset(dataset: InsertDeidentifiedDataset): Promise<DeidentifiedDataset> {
    const id = randomUUID();
    const newDataset: DeidentifiedDataset = {
      id,
      configId: dataset.configId,
      patientUserId: dataset.patientUserId,
      method: dataset.method,
      purpose: dataset.purpose,
      status: dataset.status || "pending",
      recordCount: dataset.recordCount || 0,
      dataCategories: dataset.dataCategories,
      hashSalt: dataset.hashSalt,
      expiresAt: dataset.expiresAt,
      downloadCount: 0,
      lastDownloadedAt: undefined,
      createdAt: new Date().toISOString(),
      completedAt: undefined,
      errorMessage: undefined,
    };
    this.deidentifiedDatasets.set(id, newDataset);
    return newDataset;
  }

  async updateDeidentifiedDataset(id: string, updates: Partial<DeidentifiedDataset>): Promise<DeidentifiedDataset | undefined> {
    const dataset = this.deidentifiedDatasets.get(id);
    if (!dataset) return undefined;
    
    const updated = { ...dataset, ...updates };
    this.deidentifiedDatasets.set(id, updated);
    return updated;
  }

  async deleteDeidentifiedDataset(id: string): Promise<void> {
    this.deidentifiedDatasets.delete(id);
    this.deidentifiedData.delete(id);
  }

  async incrementDatasetDownloadCount(id: string): Promise<void> {
    const dataset = this.deidentifiedDatasets.get(id);
    if (dataset) {
      dataset.downloadCount = (dataset.downloadCount || 0) + 1;
      dataset.lastDownloadedAt = new Date().toISOString();
      this.deidentifiedDatasets.set(id, dataset);
    }
  }

  // ============================================
  // DE-IDENTIFICATION PIPELINE - AUDIT LOGS
  // ============================================

  async getDeidentificationAuditLogs(datasetId: string): Promise<DeidentificationAuditLog[]> {
    return Array.from(this.deidentificationAuditLogs.values())
      .filter(l => l.datasetId === datasetId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getDeidentificationAuditLogsByUser(patientUserId: string): Promise<DeidentificationAuditLog[]> {
    return Array.from(this.deidentificationAuditLogs.values())
      .filter(l => l.patientUserId === patientUserId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createDeidentificationAuditLog(log: InsertDeidentificationAuditLog): Promise<DeidentificationAuditLog> {
    const id = randomUUID();
    const newLog: DeidentificationAuditLog = {
      id,
      datasetId: log.datasetId,
      patientUserId: log.patientUserId,
      action: log.action,
      accessorId: log.accessorId,
      accessorType: log.accessorType,
      accessorName: log.accessorName,
      recordsProcessed: log.recordsProcessed,
      fieldsRemoved: log.fieldsRemoved as PhiIdentifier[],
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: new Date().toISOString(),
    };
    this.deidentificationAuditLogs.set(id, newLog);
    return newLog;
  }

  // ============================================
  // DE-IDENTIFICATION PIPELINE - RESEARCH PREFERENCES
  // ============================================

  async getResearchPreferences(patientUserId: string): Promise<ResearchPreferences | undefined> {
    return this.researchPreferences.get(patientUserId);
  }

  async createOrUpdateResearchPreferences(prefs: InsertResearchPreferences): Promise<ResearchPreferences> {
    const existing = this.researchPreferences.get(prefs.patientUserId);
    const now = new Date().toISOString();
    
    const researchPref: ResearchPreferences = {
      id: existing?.id || randomUUID(),
      patientUserId: prefs.patientUserId,
      allowResearch: prefs.allowResearch ?? false,
      allowMonetization: prefs.allowMonetization ?? false,
      preferredMethod: prefs.preferredMethod ?? "safe_harbor",
      allowedPurposes: prefs.allowedPurposes as ResearchPurpose[] ?? [],
      excludedCategories: prefs.excludedCategories as DataCategory[] ?? [],
      requireNotification: prefs.requireNotification ?? true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    
    this.researchPreferences.set(prefs.patientUserId, researchPref);
    return researchPref;
  }

  // ============================================
  // DE-IDENTIFICATION PIPELINE - DATA STORAGE
  // ============================================

  async setDeidentifiedData(datasetId: string, data: unknown[]): Promise<void> {
    this.deidentifiedData.set(datasetId, data);
  }

  async getDeidentifiedData(datasetId: string): Promise<unknown[]> {
    return this.deidentifiedData.get(datasetId) || [];
  }

  // ============================================
  // AI MEDICATION MANAGEMENT - REMINDERS
  // ============================================

  async getMedicationReminders(patientId: string): Promise<MedicationReminder[]> {
    return Array.from(this.medicationReminders.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getMedicationReminder(id: string): Promise<MedicationReminder | undefined> {
    return this.medicationReminders.get(id);
  }

  async createMedicationReminder(reminder: InsertMedicationReminder): Promise<MedicationReminder> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newReminder: MedicationReminder = {
      id,
      patientId: reminder.patientId,
      medicationId: reminder.medicationId,
      medicationName: reminder.medicationName,
      dosage: reminder.dosage,
      frequency: reminder.frequency,
      scheduledTimes: reminder.scheduledTimes,
      aiGeneratedMessage: reminder.aiGeneratedMessage,
      isActive: reminder.isActive ?? true,
      notifyViaApp: reminder.notifyViaApp ?? true,
      notifyViaPush: reminder.notifyViaPush ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.medicationReminders.set(id, newReminder);
    return newReminder;
  }

  async updateMedicationReminder(id: string, updates: Partial<MedicationReminder>): Promise<MedicationReminder | undefined> {
    const reminder = this.medicationReminders.get(id);
    if (!reminder) return undefined;
    
    const updated = { ...reminder, ...updates, updatedAt: new Date().toISOString() };
    this.medicationReminders.set(id, updated);
    return updated;
  }

  async deleteMedicationReminder(id: string): Promise<void> {
    this.medicationReminders.delete(id);
  }

  // ============================================
  // AI MEDICATION MANAGEMENT - ADHERENCE RECORDS
  // ============================================

  async getMedicationAdherenceRecords(patientId: string, medicationId?: string): Promise<MedicationAdherenceRecord[]> {
    return Array.from(this.medicationAdherenceRecords.values())
      .filter(r => r.patientId === patientId && (!medicationId || r.medicationId === medicationId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createMedicationAdherenceRecord(record: InsertMedicationAdherenceRecord): Promise<MedicationAdherenceRecord> {
    const id = randomUUID();
    const newRecord: MedicationAdherenceRecord = {
      id,
      patientId: record.patientId,
      medicationId: record.medicationId,
      medicationName: record.medicationName,
      reminderId: record.reminderId,
      scheduledTime: record.scheduledTime,
      action: record.action,
      takenAt: record.takenAt,
      missedReason: record.missedReason,
      missedReasonDetails: record.missedReasonDetails,
      notes: record.notes,
      createdAt: new Date().toISOString(),
    };
    this.medicationAdherenceRecords.set(id, newRecord);
    return newRecord;
  }

  async getMedicationAdherenceStats(patientId: string, medicationId?: string, periodDays: number = 30): Promise<AdherenceStatistics> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    
    const records = Array.from(this.medicationAdherenceRecords.values())
      .filter(r => 
        r.patientId === patientId && 
        (!medicationId || r.medicationId === medicationId) &&
        new Date(r.createdAt) >= periodStart
      );

    const taken = records.filter(r => r.action === "taken").length;
    const skipped = records.filter(r => r.action === "skipped").length;
    const missed = records.filter(r => r.action === "missed").length;
    const delayed = records.filter(r => r.action === "delayed").length;
    const total = records.length;

    // Calculate streak
    let streak = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    const sortedRecords = records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    for (const record of sortedRecords) {
      if (record.action === "taken") {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        if (streak === 0) streak = currentStreak;
        currentStreak = 0;
      }
    }
    if (streak === 0) streak = currentStreak;

    return {
      patientId,
      medicationId,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      totalScheduled: total,
      totalTaken: taken,
      totalSkipped: skipped,
      totalMissed: missed,
      totalDelayed: delayed,
      adherenceRate: total > 0 ? Math.round((taken / total) * 100) : 0,
      streak,
      longestStreak,
      averageDelayMinutes: undefined,
    };
  }

  // ============================================
  // AI MEDICATION MANAGEMENT - ADHERENCE COACHING
  // ============================================

  async getAdherenceCoachingSessions(patientId: string): Promise<AdherenceCoachingSession[]> {
    return Array.from(this.adherenceCoachingSessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAdherenceCoachingSession(id: string): Promise<AdherenceCoachingSession | undefined> {
    return this.adherenceCoachingSessions.get(id);
  }

  async createAdherenceCoachingSession(session: InsertAdherenceCoachingSession): Promise<AdherenceCoachingSession> {
    const id = randomUUID();
    const newSession: AdherenceCoachingSession = {
      id,
      patientId: session.patientId,
      medicationId: session.medicationId,
      medicationName: session.medicationName,
      sessionType: session.sessionType,
      triggerReason: session.triggerReason,
      patientInput: session.patientInput,
      aiAnalysis: session.aiAnalysis,
      recommendations: session.recommendations,
      actionPlan: session.actionPlan,
      motivationalMessage: session.motivationalMessage,
      followUpDate: session.followUpDate,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      completedAt: undefined,
    };
    this.adherenceCoachingSessions.set(id, newSession);
    return newSession;
  }

  async completeAdherenceCoachingSession(id: string): Promise<AdherenceCoachingSession | undefined> {
    const session = this.adherenceCoachingSessions.get(id);
    if (!session) return undefined;
    
    const updated = {
      ...session,
      isCompleted: true,
      completedAt: new Date().toISOString(),
    };
    this.adherenceCoachingSessions.set(id, updated);
    return updated;
  }

  // ============================================
  // AI MEDICATION MANAGEMENT - DRUG INTERACTIONS
  // ============================================

  async getDrugInteractions(patientId: string): Promise<DrugInteraction[]> {
    return Array.from(this.drugInteractions.values())
      .sort((a, b) => {
        const severityOrder = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  async getDrugInteraction(id: string): Promise<DrugInteraction | undefined> {
    return this.drugInteractions.get(id);
  }

  async createDrugInteraction(interaction: InsertDrugInteraction): Promise<DrugInteraction> {
    const id = randomUUID();
    const newInteraction: DrugInteraction = {
      id,
      medication1Id: interaction.medication1Id,
      medication1Name: interaction.medication1Name,
      medication2Id: interaction.medication2Id,
      medication2Name: interaction.medication2Name,
      severity: interaction.severity,
      description: interaction.description,
      clinicalEffects: interaction.clinicalEffects,
      recommendation: interaction.recommendation,
      source: interaction.source || "AI Analysis",
      aiConfidence: interaction.aiConfidence,
      detectedAt: new Date().toISOString(),
      acknowledgedAt: undefined,
      acknowledgedBy: undefined,
    };
    this.drugInteractions.set(id, newInteraction);
    return newInteraction;
  }

  async acknowledgeDrugInteraction(id: string, userId: string): Promise<DrugInteraction | undefined> {
    const interaction = this.drugInteractions.get(id);
    if (!interaction) return undefined;
    
    const updated = {
      ...interaction,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: userId,
    };
    this.drugInteractions.set(id, updated);
    return updated;
  }

  // ============================================
  // AI MEDICATION MANAGEMENT - INSIGHTS
  // ============================================

  async getMedicationAIInsights(patientId: string): Promise<MedicationAIInsight[]> {
    return Array.from(this.medicationAIInsights.values())
      .filter(i => i.patientId === patientId && !i.isDismissed)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async getMedicationAIInsight(id: string): Promise<MedicationAIInsight | undefined> {
    return this.medicationAIInsights.get(id);
  }

  async createMedicationAIInsight(insight: InsertMedicationAIInsight): Promise<MedicationAIInsight> {
    const id = randomUUID();
    const newInsight: MedicationAIInsight = {
      id,
      patientId: insight.patientId,
      insightType: insight.insightType,
      title: insight.title,
      message: insight.message,
      priority: insight.priority,
      relatedMedications: insight.relatedMedications,
      actionable: insight.actionable ?? false,
      actionText: insight.actionText,
      isRead: false,
      isDismissed: false,
      createdAt: new Date().toISOString(),
      expiresAt: undefined,
    };
    this.medicationAIInsights.set(id, newInsight);
    return newInsight;
  }

  async updateMedicationAIInsight(id: string, updates: Partial<MedicationAIInsight>): Promise<MedicationAIInsight | undefined> {
    const insight = this.medicationAIInsights.get(id);
    if (!insight) return undefined;
    
    const updated = { ...insight, ...updates };
    this.medicationAIInsights.set(id, updated);
    return updated;
  }

  async dismissMedicationAIInsight(id: string): Promise<void> {
    const insight = this.medicationAIInsights.get(id);
    if (insight) {
      insight.isDismissed = true;
      this.medicationAIInsights.set(id, insight);
    }
  }

  // ============================================
  // AI HEALTH INSIGHTS - RISK ASSESSMENTS
  // ============================================

  async getHealthRiskAssessments(patientId: string): Promise<HealthRiskAssessment[]> {
    return Array.from(this.healthRiskAssessments.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => {
        const levelOrder = { high: 0, elevated: 1, moderate: 2, low: 3 };
        return levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
      });
  }

  async getHealthRiskAssessment(id: string): Promise<HealthRiskAssessment | undefined> {
    return this.healthRiskAssessments.get(id);
  }

  async createHealthRiskAssessment(assessment: InsertHealthRiskAssessment): Promise<HealthRiskAssessment> {
    const id = randomUUID();
    const newAssessment: HealthRiskAssessment = {
      id,
      patientId: assessment.patientId,
      category: assessment.category,
      riskLevel: assessment.riskLevel,
      riskScore: assessment.riskScore,
      title: assessment.title,
      description: assessment.description,
      riskFactors: assessment.riskFactors,
      recommendations: assessment.recommendations,
      evidenceBasis: assessment.evidenceBasis,
      aiConfidence: assessment.aiConfidence,
      isAcknowledged: false,
      createdAt: new Date().toISOString(),
    };
    this.healthRiskAssessments.set(id, newAssessment);
    return newAssessment;
  }

  async acknowledgeHealthRiskAssessment(id: string): Promise<HealthRiskAssessment | undefined> {
    const assessment = this.healthRiskAssessments.get(id);
    if (!assessment) return undefined;
    
    const updated = { ...assessment, isAcknowledged: true };
    this.healthRiskAssessments.set(id, updated);
    return updated;
  }

  // ============================================
  // AI HEALTH INSIGHTS - COACHING SESSIONS
  // ============================================

  async getHealthCoachingSessions(patientId: string): Promise<HealthCoachingSession[]> {
    return Array.from(this.healthCoachingSessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getHealthCoachingSession(id: string): Promise<HealthCoachingSession | undefined> {
    return this.healthCoachingSessions.get(id);
  }

  async createHealthCoachingSession(session: InsertHealthCoachingSession): Promise<HealthCoachingSession> {
    const id = randomUUID();
    const newSession: HealthCoachingSession = {
      id,
      patientId: session.patientId,
      goalType: session.goalType,
      title: session.title,
      currentGoal: session.currentGoal,
      progress: 0,
      milestones: [],
      aiRecommendations: session.aiRecommendations,
      personalizedTips: session.personalizedTips,
      lastInteraction: new Date().toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.healthCoachingSessions.set(id, newSession);
    return newSession;
  }

  async updateHealthCoachingSession(id: string, updates: Partial<HealthCoachingSession>): Promise<HealthCoachingSession | undefined> {
    const session = this.healthCoachingSessions.get(id);
    if (!session) return undefined;
    
    const updated = { ...session, ...updates, lastInteraction: new Date().toISOString() };
    this.healthCoachingSessions.set(id, updated);
    return updated;
  }

  async completeCoachingMilestone(sessionId: string, milestoneId: string): Promise<HealthCoachingSession | undefined> {
    const session = this.healthCoachingSessions.get(sessionId);
    if (!session) return undefined;
    
    const updatedMilestones = session.milestones.map(m => 
      m.id === milestoneId ? { ...m, isCompleted: true, completedAt: new Date().toISOString() } : m
    );
    const completedCount = updatedMilestones.filter(m => m.isCompleted).length;
    const progress = updatedMilestones.length > 0 ? Math.round((completedCount / updatedMilestones.length) * 100) : 0;
    
    const updated = { ...session, milestones: updatedMilestones, progress, lastInteraction: new Date().toISOString() };
    this.healthCoachingSessions.set(sessionId, updated);
    return updated;
  }

  // ============================================
  // AI HEALTH INSIGHTS - POPULATION TRENDS
  // ============================================

  async getPopulationHealthTrends(): Promise<PopulationHealthTrend[]> {
    return Array.from(this.populationHealthTrends.values())
      .filter(t => t.isActive)
      .sort((a, b) => {
        const sigOrder = { critical: 0, significant: 1, noteworthy: 2, informational: 3 };
        return sigOrder[a.significance] - sigOrder[b.significance];
      });
  }

  async createPopulationHealthTrend(trend: InsertPopulationHealthTrend): Promise<PopulationHealthTrend> {
    const id = randomUUID();
    const newTrend: PopulationHealthTrend = {
      id,
      trendType: trend.trendType,
      title: trend.title,
      description: trend.description,
      dataPoints: trend.dataPoints,
      timeRange: trend.timeRange,
      significance: trend.significance,
      relatedConditions: trend.relatedConditions,
      relatedMedications: trend.relatedMedications,
      percentageChange: trend.percentageChange,
      comparisonPeriod: trend.comparisonPeriod,
      detectedAt: new Date().toISOString(),
      isActive: true,
    };
    this.populationHealthTrends.set(id, newTrend);
    return newTrend;
  }

  // ============================================
  // AI HEALTH INSIGHTS - PERSONALIZED INSIGHTS
  // ============================================

  async getPersonalizedHealthInsights(patientId: string): Promise<PersonalizedHealthInsight[]> {
    return Array.from(this.personalizedHealthInsights.values())
      .filter(i => i.patientId === patientId && !i.isDismissed)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async getPersonalizedHealthInsight(id: string): Promise<PersonalizedHealthInsight | undefined> {
    return this.personalizedHealthInsights.get(id);
  }

  async createPersonalizedHealthInsight(insight: InsertPersonalizedHealthInsight): Promise<PersonalizedHealthInsight> {
    const id = randomUUID();
    const newInsight: PersonalizedHealthInsight = {
      id,
      patientId: insight.patientId,
      insightType: insight.insightType,
      category: insight.category,
      title: insight.title,
      message: insight.message,
      priority: insight.priority,
      actionRequired: insight.actionRequired ?? false,
      actionText: insight.actionText,
      actionLink: insight.actionLink,
      relatedData: insight.relatedData ?? [],
      aiConfidence: insight.aiConfidence,
      isRead: false,
      isDismissed: false,
      createdAt: new Date().toISOString(),
    };
    this.personalizedHealthInsights.set(id, newInsight);
    return newInsight;
  }

  async markPersonalizedInsightRead(id: string): Promise<PersonalizedHealthInsight | undefined> {
    const insight = this.personalizedHealthInsights.get(id);
    if (!insight) return undefined;
    
    const updated = { ...insight, isRead: true };
    this.personalizedHealthInsights.set(id, updated);
    return updated;
  }

  async dismissPersonalizedInsight(id: string): Promise<void> {
    const insight = this.personalizedHealthInsights.get(id);
    if (insight) {
      insight.isDismissed = true;
      this.personalizedHealthInsights.set(id, insight);
    }
  }

  // ============================================
  // PREDICTIVE HEALTH ANALYTICS
  // ============================================

  async getPredictiveRiskForecasts(patientId: string): Promise<PredictiveRiskForecast[]> {
    return Array.from(this.predictiveRiskForecasts.values())
      .filter(f => f.patientId === patientId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getActiveRiskForecasts(patientId: string): Promise<PredictiveRiskForecast[]> {
    const now = new Date();
    return Array.from(this.predictiveRiskForecasts.values())
      .filter(f => f.patientId === patientId && f.isActive && new Date(f.expiresAt) > now)
      .sort((a, b) => b.predictedRiskScore - a.predictedRiskScore);
  }

  async getPredictiveRiskForecast(id: string): Promise<PredictiveRiskForecast | undefined> {
    return this.predictiveRiskForecasts.get(id);
  }

  async createPredictiveRiskForecast(forecast: InsertPredictiveRiskForecast & Partial<PredictiveRiskForecast>): Promise<PredictiveRiskForecast> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // Calculate expiration based on timeframe
    const expirationDays: Record<string, number> = {
      "30_days": 7,
      "90_days": 14,
      "6_months": 30,
      "1_year": 60,
    };
    const expiresAt = new Date(Date.now() + (expirationDays[forecast.timeframe] || 14) * 24 * 60 * 60 * 1000).toISOString();
    
    // Calculate predicted date
    const predictedDays: Record<string, number> = {
      "30_days": 30,
      "90_days": 90,
      "6_months": 180,
      "1_year": 365,
    };
    const predictedDate = new Date(Date.now() + (predictedDays[forecast.timeframe] || 30) * 24 * 60 * 60 * 1000).toISOString();
    
    const newForecast: PredictiveRiskForecast = {
      id,
      patientId: forecast.patientId,
      category: forecast.category,
      forecastType: forecast.forecastType,
      title: forecast.title,
      description: forecast.description,
      currentRiskScore: forecast.currentRiskScore,
      currentRiskLevel: forecast.currentRiskLevel,
      predictedRiskScore: forecast.predictedRiskScore,
      predictedRiskLevel: forecast.predictedRiskLevel,
      timeframe: forecast.timeframe,
      predictedDate: forecast.predictedDate || predictedDate,
      riskTrajectory: forecast.riskTrajectory,
      trajectoryConfidence: forecast.trajectoryConfidence || forecast.confidenceScore,
      riskFactors: forecast.riskFactors || [],
      protectiveFactors: forecast.protectiveFactors || [],
      recommendedInterventions: forecast.recommendedInterventions || [],
      dataSources: forecast.dataSources,
      dataPointsAnalyzed: forecast.dataPointsAnalyzed,
      predictionConfidence: forecast.predictionConfidence,
      confidenceScore: forecast.confidenceScore,
      modelVersion: forecast.modelVersion || "gpt-4o-predictive-v1",
      generatedAt: now,
      expiresAt,
      isActive: true,
      isAcknowledgedByProvider: false,
    };
    this.predictiveRiskForecasts.set(id, newForecast);
    return newForecast;
  }

  async updatePredictiveRiskForecast(id: string, updates: Partial<PredictiveRiskForecast>): Promise<PredictiveRiskForecast | undefined> {
    const forecast = this.predictiveRiskForecasts.get(id);
    if (!forecast) return undefined;
    
    const updated = { ...forecast, ...updates };
    this.predictiveRiskForecasts.set(id, updated);
    return updated;
  }

  async acknowledgePredictiveRiskForecast(id: string, providerId: string): Promise<PredictiveRiskForecast | undefined> {
    const forecast = this.predictiveRiskForecasts.get(id);
    if (!forecast) return undefined;
    
    const updated = {
      ...forecast,
      isAcknowledgedByProvider: true,
      acknowledgedBy: providerId,
      acknowledgedAt: new Date().toISOString(),
    };
    this.predictiveRiskForecasts.set(id, updated);
    return updated;
  }

  async getAllPatientRiskStratifications(): Promise<PatientRiskStratification[]> {
    const patients = Array.from(this.patients.values());
    const stratifications: PatientRiskStratification[] = [];
    
    for (const patient of patients) {
      const strat = await this.getPatientRiskStratification(patient.id);
      if (strat) {
        stratifications.push(strat);
      }
    }
    
    return stratifications.sort((a, b) => b.overallRiskScore - a.overallRiskScore);
  }

  async getPatientRiskStratification(patientId: string): Promise<PatientRiskStratification | undefined> {
    const patient = this.patients.get(patientId);
    if (!patient) return undefined;
    
    const forecasts = await this.getActiveRiskForecasts(patientId);
    const promResponses = Array.from(this.promResponses.values()).filter(r => r.patientId === patientId);
    const triageSessions = Array.from(this.triageSessions.values()).filter(t => t.patientId === patientId);
    
    // Calculate category risks from forecasts
    const categoryMap = new Map<string, { scores: number[]; levels: string[]; trajectories: string[]; concern?: string }>();
    
    for (const forecast of forecasts) {
      const existing = categoryMap.get(forecast.category) || { scores: [], levels: [], trajectories: [] };
      existing.scores.push(forecast.predictedRiskScore);
      existing.levels.push(forecast.predictedRiskLevel);
      existing.trajectories.push(forecast.riskTrajectory);
      if (forecast.predictedRiskScore > 60) {
        existing.concern = forecast.title;
      }
      categoryMap.set(forecast.category, existing);
    }
    
    const categoryRisks = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category: category as any,
      riskScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
      riskLevel: this.getMostFrequent(data.levels) as any,
      trajectory: this.getMostFrequent(data.trajectories) as any,
      primaryConcern: data.concern,
    }));
    
    // Calculate overall metrics
    const allScores = forecasts.map(f => f.predictedRiskScore);
    const overallRiskScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
    const overallRiskLevel = this.scoreToLevel(overallRiskScore);
    const overallTrajectory = this.getMostFrequent(forecasts.map(f => f.riskTrajectory)) as any || "stable";
    
    // Extract top concerns
    const topConcerns = forecasts
      .filter(f => f.predictedRiskScore >= 50)
      .slice(0, 3)
      .map(f => ({
        title: f.title,
        category: f.category,
        urgency: this.scoreToUrgency(f.predictedRiskScore),
        description: f.description,
      }));
    
    // Count urgent interventions
    const urgentInterventionCount = forecasts.reduce((count, f) => 
      count + f.recommendedInterventions.filter(i => i.urgency === "urgent" || i.urgency === "critical").length, 0);
    
    // PROM metrics
    const promCompletionRate = promResponses.length > 0 ? 
      Math.min(100, Math.round((promResponses.length / 12) * 100)) : 0;
    const lastProm = promResponses.sort((a, b) => 
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
    
    // Triage metrics
    const lastTriage = triageSessions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    return {
      id: `strat-${patientId}`,
      patientId,
      patientName: patient.name,
      overallRiskScore,
      overallRiskLevel,
      overallTrajectory,
      categoryRisks,
      topConcerns,
      activeForecastCount: forecasts.length,
      urgentInterventionCount,
      promCompletionRate,
      lastPromDate: lastProm?.completedAt,
      lastTriageDate: lastTriage?.createdAt,
      recentTriageUrgency: lastTriage?.aiAnalysis?.urgencyLevel,
      lastUpdated: new Date().toISOString(),
    };
  }

  private getMostFrequent<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    const counts = new Map<T, number>();
    arr.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  private scoreToLevel(score: number): "low" | "moderate" | "elevated" | "high" {
    if (score < 25) return "low";
    if (score < 50) return "moderate";
    if (score < 75) return "elevated";
    return "high";
  }

  private scoreToUrgency(score: number): "routine" | "soon" | "priority" | "urgent" | "critical" {
    if (score < 30) return "routine";
    if (score < 50) return "soon";
    if (score < 70) return "priority";
    if (score < 85) return "urgent";
    return "critical";
  }

  async getPendingForecasts(): Promise<PredictiveRiskForecast[]> {
    const now = new Date();
    return Array.from(this.predictiveRiskForecasts.values())
      .filter(f => f.isActive && !f.isAcknowledgedByProvider && new Date(f.expiresAt) > now)
      .sort((a, b) => b.predictedRiskScore - a.predictedRiskScore);
  }

  async getUrgentInterventions(): Promise<{ patientId: string; patientName: string; intervention: RecommendedIntervention }[]> {
    const results: { patientId: string; patientName: string; intervention: RecommendedIntervention }[] = [];
    
    for (const forecast of this.predictiveRiskForecasts.values()) {
      if (!forecast.isActive) continue;
      const patient = this.patients.get(forecast.patientId);
      if (!patient) continue;
      
      for (const intervention of forecast.recommendedInterventions) {
        if ((intervention.urgency === "urgent" || intervention.urgency === "critical") && !intervention.isImplemented) {
          results.push({
            patientId: forecast.patientId,
            patientName: patient.name,
            intervention,
          });
        }
      }
    }
    
    return results.sort((a, b) => {
      const urgencyOrder = { critical: 0, urgent: 1, priority: 2, soon: 3, routine: 4 };
      return urgencyOrder[a.intervention.urgency] - urgencyOrder[b.intervention.urgency];
    });
  }

  // ============================================
  // SECURE MESSAGING - MESSAGE THREADS
  // ============================================

  async getMessageThreads(patientId: string): Promise<MessageThread[]> {
    return Array.from(this.messageThreads.values())
      .filter(t => t.patientId === patientId && !t.isArchived)
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }

  async getMessageThread(id: string): Promise<MessageThread | undefined> {
    return this.messageThreads.get(id);
  }

  async createMessageThread(thread: InsertMessageThread): Promise<MessageThread> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newThread: MessageThread = {
      id,
      patientId: thread.patientId,
      subject: thread.subject,
      threadType: thread.threadType,
      priority: thread.priority ?? "normal",
      participants: thread.participants.map(p => ({ ...p, isOnline: false })),
      lastMessageAt: now,
      lastMessagePreview: "",
      unreadCount: 0,
      isArchived: false,
      isClosed: false,
      createdAt: now,
      createdBy: thread.createdBy,
    };
    this.messageThreads.set(id, newThread);
    return newThread;
  }

  async updateMessageThread(id: string, updates: Partial<MessageThread>): Promise<MessageThread | undefined> {
    const thread = this.messageThreads.get(id);
    if (!thread) return undefined;
    
    const updated = { ...thread, ...updates };
    this.messageThreads.set(id, updated);
    return updated;
  }

  async archiveMessageThread(id: string): Promise<void> {
    const thread = this.messageThreads.get(id);
    if (thread) {
      thread.isArchived = true;
      this.messageThreads.set(id, thread);
    }
  }

  async closeMessageThread(id: string, closedBy: string): Promise<MessageThread | undefined> {
    const thread = this.messageThreads.get(id);
    if (!thread) return undefined;
    
    const updated = { 
      ...thread, 
      isClosed: true, 
      closedAt: new Date().toISOString(),
      closedBy 
    };
    this.messageThreads.set(id, updated);
    return updated;
  }

  // ============================================
  // SECURE MESSAGING - MESSAGES
  // ============================================

  async getMessagesByThread(threadId: string): Promise<SecureMessage[]> {
    return Array.from(this.secureMessages.values())
      .filter(m => m.threadId === threadId && !m.isDeleted)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async getSecureMessage(id: string): Promise<SecureMessage | undefined> {
    return this.secureMessages.get(id);
  }

  async createSecureMessage(message: InsertSecureMessage): Promise<SecureMessage> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newMessage: SecureMessage = {
      id,
      threadId: message.threadId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      content: message.content,
      attachments: [],
      isRead: false,
      createdAt: now,
      isEdited: false,
      isDeleted: false,
    };
    this.secureMessages.set(id, newMessage);

    // Update thread with last message info
    const thread = this.messageThreads.get(message.threadId);
    if (thread) {
      thread.lastMessageAt = now;
      thread.lastMessagePreview = message.content.substring(0, 100);
      thread.unreadCount += 1;
      this.messageThreads.set(message.threadId, thread);
    }

    return newMessage;
  }

  async markMessageRead(id: string): Promise<SecureMessage | undefined> {
    const message = this.secureMessages.get(id);
    if (!message) return undefined;
    
    const updated = { ...message, isRead: true, readAt: new Date().toISOString() };
    this.secureMessages.set(id, updated);
    return updated;
  }

  async markThreadMessagesRead(threadId: string, userId: string): Promise<void> {
    const messages = Array.from(this.secureMessages.values())
      .filter(m => m.threadId === threadId && !m.isRead && m.senderId !== userId);
    
    const now = new Date().toISOString();
    for (const message of messages) {
      message.isRead = true;
      message.readAt = now;
      this.secureMessages.set(message.id, message);
    }

    // Reset thread unread count
    const thread = this.messageThreads.get(threadId);
    if (thread) {
      thread.unreadCount = 0;
      this.messageThreads.set(threadId, thread);
    }
  }

  async deleteSecureMessage(id: string): Promise<void> {
    const message = this.secureMessages.get(id);
    if (message) {
      message.isDeleted = true;
      this.secureMessages.set(id, message);
    }
  }

  // ============================================
  // SECURE MESSAGING - ATTACHMENTS
  // ============================================

  async getMessageAttachments(messageId: string): Promise<MessageAttachment[]> {
    return Array.from(this.messageAttachments.values())
      .filter(a => a.messageId === messageId);
  }

  async createMessageAttachment(attachment: InsertMessageAttachment): Promise<MessageAttachment> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newAttachment: MessageAttachment = {
      id,
      messageId: attachment.messageId,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
      attachmentType: attachment.attachmentType,
      objectPath: attachment.objectPath,
      downloadUrl: attachment.downloadUrl,
      thumbnailUrl: attachment.thumbnailUrl,
      uploadedAt: now,
      uploadedBy: attachment.uploadedBy,
    };
    this.messageAttachments.set(id, newAttachment);

    // Add attachment to message
    const message = this.secureMessages.get(attachment.messageId);
    if (message) {
      message.attachments.push(newAttachment);
      this.secureMessages.set(attachment.messageId, message);
    }

    return newAttachment;
  }

  async deleteMessageAttachment(id: string): Promise<void> {
    const attachment = this.messageAttachments.get(id);
    if (attachment) {
      // Remove from message
      const message = this.secureMessages.get(attachment.messageId);
      if (message) {
        message.attachments = message.attachments.filter(a => a.id !== id);
        this.secureMessages.set(attachment.messageId, message);
      }
      this.messageAttachments.delete(id);
    }
  }

  // ============================================
  // WEARABLE DEVICE CONNECTIONS
  // ============================================

  // F3 FIX (2026-04-18): wearable OAuth tokens are persisted encrypted
  // (see createWearableConnection / updateWearableConnection) and decrypted
  // only when read out via these getters.
  async getWearableConnections(userId: string): Promise<WearableConnection[]> {
    return Array.from(this.wearableConnections.values())
      .filter(c => c.userId === userId)
      .map((c) => decryptConnectionFromStorage(c, "wearableConnection")!)
      .sort((a, b) => new Date(b.lastSync).getTime() - new Date(a.lastSync).getTime());
  }

  async getWearableConnection(id: string): Promise<WearableConnection | undefined> {
    const raw = this.wearableConnections.get(id);
    return decryptConnectionFromStorage(raw, "wearableConnection");
  }

  async createWearableConnection(connection: InsertWearableConnection): Promise<WearableConnection> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newConnection: WearableConnection = {
      id,
      userId: connection.userId,
      platform: connection.platform,
      deviceName: connection.deviceName,
      status: connection.status || "pending_auth",
      lastSync: now,
      enabledDataTypes: connection.enabledDataTypes || [],
      syncFrequency: connection.syncFrequency || "daily",
      createdAt: now,
    };
    this.wearableConnections.set(id, newConnection);
    return newConnection;
  }

  async updateWearableConnection(id: string, updates: Partial<WearableConnection>): Promise<WearableConnection | undefined> {
    const connection = this.wearableConnections.get(id);
    if (!connection) return undefined;

    // F3 FIX (2026-04-18): decrypt the at-rest connection, apply updates,
    // re-encrypt OAuth tokens before persisting.
    const decrypted = decryptConnectionFromStorage(connection, "wearableConnection")!;
    const updated = { ...decrypted, ...updates };
    this.wearableConnections.set(id, encryptConnectionForStorage(updated, "wearableConnection"));
    return updated;
  }

  async deleteWearableConnection(id: string): Promise<void> {
    this.wearableConnections.delete(id);
    // Also delete associated data records
    const recordsToDelete = Array.from(this.wearableDataRecords.values())
      .filter(r => r.wearableConnectionId === id);
    for (const record of recordsToDelete) {
      this.wearableDataRecords.delete(record.id);
    }
  }

  // ============================================
  // WEARABLE DATA RECORDS
  // ============================================

  async getWearableDataRecords(
    userId: string, 
    dataType?: WearableDataType, 
    startDate?: string, 
    endDate?: string
  ): Promise<WearableDataRecord[]> {
    let records = Array.from(this.wearableDataRecords.values())
      .filter(r => r.userId === userId);
    
    if (dataType) {
      records = records.filter(r => r.dataType === dataType);
    }
    
    if (startDate) {
      records = records.filter(r => new Date(r.recordedAt) >= new Date(startDate));
    }
    
    if (endDate) {
      records = records.filter(r => new Date(r.recordedAt) <= new Date(endDate));
    }
    
    return records.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getWearableDataRecordsByConnection(connectionId: string): Promise<WearableDataRecord[]> {
    return Array.from(this.wearableDataRecords.values())
      .filter(r => r.wearableConnectionId === connectionId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async createWearableDataRecord(record: InsertWearableDataRecord): Promise<WearableDataRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newRecord: WearableDataRecord = {
      id,
      userId: record.userId,
      wearableConnectionId: record.wearableConnectionId,
      dataType: record.dataType,
      value: record.value,
      unit: record.unit,
      metadata: record.metadata,
      recordedAt: record.recordedAt,
      syncedAt: now,
    };
    this.wearableDataRecords.set(id, newRecord);
    return newRecord;
  }

  async createWearableDataRecordsBatch(records: InsertWearableDataRecord[]): Promise<WearableDataRecord[]> {
    const created: WearableDataRecord[] = [];
    for (const record of records) {
      const newRecord = await this.createWearableDataRecord(record);
      created.push(newRecord);
    }
    return created;
  }

  async getLatestWearableData(userId: string, dataType: WearableDataType): Promise<WearableDataRecord | undefined> {
    const records = Array.from(this.wearableDataRecords.values())
      .filter(r => r.userId === userId && r.dataType === dataType)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    return records[0];
  }

  // ============================================
  // EXTERNAL DATA SOURCES (UNIFIED VIEW)
  // ============================================

  async getAllExternalDataSources(userId: string): Promise<ExternalDataSource[]> {
    const sources: ExternalDataSource[] = [];
    
    // Add EHR connections
    const ehrConnections = await this.getEhrConnections(userId);
    for (const conn of ehrConnections) {
      const platformInfo = ehrPlatformInfo[conn.platform];
      sources.push({
        id: conn.id,
        type: "ehr",
        platform: conn.platform,
        name: platformInfo?.name || conn.platform,
        status: conn.status,
        lastSync: conn.lastSync,
        recordCount: conn.patientCount || 0,
        color: platformInfo?.color || "#666666",
      });
    }
    
    // Add wearable connections
    const wearableConnections = await this.getWearableConnections(userId);
    for (const conn of wearableConnections) {
      const platformInfo = wearablePlatformInfo[conn.platform];
      const dataCount = (await this.getWearableDataRecordsByConnection(conn.id)).length;
      sources.push({
        id: conn.id,
        type: "wearable",
        platform: conn.platform,
        name: platformInfo?.name || conn.platform,
        status: conn.status,
        lastSync: conn.lastSync,
        recordCount: dataCount,
        color: platformInfo?.color || "#666666",
      });
    }
    
    return sources.sort((a, b) => new Date(b.lastSync).getTime() - new Date(a.lastSync).getTime());
  }

  // ============================================
  // HEALTH GOALS
  // ============================================

  async getHealthGoals(patientId: string): Promise<HealthGoal[]> {
    return Array.from(this.healthGoals.values())
      .filter(goal => goal.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getHealthGoal(id: string): Promise<HealthGoal | undefined> {
    return this.healthGoals.get(id);
  }

  async createHealthGoal(goal: InsertHealthGoal): Promise<HealthGoal> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newGoal: HealthGoal = {
      id,
      patientId: goal.patientId,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      unit: goal.unit,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      status: goal.status || "active",
      progress: goal.progress || 0,
      notes: goal.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.healthGoals.set(id, newGoal);
    return newGoal;
  }

  async updateHealthGoal(id: string, updates: Partial<HealthGoal>, patientId: string): Promise<HealthGoal | undefined> {
    const goal = this.healthGoals.get(id);
    if (!goal || goal.patientId !== patientId) return undefined;
    
    const updatedGoal: HealthGoal = {
      ...goal,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.healthGoals.set(id, updatedGoal);
    return updatedGoal;
  }

  async deleteHealthGoal(id: string, patientId: string): Promise<void> {
    const goal = this.healthGoals.get(id);
    if (!goal || goal.patientId !== patientId) return;
    this.healthGoals.delete(id);
  }

  // ============================================
  // CARE PLANS
  // ============================================

  async getCarePlans(patientId: string): Promise<CarePlan[]> {
    return Array.from(this.carePlans.values())
      .filter(plan => plan.patientId === patientId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getCarePlan(id: string): Promise<CarePlan | undefined> {
    return this.carePlans.get(id);
  }

  async getActiveCarePlans(patientId: string): Promise<CarePlan[]> {
    return Array.from(this.carePlans.values())
      .filter(plan => plan.patientId === patientId && plan.status === "active")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async createCarePlan(plan: InsertCarePlan): Promise<CarePlan> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const newPlan: CarePlan = {
      id,
      patientId: plan.patientId,
      title: plan.title,
      description: plan.description,
      category: plan.category,
      status: plan.status || "draft",
      startDate: plan.startDate,
      endDate: plan.endDate,
      reviewDate: plan.reviewDate,
      goals: plan.goals || [],
      interventions: plan.interventions || [],
      careTeam: plan.careTeam || [],
      progressNotes: [],
      conditions: plan.conditions || [],
      createdBy: plan.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.carePlans.set(id, newPlan);
    return newPlan;
  }

  async updateCarePlan(id: string, updates: Partial<CarePlan>): Promise<CarePlan | undefined> {
    const plan = this.carePlans.get(id);
    if (!plan) return undefined;
    
    const updatedPlan: CarePlan = {
      ...plan,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.carePlans.set(id, updatedPlan);
    return updatedPlan;
  }

  async deleteCarePlan(id: string): Promise<void> {
    this.carePlans.delete(id);
  }

  async addCarePlanProgress(carePlanId: string, progress: InsertCarePlanProgress): Promise<CarePlan | undefined> {
    const plan = this.carePlans.get(carePlanId);
    if (!plan) return undefined;
    
    const newProgress: CarePlanProgress = {
      id: randomUUID(),
      date: new Date().toISOString(),
      goalId: progress.goalId,
      interventionId: progress.interventionId,
      note: progress.note,
      recordedBy: progress.recordedBy,
      type: progress.type,
    };
    
    const updatedPlan: CarePlan = {
      ...plan,
      progressNotes: [...plan.progressNotes, newProgress],
      updatedAt: new Date().toISOString(),
    };
    this.carePlans.set(carePlanId, updatedPlan);
    return updatedPlan;
  }

  async updateCarePlanGoal(carePlanId: string, goalId: string, updates: Partial<CarePlan["goals"][0]>): Promise<CarePlan | undefined> {
    const plan = this.carePlans.get(carePlanId);
    if (!plan) return undefined;
    
    const updatedGoals = plan.goals.map(goal => 
      goal.id === goalId ? { ...goal, ...updates } : goal
    );
    
    const updatedPlan: CarePlan = {
      ...plan,
      goals: updatedGoals,
      updatedAt: new Date().toISOString(),
    };
    this.carePlans.set(carePlanId, updatedPlan);
    return updatedPlan;
  }

  async updateCarePlanIntervention(carePlanId: string, interventionId: string, updates: Partial<CarePlan["interventions"][0]>): Promise<CarePlan | undefined> {
    const plan = this.carePlans.get(carePlanId);
    if (!plan) return undefined;
    
    const updatedInterventions = plan.interventions.map(intervention => 
      intervention.id === interventionId ? { ...intervention, ...updates } : intervention
    );
    
    const updatedPlan: CarePlan = {
      ...plan,
      interventions: updatedInterventions,
      updatedAt: new Date().toISOString(),
    };
    this.carePlans.set(carePlanId, updatedPlan);
    return updatedPlan;
  }

  // ============================================
  // ONBOARDING
  // ============================================

  async getOnboardingStatus(userId: string): Promise<OnboardingStatus | undefined> {
    return this.onboardingStatuses.get(userId);
  }

  async updateOnboardingStatus(userId: string, status: Partial<OnboardingStatus>): Promise<OnboardingStatus> {
    const existing = this.onboardingStatuses.get(userId) || {
      hasCompletedOnboarding: false,
      completedSteps: [],
    };
    
    const updated: OnboardingStatus = {
      ...existing,
      ...status,
    };
    this.onboardingStatuses.set(userId, updated);
    return updated;
  }

  async completeOnboarding(userId: string, completedSteps: string[]): Promise<OnboardingStatus> {
    const status: OnboardingStatus = {
      hasCompletedOnboarding: true,
      completedSteps,
      lastStepCompleted: completedSteps[completedSteps.length - 1],
      completedAt: new Date().toISOString(),
    };
    this.onboardingStatuses.set(userId, status);
    return status;
  }

  // ============================================
  // GAMIFICATION
  // ============================================

  async getPlayerStats(patientId: string): Promise<PlayerStats | undefined> {
    return this.playerStats.get(patientId);
  }

  async createPlayerStats(stats: PlayerStats): Promise<PlayerStats> {
    this.playerStats.set(stats.patientId, stats);
    return stats;
  }

  async updatePlayerStats(patientId: string, updates: Partial<PlayerStats>): Promise<PlayerStats | undefined> {
    const existing = this.playerStats.get(patientId);
    if (!existing) return undefined;
    
    const updated: PlayerStats = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.playerStats.set(patientId, updated);
    return updated;
  }

  async getPlayerBadges(patientId: string): Promise<PlayerBadge[]> {
    return Array.from(this.playerBadges.values())
      .filter(badge => badge.patientId === patientId)
      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
  }

  async awardBadge(badge: PlayerBadge): Promise<PlayerBadge> {
    this.playerBadges.set(badge.id, badge);
    return badge;
  }

  async markBadgeSeen(badgeId: string): Promise<void> {
    const badge = this.playerBadges.get(badgeId);
    if (badge) {
      badge.isNew = false;
      this.playerBadges.set(badgeId, badge);
    }
  }

  async getStreakRecords(patientId: string): Promise<StreakRecord[]> {
    return Array.from(this.streakRecords.values())
      .filter(streak => streak.patientId === patientId);
  }

  async getStreakRecord(patientId: string, streakType: string): Promise<StreakRecord | undefined> {
    return Array.from(this.streakRecords.values())
      .find(streak => streak.patientId === patientId && streak.streakType === streakType);
  }

  async updateStreakRecord(streak: StreakRecord): Promise<StreakRecord> {
    this.streakRecords.set(streak.id, streak);
    return streak;
  }

  async getPointTransactions(patientId: string, limit?: number): Promise<PointTransaction[]> {
    const transactions = Array.from(this.pointTransactions.values())
      .filter(t => t.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return limit ? transactions.slice(0, limit) : transactions;
  }

  async addPointTransaction(transaction: PointTransaction): Promise<PointTransaction> {
    this.pointTransactions.set(transaction.id, transaction);
    return transaction;
  }

  async getMotivationalNudges(patientId: string): Promise<MotivationalNudge[]> {
    return Array.from(this.motivationalNudges.values())
      .filter(nudge => nudge.patientId === patientId && !nudge.isDismissed)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNudge(nudge: MotivationalNudge): Promise<MotivationalNudge> {
    this.motivationalNudges.set(nudge.id, nudge);
    return nudge;
  }

  async dismissNudge(nudgeId: string): Promise<void> {
    const nudge = this.motivationalNudges.get(nudgeId);
    if (nudge) {
      nudge.isDismissed = true;
      this.motivationalNudges.set(nudgeId, nudge);
    }
  }

  async markNudgeRead(nudgeId: string): Promise<void> {
    const nudge = this.motivationalNudges.get(nudgeId);
    if (nudge) {
      nudge.isRead = true;
      this.motivationalNudges.set(nudgeId, nudge);
    }
  }

  async getAllPlayerStats(): Promise<PlayerStats[]> {
    return Array.from(this.playerStats.values());
  }

  // Family Medical History
  async getFamilyHistoryByPatient(patientId: string): Promise<FamilyMedicalHistory[]> {
    return Array.from(this.familyMedicalHistories.values())
      .filter(h => h.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getFamilyHistory(id: string): Promise<FamilyMedicalHistory | undefined> {
    return this.familyMedicalHistories.get(id);
  }

  async createFamilyHistory(history: InsertFamilyMedicalHistory): Promise<FamilyMedicalHistory> {
    const newHistory: FamilyMedicalHistory = {
      id: randomUUID(),
      ...history,
      createdAt: new Date().toISOString(),
    };
    this.familyMedicalHistories.set(newHistory.id, newHistory);
    return newHistory;
  }

  async updateFamilyHistory(id: string, updates: Partial<FamilyMedicalHistory>): Promise<FamilyMedicalHistory | undefined> {
    const existing = this.familyMedicalHistories.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.familyMedicalHistories.set(id, updated);
    return updated;
  }

  async deleteFamilyHistory(id: string): Promise<void> {
    this.familyMedicalHistories.delete(id);
  }

  // Lifestyle Profile
  async getLifestyleProfile(patientId: string): Promise<LifestyleProfile | undefined> {
    return Array.from(this.lifestyleProfiles.values()).find(p => p.patientId === patientId);
  }

  async createOrUpdateLifestyleProfile(patientId: string, profile: InsertLifestyleProfile): Promise<LifestyleProfile> {
    const existing = await this.getLifestyleProfile(patientId);
    
    if (existing) {
      const updated: LifestyleProfile = {
        ...existing,
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      this.lifestyleProfiles.set(existing.id, updated);
      return updated;
    } else {
      const newProfile: LifestyleProfile = {
        id: randomUUID(),
        patientId,
        dietType: profile.dietType || "omnivore",
        dietaryRestrictions: profile.dietaryRestrictions,
        dietNotes: profile.dietNotes,
        exerciseFrequency: profile.exerciseFrequency || "rarely",
        exerciseTypes: profile.exerciseTypes || [],
        exerciseMinutesPerSession: profile.exerciseMinutesPerSession,
        exerciseNotes: profile.exerciseNotes,
        averageSleepHours: profile.averageSleepHours || 7,
        sleepQuality: profile.sleepQuality || "fair",
        sleepIssues: profile.sleepIssues,
        sleepNotes: profile.sleepNotes,
        stressLevel: profile.stressLevel || "moderate",
        stressSources: profile.stressSources,
        stressManagement: profile.stressManagement,
        stressNotes: profile.stressNotes,
        smokingStatus: profile.smokingStatus || "never",
        alcoholConsumption: profile.alcoholConsumption || "occasional",
        caffeineIntake: profile.caffeineIntake || "moderate",
        createdAt: new Date().toISOString(),
      };
      this.lifestyleProfiles.set(newProfile.id, newProfile);
      return newProfile;
    }
  }

  // Extended Allergy with Emergency Info
  async getExtendedAllergy(id: string): Promise<ExtendedAllergy | undefined> {
    const allergy = this.allergies.get(id);
    if (!allergy) return undefined;
    
    const emergencyInfo = this.allergyEmergencyInfo.get(id);
    return { ...allergy, emergencyInfo };
  }

  async getExtendedAllergiesByPatient(patientId: string): Promise<ExtendedAllergy[]> {
    const allergies = Array.from(this.allergies.values()).filter(a => a.patientId === patientId);
    return allergies.map(allergy => ({
      ...allergy,
      emergencyInfo: this.allergyEmergencyInfo.get(allergy.id),
    }));
  }

  async updateAllergyEmergencyInfo(allergyId: string, emergencyInfo: AllergyEmergencyInfo): Promise<ExtendedAllergy | undefined> {
    const allergy = this.allergies.get(allergyId);
    if (!allergy) return undefined;
    
    this.allergyEmergencyInfo.set(allergyId, emergencyInfo);
    return { ...allergy, emergencyInfo };
  }

  // Prescription Management - Pharmacies
  async getPharmacies(): Promise<Pharmacy[]> {
    return Array.from(this.pharmacies.values());
  }

  async getPharmacy(id: string): Promise<Pharmacy | undefined> {
    return this.pharmacies.get(id);
  }

  async createPharmacy(pharmacy: InsertPharmacy): Promise<Pharmacy> {
    const now = new Date().toISOString();
    const newPharmacy: Pharmacy = {
      id: randomUUID(),
      ...pharmacy,
      isPreferred: pharmacy.isPreferred ?? false,
      supportsElectronicPrescribing: pharmacy.supportsElectronicPrescribing ?? true,
      networkStatus: pharmacy.networkStatus ?? "pending",
      deliveryAvailable: pharmacy.deliveryAvailable ?? false,
      is24Hour: pharmacy.is24Hour ?? false,
      acceptsMedicare: pharmacy.acceptsMedicare ?? true,
      acceptsMedicaid: pharmacy.acceptsMedicaid ?? true,
      apiKeyConfigured: false,
      createdAt: now,
      updatedAt: now,
    };
    this.pharmacies.set(newPharmacy.id, newPharmacy);
    return newPharmacy;
  }

  async updatePharmacy(id: string, updates: Partial<Pharmacy>): Promise<Pharmacy | undefined> {
    const pharmacy = this.pharmacies.get(id);
    if (!pharmacy) return undefined;
    const updated = { ...pharmacy, ...updates, updatedAt: new Date().toISOString() };
    this.pharmacies.set(id, updated);
    return updated;
  }
  
  // Pharmacy API Key Management (stored separately for security)
  
  async setPharmacyApiKey(pharmacyId: string, apiKey: string): Promise<boolean> {
    const pharmacy = this.pharmacies.get(pharmacyId);
    if (!pharmacy) return false;
    this.pharmacyApiKeys.set(pharmacyId, apiKey);
    // Update pharmacy to indicate API key is configured
    const updated = { 
      ...pharmacy, 
      apiKeyConfigured: true, 
      apiKeyLastUpdated: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.pharmacies.set(pharmacyId, updated);
    return true;
  }
  
  async clearPharmacyApiKey(pharmacyId: string): Promise<boolean> {
    const pharmacy = this.pharmacies.get(pharmacyId);
    if (!pharmacy) return false;
    this.pharmacyApiKeys.delete(pharmacyId);
    const updated = { 
      ...pharmacy, 
      apiKeyConfigured: false, 
      apiKeyLastUpdated: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.pharmacies.set(pharmacyId, updated);
    return true;
  }
  
  async hasPharmacyApiKey(pharmacyId: string): Promise<boolean> {
    return this.pharmacyApiKeys.has(pharmacyId);
  }
  
  // Get active pharmacies for patients to select from
  async getActivePharmacies(): Promise<Pharmacy[]> {
    return Array.from(this.pharmacies.values()).filter(p => p.networkStatus === "active");
  }

  async deletePharmacy(id: string): Promise<void> {
    this.pharmacies.delete(id);
    this.pharmacyApiKeys.delete(id); // Also remove API key if set
  }

  // Prescription Management - Patient Pharmacies
  async getPatientPharmacies(patientId: string): Promise<PatientPharmacy[]> {
    return Array.from(this.patientPharmacies.values()).filter(pp => pp.patientId === patientId);
  }

  async addPatientPharmacy(patientPharmacy: InsertPatientPharmacy): Promise<PatientPharmacy> {
    const newPP: PatientPharmacy = {
      id: randomUUID(),
      ...patientPharmacy,
      isPrimary: patientPharmacy.isPrimary ?? false,
      addedAt: new Date().toISOString(),
    };
    this.patientPharmacies.set(newPP.id, newPP);
    return newPP;
  }

  async removePatientPharmacy(patientId: string, pharmacyId: string): Promise<void> {
    for (const [id, pp] of this.patientPharmacies.entries()) {
      if (pp.patientId === patientId && pp.pharmacyId === pharmacyId) {
        this.patientPharmacies.delete(id);
        break;
      }
    }
  }

  async setPatientPrimaryPharmacy(patientId: string, pharmacyId: string): Promise<PatientPharmacy | undefined> {
    let targetPP: PatientPharmacy | undefined;
    for (const pp of this.patientPharmacies.values()) {
      if (pp.patientId === patientId) {
        const updated = { ...pp, isPrimary: pp.pharmacyId === pharmacyId };
        this.patientPharmacies.set(pp.id, updated);
        if (pp.pharmacyId === pharmacyId) targetPP = updated;
      }
    }
    return targetPP;
  }

  // Prescription Management - Prescriptions
  async getPrescriptions(patientId: string): Promise<Prescription[]> {
    return Array.from(this.prescriptions.values())
      .filter(p => p.patientId === patientId)
      .sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
  }

  async getPrescription(id: string): Promise<Prescription | undefined> {
    return this.prescriptions.get(id);
  }

  async createPrescription(prescription: InsertPrescription): Promise<Prescription> {
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setFullYear(expirationDate.getFullYear() + 1); // Default 1 year expiration

    const newPrescription: Prescription = {
      id: randomUUID(),
      ...prescription,
      refillsRemaining: prescription.refillsAuthorized,
      status: "active",
      prescribedDate: now.toISOString(),
      expirationDate: expirationDate.toISOString(),
      isControlledSubstance: prescription.isControlledSubstance ?? false,
      dispenseAsWritten: prescription.dispenseAsWritten ?? false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.prescriptions.set(newPrescription.id, newPrescription);
    return newPrescription;
  }

  async updatePrescription(id: string, updates: Partial<Prescription>): Promise<Prescription | undefined> {
    const prescription = this.prescriptions.get(id);
    if (!prescription) return undefined;
    const updated = { ...prescription, ...updates, updatedAt: new Date().toISOString() };
    this.prescriptions.set(id, updated);
    return updated;
  }

  async cancelPrescription(id: string): Promise<Prescription | undefined> {
    return this.updatePrescription(id, { status: "cancelled" });
  }

  async getPrescriptionsByProvider(providerId: string): Promise<Prescription[]> {
    return Array.from(this.prescriptions.values())
      .filter(p => p.providerId === providerId)
      .sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
  }

  async getActivePrescriptions(patientId: string): Promise<Prescription[]> {
    return Array.from(this.prescriptions.values())
      .filter(p => p.patientId === patientId && (p.status === "active" || p.status === "filled"))
      .sort((a, b) => new Date(b.prescribedDate).getTime() - new Date(a.prescribedDate).getTime());
  }

  // Prescription Management - Refill Requests
  async getRefillRequests(patientId: string): Promise<RefillRequest[]> {
    return Array.from(this.refillRequests.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime());
  }

  async getRefillRequest(id: string): Promise<RefillRequest | undefined> {
    return this.refillRequests.get(id);
  }

  async createRefillRequest(request: InsertRefillRequest): Promise<RefillRequest> {
    const now = new Date().toISOString();
    const newRequest: RefillRequest = {
      id: randomUUID(),
      ...request,
      status: "pending",
      requestedDate: now,
      urgency: request.urgency ?? "routine",
      deliveryRequested: request.deliveryRequested ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.refillRequests.set(newRequest.id, newRequest);
    return newRequest;
  }

  async updateRefillRequest(id: string, updates: Partial<RefillRequest>): Promise<RefillRequest | undefined> {
    const request = this.refillRequests.get(id);
    if (!request) return undefined;
    const updated = { ...request, ...updates, updatedAt: new Date().toISOString() };
    this.refillRequests.set(id, updated);
    return updated;
  }

  async getRefillRequestsByStatus(status: RefillRequestStatus): Promise<RefillRequest[]> {
    return Array.from(this.refillRequests.values()).filter(r => r.status === status);
  }

  async getPendingRefillRequestsForProvider(): Promise<RefillRequest[]> {
    return Array.from(this.refillRequests.values())
      .filter(r => r.status === "pending")
      .sort((a, b) => {
        const urgencyOrder = { emergency: 0, urgent: 1, routine: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
          new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime();
      });
  }

  // Prescription Management - Fill History
  async getPrescriptionFillHistory(prescriptionId: string): Promise<PrescriptionFillHistory[]> {
    return Array.from(this.prescriptionFillHistory.values())
      .filter(f => f.prescriptionId === prescriptionId)
      .sort((a, b) => new Date(b.fillDate).getTime() - new Date(a.fillDate).getTime());
  }

  async createPrescriptionFillHistory(fill: InsertPrescriptionFillHistory): Promise<PrescriptionFillHistory> {
    const newFill: PrescriptionFillHistory = {
      id: randomUUID(),
      ...fill,
    };
    this.prescriptionFillHistory.set(newFill.id, newFill);
    
    // Update prescription's last filled date and refills remaining
    const prescription = this.prescriptions.get(fill.prescriptionId);
    if (prescription && prescription.refillsRemaining > 0) {
      await this.updatePrescription(fill.prescriptionId, {
        lastFilledDate: fill.fillDate,
        refillsRemaining: prescription.refillsRemaining - 1,
        status: "filled",
      });
    }
    
    return newFill;
  }

  // Prescription Transfer Requests
  async getTransferRequests(patientId: string): Promise<PrescriptionTransferRequest[]> {
    return Array.from(this.prescriptionTransferRequests.values())
      .filter(t => t.patientId === patientId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  async getTransferRequest(id: string): Promise<PrescriptionTransferRequest | undefined> {
    return this.prescriptionTransferRequests.get(id);
  }

  async createTransferRequest(request: InsertPrescriptionTransferRequest): Promise<PrescriptionTransferRequest> {
    const now = new Date().toISOString();
    const newRequest: PrescriptionTransferRequest = {
      id: randomUUID(),
      ...request,
      status: "pending",
      requestedAt: now,
    };
    this.prescriptionTransferRequests.set(newRequest.id, newRequest);
    return newRequest;
  }

  async updateTransferRequest(id: string, updates: Partial<PrescriptionTransferRequest>): Promise<PrescriptionTransferRequest | undefined> {
    const request = this.prescriptionTransferRequests.get(id);
    if (!request) return undefined;
    const updated = { ...request, ...updates };
    this.prescriptionTransferRequests.set(id, updated);
    return updated;
  }

  async getTransferRequestsByStatus(status: TransferRequestStatus): Promise<PrescriptionTransferRequest[]> {
    return Array.from(this.prescriptionTransferRequests.values())
      .filter(t => t.status === status)
      .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
  }

  // Refill Status Notifications
  async getPatientNotifications(patientId: string): Promise<RefillStatusNotification[]> {
    return Array.from(this.refillStatusNotifications.values())
      .filter(n => n.patientId === patientId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }

  async getUnreadNotifications(patientId: string): Promise<RefillStatusNotification[]> {
    return Array.from(this.refillStatusNotifications.values())
      .filter(n => n.patientId === patientId && !n.readAt)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }

  async createNotification(notification: InsertRefillStatusNotification): Promise<RefillStatusNotification> {
    const newNotification: RefillStatusNotification = {
      id: randomUUID(),
      ...notification,
      sentAt: new Date().toISOString(),
    };
    this.refillStatusNotifications.set(newNotification.id, newNotification);
    return newNotification;
  }

  async markRefillNotificationRead(id: string): Promise<RefillStatusNotification | undefined> {
    const notification = this.refillStatusNotifications.get(id);
    if (!notification) return undefined;
    const updated = { ...notification, readAt: new Date().toISOString() };
    this.refillStatusNotifications.set(id, updated);
    return updated;
  }

  async markAllRefillNotificationsRead(patientId: string): Promise<void> {
    const now = new Date().toISOString();
    for (const [id, notification] of this.refillStatusNotifications) {
      if (notification.patientId === patientId && !notification.readAt) {
        this.refillStatusNotifications.set(id, { ...notification, readAt: now });
      }
    }
  }

  // Patient Notification Preferences
  async getNotificationPreferences(patientId: string): Promise<PatientNotificationPreferences | undefined> {
    return Array.from(this.patientNotificationPreferences.values())
      .find(p => p.patientId === patientId);
  }

  async createOrUpdateNotificationPreferences(preferences: InsertPatientNotificationPreferences): Promise<PatientNotificationPreferences> {
    const existing = await this.getNotificationPreferences(preferences.patientId);
    
    if (existing) {
      const updated: PatientNotificationPreferences = {
        ...existing,
        ...preferences,
      };
      this.patientNotificationPreferences.set(existing.id, updated);
      return updated;
    }
    
    const newPreferences: PatientNotificationPreferences = {
      id: randomUUID(),
      patientId: preferences.patientId,
      emailEnabled: preferences.emailEnabled ?? true,
      smsEnabled: preferences.smsEnabled ?? false,
      pushEnabled: preferences.pushEnabled ?? true,
      refillReminders: preferences.refillReminders ?? true,
      statusUpdates: preferences.statusUpdates ?? true,
      transferUpdates: preferences.transferUpdates ?? true,
      reminderDaysBefore: preferences.reminderDaysBefore ?? 3,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      preferredLanguage: preferences.preferredLanguage ?? "en",
    };
    this.patientNotificationPreferences.set(newPreferences.id, newPreferences);
    return newPreferences;
  }

  // Drug Interaction Checks
  async getDrugInteractionChecks(patientId: string): Promise<DrugInteractionCheckResult[]> {
    return Array.from(this.drugInteractionChecks.values())
      .filter(c => c.patientId === patientId)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  }

  async getDrugInteractionCheck(id: string): Promise<DrugInteractionCheckResult | undefined> {
    return this.drugInteractionChecks.get(id);
  }

  async createDrugInteractionCheck(check: DrugInteractionCheckResult): Promise<DrugInteractionCheckResult> {
    this.drugInteractionChecks.set(check.id, check);
    return check;
  }

  async acknowledgeDrugInteractionCheck(id: string, providerNotes?: string): Promise<DrugInteractionCheckResult | undefined> {
    const check = this.drugInteractionChecks.get(id);
    if (!check) return undefined;
    const updated: DrugInteractionCheckResult = {
      ...check,
      providerAcknowledged: true,
      providerAcknowledgedAt: new Date().toISOString(),
      providerNotes,
    };
    this.drugInteractionChecks.set(id, updated);
    return updated;
  }

  // PROM Questionnaires
  async getPromQuestionnaires(): Promise<PromQuestionnaire[]> {
    return Array.from(this.promQuestionnaires.values())
      .filter(q => q.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getPromQuestionnaire(id: string): Promise<PromQuestionnaire | undefined> {
    return this.promQuestionnaires.get(id);
  }

  async getPromQuestionnairesByCategory(category: PromCategory): Promise<PromQuestionnaire[]> {
    return Array.from(this.promQuestionnaires.values())
      .filter(q => q.category === category && q.isActive);
  }

  async createPromQuestionnaire(questionnaire: InsertPromQuestionnaire): Promise<PromQuestionnaire> {
    const now = new Date().toISOString();
    const newQuestionnaire: PromQuestionnaire = {
      id: randomUUID(),
      ...questionnaire,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.promQuestionnaires.set(newQuestionnaire.id, newQuestionnaire);
    return newQuestionnaire;
  }

  async updatePromQuestionnaire(id: string, updates: Partial<PromQuestionnaire>): Promise<PromQuestionnaire | undefined> {
    const questionnaire = this.promQuestionnaires.get(id);
    if (!questionnaire) return undefined;
    const updated = { ...questionnaire, ...updates, updatedAt: new Date().toISOString() };
    this.promQuestionnaires.set(id, updated);
    return updated;
  }

  // Patient PROM Assignments
  async getPatientPromAssignments(patientId: string): Promise<PatientPromAssignment[]> {
    return Array.from(this.patientPromAssignments.values())
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getPatientPromAssignment(id: string): Promise<PatientPromAssignment | undefined> {
    return this.patientPromAssignments.get(id);
  }

  async getDuePromAssignments(patientId: string): Promise<PatientPromAssignment[]> {
    const now = new Date();
    return Array.from(this.patientPromAssignments.values())
      .filter(a => a.patientId === patientId && a.isActive && new Date(a.nextDueDate) <= now)
      .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime());
  }

  async createPatientPromAssignment(assignment: InsertPatientPromAssignment): Promise<PatientPromAssignment> {
    const now = new Date().toISOString();
    const newAssignment: PatientPromAssignment = {
      id: randomUUID(),
      ...assignment,
      nextDueDate: assignment.startDate,
      isActive: true,
      createdAt: now,
    };
    this.patientPromAssignments.set(newAssignment.id, newAssignment);
    return newAssignment;
  }

  async updatePatientPromAssignment(id: string, updates: Partial<PatientPromAssignment>): Promise<PatientPromAssignment | undefined> {
    const assignment = this.patientPromAssignments.get(id);
    if (!assignment) return undefined;
    const updated = { ...assignment, ...updates };
    this.patientPromAssignments.set(id, updated);
    return updated;
  }

  async deactivatePatientPromAssignment(id: string): Promise<void> {
    const assignment = this.patientPromAssignments.get(id);
    if (assignment) {
      this.patientPromAssignments.set(id, { ...assignment, isActive: false });
    }
  }

  // PROM Responses
  async getPromResponses(patientId: string): Promise<PromResponse[]> {
    return Array.from(this.promResponses.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getPromResponsesByQuestionnaire(patientId: string, questionnaireId: string): Promise<PromResponse[]> {
    return Array.from(this.promResponses.values())
      .filter(r => r.patientId === patientId && r.questionnaireId === questionnaireId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getPromResponse(id: string): Promise<PromResponse | undefined> {
    return this.promResponses.get(id);
  }

  async createPromResponse(response: InsertPromResponse): Promise<PromResponse> {
    const newResponse: PromResponse = {
      id: randomUUID(),
      ...response,
      completedAt: new Date().toISOString(),
    };
    this.promResponses.set(newResponse.id, newResponse);
    
    const assignment = await this.getPatientPromAssignment(response.assignmentId);
    if (assignment) {
      const frequencyDays: Record<string, number> = {
        daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, as_needed: 7
      };
      const days = frequencyDays[assignment.frequency] || 7;
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + days);
      await this.updatePatientPromAssignment(assignment.id, { nextDueDate: nextDue.toISOString() });
    }
    
    return newResponse;
  }

  async getPromTrends(patientId: string, questionnaireId?: string): Promise<PromTrend[]> {
    const responses = Array.from(this.promResponses.values())
      .filter(r => r.patientId === patientId && (!questionnaireId || r.questionnaireId === questionnaireId));
    
    const grouped: Map<string, PromResponse[]> = new Map();
    for (const response of responses) {
      const existing = grouped.get(response.questionnaireId) || [];
      existing.push(response);
      grouped.set(response.questionnaireId, existing);
    }
    
    const trends: PromTrend[] = [];
    for (const [qId, qResponses] of grouped) {
      const questionnaire = await this.getPromQuestionnaire(qId);
      if (!questionnaire) continue;
      
      const sortedResponses = qResponses.sort((a, b) => 
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      
      const dataPoints = sortedResponses.map(r => ({
        date: r.completedAt,
        score: r.percentageScore,
        severity: r.severity,
      }));
      
      const avgScore = dataPoints.reduce((sum, dp) => sum + dp.score, 0) / dataPoints.length;
      
      let trend: "improving" | "stable" | "worsening" = "stable";
      let trendPercentage = 0;
      if (dataPoints.length >= 2) {
        const recent = dataPoints.slice(-3);
        const older = dataPoints.slice(0, Math.min(3, dataPoints.length - 1));
        const recentAvg = recent.reduce((sum, dp) => sum + dp.score, 0) / recent.length;
        const olderAvg = older.reduce((sum, dp) => sum + dp.score, 0) / older.length;
        trendPercentage = ((recentAvg - olderAvg) / olderAvg) * 100;
        if (trendPercentage > 5) trend = "improving";
        else if (trendPercentage < -5) trend = "worsening";
      }
      
      trends.push({
        patientId,
        questionnaireId: qId,
        questionnaireName: questionnaire.name,
        category: questionnaire.category,
        dataPoints,
        averageScore: avgScore,
        trend,
        trendPercentage,
      });
    }
    
    return trends;
  }

  // Provider Alerts
  async getProviderAlerts(providerId: string): Promise<ProviderAlert[]> {
    return Array.from(this.providerAlerts.values())
      .filter(a => a.providerId === providerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getProviderAlertsByPatient(patientId: string): Promise<ProviderAlert[]> {
    return Array.from(this.providerAlerts.values())
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getProviderAlert(id: string): Promise<ProviderAlert | undefined> {
    return this.providerAlerts.get(id);
  }

  async createProviderAlert(alert: InsertProviderAlert): Promise<ProviderAlert> {
    const now = new Date().toISOString();
    const newAlert: ProviderAlert = {
      id: randomUUID(),
      ...alert,
      status: "new",
      createdAt: now,
      updatedAt: now,
    };
    this.providerAlerts.set(newAlert.id, newAlert);
    return newAlert;
  }

  async updateProviderAlert(id: string, updates: UpdateProviderAlert): Promise<ProviderAlert | undefined> {
    const alert = this.providerAlerts.get(id);
    if (!alert) return undefined;
    const updated = { ...alert, ...updates, updatedAt: new Date().toISOString() };
    this.providerAlerts.set(id, updated);
    return updated;
  }

  async getUnacknowledgedAlerts(providerId: string): Promise<ProviderAlert[]> {
    return Array.from(this.providerAlerts.values())
      .filter(a => a.providerId === providerId && a.status === "new")
      .sort((a, b) => {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4);
      });
  }

  async acknowledgeAlert(id: string, acknowledgedBy: string): Promise<ProviderAlert | undefined> {
    const alert = this.providerAlerts.get(id);
    if (!alert) return undefined;
    const now = new Date().toISOString();
    const updated = { ...alert, status: "acknowledged" as AlertStatus, acknowledgedAt: now, acknowledgedBy, updatedAt: now };
    this.providerAlerts.set(id, updated);
    return updated;
  }

  async resolveAlert(id: string, resolvedBy: string, notes?: string): Promise<ProviderAlert | undefined> {
    const alert = this.providerAlerts.get(id);
    if (!alert) return undefined;
    const now = new Date().toISOString();
    const updated = { ...alert, status: "resolved" as AlertStatus, resolvedAt: now, resolvedBy, resolutionNotes: notes, updatedAt: now };
    this.providerAlerts.set(id, updated);
    return updated;
  }

  // Health Tips
  async getHealthTips(): Promise<HealthTip[]> {
    return Array.from(this.healthTips.values())
      .filter(t => t.isActive)
      .sort((a, b) => b.priority - a.priority);
  }

  async getHealthTipsByCategory(category: HealthTipCategory): Promise<HealthTip[]> {
    return Array.from(this.healthTips.values())
      .filter(t => t.category === category && t.isActive)
      .sort((a, b) => b.priority - a.priority);
  }

  async getHealthTip(id: string): Promise<HealthTip | undefined> {
    return this.healthTips.get(id);
  }

  async createHealthTip(tip: InsertHealthTip): Promise<HealthTip> {
    const now = new Date().toISOString();
    const newTip: HealthTip = {
      id: randomUUID(),
      ...tip,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.healthTips.set(newTip.id, newTip);
    return newTip;
  }

  async updateHealthTip(id: string, updates: Partial<HealthTip>): Promise<HealthTip | undefined> {
    const tip = this.healthTips.get(id);
    if (!tip) return undefined;
    const updated = { ...tip, ...updates, updatedAt: new Date().toISOString() };
    this.healthTips.set(id, updated);
    return updated;
  }

  // Patient Health Tips
  async getPatientHealthTips(patientId: string): Promise<PatientHealthTip[]> {
    const tips = Array.from(this.patientHealthTips.values())
      .filter(t => t.patientId === patientId);
    
    for (const tip of tips) {
      tip.healthTip = await this.getHealthTip(tip.healthTipId);
    }
    
    return tips.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
  }

  async getUnreadPatientHealthTips(patientId: string): Promise<PatientHealthTip[]> {
    const tips = Array.from(this.patientHealthTips.values())
      .filter(t => t.patientId === patientId && !t.isRead);
    
    for (const tip of tips) {
      tip.healthTip = await this.getHealthTip(tip.healthTipId);
    }
    
    return tips.sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
  }

  async createPatientHealthTip(tip: InsertPatientHealthTip): Promise<PatientHealthTip> {
    const newTip: PatientHealthTip = {
      id: randomUUID(),
      ...tip,
      isRead: false,
      isBookmarked: false,
      deliveredAt: new Date().toISOString(),
    };
    this.patientHealthTips.set(newTip.id, newTip);
    return newTip;
  }

  async markPatientHealthTipRead(id: string): Promise<PatientHealthTip | undefined> {
    const tip = this.patientHealthTips.get(id);
    if (!tip) return undefined;
    const updated = { ...tip, isRead: true, readAt: new Date().toISOString() };
    this.patientHealthTips.set(id, updated);
    return updated;
  }

  async bookmarkPatientHealthTip(id: string, bookmarked: boolean): Promise<PatientHealthTip | undefined> {
    const tip = this.patientHealthTips.get(id);
    if (!tip) return undefined;
    const updated = { ...tip, isBookmarked: bookmarked };
    this.patientHealthTips.set(id, updated);
    return updated;
  }

  async ratePatientHealthTip(id: string, rating: number, comment?: string): Promise<PatientHealthTip | undefined> {
    const tip = this.patientHealthTips.get(id);
    if (!tip) return undefined;
    const updated = { ...tip, feedbackRating: rating, feedbackComment: comment };
    this.patientHealthTips.set(id, updated);
    return updated;
  }

  // Personalized Health Content
  async getPersonalizedHealthContent(patientId: string): Promise<PersonalizedHealthContent[]> {
    return Array.from(this.personalizedHealthContents.values())
      .filter(c => c.patientId === patientId && new Date(c.expiresAt) > new Date())
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async createPersonalizedHealthContent(content: PersonalizedHealthContent): Promise<PersonalizedHealthContent> {
    this.personalizedHealthContents.set(content.id, content);
    return content;
  }

  async markPersonalizedContentRead(id: string): Promise<PersonalizedHealthContent | undefined> {
    const content = this.personalizedHealthContents.get(id);
    if (!content) return undefined;
    const updated = { ...content, isRead: true };
    this.personalizedHealthContents.set(id, updated);
    return updated;
  }

  async ratePersonalizedContent(id: string, rating: number): Promise<PersonalizedHealthContent | undefined> {
    const content = this.personalizedHealthContents.get(id);
    if (!content) return undefined;
    const updated = { ...content, feedbackRating: rating };
    this.personalizedHealthContents.set(id, updated);
    return updated;
  }

  // Patient Engagement Metrics
  async getPatientEngagementMetrics(patientId: string): Promise<PatientEngagementMetrics | undefined> {
    return this.patientEngagementMetrics.get(patientId);
  }

  async updatePatientEngagementMetrics(patientId: string, metrics: Partial<PatientEngagementMetrics>): Promise<PatientEngagementMetrics> {
    const existing = this.patientEngagementMetrics.get(patientId);
    const updated: PatientEngagementMetrics = {
      patientId,
      promCompletionRate: metrics.promCompletionRate ?? existing?.promCompletionRate ?? 0,
      averageResponseTime: metrics.averageResponseTime ?? existing?.averageResponseTime ?? 0,
      streakDays: metrics.streakDays ?? existing?.streakDays ?? 0,
      tipsViewed: metrics.tipsViewed ?? existing?.tipsViewed ?? 0,
      tipsBookmarked: metrics.tipsBookmarked ?? existing?.tipsBookmarked ?? 0,
      lastActiveDate: metrics.lastActiveDate ?? existing?.lastActiveDate ?? new Date().toISOString(),
      engagementScore: metrics.engagementScore ?? existing?.engagementScore ?? 0,
      engagementTrend: metrics.engagementTrend ?? existing?.engagementTrend ?? "stable",
    };
    this.patientEngagementMetrics.set(patientId, updated);
    return updated;
  }

  // AI Triage
  async getTriageSessions(patientId: string): Promise<TriageSession[]> {
    return Array.from(this.triageSessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getTriageSession(id: string): Promise<TriageSession | undefined> {
    return this.triageSessions.get(id);
  }

  async createTriageSession(session: InsertTriageSession): Promise<TriageSession> {
    const newSession: TriageSession = {
      id: randomUUID(),
      ...session,
      status: "in_progress",
      createdAt: new Date().toISOString(),
    };
    this.triageSessions.set(newSession.id, newSession);
    return newSession;
  }

  async updateTriageSession(id: string, updates: Partial<TriageSession>): Promise<TriageSession | undefined> {
    const session = this.triageSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    if (updates.status === "completed" && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    this.triageSessions.set(id, updated);
    return updated;
  }

  async getRecentTriageSessions(patientId: string, limit: number = 5): Promise<TriageSession[]> {
    return Array.from(this.triageSessions.values())
      .filter(s => s.patientId === patientId && s.status === "completed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // Medical Summaries
  async getMedicalSummaries(patientId: string): Promise<MedicalSummary[]> {
    return Array.from(this.medicalSummaries.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getMedicalSummary(id: string): Promise<MedicalSummary | undefined> {
    return this.medicalSummaries.get(id);
  }

  async createMedicalSummary(summary: MedicalSummary): Promise<MedicalSummary> {
    this.medicalSummaries.set(summary.id, summary);
    return summary;
  }

  async getRecentMedicalSummaries(patientId: string, limit: number = 10): Promise<MedicalSummary[]> {
    return Array.from(this.medicalSummaries.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
  }

  // Education Content
  async getEducationContent(patientId: string): Promise<EducationContent[]> {
    return Array.from(this.educationContent.values())
      .filter(c => c.patientId === patientId)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getEducationContentByCategory(patientId: string, category: EducationCategory): Promise<EducationContent[]> {
    return Array.from(this.educationContent.values())
      .filter(c => c.patientId === patientId && c.category === category)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getEducationContentItem(id: string): Promise<EducationContent | undefined> {
    return this.educationContent.get(id);
  }

  async createEducationContent(content: EducationContent): Promise<EducationContent> {
    this.educationContent.set(content.id, content);
    return content;
  }

  async deleteEducationContent(id: string): Promise<void> {
    this.educationContent.delete(id);
  }

  // Education FAQs
  async getEducationFAQs(patientId: string): Promise<EducationFAQ[]> {
    return Array.from(this.educationFAQs.values())
      .filter(f => f.patientId === patientId)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getEducationFAQsByCategory(patientId: string, category: EducationCategory): Promise<EducationFAQ[]> {
    return Array.from(this.educationFAQs.values())
      .filter(f => f.patientId === patientId && f.category === category)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async createEducationFAQ(faq: EducationFAQ): Promise<EducationFAQ> {
    this.educationFAQs.set(faq.id, faq);
    return faq;
  }

  async voteEducationFAQ(id: string, helpful: boolean): Promise<EducationFAQ | undefined> {
    const faq = this.educationFAQs.get(id);
    if (!faq) return undefined;
    const updated = { ...faq, helpfulVotes: faq.helpfulVotes + (helpful ? 1 : -1) };
    this.educationFAQs.set(id, updated);
    return updated;
  }

  // Education Quizzes
  async getEducationQuizzes(patientId: string): Promise<EducationQuiz[]> {
    return Array.from(this.educationQuizzes.values())
      .filter(q => q.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getEducationQuiz(id: string): Promise<EducationQuiz | undefined> {
    return this.educationQuizzes.get(id);
  }

  async createEducationQuiz(quiz: EducationQuiz): Promise<EducationQuiz> {
    this.educationQuizzes.set(quiz.id, quiz);
    return quiz;
  }

  // Quiz Attempts
  async getQuizAttempts(patientId: string): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values())
      .filter(a => a.patientId === patientId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async getQuizAttemptsByQuiz(quizId: string): Promise<QuizAttempt[]> {
    return Array.from(this.quizAttempts.values())
      .filter(a => a.quizId === quizId)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }

  async createQuizAttempt(attempt: QuizAttempt): Promise<QuizAttempt> {
    this.quizAttempts.set(attempt.id, attempt);
    return attempt;
  }

  // Learning Progress
  async getLearningProgress(patientId: string): Promise<LearningProgress[]> {
    return Array.from(this.learningProgress.values())
      .filter(p => p.patientId === patientId)
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());
  }

  async getLearningProgressByContent(patientId: string, contentId: string): Promise<LearningProgress | undefined> {
    return Array.from(this.learningProgress.values())
      .find(p => p.patientId === patientId && p.contentId === contentId);
  }

  async createLearningProgress(progress: LearningProgress): Promise<LearningProgress> {
    this.learningProgress.set(progress.id, progress);
    return progress;
  }

  async updateLearningProgress(id: string, updates: Partial<LearningProgress>): Promise<LearningProgress | undefined> {
    const progress = this.learningProgress.get(id);
    if (!progress) return undefined;
    const updated = { ...progress, ...updates, lastAccessedAt: new Date().toISOString() };
    if (updates.status === "completed" && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    this.learningProgress.set(id, updated);
    return updated;
  }

  // Learning Stats
  async getLearningStats(patientId: string): Promise<LearningStats | undefined> {
    const progress = await this.getLearningProgress(patientId);
    const attempts = await this.getQuizAttempts(patientId);
    const streak = await this.getLearningStreak(patientId);

    if (progress.length === 0 && attempts.length === 0) return undefined;

    const completedContent = progress.filter(p => p.status === "completed");
    const passedQuizzes = attempts.filter(a => a.passed);

    const categoryCount: Record<string, number> = {};
    const contentItems = await this.getEducationContent(patientId);
    completedContent.forEach(p => {
      const content = contentItems.find(c => c.id === p.contentId);
      if (content) {
        categoryCount[content.category] = (categoryCount[content.category] || 0) + 1;
      }
    });

    const topCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category: category as EducationCategory, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      patientId,
      totalContentViewed: completedContent.length,
      totalQuizzesTaken: attempts.length,
      totalQuizzesPassed: passedQuizzes.length,
      averageQuizScore: attempts.length > 0 
        ? Math.round(attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length)
        : 0,
      totalTimeSpentMinutes: progress.reduce((sum, p) => sum + Math.round(p.timeSpent / 60), 0),
      articlesRead: completedContent.filter(p => p.contentType === "article").length,
      faqsViewed: completedContent.filter(p => p.contentType === "faq").length,
      videosWatched: completedContent.filter(p => p.contentType === "video").length,
      currentStreak: streak?.currentStreak || 0,
      longestStreak: streak?.longestStreak || 0,
      pointsEarned: passedQuizzes.reduce((sum, a) => sum + a.totalPoints, 0),
      badgesEarned: [],
      topCategories,
      weeklyProgress: [],
      lastActivityDate: progress[0]?.lastAccessedAt || new Date().toISOString(),
    };
  }

  async getLearningStreak(patientId: string): Promise<LearningStreak | undefined> {
    return this.learningStreaks.get(patientId);
  }

  async updateLearningStreak(patientId: string, updates: Partial<LearningStreak>): Promise<LearningStreak> {
    const existing = this.learningStreaks.get(patientId);
    const updated: LearningStreak = existing 
      ? { ...existing, ...updates }
      : {
          id: randomUUID(),
          patientId,
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: new Date().toISOString(),
          totalDaysActive: 0,
          ...updates,
        };
    this.learningStreaks.set(patientId, updated);
    return updated;
  }

  // Telehealth Sessions
  async getTelehealthSessions(patientId: string): Promise<TelehealthSession[]> {
    return Array.from(this.telehealthSessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }

  async getTelehealthSessionsByProvider(providerId: string): Promise<TelehealthSession[]> {
    return Array.from(this.telehealthSessions.values())
      .filter(s => s.providerId === providerId)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }

  async getTelehealthSession(id: string): Promise<TelehealthSession | undefined> {
    return this.telehealthSessions.get(id);
  }

  async getTelehealthSessionByRoom(roomId: string): Promise<TelehealthSession | undefined> {
    return Array.from(this.telehealthSessions.values()).find(s => s.roomId === roomId);
  }

  async createTelehealthSession(session: InsertTelehealthSession): Promise<TelehealthSession> {
    const now = new Date().toISOString();
    const newSession: TelehealthSession = {
      id: randomUUID(),
      ...session,
      status: "scheduled",
      roomId: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.telehealthSessions.set(newSession.id, newSession);
    return newSession;
  }

  async updateTelehealthSession(id: string, updates: Partial<TelehealthSession>): Promise<TelehealthSession | undefined> {
    const session = this.telehealthSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
    this.telehealthSessions.set(id, updated);
    return updated;
  }

  async getUpcomingTelehealthSessions(patientId: string): Promise<TelehealthSession[]> {
    const now = new Date();
    return Array.from(this.telehealthSessions.values())
      .filter(s => s.patientId === patientId && 
                   new Date(s.scheduledAt) >= now && 
                   (s.status === "scheduled" || s.status === "waiting"))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  async getPendingTelehealthSessions(): Promise<TelehealthSession[]> {
    return Array.from(this.telehealthSessions.values())
      .filter(s => s.status === "scheduled" || s.status === "waiting")
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  async getTodayTelehealthSessions(today: string): Promise<TelehealthSession[]> {
    return Array.from(this.telehealthSessions.values())
      .filter(s => s.scheduledAt.startsWith(today))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  // Consultation Notes
  async getConsultationNotes(patientId: string): Promise<ConsultationNote[]> {
    return Array.from(this.consultationNotes.values())
      .filter(n => n.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getConsultationNote(id: string): Promise<ConsultationNote | undefined> {
    return this.consultationNotes.get(id);
  }

  async getConsultationNoteBySession(sessionId: string): Promise<ConsultationNote | undefined> {
    return Array.from(this.consultationNotes.values()).find(n => n.sessionId === sessionId);
  }

  async createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote> {
    const now = new Date().toISOString();
    const newNote: ConsultationNote = {
      id: randomUUID(),
      ...note,
      createdAt: now,
      updatedAt: now,
    };
    this.consultationNotes.set(newNote.id, newNote);
    return newNote;
  }

  async updateConsultationNote(id: string, updates: Partial<ConsultationNote>): Promise<ConsultationNote | undefined> {
    const note = this.consultationNotes.get(id);
    if (!note) return undefined;
    const updated = { ...note, ...updates, updatedAt: new Date().toISOString() };
    this.consultationNotes.set(id, updated);
    return updated;
  }

  // Search
  async searchPatientData(query: string, patientId?: string, filters?: SearchFilters): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search through conditions/problems
    if (!filters?.dataTypes || filters.dataTypes.includes("conditions")) {
      const problems = patientId 
        ? await this.getProblems(patientId)
        : Array.from(this.problems.values());
      
      for (const problem of problems) {
        const patient = await this.getPatient(problem.patientId);
        if (problem.name.toLowerCase().includes(lowerQuery) || 
            problem.code?.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: problem.id,
            dataType: "conditions",
            patientId: problem.patientId,
            patientName: patient?.name || "Unknown",
            title: problem.name,
            summary: `${problem.status} - ${problem.severity || 'N/A'} severity`,
            highlights: [problem.name],
            relevanceScore: problem.name.toLowerCase().includes(lowerQuery) ? 100 : 70,
            date: problem.onsetDate || problem.recordedDate,
            metadata: { code: problem.code, status: problem.status },
          });
        }
      }
    }

    // Search through medications
    if (!filters?.dataTypes || filters.dataTypes.includes("medications")) {
      const medications = patientId 
        ? await this.getMedications(patientId)
        : Array.from(this.medications.values());

      for (const med of medications) {
        const patient = await this.getPatient(med.patientId);
        if (med.name.toLowerCase().includes(lowerQuery) || 
            med.dosage?.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: med.id,
            dataType: "medications",
            patientId: med.patientId,
            patientName: patient?.name || "Unknown",
            title: med.name,
            summary: `${med.dosage} - ${med.frequency}`,
            highlights: [med.name],
            relevanceScore: med.name.toLowerCase().includes(lowerQuery) ? 100 : 70,
            date: med.startDate || new Date().toISOString(),
            metadata: { dosage: med.dosage, frequency: med.frequency, status: med.status },
          });
        }
      }
    }

    // Search through allergies
    if (!filters?.dataTypes || filters.dataTypes.includes("allergies")) {
      const allergies = patientId 
        ? await this.getAllergies(patientId)
        : Array.from(this.allergies.values());

      for (const allergy of allergies) {
        const patient = await this.getPatient(allergy.patientId);
        if (allergy.allergen.toLowerCase().includes(lowerQuery) || 
            allergy.reaction?.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: allergy.id,
            dataType: "allergies",
            patientId: allergy.patientId,
            patientName: patient?.name || "Unknown",
            title: allergy.allergen,
            summary: `Reaction: ${allergy.reaction || 'Unknown'} - ${allergy.severity}`,
            highlights: [allergy.allergen],
            relevanceScore: allergy.allergen.toLowerCase().includes(lowerQuery) ? 100 : 70,
            date: allergy.recordedDate,
            metadata: { reaction: allergy.reaction, severity: allergy.severity },
          });
        }
      }
    }

    // Search through lab results
    if (!filters?.dataTypes || filters.dataTypes.includes("lab_results")) {
      const labs = patientId 
        ? await this.getLabResults(patientId)
        : Array.from(this.labResults.values());

      for (const lab of labs) {
        const patient = await this.getPatient(lab.patientId);
        if (lab.testName.toLowerCase().includes(lowerQuery) || 
            lab.category?.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: lab.id,
            dataType: "lab_results",
            patientId: lab.patientId,
            patientName: patient?.name || "Unknown",
            title: lab.testName,
            summary: `${lab.value} ${lab.unit} (${lab.referenceRange})`,
            highlights: [lab.testName],
            relevanceScore: lab.testName.toLowerCase().includes(lowerQuery) ? 100 : 70,
            date: lab.date,
            metadata: { value: lab.value, unit: lab.unit, status: lab.status },
          });
        }
      }
    }

    // Search through telehealth notes
    if (!filters?.dataTypes || filters.dataTypes.includes("telehealth_notes")) {
      const notes = patientId 
        ? await this.getConsultationNotes(patientId)
        : Array.from(this.consultationNotes.values());

      for (const note of notes) {
        const patient = await this.getPatient(note.patientId);
        if (note.chiefComplaint.toLowerCase().includes(lowerQuery) || 
            note.assessment.toLowerCase().includes(lowerQuery) ||
            note.plan.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: note.id,
            dataType: "telehealth_notes",
            patientId: note.patientId,
            patientName: patient?.name || "Unknown",
            title: note.chiefComplaint,
            summary: note.assessment.substring(0, 200),
            highlights: [note.chiefComplaint],
            relevanceScore: note.chiefComplaint.toLowerCase().includes(lowerQuery) ? 100 : 70,
            date: note.createdAt,
            provider: note.providerName,
            metadata: { sessionId: note.sessionId, diagnoses: note.diagnoses },
          });
        }
      }
    }

    // Search through triage assessments
    if (!filters?.dataTypes || filters.dataTypes.includes("triage_assessments")) {
      const sessions = patientId 
        ? await this.getTriageSessions(patientId)
        : Array.from(this.triageSessions.values());

      for (const session of sessions) {
        const patient = await this.getPatient(session.patientId);
        const symptoms = session.symptoms?.join(", ") || "";
        if (symptoms.toLowerCase().includes(lowerQuery) || 
            session.aiRecommendation?.toLowerCase().includes(lowerQuery)) {
          results.push({
            id: session.id,
            dataType: "triage_assessments",
            patientId: session.patientId,
            patientName: patient?.name || "Unknown",
            title: `Symptom Assessment - ${session.urgencyLevel}`,
            summary: symptoms.substring(0, 200),
            highlights: session.symptoms || [],
            relevanceScore: 70,
            date: session.createdAt,
            metadata: { urgencyLevel: session.urgencyLevel, status: session.status },
          });
        }
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results;
  }

  async saveSearchQuery(query: SearchQuery): Promise<SearchQuery> {
    this.searchQueries.set(query.id, query);
    return query;
  }

  async getRecentSearches(userId: string, limit: number = 10): Promise<SearchQuery[]> {
    return Array.from(this.searchQueries.values())
      .filter(q => q.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // ============================================
  // PROVIDER ANALYTICS DASHBOARD METHODS
  // ============================================

  async getAnalyticsDashboardData(): Promise<AnalyticsDashboardData> {
    const patients = Array.from(this.patients.values());
    const medications = Array.from(this.medications.values());
    const problems = Array.from(this.problems.values());
    const telehealthSessions = Array.from(this.telehealthSessions.values());
    const promResponses = Array.from(this.promResponses.values());
    const riskAssessments = Array.from(this.healthRiskAssessments.values());
    
    const totalPatients = patients.length;
    const activePatients = patients.filter(p => 
      medications.some(m => m.patientId === p.id && m.status === "active") ||
      telehealthSessions.some(s => s.patientId === p.id && new Date(s.scheduledAt) > new Date(Date.now() - 90 * 86400000))
    ).length;
    
    // Calculate at-risk patients based on risk assessments
    const highRiskPatients = riskAssessments.filter(r => r.riskLevel === "high" || r.riskLevel === "elevated");
    const atRiskCount = new Set(highRiskPatients.map(r => r.patientId)).size;

    // Condition prevalence
    const conditionCounts = new Map<string, number>();
    problems.forEach(p => {
      if (p.status === "active") {
        const count = conditionCounts.get(p.name) || 0;
        conditionCounts.set(p.name, count + 1);
      }
    });
    const conditionPrevalence = Array.from(conditionCounts.entries())
      .map(([condition, count]) => ({
        condition,
        count,
        trend: Math.floor(Math.random() * 20) - 10, // Simulated trend
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top medications
    const medicationCounts = new Map<string, { count: number; activeCount: number }>();
    medications.forEach(m => {
      const existing = medicationCounts.get(m.name) || { count: 0, activeCount: 0 };
      existing.count++;
      if (m.status === "active") existing.activeCount++;
      medicationCounts.set(m.name, existing);
    });
    const topMedications = Array.from(medicationCounts.entries())
      .map(([medication, data]) => ({
        medication,
        patientCount: data.count,
        adherenceRate: 0.7 + Math.random() * 0.3, // Simulated adherence
      }))
      .sort((a, b) => b.patientCount - a.patientCount)
      .slice(0, 10);

    // Risk distribution
    const riskLevels = ["low", "moderate", "high", "critical"];
    const riskDistribution = riskLevels.map(level => {
      const count = level === "low" ? Math.floor(totalPatients * 0.5) :
                    level === "moderate" ? Math.floor(totalPatients * 0.3) :
                    level === "high" ? Math.floor(totalPatients * 0.15) :
                    Math.floor(totalPatients * 0.05);
      return {
        level,
        count,
        percentage: totalPatients > 0 ? (count / totalPatients) * 100 : 0,
      };
    });

    // Demographic breakdown
    const ageGroups = ["0-17", "18-34", "35-50", "51-65", "65+"];
    const demographicBreakdown = [
      {
        category: "Age Group",
        data: ageGroups.map(value => ({
          value,
          count: Math.floor(totalPatients / ageGroups.length) + Math.floor(Math.random() * 3),
        })),
      },
      {
        category: "Gender",
        data: [
          { value: "Male", count: Math.floor(totalPatients * 0.48) },
          { value: "Female", count: Math.floor(totalPatients * 0.51) },
          { value: "Other", count: Math.floor(totalPatients * 0.01) },
        ],
      },
    ];

    // Recent trends - last 7 days
    const recentTrends = [
      {
        metric: "Active Patients",
        values: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split("T")[0],
          value: activePatients + Math.floor(Math.random() * 10) - 5,
        })),
      },
      {
        metric: "Telehealth Sessions",
        values: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 86400000).toISOString().split("T")[0],
          value: Math.floor(Math.random() * 15) + 5,
        })),
      },
    ];

    // At-risk patients list
    const atRiskPatients = await this.getAtRiskPatients("high", 10);

    return {
      overview: {
        totalPatients,
        activePatients,
        atRiskPatients: atRiskCount,
        avgRiskScore: 35 + Math.random() * 30,
        telehealthSessions: telehealthSessions.filter(s => s.status === "completed").length,
        promCompletionRate: promResponses.length > 0 ? 0.65 + Math.random() * 0.25 : 0,
      },
      riskDistribution,
      conditionPrevalence,
      topMedications,
      demographicBreakdown,
      recentTrends,
      atRiskPatients,
      cohorts: Array.from(this.patientCohorts.values()).filter(c => c.isActive),
    };
  }

  async getPatientCohorts(providerId?: string): Promise<PatientCohort[]> {
    const cohorts = Array.from(this.patientCohorts.values());
    if (providerId) {
      return cohorts.filter(c => c.createdBy === providerId);
    }
    return cohorts;
  }

  async getPatientCohort(id: string): Promise<PatientCohort | undefined> {
    return this.patientCohorts.get(id);
  }

  async createPatientCohort(cohort: InsertCohort): Promise<PatientCohort> {
    const now = new Date().toISOString();
    const patients = Array.from(this.patients.values());
    const problems = Array.from(this.problems.values());
    const medications = Array.from(this.medications.values());
    
    // Match patients based on criteria
    const matchedPatientIds: string[] = [];
    for (const patient of patients) {
      let matches = true;
      
      if (cohort.criteria.conditions?.length) {
        const patientProblems = problems.filter(p => p.patientId === patient.id);
        const hasCondition = cohort.criteria.conditions.some(c => 
          patientProblems.some(p => p.name.toLowerCase().includes(c.toLowerCase()))
        );
        if (!hasCondition) matches = false;
      }
      
      if (cohort.criteria.medications?.length) {
        const patientMeds = medications.filter(m => m.patientId === patient.id);
        const hasMed = cohort.criteria.medications.some(m => 
          patientMeds.some(pm => pm.name.toLowerCase().includes(m.toLowerCase()))
        );
        if (!hasMed) matches = false;
      }
      
      if (matches) {
        matchedPatientIds.push(patient.id);
      }
    }

    const newCohort: PatientCohort = {
      id: randomUUID(),
      name: cohort.name,
      description: cohort.description,
      type: cohort.type,
      criteria: cohort.criteria as CohortCriteria,
      patientIds: matchedPatientIds,
      patientCount: matchedPatientIds.length,
      createdBy: cohort.createdBy,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    };
    
    this.patientCohorts.set(newCohort.id, newCohort);
    return newCohort;
  }

  async updatePatientCohort(id: string, updates: Partial<PatientCohort>): Promise<PatientCohort | undefined> {
    const cohort = this.patientCohorts.get(id);
    if (!cohort) return undefined;
    
    const updatedCohort = { ...cohort, ...updates, updatedAt: new Date().toISOString() };
    this.patientCohorts.set(id, updatedCohort);
    return updatedCohort;
  }

  async deletePatientCohort(id: string): Promise<void> {
    this.patientCohorts.delete(id);
  }

  async getAtRiskPatients(riskLevel?: string, limit: number = 20): Promise<AtRiskPatient[]> {
    const patients = Array.from(this.patients.values());
    const problems = Array.from(this.problems.values());
    const riskAssessments = Array.from(this.healthRiskAssessments.values());
    const appointments = Array.from(this.appointments.values());
    
    const atRiskPatients: AtRiskPatient[] = [];
    
    for (const patient of patients.slice(0, limit)) {
      const patientProblems = problems.filter(p => p.patientId === patient.id && p.status === "active");
      const patientAssessments = riskAssessments.filter(r => r.patientId === patient.id);
      const patientAppointments = appointments.filter(a => a.patientId === patient.id);
      
      // Generate risk scores for different categories
      const riskCategories: RiskCategory[] = ["cardiovascular", "diabetes", "respiratory", "mental_health"];
      const riskScores = riskCategories.map(category => ({
        category,
        score: Math.floor(Math.random() * 100),
        level: Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "moderate" : "low",
      }));
      
      const overallRisk = riskScores.some(r => r.level === "high") ? "high" as const :
                          riskScores.some(r => r.level === "moderate") ? "moderate" as const : "low" as const;
      
      if (riskLevel && overallRisk !== riskLevel) continue;
      
      const lastAppointment = patientAppointments
        .filter(a => new Date(a.date) < new Date())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const nextAppointment = patientAppointments
        .filter(a => new Date(a.date) > new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      
      atRiskPatients.push({
        patientId: patient.id,
        patientName: patient.name,
        age: Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
        gender: patient.gender,
        primaryConditions: patientProblems.slice(0, 3).map(p => p.name),
        riskScores,
        overallRiskLevel: overallRisk,
        priorityRank: riskScores.reduce((sum, r) => sum + r.score, 0) / riskScores.length,
        lastVisit: lastAppointment?.date,
        nextScheduledVisit: nextAppointment?.date,
        openAlerts: Math.floor(Math.random() * 3),
        interventionRecommendations: [
          "Schedule follow-up appointment",
          "Review medication adherence",
          "Consider specialist referral",
        ].slice(0, Math.floor(Math.random() * 3) + 1),
      });
    }
    
    return atRiskPatients.sort((a, b) => b.priorityRank - a.priorityRank);
  }

  async getPopulationHealthMetrics(periodType: string = "monthly"): Promise<PopulationHealthMetrics | undefined> {
    const now = new Date();
    const patients = Array.from(this.patients.values());
    const problems = Array.from(this.problems.values());
    const medications = Array.from(this.medications.values());
    const telehealthSessions = Array.from(this.telehealthSessions.values());
    const promResponses = Array.from(this.promResponses.values());
    
    // Condition prevalence
    const conditionCounts = new Map<string, number>();
    problems.filter(p => p.status === "active").forEach(p => {
      const count = conditionCounts.get(p.name) || 0;
      conditionCounts.set(p.name, count + 1);
    });
    
    const conditionPrevalence = Array.from(conditionCounts.entries())
      .map(([condition, count]) => ({
        condition,
        count,
        percentage: patients.length > 0 ? (count / patients.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Medication utilization
    const medicationStats = new Map<string, { count: number; activeCount: number }>();
    medications.forEach(m => {
      const existing = medicationStats.get(m.name) || { count: 0, activeCount: 0 };
      existing.count++;
      if (m.status === "active") existing.activeCount++;
      medicationStats.set(m.name, existing);
    });
    
    const medicationUtilization = Array.from(medicationStats.entries())
      .map(([medication, stats]) => ({
        medication,
        count: stats.count,
        adherenceRate: 0.7 + Math.random() * 0.3,
      }));

    // Telehealth metrics
    const completedSessions = telehealthSessions.filter(s => s.status === "completed");
    const telehealthMetrics = {
      totalSessions: telehealthSessions.length,
      completionRate: telehealthSessions.length > 0 ? completedSessions.length / telehealthSessions.length : 0,
      averageDuration: completedSessions.length > 0 
        ? completedSessions.reduce((sum, s) => sum + (s.duration || 20), 0) / completedSessions.length 
        : 0,
    };

    return {
      id: randomUUID(),
      period: now.toISOString().slice(0, 7),
      periodType: periodType as "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
      totalPatients: patients.length,
      activePatients: patients.length,
      metrics: {
        conditionPrevalence,
        medicationUtilization,
        riskDistribution: [],
        promScores: [],
        telehealthMetrics,
        demographics: [],
      },
      trends: [
        { metric: "Total Patients", currentValue: patients.length, previousValue: patients.length - 2, changePercent: 5, direction: "up" },
        { metric: "Telehealth Sessions", currentValue: telehealthSessions.length, previousValue: telehealthSessions.length - 3, changePercent: 12, direction: "up" },
      ],
      calculatedAt: now.toISOString(),
    };
  }

  async getTreatmentEfficacyData(treatmentName?: string, cohortId?: string): Promise<TreatmentEfficacy[]> {
    const records = Array.from(this.treatmentEfficacyRecords.values());
    let filtered = records;
    
    if (treatmentName) {
      filtered = filtered.filter(r => r.treatmentName.toLowerCase().includes(treatmentName.toLowerCase()));
    }
    if (cohortId) {
      filtered = filtered.filter(r => r.cohortId === cohortId);
    }
    
    // Return sample data if no records exist
    if (filtered.length === 0) {
      const medications = Array.from(this.medications.values());
      const uniqueMeds = [...new Set(medications.map(m => m.name))].slice(0, 5);
      
      return uniqueMeds.map(medName => ({
        id: randomUUID(),
        treatmentType: "medication" as const,
        treatmentName: medName,
        targetCondition: "Various",
        sampleSize: Math.floor(Math.random() * 100) + 20,
        demographics: [
          {
            category: "age_group" as const,
            breakdown: [
              { value: "18-34", count: 25, efficacyRate: 0.78 },
              { value: "35-50", count: 35, efficacyRate: 0.82 },
              { value: "51-65", count: 30, efficacyRate: 0.75 },
              { value: "65+", count: 20, efficacyRate: 0.70 },
            ],
          },
        ],
        outcomes: [
          { metric: "Symptom Reduction", baseline: 7.5, current: 3.2, improvement: 57.3, confidenceInterval: { lower: 52.1, upper: 62.5 } },
          { metric: "Quality of Life Score", baseline: 55, current: 72, improvement: 30.9, confidenceInterval: { lower: 25.4, upper: 36.4 } },
        ],
        timeToEffect: Math.floor(Math.random() * 14) + 7,
        sideEffectRate: Math.random() * 0.15,
        adherenceRate: 0.7 + Math.random() * 0.25,
        calculatedAt: new Date().toISOString(),
        periodStart: new Date(Date.now() - 90 * 86400000).toISOString(),
        periodEnd: new Date().toISOString(),
      }));
    }
    
    return filtered;
  }

  async getAnalyticsReports(type?: string): Promise<AnalyticsReport[]> {
    const reports = Array.from(this.analyticsReports.values());
    if (type) {
      return reports.filter(r => r.type === type);
    }
    return reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getAnalyticsReport(id: string): Promise<AnalyticsReport | undefined> {
    return this.analyticsReports.get(id);
  }

  async createAnalyticsReport(report: InsertReport): Promise<AnalyticsReport> {
    const now = new Date().toISOString();
    
    const newReport: AnalyticsReport = {
      id: randomUUID(),
      name: report.name,
      type: report.type,
      description: report.description,
      parameters: report.parameters,
      sections: [
        {
          title: "Executive Summary",
          type: "summary",
          data: { overview: "Population health metrics for the selected period." },
          insights: ["Key trends identified", "Recommendations for improvement"],
        },
        {
          title: "Risk Distribution",
          type: "chart",
          data: { chartType: "pie", labels: ["Low", "Moderate", "High", "Critical"] },
          insights: ["Risk distribution analysis"],
        },
      ],
      summary: `Generated ${report.type} report for the specified date range.`,
      generatedBy: report.generatedBy,
      generatedAt: now,
      format: "json",
    };
    
    this.analyticsReports.set(newReport.id, newReport);
    return newReport;
  }

  async getConditionsList(): Promise<string[]> {
    const conditions = new Set<string>();
    
    for (const problem of this.problems.values()) {
      if (problem.name) {
        conditions.add(problem.name);
      }
    }
    
    if (conditions.size === 0) {
      return [
        "Type 2 Diabetes Mellitus",
        "Hypertension",
        "Hyperlipidemia",
        "Chronic Kidney Disease",
        "Coronary Artery Disease",
        "Atrial Fibrillation",
        "Heart Failure",
        "COPD",
        "Asthma",
        "Depression",
        "Anxiety",
        "Obesity",
        "Osteoarthritis",
        "Chronic Pain",
        "Sleep Apnea",
      ];
    }
    
    return Array.from(conditions).sort();
  }

  async getMedicationsList(): Promise<string[]> {
    const medications = new Set<string>();
    
    for (const med of this.medications.values()) {
      if (med.name) {
        medications.add(med.name);
      }
    }
    
    if (medications.size === 0) {
      return [
        "Metformin",
        "Lisinopril",
        "Amlodipine",
        "Atorvastatin",
        "Omeprazole",
        "Metoprolol",
        "Losartan",
        "Gabapentin",
        "Levothyroxine",
        "Sertraline",
        "Prednisone",
        "Albuterol",
        "Aspirin",
        "Warfarin",
        "Insulin Glargine",
      ];
    }
    
    return Array.from(medications).sort();
  }

  // ============================================
  // USPSTF RECOMMENDATIONS & CARE GAPS
  // ============================================

  private getUspstfSeedData(): UspstfRecommendation[] {
    return [
      {
        id: "uspstf-1",
        code: "USPSTF-CRC",
        title: "Colorectal Cancer Screening",
        description: "Screening for colorectal cancer using stool-based tests, colonoscopy, or CT colonography.",
        category: "cancer_screening",
        grade: "A",
        ageRangeStart: 45,
        ageRangeEnd: 75,
        gender: "all",
        frequency: "Every 10 years (colonoscopy) or annually (stool-based)",
        frequencyMonths: 120,
        riskFactors: ["Family history of colorectal cancer", "Inflammatory bowel disease", "Lynch syndrome"],
        cptCodes: ["45378", "45380", "82270", "G0121"],
        evidenceSummary: "The USPSTF recommends screening for colorectal cancer in all adults aged 45 to 75 years.",
        patientEducation: "Colorectal cancer screening can find cancer early when treatment works best, or find growths (polyps) that can be removed before they become cancer.",
        lastUpdated: "2024-05-21",
      },
      {
        id: "uspstf-2",
        code: "USPSTF-BC",
        title: "Breast Cancer Screening",
        description: "Screening mammography for breast cancer detection.",
        category: "cancer_screening",
        grade: "B",
        ageRangeStart: 40,
        ageRangeEnd: 74,
        gender: "female",
        frequency: "Every 2 years",
        frequencyMonths: 24,
        riskFactors: ["BRCA1/BRCA2 mutations", "Family history of breast cancer", "Dense breast tissue"],
        cptCodes: ["77067", "77066", "G0202"],
        evidenceSummary: "The USPSTF recommends biennial screening mammography for women aged 40 to 74 years.",
        patientEducation: "Regular mammograms can find breast cancer early, when treatment is most effective.",
        lastUpdated: "2024-04-30",
      },
      {
        id: "uspstf-3",
        code: "USPSTF-CERVICAL",
        title: "Cervical Cancer Screening",
        description: "Screening for cervical cancer with Pap smear and/or HPV testing.",
        category: "cancer_screening",
        grade: "A",
        ageRangeStart: 21,
        ageRangeEnd: 65,
        gender: "female",
        frequency: "Every 3 years (Pap) or every 5 years (HPV co-testing)",
        frequencyMonths: 36,
        cptCodes: ["88141", "88142", "87624", "G0123"],
        evidenceSummary: "The USPSTF recommends screening for cervical cancer every 3 years with cervical cytology alone.",
        patientEducation: "Regular cervical cancer screening can find abnormal cells before they become cancer.",
        lastUpdated: "2024-08-21",
      },
      {
        id: "uspstf-4",
        code: "USPSTF-LC",
        title: "Lung Cancer Screening",
        description: "Annual screening for lung cancer with low-dose computed tomography (LDCT).",
        category: "cancer_screening",
        grade: "B",
        ageRangeStart: 50,
        ageRangeEnd: 80,
        gender: "all",
        frequency: "Annually",
        frequencyMonths: 12,
        riskFactors: ["20+ pack-year smoking history", "Currently smokes or quit within past 15 years"],
        cptCodes: ["71271", "G0296"],
        evidenceSummary: "The USPSTF recommends annual screening for lung cancer with LDCT in adults aged 50 to 80 years who have a 20 pack-year smoking history.",
        patientEducation: "If you have a history of heavy smoking, annual low-dose CT scans can find lung cancer early.",
        lastUpdated: "2024-03-09",
      },
      {
        id: "uspstf-5",
        code: "USPSTF-DM",
        title: "Prediabetes and Type 2 Diabetes Screening",
        description: "Screening for prediabetes and type 2 diabetes in adults aged 35-70 who are overweight or obese.",
        category: "metabolic",
        grade: "B",
        ageRangeStart: 35,
        ageRangeEnd: 70,
        gender: "all",
        frequency: "Every 3 years",
        frequencyMonths: 36,
        riskFactors: ["Overweight (BMI >= 25)", "Obesity", "Family history of diabetes", "Gestational diabetes history"],
        cptCodes: ["82947", "82950", "83036"],
        evidenceSummary: "The USPSTF recommends screening for prediabetes and type 2 diabetes in adults aged 35 to 70 years who are overweight or obese.",
        patientEducation: "Early detection of diabetes or prediabetes allows for lifestyle changes and treatment to prevent complications.",
        lastUpdated: "2024-08-24",
      },
      {
        id: "uspstf-6",
        code: "USPSTF-HTN",
        title: "Hypertension Screening",
        description: "Screening for high blood pressure in adults 18 years or older.",
        category: "cardiovascular",
        grade: "A",
        ageRangeStart: 18,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "Annually",
        frequencyMonths: 12,
        cptCodes: ["99213", "99214"],
        evidenceSummary: "The USPSTF recommends screening for hypertension in adults 18 years or older with office blood pressure measurement.",
        patientEducation: "Regular blood pressure checks help find high blood pressure early so it can be treated to prevent heart disease and stroke.",
        lastUpdated: "2024-04-27",
      },
      {
        id: "uspstf-7",
        code: "USPSTF-LIPID",
        title: "Statin Use for Cardiovascular Disease Prevention",
        description: "Use of statins for the primary prevention of cardiovascular disease in adults aged 40 to 75 years with cardiovascular risk factors.",
        category: "cardiovascular",
        grade: "B",
        ageRangeStart: 40,
        ageRangeEnd: 75,
        gender: "all",
        frequency: "Assess every 5 years",
        frequencyMonths: 60,
        riskFactors: ["Dyslipidemia", "Diabetes", "Hypertension", "Smoking"],
        cptCodes: ["80061", "82465", "83718"],
        evidenceSummary: "The USPSTF recommends initiating statin use for adults aged 40-75 with 1+ CVD risk factors and 10% or greater 10-year CVD risk.",
        patientEducation: "A lipid panel blood test helps determine your risk for heart disease and whether cholesterol-lowering medication may help.",
        lastUpdated: "2024-08-22",
      },
      {
        id: "uspstf-8",
        code: "USPSTF-DEP",
        title: "Depression Screening",
        description: "Screening for depression in the general adult population, including pregnant and postpartum women.",
        category: "mental_health",
        grade: "B",
        ageRangeStart: 18,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "Annually or as clinically indicated",
        frequencyMonths: 12,
        cptCodes: ["96127", "G0444"],
        evidenceSummary: "The USPSTF recommends screening for depression in the general adult population with adequate systems in place for diagnosis and treatment.",
        patientEducation: "Depression screening helps identify mental health concerns early so appropriate support and treatment can be provided.",
        lastUpdated: "2024-01-26",
      },
      {
        id: "uspstf-9",
        code: "USPSTF-OSTEO",
        title: "Osteoporosis Screening",
        description: "Screening for osteoporosis with bone measurement testing to prevent osteoporotic fractures.",
        category: "musculoskeletal",
        grade: "B",
        ageRangeStart: 65,
        ageRangeEnd: 100,
        gender: "female",
        frequency: "Varies based on risk",
        frequencyMonths: 24,
        riskFactors: ["Low body weight", "Smoking", "Alcohol use", "Family history of hip fracture"],
        cptCodes: ["77080", "77081"],
        evidenceSummary: "The USPSTF recommends screening for osteoporosis with bone measurement testing in women 65 years and older.",
        patientEducation: "Bone density testing can find osteoporosis early so treatment can help prevent fractures.",
        lastUpdated: "2024-06-01",
      },
      {
        id: "uspstf-10",
        code: "USPSTF-AAA",
        title: "Abdominal Aortic Aneurysm Screening",
        description: "One-time screening for abdominal aortic aneurysm with ultrasonography in men aged 65-75 who have ever smoked.",
        category: "cardiovascular",
        grade: "B",
        ageRangeStart: 65,
        ageRangeEnd: 75,
        gender: "male",
        frequency: "One-time screening",
        frequencyMonths: 0,
        riskFactors: ["Ever smoked (at least 100 cigarettes lifetime)"],
        cptCodes: ["76706"],
        evidenceSummary: "The USPSTF recommends one-time screening for AAA with ultrasonography in men aged 65 to 75 years who have ever smoked.",
        patientEducation: "If you're a man who has ever smoked, a one-time ultrasound can detect an abdominal aortic aneurysm before it ruptures.",
        lastUpdated: "2024-12-10",
      },
      {
        id: "uspstf-11",
        code: "USPSTF-FLU",
        title: "Annual Influenza Vaccination",
        description: "Annual influenza vaccination for all persons aged 6 months and older.",
        category: "immunization",
        grade: "A",
        ageRangeStart: 0,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "Annually (before flu season)",
        frequencyMonths: 12,
        cptCodes: ["90686", "90688", "G0008"],
        evidenceSummary: "ACIP/CDC recommends annual flu vaccination for everyone 6 months and older.",
        patientEducation: "Getting a flu shot each year is the best way to protect yourself and others from influenza.",
        lastUpdated: "2024-09-01",
      },
      {
        id: "uspstf-12",
        code: "USPSTF-PNEUMO",
        title: "Pneumococcal Vaccination",
        description: "Pneumococcal vaccination for adults 65 years and older or those with certain medical conditions.",
        category: "immunization",
        grade: "A",
        ageRangeStart: 65,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "One-time or series based on vaccine type",
        frequencyMonths: 0,
        riskFactors: ["Chronic heart disease", "Chronic lung disease", "Diabetes", "Immunocompromised"],
        cptCodes: ["90670", "90671", "G0009"],
        evidenceSummary: "ACIP recommends pneumococcal vaccination for all adults 65 years or older.",
        patientEducation: "Pneumococcal vaccines protect against serious pneumonia and bloodstream infections.",
        lastUpdated: "2024-10-01",
      },
      {
        id: "uspstf-13",
        code: "USPSTF-SHINGLES",
        title: "Shingles (Zoster) Vaccination",
        description: "Recombinant zoster vaccine (Shingrix) for adults 50 years and older.",
        category: "immunization",
        grade: "A",
        ageRangeStart: 50,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "2-dose series",
        frequencyMonths: 0,
        cptCodes: ["90750"],
        evidenceSummary: "ACIP recommends 2 doses of recombinant zoster vaccine for adults 50 years and older.",
        patientEducation: "The shingles vaccine prevents painful shingles rash and its complications, including long-lasting nerve pain.",
        lastUpdated: "2024-01-15",
      },
      {
        id: "uspstf-14",
        code: "USPSTF-TDAP",
        title: "Tdap/Td Vaccination",
        description: "Tetanus, diphtheria, and pertussis vaccination for adults.",
        category: "immunization",
        grade: "A",
        ageRangeStart: 18,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "Td booster every 10 years; Tdap once in adulthood",
        frequencyMonths: 120,
        cptCodes: ["90715", "90714"],
        evidenceSummary: "ACIP recommends Tdap for all adults who have not previously received it, then Td booster every 10 years.",
        patientEducation: "Tdap protects against tetanus, diphtheria, and whooping cough. A booster is needed every 10 years.",
        lastUpdated: "2024-02-01",
      },
      {
        id: "uspstf-15",
        code: "USPSTF-HEP-B",
        title: "Hepatitis B Vaccination",
        description: "Universal hepatitis B vaccination for adults aged 19-59 years and risk-based vaccination for adults 60+.",
        category: "immunization",
        grade: "A",
        ageRangeStart: 19,
        ageRangeEnd: 59,
        gender: "all",
        frequency: "3-dose series (or 2-dose Heplisav-B)",
        frequencyMonths: 0,
        riskFactors: ["Healthcare workers", "Injection drug use", "Multiple sex partners", "Chronic liver disease"],
        cptCodes: ["90746", "90747", "90739"],
        evidenceSummary: "ACIP recommends hepatitis B vaccination for all adults aged 19-59 years who have not been vaccinated.",
        patientEducation: "Hepatitis B vaccination protects against a serious liver infection that can lead to liver failure and cancer.",
        lastUpdated: "2024-04-01",
      },
      {
        // Action Item G — care-gap recommendation needed by the App Store
        // reviewer-account seed (`scripts/seed-reviewer-account.ts`). The
        // seed script inserts a synthetic care gap with this id; without
        // a matching recommendation row, `createCareGap()` throws
        // "Recommendation not found" and seeding aborts at step 8 of 10.
        // Content is ADA-aligned chronic-care follow-up, not a USPSTF
        // primary-prevention screening, but lives in the same registry.
        id: "ANNUAL_A1C_FOR_DIABETES",
        code: "ADA-A1C-DM",
        title: "Annual A1C for Diagnosed Diabetes",
        description: "Hemoglobin A1C testing every 3-6 months for patients with diagnosed type 1 or type 2 diabetes; at minimum annually for patients meeting glycemic targets.",
        category: "metabolic",
        grade: "A",
        ageRangeStart: 18,
        ageRangeEnd: 100,
        gender: "all",
        frequency: "Every 3-6 months (or annually if at target)",
        frequencyMonths: 6,
        riskFactors: ["Type 1 diabetes", "Type 2 diabetes", "A1C above target", "Recent medication change"],
        cptCodes: ["83036", "83037"],
        evidenceSummary: "ADA Standards of Care recommend A1C testing at least twice yearly in patients meeting treatment goals and quarterly in patients whose therapy has changed or who are not meeting glycemic goals.",
        patientEducation: "Your A1C test shows your average blood sugar over the past 3 months. Regular A1C checks help your care team adjust your treatment to keep blood sugar in your target range and prevent complications.",
        lastUpdated: "2024-12-01",
      },
    ];
  }

  async getUspstfRecommendations(age?: number, gender?: string, category?: RecommendationCategory): Promise<UspstfRecommendation[]> {
    // If no seed data, populate it
    if (this.uspstfRecommendations.size === 0) {
      const seedRecs = this.getUspstfSeedData();
      seedRecs.forEach(rec => this.uspstfRecommendations.set(rec.id, rec));
    }

    let recommendations = Array.from(this.uspstfRecommendations.values());

    if (age !== undefined) {
      recommendations = recommendations.filter(r => age >= r.ageRangeStart && age <= r.ageRangeEnd);
    }

    if (gender) {
      recommendations = recommendations.filter(r => r.gender === "all" || r.gender === gender);
    }

    if (category) {
      recommendations = recommendations.filter(r => r.category === category);
    }

    return recommendations.sort((a, b) => {
      const gradeOrder = { A: 0, B: 1, C: 2, D: 3, I: 4 };
      return gradeOrder[a.grade] - gradeOrder[b.grade];
    });
  }

  async getUspstfRecommendation(id: string): Promise<UspstfRecommendation | undefined> {
    if (this.uspstfRecommendations.size === 0) {
      const seedRecs = this.getUspstfSeedData();
      seedRecs.forEach(rec => this.uspstfRecommendations.set(rec.id, rec));
    }
    return this.uspstfRecommendations.get(id);
  }

  async getPatientCareGaps(patientId: string, status?: CareGapStatus): Promise<CareGap[]> {
    let gaps = Array.from(this.careGaps.values()).filter(g => g.patientId === patientId);
    if (status) {
      gaps = gaps.filter(g => g.status === status);
    }
    return gaps.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  async getCareGap(id: string): Promise<CareGap | undefined> {
    return this.careGaps.get(id);
  }

  async createCareGap(careGap: InsertCareGap): Promise<CareGap> {
    const recommendation = await this.getUspstfRecommendation(careGap.recommendationId);
    if (!recommendation) {
      throw new Error("Recommendation not found");
    }

    const newGap: CareGap = {
      id: randomUUID(),
      patientId: careGap.patientId,
      recommendationId: careGap.recommendationId,
      recommendation,
      status: careGap.status || "open",
      priority: careGap.priority || "medium",
      dueDate: careGap.dueDate,
      lastCompletedDate: careGap.lastCompletedDate,
      identifiedAt: new Date().toISOString(),
      notes: careGap.notes,
      aiReasoning: careGap.aiReasoning,
    };

    this.careGaps.set(newGap.id, newGap);
    return newGap;
  }

  async updateCareGap(id: string, updates: Partial<CareGap>): Promise<CareGap | undefined> {
    const existing = this.careGaps.get(id);
    if (!existing) return undefined;

    const updated: CareGap = { ...existing, ...updates };
    if (updates.status === "addressed" && !existing.addressedAt) {
      updated.addressedAt = new Date().toISOString();
    }
    this.careGaps.set(id, updated);
    return updated;
  }

  async getPatientVaccinations(patientId: string): Promise<VaccinationRecord[]> {
    return Array.from(this.vaccinations.values())
      .filter(v => v.patientId === patientId)
      .sort((a, b) => new Date(b.administrationDate).getTime() - new Date(a.administrationDate).getTime());
  }

  async createVaccination(vaccination: InsertVaccination): Promise<VaccinationRecord> {
    const newVaccination: VaccinationRecord = {
      id: randomUUID(),
      ...vaccination,
      status: vaccination.status || "completed",
    };
    this.vaccinations.set(newVaccination.id, newVaccination);
    return newVaccination;
  }

  async getPatientClaimsSummary(patientId: string): Promise<ClaimsSummary[]> {
    return Array.from(this.claimsSummaries.values())
      .filter(c => c.patientId === patientId)
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }

  async getPatientPreventiveSummary(patientId: string): Promise<PatientPreventiveSummary | undefined> {
    const patient = this.patients.get(patientId);
    if (!patient) return undefined;

    const dob = new Date(patient.dateOfBirth);
    const today = new Date();
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    const recommendations = await this.getUspstfRecommendations(age, patient.gender);
    const careGaps = await this.getPatientCareGaps(patientId);
    const vaccinations = await this.getPatientVaccinations(patientId);

    const medicalRecords = Array.from(this.medicalRecords.values()).filter(r => r.patientId === patientId);
    const lastScreenings = medicalRecords
      .filter(r => r.type === "procedure" || r.type === "lab_result")
      .slice(0, 10)
      .map(r => ({
        screeningType: r.title,
        date: r.date,
        result: r.status,
        provider: r.provider,
      }));

    const openGaps = careGaps.filter(g => g.status === "open");
    const addressedGaps = careGaps.filter(g => g.status === "addressed");
    const complianceScore = recommendations.length > 0 
      ? Math.round((addressedGaps.length / recommendations.length) * 100)
      : 100;

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      age,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      recommendations,
      careGaps,
      vaccinationHistory: vaccinations,
      lastScreenings,
      riskFactors: [],
      overallComplianceScore: complianceScore,
      nextActions: openGaps.slice(0, 5).map(gap => ({
        action: gap.recommendation.title,
        priority: gap.priority,
        dueDate: gap.dueDate,
        reasoning: gap.aiReasoning,
      })),
    };
  }

  // Patient Onboarding
  async getOnboardingSession(id: string): Promise<PatientOnboardingSession | undefined> {
    return this.onboardingSessions.get(id);
  }

  async getOnboardingSessionByUser(userId: string): Promise<PatientOnboardingSession | undefined> {
    return Array.from(this.onboardingSessions.values()).find(s => s.userId === userId && !s.isComplete);
  }

  async createOnboardingSession(session: InsertPatientOnboardingSession): Promise<PatientOnboardingSession> {
    const now = new Date().toISOString();
    const newSession: PatientOnboardingSession = {
      id: randomUUID(),
      userId: session.userId,
      patientId: session.patientId,
      currentStep: session.currentStep || "welcome",
      completedSteps: session.completedSteps || [],
      formData: session.formData || {},
      aiExtractedData: session.aiExtractedData,
      personalizedWelcome: session.personalizedWelcome,
      healthAssessment: session.healthAssessment,
      createdAt: now,
      updatedAt: now,
      isComplete: session.isComplete || false,
    };
    this.onboardingSessions.set(newSession.id, newSession);
    return newSession;
  }

  async updateOnboardingSession(id: string, updates: Partial<PatientOnboardingSession>): Promise<PatientOnboardingSession | undefined> {
    const session = this.onboardingSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
    this.onboardingSessions.set(id, updated);
    return updated;
  }

  async completeOnboardingSession(id: string): Promise<PatientOnboardingSession | undefined> {
    const session = this.onboardingSessions.get(id);
    if (!session) return undefined;
    const completed = { ...session, isComplete: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.onboardingSessions.set(id, completed);
    return completed;
  }

  // RPM Device Registration
  async getRpmDevices(sessionId: string): Promise<RpmDeviceRegistration[]> {
    return Array.from(this.rpmDevices.values()).filter(d => d.onboardingSessionId === sessionId);
  }

  async getRpmDevicesByPatient(patientId: string): Promise<RpmDeviceRegistration[]> {
    return Array.from(this.rpmDevices.values()).filter(d => d.patientId === patientId);
  }

  async getRpmDevice(id: string): Promise<RpmDeviceRegistration | undefined> {
    return this.rpmDevices.get(id);
  }

  async createRpmDevice(device: InsertRpmDeviceRegistration): Promise<RpmDeviceRegistration> {
    const now = new Date().toISOString();
    const newDevice: RpmDeviceRegistration = {
      id: randomUUID(),
      ...device,
      connectionStatus: device.connectionStatus || "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.rpmDevices.set(newDevice.id, newDevice);
    return newDevice;
  }

  async updateRpmDevice(id: string, updates: Partial<RpmDeviceRegistration>): Promise<RpmDeviceRegistration | undefined> {
    const device = this.rpmDevices.get(id);
    if (!device) return undefined;
    const updated = { ...device, ...updates, updatedAt: new Date().toISOString() };
    this.rpmDevices.set(id, updated);
    return updated;
  }

  async deleteRpmDevice(id: string): Promise<void> {
    this.rpmDevices.delete(id);
  }

  // Uploaded Documents
  async getUploadedDocuments(patientId: string): Promise<UploadedDocument[]> {
    return Array.from(this.uploadedDocuments.values())
      .filter(d => d.patientId === patientId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getUploadedDocument(id: string): Promise<UploadedDocument | undefined> {
    return this.uploadedDocuments.get(id);
  }

  async createUploadedDocument(doc: InsertUploadedDocument): Promise<UploadedDocument> {
    const newDoc: UploadedDocument = {
      id: randomUUID(),
      ...doc,
      title: doc.title,
      tags: doc.tags || [],
      documentDate: doc.documentDate,
      uploadedAt: new Date().toISOString(),
      isVerified: doc.isVerified || false,
      scanStatus: doc.scanStatus || "pending",
      scanMessage: doc.scanMessage,
    };
    this.uploadedDocuments.set(newDoc.id, newDoc);
    return newDoc;
  }

  async updateUploadedDocument(id: string, updates: Partial<UploadedDocument>): Promise<UploadedDocument | undefined> {
    const doc = this.uploadedDocuments.get(id);
    if (!doc) return undefined;
    const updated = { ...doc, ...updates };
    this.uploadedDocuments.set(id, updated);
    return updated;
  }

  async deleteUploadedDocument(id: string, patientId: string): Promise<void> {
    const doc = this.uploadedDocuments.get(id);
    if (!doc || doc.patientId !== patientId) return;
    this.uploadedDocuments.delete(id);
  }

  // Health Assessments
  async getHealthAssessment(id: string): Promise<InitialHealthAssessment | undefined> {
    return this.healthAssessments.get(id);
  }

  async getHealthAssessmentBySession(sessionId: string): Promise<InitialHealthAssessment | undefined> {
    return Array.from(this.healthAssessments.values()).find(a => a.onboardingSessionId === sessionId);
  }

  async createHealthAssessment(assessment: InsertHealthAssessment): Promise<InitialHealthAssessment> {
    const newAssessment: InitialHealthAssessment = {
      id: randomUUID(),
      onboardingSessionId: assessment.onboardingSessionId,
      patientId: assessment.patientId,
      questions: assessment.questions || [],
      responses: assessment.responses || [],
      aiAnalysis: assessment.aiAnalysis,
      createdAt: new Date().toISOString(),
    };
    this.healthAssessments.set(newAssessment.id, newAssessment);
    return newAssessment;
  }

  async updateHealthAssessment(id: string, updates: Partial<InitialHealthAssessment>): Promise<InitialHealthAssessment | undefined> {
    const assessment = this.healthAssessments.get(id);
    if (!assessment) return undefined;
    const updated = { ...assessment, ...updates };
    this.healthAssessments.set(id, updated);
    return updated;
  }

  // Personal Health Metrics Implementation
  async getPersonalHealthMetrics(patientId: string, metricType?: string, startDate?: string, endDate?: string): Promise<PersonalHealthMetric[]> {
    let metrics = Array.from(this.personalHealthMetrics.values()).filter(m => m.patientId === patientId);
    if (metricType) metrics = metrics.filter(m => m.metricType === metricType);
    if (startDate) metrics = metrics.filter(m => m.recordedAt >= startDate);
    if (endDate) metrics = metrics.filter(m => m.recordedAt <= endDate);
    return metrics.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getPersonalHealthMetric(id: string): Promise<PersonalHealthMetric | undefined> {
    return this.personalHealthMetrics.get(id);
  }

  async createPersonalHealthMetric(metric: InsertPersonalHealthMetric): Promise<PersonalHealthMetric> {
    const now = new Date().toISOString();
    const newMetric: PersonalHealthMetric = {
      id: randomUUID(),
      patientId: metric.patientId,
      metricType: metric.metricType,
      customName: metric.customName,
      value: metric.value,
      unit: metric.unit,
      notes: metric.notes,
      source: metric.source || "manual",
      deviceId: metric.deviceId,
      recordedAt: metric.recordedAt || now,
      createdAt: now,
    };
    this.personalHealthMetrics.set(newMetric.id, newMetric);
    return newMetric;
  }

  async deletePersonalHealthMetric(id: string, patientId: string): Promise<void> {
    const metric = this.personalHealthMetrics.get(id);
    if (!metric || metric.patientId !== patientId) return;
    this.personalHealthMetrics.delete(id);
  }

  async getMetricGoals(patientId: string): Promise<MetricGoal[]> {
    return Array.from(this.metricGoals.values()).filter(g => g.patientId === patientId);
  }

  async getMetricGoal(id: string): Promise<MetricGoal | undefined> {
    return this.metricGoals.get(id);
  }

  async createMetricGoal(goal: InsertMetricGoal): Promise<MetricGoal> {
    const now = new Date().toISOString();
    const newGoal: MetricGoal = {
      id: randomUUID(),
      patientId: goal.patientId,
      metricType: goal.metricType,
      targetValue: goal.targetValue,
      comparison: goal.comparison,
      targetValueMax: goal.targetValueMax,
      unit: goal.unit,
      frequency: goal.frequency || "daily",
      isActive: goal.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.metricGoals.set(newGoal.id, newGoal);
    return newGoal;
  }

  async updateMetricGoal(id: string, patientId: string, updates: Partial<MetricGoal>): Promise<MetricGoal | undefined> {
    const goal = this.metricGoals.get(id);
    if (!goal || goal.patientId !== patientId) return undefined;
    const updated = { ...goal, ...updates, updatedAt: new Date().toISOString() };
    this.metricGoals.set(id, updated);
    return updated;
  }

  async deleteMetricGoal(id: string, patientId: string): Promise<void> {
    const goal = this.metricGoals.get(id);
    if (!goal || goal.patientId !== patientId) return;
    this.metricGoals.delete(id);
  }

  // Shared Health Data Implementation
  async getSharedHealthData(patientId: string): Promise<SharedHealthData[]> {
    return Array.from(this.sharedHealthData.values()).filter(s => s.patientId === patientId);
  }

  async getSharedHealthDataByRecipient(recipientId: string): Promise<SharedHealthData[]> {
    return Array.from(this.sharedHealthData.values()).filter(s => s.recipientId === recipientId && s.isActive);
  }

  async createSharedHealthData(share: InsertSharedHealthData): Promise<SharedHealthData> {
    const now = new Date().toISOString();
    const newShare: SharedHealthData = {
      id: randomUUID(),
      patientId: share.patientId,
      recipientType: share.recipientType,
      recipientId: share.recipientId,
      recipientName: share.recipientName,
      dataCategories: share.dataCategories,
      accessLevel: share.accessLevel || "view",
      validFrom: share.validFrom || now,
      validUntil: share.validUntil,
      isActive: share.isActive ?? true,
      createdAt: now,
    };
    this.sharedHealthData.set(newShare.id, newShare);
    return newShare;
  }

  async updateSharedHealthData(id: string, updates: Partial<SharedHealthData>): Promise<SharedHealthData | undefined> {
    const share = this.sharedHealthData.get(id);
    if (!share) return undefined;
    const updated = { ...share, ...updates };
    this.sharedHealthData.set(id, updated);
    return updated;
  }

  async revokeSharedHealthData(id: string, patientId: string): Promise<SharedHealthData | undefined> {
    const share = this.sharedHealthData.get(id);
    if (!share || share.patientId !== patientId) return undefined;
    const revoked = { ...share, isActive: false, revokedAt: new Date().toISOString() };
    this.sharedHealthData.set(id, revoked);
    return revoked;
  }

  // Patient Health Goals Implementation
  async getPatientHealthGoals(patientId: string): Promise<PatientHealthGoal[]> {
    return Array.from(this.patientHealthGoals.values()).filter(g => g.patientId === patientId);
  }

  async getPatientHealthGoal(id: string, patientId: string): Promise<PatientHealthGoal | undefined> {
    const goal = this.patientHealthGoals.get(id);
    if (!goal || goal.patientId !== patientId) return undefined;
    return goal;
  }

  async createPatientHealthGoal(patientId: string, goal: InsertPatientHealthGoal): Promise<PatientHealthGoal> {
    const now = new Date().toISOString();
    const newGoal: PatientHealthGoal = {
      id: randomUUID(),
      patientId,
      goalType: goal.goalType,
      title: goal.title,
      description: goal.description,
      targetValue: goal.targetValue,
      targetValueMax: goal.targetValueMax,
      currentValue: goal.currentValue,
      unit: goal.unit,
      comparison: goal.comparison,
      startDate: goal.startDate || now,
      targetDate: goal.targetDate,
      frequency: goal.frequency,
      status: "active",
      linkedResources: goal.linkedResources || [],
      milestones: [],
      reminderEnabled: goal.reminderEnabled,
      reminderFrequency: goal.reminderFrequency,
      sharedWith: [],
      createdAt: now,
      updatedAt: now,
    };
    this.patientHealthGoals.set(newGoal.id, newGoal);
    return newGoal;
  }

  async updatePatientHealthGoal(id: string, patientId: string, updates: Partial<PatientHealthGoal>): Promise<PatientHealthGoal | undefined> {
    const goal = this.patientHealthGoals.get(id);
    if (!goal || goal.patientId !== patientId) return undefined;
    const updated = { ...goal, ...updates, updatedAt: new Date().toISOString() };
    this.patientHealthGoals.set(id, updated);
    return updated;
  }

  async deletePatientHealthGoal(id: string, patientId: string): Promise<void> {
    const goal = this.patientHealthGoals.get(id);
    if (!goal || goal.patientId !== patientId) return;
    this.patientHealthGoals.delete(id);
  }

  async getGoalProgress(goalId: string, patientId: string): Promise<PatientGoalProgress[]> {
    const goal = this.patientHealthGoals.get(goalId);
    if (!goal || goal.patientId !== patientId) return [];
    return Array.from(this.patientGoalProgress.values())
      .filter(p => p.goalId === goalId)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }

  async createGoalProgress(patientId: string, progress: InsertPatientGoalProgress): Promise<PatientGoalProgress | null> {
    const goal = this.patientHealthGoals.get(progress.goalId);
    if (!goal || goal.patientId !== patientId) return null;
    const now = new Date().toISOString();
    const newProgress: PatientGoalProgress = {
      id: randomUUID(),
      goalId: progress.goalId,
      patientId,
      value: progress.value,
      notes: progress.notes,
      recordedAt: progress.recordedAt || now,
      source: progress.source,
    };
    this.patientGoalProgress.set(newProgress.id, newProgress);
    
    // Update goal's currentValue — ownership already verified above
    goal.currentValue = progress.value;
    goal.updatedAt = now;
    this.patientHealthGoals.set(goal.id, goal);
    
    return newProgress;
  }

  async sharePatientGoal(goalId: string, patientId: string, share: InsertPatientGoalShare): Promise<PatientGoalShare> {
    const goal = this.patientHealthGoals.get(goalId);
    if (!goal || goal.patientId !== patientId) throw new Error("Goal not found");
    
    const newShare: PatientGoalShare = {
      id: randomUUID(),
      goalId,
      recipientType: share.recipientType,
      recipientId: share.recipientId,
      recipientName: share.recipientName,
      canComment: share.canComment,
      sharedAt: new Date().toISOString(),
    };
    
    goal.sharedWith = [...goal.sharedWith, newShare];
    this.patientHealthGoals.set(goalId, goal);
    
    return newShare;
  }

  async unsharePatientGoal(shareId: string, patientId: string): Promise<void> {
    const goals = Array.from(this.patientHealthGoals.values()).filter(g => g.patientId === patientId);
    for (const goal of goals) {
      if (goal.patientId !== patientId) continue;
      const shareIndex = goal.sharedWith.findIndex((s: PatientGoalShare) => s.id === shareId);
      if (shareIndex !== -1) {
        goal.sharedWith = goal.sharedWith.filter((s: PatientGoalShare) => s.id !== shareId);
        this.patientHealthGoals.set(goal.id, goal);
        return;
      }
    }
  }

  // Analytics Dashboard Implementation
  async getEngagementMetrics(filters?: { userId?: string; startDate?: string; endDate?: string; metricType?: string }): Promise<EngagementMetric[]> {
    let metrics = Array.from(this.engagementMetrics.values());
    if (filters?.userId) metrics = metrics.filter(m => m.userId === filters.userId);
    if (filters?.metricType) metrics = metrics.filter(m => m.metricType === filters.metricType);
    if (filters?.startDate) metrics = metrics.filter(m => m.timestamp >= filters.startDate!);
    if (filters?.endDate) metrics = metrics.filter(m => m.timestamp <= filters.endDate!);
    return metrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createEngagementMetric(metric: InsertEngagementMetric): Promise<EngagementMetric> {
    const now = new Date().toISOString();
    const newMetric: EngagementMetric = {
      id: randomUUID(),
      userId: metric.userId,
      metricType: metric.metricType,
      featureName: metric.featureName,
      value: metric.value ?? 1,
      metadata: metric.metadata,
      timestamp: metric.timestamp || now,
      createdAt: now,
    };
    this.engagementMetrics.set(newMetric.id, newMetric);
    return newMetric;
  }

  async getSatisfactionScores(filters?: { userId?: string; scoreType?: string; startDate?: string; endDate?: string }): Promise<SatisfactionScore[]> {
    let scores = Array.from(this.satisfactionScores.values());
    if (filters?.userId) scores = scores.filter(s => s.userId === filters.userId);
    if (filters?.scoreType) scores = scores.filter(s => s.scoreType === filters.scoreType);
    if (filters?.startDate) scores = scores.filter(s => s.timestamp >= filters.startDate!);
    if (filters?.endDate) scores = scores.filter(s => s.timestamp <= filters.endDate!);
    return scores.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createSatisfactionScore(score: InsertSatisfactionScore): Promise<SatisfactionScore> {
    const now = new Date().toISOString();
    const newScore: SatisfactionScore = {
      id: randomUUID(),
      userId: score.userId,
      scoreType: score.scoreType,
      score: score.score,
      maxScore: score.maxScore,
      feedback: score.feedback,
      surveyId: score.surveyId,
      responses: score.responses,
      timestamp: now,
      createdAt: now,
    };
    this.satisfactionScores.set(newScore.id, newScore);
    return newScore;
  }

  async getSafetyIncidents(filters?: { status?: string; severity?: string; startDate?: string; endDate?: string }): Promise<SafetyIncident[]> {
    let incidents = Array.from(this.safetyIncidents.values());
    if (filters?.status) incidents = incidents.filter(i => i.status === filters.status);
    if (filters?.severity) incidents = incidents.filter(i => i.severity === filters.severity);
    if (filters?.startDate) incidents = incidents.filter(i => i.reportedAt >= filters.startDate!);
    if (filters?.endDate) incidents = incidents.filter(i => i.reportedAt <= filters.endDate!);
    return incidents.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }

  async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> {
    return this.safetyIncidents.get(id);
  }

  async createSafetyIncident(incident: InsertSafetyIncident): Promise<SafetyIncident> {
    const now = new Date().toISOString();
    const newIncident: SafetyIncident = {
      id: randomUUID(),
      reporterId: incident.reporterId,
      patientId: incident.patientId,
      incidentType: incident.incidentType,
      severity: incident.severity,
      status: "reported",
      title: incident.title,
      description: incident.description,
      affectedFeatures: incident.affectedFeatures,
      metadata: incident.metadata,
      reportedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.safetyIncidents.set(newIncident.id, newIncident);
    return newIncident;
  }

  async updateSafetyIncident(id: string, updates: Partial<SafetyIncident>): Promise<SafetyIncident | undefined> {
    const incident = this.safetyIncidents.get(id);
    if (!incident) return undefined;
    const updated = { ...incident, ...updates, updatedAt: new Date().toISOString() };
    this.safetyIncidents.set(id, updated);
    return updated;
  }

  async getFeatureUsageAnalytics(periodStart?: string, periodEnd?: string): Promise<FeatureUsage[]> {
    // Generate mock feature usage data
    const now = new Date();
    const features = [
      { name: "Health Timeline", usage: 1250, users: 320, success: 0.94, trend: "up" as const, trendPct: 12 },
      { name: "Medication Tracker", usage: 980, users: 285, success: 0.91, trend: "up" as const, trendPct: 8 },
      { name: "Lab Results", usage: 756, users: 198, success: 0.97, trend: "stable" as const, trendPct: 2 },
      { name: "Secure Messages", usage: 542, users: 156, success: 0.89, trend: "up" as const, trendPct: 15 },
      { name: "Appointments", usage: 423, users: 134, success: 0.92, trend: "stable" as const, trendPct: 1 },
      { name: "Document Upload", usage: 312, users: 89, success: 0.85, trend: "down" as const, trendPct: -5 },
      { name: "AI Assistant", usage: 245, users: 67, success: 0.88, trend: "up" as const, trendPct: 25 },
      { name: "Care Gaps", usage: 156, users: 45, success: 0.78, trend: "down" as const, trendPct: -10 },
    ];
    
    return features.map(f => ({
      id: randomUUID(),
      featureName: f.name,
      totalUsage: f.usage,
      uniqueUsers: f.users,
      successRate: f.success,
      avgCompletionTime: Math.floor(Math.random() * 30) + 5,
      abandonmentRate: 1 - f.success,
      lastUsed: now.toISOString(),
      trendDirection: f.trend,
      trendPercentage: f.trendPct,
      periodStart: periodStart || new Date(now.getTime() - 30 * 86400000).toISOString(),
      periodEnd: periodEnd || now.toISOString(),
      createdAt: now.toISOString(),
    }));
  }

  async getTaskSuccessMetrics(periodStart?: string, periodEnd?: string): Promise<TaskSuccessMetric[]> {
    const now = new Date();
    const tasks = [
      { name: "Complete Onboarding", category: "Onboarding", attempts: 450, success: 412, failures: 18, abandons: 20 },
      { name: "Connect EHR", category: "Integration", attempts: 380, success: 342, failures: 25, abandons: 13 },
      { name: "View Health Record", category: "Records", attempts: 1250, success: 1188, failures: 12, abandons: 50 },
      { name: "Send Secure Message", category: "Communication", attempts: 542, success: 485, failures: 15, abandons: 42 },
      { name: "Request Prescription Refill", category: "Medications", attempts: 234, success: 201, failures: 8, abandons: 25 },
      { name: "Upload Document", category: "Documents", attempts: 312, success: 265, failures: 22, abandons: 25 },
      { name: "Schedule Appointment", category: "Appointments", attempts: 189, success: 165, failures: 10, abandons: 14 },
      { name: "Complete Health Survey", category: "Assessments", attempts: 156, success: 122, failures: 5, abandons: 29 },
    ];
    
    return tasks.map(t => ({
      id: randomUUID(),
      taskName: t.name,
      taskCategory: t.category,
      totalAttempts: t.attempts,
      successfulCompletions: t.success,
      failures: t.failures,
      abandonments: t.abandons,
      successRate: t.success / t.attempts,
      avgTimeToComplete: Math.floor(Math.random() * 120) + 30,
      errorTypes: { "validation_error": Math.floor(t.failures * 0.4), "timeout": Math.floor(t.failures * 0.3), "server_error": Math.floor(t.failures * 0.3) },
      periodStart: periodStart || new Date(now.getTime() - 30 * 86400000).toISOString(),
      periodEnd: periodEnd || now.toISOString(),
      createdAt: now.toISOString(),
    }));
  }

  async getChurnPredictions(riskLevel?: string): Promise<ChurnPrediction[]> {
    const now = new Date();
    const predictions: ChurnPrediction[] = [
      { id: randomUUID(), userId: "user-001", churnRisk: "critical", churnProbability: 0.89, riskFactors: ["No login in 45 days", "Incomplete onboarding", "No EHR connected"], lastActiveDate: new Date(now.getTime() - 45 * 86400000).toISOString(), daysSinceLastLogin: 45, engagementScore: 12, recommendedActions: ["Send re-engagement email", "Offer onboarding assistance"], predictedAt: now.toISOString(), createdAt: now.toISOString() },
      { id: randomUUID(), userId: "user-002", churnRisk: "high", churnProbability: 0.72, riskFactors: ["Decreased login frequency", "Only uses 1 feature", "Negative feedback"], lastActiveDate: new Date(now.getTime() - 21 * 86400000).toISOString(), daysSinceLastLogin: 21, engagementScore: 28, recommendedActions: ["Feature discovery campaign", "Personal outreach"], predictedAt: now.toISOString(), createdAt: now.toISOString() },
      { id: randomUUID(), userId: "user-003", churnRisk: "high", churnProbability: 0.68, riskFactors: ["Login frequency declining", "No recent messages"], lastActiveDate: new Date(now.getTime() - 18 * 86400000).toISOString(), daysSinceLastLogin: 18, engagementScore: 32, recommendedActions: ["Check-in call", "Highlight new features"], predictedAt: now.toISOString(), createdAt: now.toISOString() },
      { id: randomUUID(), userId: "user-004", churnRisk: "medium", churnProbability: 0.45, riskFactors: ["Sporadic usage pattern", "Low feature adoption"], lastActiveDate: new Date(now.getTime() - 10 * 86400000).toISOString(), daysSinceLastLogin: 10, engagementScore: 48, recommendedActions: ["Feature tutorial", "Engagement reminder"], predictedAt: now.toISOString(), createdAt: now.toISOString() },
      { id: randomUUID(), userId: "user-005", churnRisk: "medium", churnProbability: 0.38, riskFactors: ["Only mobile usage", "Never used messaging"], lastActiveDate: new Date(now.getTime() - 7 * 86400000).toISOString(), daysSinceLastLogin: 7, engagementScore: 55, recommendedActions: ["Cross-platform promotion"], predictedAt: now.toISOString(), createdAt: now.toISOString() },
      { id: randomUUID(), userId: "user-006", churnRisk: "low", churnProbability: 0.15, riskFactors: ["Slight decrease in sessions"], lastActiveDate: new Date(now.getTime() - 3 * 86400000).toISOString(), daysSinceLastLogin: 3, engagementScore: 78, recommendedActions: ["Continue monitoring"], predictedAt: now.toISOString(), createdAt: now.toISOString() },
    ];
    
    if (riskLevel) {
      return predictions.filter(p => p.churnRisk === riskLevel);
    }
    return predictions;
  }

  async getAdminAnalyticsSummary(): Promise<AnalyticsDashboardSummary> {
    const now = new Date();
    const churnPredictions = await this.getChurnPredictions();
    const featureUsage = await this.getFeatureUsageAnalytics();
    const incidents = await this.getSafetyIncidents();
    
    // Generate engagement trend (last 30 days)
    const engagementTrend = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(now.getTime() - (29 - i) * 86400000).toISOString().split("T")[0],
      value: Math.floor(Math.random() * 150) + 250,
    }));
    
    // Generate satisfaction trend (last 12 months)
    const satisfactionTrend = Array.from({ length: 12 }, (_, i) => ({
      date: new Date(now.getFullYear(), now.getMonth() - 11 + i, 1).toISOString().split("T")[0],
      nps: Math.floor(Math.random() * 20) + 45,
      sus: Math.floor(Math.random() * 10) + 72,
    }));
    
    const lowAdoptionFeatures = featureUsage
      .filter(f => f.uniqueUsers < 100 || f.trendDirection === "down")
      .map(f => f.featureName);
    
    const topFeatures = featureUsage
      .sort((a, b) => b.totalUsage - a.totalUsage)
      .slice(0, 5)
      .map(f => ({ name: f.featureName, usage: f.totalUsage }));
    
    return {
      totalUsers: 1247,
      activeUsers: 892,
      newUsersThisMonth: 156,
      avgSessionDuration: 8.5,
      taskSuccessRate: 0.89,
      avgNpsScore: 52,
      avgSusScore: 76.5,
      openIncidents: incidents.filter(i => i.status !== "closed" && i.status !== "resolved").length,
      criticalIncidents: incidents.filter(i => i.severity === "critical" && i.status !== "resolved").length,
      highRiskChurnUsers: churnPredictions.filter(p => p.churnRisk === "high" || p.churnRisk === "critical").length,
      lowAdoptionFeatures,
      topFeatures,
      engagementTrend,
      satisfactionTrend,
    };
  }

  // ============================================
  // DATA EXPORT CONTROL IMPLEMENTATION
  // ============================================

  async getExportPolicies(): Promise<ExportPolicy[]> {
    return Array.from(this.exportPolicies.values());
  }

  async getExportPolicy(id: string): Promise<ExportPolicy | undefined> {
    return this.exportPolicies.get(id);
  }

  async getExportPolicyForRole(role: UserRole): Promise<ExportPolicy | undefined> {
    const policies = Array.from(this.exportPolicies.values());
    const rolePolicy = policies.find(p => p.allowedRoles.includes(role) && p.isActive);
    
    if (rolePolicy) return rolePolicy;
    
    const defaults = defaultExportPolicies[role];
    if (!defaults) return undefined;
    
    return {
      id: `default-${role}`,
      name: `Default ${role} Policy`,
      description: `Default export policy for ${role} role`,
      allowedFormats: defaults.allowedFormats || [],
      allowedDataTypes: defaults.allowedDataTypes || [],
      allowedRoles: [role],
      requiresApproval: defaults.requiresApproval || false,
      approverRoles: defaults.approverRoles || [],
      maxRecordsPerExport: defaults.maxRecordsPerExport || 100,
      retentionDays: defaults.retentionDays || 7,
      requiresMfa: defaults.requiresMfa || false,
      allowBulkExport: defaults.allowBulkExport || false,
      redactSensitive: defaults.redactSensitive || false,
      watermarkExports: defaults.watermarkExports || false,
      auditRequired: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async createExportPolicy(policy: InsertExportPolicy): Promise<ExportPolicy> {
    const now = new Date();
    const newPolicy: ExportPolicy = {
      ...policy,
      id: randomUUID(),
      approverRoles: policy.approverRoles || [],
      createdAt: now,
      updatedAt: now,
    };
    this.exportPolicies.set(newPolicy.id, newPolicy);
    return newPolicy;
  }

  async updateExportPolicy(id: string, updates: Partial<ExportPolicy>): Promise<ExportPolicy | undefined> {
    const policy = this.exportPolicies.get(id);
    if (!policy) return undefined;
    
    const updated = { ...policy, ...updates, updatedAt: new Date() };
    this.exportPolicies.set(id, updated);
    return updated;
  }

  async deleteExportPolicy(id: string): Promise<void> {
    this.exportPolicies.delete(id);
  }

  async getExportRequests(filters?: { requesterId?: string; patientId?: string; status?: ExportRequestStatus }, allowUnscoped = false): Promise<ExportRequest[]> {
    // Fail closed: reject completely unscoped reads unless the caller has explicitly
    // been granted allowUnscoped (i.e., a verified admin). This prevents a future
    // programming error from accidentally exposing cross-tenant data.
    if (!allowUnscoped && !filters?.requesterId && !filters?.patientId && !filters?.status) {
      return [];
    }

    let requests = Array.from(this.exportRequests.values());
    
    if (filters?.requesterId) {
      requests = requests.filter(r => r.requesterId === filters.requesterId);
    }
    if (filters?.patientId) {
      requests = requests.filter(r => r.patientId === filters.patientId);
    }
    if (filters?.status) {
      requests = requests.filter(r => r.status === filters.status);
    }
    
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getExportRequest(id: string): Promise<ExportRequest | undefined> {
    return this.exportRequests.get(id);
  }

  async createExportRequest(request: Omit<ExportRequest, "id" | "createdAt" | "updatedAt">): Promise<ExportRequest> {
    const now = new Date();
    const newRequest: ExportRequest = {
      ...request,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.exportRequests.set(newRequest.id, newRequest);
    return newRequest;
  }

  async updateExportRequest(id: string, updates: Partial<ExportRequest>): Promise<ExportRequest | undefined> {
    const request = this.exportRequests.get(id);
    if (!request) return undefined;
    
    const updated = { ...request, ...updates, updatedAt: new Date() };
    this.exportRequests.set(id, updated);
    return updated;
  }

  async approveExportRequest(id: string, approverId: string): Promise<ExportRequest | undefined> {
    const request = this.exportRequests.get(id);
    if (!request || request.status !== "pending") return undefined;
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const updated: ExportRequest = {
      ...request,
      status: "approved",
      approverId,
      approvalDate: now,
      expiresAt,
      updatedAt: now,
    };
    this.exportRequests.set(id, updated);
    
    await this.createExportAuditEntry({
      exportRequestId: id,
      action: "approved",
      performedBy: approverId,
      performedByRole: "admin",
      ipAddress: "system",
      userAgent: "system",
      details: `Export request approved by ${approverId}`,
    });
    
    return updated;
  }

  async denyExportRequest(id: string, approverId: string, reason: string): Promise<ExportRequest | undefined> {
    const request = this.exportRequests.get(id);
    if (!request || request.status !== "pending") return undefined;
    
    const now = new Date();
    const updated: ExportRequest = {
      ...request,
      status: "denied",
      approverId,
      denialReason: reason,
      updatedAt: now,
    };
    this.exportRequests.set(id, updated);
    
    await this.createExportAuditEntry({
      exportRequestId: id,
      action: "denied",
      performedBy: approverId,
      performedByRole: "admin",
      ipAddress: "system",
      userAgent: "system",
      details: `Export request denied: ${reason}`,
    });
    
    return updated;
  }

  async incrementExportDownloadCount(id: string): Promise<ExportRequest | undefined> {
    const request = this.exportRequests.get(id);
    if (!request) return undefined;
    
    const updated: ExportRequest = {
      ...request,
      downloadCount: request.downloadCount + 1,
      updatedAt: new Date(),
    };
    this.exportRequests.set(id, updated);
    return updated;
  }

  async getExportAuditEntries(exportRequestId: string): Promise<ExportAuditEntry[]> {
    return Array.from(this.exportAuditEntries.values())
      .filter(e => e.exportRequestId === exportRequestId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createExportAuditEntry(entry: Omit<ExportAuditEntry, "id" | "timestamp">): Promise<ExportAuditEntry> {
    const newEntry: ExportAuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date(),
    };
    this.exportAuditEntries.set(newEntry.id, newEntry);
    return newEntry;
  }

  async getExportAuditReport(startDate: Date, endDate: Date): Promise<ExportAuditEntry[]> {
    return Array.from(this.exportAuditEntries.values())
      .filter(e => {
        const timestamp = new Date(e.timestamp);
        return timestamp >= startDate && timestamp <= endDate;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // ============================================
  // DATA ACCESS POLICY METHODS (PHI/PII Controls)
  // ============================================

  async getDataAccessPolicies(filters?: { isActive?: boolean; targetRole?: UserRole }): Promise<DataAccessPolicy[]> {
    let policies = Array.from(this.dataAccessPolicies.values());
    
    if (filters?.isActive !== undefined) {
      policies = policies.filter(p => p.isActive === filters.isActive);
    }
    if (filters?.targetRole) {
      policies = policies.filter(p => p.targetRoles.includes(filters.targetRole!));
    }
    
    return policies.sort((a, b) => b.priority - a.priority);
  }

  async getDataAccessPolicy(id: string): Promise<DataAccessPolicy | undefined> {
    return this.dataAccessPolicies.get(id);
  }

  async getApplicablePolicies(params: {
    userRole: UserRole;
    userId: string;
    resourceType: FhirResourceType;
    action: AccessAction;
    dataClassification?: DataClassificationTag;
  }): Promise<DataAccessPolicy[]> {
    const policies = Array.from(this.dataAccessPolicies.values())
      .filter(p => {
        if (!p.isActive) return false;
        if (!p.targetRoles.includes(params.userRole)) return false;
        if (p.excludeUserIds?.includes(params.userId)) return false;
        if (p.targetUserIds && p.targetUserIds.length > 0 && !p.targetUserIds.includes(params.userId)) return false;
        if (!p.resourceTypes.includes(params.resourceType) && !p.resourceTypes.includes("All")) return false;
        if (!p.actions.includes(params.action)) return false;
        if (params.dataClassification && !p.dataClassifications.includes(params.dataClassification)) return false;
        return true;
      })
      .sort((a, b) => b.priority - a.priority);
    
    return policies;
  }

  async createDataAccessPolicy(policy: InsertDataAccessPolicy): Promise<DataAccessPolicy> {
    const now = new Date().toISOString();
    const newPolicy: DataAccessPolicy = {
      ...policy,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.dataAccessPolicies.set(newPolicy.id, newPolicy);
    return newPolicy;
  }

  async updateDataAccessPolicy(id: string, updates: Partial<DataAccessPolicy>): Promise<DataAccessPolicy | undefined> {
    const policy = this.dataAccessPolicies.get(id);
    if (!policy) return undefined;
    if (policy.isSystemPolicy) return undefined;
    
    const updated: DataAccessPolicy = {
      ...policy,
      ...updates,
      id: policy.id,
      createdAt: policy.createdAt,
      isSystemPolicy: policy.isSystemPolicy,
      updatedAt: new Date().toISOString(),
    };
    this.dataAccessPolicies.set(id, updated);
    return updated;
  }

  async deleteDataAccessPolicy(id: string): Promise<void> {
    const policy = this.dataAccessPolicies.get(id);
    if (policy && !policy.isSystemPolicy) {
      this.dataAccessPolicies.delete(id);
    }
  }

  // Policy Violations

  async getPolicyViolations(filters?: { userId?: string; policyId?: string; startDate?: string; endDate?: string }): Promise<PolicyViolation[]> {
    let violations = Array.from(this.policyViolations.values());
    
    if (filters?.userId) {
      violations = violations.filter(v => v.userId === filters.userId);
    }
    if (filters?.policyId) {
      violations = violations.filter(v => v.policyId === filters.policyId);
    }
    if (filters?.startDate) {
      violations = violations.filter(v => new Date(v.timestamp) >= new Date(filters.startDate!));
    }
    if (filters?.endDate) {
      violations = violations.filter(v => new Date(v.timestamp) <= new Date(filters.endDate!));
    }
    
    return violations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getPolicyViolation(id: string): Promise<PolicyViolation | undefined> {
    return this.policyViolations.get(id);
  }

  async createPolicyViolation(violation: InsertPolicyViolation): Promise<PolicyViolation> {
    const newViolation: PolicyViolation = {
      ...violation,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.policyViolations.set(newViolation.id, newViolation);
    return newViolation;
  }

  // Break-the-Glass Records

  async getBreakTheGlassRecords(filters?: { userId?: string; patientId?: string; reviewStatus?: string }): Promise<BreakTheGlassRecord[]> {
    let records = Array.from(this.breakTheGlassRecords.values());
    
    if (filters?.userId) {
      records = records.filter(r => r.userId === filters.userId);
    }
    if (filters?.patientId) {
      records = records.filter(r => r.patientId === filters.patientId);
    }
    if (filters?.reviewStatus) {
      records = records.filter(r => r.reviewStatus === filters.reviewStatus);
    }
    
    return records.sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());
  }

  async getBreakTheGlassRecord(id: string): Promise<BreakTheGlassRecord | undefined> {
    return this.breakTheGlassRecords.get(id);
  }

  async getActiveBreakTheGlass(userId: string, patientId: string): Promise<BreakTheGlassRecord | undefined> {
    const now = new Date();
    return Array.from(this.breakTheGlassRecords.values()).find(r => 
      r.userId === userId && 
      r.patientId === patientId && 
      !r.deactivatedAt &&
      new Date(r.expiresAt) > now
    );
  }

  async createBreakTheGlassRecord(record: InsertBreakTheGlass): Promise<BreakTheGlassRecord> {
    const newRecord: BreakTheGlassRecord = {
      ...record,
      id: randomUUID(),
      activatedAt: new Date().toISOString(),
    };
    this.breakTheGlassRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  async deactivateBreakTheGlass(id: string, deactivatedBy: string): Promise<BreakTheGlassRecord | undefined> {
    const record = this.breakTheGlassRecords.get(id);
    if (!record) return undefined;
    
    const updated: BreakTheGlassRecord = {
      ...record,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy,
    };
    this.breakTheGlassRecords.set(id, updated);
    return updated;
  }

  async reviewBreakTheGlass(id: string, reviewedBy: string, status: "approved" | "flagged" | "investigated", notes?: string): Promise<BreakTheGlassRecord | undefined> {
    const record = this.breakTheGlassRecords.get(id);
    if (!record) return undefined;
    
    const updated: BreakTheGlassRecord = {
      ...record,
      reviewStatus: status,
      reviewedBy,
      reviewNotes: notes,
    };
    this.breakTheGlassRecords.set(id, updated);
    return updated;
  }

  // Access Grants

  async getAccessGrants(filters?: { userId?: string; patientId?: string; isActive?: boolean }): Promise<AccessGrant[]> {
    let grants = Array.from(this.accessGrants.values());
    
    if (filters?.userId) {
      grants = grants.filter(g => g.userId === filters.userId);
    }
    if (filters?.patientId) {
      grants = grants.filter(g => g.patientId === filters.patientId);
    }
    if (filters?.isActive !== undefined) {
      grants = grants.filter(g => g.isActive === filters.isActive);
    }
    
    return grants.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  }

  async getAccessGrant(id: string): Promise<AccessGrant | undefined> {
    return this.accessGrants.get(id);
  }

  async createAccessGrant(grant: Omit<AccessGrant, "id" | "grantedAt">): Promise<AccessGrant> {
    const newGrant: AccessGrant = {
      ...grant,
      id: randomUUID(),
      grantedAt: new Date().toISOString(),
    };
    this.accessGrants.set(newGrant.id, newGrant);
    return newGrant;
  }

  async revokeAccessGrant(id: string): Promise<AccessGrant | undefined> {
    const grant = this.accessGrants.get(id);
    if (!grant) return undefined;
    
    const updated: AccessGrant = {
      ...grant,
      isActive: false,
    };
    this.accessGrants.set(id, updated);
    return updated;
  }

  // ============================================
  // CONSENT DOCUMENT METHODS (GDPR/HIPAA)
  // ============================================

  async getConsentDocuments(filters?: { type?: ConsentDocumentType; isActive?: boolean }): Promise<ConsentDocument[]> {
    let docs = Array.from(this.consentDocuments.values());
    if (filters?.type) {
      docs = docs.filter(d => d.type === filters.type);
    }
    if (filters?.isActive !== undefined) {
      docs = docs.filter(d => d.isActive === filters.isActive);
    }
    return docs.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
  }

  async getConsentDocument(id: string): Promise<ConsentDocument | undefined> {
    return this.consentDocuments.get(id);
  }

  async getActiveConsentDocument(type: ConsentDocumentType): Promise<ConsentDocument | undefined> {
    return Array.from(this.consentDocuments.values())
      .find(d => d.type === type && d.isActive);
  }

  async getConsentDocumentVersions(type: ConsentDocumentType): Promise<ConsentDocument[]> {
    return Array.from(this.consentDocuments.values())
      .filter(d => d.type === type)
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  }

  async createConsentDocument(document: InsertConsentDocument): Promise<ConsentDocument> {
    const now = new Date().toISOString();
    
    if (document.isActive) {
      for (const doc of this.consentDocuments.values()) {
        if (doc.type === document.type && doc.isActive) {
          doc.isActive = false;
          doc.updatedAt = now;
          this.consentDocuments.set(doc.id, doc);
        }
      }
    }
    
    const newDoc: ConsentDocument = {
      ...document,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.consentDocuments.set(newDoc.id, newDoc);
    return newDoc;
  }

  async updateConsentDocument(id: string, updates: Partial<ConsentDocument>): Promise<ConsentDocument | undefined> {
    const doc = this.consentDocuments.get(id);
    if (!doc) return undefined;
    
    const updated: ConsentDocument = {
      ...doc,
      ...updates,
      id: doc.id,
      updatedAt: new Date().toISOString(),
    };
    this.consentDocuments.set(id, updated);
    return updated;
  }

  async deactivateConsentDocument(id: string): Promise<ConsentDocument | undefined> {
    return this.updateConsentDocument(id, { isActive: false });
  }

  // User Consent Records
  async getUserConsentRecords(userId: string): Promise<UserConsentRecord[]> {
    return Array.from(this.userConsentRecords.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUserConsentRecord(id: string): Promise<UserConsentRecord | undefined> {
    return this.userConsentRecords.get(id);
  }

  async getUserConsentForDocument(userId: string, documentType: ConsentDocumentType): Promise<UserConsentRecord | undefined> {
    const activeDoc = await this.getActiveConsentDocument(documentType);
    if (!activeDoc) return undefined;
    
    return Array.from(this.userConsentRecords.values())
      .find(r => r.userId === userId && r.documentId === activeDoc.id && r.status === "accepted");
  }

  async createUserConsentRecord(record: InsertUserConsentRecord): Promise<UserConsentRecord> {
    const now = new Date().toISOString();
    const newRecord: UserConsentRecord = {
      ...record,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.userConsentRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  async updateUserConsentRecord(id: string, updates: Partial<UserConsentRecord>): Promise<UserConsentRecord | undefined> {
    const record = this.userConsentRecords.get(id);
    if (!record) return undefined;
    
    const updated: UserConsentRecord = {
      ...record,
      ...updates,
      id: record.id,
      updatedAt: new Date().toISOString(),
    };
    this.userConsentRecords.set(id, updated);
    return updated;
  }

  async withdrawUserConsent(id: string): Promise<UserConsentRecord | undefined> {
    return this.updateUserConsentRecord(id, { 
      status: "withdrawn", 
      withdrawnAt: new Date().toISOString() 
    });
  }

  async getUserConsentStatus(userId: string): Promise<UserConsentStatus> {
    const activeDocs = await this.getConsentDocuments({ isActive: true });
    const requiredDocs = activeDocs.filter(d => d.isRequired);
    const userRecords = await this.getUserConsentRecords(userId);
    
    const missingRequired: ConsentDocumentType[] = [];
    const allConsents: UserConsentStatus["allConsents"] = [];
    
    for (const doc of activeDocs) {
      const record = userRecords.find(r => r.documentId === doc.id && r.status === "accepted");
      const isExpired = record?.expiresAt && new Date(record.expiresAt) < new Date();
      
      let status: "accepted" | "declined" | "withdrawn" | "expired" | "pending" = "pending";
      if (record) {
        status = isExpired ? "expired" : record.status;
      }
      
      allConsents.push({
        documentType: doc.type,
        documentVersion: doc.version,
        status,
        acceptedAt: record?.acceptedAt,
        expiresAt: record?.expiresAt,
        needsRenewal: isExpired || false,
      });
      
      if (doc.isRequired && (!record || isExpired)) {
        missingRequired.push(doc.type);
      }
    }
    
    return {
      userId,
      requiredConsentsGiven: missingRequired.length === 0,
      missingRequiredConsents: missingRequired,
      allConsents,
      canConnectSources: missingRequired.length === 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async checkRequiredConsents(userId: string): Promise<{ allAccepted: boolean; missing: ConsentDocumentType[] }> {
    const status = await this.getUserConsentStatus(userId);
    return {
      allAccepted: status.requiredConsentsGiven,
      missing: status.missingRequiredConsents,
    };
  }

  // Consent Analytics
  async getConsentAnalytics(filters?: { 
    documentType?: ConsentDocumentType; 
    event?: ConsentAnalyticsEvent; 
    startDate?: string; 
    endDate?: string 
  }): Promise<ConsentAnalyticsRecord[]> {
    let records = Array.from(this.consentAnalyticsRecords.values());
    
    if (filters?.documentType) {
      records = records.filter(r => r.documentType === filters.documentType);
    }
    if (filters?.event) {
      records = records.filter(r => r.event === filters.event);
    }
    if (filters?.startDate) {
      records = records.filter(r => new Date(r.timestamp) >= new Date(filters.startDate!));
    }
    if (filters?.endDate) {
      records = records.filter(r => new Date(r.timestamp) <= new Date(filters.endDate!));
    }
    
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createConsentAnalyticsRecord(record: InsertConsentAnalyticsRecord): Promise<ConsentAnalyticsRecord> {
    const newRecord: ConsentAnalyticsRecord = {
      ...record,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.consentAnalyticsRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  // ============================================
  // DATA DEDUPLICATION & NORMALIZATION METHODS
  // ============================================

  async getDedupGroups(userId: string, recordType?: import("@shared/schema").DedupRecordType): Promise<import("@shared/schema").DedupGroup[]> {
    return Array.from(this.dedupGroups.values())
      .filter(g => g.userId === userId && (!recordType || g.recordType === recordType))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDedupGroup(id: string): Promise<import("@shared/schema").DedupGroup | undefined> {
    return this.dedupGroups.get(id);
  }

  async createDedupGroup(group: import("@shared/schema").InsertDedupGroup): Promise<import("@shared/schema").DedupGroup> {
    const now = new Date().toISOString();
    const newGroup: import("@shared/schema").DedupGroup = {
      ...group,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.dedupGroups.set(newGroup.id, newGroup);
    return newGroup;
  }

  async updateDedupGroup(id: string, updates: Partial<import("@shared/schema").DedupGroup>): Promise<import("@shared/schema").DedupGroup | undefined> {
    const group = this.dedupGroups.get(id);
    if (!group) return undefined;
    const updated: import("@shared/schema").DedupGroup = {
      ...group,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.dedupGroups.set(id, updated);
    return updated;
  }

  async deleteDedupGroup(id: string): Promise<void> {
    this.dedupGroups.delete(id);
    for (const [linkId, link] of this.provenanceLinks) {
      if (link.dedupGroupId === id) {
        this.provenanceLinks.delete(linkId);
      }
    }
    for (const [conflictId, conflict] of this.dedupConflicts) {
      if (conflict.dedupGroupId === id) {
        this.dedupConflicts.delete(conflictId);
      }
    }
  }

  async getDedupConflicts(userId: string, status?: "pending" | "resolved" | "dismissed"): Promise<import("@shared/schema").DedupConflict[]> {
    return Array.from(this.dedupConflicts.values())
      .filter(c => c.userId === userId && (!status || c.status === status))
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  async getDedupConflictsByGroup(dedupGroupId: string): Promise<import("@shared/schema").DedupConflict[]> {
    return Array.from(this.dedupConflicts.values())
      .filter(c => c.dedupGroupId === dedupGroupId);
  }

  async getDedupConflict(id: string): Promise<import("@shared/schema").DedupConflict | undefined> {
    return this.dedupConflicts.get(id);
  }

  async createDedupConflict(conflict: import("@shared/schema").InsertDedupConflict): Promise<import("@shared/schema").DedupConflict> {
    const newConflict: import("@shared/schema").DedupConflict = {
      ...conflict,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.dedupConflicts.set(newConflict.id, newConflict);
    return newConflict;
  }

  async updateDedupConflict(id: string, updates: Partial<import("@shared/schema").DedupConflict>): Promise<import("@shared/schema").DedupConflict | undefined> {
    const conflict = this.dedupConflicts.get(id);
    if (!conflict) return undefined;
    const updated: import("@shared/schema").DedupConflict = { ...conflict, ...updates };
    this.dedupConflicts.set(id, updated);
    return updated;
  }

  async resolveDedupConflict(id: string, resolvedValue: string, resolvedBy: string, note?: string): Promise<import("@shared/schema").DedupConflict | undefined> {
    const conflict = this.dedupConflicts.get(id);
    if (!conflict) return undefined;
    const resolved: import("@shared/schema").DedupConflict = {
      ...conflict,
      status: "resolved",
      resolvedValue,
      resolvedBy,
      resolvedAt: new Date().toISOString(),
      resolutionNote: note,
    };
    this.dedupConflicts.set(id, resolved);
    return resolved;
  }

  async getProvenanceLinksByGroup(dedupGroupId: string): Promise<import("@shared/schema").ProvenanceLink[]> {
    return Array.from(this.provenanceLinks.values())
      .filter(l => l.dedupGroupId === dedupGroupId)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async getProvenanceLinksByRecord(originalRecordId: string): Promise<import("@shared/schema").ProvenanceLink[]> {
    return Array.from(this.provenanceLinks.values())
      .filter(l => l.originalRecordId === originalRecordId);
  }

  async getProvenanceLink(id: string): Promise<import("@shared/schema").ProvenanceLink | undefined> {
    return this.provenanceLinks.get(id);
  }

  async createProvenanceLink(link: import("@shared/schema").InsertProvenanceLink): Promise<import("@shared/schema").ProvenanceLink> {
    const newLink: import("@shared/schema").ProvenanceLink = {
      ...link,
      id: randomUUID(),
    };
    this.provenanceLinks.set(newLink.id, newLink);
    return newLink;
  }

  async updateProvenanceLink(id: string, updates: Partial<import("@shared/schema").ProvenanceLink>): Promise<import("@shared/schema").ProvenanceLink | undefined> {
    const link = this.provenanceLinks.get(id);
    if (!link) return undefined;
    const updated: import("@shared/schema").ProvenanceLink = { ...link, ...updates };
    this.provenanceLinks.set(id, updated);
    return updated;
  }

  async deleteProvenanceLink(id: string): Promise<void> {
    this.provenanceLinks.delete(id);
  }

  // ============================================
  // COLLABORATION METHODS
  // ============================================

  // Document Sharing
  async getDocumentShares(documentId: string): Promise<DocumentShare[]> {
    return Array.from(this.documentShares.values())
      .filter(s => s.documentId === documentId && s.status === "active");
  }

  async createDocumentShare(patientId: string, sharedById: string, data: InsertDocumentShare): Promise<DocumentShare> {
    const share: DocumentShare = {
      ...data,
      id: randomUUID(),
      patientId,
      sharedById,
      status: "active",
      sharedAt: new Date().toISOString(),
    };
    this.documentShares.set(share.id, share);
    return share;
  }

  async revokeDocumentShare(shareId: string): Promise<void> {
    const share = this.documentShares.get(shareId);
    if (share) {
      share.status = "revoked";
      this.documentShares.set(shareId, share);
    }
  }

  // Document Annotations
  async getDocumentAnnotations(documentId: string): Promise<DocumentAnnotation[]> {
    return Array.from(this.documentAnnotations.values())
      .filter(a => a.documentId === documentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createDocumentAnnotation(authorId: string, authorName: string, authorRole: string, data: InsertDocumentAnnotation): Promise<DocumentAnnotation> {
    const annotation: DocumentAnnotation = {
      ...data,
      id: randomUUID(),
      authorId,
      authorName,
      authorRole,
      createdAt: new Date().toISOString(),
    };
    this.documentAnnotations.set(annotation.id, annotation);
    return annotation;
  }

  async deleteDocumentAnnotation(annotationId: string): Promise<void> {
    this.documentAnnotations.delete(annotationId);
    // Also delete replies
    Array.from(this.annotationReplies.values())
      .filter(r => r.annotationId === annotationId)
      .forEach(r => this.annotationReplies.delete(r.id));
  }

  async getAnnotationReplies(annotationId: string): Promise<AnnotationReply[]> {
    return Array.from(this.annotationReplies.values())
      .filter(r => r.annotationId === annotationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createAnnotationReply(authorId: string, authorName: string, authorRole: string, data: InsertAnnotationReply): Promise<AnnotationReply> {
    const reply: AnnotationReply = {
      ...data,
      id: randomUUID(),
      authorId,
      authorName,
      authorRole,
      createdAt: new Date().toISOString(),
    };
    this.annotationReplies.set(reply.id, reply);
    return reply;
  }

  // Care Plan Tasks
  async getCarePlanTasks(carePlanId: string): Promise<CarePlanTask[]> {
    return Array.from(this.carePlanTasks.values())
      .filter(t => t.carePlanId === carePlanId)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async createCarePlanTask(createdById: string, createdByName: string, data: InsertCarePlanTask): Promise<CarePlanTask> {
    const task: CarePlanTask = {
      ...data,
      id: randomUUID(),
      status: "todo",
      priority: data.priority || "medium",
      createdById,
      createdByName,
      createdAt: new Date().toISOString(),
    };
    this.carePlanTasks.set(task.id, task);
    return task;
  }

  async updateCarePlanTask(taskId: string, updates: UpdateCarePlanTask): Promise<CarePlanTask | undefined> {
    const task = this.carePlanTasks.get(taskId);
    if (!task) return undefined;
    
    const updated: CarePlanTask = {
      ...task,
      ...updates,
      completedAt: updates.status === "done" ? new Date().toISOString() : task.completedAt,
    };
    this.carePlanTasks.set(taskId, updated);
    return updated;
  }

  async deleteCarePlanTask(taskId: string): Promise<void> {
    this.carePlanTasks.delete(taskId);
  }

  // Care Plan Progress Updates
  async getCarePlanProgressUpdates(carePlanId: string): Promise<CarePlanProgressUpdate[]> {
    return Array.from(this.carePlanProgressUpdates.values())
      .filter(p => p.carePlanId === carePlanId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createCarePlanProgressUpdate(authorId: string, authorName: string, authorRole: string, data: InsertCarePlanProgressUpdate): Promise<CarePlanProgressUpdate> {
    const update: CarePlanProgressUpdate = {
      ...data,
      id: randomUUID(),
      authorId,
      authorName,
      authorRole,
      createdAt: new Date().toISOString(),
    };
    this.carePlanProgressUpdates.set(update.id, update);
    return update;
  }

  // Care Plan Collaborators
  async getCarePlanCollaborators(carePlanId: string): Promise<CarePlanCollaborator[]> {
    return Array.from(this.carePlanCollaborators.values())
      .filter(c => c.carePlanId === carePlanId);
  }

  async addCarePlanCollaborator(addedById: string, data: InsertCarePlanCollaborator): Promise<CarePlanCollaborator> {
    const collaborator: CarePlanCollaborator = {
      ...data,
      id: randomUUID(),
      addedById,
      addedAt: new Date().toISOString(),
    };
    this.carePlanCollaborators.set(collaborator.id, collaborator);
    return collaborator;
  }

  async removeCarePlanCollaborator(collaboratorId: string): Promise<void> {
    this.carePlanCollaborators.delete(collaboratorId);
  }

  // Shared Notes
  async getSharedNotes(patientId: string): Promise<SharedNote[]> {
    return Array.from(this.sharedNotes.values())
      .filter(n => n.patientId === patientId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getSharedNote(noteId: string): Promise<SharedNote | undefined> {
    return this.sharedNotes.get(noteId);
  }

  async createSharedNote(patientId: string, createdById: string, createdByName: string, data: InsertSharedNote): Promise<SharedNote> {
    const now = new Date().toISOString();
    const note: SharedNote = {
      ...data,
      id: randomUUID(),
      patientId,
      createdById,
      createdByName,
      createdAt: now,
      updatedAt: now,
    };
    this.sharedNotes.set(note.id, note);
    return note;
  }

  async updateSharedNote(noteId: string, editorId: string, editorName: string, updates: UpdateSharedNote): Promise<SharedNote | undefined> {
    const note = this.sharedNotes.get(noteId);
    if (!note) return undefined;
    
    const updated: SharedNote = {
      ...note,
      ...updates,
      lastEditedById: editorId,
      lastEditedByName: editorName,
      updatedAt: new Date().toISOString(),
    };
    this.sharedNotes.set(noteId, updated);
    return updated;
  }

  async deleteSharedNote(noteId: string): Promise<void> {
    this.sharedNotes.delete(noteId);
    Array.from(this.noteCollaborators.values())
      .filter(c => c.noteId === noteId)
      .forEach(c => this.noteCollaborators.delete(c.id));
  }

  // Note Collaborators
  async getNoteCollaborators(noteId: string): Promise<NoteCollaborator[]> {
    return Array.from(this.noteCollaborators.values())
      .filter(c => c.noteId === noteId);
  }

  async addNoteCollaborator(data: InsertNoteCollaborator): Promise<NoteCollaborator> {
    const collaborator: NoteCollaborator = {
      ...data,
      id: randomUUID(),
      addedAt: new Date().toISOString(),
    };
    this.noteCollaborators.set(collaborator.id, collaborator);
    return collaborator;
  }

  async removeNoteCollaborator(collaboratorId: string): Promise<void> {
    this.noteCollaborators.delete(collaboratorId);
  }

  // Whiteboard Sessions
  async getWhiteboards(patientId: string): Promise<WhiteboardSession[]> {
    return Array.from(this.whiteboardSessions.values())
      .filter(w => w.patientId === patientId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getWhiteboard(whiteboardId: string): Promise<WhiteboardSession | undefined> {
    return this.whiteboardSessions.get(whiteboardId);
  }

  async createWhiteboard(patientId: string, createdById: string, createdByName: string, data: InsertWhiteboard): Promise<WhiteboardSession> {
    const now = new Date().toISOString();
    const whiteboard: WhiteboardSession = {
      ...data,
      id: randomUUID(),
      patientId,
      createdById,
      createdByName,
      createdAt: now,
      updatedAt: now,
    };
    this.whiteboardSessions.set(whiteboard.id, whiteboard);
    return whiteboard;
  }

  async updateWhiteboard(whiteboardId: string, updates: UpdateWhiteboard): Promise<WhiteboardSession | undefined> {
    const whiteboard = this.whiteboardSessions.get(whiteboardId);
    if (!whiteboard) return undefined;
    
    const updated: WhiteboardSession = {
      ...whiteboard,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.whiteboardSessions.set(whiteboardId, updated);
    return updated;
  }

  async deleteWhiteboard(whiteboardId: string): Promise<void> {
    this.whiteboardSessions.delete(whiteboardId);
  }

  // Group Message Threads
  async getCollabMessageThreads(patientId: string): Promise<CollabMessageThread[]> {
    return Array.from(this.collabMessageThreads.values())
      .filter(t => t.patientId === patientId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
  }

  async getCollabMessageThread(threadId: string): Promise<CollabMessageThread | undefined> {
    return this.collabMessageThreads.get(threadId);
  }

  async createCollabMessageThread(patientId: string, createdById: string, createdByName: string, data: InsertCollabMessageThread): Promise<CollabMessageThread> {
    const thread: CollabMessageThread = {
      id: randomUUID(),
      patientId,
      subject: data.subject,
      threadType: data.threadType || "direct",
      createdById,
      createdByName,
      createdAt: new Date().toISOString(),
    };
    this.collabMessageThreads.set(thread.id, thread);
    
    // Add creator as participant
    await this.addThreadParticipant({
      threadId: thread.id,
      memberId: createdById,
      memberName: createdByName,
      memberRole: "patient",
    });
    
    return thread;
  }

  // Thread Participants
  async getThreadParticipants(threadId: string): Promise<ThreadParticipant[]> {
    return Array.from(this.threadParticipants.values())
      .filter(p => p.threadId === threadId);
  }

  async addThreadParticipant(data: InsertThreadParticipant): Promise<ThreadParticipant> {
    const participant: ThreadParticipant = {
      ...data,
      id: randomUUID(),
      joinedAt: new Date().toISOString(),
      muted: false,
    };
    this.threadParticipants.set(participant.id, participant);
    return participant;
  }

  async removeThreadParticipant(participantId: string): Promise<void> {
    this.threadParticipants.delete(participantId);
  }

  async updateParticipantLastRead(participantId: string): Promise<void> {
    const participant = this.threadParticipants.get(participantId);
    if (participant) {
      participant.lastReadAt = new Date().toISOString();
      this.threadParticipants.set(participantId, participant);
    }
  }

  // Thread Messages
  async getThreadMessages(threadId: string): Promise<ThreadMessage[]> {
    return Array.from(this.threadMessages.values())
      .filter(m => m.threadId === threadId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }

  async createThreadMessage(senderId: string, senderName: string, senderRole: string, data: InsertThreadMessage): Promise<ThreadMessage> {
    const message: ThreadMessage = {
      ...data,
      id: randomUUID(),
      senderId,
      senderName,
      senderRole,
      sentAt: new Date().toISOString(),
    };
    this.threadMessages.set(message.id, message);
    
    // Update thread last message
    const thread = this.collabMessageThreads.get(data.threadId);
    if (thread) {
      thread.lastMessageAt = message.sentAt;
      thread.lastMessagePreview = data.body.substring(0, 100);
      this.collabMessageThreads.set(thread.id, thread);
    }
    
    return message;
  }

  private complianceEvidenceStore: Map<string, ComplianceEvidence> = new Map();
  private complianceWeeklyReportsStore: Map<string, ComplianceWeeklyReport> = new Map();

  async getComplianceEvidence(filters?: { category?: ComplianceEvidenceCategory; soc2Category?: SOC2TrustServiceCategory; status?: string; limit?: number; offset?: number }): Promise<ComplianceEvidence[]> {
    let items = Array.from(this.complianceEvidenceStore.values());
    if (filters?.category) items = items.filter(e => e.category === filters.category);
    if (filters?.soc2Category) items = items.filter(e => e.soc2Category === filters.soc2Category);
    if (filters?.status) items = items.filter(e => e.status === filters.status);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    return items.slice(offset, offset + limit);
  }

  async getComplianceEvidenceById(id: string): Promise<ComplianceEvidence | undefined> {
    return this.complianceEvidenceStore.get(id);
  }

  async createComplianceEvidence(evidence: InsertComplianceEvidence): Promise<ComplianceEvidence> {
    const now = new Date();
    const record: ComplianceEvidence = {
      ...evidence,
      id: randomUUID(),
      tags: evidence.tags ?? [],
      source: evidence.source ?? "manual",
      severity: evidence.severity ?? "info",
      status: evidence.status ?? "active",
      objectKey: evidence.objectKey ?? null,
      collectedBy: evidence.collectedBy ?? "system",
      reviewedBy: evidence.reviewedBy ?? null,
      reviewedAt: evidence.reviewedAt ? new Date(evidence.reviewedAt) : null,
      expiresAt: evidence.expiresAt ? new Date(evidence.expiresAt) : null,
      metadata: evidence.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.complianceEvidenceStore.set(record.id, record);
    return record;
  }

  async updateComplianceEvidence(id: string, updates: Partial<ComplianceEvidence>): Promise<ComplianceEvidence | undefined> {
    const existing = this.complianceEvidenceStore.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.complianceEvidenceStore.set(id, updated);
    return updated;
  }

  async deleteComplianceEvidence(id: string): Promise<void> {
    this.complianceEvidenceStore.delete(id);
  }

  async getComplianceEvidenceStats(): Promise<{ total: number; byCategory: Record<string, number>; bySoc2Category: Record<string, number>; byStatus: Record<string, number> }> {
    const items = Array.from(this.complianceEvidenceStore.values());
    const byCategory: Record<string, number> = {};
    const bySoc2Category: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const item of items) {
      byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      bySoc2Category[item.soc2Category] = (bySoc2Category[item.soc2Category] || 0) + 1;
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }
    return { total: items.length, byCategory, bySoc2Category, byStatus };
  }

  async getComplianceWeeklyReports(limit?: number): Promise<ComplianceWeeklyReport[]> {
    const items = Array.from(this.complianceWeeklyReportsStore.values())
      .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
    return items.slice(0, limit || 20);
  }

  async getComplianceWeeklyReportById(id: string): Promise<ComplianceWeeklyReport | undefined> {
    return this.complianceWeeklyReportsStore.get(id);
  }

  async createComplianceWeeklyReport(report: InsertComplianceWeeklyReport): Promise<ComplianceWeeklyReport> {
    const now = new Date();
    const record: ComplianceWeeklyReport = {
      ...report,
      id: randomUUID(),
      totalAuditEvents: report.totalAuditEvents ?? 0,
      totalEvidenceCollected: report.totalEvidenceCollected ?? 0,
      newFindings: report.newFindings ?? 0,
      resolvedFindings: report.resolvedFindings ?? 0,
      overallComplianceScore: report.overallComplianceScore ?? 100,
      soc2Scores: report.soc2Scores ?? { security: 100, availability: 100, processing_integrity: 100, confidentiality: 100, privacy: 100 },
      eventBreakdown: report.eventBreakdown ?? {},
      criticalEvents: report.criticalEvents ?? [],
      recommendations: report.recommendations ?? [],
      status: report.status ?? "draft",
      generatedBy: report.generatedBy ?? "system",
      approvedBy: report.approvedBy ?? null,
      approvedAt: report.approvedAt ? new Date(report.approvedAt) : null,
      metadata: report.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.complianceWeeklyReportsStore.set(record.id, record);
    return record;
  }

  async updateComplianceWeeklyReport(id: string, updates: Partial<ComplianceWeeklyReport>): Promise<ComplianceWeeklyReport | undefined> {
    const existing = this.complianceWeeklyReportsStore.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.complianceWeeklyReportsStore.set(id, updated);
    return updated;
  }

  async getLatestComplianceWeeklyReport(): Promise<ComplianceWeeklyReport | undefined> {
    const items = Array.from(this.complianceWeeklyReportsStore.values())
      .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());
    return items[0];
  }

  private remediationWorkflowsStore: Map<string, RemediationWorkflow> = new Map();

  async getRemediationWorkflows(filters?: { status?: RemediationStatus; severity?: string; triggerType?: string; limit?: number }): Promise<RemediationWorkflow[]> {
    let items = Array.from(this.remediationWorkflowsStore.values());
    if (filters?.status) items = items.filter(w => w.status === filters.status);
    if (filters?.severity) items = items.filter(w => w.severity === filters.severity);
    if (filters?.triggerType) items = items.filter(w => w.triggerType === filters.triggerType);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items.slice(0, filters?.limit || 100);
  }

  async getRemediationWorkflow(id: string): Promise<RemediationWorkflow | undefined> {
    return this.remediationWorkflowsStore.get(id);
  }

  async createRemediationWorkflow(workflow: InsertRemediationWorkflow): Promise<RemediationWorkflow> {
    const now = new Date();
    const record: RemediationWorkflow = {
      ...workflow,
      id: randomUUID(),
      status: workflow.status ?? "triggered",
      accountFlagged: workflow.accountFlagged ?? false,
      accountFlaggedAt: workflow.accountFlaggedAt ? new Date(workflow.accountFlaggedAt as any) : null,
      ticketId: workflow.ticketId ?? null,
      ticketTitle: workflow.ticketTitle ?? null,
      ticketCreatedAt: workflow.ticketCreatedAt ? new Date(workflow.ticketCreatedAt as any) : null,
      alertChannel: workflow.alertChannel ?? "email",
      alertSentAt: workflow.alertSentAt ? new Date(workflow.alertSentAt as any) : null,
      alertRecipients: workflow.alertRecipients ?? [],
      incidentLogs: workflow.incidentLogs ?? [],
      soc2Category: workflow.soc2Category ?? "security",
      controlId: workflow.controlId ?? null,
      affectedUserId: workflow.affectedUserId ?? null,
      affectedUserEmail: workflow.affectedUserEmail ?? null,
      resolvedBy: workflow.resolvedBy ?? null,
      resolvedAt: workflow.resolvedAt ? new Date(workflow.resolvedAt as any) : null,
      resolutionNotes: workflow.resolutionNotes ?? null,
      metadata: workflow.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.remediationWorkflowsStore.set(record.id, record);
    return record;
  }

  async updateRemediationWorkflow(id: string, updates: Partial<RemediationWorkflow>): Promise<RemediationWorkflow | undefined> {
    const existing = this.remediationWorkflowsStore.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.remediationWorkflowsStore.set(id, updated);
    return updated;
  }

  async getRemediationStats(): Promise<{ total: number; byStatus: Record<string, number>; bySeverity: Record<string, number>; byTriggerType: Record<string, number>; activeCount: number; resolvedCount: number }> {
    const items = Array.from(this.remediationWorkflowsStore.values());
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byTriggerType: Record<string, number> = {};
    for (const w of items) {
      byStatus[w.status] = (byStatus[w.status] || 0) + 1;
      bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1;
      byTriggerType[w.triggerType] = (byTriggerType[w.triggerType] || 0) + 1;
    }
    const activeCount = items.filter(w => !["resolved", "completed"].includes(w.status)).length;
    const resolvedCount = items.filter(w => ["resolved", "completed"].includes(w.status)).length;
    return { total: items.length, byStatus, bySeverity, byTriggerType, activeCount, resolvedCount };
  }

  private fhirApiPartnersStore: Map<string, FhirApiPartner> = new Map();
  private fhirApiScopeGrantsStore: Map<string, FhirApiScopeGrant> = new Map();
  private fhirApiAuditLogsStore: Map<string, FhirApiAuditLog> = new Map();

  async getFhirApiPartners(): Promise<FhirApiPartner[]> {
    return Array.from(this.fhirApiPartnersStore.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getFhirApiPartner(id: string): Promise<FhirApiPartner | undefined> {
    return this.fhirApiPartnersStore.get(id);
  }

  async getFhirApiPartnerByKeyHash(apiKeyHash: string): Promise<FhirApiPartner | undefined> {
    return Array.from(this.fhirApiPartnersStore.values()).find(p => p.apiKeyHash === apiKeyHash);
  }

  async createFhirApiPartner(partner: InsertFhirApiPartner): Promise<FhirApiPartner> {
    const now = new Date();
    const id = crypto.randomUUID();
    const record: FhirApiPartner = {
      id,
      name: partner.name,
      organization: partner.organization,
      contactEmail: partner.contactEmail,
      apiKeyHash: partner.apiKeyHash,
      apiKeyPrefix: partner.apiKeyPrefix,
      status: partner.status ?? "active",
      allowedScopes: partner.allowedScopes ?? [],
      rateLimitPerHour: partner.rateLimitPerHour ?? 100,
      lastAccessAt: partner.lastAccessAt ? new Date(partner.lastAccessAt) : null,
      expiresAt: partner.expiresAt ? new Date(partner.expiresAt) : null,
      metadata: partner.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.fhirApiPartnersStore.set(id, record);
    return record;
  }

  async updateFhirApiPartner(id: string, updates: Partial<FhirApiPartner>): Promise<FhirApiPartner | undefined> {
    const existing = this.fhirApiPartnersStore.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.fhirApiPartnersStore.set(id, updated);
    return updated;
  }

  async deleteFhirApiPartner(id: string): Promise<void> {
    this.fhirApiPartnersStore.delete(id);
    for (const [grantId, grant] of this.fhirApiScopeGrantsStore) {
      if (grant.partnerId === id) this.fhirApiScopeGrantsStore.delete(grantId);
    }
  }

  async getFhirApiScopeGrants(patientUserId: string): Promise<FhirApiScopeGrant[]> {
    return Array.from(this.fhirApiScopeGrantsStore.values())
      .filter(g => g.patientUserId === patientUserId);
  }

  async getFhirApiScopeGrantsByPartner(partnerId: string): Promise<FhirApiScopeGrant[]> {
    return Array.from(this.fhirApiScopeGrantsStore.values())
      .filter(g => g.partnerId === partnerId);
  }

  async getFhirApiScopeGrantsForPatientAndPartner(patientUserId: string, partnerId: string): Promise<FhirApiScopeGrant[]> {
    return Array.from(this.fhirApiScopeGrantsStore.values())
      .filter(g => g.patientUserId === patientUserId && g.partnerId === partnerId);
  }

  async createFhirApiScopeGrant(grant: InsertFhirApiScopeGrant): Promise<FhirApiScopeGrant> {
    const now = new Date();
    const id = crypto.randomUUID();
    const record: FhirApiScopeGrant = {
      id,
      patientUserId: grant.patientUserId,
      partnerId: grant.partnerId,
      scope: grant.scope,
      granted: grant.granted ?? false,
      grantedAt: grant.granted ? now : null,
      revokedAt: null,
      expiresAt: grant.expiresAt ? new Date(grant.expiresAt) : null,
      createdAt: now,
      updatedAt: now,
    };
    this.fhirApiScopeGrantsStore.set(id, record);
    return record;
  }

  async updateFhirApiScopeGrant(id: string, updates: Partial<FhirApiScopeGrant>): Promise<FhirApiScopeGrant | undefined> {
    const existing = this.fhirApiScopeGrantsStore.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() };
    this.fhirApiScopeGrantsStore.set(id, updated);
    return updated;
  }

  async bulkUpdateFhirApiScopeGrants(patientUserId: string, partnerId: string, scopes: { scope: string; granted: boolean }[]): Promise<FhirApiScopeGrant[]> {
    const existing = await this.getFhirApiScopeGrantsForPatientAndPartner(patientUserId, partnerId);
    const results: FhirApiScopeGrant[] = [];
    const now = new Date();

    for (const { scope, granted } of scopes) {
      const found = existing.find(g => g.scope === scope);
      if (found) {
        const updated = await this.updateFhirApiScopeGrant(found.id, {
          granted,
          grantedAt: granted ? now : found.grantedAt,
          revokedAt: !granted ? now : null,
        });
        if (updated) results.push(updated);
      } else {
        const created = await this.createFhirApiScopeGrant({
          patientUserId,
          partnerId,
          scope,
          granted,
        });
        results.push(created);
      }
    }
    return results;
  }

  async getFhirApiAuditLogs(filters?: { partnerId?: string; patientEmail?: string; action?: string; limit?: number; offset?: number }): Promise<FhirApiAuditLog[]> {
    let items = Array.from(this.fhirApiAuditLogsStore.values());
    if (filters?.partnerId) items = items.filter(l => l.partnerId === filters.partnerId);
    if (filters?.patientEmail) items = items.filter(l => l.patientEmail === filters.patientEmail);
    if (filters?.action) items = items.filter(l => l.action === filters.action);
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    return items.slice(offset, offset + limit);
  }

  async createFhirApiAuditLog(log: InsertFhirApiAuditLog): Promise<FhirApiAuditLog> {
    const id = crypto.randomUUID();
    const record: FhirApiAuditLog = {
      id,
      partnerId: log.partnerId ?? null,
      partnerName: log.partnerName,
      action: log.action,
      resourceType: log.resourceType ?? null,
      patientEmail: log.patientEmail ?? null,
      scopesUsed: log.scopesUsed ?? [],
      statusCode: log.statusCode,
      ipAddress: log.ipAddress ?? null,
      userAgent: log.userAgent ?? null,
      requestPath: log.requestPath,
      responseTimeMs: log.responseTimeMs ?? null,
      errorMessage: log.errorMessage ?? null,
      metadata: log.metadata ?? {},
      createdAt: new Date(),
    };
    this.fhirApiAuditLogsStore.set(id, record);
    return record;
  }

  async getFhirApiAuditStats(): Promise<{ total: number; byPartner: Record<string, number>; byAction: Record<string, number>; byStatusCode: Record<string, number> }> {
    const items = Array.from(this.fhirApiAuditLogsStore.values());
    const byPartner: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byStatusCode: Record<string, number> = {};

    for (const item of items) {
      byPartner[item.partnerName] = (byPartner[item.partnerName] || 0) + 1;
      byAction[item.action] = (byAction[item.action] || 0) + 1;
      const code = String(item.statusCode);
      byStatusCode[code] = (byStatusCode[code] || 0) + 1;
    }

    return { total: items.length, byPartner, byAction, byStatusCode };
  }

  // AI Admin Automation - Provider-Patient Authorization
  async isProviderAuthorizedForPatient(providerUserId: string, patientId: string): Promise<boolean> {
    const authorized = this.providerPatientAuthorizations.get(providerUserId);
    return authorized?.has(patientId) ?? false;
  }

  async authorizeProviderForPatient(providerUserId: string, patientId: string): Promise<void> {
    let authorized = this.providerPatientAuthorizations.get(providerUserId);
    if (!authorized) {
      authorized = new Set<string>();
      this.providerPatientAuthorizations.set(providerUserId, authorized);
    }
    authorized.add(patientId);
  }

  async revokeProviderPatientAuthorization(providerUserId: string, patientId: string): Promise<void> {
    this.providerPatientAuthorizations.get(providerUserId)?.delete(patientId);
  }

  async getAuthorizedPatientsForProvider(providerUserId: string): Promise<string[]> {
    return Array.from(this.providerPatientAuthorizations.get(providerUserId) ?? []);
  }

  // AI Admin Automation - Request Ownership
  async recordAiAdminRequestOwner(requestId: string, ownerUserId: string): Promise<void> {
    this.aiAdminRequestOwners.set(requestId, ownerUserId);
  }

  async isAiAdminRequestOwner(requestId: string, userId: string): Promise<boolean> {
    const owner = this.aiAdminRequestOwners.get(requestId);
    return owner === userId;
  }

  // AI Admin Automation - Rate Limiting (process-shared, window-based)
  async checkAndIncrementAiAdminRateLimit(userId: string, maxRequests: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const entry = this.aiAdminRateLimits.get(userId);
    if (!entry || now > entry.resetAt) {
      this.aiAdminRateLimits.set(userId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxRequests) return false;
    entry.count++;
    return true;
  }
}

export const storage = new MemStorage();
