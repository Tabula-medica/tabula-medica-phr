import OpenAI from "openai";
import crypto from "crypto";
import type { SupportedLanguage } from "./unified-ai-onboarding-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][VoiceNav] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

export interface VoiceNavigationSettings {
  userId: string;
  primaryLanguage: SupportedLanguage;
  voiceEnabled: boolean;
  speechRate: "slow" | "normal" | "fast";
  voiceType: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  continuousListening: boolean;
  wakeWord: string;
  screenReaderOptimized: boolean;
  simplifiedResponses: boolean;
  confirmBeforeNavigation: boolean;
}

export interface VoiceCommand {
  id: string;
  userId: string;
  transcript: string;
  language: SupportedLanguage;
  commandType: "navigate" | "read" | "explain" | "action" | "help" | "settings" | "general";
  target?: string;
  route?: string;
  action?: string;
  confidence: number;
  timestamp: string;
}

export interface VoiceResponse {
  id: string;
  commandId: string;
  responseText: string;
  translatedText?: string;
  targetLanguage?: SupportedLanguage;
  audioBase64?: string;
  navigation?: {
    route: string;
    description: string;
  };
  actionPerformed?: string;
  requiresConfirmation?: boolean;
  followUpPrompt?: string;
  noCdsDisclaimer?: string;
}

export interface ScreenReaderContent {
  id: string;
  pageRoute: string;
  language: SupportedLanguage;
  title: string;
  summary: string;
  mainContent: string[];
  navigationHints: string[];
  interactiveElements: Array<{
    type: string;
    label: string;
    description: string;
    voiceCommand: string;
  }>;
  shortcuts: Array<{
    command: string;
    action: string;
  }>;
}

const userSettings: Map<string, VoiceNavigationSettings> = new Map();
const commandHistory: Map<string, VoiceCommand[]> = new Map();

const languageNames: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Spanish",
  zh: "Chinese",
  hi: "Hindi",
  ar: "Arabic",
  pt: "Portuguese",
  bn: "Bengali",
  ru: "Russian",
  ja: "Japanese",
  pa: "Punjabi",
  de: "German",
  ko: "Korean",
  fr: "French",
  vi: "Vietnamese",
  tl: "Tagalog",
  it: "Italian",
};

const navigationCommands: Record<string, { route: string; keywords: Record<SupportedLanguage, string[]> }> = {
  home: {
    route: "/",
    keywords: {
      en: ["home", "dashboard", "main", "start"],
      es: ["inicio", "casa", "principal"],
      zh: ["home", "main"],
      hi: ["ghar", "home"],
      ar: ["home", "main"],
      pt: ["inicio", "casa", "principal"],
      bn: ["home", "main"],
      ru: ["glavnaya", "dom", "home"],
      ja: ["home", "main"],
      pa: ["ghar", "home"],
      de: ["startseite", "home", "hauptseite"],
      ko: ["home", "main"],
      fr: ["accueil", "maison", "principal"],
      vi: ["trang chu", "home"],
      tl: ["tahanan", "home"],
      it: ["casa", "home", "principale"],
    },
  },
  timeline: {
    route: "/timeline",
    keywords: {
      en: ["timeline", "history", "events", "records"],
      es: ["linea de tiempo", "historial", "eventos"],
      zh: ["timeline", "history"],
      hi: ["samay rekha", "itihaas"],
      ar: ["timeline", "history"],
      pt: ["linha do tempo", "historico", "eventos"],
      bn: ["timeline", "itihas"],
      ru: ["khronologiya", "istoriya"],
      ja: ["timeline", "history"],
      pa: ["samay rekha", "itihas"],
      de: ["zeitlinie", "verlauf", "ereignisse"],
      ko: ["timeline", "history"],
      fr: ["chronologie", "historique", "evenements"],
      vi: ["dong thoi gian", "lich su"],
      tl: ["timeline", "kasaysayan"],
      it: ["cronologia", "storia", "eventi"],
    },
  },
  medications: {
    route: "/medications",
    keywords: {
      en: ["medications", "medicines", "drugs", "prescriptions", "pills"],
      es: ["medicamentos", "medicinas", "recetas"],
      zh: ["medications", "medicine"],
      hi: ["dawai", "medicine"],
      ar: ["medications", "medicine"],
      pt: ["medicamentos", "remedios", "receitas"],
      bn: ["osudh", "medicine"],
      ru: ["lekarstva", "medikamenty"],
      ja: ["medications", "medicine"],
      pa: ["dawai", "medicine"],
      de: ["medikamente", "arzneimittel", "rezepte"],
      ko: ["medications", "medicine"],
      fr: ["medicaments", "ordonnances"],
      vi: ["thuoc", "don thuoc"],
      tl: ["gamot", "reseta"],
      it: ["farmaci", "medicine", "ricette"],
    },
  },
  documents: {
    route: "/documents",
    keywords: {
      en: ["documents", "reports", "labs", "results", "files"],
      es: ["documentos", "informes", "resultados", "laboratorio"],
      zh: ["documents", "reports"],
      hi: ["dastavez", "reports"],
      ar: ["documents", "reports"],
      pt: ["documentos", "relatorios", "exames", "resultados"],
      bn: ["documents", "reports"],
      ru: ["dokumenty", "otchety"],
      ja: ["documents", "reports"],
      pa: ["dastavez", "reports"],
      de: ["dokumente", "berichte", "labor", "ergebnisse"],
      ko: ["documents", "reports"],
      fr: ["documents", "rapports", "analyses", "resultats"],
      vi: ["tai lieu", "bao cao", "ket qua"],
      tl: ["dokumento", "ulat", "resulta"],
      it: ["documenti", "referti", "esami", "risultati"],
    },
  },
  conditions: {
    route: "/conditions",
    keywords: {
      en: ["conditions", "diagnoses", "problems", "allergies", "health issues"],
      es: ["condiciones", "diagnosticos", "problemas", "alergias"],
      zh: ["conditions", "diagnoses"],
      hi: ["sthiti", "bimari"],
      ar: ["conditions", "diagnoses"],
      pt: ["condicoes", "diagnosticos", "problemas", "alergias"],
      bn: ["conditions", "rog"],
      ru: ["sostoyaniya", "diagnozy"],
      ja: ["conditions", "diagnoses"],
      pa: ["sthiti", "bimari"],
      de: ["erkrankungen", "diagnosen", "allergien"],
      ko: ["conditions", "diagnoses"],
      fr: ["conditions", "diagnostics", "problemes", "allergies"],
      vi: ["tinh trang", "chan doan", "di ung"],
      tl: ["kondisyon", "diagnosis", "alerdyi"],
      it: ["condizioni", "diagnosi", "problemi", "allergie"],
    },
  },
  appointments: {
    route: "/appointments",
    keywords: {
      en: ["appointments", "schedule", "visits", "calendar", "upcoming"],
      es: ["citas", "calendario", "visitas", "proximas"],
      zh: ["appointments", "schedule"],
      hi: ["appointment", "milne ka samay"],
      ar: ["appointments", "schedule"],
      pt: ["consultas", "agenda", "visitas", "calendario"],
      bn: ["appointments", "schedule"],
      ru: ["priyomy", "raspisanie", "vizity"],
      ja: ["appointments", "schedule"],
      pa: ["appointment", "milne da samaan"],
      de: ["termine", "kalender", "besuche"],
      ko: ["appointments", "schedule"],
      fr: ["rendez-vous", "calendrier", "visites"],
      vi: ["lich hen", "cuoc hen"],
      tl: ["appointment", "iskedyul"],
      it: ["appuntamenti", "calendario", "visite"],
    },
  },
  messages: {
    route: "/messages",
    keywords: {
      en: ["messages", "inbox", "mail", "communication", "chat"],
      es: ["mensajes", "bandeja", "correo", "chat"],
      zh: ["messages", "inbox"],
      hi: ["sandesh", "message"],
      ar: ["messages", "inbox"],
      pt: ["mensagens", "caixa de entrada", "correio"],
      bn: ["messages", "inbox"],
      ru: ["soobshcheniya", "pochta"],
      ja: ["messages", "inbox"],
      pa: ["sandesh", "message"],
      de: ["nachrichten", "posteingang", "mitteilungen"],
      ko: ["messages", "inbox"],
      fr: ["messages", "boite de reception", "courrier"],
      vi: ["tin nhan", "hop thu"],
      tl: ["mensahe", "inbox"],
      it: ["messaggi", "posta in arrivo"],
    },
  },
  settings: {
    route: "/settings",
    keywords: {
      en: ["settings", "preferences", "options", "configure"],
      es: ["configuracion", "preferencias", "opciones"],
      zh: ["settings", "preferences"],
      hi: ["settings", "vyavastha"],
      ar: ["settings", "preferences"],
      pt: ["configuracoes", "preferencias", "opcoes"],
      bn: ["settings", "preferences"],
      ru: ["nastroyki", "parametry"],
      ja: ["settings", "preferences"],
      pa: ["settings", "vyavastha"],
      de: ["einstellungen", "optionen"],
      ko: ["settings", "preferences"],
      fr: ["parametres", "preferences", "options"],
      vi: ["cai dat", "tuy chon"],
      tl: ["settings", "kagustuhan"],
      it: ["impostazioni", "preferenze", "opzioni"],
    },
  },
  help: {
    route: "/help",
    keywords: {
      en: ["help", "support", "assistance", "how to"],
      es: ["ayuda", "soporte", "asistencia"],
      zh: ["help", "support"],
      hi: ["madad", "sahayata"],
      ar: ["help", "support"],
      pt: ["ajuda", "suporte", "assistencia"],
      bn: ["sahayta", "help"],
      ru: ["pomoshch", "podderzhka"],
      ja: ["help", "support"],
      pa: ["madad", "sahayata"],
      de: ["hilfe", "unterstutzung"],
      ko: ["help", "support"],
      fr: ["aide", "support", "assistance"],
      vi: ["tro giup", "ho tro"],
      tl: ["tulong", "suporta"],
      it: ["aiuto", "supporto", "assistenza"],
    },
  },
};

const helpPhrases: Record<SupportedLanguage, string[]> = {
  en: ["help", "what can you do", "commands", "options"],
  es: ["ayuda", "que puedes hacer", "comandos"],
  zh: ["help", "commands"],
  hi: ["madad", "commands"],
  ar: ["help", "commands"],
  pt: ["ajuda", "o que voce pode fazer", "comandos"],
  bn: ["sahayta", "commands"],
  ru: ["pomoshch", "komandy"],
  ja: ["help", "commands"],
  pa: ["madad", "commands"],
  de: ["hilfe", "befehle", "was kannst du"],
  ko: ["help", "commands"],
  fr: ["aide", "que peux-tu faire", "commandes"],
  vi: ["tro giup", "lenh"],
  tl: ["tulong", "mga utos"],
  it: ["aiuto", "cosa puoi fare", "comandi"],
};

function generateId(): string {
  return `vn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function detectNavigationIntent(transcript: string, language: SupportedLanguage): { route: string; target: string } | null {
  const normalized = normalizeText(transcript);

  for (const [target, config] of Object.entries(navigationCommands)) {
    const keywords = config.keywords[language] || config.keywords.en;
    for (const keyword of keywords) {
      if (normalized.includes(normalizeText(keyword))) {
        return { route: config.route, target };
      }
    }
  }

  return null;
}

function detectHelpIntent(transcript: string, language: SupportedLanguage): boolean {
  const normalized = normalizeText(transcript);
  const phrases = helpPhrases[language] || helpPhrases.en;
  return phrases.some(phrase => normalized.includes(normalizeText(phrase)));
}

export function initializeUserSettings(userId: string, language: SupportedLanguage = "en"): VoiceNavigationSettings {
  const settings: VoiceNavigationSettings = {
    userId,
    primaryLanguage: language,
    voiceEnabled: true,
    speechRate: "normal",
    voiceType: "alloy",
    continuousListening: false,
    wakeWord: "Hey Tabula",
    screenReaderOptimized: false,
    simplifiedResponses: false,
    confirmBeforeNavigation: false,
  };

  userSettings.set(userId, settings);
  logHipaaAudit("VOICE_SETTINGS_INIT", userId, `Initialized voice settings for language ${language}`);
  return settings;
}

export function getUserSettings(userId: string): VoiceNavigationSettings | undefined {
  return userSettings.get(userId);
}

export function updateUserSettings(
  userId: string,
  updates: Partial<VoiceNavigationSettings>
): VoiceNavigationSettings | undefined {
  const existing = userSettings.get(userId);
  if (!existing) return undefined;

  const updated = { ...existing, ...updates };
  userSettings.set(userId, updated);
  logHipaaAudit("VOICE_SETTINGS_UPDATE", userId, `Updated voice settings: ${Object.keys(updates).join(", ")}`);
  return updated;
}

export async function processVoiceCommand(
  userId: string,
  transcript: string,
  language: SupportedLanguage = "en"
): Promise<VoiceResponse> {
  const commandId = generateId();
  const responseId = generateId();

  logHipaaAudit("VOICE_COMMAND", userId, `Processing voice command in ${language}`);

  const settings = userSettings.get(userId) || initializeUserSettings(userId, language);
  const navIntent = detectNavigationIntent(transcript, language);
  const isHelp = detectHelpIntent(transcript, language);

  let responseText = "";
  let navigation: VoiceResponse["navigation"];
  let commandType: VoiceCommand["commandType"] = "general";

  if (isHelp) {
    commandType = "help";
    responseText = await generateHelpResponse(language, settings.simplifiedResponses);
  } else if (navIntent) {
    commandType = "navigate";
    navigation = {
      route: navIntent.route,
      description: navIntent.target,
    };
    responseText = await generateNavigationResponse(navIntent.target, language);
  } else {
    responseText = await generateAIResponse(transcript, language, settings.simplifiedResponses);
  }

  const command: VoiceCommand = {
    id: commandId,
    userId,
    transcript,
    language,
    commandType,
    target: navIntent?.target,
    route: navIntent?.route,
    confidence: 0.9,
    timestamp: new Date().toISOString(),
  };

  const history = commandHistory.get(userId) || [];
  history.push(command);
  if (history.length > 50) history.shift();
  commandHistory.set(userId, history);

  const response: VoiceResponse = {
    id: responseId,
    commandId,
    responseText,
    targetLanguage: language,
    navigation,
    requiresConfirmation: settings.confirmBeforeNavigation && !!navigation,
  };

  return response;
}

async function generateHelpResponse(language: SupportedLanguage, simplified: boolean): Promise<string> {
  const helpMessages: Record<SupportedLanguage, string> = {
    en: simplified
      ? "I can help you navigate. Say: home, medications, documents, appointments, or messages."
      : "I can help you navigate your health records. Try saying: 'Go to medications', 'Show my documents', 'Check appointments', or 'Read my allergies'. You can also ask me to explain medical terms.",
    es: simplified
      ? "Puedo ayudarte a navegar. Di: inicio, medicamentos, documentos, citas, o mensajes."
      : "Puedo ayudarte a navegar tus registros de salud. Intenta decir: 'Ir a medicamentos', 'Mostrar mis documentos', 'Ver citas', o 'Leer mis alergias'.",
    zh: "I can help you navigate. Say: home, medications, documents, appointments, or messages.",
    hi: "Main aapki madad kar sakta hoon. Boliye: ghar, dawai, dastavez, appointment, ya sandesh.",
    ar: "I can help you navigate. Say: home, medications, documents, appointments, or messages.",
    pt: simplified
      ? "Posso ajudar a navegar. Diga: inicio, medicamentos, documentos, consultas, ou mensagens."
      : "Posso ajudar a navegar seus registros de saude. Tente dizer: 'Ir para medicamentos', 'Mostrar meus documentos', 'Ver consultas', ou 'Ler minhas alergias'.",
    bn: "I can help you navigate. Say: home, medications, documents, appointments, or messages.",
    ru: "Ya mogu pomoch vam navigirovat. Skazhite: domoy, lekarstva, dokumenty, priyomy, ili soobshcheniya.",
    ja: "I can help you navigate. Say: home, medications, documents, appointments, or messages.",
    pa: "Main tuhaddi madad kar sakda haan. Bolo: ghar, dawai, dastavez, appointment, ya sandesh.",
    de: simplified
      ? "Ich kann Ihnen beim Navigieren helfen. Sagen Sie: Startseite, Medikamente, Dokumente, Termine, oder Nachrichten."
      : "Ich kann Ihnen helfen, Ihre Gesundheitsakte zu navigieren. Versuchen Sie zu sagen: 'Gehe zu Medikamenten', 'Zeige meine Dokumente', 'Termine ansehen', oder 'Lies meine Allergien'.",
    ko: "I can help you navigate. Say: home, medications, documents, appointments, or messages.",
    fr: simplified
      ? "Je peux vous aider a naviguer. Dites: accueil, medicaments, documents, rendez-vous, ou messages."
      : "Je peux vous aider a naviguer dans vos dossiers de sante. Essayez de dire: 'Aller aux medicaments', 'Montrer mes documents', 'Voir mes rendez-vous', ou 'Lire mes allergies'.",
    vi: "Toi co the giup ban dieu huong. Noi: trang chu, thuoc, tai lieu, lich hen, hoac tin nhan.",
    tl: "Makakatulong ako sa pag-navigate. Sabihin mo: tahanan, gamot, dokumento, appointment, o mensahe.",
    it: simplified
      ? "Posso aiutarti a navigare. Di: casa, farmaci, documenti, appuntamenti, o messaggi."
      : "Posso aiutarti a navigare le tue cartelle cliniche. Prova a dire: 'Vai ai farmaci', 'Mostra i miei documenti', 'Vedi appuntamenti', o 'Leggi le mie allergie'.",
  };

  return helpMessages[language] || helpMessages.en;
}

async function generateNavigationResponse(target: string, language: SupportedLanguage): Promise<string> {
  const templates: Record<SupportedLanguage, (t: string) => string> = {
    en: (t) => `Taking you to ${t}.`,
    es: (t) => `Llevandote a ${t}.`,
    zh: (t) => `Taking you to ${t}.`,
    hi: (t) => `Aapko ${t} le ja raha hoon.`,
    ar: (t) => `Taking you to ${t}.`,
    pt: (t) => `Levando voce para ${t}.`,
    bn: (t) => `Apnake ${t} te niye jachi.`,
    ru: (t) => `Perekhozhu na ${t}.`,
    ja: (t) => `${t} ni ido shimasu.`,
    pa: (t) => `Tuhannu ${t} le ja riha haan.`,
    de: (t) => `Bringe Sie zu ${t}.`,
    ko: (t) => `${t}(u)ro idong hamnida.`,
    fr: (t) => `Je vous emmene a ${t}.`,
    vi: (t) => `Dang dua ban den ${t}.`,
    tl: (t) => `Dadalhin kita sa ${t}.`,
    it: (t) => `Ti porto a ${t}.`,
  };

  const template = templates[language] || templates.en;
  return template(target);
}

async function generateAIResponse(transcript: string, language: SupportedLanguage, simplified: boolean): Promise<string> {
  try {
    const languageName = languageNames[language];
    const simplificationNote = simplified ? "Use very simple language suitable for someone with limited literacy. Keep responses to 2 sentences maximum." : "";

    const systemPrompt = `You are a helpful voice assistant for Tabula Medica, a patient health records app.
Respond in ${languageName} language.
${simplificationNote}

Key behaviors:
- Explain medical terms in plain, simple language
- Be empathetic and supportive
- NEVER provide medical advice or diagnoses
- Direct patients to their healthcare providers for medical concerns
- Keep responses concise for voice (2-3 sentences max)
- Always include a reminder that you cannot provide medical advice`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      max_completion_tokens: 150,
    });

    return response.choices[0]?.message?.content || "I'm sorry, I didn't understand that. Could you please try again?";
  } catch (error) {
    console.error("[VoiceNav] AI response error:", error);
    return language === "en"
      ? "I'm sorry, I couldn't process that. Please try again or use the app navigation."
      : "Lo siento, no pude procesar eso. Por favor, intente de nuevo.";
  }
}

export function generateScreenReaderContent(pageRoute: string, language: SupportedLanguage): ScreenReaderContent {
  const id = generateId();

  const pageContent: Record<string, Omit<ScreenReaderContent, "id" | "pageRoute" | "language">> = {
    "/": {
      title: "Home Dashboard",
      summary: "Your health overview and quick actions",
      mainContent: [
        "Welcome to Tabula Medica. This is your health dashboard.",
        "You can view upcoming appointments, recent medications, and health alerts.",
        "Use voice commands or keyboard navigation to explore.",
      ],
      navigationHints: [
        "Say 'medications' to view your medicines",
        "Say 'appointments' to check your schedule",
        "Say 'documents' to view your health records",
      ],
      interactiveElements: [
        { type: "button", label: "View All Medications", description: "Opens medication list", voiceCommand: "medications" },
        { type: "button", label: "Schedule Appointment", description: "Opens appointment scheduler", voiceCommand: "schedule appointment" },
        { type: "link", label: "View Documents", description: "Opens document library", voiceCommand: "documents" },
      ],
      shortcuts: [
        { command: "M", action: "Go to medications" },
        { command: "D", action: "Go to documents" },
        { command: "A", action: "Go to appointments" },
        { command: "H", action: "Go to home" },
      ],
    },
    "/medications": {
      title: "Medications",
      summary: "Your current and past medications",
      mainContent: [
        "This page shows all your medications.",
        "Active medications are shown first, followed by past medications.",
        "Each medication shows the name, dosage, and frequency.",
      ],
      navigationHints: [
        "Say 'read medications' to hear your active medications",
        "Say 'home' to return to dashboard",
      ],
      interactiveElements: [
        { type: "list", label: "Medication List", description: "List of all medications", voiceCommand: "read medications" },
        { type: "button", label: "Add Medication", description: "Opens form to add new medication", voiceCommand: "add medication" },
      ],
      shortcuts: [
        { command: "R", action: "Read active medications" },
        { command: "H", action: "Go to home" },
      ],
    },
  };

  const content = pageContent[pageRoute] || {
    title: "Page",
    summary: "Health information page",
    mainContent: ["Use voice commands to navigate."],
    navigationHints: ["Say 'home' to return to dashboard", "Say 'help' for available commands"],
    interactiveElements: [],
    shortcuts: [{ command: "H", action: "Go to home" }],
  };

  return {
    id,
    pageRoute,
    language,
    ...content,
  };
}

export function getCommandHistory(userId: string): VoiceCommand[] {
  return commandHistory.get(userId) || [];
}

export function getSupportedLanguages(): Record<SupportedLanguage, string> {
  return languageNames;
}

console.log("[MultilingualVoiceNav] Service initialized with 16-language support and accessibility features");
