import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Languages } from "lucide-react";

interface Language {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

const TIER1_LANGUAGES: Language[] = [
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "zh-CN", name: "Mandarin (Simplified)", nativeName: "简体中文" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
  { code: "fr", name: "French", nativeName: "Français" },
];

const TIER2_LANGUAGES: Language[] = [
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "tl", name: "Tagalog", nativeName: "Tagalog" },
];

interface LanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  includeEnglish?: boolean;
  showTiers?: boolean;
}

export function LanguageSelector({ 
  value, 
  onValueChange, 
  includeEnglish = true,
  showTiers = true 
}: LanguageSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full" data-testid="select-language-trigger">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          <SelectValue placeholder="Select language" />
        </div>
      </SelectTrigger>
      <SelectContent data-testid="select-language-content">
        {includeEnglish && (
          <SelectItem value="en" data-testid="select-language-en">
            <div className="flex items-center gap-2">
              <span>English</span>
              <span className="text-muted-foreground">(English)</span>
            </div>
          </SelectItem>
        )}

        {showTiers && (
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Priority Languages
          </div>
        )}
        
        {TIER1_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code} data-testid={`select-language-${lang.code}`}>
            <div className="flex items-center gap-2">
              <span>{lang.name}</span>
              <span className="text-muted-foreground">({lang.nativeName})</span>
              {showTiers && <Badge variant="secondary" className="text-xs">Tier 1</Badge>}
            </div>
          </SelectItem>
        ))}

        {showTiers && (
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
            Additional Languages
          </div>
        )}
        
        {TIER2_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code} data-testid={`select-language-${lang.code}`}>
            <div className="flex items-center gap-2">
              <span>{lang.name}</span>
              <span className="text-muted-foreground">({lang.nativeName})</span>
              {showTiers && <Badge variant="outline" className="text-xs">Tier 2</Badge>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getAllLanguages(): Language[] {
  return [
    { code: "en", name: "English", nativeName: "English" },
    ...TIER1_LANGUAGES,
    ...TIER2_LANGUAGES,
  ];
}

export function getLanguageByCode(code: string): Language | undefined {
  return getAllLanguages().find((l) => l.code === code);
}
