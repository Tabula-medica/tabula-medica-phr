import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ProfileScreen from "@/screens/ProfileScreen";
import ShareScreen from "@/screens/ShareScreen";
import PacketExportScreen from "@/screens/PacketExportScreen";
import MonitoringDashboardScreen from "@/screens/MonitoringDashboardScreen";
import DataQualityScreen from "@/screens/DataQualityScreen";
import SmartAppsScreen from "@/screens/SmartAppsScreen";
import SmartAppRegisterScreen from "@/screens/SmartAppRegisterScreen";
import SmartAppDetailScreen from "@/screens/SmartAppDetailScreen";
import SmartAppLaunchScreen from "@/screens/SmartAppLaunchScreen";
import AnalyticsDashboardScreen from "@/screens/AnalyticsDashboardScreen";
import NaturalLanguageQueryScreen from "@/screens/NaturalLanguageQueryScreen";
import ConsentManagementScreen from "@/screens/ConsentManagementScreen";
import RoleManagementScreen from "@/screens/RoleManagementScreen";
import AdvancedFHIRSearchScreen from "@/screens/AdvancedFHIRSearchScreen";
import InteroperabilityScreen from "@/screens/InteroperabilityScreen";
import PatientProfileScreen from "@/screens/PatientProfileScreen";
import HealthGoalsScreen from "@/screens/HealthGoalsScreen";
import GoalDetailScreen from "@/screens/GoalDetailScreen";
import FHIRConnectionScreen from "@/screens/FHIRConnectionScreen";
import FHIRMappingScreen from "@/screens/FHIRMappingScreen";
import FHIRResourceConfigScreen from "@/screens/FHIRResourceConfigScreen";
import GamificationScreen from "@/screens/GamificationScreen";
import WorkflowAutomationScreen from "@/screens/WorkflowAutomationScreen";
import DeviceManagementScreen from "@/screens/DeviceManagementScreen";
import RealTimeSensorScreen from "@/screens/RealTimeSensorScreen";
import ProviderCollaborationScreen from "@/screens/ProviderCollaborationScreen";
import DedupCenterScreen from "@/screens/DedupCenterScreen";
import TrustScreen from "@/screens/TrustScreen";
import TeamChallengesScreen from "@/screens/TeamChallengesScreen";
import CarePathwaysScreen from "@/screens/CarePathwaysScreen";
import PathwayDetailScreen from "@/screens/PathwayDetailScreen";
import ProviderDashboardScreen from "@/screens/ProviderDashboardScreen";
import ClinicalDocumentationScreen from "@/screens/ClinicalDocumentationScreen";
import EducationHubScreen from "@/screens/EducationHubScreen";
import ArticleDetailScreen from "@/screens/ArticleDetailScreen";
import QuizScreen from "@/screens/QuizScreen";
import HealthDashboardScreen from "@/screens/HealthDashboardScreen";
import AuditLogScreen from "@/screens/AuditLogScreen";
import QRShareScreen from "@/screens/QRShareScreen";
import CareTeamScreen from "@/screens/CareTeamScreen";
import AcoReportingScreen from "@/screens/AcoReportingScreen";
import SafetyAlertsScreen from "@/screens/SafetyAlertsScreen";
import ComplianceAlertsScreen from "@/screens/ComplianceAlertsScreen";
import DuplicateFlagsScreen from "@/screens/DuplicateFlagsScreen";
import SecureMessagingScreen from "@/screens/SecureMessagingScreen";
import SMSMessageScreen from "@/screens/SMSMessageScreen";
import EnterpriseIntegrationsScreen from "@/screens/EnterpriseIntegrationsScreen";
import HealthGraphExplorerScreen from "@/screens/HealthGraphExplorerScreen";
import IntakeHistoryScreen from "@/screens/IntakeHistoryScreen";
import ConsolidatedPHRScreen from "@/screens/ConsolidatedPHRScreen";
import MedicationAdherenceScreen from "@/screens/MedicationAdherenceScreen";
import HealthJournalScreen from "@/screens/HealthJournalScreen";
import TelehealthScreen from "@/screens/TelehealthScreen";
import ReminderSettingsScreen from "@/screens/ReminderSettingsScreen";
import PrivacyPracticesScreen from "@/screens/PrivacyPracticesScreen";
import DataAccessRequestScreen from "@/screens/DataAccessRequestScreen";
import ClinicalDecisionSupportScreen from "@/screens/ClinicalDecisionSupportScreen";
import LabOrderingScreen from "@/screens/LabOrderingScreen";
import AppointmentSchedulingScreen from "@/screens/AppointmentSchedulingScreen";
import PatientPortalScreen from "@/screens/PatientPortalScreen";
import LabResultsScreen from "@/screens/LabResultsScreen";
import PatientIntakeScreen from "@/screens/PatientIntakeScreen";
import AIHistoryAssistantScreen from "@/screens/AIHistoryAssistantScreen";
import ScanPaperRecordScreen from "@/screens/ScanPaperRecordScreen";
import ProviderTasksScreen from "@/screens/ProviderTasksScreen";
import ClinicalWorkflowScreen from "@/screens/ClinicalWorkflowScreen";
import PatientChartIntelligenceScreen from "@/screens/PatientChartIntelligenceScreen";
import VitalChartsScreen from "@/screens/VitalChartsScreen";
import PrenatalGuidelinesScreen from "@/screens/PrenatalGuidelinesScreen";
import NewbornScreeningScreen from "@/screens/NewbornScreeningScreen";
import DocumentGenerationScreen from "@/screens/DocumentGenerationScreen";
import ProviderAIWorkflowScreen from "@/screens/ProviderAIWorkflowScreen";
import AISOAPNoteScreen from "@/screens/AISOAPNoteScreen";
import AutomatedDataEntryScreen from "@/screens/AutomatedDataEntryScreen";
import AIDocumentReviewScreen from "@/screens/AIDocumentReviewScreen";
import TEFCAHubScreen from "@/screens/TEFCAHubScreen";
import TEFCAPartnerManagementScreen from "@/screens/TEFCAPartnerManagementScreen";
import FhirApiScreen from "@/screens/FhirApiScreen";
import ConnectHealthRecordsScreen from "@/screens/ConnectHealthRecordsScreen";
import UserSettingsScreen from "@/screens/UserSettingsScreen";
import FHIRPatientSearchScreen from "@/screens/FHIRPatientSearchScreen";
import AmbientEncounterScreen from "@/screens/AmbientEncounterScreen";
import PetCareScreen from "@/screens/PetCareScreen";
import PetDetailScreen from "@/screens/PetDetailScreen";
import AddPetScreen from "@/screens/AddPetScreen";
import AddPetRecordScreen from "@/screens/AddPetRecordScreen";
import PetRegistryScreen from "@/screens/PetRegistryScreen";
import SavingsHubScreen from "@/screens/SavingsHubScreen";
import CommunityScreen from "@/screens/CommunityScreen";
import WomensHealthScreen from "@/screens/WomensHealthScreen";
import DermatologyScreen from "@/screens/DermatologyScreen";
import GeneticScreeningScreen from "@/screens/GeneticScreeningScreen";
import ASCVDCalculatorScreen from "@/screens/ASCVDCalculatorScreen";
import AnnualReviewScreen from "@/screens/AnnualReviewScreen";
import PreVisitSummaryScreen from "@/screens/PreVisitSummaryScreen";
import PostVisitSummaryScreen from "@/screens/PostVisitSummaryScreen";
import UnifiedHealthSummaryScreen from "@/screens/UnifiedHealthSummaryScreen";
import PreventiveCareScreen from "@/screens/PreventiveCareScreen";
import FamilyHubScreen from "@/screens/FamilyHubScreen";
import EnterprisePlatformAnalyticsScreen from "@/screens/EnterprisePlatformAnalyticsScreen";
import InsuranceClaimsEOBScreen from "@/screens/InsuranceClaimsEOBScreen";
import FertilityCycleDashboardScreen from "@/screens/FertilityCycleDashboardScreen";
import MenopausalResilienceScreen from "@/screens/MenopausalResilienceScreen";
import ClinicalAiAuditScreen from "@/screens/ClinicalAiAuditScreen";
import SmartNpiLookupScreen from "@/screens/SmartNpiLookupScreen";
import BaaAgreementsScreen from "@/screens/BaaAgreementsScreen";
import ComplianceExportScreen from "@/screens/ComplianceExportScreen";
import NetworkHealthScreen from "@/screens/NetworkHealthScreen";
import FhirViewerScreen from "@/screens/FhirViewerScreen";
import Soc2ComplianceDashboard from "@/screens/Soc2ComplianceDashboard";
import FhirDataHubScreen from "@/screens/FhirDataHubScreen";
import AdminAuditVisualizationScreen from "@/screens/AdminAuditVisualizationScreen";
import InsuranceLearningScreen from "@/screens/InsuranceLearningScreen";
import UninsuredPlatformScreen from "@/screens/UninsuredPlatformScreen";
import RateCalculatorScreen from "@/screens/RateCalculatorScreen";
import ProviderSearchScreen from "@/screens/ProviderSearchScreen";
import BookingScreen from "@/screens/BookingScreen";
import VAVerificationScreen from "@/screens/VAVerificationScreen";
import CareAccessScreen from "@/screens/CareAccessScreen";
import PriorAuthScreen from "@/screens/PriorAuthScreen";
import DrugInteractionsScreen from "@/screens/DrugInteractionsScreen";
import CareGapsScreen from "@/screens/CareGapsScreen";
import OpenDentalScreen from "@/screens/OpenDentalScreen";
import DentrixScreen from "@/screens/DentrixScreen";
import EaglesoftScreen from "@/screens/EaglesoftScreen";
import VertexSearchScreen from "@/screens/VertexSearchScreen";
import CardScanScreen from "@/screens/CardScanScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import ROITrackerScreen from "@/screens/ROITrackerScreen";
import DocumentVerificationScreen from "@/screens/DocumentVerificationScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import DicomViewerScreen from "@/screens/DicomViewerScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
  PatientProfile: undefined;
  HealthGoals: undefined;
  GoalDetail: { goalId: string };
  FHIRConnections: undefined;
  FHIRMapping: { sourceId?: string };
  FHIRResourceConfig: { sourceId: string; sourceName: string };
  Gamification: undefined;
  Share: undefined;
  PacketExport: undefined;
  MonitoringDashboard: undefined;
  DataQuality: undefined;
  SmartApps: undefined;
  SmartAppRegister: undefined;
  SmartAppDetail: { appId: string };
  SmartAppLaunch: { appId: string };
  AnalyticsDashboard: undefined;
  NaturalLanguageQuery: undefined;
  ConsentManagement: undefined;
  RoleManagement: undefined;
  AdvancedFHIRSearch: undefined;
  Interoperability: undefined;
  WorkflowAutomation: undefined;

  DeviceManagement: undefined;
  RealTimeSensor: { deviceId?: string; deviceName?: string };
  ProviderCollaboration: undefined;
  DedupCenter: undefined;
  Trust: undefined;
  TeamChallenges: undefined;
  CarePathways: undefined;
  PathwayDetail: { assignmentId: string };
  ProviderDashboard: undefined;
  ClinicalDocumentation: undefined;
  EducationHub: undefined;

  ArticleDetail: { articleId: string };
  QuizScreen: { quizId: string };
  HealthDashboard: undefined;
  AuditLog: undefined;
  QRShare: undefined;
  CareTeam: undefined;
  AcoReporting: undefined;
  SafetyAlerts: undefined;
  ComplianceAlerts: undefined;
  DuplicateFlags: undefined;
  SecureMessaging: undefined;
  SMSMessage: undefined;
  EnterpriseIntegrations: undefined;
  HealthGraphExplorer: undefined;
  IntakeHistory: undefined;
  ConsolidatedPHR: undefined;
  MedicationAdherence: undefined;
  HealthJournal: undefined;
  Telehealth: undefined;
  ReminderSettings: undefined;
  PrivacyPractices: undefined;
  DataAccessRequest: undefined;
  ClinicalDecisionSupport: undefined;
  LabOrdering: undefined;
  AppointmentScheduling: undefined;
  PatientPortal: undefined;
  LabResults: undefined;
  PatientIntake: undefined;
  ProviderTasks: undefined;
  ClinicalWorkflow: undefined;
  PatientChartIntelligence: undefined;
  VitalCharts: undefined;
  PrenatalGuidelines: undefined;
  NewbornScreening: undefined;
  AIHistoryAssistant: undefined;
  ScanPaperRecord: undefined;
  DocumentGeneration: undefined;
  ProviderAIWorkflow: undefined;
  AISOAPNote: undefined;
  AutomatedDataEntry: undefined;
  AIDocumentReview: { noteId: string };
  TEFCAHub: undefined;
  TEFCAPartnerManagement: undefined;
  ConnectHealthRecords: { reconnectSource?: string } | undefined;
  FhirApi: undefined;
  DicomViewer: { studyInstanceUID: string; studyDescription?: string; modality?: string; studyDate?: string; patientId?: string };
  FHIRPatientSearch: undefined;
  AmbientEncounter: undefined;
  UserSettings: undefined;
  PetCare: undefined;
  PetDetail: { petId: string };
  AddPet: { petId?: string };
  AddPetRecord: { petId: string };
  PetRegistry: { petId: string };
  SavingsHub: undefined;
  Community: undefined;
  WomensHealth: undefined;
  Dermatology: undefined;
  GeneticScreening: undefined;
  ASCVDCalculator: undefined;
  AnnualReview: undefined;
  PreVisitSummary: undefined;
  PostVisitSummary: undefined;
  UnifiedHealthSummary: undefined;
  PreventiveCare: undefined;
  FamilyHub: undefined;
  EnterprisePlatformAnalytics: undefined;
  InsuranceClaimsEOB: undefined;
  FertilityCycleDashboard: undefined;
  MenopausalResilience: undefined;
  ClinicalAiAudit: undefined;
  BaaAgreements: undefined;
  ComplianceExport: undefined;
  NetworkHealth: undefined;
  FhirViewer: undefined;
  Soc2Compliance: undefined;
  AdminAuditVisualization: undefined;
  InsuranceLearning: undefined;
  UninsuredPlatform: undefined;
  RateCalculator: undefined;
  ProviderSearch: undefined;
  Booking: undefined;
  VAVerification: undefined;
  CareAccess: undefined;
  PriorAuth: undefined;
  DrugInteractions: undefined;
  CareGaps: undefined;
  OpenDental: undefined;
  Dentrix: undefined;
  Eaglesoft: undefined;
  VertexSearch: undefined;
  SmartNpiLookup: undefined;
  FhirDataHub: undefined;
  CardScan: undefined;
  Subscription: undefined;
  ROITracker: undefined;
  DocumentVerification: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

interface ScreenRegistration {
  name: keyof ProfileStackParamList;
  component: React.ComponentType<any>;
  title: string;
  options?: object;
}

const PROFILE_SCREENS: ScreenRegistration[] = [
  { name: "Profile", component: ProfileScreen, title: "Profile" },
  { name: "PatientProfile", component: PatientProfileScreen, title: "My Profile" },
  { name: "HealthGoals", component: HealthGoalsScreen, title: "Health Goals" },
  { name: "GoalDetail", component: GoalDetailScreen, title: "Goal Details" },
  { name: "FHIRConnections", component: FHIRConnectionScreen, title: "FHIR Connections" },
  { name: "Gamification", component: GamificationScreen, title: "Achievements" },
  { name: "FHIRMapping", component: FHIRMappingScreen, title: "Data Mapping" },
  { name: "FHIRResourceConfig", component: FHIRResourceConfigScreen, title: "Resource Configuration" },
  { name: "Share", component: ShareScreen, title: "Share Records" },
  { name: "PacketExport", component: PacketExportScreen, title: "Export Health Packet" },
  { name: "MonitoringDashboard", component: MonitoringDashboardScreen, title: "FHIR Monitoring" },
  { name: "DataQuality", component: DataQualityScreen, title: "Data Quality" },
  { name: "SmartApps", component: SmartAppsScreen, title: "SMART Apps" },
  { name: "SmartAppRegister", component: SmartAppRegisterScreen, title: "Register App" },
  { name: "SmartAppDetail", component: SmartAppDetailScreen, title: "App Details" },
  { name: "SmartAppLaunch", component: SmartAppLaunchScreen, title: "Launch App", options: { presentation: "modal" } },
  { name: "AnalyticsDashboard", component: AnalyticsDashboardScreen, title: "AI Analytics" },
  { name: "NaturalLanguageQuery", component: NaturalLanguageQueryScreen, title: "Ask About Health" },
  { name: "ConsentManagement", component: ConsentManagementScreen, title: "Data Permissions" },
  { name: "RoleManagement", component: RoleManagementScreen, title: "Role Management" },
  { name: "AdvancedFHIRSearch", component: AdvancedFHIRSearchScreen, title: "Advanced Search" },
  { name: "Interoperability", component: InteroperabilityScreen, title: "Interoperability" },
  { name: "WorkflowAutomation", component: WorkflowAutomationScreen, title: "Workflow Automation" },
  { name: "DeviceManagement", component: DeviceManagementScreen, title: "Connected Devices" },
  { name: "RealTimeSensor", component: RealTimeSensorScreen, title: "Sensor Data" },
  { name: "ProviderCollaboration", component: ProviderCollaborationScreen, title: "Provider Tools" },
  { name: "DedupCenter", component: DedupCenterScreen, title: "Dedup Center" },
  { name: "Trust", component: TrustScreen, title: "Trust & Security" },
  { name: "TeamChallenges", component: TeamChallengesScreen, title: "Team Challenges" },
  { name: "CarePathways", component: CarePathwaysScreen, title: "Care Pathways" },
  { name: "PathwayDetail", component: PathwayDetailScreen, title: "Pathway Details" },
  { name: "ProviderDashboard", component: ProviderDashboardScreen, title: "Provider Dashboard" },
  { name: "ClinicalDocumentation", component: ClinicalDocumentationScreen, title: "Clinical Documentation" },
  { name: "EducationHub", component: EducationHubScreen, title: "Learning Center" },
  { name: "ArticleDetail", component: ArticleDetailScreen, title: "Article" },
  { name: "QuizScreen", component: QuizScreen, title: "Quiz" },
  { name: "HealthDashboard", component: HealthDashboardScreen, title: "Health Dashboard" },
  { name: "AuditLog", component: AuditLogScreen, title: "Audit Log" },
  { name: "QRShare", component: QRShareScreen, title: "QR Share" },
  { name: "CareTeam", component: CareTeamScreen, title: "Care Team" },
  { name: "AcoReporting", component: AcoReportingScreen, title: "ACO Reporting" },
  { name: "SafetyAlerts", component: SafetyAlertsScreen, title: "Health Alerts" },
  { name: "ComplianceAlerts", component: ComplianceAlertsScreen, title: "Compliance Monitoring" },
  { name: "DuplicateFlags", component: DuplicateFlagsScreen, title: "Duplicate Flags" },
  { name: "SecureMessaging", component: SecureMessagingScreen, title: "Secure Messages" },
  { name: "SMSMessage", component: SMSMessageScreen, title: "Send SMS" },
  { name: "EnterpriseIntegrations", component: EnterpriseIntegrationsScreen, title: "Wearable Connectors" },
  { name: "HealthGraphExplorer", component: HealthGraphExplorerScreen, title: "Health Graph" },
  { name: "IntakeHistory", component: IntakeHistoryScreen, title: "Health Intake" },
  { name: "ConsolidatedPHR", component: ConsolidatedPHRScreen, title: "My Health Record" },
  { name: "MedicationAdherence", component: MedicationAdherenceScreen, title: "Medication Tracker" },
  { name: "HealthJournal", component: HealthJournalScreen, title: "Health Journal" },
  { name: "Telehealth", component: TelehealthScreen, title: "Telehealth" },
  { name: "ReminderSettings", component: ReminderSettingsScreen, title: "Reminder Settings" },
  { name: "PrivacyPractices", component: PrivacyPracticesScreen, title: "Privacy Practices" },
  { name: "DataAccessRequest", component: DataAccessRequestScreen, title: "Data Access Requests" },
  { name: "ClinicalDecisionSupport", component: ClinicalDecisionSupportScreen, title: "Clinical Decision Support" },
  { name: "LabOrdering", component: LabOrderingScreen, title: "Lab Orders" },
  { name: "AppointmentScheduling", component: AppointmentSchedulingScreen, title: "Appointments" },
  { name: "PatientPortal", component: PatientPortalScreen, title: "Patient Portal" },
  { name: "LabResults", component: LabResultsScreen, title: "Lab Results" },
  { name: "PatientIntake", component: PatientIntakeScreen, title: "Patient Intake" },
  { name: "ProviderTasks", component: ProviderTasksScreen, title: "Task Management" },
  { name: "ClinicalWorkflow", component: ClinicalWorkflowScreen, title: "Clinical Workflow AI" },
  { name: "PatientChartIntelligence", component: PatientChartIntelligenceScreen, title: "Chart Intelligence" },
  { name: "VitalCharts", component: VitalChartsScreen, title: "Vital Signs & Growth" },
  { name: "PrenatalGuidelines", component: PrenatalGuidelinesScreen, title: "Prenatal Care" },
  { name: "NewbornScreening", component: NewbornScreeningScreen, title: "Newborn Screening" },
  { name: "AIHistoryAssistant", component: AIHistoryAssistantScreen, title: "Health History Assistant" },
  { name: "ScanPaperRecord", component: ScanPaperRecordScreen, title: "Scan Paper Record" },
  { name: "DocumentGeneration", component: DocumentGenerationScreen, title: "Generate Document" },
  { name: "ProviderAIWorkflow", component: ProviderAIWorkflowScreen, title: "AI Workflow Assistant" },
  { name: "AISOAPNote", component: AISOAPNoteScreen, title: "AI SOAP Note" },
  { name: "AutomatedDataEntry", component: AutomatedDataEntryScreen, title: "Automated Data Entry" },
  { name: "AIDocumentReview", component: AIDocumentReviewScreen, title: "Review AI Draft" },
  { name: "TEFCAHub", component: TEFCAHubScreen, title: "TEFCA Hub" },
  { name: "TEFCAPartnerManagement", component: TEFCAPartnerManagementScreen, title: "TEFCA Partners" },
  { name: "ConnectHealthRecords", component: ConnectHealthRecordsScreen, title: "Connect Records" },
  { name: "FhirApi", component: FhirApiScreen, title: "FHIR API" },
  { name: "DicomViewer", component: DicomViewerScreen, title: "DICOM Viewer" },
  { name: "FHIRPatientSearch", component: FHIRPatientSearchScreen, title: "Patient Search" },
  { name: "AmbientEncounter", component: AmbientEncounterScreen, title: "Visit Recording" },
  { name: "UserSettings", component: UserSettingsScreen, title: "Settings" },
  { name: "PetCare", component: PetCareScreen, title: "Pet Care" },
  { name: "PetDetail", component: PetDetailScreen, title: "Pet Details" },
  { name: "AddPet", component: AddPetScreen, title: "Add Pet" },
  { name: "AddPetRecord", component: AddPetRecordScreen, title: "Add Pet Record" },
  { name: "PetRegistry", component: PetRegistryScreen, title: "State Registry" },
  { name: "SavingsHub", component: SavingsHubScreen, title: "Savings Hub" },
  { name: "Community", component: CommunityScreen, title: "Community" },
  { name: "WomensHealth", component: WomensHealthScreen, title: "Women's Health" },
  { name: "Dermatology", component: DermatologyScreen, title: "Dermatology" },
  { name: "GeneticScreening", component: GeneticScreeningScreen, title: "Genetic Screening" },
  { name: "ASCVDCalculator", component: ASCVDCalculatorScreen, title: "Heart Risk Calculator" },
  { name: "AnnualReview", component: AnnualReviewScreen, title: "Annual Health Review" },
  { name: "PreVisitSummary", component: PreVisitSummaryScreen, title: "Pre-Visit Summary" },
  { name: "PostVisitSummary", component: PostVisitSummaryScreen, title: "Post-Visit Summary" },
  { name: "UnifiedHealthSummary", component: UnifiedHealthSummaryScreen, title: "Complete Health Timeline" },
  { name: "PreventiveCare", component: PreventiveCareScreen, title: "Preventive Care" },
  { name: "FamilyHub", component: FamilyHubScreen, title: "My Family" },
  { name: "EnterprisePlatformAnalytics", component: EnterprisePlatformAnalyticsScreen, title: "Platform Analytics" },
  { name: "InsuranceClaimsEOB", component: InsuranceClaimsEOBScreen, title: "Claims & Benefits" },
  { name: "FertilityCycleDashboard", component: FertilityCycleDashboardScreen, title: "Fertility & Cycle" },
  { name: "MenopausalResilience", component: MenopausalResilienceScreen, title: "Menopausal Resilience" },
  { name: "ClinicalAiAudit", component: ClinicalAiAuditScreen, title: "Clinical AI Audit" },
  { name: "SmartNpiLookup", component: SmartNpiLookupScreen, title: "NPI Provider Lookup" },
  { name: "BaaAgreements", component: BaaAgreementsScreen, title: "BAA Agreements" },
  { name: "ComplianceExport", component: ComplianceExportScreen, title: "Compliance Export" },
  { name: "NetworkHealth", component: NetworkHealthScreen, title: "Network Health" },
  { name: "FhirViewer", component: FhirViewerScreen, title: "FHIR R4 Viewer" },
  { name: "Soc2Compliance", component: Soc2ComplianceDashboard, title: "SOC 2 Compliance" },
  { name: "FhirDataHub", component: FhirDataHubScreen, title: "API Data Hub" },
  { name: "AdminAuditVisualization", component: AdminAuditVisualizationScreen, title: "Audit Analytics" },
  { name: "InsuranceLearning", component: InsuranceLearningScreen, title: "Insurance Navigator" },
  { name: "UninsuredPlatform", component: UninsuredPlatformScreen, title: "Direct Access" },
  { name: "RateCalculator", component: RateCalculatorScreen, title: "Rate Calculator" },
  { name: "ProviderSearch", component: ProviderSearchScreen, title: "Find a Provider" },
  { name: "Booking", component: BookingScreen, title: "Book Appointment" },
  { name: "VAVerification", component: VAVerificationScreen, title: "VA Verification" },
  { name: "CareAccess", component: CareAccessScreen, title: "Care Access" },
  { name: "PriorAuth", component: PriorAuthScreen, title: "Prior Authorization" },
  { name: "DrugInteractions", component: DrugInteractionsScreen, title: "Drug Interactions" },
  { name: "CareGaps", component: CareGapsScreen, title: "Health Screenings" },
  { name: "OpenDental", component: OpenDentalScreen, title: "Dental Records" },
  { name: "Dentrix", component: DentrixScreen, title: "Dentrix Records" },
  { name: "Eaglesoft", component: EaglesoftScreen, title: "Eaglesoft Records" },
  { name: "VertexSearch", component: VertexSearchScreen, title: "Search" },
  { name: "CardScan", component: CardScanScreen, title: "Card Scanner" },
  ...(process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === "true"
    ? ([{ name: "Subscription", component: SubscriptionScreen, title: "Subscription" }] satisfies ScreenRegistration[])
    : ([] as ScreenRegistration[])),
  { name: "ROITracker", component: ROITrackerScreen, title: "ROI Tracker" },
  { name: "DocumentVerification", component: DocumentVerificationScreen, title: "Document Verification" },
  ...(process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === "true"
    ? ([{ name: "Paywall", component: PaywallScreen, title: "Tabula Medica Pro" }] satisfies ScreenRegistration[])
    : ([] as ScreenRegistration[])),
];

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {PROFILE_SCREENS.map((screen) => (
        <Stack.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{
            headerTitle: screen.title,
            ...screen.options,
          }}
        />
      ))}
    </Stack.Navigator>
  );
}
