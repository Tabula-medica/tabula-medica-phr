import { relations } from "drizzle-orm/relations";
import { profiles, medicationsNew, timelineEvents, users, authAnalyticsEvents, accounts, auditLogNew, healthGoals, monitoringAlerts, vitalSigns, caregivers, folders, goalProgress, caregiverAccess, documents, followups, packetExports, shareLinks, symptomEntries, comprehensiveCarePlans, carePlanMonitoringParams, medicationAdherenceLogs, medicationReminders, medicationInteractionFlags, providerMedicationActions, carePlanGoalLinks, carePlanMedicationLinks, carePlanProgressNotes, carePlanStatusHistory, carePlanEducationLinks, engagementPointsLedger, patientOutcomeReports, patientExperienceFeedback, patientSymptomLogs, engagementMessageThreads, engagementMessages, engagementRewards, engagementStreaks, engagementAppointments, engagementAppointmentReminders, featureEntitlements, organizations, subscriptions, invoices, organizationMembers, outcomeTracking, paymentMethods, auditExportRequests, subscriptionPlans, usageMetrics, patientIdentity, matchCandidates, mergeHistory, timelineEventDocuments, tags, timelineEventTags, documentTags, followupTags, symptomEntryTags } from "./schema";

export const medicationsNewRelations = relations(medicationsNew, ({one, many}) => ({
	profile: one(profiles, {
		fields: [medicationsNew.profileId],
		references: [profiles.id]
	}),
	symptomEntries: many(symptomEntries),
	medicationAdherenceLogs: many(medicationAdherenceLogs),
	medicationReminders: many(medicationReminders),
	medicationInteractionFlags_medication1Id: many(medicationInteractionFlags, {
		relationName: "medicationInteractionFlags_medication1Id_medicationsNew_id"
	}),
	medicationInteractionFlags_medication2Id: many(medicationInteractionFlags, {
		relationName: "medicationInteractionFlags_medication2Id_medicationsNew_id"
	}),
	providerMedicationActions: many(providerMedicationActions),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	medicationsNews: many(medicationsNew),
	timelineEvents: many(timelineEvents),
	auditLogNews: many(auditLogNew),
	account: one(accounts, {
		fields: [profiles.accountId],
		references: [accounts.id]
	}),
	healthGoals: many(healthGoals),
	monitoringAlerts: many(monitoringAlerts),
	folders: many(folders),
	caregiverAccesses: many(caregiverAccess),
	documents: many(documents),
	followups: many(followups),
	packetExports: many(packetExports),
	symptomEntries: many(symptomEntries),
	vitalSigns: many(vitalSigns),
	medicationAdherenceLogs: many(medicationAdherenceLogs),
	medicationReminders: many(medicationReminders),
	medicationInteractionFlags: many(medicationInteractionFlags),
	providerMedicationActions: many(providerMedicationActions),
	comprehensiveCarePlans: many(comprehensiveCarePlans),
	engagementPointsLedgers: many(engagementPointsLedger),
	patientExperienceFeedbacks: many(patientExperienceFeedback),
	patientOutcomeReports: many(patientOutcomeReports),
	patientSymptomLogs: many(patientSymptomLogs),
	engagementMessageThreads: many(engagementMessageThreads),
	engagementRewards: many(engagementRewards),
	engagementStreaks: many(engagementStreaks),
	engagementAppointments: many(engagementAppointments),
	engagementAppointmentReminders: many(engagementAppointmentReminders),
	patientIdentities: many(patientIdentity),
}));

export const timelineEventsRelations = relations(timelineEvents, ({one, many}) => ({
	profile: one(profiles, {
		fields: [timelineEvents.profileId],
		references: [profiles.id]
	}),
	timelineEventDocuments: many(timelineEventDocuments),
	timelineEventTags: many(timelineEventTags),
}));

export const authAnalyticsEventsRelations = relations(authAnalyticsEvents, ({one}) => ({
	user: one(users, {
		fields: [authAnalyticsEvents.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	authAnalyticsEvents: many(authAnalyticsEvents),
	caregivers_caregiverUserId: many(caregivers, {
		relationName: "caregivers_caregiverUserId_users_id"
	}),
	caregivers_patientUserId: many(caregivers, {
		relationName: "caregivers_patientUserId_users_id"
	}),
}));

export const auditLogNewRelations = relations(auditLogNew, ({one}) => ({
	account: one(accounts, {
		fields: [auditLogNew.accountId],
		references: [accounts.id]
	}),
	profile: one(profiles, {
		fields: [auditLogNew.profileId],
		references: [profiles.id]
	}),
}));

export const accountsRelations = relations(accounts, ({many}) => ({
	auditLogNews: many(auditLogNew),
	profiles: many(profiles),
	caregiverAccesses: many(caregiverAccess),
	packetExports: many(packetExports),
	featureEntitlements: many(featureEntitlements),
	invoices: many(invoices),
	organizationMembers_accountId: many(organizationMembers, {
		relationName: "organizationMembers_accountId_accounts_id"
	}),
	organizationMembers_invitedBy: many(organizationMembers, {
		relationName: "organizationMembers_invitedBy_accounts_id"
	}),
	paymentMethods: many(paymentMethods),
	auditExportRequests: many(auditExportRequests),
	subscriptions: many(subscriptions),
}));

export const healthGoalsRelations = relations(healthGoals, ({one, many}) => ({
	profile: one(profiles, {
		fields: [healthGoals.profileId],
		references: [profiles.id]
	}),
	goalProgresses: many(goalProgress),
	carePlanGoalLinks: many(carePlanGoalLinks),
}));

export const monitoringAlertsRelations = relations(monitoringAlerts, ({one}) => ({
	profile: one(profiles, {
		fields: [monitoringAlerts.profileId],
		references: [profiles.id]
	}),
	vitalSign: one(vitalSigns, {
		fields: [monitoringAlerts.vitalSignId],
		references: [vitalSigns.id]
	}),
}));

export const vitalSignsRelations = relations(vitalSigns, ({one, many}) => ({
	monitoringAlerts: many(monitoringAlerts),
	profile: one(profiles, {
		fields: [vitalSigns.profileId],
		references: [profiles.id]
	}),
}));

export const caregiversRelations = relations(caregivers, ({one}) => ({
	user_caregiverUserId: one(users, {
		fields: [caregivers.caregiverUserId],
		references: [users.id],
		relationName: "caregivers_caregiverUserId_users_id"
	}),
	user_patientUserId: one(users, {
		fields: [caregivers.patientUserId],
		references: [users.id],
		relationName: "caregivers_patientUserId_users_id"
	}),
}));

export const foldersRelations = relations(folders, ({one, many}) => ({
	folder: one(folders, {
		fields: [folders.parentId],
		references: [folders.id],
		relationName: "folders_parentId_folders_id"
	}),
	folders: many(folders, {
		relationName: "folders_parentId_folders_id"
	}),
	profile: one(profiles, {
		fields: [folders.profileId],
		references: [profiles.id]
	}),
	documents: many(documents),
}));

export const goalProgressRelations = relations(goalProgress, ({one}) => ({
	healthGoal: one(healthGoals, {
		fields: [goalProgress.goalId],
		references: [healthGoals.id]
	}),
}));

export const caregiverAccessRelations = relations(caregiverAccess, ({one}) => ({
	account: one(accounts, {
		fields: [caregiverAccess.caregiverAccountId],
		references: [accounts.id]
	}),
	profile: one(profiles, {
		fields: [caregiverAccess.profileId],
		references: [profiles.id]
	}),
}));

export const documentsRelations = relations(documents, ({one, many}) => ({
	folder: one(folders, {
		fields: [documents.folderId],
		references: [folders.id]
	}),
	profile: one(profiles, {
		fields: [documents.profileId],
		references: [profiles.id]
	}),
	timelineEventDocuments: many(timelineEventDocuments),
	documentTags: many(documentTags),
}));

export const followupsRelations = relations(followups, ({one, many}) => ({
	profile: one(profiles, {
		fields: [followups.profileId],
		references: [profiles.id]
	}),
	followupTags: many(followupTags),
}));

export const shareLinksRelations = relations(shareLinks, ({one}) => ({
	packetExport: one(packetExports, {
		fields: [shareLinks.packetExportId],
		references: [packetExports.id]
	}),
}));

export const packetExportsRelations = relations(packetExports, ({one, many}) => ({
	shareLinks: many(shareLinks),
	account: one(accounts, {
		fields: [packetExports.createdByAccountId],
		references: [accounts.id]
	}),
	profile: one(profiles, {
		fields: [packetExports.profileId],
		references: [profiles.id]
	}),
}));

export const symptomEntriesRelations = relations(symptomEntries, ({one, many}) => ({
	medicationsNew: one(medicationsNew, {
		fields: [symptomEntries.medicationId],
		references: [medicationsNew.id]
	}),
	profile: one(profiles, {
		fields: [symptomEntries.profileId],
		references: [profiles.id]
	}),
	symptomEntryTags: many(symptomEntryTags),
}));

export const carePlanMonitoringParamsRelations = relations(carePlanMonitoringParams, ({one}) => ({
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [carePlanMonitoringParams.carePlanId],
		references: [comprehensiveCarePlans.id]
	}),
}));

export const comprehensiveCarePlansRelations = relations(comprehensiveCarePlans, ({one, many}) => ({
	carePlanMonitoringParams: many(carePlanMonitoringParams),
	carePlanGoalLinks: many(carePlanGoalLinks),
	carePlanMedicationLinks: many(carePlanMedicationLinks),
	carePlanProgressNotes: many(carePlanProgressNotes),
	carePlanStatusHistories: many(carePlanStatusHistory),
	carePlanEducationLinks: many(carePlanEducationLinks),
	profile: one(profiles, {
		fields: [comprehensiveCarePlans.profileId],
		references: [profiles.id]
	}),
	patientOutcomeReports: many(patientOutcomeReports),
}));

export const medicationAdherenceLogsRelations = relations(medicationAdherenceLogs, ({one}) => ({
	medicationsNew: one(medicationsNew, {
		fields: [medicationAdherenceLogs.medicationId],
		references: [medicationsNew.id]
	}),
	profile: one(profiles, {
		fields: [medicationAdherenceLogs.profileId],
		references: [profiles.id]
	}),
	medicationReminder: one(medicationReminders, {
		fields: [medicationAdherenceLogs.reminderId],
		references: [medicationReminders.id]
	}),
}));

export const medicationRemindersRelations = relations(medicationReminders, ({one, many}) => ({
	medicationAdherenceLogs: many(medicationAdherenceLogs),
	medicationsNew: one(medicationsNew, {
		fields: [medicationReminders.medicationId],
		references: [medicationsNew.id]
	}),
	profile: one(profiles, {
		fields: [medicationReminders.profileId],
		references: [profiles.id]
	}),
	carePlanMedicationLinks: many(carePlanMedicationLinks),
}));

export const medicationInteractionFlagsRelations = relations(medicationInteractionFlags, ({one}) => ({
	medicationsNew_medication1Id: one(medicationsNew, {
		fields: [medicationInteractionFlags.medication1Id],
		references: [medicationsNew.id],
		relationName: "medicationInteractionFlags_medication1Id_medicationsNew_id"
	}),
	medicationsNew_medication2Id: one(medicationsNew, {
		fields: [medicationInteractionFlags.medication2Id],
		references: [medicationsNew.id],
		relationName: "medicationInteractionFlags_medication2Id_medicationsNew_id"
	}),
	profile: one(profiles, {
		fields: [medicationInteractionFlags.profileId],
		references: [profiles.id]
	}),
}));

export const providerMedicationActionsRelations = relations(providerMedicationActions, ({one}) => ({
	medicationsNew: one(medicationsNew, {
		fields: [providerMedicationActions.medicationId],
		references: [medicationsNew.id]
	}),
	profile: one(profiles, {
		fields: [providerMedicationActions.profileId],
		references: [profiles.id]
	}),
}));

export const carePlanGoalLinksRelations = relations(carePlanGoalLinks, ({one}) => ({
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [carePlanGoalLinks.carePlanId],
		references: [comprehensiveCarePlans.id]
	}),
	healthGoal: one(healthGoals, {
		fields: [carePlanGoalLinks.healthGoalId],
		references: [healthGoals.id]
	}),
}));

export const carePlanMedicationLinksRelations = relations(carePlanMedicationLinks, ({one}) => ({
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [carePlanMedicationLinks.carePlanId],
		references: [comprehensiveCarePlans.id]
	}),
	medicationReminder: one(medicationReminders, {
		fields: [carePlanMedicationLinks.medicationReminderId],
		references: [medicationReminders.id]
	}),
}));

export const carePlanProgressNotesRelations = relations(carePlanProgressNotes, ({one}) => ({
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [carePlanProgressNotes.carePlanId],
		references: [comprehensiveCarePlans.id]
	}),
}));

export const carePlanStatusHistoryRelations = relations(carePlanStatusHistory, ({one}) => ({
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [carePlanStatusHistory.carePlanId],
		references: [comprehensiveCarePlans.id]
	}),
}));

export const carePlanEducationLinksRelations = relations(carePlanEducationLinks, ({one}) => ({
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [carePlanEducationLinks.carePlanId],
		references: [comprehensiveCarePlans.id]
	}),
}));

export const engagementPointsLedgerRelations = relations(engagementPointsLedger, ({one}) => ({
	profile: one(profiles, {
		fields: [engagementPointsLedger.patientProfileId],
		references: [profiles.id]
	}),
}));

export const patientExperienceFeedbackRelations = relations(patientExperienceFeedback, ({one}) => ({
	patientOutcomeReport: one(patientOutcomeReports, {
		fields: [patientExperienceFeedback.outcomeReportId],
		references: [patientOutcomeReports.id]
	}),
	profile: one(profiles, {
		fields: [patientExperienceFeedback.profileId],
		references: [profiles.id]
	}),
}));

export const patientOutcomeReportsRelations = relations(patientOutcomeReports, ({one, many}) => ({
	patientExperienceFeedbacks: many(patientExperienceFeedback),
	profile: one(profiles, {
		fields: [patientOutcomeReports.profileId],
		references: [profiles.id]
	}),
	comprehensiveCarePlan: one(comprehensiveCarePlans, {
		fields: [patientOutcomeReports.relatedCarePlanId],
		references: [comprehensiveCarePlans.id]
	}),
	patientSymptomLogs: many(patientSymptomLogs),
}));

export const patientSymptomLogsRelations = relations(patientSymptomLogs, ({one}) => ({
	patientOutcomeReport: one(patientOutcomeReports, {
		fields: [patientSymptomLogs.outcomeReportId],
		references: [patientOutcomeReports.id]
	}),
	profile: one(profiles, {
		fields: [patientSymptomLogs.profileId],
		references: [profiles.id]
	}),
}));

export const engagementMessageThreadsRelations = relations(engagementMessageThreads, ({one, many}) => ({
	profile: one(profiles, {
		fields: [engagementMessageThreads.patientProfileId],
		references: [profiles.id]
	}),
	engagementMessages: many(engagementMessages),
}));

export const engagementMessagesRelations = relations(engagementMessages, ({one}) => ({
	engagementMessageThread: one(engagementMessageThreads, {
		fields: [engagementMessages.threadId],
		references: [engagementMessageThreads.id]
	}),
}));

export const engagementRewardsRelations = relations(engagementRewards, ({one}) => ({
	profile: one(profiles, {
		fields: [engagementRewards.patientProfileId],
		references: [profiles.id]
	}),
}));

export const engagementStreaksRelations = relations(engagementStreaks, ({one}) => ({
	profile: one(profiles, {
		fields: [engagementStreaks.patientProfileId],
		references: [profiles.id]
	}),
}));

export const engagementAppointmentsRelations = relations(engagementAppointments, ({one, many}) => ({
	profile: one(profiles, {
		fields: [engagementAppointments.patientProfileId],
		references: [profiles.id]
	}),
	engagementAppointmentReminders: many(engagementAppointmentReminders),
}));

export const engagementAppointmentRemindersRelations = relations(engagementAppointmentReminders, ({one}) => ({
	engagementAppointment: one(engagementAppointments, {
		fields: [engagementAppointmentReminders.appointmentId],
		references: [engagementAppointments.id]
	}),
	profile: one(profiles, {
		fields: [engagementAppointmentReminders.patientProfileId],
		references: [profiles.id]
	}),
}));

export const featureEntitlementsRelations = relations(featureEntitlements, ({one}) => ({
	account: one(accounts, {
		fields: [featureEntitlements.accountId],
		references: [accounts.id]
	}),
	organization: one(organizations, {
		fields: [featureEntitlements.organizationId],
		references: [organizations.id]
	}),
	subscription: one(subscriptions, {
		fields: [featureEntitlements.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	featureEntitlements: many(featureEntitlements),
	invoices: many(invoices),
	organizationMembers: many(organizationMembers),
	outcomeTrackings: many(outcomeTracking),
	paymentMethods: many(paymentMethods),
	auditExportRequests: many(auditExportRequests),
	subscriptions: many(subscriptions),
	usageMetrics: many(usageMetrics),
}));

export const subscriptionsRelations = relations(subscriptions, ({one, many}) => ({
	featureEntitlements: many(featureEntitlements),
	invoices: many(invoices),
	outcomeTrackings: many(outcomeTracking),
	account: one(accounts, {
		fields: [subscriptions.accountId],
		references: [accounts.id]
	}),
	organization: one(organizations, {
		fields: [subscriptions.organizationId],
		references: [organizations.id]
	}),
	subscriptionPlan: one(subscriptionPlans, {
		fields: [subscriptions.planId],
		references: [subscriptionPlans.id]
	}),
	usageMetrics: many(usageMetrics),
}));

export const invoicesRelations = relations(invoices, ({one}) => ({
	account: one(accounts, {
		fields: [invoices.accountId],
		references: [accounts.id]
	}),
	organization: one(organizations, {
		fields: [invoices.organizationId],
		references: [organizations.id]
	}),
	subscription: one(subscriptions, {
		fields: [invoices.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const organizationMembersRelations = relations(organizationMembers, ({one}) => ({
	account_accountId: one(accounts, {
		fields: [organizationMembers.accountId],
		references: [accounts.id],
		relationName: "organizationMembers_accountId_accounts_id"
	}),
	account_invitedBy: one(accounts, {
		fields: [organizationMembers.invitedBy],
		references: [accounts.id],
		relationName: "organizationMembers_invitedBy_accounts_id"
	}),
	organization: one(organizations, {
		fields: [organizationMembers.organizationId],
		references: [organizations.id]
	}),
}));

export const outcomeTrackingRelations = relations(outcomeTracking, ({one}) => ({
	organization: one(organizations, {
		fields: [outcomeTracking.organizationId],
		references: [organizations.id]
	}),
	subscription: one(subscriptions, {
		fields: [outcomeTracking.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const paymentMethodsRelations = relations(paymentMethods, ({one}) => ({
	account: one(accounts, {
		fields: [paymentMethods.accountId],
		references: [accounts.id]
	}),
	organization: one(organizations, {
		fields: [paymentMethods.organizationId],
		references: [organizations.id]
	}),
}));

export const auditExportRequestsRelations = relations(auditExportRequests, ({one}) => ({
	organization: one(organizations, {
		fields: [auditExportRequests.organizationId],
		references: [organizations.id]
	}),
	account: one(accounts, {
		fields: [auditExportRequests.requestedBy],
		references: [accounts.id]
	}),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({many}) => ({
	subscriptions: many(subscriptions),
}));

export const usageMetricsRelations = relations(usageMetrics, ({one}) => ({
	organization: one(organizations, {
		fields: [usageMetrics.organizationId],
		references: [organizations.id]
	}),
	subscription: one(subscriptions, {
		fields: [usageMetrics.subscriptionId],
		references: [subscriptions.id]
	}),
}));

export const matchCandidatesRelations = relations(matchCandidates, ({one}) => ({
	patientIdentity_candidatePatientId: one(patientIdentity, {
		fields: [matchCandidates.candidatePatientId],
		references: [patientIdentity.id],
		relationName: "matchCandidates_candidatePatientId_patientIdentity_id"
	}),
	patientIdentity_sourcePatientId: one(patientIdentity, {
		fields: [matchCandidates.sourcePatientId],
		references: [patientIdentity.id],
		relationName: "matchCandidates_sourcePatientId_patientIdentity_id"
	}),
}));

export const patientIdentityRelations = relations(patientIdentity, ({one, many}) => ({
	matchCandidates_candidatePatientId: many(matchCandidates, {
		relationName: "matchCandidates_candidatePatientId_patientIdentity_id"
	}),
	matchCandidates_sourcePatientId: many(matchCandidates, {
		relationName: "matchCandidates_sourcePatientId_patientIdentity_id"
	}),
	mergeHistories: many(mergeHistory),
	profile: one(profiles, {
		fields: [patientIdentity.profileId],
		references: [profiles.id]
	}),
}));

export const mergeHistoryRelations = relations(mergeHistory, ({one}) => ({
	patientIdentity: one(patientIdentity, {
		fields: [mergeHistory.survivingPatientId],
		references: [patientIdentity.id]
	}),
}));

export const timelineEventDocumentsRelations = relations(timelineEventDocuments, ({one}) => ({
	document: one(documents, {
		fields: [timelineEventDocuments.documentId],
		references: [documents.id]
	}),
	timelineEvent: one(timelineEvents, {
		fields: [timelineEventDocuments.timelineEventId],
		references: [timelineEvents.id]
	}),
}));

export const timelineEventTagsRelations = relations(timelineEventTags, ({one}) => ({
	tag: one(tags, {
		fields: [timelineEventTags.tagId],
		references: [tags.id]
	}),
	timelineEvent: one(timelineEvents, {
		fields: [timelineEventTags.timelineEventId],
		references: [timelineEvents.id]
	}),
}));

export const tagsRelations = relations(tags, ({many}) => ({
	timelineEventTags: many(timelineEventTags),
	documentTags: many(documentTags),
	followupTags: many(followupTags),
	symptomEntryTags: many(symptomEntryTags),
}));

export const documentTagsRelations = relations(documentTags, ({one}) => ({
	document: one(documents, {
		fields: [documentTags.documentId],
		references: [documents.id]
	}),
	tag: one(tags, {
		fields: [documentTags.tagId],
		references: [tags.id]
	}),
}));

export const followupTagsRelations = relations(followupTags, ({one}) => ({
	followup: one(followups, {
		fields: [followupTags.followupId],
		references: [followups.id]
	}),
	tag: one(tags, {
		fields: [followupTags.tagId],
		references: [tags.id]
	}),
}));

export const symptomEntryTagsRelations = relations(symptomEntryTags, ({one}) => ({
	symptomEntry: one(symptomEntries, {
		fields: [symptomEntryTags.symptomEntryId],
		references: [symptomEntries.id]
	}),
	tag: one(tags, {
		fields: [symptomEntryTags.tagId],
		references: [tags.id]
	}),
}));