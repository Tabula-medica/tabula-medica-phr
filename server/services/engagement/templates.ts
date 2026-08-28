/**
 * Message templates, localised, each carrying its PHI tier and — where a
 * regulator or platform requires one — its registered template identity.
 *
 * The tier is declared per template rather than inferred per message, because
 * inference is exactly the thing that fails quietly: a "post-visit follow-up"
 * body is safe until someone helpfully interpolates the diagnosis into it.
 *
 * ## Registered templates
 *
 * Two regimes demand that the exact text be pre-approved before any of it can
 * be sent, and both discard unregistered traffic rather than flagging it:
 *
 *   - **TRAI DLT (India SMS).** The sender header and the template body are
 *     registered with a Distributed Ledger Technology platform; the operator
 *     drops anything that does not match a registered entry. A message that
 *     "sends successfully" and never arrives is the normal failure mode.
 *   - **Meta (WhatsApp, everywhere).** Templates go through review and carry
 *     a category — utility, marketing, authentication — that determines both
 *     price and whether the template survives.
 *
 * So each template declares `dltTemplateId` and `whatsappTemplateName`, and
 * the send gate refuses when a channel requires one that is absent. Leaving
 * them unset is the correct state for a deployment that has not registered
 * yet; what is not correct is discovering it at the operator's drop counter.
 *
 * ## What the copy deliberately does not say
 *
 * No template names a condition, medication, result value, or a department
 * that implies a diagnosis. "Your oncology appointment" is a disclosure to
 * whoever picks up the handset; "your appointment with Dr. Chen" is not.
 * Where a patient needs clinical content the message says something is ready
 * and sends them to the authenticated portal.
 *
 * ## Localisation
 *
 * Translations are hand-written. A language without one falls back to English
 * and the render reports that it did — a mistranslated appointment time is a
 * missed appointment, and machine-translating at send time turns one bad
 * string into a systematic one.
 */

import type { EngagementPurpose, PhiTier, WhatsAppCategory } from "@shared/engagement";

export interface TemplateVariables {
  practiceName: string;
  providerName?: string;
  /** Pre-formatted in the recipient's locale and timezone by the caller. */
  appointmentTime?: string;
  location?: string;
  portalUrl?: string;
}

export interface MessageTemplate {
  id: string;
  purpose: EngagementPurpose;
  tier: PhiTier;
  /** Language code -> body with {{placeholders}}. `en` is required. */
  bodies: Record<string, string>;
  /** Placeholders that must be supplied; rendering refuses without them. */
  requires: readonly (keyof TemplateVariables)[];
  /** Meta's category. Drives WhatsApp pricing and whether review passes. */
  whatsappCategory: WhatsAppCategory;
  /**
   * Name this template is registered under with Meta. Absent until the
   * deployment registers it; the gate refuses WhatsApp sends without it.
   */
  whatsappTemplateName?: string;
  /**
   * TRAI DLT template id for India SMS. Absent until registered; the gate
   * refuses India SMS sends without it rather than letting the operator drop
   * the message silently.
   */
  dltTemplateId?: string;
}

/**
 * Every outbound body carries the STOP notice. Carriers require it on the
 * first message of a campaign; including it always costs a few segments and
 * removes a class of compliance argument entirely.
 */
const STOP_NOTICE: Record<string, string> = {
  en: "Reply STOP to opt out.",
  es: "Responda STOP para darse de baja.",
  zh: "回复 STOP 退订。",
  vi: "Trả lời STOP để hủy đăng ký.",
  ko: "수신 거부하려면 STOP을 회신하세요.",
  ar: "أرسل STOP لإلغاء الاشتراك.",
  hi: "सदस्यता समाप्त करने के लिए STOP भेजें।",
  ru: "Отправьте STOP, чтобы отписаться.",
  fr: "Répondez STOP pour vous désabonner.",
  pt: "Responda STOP para cancelar.",
  bn: "বন্ধ করতে STOP পাঠান।",
  ta: "நிறுத்த STOP என அனுப்பவும்.",
  te: "ఆపడానికి STOP పంపండి.",
  mr: "थांबवण्यासाठी STOP पाठवा.",
  gu: "બંધ કરવા STOP મોકલો.",
  kn: "ನಿಲ್ಲಿಸಲು STOP ಕಳುಹಿಸಿ.",
  ml: "നിർത്താൻ STOP അയയ്ക്കുക.",
  pa: "ਬੰਦ ਕਰਨ ਲਈ STOP ਭੇਜੋ।",
  or: "ବନ୍ଦ କରିବାକୁ STOP ପଠାନ୍ତୁ।",
  as: "বন্ধ কৰিবলৈ STOP পঠিয়াওক।",
  ur: "بند کرنے کے لیے STOP بھیجیں۔",
};

export const TEMPLATES: readonly MessageTemplate[] = [
  {
    id: "appointment-reminder",
    purpose: "appointment-reminder",
    tier: "appointment-logistics",
    requires: ["practiceName", "appointmentTime"],
    bodies: {
      en: "{{practiceName}}: Reminder of your appointment on {{appointmentTime}}. Reply C to confirm or call us to reschedule.",
      es: "{{practiceName}}: Recordatorio de su cita el {{appointmentTime}}. Responda C para confirmar o llámenos para reprogramar.",
      zh: "{{practiceName}}：提醒您于 {{appointmentTime}} 的预约。回复 C 确认，或致电我们改期。",
      vi: "{{practiceName}}: Nhắc bạn có lịch hẹn vào {{appointmentTime}}. Trả lời C để xác nhận hoặc gọi cho chúng tôi để đổi lịch.",
      ko: "{{practiceName}}: {{appointmentTime}} 예약 안내입니다. 확인하려면 C를 회신하시고, 변경은 전화 주세요.",
      ar: "{{practiceName}}: تذكير بموعدك في {{appointmentTime}}. أرسل C للتأكيد أو اتصل بنا لتغيير الموعد.",
      hi: "{{practiceName}}: {{appointmentTime}} को आपके अपॉइंटमेंट की याद दिलाने हेतु। पुष्टि के लिए C भेजें या बदलने हेतु कॉल करें।",
      ru: "{{practiceName}}: Напоминание о приёме {{appointmentTime}}. Ответьте C для подтверждения или позвоните нам, чтобы перенести.",
      bn: "{{practiceName}}: {{appointmentTime}} তারিখে আপনার অ্যাপয়েন্টমেন্টের কথা মনে করিয়ে দিচ্ছি। নিশ্চিত করতে C পাঠান বা সময় বদলাতে ফোন করুন।",
      ta: "{{practiceName}}: {{appointmentTime}} அன்று உங்கள் சந்திப்பு நினைவூட்டல். உறுதிப்படுத்த C அனுப்பவும் அல்லது மாற்ற எங்களை அழைக்கவும்.",
      te: "{{practiceName}}: {{appointmentTime}}న మీ అపాయింట్‌మెంట్ గుర్తు చేస్తున్నాం. నిర్ధారించడానికి C పంపండి లేదా మార్చడానికి కాల్ చేయండి.",
      mr: "{{practiceName}}: {{appointmentTime}} रोजी तुमच्या भेटीची आठवण. निश्चित करण्यासाठी C पाठवा किंवा बदलण्यासाठी आम्हाला कॉल करा.",
      gu: "{{practiceName}}: {{appointmentTime}} ના રોજ તમારી એપોઇન્ટમેન્ટની યાદ. પુષ્ટિ કરવા C મોકલો અથવા બદલવા અમને કૉલ કરો.",
      kn: "{{practiceName}}: {{appointmentTime}} ರಂದು ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಜ್ಞಾಪನೆ. ದೃಢೀಕರಿಸಲು C ಕಳುಹಿಸಿ ಅಥವಾ ಬದಲಾಯಿಸಲು ಕರೆ ಮಾಡಿ.",
      ml: "{{practiceName}}: {{appointmentTime}}-ന് നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് ഓർമ്മപ്പെടുത്തൽ. സ്ഥിരീകരിക്കാൻ C അയയ്ക്കുക അല്ലെങ്കിൽ മാറ്റാൻ വിളിക്കുക.",
      pa: "{{practiceName}}: {{appointmentTime}} ਨੂੰ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਦੀ ਯਾਦ। ਪੁਸ਼ਟੀ ਲਈ C ਭੇਜੋ ਜਾਂ ਬਦਲਣ ਲਈ ਕਾਲ ਕਰੋ।",
      or: "{{practiceName}}: {{appointmentTime}} ରେ ଆପଣଙ୍କ ସାକ୍ଷାତ ସ୍ମାରକ। ନିଶ୍ଚିତ କରିବାକୁ C ପଠାନ୍ତୁ କିମ୍ବା ବଦଳାଇବାକୁ କଲ କରନ୍ତୁ।",
      as: "{{practiceName}}: {{appointmentTime}} তাৰিখে আপোনাৰ সাক্ষাৎৰ সোঁৱৰণি। নিশ্চিত কৰিবলৈ C পঠিয়াওক বা সলনি কৰিবলৈ ফোন কৰক।",
      ur: "{{practiceName}}: {{appointmentTime}} کو آپ کی ملاقات کی یاد دہانی۔ تصدیق کے لیے C بھیجیں یا تبدیلی کے لیے کال کریں۔",
    },
    whatsappCategory: "utility",
  },
  {
    id: "appointment-confirmation",
    purpose: "appointment-confirmation",
    tier: "appointment-logistics",
    requires: ["practiceName", "appointmentTime"],
    bodies: {
      en: "{{practiceName}}: Thank you — your appointment on {{appointmentTime}} is confirmed.",
      es: "{{practiceName}}: Gracias — su cita el {{appointmentTime}} está confirmada.",
      zh: "{{practiceName}}：谢谢，您于 {{appointmentTime}} 的预约已确认。",
      vi: "{{practiceName}}: Cảm ơn bạn — lịch hẹn vào {{appointmentTime}} đã được xác nhận.",
      ko: "{{practiceName}}: 감사합니다 — {{appointmentTime}} 예약이 확정되었습니다.",
      ar: "{{practiceName}}: شكرًا لك — تم تأكيد موعدك في {{appointmentTime}}.",
      hi: "{{practiceName}}: धन्यवाद — {{appointmentTime}} का आपका अपॉइंटमेंट पुष्ट हो गया है।",
      ru: "{{practiceName}}: Спасибо — ваш приём {{appointmentTime}} подтверждён.",
      bn: "{{practiceName}}: ধন্যবাদ — {{appointmentTime}} তারিখের আপনার অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে।",
      ta: "{{practiceName}}: நன்றி — {{appointmentTime}} அன்றைய உங்கள் சந்திப்பு உறுதி செய்யப்பட்டது.",
      te: "{{practiceName}}: ధన్యవాదాలు — {{appointmentTime}}నాటి మీ అపాయింట్‌మెంట్ నిర్ధారించబడింది.",
      mr: "{{practiceName}}: धन्यवाद — {{appointmentTime}} रोजीची तुमची भेट निश्चित झाली आहे.",
      gu: "{{practiceName}}: આભાર — {{appointmentTime}} ની તમારી એપોઇન્ટમેન્ટ પુષ્ટ થઈ છે.",
      kn: "{{practiceName}}: ಧನ್ಯವಾದಗಳು — {{appointmentTime}} ರ ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ.",
      ml: "{{practiceName}}: നന്ദി — {{appointmentTime}}-ലെ നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിച്ചു.",
      pa: "{{practiceName}}: ਧੰਨਵਾਦ — {{appointmentTime}} ਦੀ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਪੁਸ਼ਟ ਹੋ ਗਈ ਹੈ।",
      or: "{{practiceName}}: ଧନ୍ୟବାଦ — {{appointmentTime}} ର ଆପଣଙ୍କ ସାକ୍ଷାତ ନିଶ୍ଚିତ ହୋଇଛି।",
      as: "{{practiceName}}: ধন্যবাদ — {{appointmentTime}} ৰ আপোনাৰ সাক্ষাৎ নিশ্চিত হৈছে।",
      ur: "{{practiceName}}: شکریہ — {{appointmentTime}} کی آپ کی ملاقات کی تصدیق ہو گئی ہے۔",
    },
    whatsappCategory: "utility",
  },
  {
    id: "pre-visit-preparation",
    purpose: "pre-visit-preparation",
    tier: "appointment-logistics",
    requires: ["practiceName", "appointmentTime", "portalUrl"],
    bodies: {
      // Note what this does NOT do: it does not list what to bring or what to
      // stop taking. Fasting instructions and held medications are clinical
      // detail and live behind the portal login.
      en: "{{practiceName}}: Your visit on {{appointmentTime}} has preparation steps. Please sign in to review them: {{portalUrl}}",
      es: "{{practiceName}}: Su visita el {{appointmentTime}} tiene pasos de preparación. Inicie sesión para verlos: {{portalUrl}}",
      zh: "{{practiceName}}：您于 {{appointmentTime}} 的就诊有准备事项。请登录查看：{{portalUrl}}",
      vi: "{{practiceName}}: Buổi khám vào {{appointmentTime}} có các bước chuẩn bị. Vui lòng đăng nhập để xem: {{portalUrl}}",
      ko: "{{practiceName}}: {{appointmentTime}} 방문에 준비 사항이 있습니다. 로그인 후 확인하세요: {{portalUrl}}",
      ar: "{{practiceName}}: زيارتك في {{appointmentTime}} تتطلب خطوات تحضيرية. سجّل الدخول لمراجعتها: {{portalUrl}}",
      hi: "{{practiceName}}: {{appointmentTime}} की आपकी विज़िट हेतु तैयारी के चरण हैं। देखने के लिए साइन इन करें: {{portalUrl}}",
      ru: "{{practiceName}}: К приёму {{appointmentTime}} есть указания по подготовке. Войдите, чтобы их посмотреть: {{portalUrl}}",
      bn: "{{practiceName}}: {{appointmentTime}} তারিখের ভিজিটের জন্য প্রস্তুতির ধাপ রয়েছে। দেখতে সাইন ইন করুন: {{portalUrl}}",
      ta: "{{practiceName}}: {{appointmentTime}} வருகைக்கு தயாரிப்பு படிகள் உள்ளன. பார்க்க உள்நுழையவும்: {{portalUrl}}",
      te: "{{practiceName}}: {{appointmentTime}} సందర్శనకు సన్నద్ధత దశలు ఉన్నాయి. చూడటానికి సైన్ ఇన్ చేయండి: {{portalUrl}}",
      mr: "{{practiceName}}: {{appointmentTime}} च्या भेटीसाठी तयारीचे टप्पे आहेत. पाहण्यासाठी साइन इन करा: {{portalUrl}}",
      gu: "{{practiceName}}: {{appointmentTime}} ની મુલાકાત માટે તૈયારીનાં પગલાં છે. જોવા સાઇન ઇન કરો: {{portalUrl}}",
      kn: "{{practiceName}}: {{appointmentTime}} ಭೇಟಿಗೆ ಸಿದ್ಧತಾ ಹಂತಗಳಿವೆ. ನೋಡಲು ಸೈನ್ ಇನ್ ಮಾಡಿ: {{portalUrl}}",
      ml: "{{practiceName}}: {{appointmentTime}} സന്ദർശനത്തിന് തയ്യാറെടുപ്പ് ഘട്ടങ്ങളുണ്ട്. കാണാൻ സൈൻ ഇൻ ചെയ്യുക: {{portalUrl}}",
      pa: "{{practiceName}}: {{appointmentTime}} ਦੀ ਮੁਲਾਕਾਤ ਲਈ ਤਿਆਰੀ ਦੇ ਕਦਮ ਹਨ। ਦੇਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ: {{portalUrl}}",
      ur: "{{practiceName}}: {{appointmentTime}} کی ملاقات کے لیے تیاری کے مراحل ہیں۔ دیکھنے کے لیے سائن اِن کریں: {{portalUrl}}",
    },
    whatsappCategory: "utility",
  },
  {
    id: "post-visit-followup",
    purpose: "post-visit-followup",
    tier: "none",
    requires: ["practiceName", "portalUrl"],
    bodies: {
      en: "{{practiceName}}: Following up after your recent visit. Please sign in to see your care instructions: {{portalUrl}}",
      es: "{{practiceName}}: Seguimiento tras su visita reciente. Inicie sesión para ver sus indicaciones: {{portalUrl}}",
      zh: "{{practiceName}}：就诊后随访。请登录查看您的护理说明：{{portalUrl}}",
      vi: "{{practiceName}}: Theo dõi sau lần khám gần đây. Vui lòng đăng nhập để xem hướng dẫn chăm sóc: {{portalUrl}}",
      ko: "{{practiceName}}: 최근 진료 후 안내입니다. 로그인하여 케어 안내를 확인하세요: {{portalUrl}}",
      ar: "{{practiceName}}: متابعة بعد زيارتك الأخيرة. سجّل الدخول لعرض تعليمات الرعاية: {{portalUrl}}",
      hi: "{{practiceName}}: आपकी हालिया विज़िट के बाद फ़ॉलो-अप। देखभाल निर्देश देखने हेतु साइन इन करें: {{portalUrl}}",
      ru: "{{practiceName}}: Связываемся после вашего визита. Войдите, чтобы увидеть рекомендации: {{portalUrl}}",
      bn: "{{practiceName}}: আপনার সাম্প্রতিক ভিজিটের পর যোগাযোগ করছি। যত্নের নির্দেশনা দেখতে সাইন ইন করুন: {{portalUrl}}",
      ta: "{{practiceName}}: உங்கள் சமீபத்திய வருகைக்குப் பிறகு தொடர்பு. பராமரிப்பு வழிமுறைகளைக் காண உள்நுழையவும்: {{portalUrl}}",
      te: "{{practiceName}}: మీ ఇటీవలి సందర్శన తర్వాత సంప్రదిస్తున్నాం. సంరక్షణ సూచనలు చూడటానికి సైన్ ఇన్ చేయండి: {{portalUrl}}",
      mr: "{{practiceName}}: तुमच्या अलीकडील भेटीनंतर संपर्क करत आहोत. काळजी सूचना पाहण्यासाठी साइन इन करा: {{portalUrl}}",
      gu: "{{practiceName}}: તમારી તાજેતરની મુલાકાત પછી સંપર્ક કરીએ છીએ. સંભાળ સૂચનાઓ જોવા સાઇન ઇન કરો: {{portalUrl}}",
      kn: "{{practiceName}}: ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಭೇಟಿಯ ನಂತರ ಸಂಪರ್ಕಿಸುತ್ತಿದ್ದೇವೆ. ಆರೈಕೆ ಸೂಚನೆಗಳಿಗಾಗಿ ಸೈನ್ ಇನ್ ಮಾಡಿ: {{portalUrl}}",
      ml: "{{practiceName}}: നിങ്ങളുടെ സന്ദർശനത്തിനു ശേഷം ബന്ധപ്പെടുന്നു. പരിചരണ നിർദ്ദേശങ്ങൾക്കായി സൈൻ ഇൻ ചെയ്യുക: {{portalUrl}}",
      pa: "{{practiceName}}: ਤੁਹਾਡੀ ਹਾਲੀਆ ਮੁਲਾਕਾਤ ਤੋਂ ਬਾਅਦ ਸੰਪਰਕ। ਦੇਖਭਾਲ ਹਦਾਇਤਾਂ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ: {{portalUrl}}",
      ur: "{{practiceName}}: آپ کی حالیہ ملاقات کے بعد رابطہ۔ دیکھ بھال کی ہدایات کے لیے سائن اِن کریں: {{portalUrl}}",
    },
    whatsappCategory: "utility",
  },
  {
    id: "care-plan-checkin",
    purpose: "care-plan-checkin",
    tier: "none",
    requires: ["practiceName", "portalUrl"],
    bodies: {
      en: "{{practiceName}}: Time for your check-in. Please sign in to answer a few questions: {{portalUrl}}",
      es: "{{practiceName}}: Es hora de su seguimiento. Inicie sesión para responder unas preguntas: {{portalUrl}}",
      zh: "{{practiceName}}：该做随访了。请登录回答几个问题：{{portalUrl}}",
      vi: "{{practiceName}}: Đã đến lúc theo dõi. Vui lòng đăng nhập để trả lời vài câu hỏi: {{portalUrl}}",
      ko: "{{practiceName}}: 체크인할 시간입니다. 로그인하여 몇 가지 질문에 답해 주세요: {{portalUrl}}",
      ar: "{{practiceName}}: حان وقت المتابعة. سجّل الدخول للإجابة عن بعض الأسئلة: {{portalUrl}}",
      hi: "{{practiceName}}: आपके चेक-इन का समय है। कुछ प्रश्नों के उत्तर हेतु साइन इन करें: {{portalUrl}}",
      ru: "{{practiceName}}: Пора пройти опрос. Войдите, чтобы ответить на несколько вопросов: {{portalUrl}}",
      bn: "{{practiceName}}: আপনার চেক-ইনের সময় হয়েছে। কয়েকটি প্রশ্নের উত্তর দিতে সাইন ইন করুন: {{portalUrl}}",
      ta: "{{practiceName}}: உங்கள் சரிபார்ப்பு நேரம். சில கேள்விகளுக்குப் பதிலளிக்க உள்நுழையவும்: {{portalUrl}}",
      te: "{{practiceName}}: మీ చెక్-ఇన్ సమయం. కొన్ని ప్రశ్నలకు సమాధానం ఇవ్వడానికి సైన్ ఇన్ చేయండి: {{portalUrl}}",
      mr: "{{practiceName}}: तुमच्या तपासणीची वेळ झाली आहे. काही प्रश्नांची उत्तरे देण्यासाठी साइन इन करा: {{portalUrl}}",
      gu: "{{practiceName}}: તમારા ચેક-ઇનનો સમય છે. થોડા પ્રશ્નોના જવાબ આપવા સાઇન ઇન કરો: {{portalUrl}}",
      kn: "{{practiceName}}: ನಿಮ್ಮ ಚೆಕ್-ಇನ್ ಸಮಯ. ಕೆಲವು ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ: {{portalUrl}}",
      ml: "{{practiceName}}: നിങ്ങളുടെ ചെക്ക്-ഇൻ സമയമായി. ചില ചോദ്യങ്ങൾക്ക് ഉത്തരം നൽകാൻ സൈൻ ഇൻ ചെയ്യുക: {{portalUrl}}",
      pa: "{{practiceName}}: ਤੁਹਾਡੇ ਚੈੱਕ-ਇਨ ਦਾ ਸਮਾਂ ਹੈ। ਕੁਝ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ: {{portalUrl}}",
      ur: "{{practiceName}}: آپ کے چیک اِن کا وقت ہے۔ چند سوالات کے جواب کے لیے سائن اِن کریں: {{portalUrl}}",
    },
    whatsappCategory: "utility",
  },
  {
    id: "recall-reactivation",
    purpose: "recall-reactivation",
    tier: "none",
    requires: ["practiceName"],
    bodies: {
      en: "{{practiceName}}: It has been a while since your last visit. Call us to schedule when you are ready.",
      es: "{{practiceName}}: Ha pasado un tiempo desde su última visita. Llámenos para programar cuando desee.",
      zh: "{{practiceName}}：距离您上次就诊已有一段时间。方便时请致电我们预约。",
      vi: "{{practiceName}}: Đã lâu kể từ lần khám gần nhất của bạn. Hãy gọi cho chúng tôi để đặt lịch khi bạn sẵn sàng.",
      ko: "{{practiceName}}: 마지막 방문 이후 시간이 좀 지났습니다. 준비되시면 전화로 예약해 주세요.",
      ar: "{{practiceName}}: مضى وقت منذ زيارتك الأخيرة. اتصل بنا لتحديد موعد عندما تكون مستعدًا.",
      hi: "{{practiceName}}: आपकी पिछली विज़िट को कुछ समय हो गया है। तैयार होने पर अपॉइंटमेंट हेतु कॉल करें।",
      ru: "{{practiceName}}: С вашего последнего визита прошло некоторое время. Позвоните нам, чтобы записаться.",
      bn: "{{practiceName}}: আপনার শেষ ভিজিটের পর কিছু সময় হয়ে গেছে। প্রস্তুত হলে অ্যাপয়েন্টমেন্টের জন্য ফোন করুন।",
      ta: "{{practiceName}}: உங்கள் கடைசி வருகைக்குப் பிறகு சிறிது காலம் ஆகிவிட்டது. தயாராகும்போது சந்திப்புக்கு அழைக்கவும்.",
      te: "{{practiceName}}: మీ చివరి సందర్శన నుండి కొంత సమయం అయింది. సిద్ధమైనప్పుడు అపాయింట్‌మెంట్ కోసం కాల్ చేయండి.",
      mr: "{{practiceName}}: तुमच्या शेवटच्या भेटीला काही काळ झाला आहे. तयार असल्यास भेटीसाठी कॉल करा.",
      gu: "{{practiceName}}: તમારી છેલ્લી મુલાકાતને થોડો સમય થયો છે. તૈયાર હો ત્યારે એપોઇન્ટમેન્ટ માટે કૉલ કરો.",
      kn: "{{practiceName}}: ನಿಮ್ಮ ಕೊನೆಯ ಭೇಟಿಯಿಂದ ಸ್ವಲ್ಪ ಸಮಯವಾಗಿದೆ. ಸಿದ್ಧರಾದಾಗ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗೆ ಕರೆ ಮಾಡಿ.",
      ml: "{{practiceName}}: നിങ്ങളുടെ അവസാന സന്ദർശനത്തിനു ശേഷം കുറച്ചു കാലമായി. തയ്യാറാകുമ്പോൾ അപ്പോയിന്റ്മെന്റിനായി വിളിക്കുക.",
      pa: "{{practiceName}}: ਤੁਹਾਡੀ ਪਿਛਲੀ ਮੁਲਾਕਾਤ ਨੂੰ ਕੁਝ ਸਮਾਂ ਹੋ ਗਿਆ ਹੈ। ਤਿਆਰ ਹੋਣ 'ਤੇ ਮੁਲਾਕਾਤ ਲਈ ਕਾਲ ਕਰੋ।",
      ur: "{{practiceName}}: آپ کی آخری ملاقات کو کچھ عرصہ ہو گیا ہے۔ تیار ہونے پر ملاقات کے لیے کال کریں۔",
    },
    // Marketing under Meta's taxonomy, promotional under TCCCPR. Classifying
    // it honestly is what keeps it inside the promotional rules rather than
    // quietly outside them.
    whatsappCategory: "marketing",
  },
];

export function findTemplate(id: string): MessageTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

export type RenderResult =
  | { status: "rendered"; body: string; languageUsed: string; fellBackToEnglish: boolean }
  | { status: "failed"; reason: "unknown-template" | "missing-variables"; detail: string };

/**
 * Render a template into one language.
 *
 * A missing translation falls back to English and says so, rather than
 * machine-translating at send time. A missing required variable fails —
 * "Reminder of your appointment on {{appointmentTime}}" reaching a patient
 * verbatim is worse than no reminder.
 */
export function renderTemplate(
  templateId: string,
  languageCode: string,
  vars: TemplateVariables,
): RenderResult {
  const template = findTemplate(templateId);
  if (!template) {
    return { status: "failed", reason: "unknown-template", detail: `No template "${templateId}".` };
  }

  const missing = template.requires.filter((key) => {
    const value = vars[key];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length > 0) {
    return {
      status: "failed",
      reason: "missing-variables",
      detail: `Template "${templateId}" needs ${missing.join(", ")}, which ${
        missing.length === 1 ? "was" : "were"
      } not supplied. Refusing rather than sending a body with an unfilled placeholder.`,
    };
  }

  const base = languageCode.split("-")[0];
  const body = template.bodies[languageCode] ?? template.bodies[base];
  const fellBackToEnglish = body === undefined;
  const chosen = body ?? template.bodies.en;
  const languageUsed = fellBackToEnglish ? "en" : (template.bodies[languageCode] ? languageCode : base);

  const notice = STOP_NOTICE[languageUsed] ?? STOP_NOTICE.en;

  const filled = chosen.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key as keyof TemplateVariables];
    return value === undefined ? "" : String(value);
  });

  return {
    status: "rendered",
    body: `${filled} ${notice}`,
    languageUsed,
    fellBackToEnglish,
  };
}
