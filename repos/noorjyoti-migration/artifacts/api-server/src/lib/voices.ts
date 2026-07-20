export interface VoiceDef {
  id: string;
  label: string;
  gender: "female" | "male";
  character: string;
  openaiVoice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
}

export const VOICES: VoiceDef[] = [
  { id: "female_warm", label: "Priya", gender: "female", character: "Warm & soothing — like an evening prayer reader", openaiVoice: "nova" },
  { id: "female_bright", label: "Devi", gender: "female", character: "Crystal clear — like a morning recitation", openaiVoice: "shimmer" },
  { id: "female_expressive", label: "Anaya", gender: "female", character: "Expressive & lyrical — like a storyteller of legends", openaiVoice: "alloy" },
  { id: "male_deep", label: "Arjun", gender: "male", character: "Deep & calm — like an elder speaking truth", openaiVoice: "onyx" },
  { id: "male_clear", label: "Dev", gender: "male", character: "Clear & steady — like a teaching narrator", openaiVoice: "echo" },
  { id: "male_warm", label: "Rohan", gender: "male", character: "Warm & gentle — like a grandfather sharing wisdom", openaiVoice: "fable" },
];

export interface LanguageDef {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
}

export const LANGUAGES: LanguageDef[] = [
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", direction: "ltr" },
  { code: "en", name: "English", nativeName: "English", direction: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", direction: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", direction: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", direction: "ltr" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", direction: "ltr" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्", direction: "ltr" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", direction: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", direction: "rtl" },
  { code: "zh", name: "Chinese", nativeName: "中文", direction: "ltr" },
];

export function getVoice(id: string): VoiceDef | undefined {
  return VOICES.find((v) => v.id === id);
}

export function getLanguage(code: string): LanguageDef | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
