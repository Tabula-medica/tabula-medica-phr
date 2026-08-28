/**
 * Localised strings for the shared health summary.
 *
 * Hand-written, never machine-translated at render time. The same reasoning
 * as `templates.ts`: a summary is read by a clinician who may act on it, and
 * a translation service that silently degrades — or that is unreachable when
 * the page loads — produces a document whose meaning is unverifiable at the
 * moment it matters.
 *
 * The safety-critical strings here are the empty states. `notRecorded*` must
 * never read as "none": it has to say, in the reader's own language, that the
 * absence of entries is absence of information. Translating that as a bare
 * "None" would invert its meaning, so each one states the caveat explicitly
 * rather than relying on a word like "unknown" to carry it.
 */

export interface SummaryStrings {
  headingMedications: string;
  headingDiagnoses: string;
  headingAllergies: string;
  /** Empty because nobody recorded anything. Must not read as "none". */
  notRecordedMedications: string;
  notRecordedDiagnoses: string;
  notRecordedAllergies: string;
  /** Empty because somebody affirmatively said there are none. */
  attestedNoneMedications: string;
  attestedNoneDiagnoses: string;
  attestedNoneAllergies: string;
  /** Shown at the top when the allergy list is empty and unattested. */
  warningAllergiesUnknown: string;
  /** Shown when the patient shared some sections but not others. */
  warningPartialShare: string;
  generatedLabel: string;
  expiresLabel: string;
  disclaimer: string;
  /** Body of the notification that carries the link. */
  shareMessage: string;
}

const EN: SummaryStrings = {
  headingMedications: "Medications",
  headingDiagnoses: "Diagnoses",
  headingAllergies: "Allergies",
  notRecordedMedications:
    "No medications recorded. This does not mean there are none — nothing has been entered.",
  notRecordedDiagnoses:
    "No diagnoses recorded. This does not mean there are none — nothing has been entered.",
  notRecordedAllergies:
    "No allergies recorded. This does not mean there are none — nothing has been entered.",
  attestedNoneMedications: "No known medications. Confirmed by the patient.",
  attestedNoneDiagnoses: "No known diagnoses. Confirmed by the patient.",
  attestedNoneAllergies: "No known allergies. Confirmed by the patient.",
  warningAllergiesUnknown:
    "Allergy information is missing, not empty. Ask the patient before prescribing.",
  warningPartialShare:
    "The patient chose to share only part of their record. Sections not shown were withheld, not empty.",
  generatedLabel: "Generated",
  expiresLabel: "This link expires",
  disclaimer:
    "This is a patient-held summary, not a complete medical record. Confirm anything you act on.",
  shareMessage:
    "{{practiceName}}: a health summary has been shared with you. Open it here: {{shareUrl}}",
};

/**
 * Every string in every supported language. `en` is the fallback and is the
 * only entry guaranteed complete; `summaryStrings()` reports when it fell
 * back rather than doing so silently.
 */
export const SUMMARY_STRINGS: Record<string, SummaryStrings> = {
  en: EN,

  es: {
    headingMedications: "Medicamentos",
    headingDiagnoses: "Diagnósticos",
    headingAllergies: "Alergias",
    notRecordedMedications:
      "No hay medicamentos registrados. Esto no significa que no haya ninguno: no se ha introducido nada.",
    notRecordedDiagnoses:
      "No hay diagnósticos registrados. Esto no significa que no haya ninguno: no se ha introducido nada.",
    notRecordedAllergies:
      "No hay alergias registradas. Esto no significa que no haya ninguna: no se ha introducido nada.",
    attestedNoneMedications: "Sin medicamentos conocidos. Confirmado por el paciente.",
    attestedNoneDiagnoses: "Sin diagnósticos conocidos. Confirmado por el paciente.",
    attestedNoneAllergies: "Sin alergias conocidas. Confirmado por el paciente.",
    warningAllergiesUnknown:
      "Falta la información sobre alergias; no está vacía. Pregunte al paciente antes de recetar.",
    warningPartialShare:
      "El paciente eligió compartir solo parte de su historial. Las secciones no mostradas fueron omitidas, no están vacías.",
    generatedLabel: "Generado",
    expiresLabel: "Este enlace caduca",
    disclaimer:
      "Este es un resumen en poder del paciente, no un historial médico completo. Confirme todo aquello sobre lo que actúe.",
    shareMessage:
      "{{practiceName}}: se ha compartido con usted un resumen de salud. Ábralo aquí: {{shareUrl}}",
  },

  zh: {
    headingMedications: "用药",
    headingDiagnoses: "诊断",
    headingAllergies: "过敏",
    notRecordedMedications: "未记录任何用药。这并不表示没有用药——只是尚未录入。",
    notRecordedDiagnoses: "未记录任何诊断。这并不表示没有诊断——只是尚未录入。",
    notRecordedAllergies: "未记录任何过敏。这并不表示没有过敏——只是尚未录入。",
    attestedNoneMedications: "无已知用药。已由患者确认。",
    attestedNoneDiagnoses: "无已知诊断。已由患者确认。",
    attestedNoneAllergies: "无已知过敏。已由患者确认。",
    warningAllergiesUnknown: "过敏信息缺失，并非为空。开处方前请询问患者。",
    warningPartialShare: "患者选择仅共享部分记录。未显示的部分是被保留的，并非为空。",
    generatedLabel: "生成时间",
    expiresLabel: "此链接失效时间",
    disclaimer: "这是患者持有的摘要，并非完整病历。据此采取任何行动前请核实。",
    shareMessage: "{{practiceName}}：有人与您共享了一份健康摘要。请在此打开：{{shareUrl}}",
  },

  vi: {
    headingMedications: "Thuốc đang dùng",
    headingDiagnoses: "Chẩn đoán",
    headingAllergies: "Dị ứng",
    notRecordedMedications:
      "Chưa ghi nhận thuốc nào. Điều này không có nghĩa là không có — chỉ là chưa được nhập.",
    notRecordedDiagnoses:
      "Chưa ghi nhận chẩn đoán nào. Điều này không có nghĩa là không có — chỉ là chưa được nhập.",
    notRecordedAllergies:
      "Chưa ghi nhận dị ứng nào. Điều này không có nghĩa là không có — chỉ là chưa được nhập.",
    attestedNoneMedications: "Không có thuốc nào đã biết. Bệnh nhân đã xác nhận.",
    attestedNoneDiagnoses: "Không có chẩn đoán nào đã biết. Bệnh nhân đã xác nhận.",
    attestedNoneAllergies: "Không có dị ứng nào đã biết. Bệnh nhân đã xác nhận.",
    warningAllergiesUnknown:
      "Thông tin dị ứng bị thiếu, không phải là không có. Hãy hỏi bệnh nhân trước khi kê đơn.",
    warningPartialShare:
      "Bệnh nhân chọn chỉ chia sẻ một phần hồ sơ. Các mục không hiển thị là được giữ lại, không phải trống.",
    generatedLabel: "Được tạo lúc",
    expiresLabel: "Liên kết này hết hạn",
    disclaimer:
      "Đây là bản tóm tắt do bệnh nhân giữ, không phải hồ sơ y tế đầy đủ. Hãy xác nhận lại mọi điều bạn dựa vào.",
    shareMessage:
      "{{practiceName}}: một bản tóm tắt sức khỏe đã được chia sẻ với bạn. Mở tại đây: {{shareUrl}}",
  },

  ko: {
    headingMedications: "복용 약물",
    headingDiagnoses: "진단",
    headingAllergies: "알레르기",
    notRecordedMedications:
      "기록된 약물이 없습니다. 약물이 없다는 뜻이 아니라 입력되지 않았다는 뜻입니다.",
    notRecordedDiagnoses:
      "기록된 진단이 없습니다. 진단이 없다는 뜻이 아니라 입력되지 않았다는 뜻입니다.",
    notRecordedAllergies:
      "기록된 알레르기가 없습니다. 알레르기가 없다는 뜻이 아니라 입력되지 않았다는 뜻입니다.",
    attestedNoneMedications: "알려진 약물 없음. 환자가 확인했습니다.",
    attestedNoneDiagnoses: "알려진 진단 없음. 환자가 확인했습니다.",
    attestedNoneAllergies: "알려진 알레르기 없음. 환자가 확인했습니다.",
    warningAllergiesUnknown:
      "알레르기 정보가 비어 있는 것이 아니라 누락되었습니다. 처방 전에 환자에게 확인하십시오.",
    warningPartialShare:
      "환자가 기록의 일부만 공유하기로 했습니다. 표시되지 않은 항목은 비어 있는 것이 아니라 보류된 것입니다.",
    generatedLabel: "생성 시각",
    expiresLabel: "이 링크 만료",
    disclaimer:
      "이것은 환자가 보관하는 요약이며 완전한 의무기록이 아닙니다. 조치를 취하기 전에 확인하십시오.",
    shareMessage:
      "{{practiceName}}: 건강 요약이 공유되었습니다. 여기에서 열어 보세요: {{shareUrl}}",
  },

  ar: {
    headingMedications: "الأدوية",
    headingDiagnoses: "التشخيصات",
    headingAllergies: "الحساسية",
    notRecordedMedications:
      "لا توجد أدوية مسجلة. هذا لا يعني عدم وجودها — لم يُدخل أي شيء بعد.",
    notRecordedDiagnoses:
      "لا توجد تشخيصات مسجلة. هذا لا يعني عدم وجودها — لم يُدخل أي شيء بعد.",
    notRecordedAllergies:
      "لا توجد حساسية مسجلة. هذا لا يعني عدم وجودها — لم يُدخل أي شيء بعد.",
    attestedNoneMedications: "لا توجد أدوية معروفة. أكّد المريض ذلك.",
    attestedNoneDiagnoses: "لا توجد تشخيصات معروفة. أكّد المريض ذلك.",
    attestedNoneAllergies: "لا توجد حساسية معروفة. أكّد المريض ذلك.",
    warningAllergiesUnknown:
      "معلومات الحساسية مفقودة وليست فارغة. اسأل المريض قبل وصف الدواء.",
    warningPartialShare:
      "اختار المريض مشاركة جزء من سجله فقط. الأقسام غير الظاهرة محجوبة وليست فارغة.",
    generatedLabel: "تاريخ الإنشاء",
    expiresLabel: "تنتهي صلاحية هذا الرابط",
    disclaimer:
      "هذا ملخص بحوزة المريض وليس سجلاً طبياً كاملاً. تحقق من أي معلومة تبني عليها قراراً.",
    shareMessage:
      "{{practiceName}}: تمت مشاركة ملخص صحي معك. افتحه هنا: {{shareUrl}}",
  },

  ru: {
    headingMedications: "Лекарства",
    headingDiagnoses: "Диагнозы",
    headingAllergies: "Аллергии",
    notRecordedMedications:
      "Лекарства не записаны. Это не значит, что их нет, — просто ничего не внесено.",
    notRecordedDiagnoses:
      "Диагнозы не записаны. Это не значит, что их нет, — просто ничего не внесено.",
    notRecordedAllergies:
      "Аллергии не записаны. Это не значит, что их нет, — просто ничего не внесено.",
    attestedNoneMedications: "Известных лекарств нет. Подтверждено пациентом.",
    attestedNoneDiagnoses: "Известных диагнозов нет. Подтверждено пациентом.",
    attestedNoneAllergies: "Известных аллергий нет. Подтверждено пациентом.",
    warningAllergiesUnknown:
      "Сведения об аллергии отсутствуют, а не пусты. Спросите пациента до назначения.",
    warningPartialShare:
      "Пациент решил поделиться только частью записи. Непоказанные разделы скрыты, а не пусты.",
    generatedLabel: "Создано",
    expiresLabel: "Срок действия ссылки истекает",
    disclaimer:
      "Это сводка, которую ведёт пациент, а не полная медицинская карта. Проверяйте всё, на чём основываете решения.",
    shareMessage:
      "{{practiceName}}: с вами поделились медицинской сводкой. Откройте её здесь: {{shareUrl}}",
  },

  hi: {
    headingMedications: "दवाइयाँ",
    headingDiagnoses: "निदान",
    headingAllergies: "एलर्जी",
    notRecordedMedications:
      "कोई दवा दर्ज नहीं है। इसका अर्थ यह नहीं कि कोई दवा नहीं है — कुछ भी दर्ज नहीं किया गया।",
    notRecordedDiagnoses:
      "कोई निदान दर्ज नहीं है। इसका अर्थ यह नहीं कि कोई निदान नहीं है — कुछ भी दर्ज नहीं किया गया।",
    notRecordedAllergies:
      "कोई एलर्जी दर्ज नहीं है। इसका अर्थ यह नहीं कि कोई एलर्जी नहीं है — कुछ भी दर्ज नहीं किया गया।",
    attestedNoneMedications: "कोई ज्ञात दवा नहीं। रोगी द्वारा पुष्ट।",
    attestedNoneDiagnoses: "कोई ज्ञात निदान नहीं। रोगी द्वारा पुष्ट।",
    attestedNoneAllergies: "कोई ज्ञात एलर्जी नहीं। रोगी द्वारा पुष्ट।",
    warningAllergiesUnknown:
      "एलर्जी की जानकारी अनुपलब्ध है, खाली नहीं। दवा लिखने से पहले रोगी से पूछें।",
    warningPartialShare:
      "रोगी ने अपने रिकॉर्ड का केवल कुछ भाग साझा करना चुना। न दिखाए गए भाग रोके गए हैं, खाली नहीं।",
    generatedLabel: "बनाया गया",
    expiresLabel: "यह लिंक समाप्त होगा",
    disclaimer:
      "यह रोगी के पास रखा सारांश है, पूरा चिकित्सा रिकॉर्ड नहीं। जिस पर भी कार्रवाई करें उसकी पुष्टि करें।",
    shareMessage:
      "{{practiceName}}: आपके साथ एक स्वास्थ्य सारांश साझा किया गया है। इसे यहाँ खोलें: {{shareUrl}}",
  },

  bn: {
    headingMedications: "ওষুধ",
    headingDiagnoses: "রোগনির্ণয়",
    headingAllergies: "অ্যালার্জি",
    notRecordedMedications:
      "কোনো ওষুধ নথিভুক্ত নেই। এর অর্থ এই নয় যে কোনো ওষুধ নেই — কিছুই লেখা হয়নি।",
    notRecordedDiagnoses:
      "কোনো রোগনির্ণয় নথিভুক্ত নেই। এর অর্থ এই নয় যে কোনোটি নেই — কিছুই লেখা হয়নি।",
    notRecordedAllergies:
      "কোনো অ্যালার্জি নথিভুক্ত নেই। এর অর্থ এই নয় যে কোনোটি নেই — কিছুই লেখা হয়নি।",
    attestedNoneMedications: "জানা কোনো ওষুধ নেই। রোগী নিশ্চিত করেছেন।",
    attestedNoneDiagnoses: "জানা কোনো রোগনির্ণয় নেই। রোগী নিশ্চিত করেছেন।",
    attestedNoneAllergies: "জানা কোনো অ্যালার্জি নেই। রোগী নিশ্চিত করেছেন।",
    warningAllergiesUnknown:
      "অ্যালার্জির তথ্য অনুপস্থিত, ফাঁকা নয়। ওষুধ লেখার আগে রোগীকে জিজ্ঞাসা করুন।",
    warningPartialShare:
      "রোগী তাঁর রেকর্ডের কেবল অংশ ভাগ করেছেন। যা দেখানো হয়নি তা আটকে রাখা হয়েছে, ফাঁকা নয়।",
    generatedLabel: "তৈরি হয়েছে",
    expiresLabel: "এই লিঙ্কের মেয়াদ শেষ হবে",
    disclaimer:
      "এটি রোগীর কাছে রাখা সারসংক্ষেপ, সম্পূর্ণ চিকিৎসা নথি নয়। যা অনুসরণ করবেন তা যাচাই করুন।",
    shareMessage:
      "{{practiceName}}: আপনার সঙ্গে একটি স্বাস্থ্য সারসংক্ষেপ ভাগ করা হয়েছে। এখানে খুলুন: {{shareUrl}}",
  },

  ta: {
    headingMedications: "மருந்துகள்",
    headingDiagnoses: "நோய் கண்டறிதல்",
    headingAllergies: "ஒவ்வாமை",
    notRecordedMedications:
      "மருந்துகள் பதிவு செய்யப்படவில்லை. மருந்துகள் இல்லை என்று இது பொருள் அல்ல — எதுவும் உள்ளிடப்படவில்லை.",
    notRecordedDiagnoses:
      "நோய் கண்டறிதல் பதிவு செய்யப்படவில்லை. எதுவும் இல்லை என்று இது பொருள் அல்ல — எதுவும் உள்ளிடப்படவில்லை.",
    notRecordedAllergies:
      "ஒவ்வாமை பதிவு செய்யப்படவில்லை. ஒவ்வாமை இல்லை என்று இது பொருள் அல்ல — எதுவும் உள்ளிடப்படவில்லை.",
    attestedNoneMedications: "அறியப்பட்ட மருந்துகள் இல்லை. நோயாளி உறுதிப்படுத்தினார்.",
    attestedNoneDiagnoses: "அறியப்பட்ட நோய் கண்டறிதல் இல்லை. நோயாளி உறுதிப்படுத்தினார்.",
    attestedNoneAllergies: "அறியப்பட்ட ஒவ்வாமை இல்லை. நோயாளி உறுதிப்படுத்தினார்.",
    warningAllergiesUnknown:
      "ஒவ்வாமைத் தகவல் காணவில்லை, காலியாக இல்லை. மருந்து எழுதும் முன் நோயாளியிடம் கேளுங்கள்.",
    warningPartialShare:
      "நோயாளி தமது பதிவின் ஒரு பகுதியை மட்டுமே பகிர்ந்துள்ளார். காட்டப்படாத பகுதிகள் தடுக்கப்பட்டவை, காலியானவை அல்ல.",
    generatedLabel: "உருவாக்கப்பட்டது",
    expiresLabel: "இந்த இணைப்பு காலாவதியாகும்",
    disclaimer:
      "இது நோயாளியிடம் உள்ள சுருக்கம், முழு மருத்துவப் பதிவு அல்ல. செயல்படுத்தும் முன் உறுதிப்படுத்தவும்.",
    shareMessage:
      "{{practiceName}}: உங்களுடன் ஒரு சுகாதாரச் சுருக்கம் பகிரப்பட்டுள்ளது. இங்கே திறக்கவும்: {{shareUrl}}",
  },

  te: {
    headingMedications: "మందులు",
    headingDiagnoses: "నిర్ధారణలు",
    headingAllergies: "అలర్జీలు",
    notRecordedMedications:
      "మందులు నమోదు కాలేదు. మందులు లేవని దీని అర్థం కాదు — ఏదీ నమోదు చేయలేదు.",
    notRecordedDiagnoses:
      "నిర్ధారణలు నమోదు కాలేదు. ఏవీ లేవని దీని అర్థం కాదు — ఏదీ నమోదు చేయలేదు.",
    notRecordedAllergies:
      "అలర్జీలు నమోదు కాలేదు. అలర్జీలు లేవని దీని అర్థం కాదు — ఏదీ నమోదు చేయలేదు.",
    attestedNoneMedications: "తెలిసిన మందులు లేవు. రోగి ధృవీకరించారు.",
    attestedNoneDiagnoses: "తెలిసిన నిర్ధారణలు లేవు. రోగి ధృవీకరించారు.",
    attestedNoneAllergies: "తెలిసిన అలర్జీలు లేవు. రోగి ధృవీకరించారు.",
    warningAllergiesUnknown:
      "అలర్జీ సమాచారం లేదు, ఖాళీ కాదు. మందు రాసే ముందు రోగిని అడగండి.",
    warningPartialShare:
      "రోగి తన రికార్డులో కొంత భాగాన్ని మాత్రమే పంచుకున్నారు. చూపని విభాగాలు నిలిపివేయబడ్డాయి, ఖాళీ కాదు.",
    generatedLabel: "రూపొందించినది",
    expiresLabel: "ఈ లింక్ గడువు ముగుస్తుంది",
    disclaimer:
      "ఇది రోగి వద్ద ఉన్న సారాంశం, పూర్తి వైద్య రికార్డు కాదు. దేనిపైనైనా చర్య తీసుకునే ముందు ధృవీకరించండి.",
    shareMessage:
      "{{practiceName}}: మీతో ఆరోగ్య సారాంశం పంచుకోబడింది. ఇక్కడ తెరవండి: {{shareUrl}}",
  },

  mr: {
    headingMedications: "औषधे",
    headingDiagnoses: "निदान",
    headingAllergies: "ॲलर्जी",
    notRecordedMedications:
      "कोणतीही औषधे नोंदवलेली नाहीत. याचा अर्थ औषधे नाहीत असा नाही — काहीही नोंदवले गेलेले नाही.",
    notRecordedDiagnoses:
      "कोणतेही निदान नोंदवलेले नाही. याचा अर्थ निदान नाही असा नाही — काहीही नोंदवले गेलेले नाही.",
    notRecordedAllergies:
      "कोणतीही ॲलर्जी नोंदवलेली नाही. याचा अर्थ ॲलर्जी नाही असा नाही — काहीही नोंदवले गेलेले नाही.",
    attestedNoneMedications: "ज्ञात औषधे नाहीत. रुग्णाने पुष्टी केली.",
    attestedNoneDiagnoses: "ज्ञात निदान नाही. रुग्णाने पुष्टी केली.",
    attestedNoneAllergies: "ज्ञात ॲलर्जी नाही. रुग्णाने पुष्टी केली.",
    warningAllergiesUnknown:
      "ॲलर्जीची माहिती उपलब्ध नाही, रिकामी नाही. औषध लिहिण्यापूर्वी रुग्णाला विचारा.",
    warningPartialShare:
      "रुग्णाने नोंदीचा फक्त काही भाग सामायिक केला. न दाखवलेले भाग रोखले आहेत, रिकामे नाहीत.",
    generatedLabel: "तयार केले",
    expiresLabel: "ही लिंक कालबाह्य होईल",
    disclaimer:
      "हा रुग्णाकडील सारांश आहे, संपूर्ण वैद्यकीय नोंद नाही. कृती करण्यापूर्वी खात्री करा.",
    shareMessage:
      "{{practiceName}}: तुमच्यासोबत आरोग्य सारांश सामायिक केला आहे. येथे उघडा: {{shareUrl}}",
  },

  gu: {
    headingMedications: "દવાઓ",
    headingDiagnoses: "નિદાન",
    headingAllergies: "એલર્જી",
    notRecordedMedications:
      "કોઈ દવા નોંધાયેલી નથી. આનો અર્થ એ નથી કે દવા નથી — કશું દાખલ થયું નથી.",
    notRecordedDiagnoses:
      "કોઈ નિદાન નોંધાયેલું નથી. આનો અર્થ એ નથી કે નિદાન નથી — કશું દાખલ થયું નથી.",
    notRecordedAllergies:
      "કોઈ એલર્જી નોંધાયેલી નથી. આનો અર્થ એ નથી કે એલર્જી નથી — કશું દાખલ થયું નથી.",
    attestedNoneMedications: "કોઈ જાણીતી દવા નથી. દર્દીએ પુષ્ટિ કરી.",
    attestedNoneDiagnoses: "કોઈ જાણીતું નિદાન નથી. દર્દીએ પુષ્ટિ કરી.",
    attestedNoneAllergies: "કોઈ જાણીતી એલર્જી નથી. દર્દીએ પુષ્ટિ કરી.",
    warningAllergiesUnknown:
      "એલર્જીની માહિતી ગુમ છે, ખાલી નથી. દવા લખતા પહેલાં દર્દીને પૂછો.",
    warningPartialShare:
      "દર્દીએ પોતાના રેકોર્ડનો માત્ર અમુક ભાગ શેર કર્યો. ન બતાવેલા વિભાગો રોકી રખાયા છે, ખાલી નથી.",
    generatedLabel: "બનાવ્યું",
    expiresLabel: "આ લિંક સમાપ્ત થશે",
    disclaimer:
      "આ દર્દી પાસેનો સારાંશ છે, સંપૂર્ણ તબીબી રેકોર્ડ નથી. કાર્યવાહી પહેલાં ખાતરી કરો.",
    shareMessage:
      "{{practiceName}}: તમારી સાથે આરોગ્ય સારાંશ શેર કરાયો છે. અહીં ખોલો: {{shareUrl}}",
  },

  kn: {
    headingMedications: "ಔಷಧಿಗಳು",
    headingDiagnoses: "ರೋಗನಿರ್ಣಯಗಳು",
    headingAllergies: "ಅಲರ್ಜಿಗಳು",
    notRecordedMedications:
      "ಯಾವುದೇ ಔಷಧಿ ದಾಖಲಾಗಿಲ್ಲ. ಔಷಧಿಗಳಿಲ್ಲ ಎಂದು ಇದರ ಅರ್ಥವಲ್ಲ — ಏನನ್ನೂ ನಮೂದಿಸಿಲ್ಲ.",
    notRecordedDiagnoses:
      "ಯಾವುದೇ ರೋಗನಿರ್ಣಯ ದಾಖಲಾಗಿಲ್ಲ. ಯಾವುದೂ ಇಲ್ಲ ಎಂದು ಇದರ ಅರ್ಥವಲ್ಲ — ಏನನ್ನೂ ನಮೂದಿಸಿಲ್ಲ.",
    notRecordedAllergies:
      "ಯಾವುದೇ ಅಲರ್ಜಿ ದಾಖಲಾಗಿಲ್ಲ. ಅಲರ್ಜಿ ಇಲ್ಲ ಎಂದು ಇದರ ಅರ್ಥವಲ್ಲ — ಏನನ್ನೂ ನಮೂದಿಸಿಲ್ಲ.",
    attestedNoneMedications: "ತಿಳಿದಿರುವ ಔಷಧಿಗಳಿಲ್ಲ. ರೋಗಿ ದೃಢಪಡಿಸಿದ್ದಾರೆ.",
    attestedNoneDiagnoses: "ತಿಳಿದಿರುವ ರೋಗನಿರ್ಣಯಗಳಿಲ್ಲ. ರೋಗಿ ದೃಢಪಡಿಸಿದ್ದಾರೆ.",
    attestedNoneAllergies: "ತಿಳಿದಿರುವ ಅಲರ್ಜಿಗಳಿಲ್ಲ. ರೋಗಿ ದೃಢಪಡಿಸಿದ್ದಾರೆ.",
    warningAllergiesUnknown:
      "ಅಲರ್ಜಿ ಮಾಹಿತಿ ಕಾಣೆಯಾಗಿದೆ, ಖಾಲಿಯಲ್ಲ. ಔಷಧಿ ಬರೆಯುವ ಮೊದಲು ರೋಗಿಯನ್ನು ಕೇಳಿ.",
    warningPartialShare:
      "ರೋಗಿ ತಮ್ಮ ದಾಖಲೆಯ ಒಂದು ಭಾಗವನ್ನಷ್ಟೇ ಹಂಚಿಕೊಂಡಿದ್ದಾರೆ. ತೋರಿಸದ ವಿಭಾಗಗಳನ್ನು ತಡೆಹಿಡಿಯಲಾಗಿದೆ, ಖಾಲಿಯಲ್ಲ.",
    generatedLabel: "ರಚಿಸಲಾಗಿದೆ",
    expiresLabel: "ಈ ಕೊಂಡಿ ಅವಧಿ ಮುಗಿಯುತ್ತದೆ",
    disclaimer:
      "ಇದು ರೋಗಿಯ ಬಳಿ ಇರುವ ಸಾರಾಂಶ, ಸಂಪೂರ್ಣ ವೈದ್ಯಕೀಯ ದಾಖಲೆಯಲ್ಲ. ಕ್ರಮ ಕೈಗೊಳ್ಳುವ ಮೊದಲು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
    shareMessage:
      "{{practiceName}}: ನಿಮ್ಮೊಂದಿಗೆ ಆರೋಗ್ಯ ಸಾರಾಂಶ ಹಂಚಲಾಗಿದೆ. ಇಲ್ಲಿ ತೆರೆಯಿರಿ: {{shareUrl}}",
  },

  ml: {
    headingMedications: "മരുന്നുകൾ",
    headingDiagnoses: "രോഗനിർണയങ്ങൾ",
    headingAllergies: "അലർജികൾ",
    notRecordedMedications:
      "മരുന്നുകളൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല. മരുന്നുകളില്ല എന്നല്ല ഇതിനർത്ഥം — ഒന്നും നൽകിയിട്ടില്ല.",
    notRecordedDiagnoses:
      "രോഗനിർണയങ്ങളൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല. ഒന്നുമില്ല എന്നല്ല ഇതിനർത്ഥം — ഒന്നും നൽകിയിട്ടില്ല.",
    notRecordedAllergies:
      "അലർജികളൊന്നും രേഖപ്പെടുത്തിയിട്ടില്ല. അലർജിയില്ല എന്നല്ല ഇതിനർത്ഥം — ഒന്നും നൽകിയിട്ടില്ല.",
    attestedNoneMedications: "അറിയപ്പെടുന്ന മരുന്നുകളില്ല. രോഗി സ്ഥിരീകരിച്ചു.",
    attestedNoneDiagnoses: "അറിയപ്പെടുന്ന രോഗനിർണയങ്ങളില്ല. രോഗി സ്ഥിരീകരിച്ചു.",
    attestedNoneAllergies: "അറിയപ്പെടുന്ന അലർജികളില്ല. രോഗി സ്ഥിരീകരിച്ചു.",
    warningAllergiesUnknown:
      "അലർജി വിവരം കാണുന്നില്ല, ശൂന്യമല്ല. മരുന്ന് കുറിക്കുന്നതിന് മുൻപ് രോഗിയോട് ചോദിക്കുക.",
    warningPartialShare:
      "രോഗി രേഖയുടെ ഒരു ഭാഗം മാത്രമാണ് പങ്കിട്ടത്. കാണിക്കാത്ത ഭാഗങ്ങൾ തടഞ്ഞുവച്ചവയാണ്, ശൂന്യമല്ല.",
    generatedLabel: "സൃഷ്ടിച്ചത്",
    expiresLabel: "ഈ ലിങ്ക് കാലഹരണപ്പെടും",
    disclaimer:
      "ഇത് രോഗിയുടെ കൈവശമുള്ള സംഗ്രഹമാണ്, പൂർണ്ണ മെഡിക്കൽ രേഖയല്ല. നടപടിയെടുക്കും മുൻപ് ഉറപ്പാക്കുക.",
    shareMessage:
      "{{practiceName}}: നിങ്ങളുമായി ഒരു ആരോഗ്യ സംഗ്രഹം പങ്കിട്ടിരിക്കുന്നു. ഇവിടെ തുറക്കുക: {{shareUrl}}",
  },

  pa: {
    headingMedications: "ਦਵਾਈਆਂ",
    headingDiagnoses: "ਨਿਦਾਨ",
    headingAllergies: "ਐਲਰਜੀ",
    notRecordedMedications:
      "ਕੋਈ ਦਵਾਈ ਦਰਜ ਨਹੀਂ ਹੈ। ਇਸਦਾ ਮਤਲਬ ਇਹ ਨਹੀਂ ਕਿ ਕੋਈ ਦਵਾਈ ਨਹੀਂ — ਕੁਝ ਵੀ ਦਰਜ ਨਹੀਂ ਕੀਤਾ ਗਿਆ।",
    notRecordedDiagnoses:
      "ਕੋਈ ਨਿਦਾਨ ਦਰਜ ਨਹੀਂ ਹੈ। ਇਸਦਾ ਮਤਲਬ ਇਹ ਨਹੀਂ ਕਿ ਕੋਈ ਨਹੀਂ — ਕੁਝ ਵੀ ਦਰਜ ਨਹੀਂ ਕੀਤਾ ਗਿਆ।",
    notRecordedAllergies:
      "ਕੋਈ ਐਲਰਜੀ ਦਰਜ ਨਹੀਂ ਹੈ। ਇਸਦਾ ਮਤਲਬ ਇਹ ਨਹੀਂ ਕਿ ਕੋਈ ਐਲਰਜੀ ਨਹੀਂ — ਕੁਝ ਵੀ ਦਰਜ ਨਹੀਂ ਕੀਤਾ ਗਿਆ।",
    attestedNoneMedications: "ਕੋਈ ਜਾਣੀ-ਪਛਾਣੀ ਦਵਾਈ ਨਹੀਂ। ਮਰੀਜ਼ ਨੇ ਪੁਸ਼ਟੀ ਕੀਤੀ।",
    attestedNoneDiagnoses: "ਕੋਈ ਜਾਣਿਆ-ਪਛਾਣਿਆ ਨਿਦਾਨ ਨਹੀਂ। ਮਰੀਜ਼ ਨੇ ਪੁਸ਼ਟੀ ਕੀਤੀ।",
    attestedNoneAllergies: "ਕੋਈ ਜਾਣੀ-ਪਛਾਣੀ ਐਲਰਜੀ ਨਹੀਂ। ਮਰੀਜ਼ ਨੇ ਪੁਸ਼ਟੀ ਕੀਤੀ।",
    warningAllergiesUnknown:
      "ਐਲਰਜੀ ਦੀ ਜਾਣਕਾਰੀ ਗੈਰਹਾਜ਼ਰ ਹੈ, ਖਾਲੀ ਨਹੀਂ। ਦਵਾਈ ਲਿਖਣ ਤੋਂ ਪਹਿਲਾਂ ਮਰੀਜ਼ ਨੂੰ ਪੁੱਛੋ।",
    warningPartialShare:
      "ਮਰੀਜ਼ ਨੇ ਆਪਣੇ ਰਿਕਾਰਡ ਦਾ ਸਿਰਫ਼ ਕੁਝ ਹਿੱਸਾ ਸਾਂਝਾ ਕੀਤਾ। ਨਾ ਦਿਖਾਏ ਹਿੱਸੇ ਰੋਕੇ ਗਏ ਹਨ, ਖਾਲੀ ਨਹੀਂ।",
    generatedLabel: "ਬਣਾਇਆ ਗਿਆ",
    expiresLabel: "ਇਹ ਲਿੰਕ ਖਤਮ ਹੋਵੇਗਾ",
    disclaimer:
      "ਇਹ ਮਰੀਜ਼ ਕੋਲ ਰੱਖਿਆ ਸਾਰ ਹੈ, ਪੂਰਾ ਮੈਡੀਕਲ ਰਿਕਾਰਡ ਨਹੀਂ। ਕਾਰਵਾਈ ਤੋਂ ਪਹਿਲਾਂ ਪੁਸ਼ਟੀ ਕਰੋ।",
    shareMessage:
      "{{practiceName}}: ਤੁਹਾਡੇ ਨਾਲ ਸਿਹਤ ਸਾਰ ਸਾਂਝਾ ਕੀਤਾ ਗਿਆ ਹੈ। ਇੱਥੇ ਖੋਲ੍ਹੋ: {{shareUrl}}",
  },

  or: {
    headingMedications: "ଔଷଧ",
    headingDiagnoses: "ରୋଗ ନିର୍ଣ୍ଣୟ",
    headingAllergies: "ଆଲର୍ଜି",
    notRecordedMedications:
      "କୌଣସି ଔଷଧ ଲିପିବଦ୍ଧ ନାହିଁ। ଏହାର ଅର୍ଥ ନୁହେଁ ଯେ ଔଷଧ ନାହିଁ — କିଛି ପ୍ରବିଷ୍ଟ କରାଯାଇ ନାହିଁ।",
    notRecordedDiagnoses:
      "କୌଣସି ରୋଗ ନିର୍ଣ୍ଣୟ ଲିପିବଦ୍ଧ ନାହିଁ। ଏହାର ଅର୍ଥ ନୁହେଁ ଯେ କିଛି ନାହିଁ — କିଛି ପ୍ରବିଷ୍ଟ କରାଯାଇ ନାହିଁ।",
    notRecordedAllergies:
      "କୌଣସି ଆଲର୍ଜି ଲିପିବଦ୍ଧ ନାହିଁ। ଏହାର ଅର୍ଥ ନୁହେଁ ଯେ ଆଲର୍ଜି ନାହିଁ — କିଛି ପ୍ରବିଷ୍ଟ କରାଯାଇ ନାହିଁ।",
    attestedNoneMedications: "ଜଣା ଔଷଧ ନାହିଁ। ରୋଗୀ ନିଶ୍ଚିତ କରିଛନ୍ତି।",
    attestedNoneDiagnoses: "ଜଣା ରୋଗ ନିର୍ଣ୍ଣୟ ନାହିଁ। ରୋଗୀ ନିଶ୍ଚିତ କରିଛନ୍ତି।",
    attestedNoneAllergies: "ଜଣା ଆଲର୍ଜି ନାହିଁ। ରୋଗୀ ନିଶ୍ଚିତ କରିଛନ୍ତି।",
    warningAllergiesUnknown:
      "ଆଲର୍ଜି ସୂଚନା ଅନୁପସ୍ଥିତ, ଖାଲି ନୁହେଁ। ଔଷଧ ଲେଖିବା ପୂର୍ବରୁ ରୋଗୀଙ୍କୁ ପଚାରନ୍ତୁ।",
    warningPartialShare:
      "ରୋଗୀ ନିଜ ରେକର୍ଡର କେବଳ କିଛି ଅଂଶ ସେୟାର କରିଛନ୍ତି। ଦେଖାଯାଇ ନଥିବା ଅଂଶ ଅଟକାଯାଇଛି, ଖାଲି ନୁହେଁ।",
    generatedLabel: "ପ୍ରସ୍ତୁତ",
    expiresLabel: "ଏହି ଲିଙ୍କ ମିଆଦ ପୂର୍ଣ୍ଣ ହେବ",
    disclaimer:
      "ଏହା ରୋଗୀଙ୍କ ପାଖରେ ଥିବା ସାରାଂଶ, ସମ୍ପୂର୍ଣ୍ଣ ଚିକିତ୍ସା ରେକର୍ଡ ନୁହେଁ। କାର୍ଯ୍ୟ କରିବା ପୂର୍ବରୁ ନିଶ୍ଚିତ କରନ୍ତୁ।",
    shareMessage:
      "{{practiceName}}: ଆପଣଙ୍କ ସହ ଏକ ସ୍ୱାସ୍ଥ୍ୟ ସାରାଂଶ ସେୟାର କରାଯାଇଛି। ଏଠାରେ ଖୋଲନ୍ତୁ: {{shareUrl}}",
  },

  as: {
    headingMedications: "ঔষধ",
    headingDiagnoses: "ৰোগ নিৰ্ণয়",
    headingAllergies: "এলাৰ্জি",
    notRecordedMedications:
      "কোনো ঔষধ লিপিবদ্ধ কৰা হোৱা নাই। ইয়াৰ অৰ্থ এইটো নহয় যে ঔষধ নাই — একোৱে প্ৰৱিষ্ট কৰা হোৱা নাই।",
    notRecordedDiagnoses:
      "কোনো ৰোগ নিৰ্ণয় লিপিবদ্ধ কৰা হোৱা নাই। ইয়াৰ অৰ্থ এইটো নহয় যে একো নাই — একোৱে প্ৰৱিষ্ট কৰা হোৱা নাই।",
    notRecordedAllergies:
      "কোনো এলাৰ্জি লিপিবদ্ধ কৰা হোৱা নাই। ইয়াৰ অৰ্থ এইটো নহয় যে এলাৰ্জি নাই — একোৱে প্ৰৱিষ্ট কৰা হোৱা নাই।",
    attestedNoneMedications: "জনাজাত কোনো ঔষধ নাই। ৰোগীয়ে নিশ্চিত কৰিছে।",
    attestedNoneDiagnoses: "জনাজাত কোনো ৰোগ নিৰ্ণয় নাই। ৰোগীয়ে নিশ্চিত কৰিছে।",
    attestedNoneAllergies: "জনাজাত কোনো এলাৰ্জি নাই। ৰোগীয়ে নিশ্চিত কৰিছে।",
    warningAllergiesUnknown:
      "এলাৰ্জিৰ তথ্য অনুপস্থিত, খালী নহয়। ঔষধ লিখাৰ আগতে ৰোগীক সোধক।",
    warningPartialShare:
      "ৰোগীয়ে নিজৰ ৰেকৰ্ডৰ কেৱল কিছু অংশ ভাগ কৰিছে। দেখুওৱা নোহোৱা অংশবোৰ ৰখা হৈছে, খালী নহয়।",
    generatedLabel: "প্ৰস্তুত কৰা হৈছে",
    expiresLabel: "এই লিংকৰ ম্যাদ শেষ হ'ব",
    disclaimer:
      "এইটো ৰোগীৰ হাতত থকা সাৰাংশ, সম্পূৰ্ণ চিকিৎসা ৰেকৰ্ড নহয়। ব্যৱস্থা লোৱাৰ আগতে নিশ্চিত কৰক।",
    shareMessage:
      "{{practiceName}}: আপোনাৰ সৈতে এটা স্বাস্থ্য সাৰাংশ ভাগ কৰা হৈছে। ইয়াত খোলক: {{shareUrl}}",
  },

  ur: {
    headingMedications: "ادویات",
    headingDiagnoses: "تشخیص",
    headingAllergies: "الرجی",
    notRecordedMedications:
      "کوئی دوا درج نہیں ہے۔ اس کا مطلب یہ نہیں کہ کوئی دوا نہیں — کچھ درج ہی نہیں کیا گیا۔",
    notRecordedDiagnoses:
      "کوئی تشخیص درج نہیں ہے۔ اس کا مطلب یہ نہیں کہ کوئی نہیں — کچھ درج ہی نہیں کیا گیا۔",
    notRecordedAllergies:
      "کوئی الرجی درج نہیں ہے۔ اس کا مطلب یہ نہیں کہ کوئی الرجی نہیں — کچھ درج ہی نہیں کیا گیا۔",
    attestedNoneMedications: "کوئی معلوم دوا نہیں۔ مریض نے تصدیق کی۔",
    attestedNoneDiagnoses: "کوئی معلوم تشخیص نہیں۔ مریض نے تصدیق کی۔",
    attestedNoneAllergies: "کوئی معلوم الرجی نہیں۔ مریض نے تصدیق کی۔",
    warningAllergiesUnknown:
      "الرجی کی معلومات موجود نہیں ہیں، خالی نہیں ہیں۔ نسخہ لکھنے سے پہلے مریض سے پوچھیں۔",
    warningPartialShare:
      "مریض نے اپنے ریکارڈ کا صرف کچھ حصہ شیئر کیا۔ نہ دکھائے گئے حصے روکے گئے ہیں، خالی نہیں۔",
    generatedLabel: "تیار کیا گیا",
    expiresLabel: "یہ لنک ختم ہوگا",
    disclaimer:
      "یہ مریض کے پاس موجود خلاصہ ہے، مکمل طبی ریکارڈ نہیں۔ کسی بھی بات پر عمل سے پہلے تصدیق کریں۔",
    shareMessage:
      "{{practiceName}}: آپ کے ساتھ ایک صحت کا خلاصہ شیئر کیا گیا ہے۔ اسے یہاں کھولیں: {{shareUrl}}",
  },
};

/** Languages with a complete string set. */
export const SUMMARY_LANGUAGES: readonly string[] = Object.keys(SUMMARY_STRINGS);

/**
 * Resolve a language to its strings, reporting whether English was
 * substituted. Callers surface `fellBackToEnglish` to the reader rather than
 * letting a half-translated page pass as a translated one.
 */
export function summaryStrings(language: string): {
  strings: SummaryStrings;
  language: string;
  fellBackToEnglish: boolean;
} {
  const hit = SUMMARY_STRINGS[language];
  if (hit) return { strings: hit, language, fellBackToEnglish: false };
  return { strings: EN, language: "en", fellBackToEnglish: true };
}

/**
 * Fill the share notification for the **handoff** path — the message the
 * patient's own device will send.
 *
 * Deliberately not `renderTemplate`: that appends the STOP notice, which is
 * required on a message the practice sends and meaningless on one the patient
 * sends from their personal number. There is nothing for the recipient to opt
 * out of, and "Reply STOP" on a text from your mother is noise that makes the
 * message look like spam.
 */
export function renderShareMessage(
  language: string,
  vars: { practiceName: string; shareUrl: string },
): { body: string; language: string; fellBackToEnglish: boolean } {
  const { strings, language: used, fellBackToEnglish } = summaryStrings(language);
  const body = strings.shareMessage
    .replace(/\{\{practiceName\}\}/g, vars.practiceName)
    .replace(/\{\{shareUrl\}\}/g, vars.shareUrl);
  return { body, language: used, fellBackToEnglish };
}
