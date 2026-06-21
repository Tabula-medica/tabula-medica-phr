import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Mic, Globe, Volume2, Check, ChevronRight, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./language-provider";

interface OnboardingLanguageStepProps {
  selectedLanguage: string;
  onLanguageSelect: (code: string) => void;
  onContinue: () => void;
}

export function OnboardingLanguageStep({
  selectedLanguage,
  onLanguageSelect,
  onContinue,
}: OnboardingLanguageStepProps) {
  const selectedLangInfo = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage);

  const welcomeMessages: Record<string, string> = {
    en: "Welcome to Tabula Medica",
    es: "Bienvenido a Tabula Medica",
    zh: "欢迎使用 Tabula Medica",
    hi: "टबुला मेडिका में आपका स्वागत है",
    ar: "مرحبًا بك في Tabula Medica",
    pt: "Bem-vindo ao Tabula Medica",
    bn: "Tabula Medica-তে স্বাগতম",
    ru: "Добро пожаловать в Tabula Medica",
    ja: "Tabula Medicaへようこそ",
    pa: "Tabula Medica ਵਿੱਚ ਜੀ ਆਇਆਂ ਨੂੰ",
    de: "Willkommen bei Tabula Medica",
    ko: "Tabula Medica에 오신 것을 환영합니다",
    fr: "Bienvenue sur Tabula Medica",
    vi: "Chào mừng đến với Tabula Medica",
    tl: "Maligayang Pagdating sa Tabula Medica",
    it: "Benvenuto in Tabula Medica",
    fa: "به Tabula Medica خوش آمدید",
    te: "Tabula Medica కు స్వాగతం",
    ne: "Tabula Medica मा स्वागत छ",
  };

  return (
    <div className="space-y-6" data-testid="onboarding-language-step">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Languages className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold" data-testid="text-welcome-message">
          {welcomeMessages[selectedLanguage] || welcomeMessages.en}
        </h2>
        <p className="text-muted-foreground">
          Choose your preferred language for the app and AI features
        </p>
      </div>

      <Card data-testid="card-language-selection">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Select Your Language
          </CardTitle>
          <CardDescription>
            This will be used for the app interface, voice commands, and AI-generated content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto p-1">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onLanguageSelect(lang.code)}
                className={cn(
                  "flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left",
                  selectedLanguage === lang.code
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
                data-testid={`button-select-lang-${lang.code}`}
              >
                <div className="flex items-center gap-2 w-full">
                  {selectedLanguage === lang.code && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="font-medium text-sm truncate">{lang.nativeName}</span>
                </div>
                <span className="text-xs text-muted-foreground mt-1">{lang.name}</span>
                {lang.direction === "rtl" && (
                  <Badge variant="outline" className="mt-1 text-[10px]">RTL</Badge>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedLangInfo && (
        <Card className="bg-primary/5 border-primary/20" data-testid="card-language-features">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <span className="font-medium">
                {selectedLangInfo.nativeName} selected
              </span>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                <span>Voice commands will recognize {selectedLangInfo.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <span>AI responses will be spoken in {selectedLangInfo.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>Health summaries will be generated in {selectedLangInfo.name}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={onContinue} data-testid="button-language-continue">
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export function LanguageQuickSelector({
  value,
  onChange,
  showLabel = true,
}: {
  value: string;
  onChange: (code: string) => void;
  showLabel?: boolean;
}) {
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === value);

  return (
    <div className="flex items-center gap-2" data-testid="language-quick-selector">
      {showLabel && (
        <Globe className="h-4 w-4 text-muted-foreground" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border rounded-md px-3 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
        data-testid="select-quick-language"
        aria-label="Select language"
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName} ({lang.name})
          </option>
        ))}
      </select>
    </div>
  );
}
