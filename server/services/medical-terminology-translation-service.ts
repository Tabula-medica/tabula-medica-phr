import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

export type SupportedLanguage =
  | "en" | "es" | "zh" | "hi" | "ar" | "pt" | "bn" | "ru" 
  | "ja" | "pa" | "de" | "ko" | "fr" | "vi" | "tl" | "it"
  | "fa" | "te" | "ne";

export const LANGUAGE_METADATA: Record<SupportedLanguage, { 
  name: string; 
  nativeName: string; 
  rtl: boolean;
  medicalTermPreference: "preserve" | "translate" | "hybrid";
}> = {
  en: { name: "English", nativeName: "English", rtl: false, medicalTermPreference: "preserve" },
  es: { name: "Spanish", nativeName: "Español", rtl: false, medicalTermPreference: "hybrid" },
  zh: { name: "Chinese", nativeName: "中文", rtl: false, medicalTermPreference: "hybrid" },
  hi: { name: "Hindi", nativeName: "हिन्दी", rtl: false, medicalTermPreference: "hybrid" },
  ar: { name: "Arabic", nativeName: "العربية", rtl: true, medicalTermPreference: "hybrid" },
  pt: { name: "Portuguese", nativeName: "Português", rtl: false, medicalTermPreference: "hybrid" },
  bn: { name: "Bengali", nativeName: "বাংলা", rtl: false, medicalTermPreference: "hybrid" },
  ru: { name: "Russian", nativeName: "Русский", rtl: false, medicalTermPreference: "hybrid" },
  ja: { name: "Japanese", nativeName: "日本語", rtl: false, medicalTermPreference: "hybrid" },
  pa: { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", rtl: false, medicalTermPreference: "hybrid" },
  de: { name: "German", nativeName: "Deutsch", rtl: false, medicalTermPreference: "hybrid" },
  ko: { name: "Korean", nativeName: "한국어", rtl: false, medicalTermPreference: "hybrid" },
  fr: { name: "French", nativeName: "Français", rtl: false, medicalTermPreference: "hybrid" },
  vi: { name: "Vietnamese", nativeName: "Tiếng Việt", rtl: false, medicalTermPreference: "hybrid" },
  tl: { name: "Tagalog", nativeName: "Tagalog", rtl: false, medicalTermPreference: "hybrid" },
  it: { name: "Italian", nativeName: "Italiano", rtl: false, medicalTermPreference: "hybrid" },
  fa: { name: "Farsi", nativeName: "فارسی", rtl: true, medicalTermPreference: "hybrid" },
  te: { name: "Telugu", nativeName: "తెలుగు", rtl: false, medicalTermPreference: "hybrid" },
  ne: { name: "Nepali", nativeName: "नेपाली", rtl: false, medicalTermPreference: "hybrid" },
};

export const COMMON_CONDITIONS: Record<string, Record<SupportedLanguage, string>> = {
  "Type 2 Diabetes": {
    en: "Type 2 Diabetes",
    es: "Diabetes tipo 2",
    zh: "2型糖尿病",
    hi: "टाइप 2 मधुमेह",
    ar: "السكري من النوع الثاني",
    pt: "Diabetes tipo 2",
    bn: "টাইপ ২ ডায়াবেটিস",
    ru: "Сахарный диабет 2 типа",
    ja: "2型糖尿病",
    pa: "ਟਾਈਪ 2 ਸ਼ੂਗਰ",
    de: "Diabetes Typ 2",
    ko: "제2형 당뇨병",
    fr: "Diabète de type 2",
    vi: "Tiểu đường type 2",
    tl: "Type 2 na Diabetes",
    it: "Diabete di tipo 2",
    fa: "دیابت نوع ۲",
    te: "టైప్ 2 మధుమేహం",
    ne: "टाइप २ मधुमेह",
  },
  "Hypertension": {
    en: "Hypertension (High Blood Pressure)",
    es: "Hipertensión (Presión arterial alta)",
    zh: "高血压",
    hi: "उच्च रक्तचाप",
    ar: "ارتفاع ضغط الدم",
    pt: "Hipertensão (Pressão alta)",
    bn: "উচ্চ রক্তচাপ",
    ru: "Гипертония (Высокое кровяное давление)",
    ja: "高血圧",
    pa: "ਹਾਈ ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ",
    de: "Bluthochdruck (Hypertonie)",
    ko: "고혈압",
    fr: "Hypertension (Tension artérielle élevée)",
    vi: "Cao huyết áp",
    tl: "Mataas na Presyon ng Dugo",
    it: "Ipertensione (Pressione alta)",
    fa: "فشار خون بالا",
    te: "అధిక రక్తపోటు",
    ne: "उच्च रक्तचाप",
  },
  "Asthma": {
    en: "Asthma",
    es: "Asma",
    zh: "哮喘",
    hi: "दमा",
    ar: "الربو",
    pt: "Asma",
    bn: "হাঁপানি",
    ru: "Астма",
    ja: "喘息",
    pa: "ਦਮਾ",
    de: "Asthma",
    ko: "천식",
    fr: "Asthme",
    vi: "Hen suyễn",
    tl: "Hika",
    it: "Asma",
    fa: "آسم",
    te: "ఆస్తమా",
    ne: "दमा",
  },
  "Chronic Kidney Disease": {
    en: "Chronic Kidney Disease",
    es: "Enfermedad renal crónica",
    zh: "慢性肾病",
    hi: "क्रोनिक किडनी रोग",
    ar: "مرض الكلى المزمن",
    pt: "Doença renal crônica",
    bn: "দীর্ঘস্থায়ী কিডনি রোগ",
    ru: "Хроническая болезнь почек",
    ja: "慢性腎臓病",
    pa: "ਗੁਰਦੇ ਦੀ ਪੁਰਾਣੀ ਬਿਮਾਰੀ",
    de: "Chronische Nierenerkrankung",
    ko: "만성 신장병",
    fr: "Maladie rénale chronique",
    vi: "Bệnh thận mãn tính",
    tl: "Talamak na Sakit sa Bato",
    it: "Malattia renale cronica",
    fa: "بیماری مزمن کلیه",
    te: "దీర్ఘకాలిక మూత్రపిండ వ్యాధి",
    ne: "दीर्घकालिन मिर्गौला रोग",
  },
  "Heart Failure": {
    en: "Heart Failure",
    es: "Insuficiencia cardíaca",
    zh: "心力衰竭",
    hi: "दिल की विफलता",
    ar: "قصور القلب",
    pt: "Insuficiência cardíaca",
    bn: "হার্ট ফেইলিউর",
    ru: "Сердечная недостаточность",
    ja: "心不全",
    pa: "ਦਿਲ ਦੀ ਅਸਫਲਤਾ",
    de: "Herzinsuffizienz",
    ko: "심부전",
    fr: "Insuffisance cardiaque",
    vi: "Suy tim",
    tl: "Pagpalya ng Puso",
    it: "Insufficienza cardiaca",
    fa: "نارسایی قلبی",
    te: "గుండె వైఫల్యం",
    ne: "हृदय विफलता",
  },
  "COPD": {
    en: "Chronic Obstructive Pulmonary Disease (COPD)",
    es: "Enfermedad Pulmonar Obstructiva Crónica (EPOC)",
    zh: "慢性阻塞性肺疾病",
    hi: "क्रोनिक ऑब्सट्रक्टिव पल्मोनरी डिजीज (सीओपीडी)",
    ar: "مرض الانسداد الرئوي المزمن",
    pt: "Doença Pulmonar Obstrutiva Crônica (DPOC)",
    bn: "দীর্ঘস্থায়ী অবরোধক ফুসফুস রোগ",
    ru: "Хроническая обструктивная болезнь лёгких (ХОБЛ)",
    ja: "慢性閉塞性肺疾患（COPD）",
    pa: "ਕ੍ਰੋਨਿਕ ਔਬਸਟ੍ਰਕਟਿਵ ਪਲਮੋਨਰੀ ਡਿਜ਼ੀਜ਼",
    de: "Chronisch obstruktive Lungenerkrankung (COPD)",
    ko: "만성 폐쇄성 폐질환 (COPD)",
    fr: "Bronchopneumopathie chronique obstructive (BPCO)",
    vi: "Bệnh phổi tắc nghẽn mãn tính (COPD)",
    tl: "Malalang Sakit sa Baga (COPD)",
    it: "Broncopneumopatia cronica ostruttiva (BPCO)",
    fa: "بیماری مزمن انسدادی ریه (COPD)",
    te: "దీర్ఘకాలిక అబ్‌స్ట్రక్టివ్ పల్మనరీ వ్యాధి (COPD)",
    ne: "दीर्घकालिन अवरोधक फोक्सो रोग (COPD)",
  },
  "Atrial Fibrillation": {
    en: "Atrial Fibrillation (Irregular Heartbeat)",
    es: "Fibrilación auricular (Latido cardíaco irregular)",
    zh: "房颤（心律不齐）",
    hi: "आलिंद फिब्रिलेशन (अनियमित दिल की धड़कन)",
    ar: "الرجفان الأذيني",
    pt: "Fibrilação atrial (Batimento cardíaco irregular)",
    bn: "অ্যাট্রিয়াল ফাইব্রিলেশন",
    ru: "Фибрилляция предсердий (Аритмия)",
    ja: "心房細動（不整脈）",
    pa: "ਐਟਰੀਅਲ ਫਿਬ੍ਰਿਲੇਸ਼ਨ",
    de: "Vorhofflimmern",
    ko: "심방세동",
    fr: "Fibrillation auriculaire",
    vi: "Rung nhĩ",
    tl: "Atrial Fibrillation",
    it: "Fibrillazione atriale",
    fa: "فیبریلاسیون دهلیزی",
    te: "ఏట్రియల్ ఫిబ్రిలేషన్",
    ne: "एट्रियल फिब्रिलेसन",
  },
  "Osteoarthritis": {
    en: "Osteoarthritis",
    es: "Osteoartritis (Artritis degenerativa)",
    zh: "骨关节炎",
    hi: "अस्थिसंधिशोथ",
    ar: "التهاب المفاصل",
    pt: "Osteoartrite",
    bn: "অস্টিওআর্থ্রাইটিস",
    ru: "Остеоартрит",
    ja: "変形性関節症",
    pa: "ਓਸਟੀਓਆਰਥਰਾਈਟਿਸ",
    de: "Arthrose",
    ko: "골관절염",
    fr: "Arthrose",
    vi: "Viêm xương khớp",
    tl: "Osteoarthritis",
    it: "Osteoartrite",
    fa: "استئوآرتریت",
    te: "ఆస్టియోఆర్థరైటిస్",
    ne: "अस्टियोआर्थराइटिस",
  },
  "Depression": {
    en: "Depression",
    es: "Depresión",
    zh: "抑郁症",
    hi: "अवसाद",
    ar: "الاكتئاب",
    pt: "Depressão",
    bn: "বিষণ্ণতা",
    ru: "Депрессия",
    ja: "うつ病",
    pa: "ਉਦਾਸੀ",
    de: "Depression",
    ko: "우울증",
    fr: "Dépression",
    vi: "Trầm cảm",
    tl: "Depresyon",
    it: "Depressione",
    fa: "افسردگی",
    te: "నిరాశ",
    ne: "अवसाद",
  },
  "Anxiety Disorder": {
    en: "Anxiety Disorder",
    es: "Trastorno de ansiedad",
    zh: "焦虑症",
    hi: "चिंता विकार",
    ar: "اضطراب القلق",
    pt: "Transtorno de ansiedade",
    bn: "উদ্বেগজনিত ব্যাধি",
    ru: "Тревожное расстройство",
    ja: "不安障害",
    pa: "ਚਿੰਤਾ ਵਿਕਾਰ",
    de: "Angststörung",
    ko: "불안장애",
    fr: "Trouble anxieux",
    vi: "Rối loạn lo âu",
    tl: "Anxiety Disorder",
    it: "Disturbo d'ansia",
    fa: "اختلال اضطرابی",
    te: "ఆందోళన రుగ్మత",
    ne: "चिन्ता विकार",
  },
  "Coronary Artery Disease": {
    en: "Coronary Artery Disease",
    es: "Enfermedad de las arterias coronarias",
    zh: "冠状动脉疾病",
    hi: "कोरोनरी धमनी रोग",
    ar: "مرض الشريان التاجي",
    pt: "Doença arterial coronariana",
    bn: "করোনারি ধমনী রোগ",
    ru: "Ишемическая болезнь сердца",
    ja: "冠動脈疾患",
    pa: "ਕੋਰੋਨਰੀ ਆਰਟਰੀ ਰੋਗ",
    de: "Koronare Herzkrankheit",
    ko: "관상동맥질환",
    fr: "Maladie coronarienne",
    vi: "Bệnh động mạch vành",
    tl: "Coronary Artery Disease",
    it: "Malattia coronarica",
    fa: "بیماری عروق کرونر",
    te: "కరోనరీ ఆర్టరీ వ్యాధి",
    ne: "कोरोनरी धमनी रोग",
  },
  "Hypothyroidism": {
    en: "Hypothyroidism (Underactive Thyroid)",
    es: "Hipotiroidismo (Tiroides hipoactiva)",
    zh: "甲状腺功能减退症",
    hi: "हाइपोथायरायडिज्म",
    ar: "قصور الغدة الدرقية",
    pt: "Hipotireoidismo",
    bn: "হাইপোথাইরয়েডিজম",
    ru: "Гипотиреоз",
    ja: "甲状腺機能低下症",
    pa: "ਹਾਈਪੋਥਾਇਰੋਇਡਿਜ਼ਮ",
    de: "Hypothyreose (Schilddrüsenunterfunktion)",
    ko: "갑상선기능저하증",
    fr: "Hypothyroïdie",
    vi: "Suy giáp",
    tl: "Hypothyroidism",
    it: "Ipotiroidismo",
    fa: "کم‌کاری تیروئید",
    te: "హైపోథైరాయిడిజం",
    ne: "हाइपोथाइरोइडिज्म",
  },
  "Hyperlipidemia": {
    en: "High Cholesterol (Hyperlipidemia)",
    es: "Colesterol alto (Hiperlipidemia)",
    zh: "高脂血症（高胆固醇）",
    hi: "उच्च कोलेस्ट्रॉल",
    ar: "ارتفاع الكوليسترول",
    pt: "Colesterol alto (Hiperlipidemia)",
    bn: "উচ্চ কোলেস্টেরল",
    ru: "Высокий холестерин (Гиперлипидемия)",
    ja: "高脂血症",
    pa: "ਉੱਚ ਕੋਲੇਸਟ੍ਰੋਲ",
    de: "Hoher Cholesterinspiegel (Hyperlipidämie)",
    ko: "고지혈증",
    fr: "Cholestérol élevé (Hyperlipidémie)",
    vi: "Mỡ máu cao",
    tl: "Mataas na Cholesterol",
    it: "Colesterolo alto (Iperlipidemia)",
    fa: "کلسترول بالا (هیپرلیپیدمی)",
    te: "అధిక కొలెస్ట్రాల్ (హైపర్‌లిపిడెమియా)",
    ne: "उच्च कोलेस्ट्रोल (हाइपरलिपिडेमिया)",
  },
  "Obesity": {
    en: "Obesity",
    es: "Obesidad",
    zh: "肥胖症",
    hi: "मोटापा",
    ar: "السمنة",
    pt: "Obesidade",
    bn: "স্থূলতা",
    ru: "Ожирение",
    ja: "肥満",
    pa: "ਮੋਟਾਪਾ",
    de: "Adipositas (Fettleibigkeit)",
    ko: "비만",
    fr: "Obésité",
    vi: "Béo phì",
    tl: "Labis na Timbang",
    it: "Obesità",
    fa: "چاقی",
    te: "ఊబకాయం",
    ne: "मोटोपना",
  },
  "Gastroesophageal Reflux Disease": {
    en: "GERD (Acid Reflux)",
    es: "ERGE (Reflujo ácido)",
    zh: "胃食管反流病",
    hi: "जीईआरडी (एसिड रिफ्लक्स)",
    ar: "ارتجاع المريء",
    pt: "DRGE (Refluxo ácido)",
    bn: "গ্যাস্ট্রোইসোফেজিয়াল রিফ্লাক্স",
    ru: "ГЭРБ (Кислотный рефлюкс)",
    ja: "逆流性食道炎",
    pa: "ਜੀਈਆਰਡੀ",
    de: "GERD (Sodbrennen)",
    ko: "위식도역류질환",
    fr: "RGO (Reflux acide)",
    vi: "Trào ngược dạ dày thực quản",
    tl: "GERD (Acid Reflux)",
    it: "MRGE (Reflusso acido)",
    fa: "رفلاکس معده (GERD)",
    te: "గ్యాస్ట్రోఈసోఫేజియల్ రిఫ్లక్స్ (GERD)",
    ne: "ग्यास्ट्रोइसोफेजियल रिफ्लक्स (GERD)",
  },
  "Chronic Pain": {
    en: "Chronic Pain",
    es: "Dolor crónico",
    zh: "慢性疼痛",
    hi: "दीर्घकालिक दर्द",
    ar: "الألم المزمن",
    pt: "Dor crônica",
    bn: "দীর্ঘস্থায়ী ব্যথা",
    ru: "Хроническая боль",
    ja: "慢性疼痛",
    pa: "ਪੁਰਾਣੀ ਦਰਦ",
    de: "Chronische Schmerzen",
    ko: "만성 통증",
    fr: "Douleur chronique",
    vi: "Đau mãn tính",
    tl: "Malalang Sakit",
    it: "Dolore cronico",
    fa: "درد مزمن",
    te: "దీర్ఘకాలిక నొప్పి",
    ne: "दीर्घकालिन दुखाइ",
  },
  "Cancer": {
    en: "Cancer",
    es: "Cáncer",
    zh: "癌症",
    hi: "कैंसर",
    ar: "السرطان",
    pt: "Câncer",
    bn: "ক্যান্সার",
    ru: "Рак",
    ja: "がん",
    pa: "ਕੈਂਸਰ",
    de: "Krebs",
    ko: "암",
    fr: "Cancer",
    vi: "Ung thư",
    tl: "Kanser",
    it: "Cancro",
    fa: "سرطان",
    te: "క్యాన్సర్",
    ne: "क्यान्सर",
  },
  "Stroke": {
    en: "Stroke",
    es: "Accidente cerebrovascular",
    zh: "中风",
    hi: "स्ट्रोक (आघात)",
    ar: "السكتة الدماغية",
    pt: "AVC (Acidente Vascular Cerebral)",
    bn: "স্ট্রোক",
    ru: "Инсульт",
    ja: "脳卒中",
    pa: "ਸਟ੍ਰੋਕ",
    de: "Schlaganfall",
    ko: "뇌졸중",
    fr: "AVC",
    vi: "Đột quỵ",
    tl: "Stroke",
    it: "Ictus",
    fa: "سکته مغزی",
    te: "స్ట్రోక్",
    ne: "स्ट्रोक (पक्षाघात)",
  },
  "Alzheimer's Disease": {
    en: "Alzheimer's Disease",
    es: "Enfermedad de Alzheimer",
    zh: "阿尔茨海默病",
    hi: "अल्जाइमर रोग",
    ar: "مرض الزهايمر",
    pt: "Doença de Alzheimer",
    bn: "আলঝেইমার রোগ",
    ru: "Болезнь Альцгеймера",
    ja: "アルツハイマー病",
    pa: "ਅਲਜ਼ਾਈਮਰ ਰੋਗ",
    de: "Alzheimer-Krankheit",
    ko: "알츠하이머병",
    fr: "Maladie d'Alzheimer",
    vi: "Bệnh Alzheimer",
    tl: "Alzheimer's Disease",
    it: "Malattia di Alzheimer",
    fa: "بیماری آلزایمر",
    te: "ఆల్జీమర్స్ వ్యాధి",
    ne: "अल्जाइमर रोग",
  },
  "Pneumonia": {
    en: "Pneumonia",
    es: "Neumonía",
    zh: "肺炎",
    hi: "निमोनिया",
    ar: "الالتهاب الرئوي",
    pt: "Pneumonia",
    bn: "নিউমোনিয়া",
    ru: "Пневмония",
    ja: "肺炎",
    pa: "ਨਿਮੋਨੀਆ",
    de: "Lungenentzündung",
    ko: "폐렴",
    fr: "Pneumonie",
    vi: "Viêm phổi",
    tl: "Pulmonya",
    it: "Polmonite",
    fa: "ذات‌الریه",
    te: "న్యుమోనియా",
    ne: "निमोनिया",
  },
};

export const REPORT_TYPES: Record<string, Record<SupportedLanguage, string>> = {
  "Health Summary": {
    en: "Health Summary",
    es: "Resumen de salud",
    zh: "健康摘要",
    hi: "स्वास्थ्य सारांश",
    ar: "ملخص صحي",
    pt: "Resumo de saúde",
    bn: "স্বাস্থ্য সারাংশ",
    ru: "Сводка о здоровье",
    ja: "健康サマリー",
    pa: "ਸਿਹਤ ਸਾਰ",
    de: "Gesundheitsübersicht",
    ko: "건강 요약",
    fr: "Résumé de santé",
    vi: "Tóm tắt sức khỏe",
    tl: "Buod ng Kalusugan",
    it: "Riepilogo sanitario",
    fa: "خلاصه سلامت",
    te: "ఆరోగ్య సారాంశం",
    ne: "स्वास्थ्य सारांश",
  },
  "Lab Results": {
    en: "Lab Results",
    es: "Resultados de laboratorio",
    zh: "检验结果",
    hi: "प्रयोगशाला परिणाम",
    ar: "نتائج المختبر",
    pt: "Resultados laboratoriais",
    bn: "ল্যাব ফলাফল",
    ru: "Результаты анализов",
    ja: "検査結果",
    pa: "ਲੈਬ ਨਤੀਜੇ",
    de: "Laborergebnisse",
    ko: "검사 결과",
    fr: "Résultats d'analyses",
    vi: "Kết quả xét nghiệm",
    tl: "Resulta ng Lab",
    it: "Risultati di laboratorio",
    fa: "نتایج آزمایشگاه",
    te: "ల్యాబ్ ఫలితాలు",
    ne: "ल्याब नतिजाहरू",
  },
  "Medication List": {
    en: "Medication List",
    es: "Lista de medicamentos",
    zh: "药物清单",
    hi: "दवाओं की सूची",
    ar: "قائمة الأدوية",
    pt: "Lista de medicamentos",
    bn: "ওষুধের তালিকা",
    ru: "Список лекарств",
    ja: "処方薬リスト",
    pa: "ਦਵਾਈਆਂ ਦੀ ਸੂਚੀ",
    de: "Medikamentenliste",
    ko: "약물 목록",
    fr: "Liste des médicaments",
    vi: "Danh sách thuốc",
    tl: "Listahan ng Gamot",
    it: "Elenco farmaci",
    fa: "فهرست داروها",
    te: "మందుల జాబితా",
    ne: "औषधि सूची",
  },
  "Visit Summary": {
    en: "Visit Summary",
    es: "Resumen de la visita",
    zh: "就诊摘要",
    hi: "विज़िट सारांश",
    ar: "ملخص الزيارة",
    pt: "Resumo da consulta",
    bn: "পরিদর্শন সারাংশ",
    ru: "Сводка визита",
    ja: "受診サマリー",
    pa: "ਮੁਲਾਕਾਤ ਸਾਰ",
    de: "Besuchszusammenfassung",
    ko: "진료 요약",
    fr: "Résumé de la visite",
    vi: "Tóm tắt lần khám",
    tl: "Buod ng Pagbisita",
    it: "Riepilogo visita",
    fa: "خلاصه ویزیت",
    te: "సందర్శన సారాంశం",
    ne: "भ्रमण सारांश",
  },
  "Immunization Record": {
    en: "Immunization Record",
    es: "Registro de vacunación",
    zh: "免疫接种记录",
    hi: "टीकाकरण रिकॉर्ड",
    ar: "سجل التطعيمات",
    pt: "Registro de vacinação",
    bn: "টিকাদান রেকর্ড",
    ru: "Запись о вакцинации",
    ja: "予防接種記録",
    pa: "ਟੀਕਾਕਰਨ ਰਿਕਾਰਡ",
    de: "Impfausweis",
    ko: "예방접종 기록",
    fr: "Carnet de vaccination",
    vi: "Hồ sơ tiêm chủng",
    tl: "Rekord ng Bakuna",
    it: "Registro vaccinazioni",
    fa: "سابقه واکسیناسیون",
    te: "టీకా రికార్డు",
    ne: "खोप रेकर्ड",
  },
  "Allergy List": {
    en: "Allergy List",
    es: "Lista de alergias",
    zh: "过敏清单",
    hi: "एलर्जी सूची",
    ar: "قائمة الحساسية",
    pt: "Lista de alergias",
    bn: "অ্যালার্জি তালিকা",
    ru: "Список аллергий",
    ja: "アレルギーリスト",
    pa: "ਐਲਰਜੀ ਸੂਚੀ",
    de: "Allergieliste",
    ko: "알레르기 목록",
    fr: "Liste des allergies",
    vi: "Danh sách dị ứng",
    tl: "Listahan ng Allergy",
    it: "Elenco allergie",
    fa: "فهرست حساسیت‌ها",
    te: "అలెర్జీ జాబితా",
    ne: "एलर्जी सूची",
  },
  "Vital Signs": {
    en: "Vital Signs",
    es: "Signos vitales",
    zh: "生命体征",
    hi: "महत्वपूर्ण संकेत",
    ar: "العلامات الحيوية",
    pt: "Sinais vitais",
    bn: "গুরুত্বপূর্ণ লক্ষণ",
    ru: "Жизненные показатели",
    ja: "バイタルサイン",
    pa: "ਮਹੱਤਵਪੂਰਨ ਸੰਕੇਤ",
    de: "Vitalzeichen",
    ko: "활력 징후",
    fr: "Signes vitaux",
    vi: "Dấu hiệu sinh tồn",
    tl: "Vital Signs",
    it: "Segni vitali",
    fa: "علائم حیاتی",
    te: "ప్రాణ సంకేతాలు",
    ne: "जीवन संकेतहरू",
  },
  "Care Plan": {
    en: "Care Plan",
    es: "Plan de atención",
    zh: "护理计划",
    hi: "देखभाल योजना",
    ar: "خطة الرعاية",
    pt: "Plano de cuidados",
    bn: "যত্ন পরিকল্পনা",
    ru: "План лечения",
    ja: "ケアプラン",
    pa: "ਦੇਖਭਾਲ ਯੋਜਨਾ",
    de: "Pflegeplan",
    ko: "케어 플랜",
    fr: "Plan de soins",
    vi: "Kế hoạch chăm sóc",
    tl: "Plano ng Pangangalaga",
    it: "Piano di cura",
    fa: "برنامه مراقبت",
    te: "సంరక్షణ ప్రణాళిక",
    ne: "हेरचाह योजना",
  },
  "Discharge Summary": {
    en: "Discharge Summary",
    es: "Resumen de alta",
    zh: "出院小结",
    hi: "डिस्चार्ज सारांश",
    ar: "ملخص الخروج",
    pt: "Resumo de alta",
    bn: "ডিসচার্জ সারাংশ",
    ru: "Выписной эпикриз",
    ja: "退院サマリー",
    pa: "ਡਿਸਚਾਰਜ ਸਾਰ",
    de: "Entlassungsbericht",
    ko: "퇴원 요약",
    fr: "Résumé de sortie",
    vi: "Tóm tắt xuất viện",
    tl: "Buod ng Discharge",
    it: "Lettera di dimissione",
    fa: "خلاصه ترخیص",
    te: "డిశ్చార్జ్ సారాంశం",
    ne: "डिस्चार्ज सारांश",
  },
  "Referral Letter": {
    en: "Referral Letter",
    es: "Carta de referencia",
    zh: "转诊信",
    hi: "रेफरल पत्र",
    ar: "خطاب الإحالة",
    pt: "Carta de encaminhamento",
    bn: "রেফারেল চিঠি",
    ru: "Направление",
    ja: "紹介状",
    pa: "ਰੈਫਰਲ ਪੱਤਰ",
    de: "Überweisungsschreiben",
    ko: "의뢰서",
    fr: "Lettre de référence",
    vi: "Thư giới thiệu",
    tl: "Referral Letter",
    it: "Lettera di invio",
    fa: "نامه ارجاع",
    te: "రిఫరల్ లెటర్",
    ne: "रेफरल पत्र",
  },
  "Emergency Information": {
    en: "Emergency Information",
    es: "Información de emergencia",
    zh: "急救信息",
    hi: "आपातकालीन जानकारी",
    ar: "معلومات الطوارئ",
    pt: "Informações de emergência",
    bn: "জরুরি তথ্য",
    ru: "Экстренная информация",
    ja: "緊急情報",
    pa: "ਐਮਰਜੈਂਸੀ ਜਾਣਕਾਰੀ",
    de: "Notfallinformationen",
    ko: "응급 정보",
    fr: "Informations d'urgence",
    vi: "Thông tin khẩn cấp",
    tl: "Impormasyon sa Emergency",
    it: "Informazioni di emergenza",
    fa: "اطلاعات اضطراری",
    te: "అత్యవసర సమాచారం",
    ne: "आपतकालीन जानकारी",
  },
};

export const UI_MEDICAL_TERMS: Record<string, Record<SupportedLanguage, string>> = {
  "Active Conditions": {
    en: "Active Conditions",
    es: "Condiciones activas",
    zh: "当前病症",
    hi: "सक्रिय स्थितियां",
    ar: "الحالات النشطة",
    pt: "Condições ativas",
    bn: "সক্রিয় অবস্থা",
    ru: "Активные заболевания",
    ja: "現在の病状",
    pa: "ਸਰਗਰਮ ਸਥਿਤੀਆਂ",
    de: "Aktive Erkrankungen",
    ko: "현재 상태",
    fr: "Conditions actives",
    vi: "Tình trạng hiện tại",
    tl: "Aktibong Kondisyon",
    it: "Condizioni attive",
    fa: "بیماری‌های فعال",
    te: "ప్రస్తుత వ్యాధులు",
    ne: "सक्रिय अवस्थाहरू",
  },
  "Current Medications": {
    en: "Current Medications",
    es: "Medicamentos actuales",
    zh: "当前用药",
    hi: "वर्तमान दवाएं",
    ar: "الأدوية الحالية",
    pt: "Medicamentos atuais",
    bn: "বর্তমান ওষুধ",
    ru: "Текущие лекарства",
    ja: "現在の処方薬",
    pa: "ਮੌਜੂਦਾ ਦਵਾਈਆਂ",
    de: "Aktuelle Medikamente",
    ko: "현재 복용 약물",
    fr: "Médicaments actuels",
    vi: "Thuốc đang dùng",
    tl: "Kasalukuyang Gamot",
    it: "Farmaci attuali",
    fa: "داروهای فعلی",
    te: "ప్రస్తుత మందులు",
    ne: "हालका औषधिहरू",
  },
  "Known Allergies": {
    en: "Known Allergies",
    es: "Alergias conocidas",
    zh: "已知过敏",
    hi: "ज्ञात एलर्जी",
    ar: "الحساسية المعروفة",
    pt: "Alergias conhecidas",
    bn: "পরিচিত অ্যালার্জি",
    ru: "Известные аллергии",
    ja: "既知のアレルギー",
    pa: "ਜਾਣੀਆਂ ਐਲਰਜੀਆਂ",
    de: "Bekannte Allergien",
    ko: "알려진 알레르기",
    fr: "Allergies connues",
    vi: "Dị ứng đã biết",
    tl: "Kilalang Allergy",
    it: "Allergie note",
    fa: "حساسیت‌های شناخته شده",
    te: "తెలిసిన అలెర్జీలు",
    ne: "ज्ञात एलर्जीहरू",
  },
  "Recent Lab Results": {
    en: "Recent Lab Results",
    es: "Resultados de laboratorio recientes",
    zh: "最近检验结果",
    hi: "हाल के प्रयोगशाला परिणाम",
    ar: "نتائج المختبر الأخيرة",
    pt: "Resultados laboratoriais recentes",
    bn: "সাম্প্রতিক ল্যাব ফলাফল",
    ru: "Последние анализы",
    ja: "最近の検査結果",
    pa: "ਤਾਜ਼ਾ ਲੈਬ ਨਤੀਜੇ",
    de: "Aktuelle Laborergebnisse",
    ko: "최근 검사 결과",
    fr: "Résultats récents",
    vi: "Kết quả xét nghiệm gần đây",
    tl: "Kamakailang Resulta",
    it: "Risultati recenti",
    fa: "نتایج اخیر آزمایشگاه",
    te: "ఇటీవలి ల్యాబ్ ఫలితాలు",
    ne: "हालका ल्याब नतिजाहरू",
  },
  "Upcoming Appointments": {
    en: "Upcoming Appointments",
    es: "Próximas citas",
    zh: "即将到来的预约",
    hi: "आगामी अपॉइंटमेंट",
    ar: "المواعيد القادمة",
    pt: "Próximas consultas",
    bn: "আসন্ন অ্যাপয়েন্টমেন্ট",
    ru: "Предстоящие приёмы",
    ja: "今後の予約",
    pa: "ਆਉਣ ਵਾਲੀਆਂ ਮੁਲਾਕਾਤਾਂ",
    de: "Bevorstehende Termine",
    ko: "예정된 예약",
    fr: "Rendez-vous à venir",
    vi: "Lịch hẹn sắp tới",
    tl: "Mga Paparating na Appointment",
    it: "Prossimi appuntamenti",
    fa: "نوبت‌های آینده",
    te: "రాబోయే అపాయింట్‌మెంట్లు",
    ne: "आउँदा अपोइन्टमेन्टहरू",
  },
  "Blood Pressure": {
    en: "Blood Pressure",
    es: "Presión arterial",
    zh: "血压",
    hi: "रक्तचाप",
    ar: "ضغط الدم",
    pt: "Pressão arterial",
    bn: "রক্তচাপ",
    ru: "Артериальное давление",
    ja: "血圧",
    pa: "ਬਲੱਡ ਪ੍ਰੈਸ਼ਰ",
    de: "Blutdruck",
    ko: "혈압",
    fr: "Tension artérielle",
    vi: "Huyết áp",
    tl: "Presyon ng Dugo",
    it: "Pressione sanguigna",
    fa: "فشار خون",
    te: "రక్తపోటు",
    ne: "रक्तचाप",
  },
  "Heart Rate": {
    en: "Heart Rate",
    es: "Frecuencia cardíaca",
    zh: "心率",
    hi: "हृदय गति",
    ar: "معدل ضربات القلب",
    pt: "Frequência cardíaca",
    bn: "হৃদ স্পন্দন",
    ru: "Частота пульса",
    ja: "心拍数",
    pa: "ਦਿਲ ਦੀ ਧੜਕਣ",
    de: "Herzfrequenz",
    ko: "심박수",
    fr: "Rythme cardiaque",
    vi: "Nhịp tim",
    tl: "Heart Rate",
    it: "Frequenza cardiaca",
    fa: "ضربان قلب",
    te: "గుండె స్పందన రేటు",
    ne: "हृदय गति",
  },
  "Blood Sugar": {
    en: "Blood Sugar",
    es: "Azúcar en sangre",
    zh: "血糖",
    hi: "रक्त शर्करा",
    ar: "سكر الدم",
    pt: "Glicemia",
    bn: "রক্তের শর্করা",
    ru: "Сахар в крови",
    ja: "血糖値",
    pa: "ਬਲੱਡ ਸ਼ੂਗਰ",
    de: "Blutzucker",
    ko: "혈당",
    fr: "Glycémie",
    vi: "Đường huyết",
    tl: "Blood Sugar",
    it: "Glicemia",
    fa: "قند خون",
    te: "రక్తంలో చక్కెర",
    ne: "रक्त शर्करा",
  },
  "Body Weight": {
    en: "Body Weight",
    es: "Peso corporal",
    zh: "体重",
    hi: "शरीर का वज़न",
    ar: "وزن الجسم",
    pt: "Peso corporal",
    bn: "শরীরের ওজন",
    ru: "Масса тела",
    ja: "体重",
    pa: "ਸਰੀਰ ਦਾ ਭਾਰ",
    de: "Körpergewicht",
    ko: "체중",
    fr: "Poids corporel",
    vi: "Cân nặng",
    tl: "Timbang ng Katawan",
    it: "Peso corporeo",
    fa: "وزن بدن",
    te: "శరీర బరువు",
    ne: "शरीरको तौल",
  },
  "No Known Allergies": {
    en: "No Known Allergies",
    es: "Sin alergias conocidas",
    zh: "无已知过敏",
    hi: "कोई ज्ञात एलर्जी नहीं",
    ar: "لا توجد حساسية معروفة",
    pt: "Sem alergias conhecidas",
    bn: "কোন পরিচিত অ্যালার্জি নেই",
    ru: "Аллергии не известны",
    ja: "既知のアレルギーなし",
    pa: "ਕੋਈ ਜਾਣੀ ਐਲਰਜੀ ਨਹੀਂ",
    de: "Keine bekannten Allergien",
    ko: "알려진 알레르기 없음",
    fr: "Aucune allergie connue",
    vi: "Không có dị ứng đã biết",
    tl: "Walang Kilalang Allergy",
    it: "Nessuna allergia nota",
    fa: "بدون حساسیت شناخته شده",
    te: "తెలిసిన అలెర్జీలు లేవు",
    ne: "कुनै ज्ञात एलर्जी छैन",
  },
};

export const NO_CDS_DISCLAIMERS: Record<SupportedLanguage, string> = {
  en: "IMPORTANT: This information is for educational purposes only and is NOT medical advice. It does not replace professional medical consultation. Always consult with your healthcare provider for medical decisions.",
  es: "IMPORTANTE: Esta información es solo para fines educativos y NO es consejo médico. No reemplaza la consulta médica profesional. Siempre consulte con su proveedor de atención médica para decisiones médicas.",
  zh: "重要提示：此信息仅供教育目的，不构成医疗建议。它不能取代专业医疗咨询。请始终咨询您的医疗保健提供者以做出医疗决定。",
  hi: "महत्वपूर्ण: यह जानकारी केवल शैक्षिक उद्देश्यों के लिए है और चिकित्सा सलाह नहीं है। यह पेशेवर चिकित्सा परामर्श की जगह नहीं लेती। चिकित्सा निर्णयों के लिए हमेशा अपने स्वास्थ्य सेवा प्रदाता से परामर्श करें।",
  ar: "مهم: هذه المعلومات للأغراض التعليمية فقط وليست نصيحة طبية. لا تحل محل الاستشارة الطبية المتخصصة. استشر دائماً مقدم الرعاية الصحية الخاص بك لاتخاذ القرارات الطبية.",
  pt: "IMPORTANTE: Esta informação é apenas para fins educacionais e NÃO é aconselhamento médico. Não substitui a consulta médica profissional. Sempre consulte seu médico para decisões de saúde.",
  bn: "গুরুত্বপূর্ণ: এই তথ্য শুধুমাত্র শিক্ষামূলক উদ্দেশ্যে এবং চিকিৎসা পরামর্শ নয়। এটি পেশাদার চিকিৎসা পরামর্শের বিকল্প নয়। চিকিৎসা সংক্রান্ত সিদ্ধান্তের জন্য সর্বদা আপনার স্বাস্থ্যসেবা প্রদানকারীর সাথে পরামর্শ করুন।",
  ru: "ВАЖНО: Эта информация предназначена только для образовательных целей и НЕ является медицинской рекомендацией. Она не заменяет профессиональную медицинскую консультацию. Всегда консультируйтесь с вашим врачом для принятия медицинских решений.",
  ja: "重要：この情報は教育目的のみであり、医療アドバイスではありません。専門家による医療相談の代わりにはなりません。医療上の決定については必ず医療提供者にご相談ください。",
  pa: "ਮਹੱਤਵਪੂਰਨ: ਇਹ ਜਾਣਕਾਰੀ ਸਿਰਫ਼ ਸਿੱਖਿਆ ਦੇ ਉਦੇਸ਼ਾਂ ਲਈ ਹੈ ਅਤੇ ਡਾਕਟਰੀ ਸਲਾਹ ਨਹੀਂ ਹੈ। ਇਹ ਪੇਸ਼ੇਵਰ ਡਾਕਟਰੀ ਸਲਾਹ ਦੀ ਥਾਂ ਨਹੀਂ ਲੈਂਦੀ। ਡਾਕਟਰੀ ਫੈਸਲਿਆਂ ਲਈ ਹਮੇਸ਼ਾ ਆਪਣੇ ਡਾਕਟਰ ਨਾਲ ਸਲਾਹ ਕਰੋ।",
  de: "WICHTIG: Diese Information dient nur zu Bildungszwecken und ist KEINE medizinische Beratung. Sie ersetzt keine professionelle medizinische Beratung. Konsultieren Sie immer Ihren Arzt für medizinische Entscheidungen.",
  ko: "중요: 이 정보는 교육 목적으로만 제공되며 의료 조언이 아닙니다. 전문적인 의료 상담을 대체하지 않습니다. 의료 결정은 항상 담당 의료진과 상담하십시오.",
  fr: "IMPORTANT: Cette information est fournie à titre éducatif uniquement et NE constitue PAS un avis médical. Elle ne remplace pas une consultation médicale professionnelle. Consultez toujours votre médecin pour les décisions médicales.",
  vi: "QUAN TRỌNG: Thông tin này chỉ nhằm mục đích giáo dục và KHÔNG phải là lời khuyên y tế. Nó không thay thế tư vấn y tế chuyên nghiệp. Luôn tham khảo ý kiến bác sĩ của bạn để đưa ra quyết định y tế.",
  tl: "MAHALAGA: Ang impormasyong ito ay para lamang sa layuning pang-edukasyon at HINDI medikal na payo. Hindi nito pinapalitan ang propesyonal na konsultasyong medikal. Palaging kumonsulta sa iyong healthcare provider para sa mga desisyong medikal.",
  it: "IMPORTANTE: Queste informazioni sono solo a scopo educativo e NON costituiscono consulenza medica. Non sostituiscono la consulenza medica professionale. Consultare sempre il proprio medico per le decisioni mediche.",
  fa: "مهم: این اطلاعات فقط برای اهداف آموزشی است و مشاوره پزشکی نیست. جایگزین مشاوره حرفه‌ای پزشکی نمی‌شود. همیشه برای تصمیمات پزشکی با ارائه‌دهنده مراقبت‌های بهداشتی خود مشورت کنید.",
  te: "ముఖ్యమైనది: ఈ సమాచారం విద్యా ప్రయోజనాల కోసం మాత్రమే మరియు వైద్య సలహా కాదు. ఇది వృత్తిపరమైన వైద్య సంప్రదింపును భర్తీ చేయదు. వైద్య నిర్ణయాల కోసం ఎల్లప్పుడూ మీ ఆరోగ్య సంరక్షణ ప్రదాతను సంప్రదించండి.",
  ne: "महत्त्वपूर्ण: यो जानकारी शैक्षिक उद्देश्यका लागि मात्र हो र चिकित्सा सल्लाह होइन। यसले पेशेवर चिकित्सा परामर्शको ठाउँ लिँदैन। चिकित्सा निर्णयहरूको लागि सधैँ आफ्नो स्वास्थ्य सेवा प्रदायकसँग परामर्श गर्नुहोस्।",
};

export interface TranslationResult {
  original: string;
  translated: string;
  language: SupportedLanguage;
  preservedTerms: string[];
  translatedAt: string;
}

export interface ConditionTranslation {
  conditionName: string;
  translations: Record<SupportedLanguage, string>;
  icdCode?: string;
  plainLanguageDescription?: Record<SupportedLanguage, string>;
}

const translationCache: Map<string, TranslationResult> = new Map();

function getCacheKey(text: string, targetLang: SupportedLanguage): string {
  return `${targetLang}:${text.substring(0, 100)}`;
}

export function getConditionTranslation(conditionName: string, language: SupportedLanguage): string {
  const normalizedName = conditionName.trim();
  
  for (const [key, translations] of Object.entries(COMMON_CONDITIONS)) {
    if (key.toLowerCase() === normalizedName.toLowerCase() ||
        translations.en.toLowerCase() === normalizedName.toLowerCase()) {
      return translations[language] || translations.en;
    }
  }
  
  return normalizedName;
}

export function getReportTypeTranslation(reportType: string, language: SupportedLanguage): string {
  const normalizedType = reportType.trim();
  
  for (const [key, translations] of Object.entries(REPORT_TYPES)) {
    if (key.toLowerCase() === normalizedType.toLowerCase() ||
        translations.en.toLowerCase() === normalizedType.toLowerCase()) {
      return translations[language] || translations.en;
    }
  }
  
  return normalizedType;
}

export function getUITermTranslation(term: string, language: SupportedLanguage): string {
  const normalizedTerm = term.trim();
  
  for (const [key, translations] of Object.entries(UI_MEDICAL_TERMS)) {
    if (key.toLowerCase() === normalizedTerm.toLowerCase() ||
        translations.en.toLowerCase() === normalizedTerm.toLowerCase()) {
      return translations[language] || translations.en;
    }
  }
  
  return normalizedTerm;
}

export function getNoCdsDisclaimer(language: SupportedLanguage): string {
  return NO_CDS_DISCLAIMERS[language] || NO_CDS_DISCLAIMERS.en;
}

const PRESERVED_MEDICAL_TERMS = [
  "mg", "mcg", "µg", "g", "kg", "mL", "L", "dL",
  "mg/dL", "mmol/L", "mEq/L", "ng/mL", "µg/dL",
  "mmHg", "bpm", "°F", "°C",
  "HbA1c", "A1C", "CBC", "CMP", "BMP", "LDL", "HDL", "TSH",
  "BID", "TID", "QID", "PRN", "PO", "IV", "IM",
  "metformin", "lisinopril", "atorvastatin", "amlodipine", "omeprazole",
  "levothyroxine", "simvastatin", "losartan", "gabapentin", "sertraline",
  "ICD-10", "CPT", "SNOMED", "LOINC", "RxNorm",
];

function extractPreservedTerms(text: string): string[] {
  const found: string[] = [];
  
  for (const term of PRESERVED_MEDICAL_TERMS) {
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(text)) {
      found.push(term);
    }
  }
  
  const icdPattern = /\b[A-Z]\d{2}(\.\d{1,4})?\b/g;
  const icdMatches = text.match(icdPattern);
  if (icdMatches) {
    found.push(...icdMatches);
  }
  
  const measurementPattern = /\b\d+\.?\d*\s*(mg|mcg|mL|L|dL|mmHg|bpm|kg|lb|%)/gi;
  const measurementMatches = text.match(measurementPattern);
  if (measurementMatches) {
    found.push(...measurementMatches);
  }
  
  return Array.from(new Set(found));
}

export async function translateMedicalText(
  text: string,
  targetLanguage: SupportedLanguage,
  options?: {
    preserveTerms?: boolean;
    readingLevel?: "simple" | "standard" | "technical";
    includeDisclaimer?: boolean;
    patientId?: string;
    userId?: string;
  }
): Promise<TranslationResult> {
  const cacheKey = getCacheKey(text, targetLanguage);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  if (options?.patientId) {
    logPhiAccess({
      action: "read",
      // eslint-disable-next-line tabulaAuth/no-fallback-identity -- NEEDS REVIEW: route passes (req as any).userId (typed any, may be undefined); make options.userId required once medical-terminology-translation-routes.ts passes getUserId(req)
      userId: options.userId || "system",
      patientId: options.patientId,
      resourceType: "MedicalTranslation",
      details: `TRANSLATE: Text to ${targetLanguage} (${text.length} chars)`,
    });
  }
  
  const preservedTerms = options?.preserveTerms !== false ? extractPreservedTerms(text) : [];
  
  if (targetLanguage === "en") {
    const result: TranslationResult = {
      original: text,
      translated: text,
      language: "en",
      preservedTerms,
      translatedAt: new Date().toISOString(),
    };
    translationCache.set(cacheKey, result);
    return result;
  }
  
  const langMeta = LANGUAGE_METADATA[targetLanguage];
  const readingLevel = options?.readingLevel || "standard";
  
  let translatedText: string;
  
  try {
    const preserveInstruction = preservedTerms.length > 0
      ? `\n\nCRITICAL: The following medical terms MUST remain EXACTLY as written (do NOT translate): ${preservedTerms.slice(0, 30).join(', ')}`
      : "";
    
    const readingLevelInstruction = readingLevel === "simple"
      ? "Use very simple language suitable for someone with limited health literacy."
      : readingLevel === "technical"
      ? "Maintain appropriate medical terminology for someone with health knowledge."
      : "Use clear, accessible language suitable for most adults.";
    
    const aiText = await generatePhiSafeText({
      system: `You are a medical translator specializing in patient health information. Translate the following text to ${langMeta.name} (${langMeta.nativeName}).

${readingLevelInstruction}
${preserveInstruction}

Rules:
1. Preserve all drug names, lab test names, and medical codes exactly as written
2. Translate condition names to their medically accurate equivalents in the target language
3. Keep all numerical values and units unchanged
4. Maintain the same tone and structure as the original
5. Ensure the translation is culturally appropriate

Return ONLY the translated text, no explanations.`,
      user: text,
      maxTokens: 2000,
    });

    translatedText = aiText || text;
  } catch (error) {
    console.error("[MedicalTranslation] AI translation failed:", error);
    translatedText = `[${langMeta.name}] ${text}`;
  }
  
  if (options?.includeDisclaimer) {
    translatedText = `${translatedText}\n\n${getNoCdsDisclaimer(targetLanguage)}`;
  }
  
  const result: TranslationResult = {
    original: text,
    translated: translatedText,
    language: targetLanguage,
    preservedTerms,
    translatedAt: new Date().toISOString(),
  };
  
  translationCache.set(cacheKey, result);
  return result;
}

export async function translateHealthSummary(
  summary: {
    title: string;
    conditions: string[];
    medications: string[];
    allergies: string[];
    keyPoints: string[];
    actionItems: string[];
  },
  targetLanguage: SupportedLanguage,
  options?: {
    patientId?: string;
    userId?: string;
    readingLevel?: "simple" | "standard" | "technical";
  }
): Promise<{
  title: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  keyPoints: string[];
  actionItems: string[];
  disclaimer: string;
}> {
  if (options?.patientId) {
    logPhiAccess({
      action: "read",
      // eslint-disable-next-line tabulaAuth/no-fallback-identity -- NEEDS REVIEW: route passes (req as any).userId (typed any, may be undefined); make options.userId required once medical-terminology-translation-routes.ts passes getUserId(req)
      userId: options.userId || "system",
      patientId: options.patientId,
      resourceType: "HealthSummaryTranslation",
      details: `TRANSLATE_SUMMARY: To ${targetLanguage}`,
    });
  }
  
  const translatedConditions = summary.conditions.map(c => 
    getConditionTranslation(c, targetLanguage)
  );
  
  const [titleResult, keyPointsResults, actionItemsResults] = await Promise.all([
    translateMedicalText(summary.title, targetLanguage, { 
      preserveTerms: true, 
      readingLevel: options?.readingLevel 
    }),
    Promise.all(summary.keyPoints.map(kp => 
      translateMedicalText(kp, targetLanguage, { 
        preserveTerms: true, 
        readingLevel: options?.readingLevel 
      })
    )),
    Promise.all(summary.actionItems.map(ai => 
      translateMedicalText(ai, targetLanguage, { 
        preserveTerms: true, 
        readingLevel: options?.readingLevel 
      })
    )),
  ]);
  
  return {
    title: titleResult.translated,
    conditions: translatedConditions,
    medications: summary.medications,
    allergies: summary.allergies.map(a => 
      a.toLowerCase().includes("no known") 
        ? getUITermTranslation("No Known Allergies", targetLanguage) 
        : a
    ),
    keyPoints: keyPointsResults.map(r => r.translated),
    actionItems: actionItemsResults.map(r => r.translated),
    disclaimer: getNoCdsDisclaimer(targetLanguage),
  };
}

export function getSupportedLanguages(): Array<{
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl: boolean;
}> {
  return Object.entries(LANGUAGE_METADATA).map(([code, meta]) => ({
    code: code as SupportedLanguage,
    name: meta.name,
    nativeName: meta.nativeName,
    rtl: meta.rtl,
  }));
}

export function translateMultipleConditions(
  conditions: string[],
  targetLanguage: SupportedLanguage
): string[] {
  return conditions.map(c => getConditionTranslation(c, targetLanguage));
}

export function translateReportTypes(
  reportTypes: string[],
  targetLanguage: SupportedLanguage
): string[] {
  return reportTypes.map(r => getReportTypeTranslation(r, targetLanguage));
}

export function translateUITerms(
  terms: string[],
  targetLanguage: SupportedLanguage
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const term of terms) {
    result[term] = getUITermTranslation(term, targetLanguage);
  }
  return result;
}

class MedicalTerminologyTranslationService {
  translateCondition(condition: string, language: SupportedLanguage): string {
    return getConditionTranslation(condition, language);
  }
  
  translateReportType(reportType: string, language: SupportedLanguage): string {
    return getReportTypeTranslation(reportType, language);
  }
  
  translateUITerm(term: string, language: SupportedLanguage): string {
    return getUITermTranslation(term, language);
  }
  
  async translateText(
    text: string, 
    language: SupportedLanguage, 
    options?: Parameters<typeof translateMedicalText>[2]
  ): Promise<TranslationResult> {
    return translateMedicalText(text, language, options);
  }
  
  async translateSummary(
    summary: Parameters<typeof translateHealthSummary>[0],
    language: SupportedLanguage,
    options?: Parameters<typeof translateHealthSummary>[2]
  ) {
    return translateHealthSummary(summary, language, options);
  }
  
  getSupportedLanguages() {
    return getSupportedLanguages();
  }
  
  getDisclaimer(language: SupportedLanguage): string {
    return getNoCdsDisclaimer(language);
  }
  
  getAvailableConditions(): string[] {
    return Object.keys(COMMON_CONDITIONS);
  }
  
  getAvailableReportTypes(): string[] {
    return Object.keys(REPORT_TYPES);
  }
  
  getAvailableUITerms(): string[] {
    return Object.keys(UI_MEDICAL_TERMS);
  }
}

export const medicalTerminologyTranslationService = new MedicalTerminologyTranslationService();

console.log("[MedicalTerminologyTranslation] Service initialized with 19 languages");
console.log(`[MedicalTerminologyTranslation] Conditions: ${Object.keys(COMMON_CONDITIONS).length}`);
console.log(`[MedicalTerminologyTranslation] Report types: ${Object.keys(REPORT_TYPES).length}`);
console.log(`[MedicalTerminologyTranslation] UI terms: ${Object.keys(UI_MEDICAL_TERMS).length}`);
