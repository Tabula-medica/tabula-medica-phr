import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Globe, Check, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

interface LanguageSelectorProps {
  userId: string;
  variant?: "default" | "compact" | "inline";
  showNativeName?: boolean;
  onLanguageChange?: (language: string) => void;
}

export function LanguageSelector({ 
  userId, 
  variant = "default",
  showNativeName = true,
  onLanguageChange
}: LanguageSelectorProps) {
  const { data: prefData } = useQuery<{
    preference: { defaultLanguage: string };
    supportedLanguages: SupportedLanguage[];
  }>({
    queryKey: ["/api/language-preferences/preferences", userId],
    queryFn: async () => {
      const response = await fetch(`/api/language-preferences/preferences/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch preferences");
      return response.json();
    }
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (language: string) => {
      const response = await apiRequest("POST", `/api/language-preferences/preferences/${userId}/default`, { language });
      return response.json();
    },
    onSuccess: (_, language) => {
      queryClient.invalidateQueries({ queryKey: ["/api/language-preferences/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/language-preferences/summaries"] });
      onLanguageChange?.(language);
    }
  });

  const currentLanguage = prefData?.preference?.defaultLanguage || "en";
  const languages = prefData?.supportedLanguages || [];
  const currentLangInfo = languages.find(l => l.code === currentLanguage);

  if (variant === "compact") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-language-compact">
            <Globe className="h-4 w-4" />
            <span className="uppercase text-xs font-medium">{currentLanguage}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="end">
          <div className="grid gap-1 max-h-60 overflow-y-auto">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-start gap-2",
                  lang.code === currentLanguage && "bg-accent"
                )}
                onClick={() => setDefaultMutation.mutate(lang.code)}
                disabled={setDefaultMutation.isPending}
                data-testid={`button-lang-${lang.code}`}
              >
                {lang.code === currentLanguage && <Check className="h-3 w-3" />}
                <span>{lang.name}</span>
                {showNativeName && lang.nativeName !== lang.name && (
                  <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                )}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (variant === "inline") {
    return (
      <Select 
        value={currentLanguage} 
        onValueChange={(value) => setDefaultMutation.mutate(value)}
        disabled={setDefaultMutation.isPending}
      >
        <SelectTrigger className="w-[180px]" data-testid="select-language-inline">
          <Globe className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code} data-testid={`option-lang-${lang.code}`}>
              {lang.name} {showNativeName && lang.nativeName !== lang.name && `(${lang.nativeName})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="language-selector-default">
      <Languages className="h-4 w-4 text-muted-foreground" />
      <Select 
        value={currentLanguage} 
        onValueChange={(value) => setDefaultMutation.mutate(value)}
        disabled={setDefaultMutation.isPending}
      >
        <SelectTrigger className="w-[220px]" data-testid="select-language-default">
          <SelectValue placeholder="Select default language" />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <div className="flex items-center gap-2">
                <span>{lang.name}</span>
                {showNativeName && lang.nativeName !== lang.name && (
                  <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentLangInfo && (
        <Badge variant="outline" className="text-xs">
          {currentLangInfo.nativeName}
        </Badge>
      )}
    </div>
  );
}

interface SummaryLanguageSwitchProps {
  userId: string;
  summaryId: string;
  currentLanguage?: string;
  onLanguageChange?: (language: string) => void;
}

export function SummaryLanguageSwitch({ 
  userId, 
  summaryId, 
  currentLanguage: propLanguage,
  onLanguageChange 
}: SummaryLanguageSwitchProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: prefData } = useQuery<{
    preference: { defaultLanguage: string; summaryLanguageOverrides: Record<string, string> };
    supportedLanguages: SupportedLanguage[];
  }>({
    queryKey: ["/api/language-preferences/preferences", userId],
    queryFn: async () => {
      const response = await fetch(`/api/language-preferences/preferences/${userId}`);
      if (!response.ok) throw new Error("Failed to fetch preferences");
      return response.json();
    }
  });

  const setSummaryLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      const response = await apiRequest("POST", `/api/language-preferences/preferences/${userId}/summary/${summaryId}`, { language });
      return response.json();
    },
    onSuccess: (_, language) => {
      queryClient.invalidateQueries({ queryKey: ["/api/language-preferences/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/language-preferences/summaries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/language-preferences/translate"] });
      setIsOpen(false);
      onLanguageChange?.(language);
    }
  });

  const defaultLanguage = prefData?.preference?.defaultLanguage || "en";
  const overrides = prefData?.preference?.summaryLanguageOverrides || {};
  const effectiveLanguage = propLanguage || overrides[summaryId] || defaultLanguage;
  const languages = prefData?.supportedLanguages || [];
  const isOverridden = !!overrides[summaryId];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1 h-7 px-2"
          data-testid={`button-switch-lang-${summaryId}`}
        >
          <Globe className="h-3 w-3" />
          <span className="text-xs uppercase">{effectiveLanguage}</span>
          {isOverridden && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">custom</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        <div className="text-xs font-medium mb-2 text-muted-foreground">
          Quick switch language
        </div>
        <div className="grid gap-1 max-h-48 overflow-y-auto">
          {languages.slice(0, 12).map((lang) => (
            <Button
              key={lang.code}
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start gap-2 h-7 text-xs",
                lang.code === effectiveLanguage && "bg-accent"
              )}
              onClick={() => setSummaryLanguageMutation.mutate(lang.code)}
              disabled={setSummaryLanguageMutation.isPending}
              data-testid={`button-summary-lang-${lang.code}`}
            >
              {lang.code === effectiveLanguage && <Check className="h-3 w-3" />}
              <span>{lang.name}</span>
            </Button>
          ))}
        </div>
        {languages.length > 12 && (
          <div className="text-xs text-muted-foreground mt-2 text-center">
            +{languages.length - 12} more languages
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
