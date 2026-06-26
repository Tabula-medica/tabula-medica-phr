import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccessibilityProvider, SkipLink } from "@/components/accessibility-provider";
import { ViewModeProvider } from "@/contexts/view-mode-context";
import { LanguageProvider, GlobalLanguageSwitcher } from "@/components/language-provider";
import { RegionProvider } from "@/components/region-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { LegalFooter } from "@/components/legal-footer";

import { GuardrailsDisclaimer } from "@/components/guardrails-disclaimer";
import { ProfileSwitcher } from "@/components/profile-switcher";
import { Button } from "@/components/ui/button";
import { NotificationDropdown, MobileNotificationDropdown } from "@/components/notification-dropdown";
import { EnhancedNotificationCenter } from "@/components/enhanced-notification-center";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { initCapacitor } from "@/lib/capacitor";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutModal } from "@/components/session-timeout-modal";
import LandingPage from "@/pages/landing";
import { WelcomeModal } from "@/components/welcome-modal";
import { CommandPalette } from "@/components/command-palette";
import { Loader2 } from "lucide-react";
import { 
  Search,
  MoreVertical,
  LogOut,
  BookOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import NotFound from "@/pages/not-found";
import { ChatbotWidget } from "@/components/chatbot-widget";
import { ServerFeatureGateListener } from "@/components/server-feature-gate-listener";
import { VoiceCommands } from "@/components/voice-commands";
import { VoiceNavigationControl } from "@/components/voice-navigation-control";
import { ScreenReaderAnnouncer } from "@/components/screen-reader-announcer";
import { A11yEnhancements } from "@/components/a11y-enhancements";
import { VoiceAccessButton } from "@/components/VoiceAccessButton";
import { OnboardingProvider, OnboardingDialog, OnboardingHelpButton } from "@/components/onboarding";
import { OnboardingAssistant } from "@/components/onboarding-assistant";
import { AIPreferencesProvider } from "@/hooks/use-ai-preferences";
import { OfflineBanner } from "@/components/offline-indicator";
import { UnifiedSummaryPanel } from "@/components/unified-summary-panel";

import { lazy, Suspense, useState, useEffect } from "react";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const MyHealthRecord = lazy(() => import("@/pages/my-health-record"));
const FastenConnect = lazy(() => import("@/pages/fasten-connect"));
const EHRCallback = lazy(() => import("@/pages/ehr-callback"));
const PetHealthRecords = lazy(() => import("@/pages/pet-health-records"));
const Timeline = lazy(() => import("@/pages/timeline"));
const Documents = lazy(() => import("@/pages/documents"));
const CarePackets = lazy(() => import("@/pages/care-packets"));
const CareIndex = lazy(() => import("@/pages/care-index"));
const CareRateCalculator = lazy(() => import("@/pages/care-rate-calculator"));
const CareShareQr = lazy(() => import("@/pages/care-share-qr"));
const CareVaVerification = lazy(() => import("@/pages/care-va-verification"));
const AdminSmokeTest = lazy(() => import("@/pages/admin-smoke-test"));
const UniversalSearchPage = lazy(() => import("@/pages/universal-search"));
const NotificationSettings = lazy(() => import("@/pages/notification-settings"));
const SecuritySettings = lazy(() => import("@/pages/security-settings"));
const BillingDashboard = lazy(() => import("@/pages/billing-dashboard"));
const BillsEob = lazy(() => import("@/pages/bills-eob"));
const EnterpriseSavings = lazy(() => import("@/pages/enterprise-savings"));
const InsuranceCardUpload = lazy(() => import("@/pages/insurance-card-upload"));
const UninsuredResources = lazy(() => import("@/pages/uninsured-resources"));
const SubscriptionPaywall = lazy(() => import("@/pages/subscription-paywall"));
const FAQPage = lazy(() => import("@/pages/faq"));
const InstantAnalysis = lazy(() => import("@/pages/instant-analysis"));
const PHRPipeline = lazy(() => import("@/pages/phr-pipeline"));
const HealthRecordsDisplay = lazy(() => import("@/pages/health-records-display"));
const FQHCFinder = lazy(() => import("@/pages/fqhc-finder"));
const DualModeEcosystem = lazy(() => import("@/pages/dual-mode-ecosystem"));
const NmnAuth0Smart = lazy(() => import("@/pages/nmn-auth0-smart"));
const AIEvidenceAdvisor = lazy(() => import("@/pages/ai-evidence-advisor"));
const HealthAssistant = lazy(() => import("@/pages/health-assistant"));
const HealthJournal = lazy(() => import("@/pages/health-journal"));
const HealthGoals = lazy(() => import("@/pages/health-goals"));
const MedicalScribe = lazy(() => import("@/pages/medical-scribe"));
const VisitSummary = lazy(() => import("@/pages/visit-summary"));
const PreventiveScreening = lazy(() => import("@/pages/preventive-screening"));
const CareGaps = lazy(() => import("@/pages/care-gaps"));
const AmbientEncounter = lazy(() => import("@/pages/ambient-encounter"));
const SymptomChecker = lazy(() => import("@/pages/symptom-checker"));
const BetaConsent = lazy(() => import("@/pages/beta-consent"));
const PatientReportedOutcomes = lazy(() => import("@/pages/patient-reported-outcomes"));
const GdprDashboard = lazy(() => import("@/pages/gdpr-dashboard"));
const CcpaDashboard = lazy(() => import("@/pages/ccpa-dashboard"));
const TrustCenter = lazy(() => import("@/pages/trust-center"));
const MyAuditTrail = lazy(() => import("@/pages/my-audit-trail"));
const VoiceAccess = lazy(() => import("@/pages/voice-access"));
const DocumentTranslation = lazy(() => import("@/pages/document-translation"));
const DrugSavings = lazy(() => import("@/pages/drug-savings"));
const DrugInteractions = lazy(() => import("@/pages/drug-interactions"));
const PriorAuthLetter = lazy(() => import("@/pages/prior-auth-letter"));
const InsuranceLearning = lazy(() => import("@/pages/insurance-learning"));
const DentalIntegrations = lazy(() => import("@/pages/dental-integrations"));
const Learn = lazy(() => import("@/pages/learn"));
const Messages = lazy(() => import("@/pages/messages"));
const PatientTelehealthPortal = lazy(() => import("@/pages/patient-telehealth-portal"));
const CareTeamHub = lazy(() => import("@/pages/care-team-hub"));
const CollaborativeCarePlans = lazy(() => import("@/pages/collaborative-care-plans"));
const CaregiverPortal = lazy(() => import("@/pages/caregiver-portal"));
const FamilyVerification = lazy(() => import("@/pages/family-verification"));
const MyFamily = lazy(() => import("@/pages/my-family"));
const CMS1500ClaimForm = lazy(() => import("@/pages/cms-1500-claim-form"));
const ProviderDirectory = lazy(() => import("@/pages/provider-directory"));
const NPILookup = lazy(() => import("@/pages/npi-lookup"));
const ComplianceExport = lazy(() => import("@/pages/compliance-export"));
const NetworkHealth = lazy(() => import("@/pages/network-health"));
const TEFCAPatientViewer = lazy(() => import("@/pages/tefca-patient-viewer"));
const DataSourceOnboarding = lazy(() => import("@/pages/data-source-onboarding"));
const Community = lazy(() => import("@/pages/community"));
const Assessments = lazy(() => import("@/pages/assessments"));
const Rewards = lazy(() => import("@/pages/rewards"));
const Settings = lazy(() => import("@/pages/settings"));
const Accessibility = lazy(() => import("@/pages/accessibility"));
const AboutSecurity = lazy(() => import("@/pages/about-security"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
const LegalPage = lazy(() => import("@/pages/legal-page"));
const OfflineMode = lazy(() => import("@/pages/offline-mode"));
const ProviderPortal = lazy(() => import("@/pages/provider-portal"));
const ClinicianDashboard = lazy(() => import("@/pages/clinician-dashboard"));
const Patients = lazy(() => import("@/pages/patients"));
const PatientDetail = lazy(() => import("@/pages/patient-detail"));
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const InternalAnalytics = lazy(() => import("@/pages/internal-analytics"));
const ExtractionPipeline = lazy(() => import("@/pages/extraction-pipeline"));
const DataIntegrationHub = lazy(() => import("@/pages/data-integration-hub"));
const ComplianceDashboard = lazy(() => import("@/pages/compliance-dashboard"));
const USCDIv3Compliance = lazy(() => import("@/pages/uscdi-v3-compliance"));
const Welcome = lazy(() => import("@/pages/welcome"));
const Login = lazy(() => import("@/pages/login"));
const AuthLogin = lazy(() => import("@/pages/auth-login"));
const AuthRegister = lazy(() => import("@/pages/auth-register"));
const Consent = lazy(() => import("@/pages/consent"));
const SharedRecordView = lazy(() => import("@/pages/shared-record-view"));
const SharedHealthDataViewer = lazy(() => import("@/pages/shared-health-data-viewer"));
const Connections = lazy(() => import("@/pages/connections"));
const IntakeHistory = lazy(() => import("@/pages/intake-history"));
const Medications = lazy(() => import("@/pages/medications"));
const Conditions = lazy(() => import("@/pages/conditions"));
const LabResults = lazy(() => import("@/pages/lab-results"));
const Vitals = lazy(() => import("@/pages/vitals"));
const Immunizations = lazy(() => import("@/pages/immunizations"));
const Allergies = lazy(() => import("@/pages/allergies"));
const Appointments = lazy(() => import("@/pages/appointments"));
const Identity = lazy(() => import("@/pages/identity"));
const Security = lazy(() => import("@/pages/security"));
const Privacy = lazy(() => import("@/pages/privacy"));
const CDSDisabled = lazy(() => import("@/pages/cds-disabled"));
const GamificationDashboard = lazy(() => import("@/pages/gamification-dashboard"));
const ComprehensivePatientProfile = lazy(() => import("@/pages/comprehensive-patient-profile"));
const HealthGoalTracking = lazy(() => import("@/pages/health-goal-tracking"));
const AuditLogs = lazy(() => import("@/pages/audit-logs"));
const AuditVisualization = lazy(() => import("@/pages/audit-visualization"));
const FhirDataHub = lazy(() => import("@/pages/fhir-data-hub"));
const TelehealthPage = lazy(() => import("@/pages/telehealth"));
const VideoRoomPage = lazy(() => import("@/pages/video-room"));
const NewPatientOnboarding = lazy(() => import("@/pages/new-patient-onboarding"));
const PatientOnboarding = lazy(() => import("@/pages/patient-onboarding"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const GuidedOnboarding = lazy(() => import("@/pages/guided-onboarding"));
const PatientOnboardingWizard = lazy(() => import("@/pages/patient-onboarding-wizard"));
const NewUserOnboarding = lazy(() => import("@/pages/new-user-onboarding"));
const HealthQuestionnaire = lazy(() => import("@/pages/health-questionnaire"));
const SyncProgress = lazy(() => import("@/pages/sync-progress"));
const QocaAIoT = lazy(() => import("@/pages/qoca-aiot"));
const WomensHealth = lazy(() => import("@/pages/womens-health"));
const FertilityCycleDashboard = lazy(() => import("@/pages/fertility-cycle-dashboard"));
const MenopauseResilience = lazy(() => import("@/pages/menopause-resilience"));
const ClinicalAiAudit = lazy(() => import("@/pages/clinical-ai-audit"));
const ASCVDCalculator = lazy(() => import("@/pages/ascvd-calculator"));
const ComprehensiveOnboarding = lazy(() => import("@/pages/comprehensive-onboarding"));
const LongevityTracking = lazy(() => import("@/pages/longevity-tracking"));
const AdvanceDirectives = lazy(() => import("@/pages/advance-directives"));
const MedplumFHIR = lazy(() => import("@/pages/medplum-fhir"));

function Router() {
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/my-health-record" component={MyHealthRecord} />
      <Route path="/fasten-connect" component={FastenConnect} />
      <Route path="/ehr-callback" component={EHRCallback} />
      <Route path="/pet-health-records" component={PetHealthRecords} />
      <Route path="/timeline" component={Timeline} />
      <Route path="/documents" component={Documents} />
      <Route path="/care-packets" component={CarePackets} />
      <Route path="/care" component={CareIndex} />
      <Route path="/care/find-a-doctor" component={ProviderDirectory} />
      <Route path="/care/eligibility" component={CareRateCalculator} />
      <Route path="/care/share-records" component={CareShareQr} />
      <Route path="/care/export" component={CarePackets} />
      <Route path="/care/va" component={CareVaVerification} />
      <Route path="/care/ai-help" component={HealthAssistant} />
      <Route path="/admin/smoke-test" component={AdminSmokeTest} />
      <Route path="/search" component={UniversalSearchPage} />
      <Route path="/notifications" component={NotificationSettings} />
      <Route path="/billing" component={BillingDashboard} />
      <Route path="/bills-eob" component={BillsEob} />
      <Route path="/enterprise-savings" component={EnterpriseSavings} />
      <Route path="/insurance-card-upload" component={InsuranceCardUpload} />
      <Route path="/uninsured-resources" component={UninsuredResources} />
      <Route path="/subscription" component={SubscriptionPaywall} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/try" component={InstantAnalysis} />
      <Route path="/phr-pipeline" component={PHRPipeline} />
      <Route path="/health-records" component={HealthRecordsDisplay} />
      <Route path="/find-free-care" component={FQHCFinder} />
      <Route path="/dual-mode" component={DualModeEcosystem} />
      <Route path="/nmn-auth0" component={NmnAuth0Smart} />
      <Route path="/ai-health-advisor" component={AIEvidenceAdvisor} />
      <Route path="/health-assistant" component={HealthAssistant} />
      <Route path="/health-journal" component={HealthJournal} />
      <Route path="/health-goals" component={HealthGoals} />
      <Route path="/medical-scribe" component={MedicalScribe} />
      <Route path="/visit-summary" component={VisitSummary} />
      <Route path="/preventive-screening" component={PreventiveScreening} />
      <Route path="/care-gaps" component={CareGaps} />
      <Route path="/ambient-encounter" component={AmbientEncounter} />
      <Route path="/symptom-checker" component={SymptomChecker} />
      <Route path="/beta-consent" component={BetaConsent} />
      <Route path="/patient-reported-outcomes" component={PatientReportedOutcomes} />
      <Route path="/gdpr" component={GdprDashboard} />
      <Route path="/ccpa" component={CcpaDashboard} />
      <Route path="/trust-center" component={TrustCenter} />
      {/* §1798.135-required short URL — redirects via SPA hash to opt-out card */}
      <Route path="/do-not-sell-or-share">{() => { window.location.replace("/ccpa#opt-out"); return null; }}</Route>
      <Route path="/my-audit-trail" component={MyAuditTrail} />
      <Route path="/voice-access" component={VoiceAccess} />
      <Route path="/document-translation" component={DocumentTranslation} />
      <Route path="/drug-savings" component={DrugSavings} />
      <Route path="/drug-interactions" component={DrugInteractions} />
      <Route path="/prior-auth-letter" component={PriorAuthLetter} />
      <Route path="/insurance-learning" component={InsuranceLearning} />
      <Route path="/dental-integrations" component={DentalIntegrations} />
      <Route path="/learn" component={Learn} />
      <Route path="/messages" component={Messages} />
      <Route path="/patient-telehealth-portal" component={PatientTelehealthPortal} />
      <Route path="/telehealth" component={TelehealthPage} />
      <Route path="/telehealth/room/:roomId" component={VideoRoomPage} />
      <Route path="/care-team-hub" component={CareTeamHub} />
      <Route path="/collaborative-care-plans" component={CollaborativeCarePlans} />
      <Route path="/collaborative-care-plans/:id" component={CollaborativeCarePlans} />
      <Route path="/caregiver-portal" component={CaregiverPortal} />
      <Route path="/family-verification" component={FamilyVerification} />
      <Route path="/my-family" component={MyFamily} />
      <Route path="/cms-1500" component={CMS1500ClaimForm} />
      <Route path="/find-provider" component={ProviderDirectory} />
      <Route path="/npi-lookup" component={NPILookup} />
      <Route path="/compliance-export" component={ComplianceExport} />
      <Route path="/network-health" component={NetworkHealth} />
      <Route path="/patient-viewer" component={TEFCAPatientViewer} />
      <Route path="/data-source-onboarding" component={DataSourceOnboarding} />
      <Route path="/community" component={Community} />
      <Route path="/assessments" component={Assessments} />
      <Route path="/rewards" component={Rewards} />
      <Route path="/achievements" component={GamificationDashboard} />
      <Route path="/settings" component={Settings} />
      <Route path="/settings/notifications" component={NotificationSettings} />
      <Route path="/settings/security" component={SecuritySettings} />
      <Route path="/accessibility" component={Accessibility} />
      <Route path="/security" component={Security} />
      <Route path="/about/security" component={AboutSecurity} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      {/* Canonical short legal URL. Aliases the counsel-led /legal/terms page
          (same LegalPage content). /privacy is already taken by the privacy
          *settings* page; the policy lives at /legal/privacy. */}
      <Route path="/terms">{() => <LegalPage slug="terms" />}</Route>
      <Route path="/legal/privacy">{() => <LegalPage slug="privacy" />}</Route>
      <Route path="/legal/terms">{() => <LegalPage slug="terms" />}</Route>
      <Route path="/legal/cookie">{() => <LegalPage slug="cookie" />}</Route>
      <Route path="/legal/disclaimer">{() => <LegalPage slug="disclaimer" />}</Route>
      <Route path="/legal/accessibility">{() => <LegalPage slug="accessibility" />}</Route>
      <Route path="/legal/hipaa-notice">{() => <LegalPage slug="hipaa-notice" />}</Route>
      <Route path="/legal/care-access-privacy">{() => <LegalPage slug="care-access-privacy" />}</Route>
      <Route path="/offline" component={OfflineMode} />
      <Route path="/provider-portal" component={ProviderPortal} />
      <Route path="/clinician-dashboard" component={ClinicianDashboard} />
      <Route path="/patients" component={Patients} />
      <Route path="/patients/:id" component={PatientDetail} />
      <Route path="/admin-analytics" component={AdminAnalytics} />
      <Route path="/internal-analytics" component={InternalAnalytics} />
      <Route path="/extraction-pipeline" component={ExtractionPipeline} />
      <Route path="/data-integration-hub" component={DataIntegrationHub} />
      <Route path="/compliance-dashboard" component={ComplianceDashboard} />
      <Route path="/uscdi-v3-compliance" component={USCDIv3Compliance} />
      <Route path="/welcome" component={Welcome} />
      <Route path="/login" component={Login} />
      <Route path="/auth/login" component={AuthLogin} />
      <Route path="/auth/register" component={AuthRegister} />
      <Route path="/consent" component={Consent} />
      <Route path="/connections" component={Connections} />
      <Route path="/medplum" component={MedplumFHIR} />
      <Route path="/intake-history" component={IntakeHistory} />
      <Route path="/medications" component={Medications} />
      <Route path="/conditions" component={Conditions} />
      <Route path="/lab-results" component={LabResults} />
      <Route path="/vitals" component={Vitals} />
      <Route path="/immunizations" component={Immunizations} />
      <Route path="/allergies" component={Allergies} />
      <Route path="/appointments" component={Appointments} />
      <Route path="/identity" component={Identity} />
      <Route path="/my-profile" component={ComprehensivePatientProfile} />
      <Route path="/my-health-goals" component={HealthGoalTracking} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/audit-visualization" component={AuditVisualization} />
      <Route path="/fhir-data-hub" component={FhirDataHub} />
      <Route path="/share/:shareId" component={SharedRecordView} />
      <Route path="/shared-health-data/:token" component={SharedHealthDataViewer} />
      <Route path="/new-patient-onboarding" component={NewPatientOnboarding} />
      <Route path="/patient-onboarding" component={PatientOnboarding} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/guided-onboarding" component={GuidedOnboarding} />
      <Route path="/patient-onboarding-wizard" component={PatientOnboardingWizard} />
      <Route path="/new-user-onboarding" component={NewUserOnboarding} />
      <Route path="/comprehensive-onboarding" component={ComprehensiveOnboarding} />
      <Route path="/health-questionnaire" component={HealthQuestionnaire} />
      <Route path="/sync-progress" component={SyncProgress} />
      <Route path="/qoca-aiot" component={QocaAIoT} />
      <Route path="/womens-health" component={WomensHealth} />
      <Route path="/fertility-cycle" component={FertilityCycleDashboard} />
      <Route path="/menopause-resilience" component={MenopauseResilience} />
      <Route path="/clinical-ai-audit" component={ClinicalAiAudit} />
      <Route path="/ascvd-calculator" component={ASCVDCalculator} />
      <Route path="/longevity-tracking" component={LongevityTracking} />
      <Route path="/advance-directives" component={AdvanceDirectives} />
      {/* CDS Disabled */} <Route path="/medication-safety" component={CDSDisabled} />
      {/* CDS Disabled */} <Route path="/ai-care-plan" component={CDSDisabled} />
      {/* CDS Disabled */} <Route path="/risk-stratification" component={CDSDisabled} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </RouteErrorBoundary>
  );
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/my-health-record": "My Health Record",
  "/fasten-connect": "Connect Health Records",
  "/pet-health-records": "Pet Health Records",
  "/timeline": "Timeline",
  "/documents": "Documents",
  "/care-packets": "Share / Export",
  "/care": "Care Access",
  "/care/find-a-doctor": "Find a Doctor",
  "/care/eligibility": "Coverage Eligibility",
  "/care/share-records": "Share Your Records",
  "/care/export": "Export Care Packet",
  "/care/va": "Veteran Verification",
  "/care/ai-help": "Care Assistant",
  "/search": "Search",
  "/notifications": "Notifications",
  "/billing": "Billing",
  "/bills-eob": "Bills & EOBs",
  "/uninsured-resources": "Savings & Resources",
  "/subscription": "Subscription",
  "/ai-health-advisor": "AI Health Advisor",
  "/health-assistant": "Health Assistant",
  "/health-journal": "Health Journal",
  "/health-goals": "Health Goals",
  "/medical-scribe": "Record Visit",
  "/visit-summary": "Visit Summary",
  "/preventive-screening": "Preventive Screening",
  "/care-gaps": "Preventive Care Gaps",
  "/ambient-encounter": "Visit Recorder",
  "/voice-access": "Voice Access",
  "/document-translation": "Document Translation",
  "/drug-savings": "Drug Savings & Coupons",
  "/drug-interactions": "Drug Interaction Checker",
  "/prior-auth-letter": "Prior Auth Letter Generator",
  "/insurance-learning": "Insurance Learning Navigator",
  "/learn": "Learn",
  "/messages": "Messages",
  "/patient-telehealth-portal": "Telehealth",
  "/care-team-hub": "Care Team",
  "/collaborative-care-plans": "Care Plans",
  "/caregiver-portal": "Caregivers",
  "/family-verification": "Family Verification",
  "/my-family": "My Family",
  "/cms-1500": "Insurance Claim Forms",
  "/find-provider": "Find a Provider",
  "/npi-lookup": "Smart NPI Lookup",
  "/compliance-export": "Compliance Export",
  "/network-health": "Network Health",
  "/patient-viewer": "Patient Health Record",
  "/data-source-onboarding": "TEFCA Partner Onboarding",
  "/community": "Community",
  "/assessments": "Assessments",
  "/rewards": "Rewards",
  "/settings": "Settings",
  "/accessibility": "Accessibility",
  "/security": "Security",
  "/privacy": "Privacy",
  "/privacy-policy": "Privacy Policy",
  "/terms-of-service": "Terms of Service",
  "/offline": "Offline Mode",
  "/provider-portal": "Provider Portal",
  "/clinician-dashboard": "Clinician Dashboard",
  "/patients": "Patients",
  "/admin-analytics": "Admin Analytics",
  "/internal-analytics": "Internal Analytics",
  "/extraction-pipeline": "Extraction Pipeline",
  "/data-integration-hub": "Data Integration",
  "/compliance-dashboard": "Compliance",
  "/uscdi-v3-compliance": "USCDI v3",
  "/welcome": "Welcome",
  "/login": "Sign In",
  "/consent": "Privacy Consent",
  "/connections": "Data Sources",
  "/intake-history": "Health History",
  "/medications": "Medications",
  "/conditions": "Conditions",
  "/lab-results": "Lab Results",
  "/vitals": "Vitals",
  "/immunizations": "Immunizations",
  "/allergies": "Allergies",
  "/appointments": "Appointments",
  "/identity": "My Identity",
  "/my-profile": "My Profile",
  "/audit-logs": "Audit Logs",
  "/audit-visualization": "Audit Visualization",
  "/fhir-data-hub": "FHIR API Data Hub",
  "/qoca-aiot": "QOCA AIoT",
  "/womens-health": "Women's Health",
  "/fertility-cycle": "Fertility & Cycle Dashboard",
  "/menopause-resilience": "Menopause Resilience",
  "/clinical-ai-audit": "Clinical AI Audit",
  "/ascvd-calculator": "ASCVD Risk Calculator",
  "/longevity-tracking": "Longevity Tracking",
  "/advance-directives": "Advance Directives",
  "/comprehensive-onboarding": "Health Profile Setup",
};

function MobileLogoutItem() {
  const { logout } = useAuth();
  return (
    <DropdownMenuItem onClick={() => logout()} data-testid="menu-logout">
      <LogOut className="mr-2 h-4 w-4" />
      Log Out
    </DropdownMenuItem>
  );
}

function MobileAppHeader() {
  const [location] = useLocation();
  const pageTitle = pageTitles[location] || "Tabula Medica";

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50 md:hidden" role="banner" aria-label="Mobile header">
      <div className="flex items-center gap-2 min-w-0">
        <ProfileSwitcher />
        <div className="h-4 w-px bg-border" />
        <h1 className="text-base font-semibold truncate">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center gap-1 shrink-0">
        <VoiceAccessButton />
        
        <Button variant="ghost" size="icon" data-testid="button-search-mobile" aria-label="Search">
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
        
        <OnboardingHelpButton />
        
        <MobileNotificationDropdown />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-overflow-menu" aria-label="More options">
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <Link href="/conditions">
              <DropdownMenuItem data-testid="menu-conditions">
                Conditions & Allergies
              </DropdownMenuItem>
            </Link>
            <Link href="/identity">
              <DropdownMenuItem data-testid="menu-identity">
                My Identity
              </DropdownMenuItem>
            </Link>
            <Link href="/fasten-connect">
              <DropdownMenuItem data-testid="menu-connect-records">
                Connect Health Records
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <Link href="/ai-health-advisor">
              <DropdownMenuItem data-testid="menu-ai-advisor">
                AI Health Advisor
              </DropdownMenuItem>
            </Link>
            <Link href="/learn">
              <DropdownMenuItem data-testid="menu-learn">
                Health Education
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <Link href="/accessibility">
              <DropdownMenuItem data-testid="menu-language">
                Language & Accessibility
              </DropdownMenuItem>
            </Link>
            <Link href="/security">
              <DropdownMenuItem data-testid="menu-security">
                Security
              </DropdownMenuItem>
            </Link>
            <Link href="/privacy">
              <DropdownMenuItem data-testid="menu-privacy">
                Privacy Settings
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              const html = document.documentElement;
              html.classList.toggle('dark');
              localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
            }} data-testid="menu-theme-toggle">
              Toggle Theme
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <MobileLogoutItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function DesktopAppHeader() {
  const [location] = useLocation();
  const pageTitle = pageTitles[location] || "Tabula Medica";
  const { user, logout } = useAuth();

  const userInitials = user
    ? `${(user.firstName?.[0] || "").toUpperCase()}${(user.lastName?.[0] || "").toUpperCase()}` || (user.email?.[0] || "U").toUpperCase()
    : "U";

  return (
    <header className="hidden md:flex items-center justify-between gap-4 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40" role="banner" aria-label="Desktop header">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <h1 className="text-lg font-semibold">{pageTitle}</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <GlobalLanguageSwitcher />
        
        <VoiceAccessButton />
        
        <CommandPalette />
        
        <OnboardingHelpButton />
        
        <EnhancedNotificationCenter />
        
        <NotificationDropdown />
        
        <ThemeToggle />
        
        <div className="h-6 w-px bg-border mx-1" />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" data-testid="button-user-menu">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                  <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium hidden lg:inline" data-testid="text-user-name">
                  {user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user.email || "User"}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5 text-sm text-muted-foreground" data-testid="text-user-email">
                {user.email || "No email"}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        <ProfileSwitcher />
      </div>
    </header>
  );
}

function SummaryFloatingButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-12 w-12 rounded-full shadow-lg"
      size="icon"
      data-testid="button-open-summary"
      aria-label="Open Health Summary"
    >
      <BookOpen className="h-5 w-5" />
    </Button>
  );
}

function AuthenticatedApp() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const { logout } = useAuth();
  const sessionTimeout = useSessionTimeout(true);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    const handler = () => setSummaryOpen(true);
    window.addEventListener("open-health-summary", handler);
    return () => window.removeEventListener("open-health-summary", handler);
  }, []);

  return (
    <LanguageProvider>
    <RegionProvider>
    <AccessibilityProvider>
    <ScreenReaderAnnouncer>
    <ViewModeProvider>
      <OnboardingProvider>
        <AIPreferencesProvider>
        <SkipLink />
        <A11yEnhancements />
        <OfflineBanner />
        <SessionTimeoutModal
          isOpen={sessionTimeout.isWarningVisible}
          secondsRemaining={sessionTimeout.secondsRemaining}
          onStayLoggedIn={sessionTimeout.dismissWarning}
          onLogout={() => logout()}
        />
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex flex-col h-screen w-full">
          <GuardrailsDisclaimer variant="banner" />
          <div className="flex flex-1 min-h-0">
          <div className="hidden md:block" role="navigation" aria-label="Main navigation">
            <AppSidebar />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <MobileAppHeader />
            <DesktopAppHeader />
            <main id="main-content" className="flex-1 overflow-auto pb-24 md:pb-0" role="main" aria-label="Page content">
              <Router />
              <LegalFooter />
            </main>
          </div>
        </div>
        </div>
        <BottomNav />
        <SummaryFloatingButton onClick={() => setSummaryOpen(true)} />
        <UnifiedSummaryPanel open={summaryOpen} onOpenChange={setSummaryOpen} />
        <VoiceNavigationControl userId="current-user" />
        <VoiceCommands />
        <OnboardingDialog />
        <OnboardingAssistant />
        <ChatbotWidget />
      </SidebarProvider>
        </AIPreferencesProvider>
    </OnboardingProvider>
    </ViewModeProvider>
    </ScreenReaderAnnouncer>
    </AccessibilityProvider>
    </RegionProvider>
    </LanguageProvider>
  );
}

const SPLASH_WATCHDOG_MS = 6000;

function AppContent() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  const [splashTimedOut, setSplashTimedOut] = useState(false);

  useEffect(() => {
    const pageTitle = pageTitles[location];
    const next = pageTitle ? `${pageTitle} · Tabula Medica` : "Tabula Medica";
    if (typeof document !== "undefined" && document.title !== next) {
      document.title = next;
    }
  }, [location]);

  useEffect(() => {
    if (!isLoading) {
      setSplashTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn("[App] splash watchdog fired — forcing past loading state");
      setSplashTimedOut(true);
    }, SPLASH_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (location.startsWith("/share/") && !location.includes("/share-links")) {
    return (
      <div className="flex flex-col min-h-screen">
        <GuardrailsDisclaimer variant="banner" />
        <div className="flex-1">
          <SharedRecordView />
        </div>
      </div>
    );
  }

  if (isLoading && !splashTimedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" data-testid="status-app-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const publicClinicalRoutes = ["/drug-interactions", "/prior-auth-letter", "/symptom-checker"];
  // Legal pages must be reachable when signed out so App Store reviewers
  // (and any visitor following a footer link from the landing page) can
  // view Privacy/Terms/Cookie/Disclaimer/Accessibility/HIPAA Notice
  // without authenticating. Apple Guideline 5.1.1 requires legal links
  // to resolve from a public-facing surface.
  const publicLegalRoutes = [
    "/terms",
    "/legal/privacy",
    "/legal/terms",
    "/legal/cookie",
    "/legal/disclaimer",
    "/legal/accessibility",
    "/legal/hipaa-notice",
    "/legal/care-access-privacy",
    // S5 — CCPA notice at collection must be reachable to non-customers
    // (people deciding whether to sign up). The dashboard's authenticated
    // tabs return 401 gracefully via the underlying queries.
    "/ccpa",
    "/do-not-sell-or-share",
    "/trust-center",
  ];
  // Auth-related pages must render their own forms when signed out —
  // /auth/login and /auth/register host the GCIP (Google) sign-in flow,
  // /login is the legacy mode picker, /welcome is the post-register
  // success screen, /consent captures privacy consent. Without this
  // list, anyone clicking "Create account" gets bounced to the marketing
  // landing page and can never reach the form.
  const publicAuthRoutes = [
    "/login",
    "/auth/login",
    "/auth/register",
    "/welcome",
    "/consent",
  ];
  if (!user && (publicClinicalRoutes.includes(location) || publicLegalRoutes.includes(location) || publicAuthRoutes.includes(location))) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <Router />
      </Suspense>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  const pendingHospital = sessionStorage.getItem("pending_hospital_name");
  if (pendingHospital && !location.startsWith("/connections")) {
    window.location.href = "/connections";
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AuthenticatedApp />;
}

function App() {
  useEffect(() => {
    initCapacitor();
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LanguageProvider>
            <RegionProvider>
              <AppContent />
              <ServerFeatureGateListener />
              <WelcomeModal />
              <Toaster />
            </RegionProvider>
          </LanguageProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
