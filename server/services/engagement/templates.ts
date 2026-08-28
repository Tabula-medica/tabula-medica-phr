/**
 * Message templates, localised, each carrying its PHI tier.
 *
 * The tier is declared per template rather than inferred per message, because
 * inference is exactly the thing that fails quietly: a "post-visit follow-up"
 * body is safe until someone helpfully interpolates the diagnosis into it.
 * Declaring the ceiling next to the copy means a reviewer sees both at once,
 * and the send gate can refuse without reading the message.
 *
 * ## What the copy deliberately does not say
 *
 * No template names a condition, a medication, a result value, or a
 * department that implies a diagnosis. "Your oncology appointment" is a
 * disclosure to anyone who picks up the handset; "your appointment with
 * Dr. Chen" is not. Where a patient needs clinical content, the message says
 * something is ready and sends them to the portal, which is authenticated and
 * covered.
 *
 * ## Localisation
 *
 * Translations here are for the highest-volume languages in US practice and
 * are hand-written rather than machine-produced, because an appointment time
 * mistranslated is a missed appointment. Languages without a hand-written
 * translation fall back to English rather than being machine-translated at
 * send time — a wrong reminder is worse than an English one the patient can
 * ask about.
 */

import type { EngagementPurpose, PhiTier } from "@shared/engagement";

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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
