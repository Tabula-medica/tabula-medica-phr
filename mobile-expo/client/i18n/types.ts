export type SupportedLanguage = 'en' | 'es' | 'fr' | 'zh' | 'ar' | 'pt' | 'vi' | 'ko' | 'hi' | 'pa' | 'ru' | 'ja' | 'de' | 'bn' | 'tr' | 'it' | 'th' | 'ur' | 'id' | 'tl' | 'sw' | 'ta' | 'mr' | 'fa' | 'te' | 'ne' | 'gu' | 'ms' | 'pl' | 'uk' | 'nl' | 'el' | 'he' | 'ro' | 'cs' | 'hu' | 'am' | 'my' | 'ha' | 'yo' | 'ig' | 'zu' | 'so' | 'af' | 'kn' | 'ml' | 'or' | 'km' | 'ps' | 'ti' | 'ht' | 'hmn';

export type RegionMode = 'us' | 'international';

export interface RegionConfig {
  mode: RegionMode;
  dateFormat: string;
  temperatureUnit: 'F' | 'C';
  weightUnit: 'lbs' | 'kg';
  heightUnit: 'ft/in' | 'cm';
  glucoseUnit: 'mg/dL' | 'mmol/L';
  bloodPressureUnit: 'mmHg';
  distanceUnit: 'mi' | 'km';
  complianceFramework: 'HIPAA' | 'GDPR' | 'BOTH';
}

export const REGION_CONFIGS: Record<RegionMode, RegionConfig> = {
  us: {
    mode: 'us',
    dateFormat: 'MM/DD/YYYY',
    temperatureUnit: 'F',
    weightUnit: 'lbs',
    heightUnit: 'ft/in',
    glucoseUnit: 'mg/dL',
    bloodPressureUnit: 'mmHg',
    distanceUnit: 'mi',
    complianceFramework: 'HIPAA',
  },
  international: {
    mode: 'international',
    dateFormat: 'DD/MM/YYYY',
    temperatureUnit: 'C',
    weightUnit: 'kg',
    heightUnit: 'cm',
    glucoseUnit: 'mmol/L',
    bloodPressureUnit: 'mmHg',
    distanceUnit: 'km',
    complianceFramework: 'GDPR',
  },
};

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', rtl: false, flag: 'US' },
  { code: 'zh', name: 'Chinese', nativeName: '\u4e2d\u6587', rtl: false, flag: 'CN' },
  { code: 'hi', name: 'Hindi', nativeName: '\u0939\u093f\u0928\u094d\u0926\u0940', rtl: false, flag: 'IN' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol', rtl: false, flag: 'ES' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais', rtl: false, flag: 'FR' },
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', rtl: true, flag: 'SA' },
  { code: 'bn', name: 'Bengali', nativeName: '\u09ac\u09be\u0982\u09b2\u09be', rtl: false, flag: 'BD' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00eas', rtl: false, flag: 'BR' },
  { code: 'ru', name: 'Russian', nativeName: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439', rtl: false, flag: 'RU' },
  { code: 'ja', name: 'Japanese', nativeName: '\u65e5\u672c\u8a9e', rtl: false, flag: 'JP' },
  { code: 'pa', name: 'Punjabi', nativeName: '\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40', rtl: false, flag: 'IN' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', rtl: false, flag: 'DE' },
  { code: 'ko', name: 'Korean', nativeName: '\ud55c\uad6d\uc5b4', rtl: false, flag: 'KR' },
  { code: 'tr', name: 'Turkish', nativeName: 'T\u00fcrk\u00e7e', rtl: false, flag: 'TR' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Ti\u1ebfng Vi\u1ec7t', rtl: false, flag: 'VN' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', rtl: false, flag: 'IT' },
  { code: 'th', name: 'Thai', nativeName: '\u0e44\u0e17\u0e22', rtl: false, flag: 'TH' },
  { code: 'ur', name: 'Urdu', nativeName: '\u0627\u0631\u062f\u0648', rtl: true, flag: 'PK' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', rtl: false, flag: 'ID' },
  { code: 'ta', name: 'Tamil', nativeName: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd', rtl: false, flag: 'IN' },
  { code: 'mr', name: 'Marathi', nativeName: '\u092e\u0930\u093e\u0920\u0940', rtl: false, flag: 'IN' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', rtl: false, flag: 'PH' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', rtl: false, flag: 'KE' },
  { code: 'fa', name: 'Farsi', nativeName: '\u0641\u0627\u0631\u0633\u06cc', rtl: true, flag: 'IR' },
  { code: 'te', name: 'Telugu', nativeName: '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41', rtl: false, flag: 'IN' },
  { code: 'ne', name: 'Nepali', nativeName: '\u0928\u0947\u092a\u093e\u0932\u0940', rtl: false, flag: 'NP' },
  { code: 'gu', name: 'Gujarati', nativeName: '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0', rtl: false, flag: 'IN' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', rtl: false, flag: 'MY' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', rtl: false, flag: 'PL' },
  { code: 'uk', name: 'Ukrainian', nativeName: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430', rtl: false, flag: 'UA' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', rtl: false, flag: 'NL' },
  { code: 'el', name: 'Greek', nativeName: '\u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac', rtl: false, flag: 'GR' },
  { code: 'he', name: 'Hebrew', nativeName: '\u05e2\u05d1\u05e8\u05d9\u05ea', rtl: true, flag: 'IL' },
  { code: 'ro', name: 'Romanian', nativeName: 'Rom\u00e2n\u0103', rtl: false, flag: 'RO' },
  { code: 'cs', name: 'Czech', nativeName: '\u010ce\u0161tina', rtl: false, flag: 'CZ' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', rtl: false, flag: 'HU' },
  { code: 'am', name: 'Amharic', nativeName: '\u12a0\u121b\u122d\u129b', rtl: false, flag: 'ET' },
  { code: 'my', name: 'Burmese', nativeName: '\u1019\u103c\u1014\u103a\u1019\u102c\u1018\u102c\u101e\u102c', rtl: false, flag: 'MM' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', rtl: false, flag: 'NG' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yor\u00f9b\u00e1', rtl: false, flag: 'NG' },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', rtl: false, flag: 'NG' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', rtl: false, flag: 'ZA' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', rtl: false, flag: 'SO' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', rtl: false, flag: 'ZA' },
  { code: 'kn', name: 'Kannada', nativeName: '\u0c95\u0ca8\u0ccd\u0ca8\u0ca1', rtl: false, flag: 'IN' },
  { code: 'ml', name: 'Malayalam', nativeName: '\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02', rtl: false, flag: 'IN' },
  { code: 'or', name: 'Odia', nativeName: '\u0b13\u0b21\u0b3f\u0b06', rtl: false, flag: 'IN' },
  { code: 'km', name: 'Khmer', nativeName: '\u1781\u17d2\u1798\u17c2\u179a', rtl: false, flag: 'KH' },
  { code: 'ps', name: 'Pashto', nativeName: '\u067e\u069a\u062a\u0648', rtl: true, flag: 'AF' },
  { code: 'ti', name: 'Tigrinya', nativeName: '\u1275\u130d\u122d\u129b', rtl: false, flag: 'ER' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Krey\u00f2l Ayisyen', rtl: false, flag: 'HT' },
  { code: 'hmn', name: 'Hmong', nativeName: 'Hmoob', rtl: false, flag: 'LA' },
];

export interface TranslationStrings {
  common: {
    loading: string;
    error: string;
    retry: string;
    cancel: string;
    save: string;
    delete: string;
    confirm: string;
    back: string;
    next: string;
    skip: string;
    done: string;
    search: string;
    noData: string;
    pullToRefresh: string;
    signOut: string;
    signIn: string;
    ok: string;
    yes: string;
    no: string;
    close: string;
    edit: string;
    add: string;
    remove: string;
    view: string;
    submit: string;
    export: string;
    share: string;
    refresh: string;
  };
  tabs: {
    home: string;
    timeline: string;
    records: string;
    sources: string;
    community: string;
    profile: string;
  };
  login: {
    title: string;
    subtitle: string;
    signInApple: string;
    signInDemo: string;
    signInEmail: string;
    createAccount: string;
    email: string;
    password: string;
    fullName: string;
    emailPlaceholder: string;
    passwordPlaceholder: string;
    namePlaceholder: string;
    noAccount: string;
    hasAccount: string;
    orContinueWith: string;
    passwordMinLength: string;
    hipaaCompliant: string;
    hipaaDescription: string;
    fhirIntegrated: string;
    fhirDescription: string;
    aiPowered: string;
    aiDescription: string;
    termsPrefix: string;
    termsOfService: string;
    and: string;
    privacyPolicy: string;
  };
  onboarding: {
    createProfile: string;
    connectRecords: string;
    generatePacket: string;
    profileQuestion: string;
    profileSelf: string;
    profileDependent: string;
    profileSelfDescription: string;
    profileDependentDescription: string;
    connectTitle: string;
    connectDescription: string;
    connectEHR: string;
    connectEHRDesc: string;
    connectWearable: string;
    connectWearableDesc: string;
    connectManual: string;
    connectManualDesc: string;
    packetTitle: string;
    packetDescription: string;
    getStarted: string;
  };
  profile: {
    title: string;
    personalInfo: string;
    myHealthRecord: string;
    myHealthRecordDesc: string;
    myProfile: string;
    myProfileDesc: string;
    healthIntake: string;
    healthIntakeDesc: string;
    healthGoals: string;
    healthGoalsDesc: string;
    healthGraph: string;
    healthGraphDesc: string;
    learningCenter: string;
    learningCenterDesc: string;
    achievements: string;
    achievementsDesc: string;
    healthOverview: string;
    healthDashboard: string;
    healthDashboardDesc: string;
    medicalTimeline: string;
    medicalTimelineDesc: string;
    healthAlerts: string;
    healthAlertsDesc: string;
    dataManagement: string;
    dedupCenter: string;
    dedupCenterDesc: string;
    securityPrivacy: string;
    biometricAuth: string;
    biometricAuthDesc: string;
    trustSecurity: string;
    trustSecurityDesc: string;
    auditLog: string;
    auditLogDesc: string;
    compliance: string;
    complianceDesc: string;
    privacyPolicy: string;
    shareExport: string;
    shareRecords: string;
    shareRecordsDesc: string;
    qrShare: string;
    qrShareDesc: string;
    exportPacket: string;
    exportPacketDesc: string;
    connectedApps: string;
    smartApps: string;
    smartAppsDesc: string;
    dataAccess: string;
    dataAccessDesc: string;
    aiInsights: string;
    aiHealthInsights: string;
    aiHealthInsightsDesc: string;
    aiDashboard: string;
    aiDashboardDesc: string;
    askHealth: string;
    askHealthDesc: string;
    workflow: string;
    workflowDesc: string;
    healthJourneys: string;
    healthJourneysDesc: string;
    carePathways: string;
    carePathwaysDesc: string;
    providerMessaging: string;
    providerMessagingDesc: string;
    wearableDevices: string;
    wearableDevicesDesc: string;
    wearableConnectors: string;
    wearableConnectorsDesc: string;
    providerCollab: string;
    providerCollabDesc: string;
    careTeam: string;
    careTeamDesc: string;
    secureMessaging: string;
    secureMessagingDesc: string;
    acoReporting: string;
    acoReportingDesc: string;
    patientDedup: string;
    patientDedupDesc: string;
    providerDashboard: string;
    providerDashboardDesc: string;
    clinicalDocs: string;
    clinicalDocsDesc: string;
    communityChallenges: string;
    healthCommunities: string;
    healthCommunitiesDesc: string;
    teamChallenges: string;
    teamChallengesDesc: string;
    developerTools: string;
    healthAnalytics: string;
    healthAnalyticsDesc: string;
    fhirConnections: string;
    fhirConnectionsDesc: string;
    fhirMonitoring: string;
    fhirMonitoringDesc: string;
    dataQuality: string;
    dataQualityDesc: string;
    fhirMapping: string;
    fhirMappingDesc: string;
    advancedSearch: string;
    advancedSearchDesc: string;
    interoperability: string;
    interoperabilityDesc: string;
    preferences: string;
    notifications: string;
    notificationsDesc: string;
    autoSync: string;
    autoSyncDesc: string;
    language: string;
    languageDesc: string;
    appearance: string;
    systemDefault: string;
    lightMode: string;
    darkMode: string;
    accessibility: string;
    accessibilityDesc: string;
    exportPdf: string;
    exportPdfDesc: string;
    signOutConfirm: string;
    signOutMessage: string;
    deleteAccount: string;
    deleteAccountDesc: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    deleteForever: string;
    version: string;
  };
  phr: {
    title: string;
    overview: string;
    conditions: string;
    medications: string;
    allergies: string;
    vaccines: string;
    labs: string;
    vitals: string;
    appointments: string;
    patientInfo: string;
    emergencyContact: string;
    summaryCards: {
      conditions: string;
      medications: string;
      allergies: string;
      vaccines: string;
      labResults: string;
      upcoming: string;
    };
    sections: {
      activeConditions: string;
      intakeDiagnoses: string;
      surgicalHistory: string;
      activeMedications: string;
      intakeMedications: string;
      knownAllergies: string;
      vaccinationRecord: string;
      labResults: string;
      vitalsHistory: string;
      upcomingAppointments: string;
      pastAppointments: string;
    };
    empty: {
      conditions: string;
      medications: string;
      allergies: string;
      vaccines: string;
      labs: string;
      vitals: string;
      appointments: string;
    };
    badges: {
      ehr: string;
      intake: string;
      tracker: string;
      self: string;
      other: string;
    };
    severity: {
      mild: string;
      moderate: string;
      severe: string;
    };
    status: {
      active: string;
      completed: string;
      scheduled: string;
      cancelled: string;
    };
  };
  records: {
    title: string;
    searchPlaceholder: string;
    allRecords: string;
    labResults: string;
    medications: string;
    conditions: string;
    vitals: string;
    immunizations: string;
    procedures: string;
    noRecords: string;
    noRecordsDesc: string;
  };
  sources: {
    title: string;
    addSource: string;
    connected: string;
    disconnected: string;
    lastSync: string;
    syncNow: string;
    noSources: string;
    noSourcesDesc: string;
  };
  timeline: {
    title: string;
    today: string;
    thisWeek: string;
    thisMonth: string;
    earlier: string;
    noEvents: string;
    noEventsDesc: string;
    aiAssistant: string;
  };
  community: {
    title: string;
    joinGroup: string;
    createPost: string;
    members: string;
    posts: string;
    discussions: string;
  };
  accessibility: {
    title: string;
    simplifiedMode: string;
    simplifiedModeDesc: string;
    largeText: string;
    largeTextDesc: string;
    highContrast: string;
    highContrastDesc: string;
    reducedMotion: string;
    reducedMotionDesc: string;
    readAloud: string;
    readAloudDesc: string;
    fontSize: string;
    fontSizeSmall: string;
    fontSizeMedium: string;
    fontSizeLarge: string;
    fontSizeExtraLarge: string;
  };
  errors: {
    networkError: string;
    serverError: string;
    unauthorized: string;
    notFound: string;
    generic: string;
    loadFailed: string;
    saveFailed: string;
    exportFailed: string;
    signInRequired: string;
  };
  medical: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
    weight: string;
    height: string;
    bmi: string;
    oxygenSaturation: string;
    respiratoryRate: string;
    glucose: string;
    cholesterol: string;
    dosage: string;
    frequency: string;
    prescribedBy: string;
    diagnosis: string;
    treatment: string;
    referral: string;
    prescription: string;
    vaccine: string;
    allergy: string;
    reaction: string;
    provider: string;
    facility: string;
    date: string;
    result: string;
    normal: string;
    abnormal: string;
    critical: string;
    pending: string;
  };
  dashboard: {
    title: string;
    vitals: string;
    accessibilityHint: string;
    lastUpdated: string;
    noData: string;
  };
  mpi: {
    checking: string;
    alert: string;
    autoMerge: string;
    conflictFail: string;
    routedToAi: string;
    confidenceHigh: string;
    confidenceLow: string;
    mergeConfirm: string;
    mergeSuccess: string;
    mergeError: string;
  };
}
