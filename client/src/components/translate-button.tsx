import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Languages, Loader2, Eye, FileText, AlertTriangle, Check, Shield } from "lucide-react";

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

interface TranslatedContent {
  title?: string;
  content: string;
  plainLanguageVersion?: string;
  targetLanguage: string;
  translatedAt: string;
}

interface TranslateButtonProps {
  documentId: string;
  documentType: "snapshot_pdf" | "discharge_summary" | "timeline_monthly";
  originalContent: string;
  originalTitle?: string;
  userId?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

const MOCK_USER_ID = "user-001";

const documentTypeLabels: Record<string, string> = {
  snapshot_pdf: "Snapshot PDF",
  discharge_summary: "Discharge Summary",
  timeline_monthly: "Monthly Summary"
};

export function TranslateButton({
  documentId,
  documentType,
  originalContent,
  originalTitle,
  userId = MOCK_USER_ID,
  variant = "outline",
  size = "sm",
  className = ""
}: TranslateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [translatedContent, setTranslatedContent] = useState<TranslatedContent | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const { toast } = useToast();

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

  const translateMutation = useMutation({
    mutationFn: async (targetLanguage: string) => {
      const response = await apiRequest("POST", "/api/language-preferences/document/translate", {
        userId,
        documentId,
        documentType,
        targetLanguage,
        content: originalContent
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTranslatedContent({
        title: originalTitle,
        content: data.translation?.translatedContent || "Translation not available",
        plainLanguageVersion: data.translation?.plainLanguageVersion,
        targetLanguage: selectedLanguage,
        translatedAt: new Date().toISOString()
      });
      toast({
        title: "Translation complete",
        description: `Translated to ${getLanguageName(selectedLanguage)}`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/language-preferences/analytics"] });
    },
    onError: (error) => {
      toast({
        title: "Translation failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  });

  const viewOriginalMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/language-preferences/document/view-original", {
        userId,
        documentId,
        documentType
      });
    },
    onSuccess: () => {
      setShowOriginal(true);
    }
  });

  const getLanguageName = (code: string) => {
    const lang = prefData?.supportedLanguages?.find(l => l.code === code);
    return lang?.name || code;
  };

  const handleTranslate = () => {
    if (!selectedLanguage) {
      toast({
        title: "Select a language",
        description: "Please choose a target language",
        variant: "destructive"
      });
      return;
    }
    translateMutation.mutate(selectedLanguage);
  };

  const handleViewOriginal = () => {
    viewOriginalMutation.mutate();
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTranslatedContent(null);
      setShowOriginal(false);
      setSelectedLanguage("");
    }
  };

  const supportedLanguages = prefData?.supportedLanguages || [];
  const defaultLanguage = prefData?.preference?.defaultLanguage || "en";

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={`gap-2 ${className}`}
        data-testid={`button-translate-${documentType}-${documentId}`}
      >
        <Languages className="h-4 w-4" />
        Translate
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Translate {documentTypeLabels[documentType]}
            </DialogTitle>
            <DialogDescription>
              Translate this summary to your preferred language
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Select
              value={selectedLanguage}
              onValueChange={setSelectedLanguage}
            >
              <SelectTrigger className="flex-1" data-testid="select-target-language">
                <SelectValue placeholder="Select language..." />
              </SelectTrigger>
              <SelectContent>
                {supportedLanguages
                  .filter(lang => lang.code !== "en")
                  .map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <span className="flex items-center gap-2">
                        <span>{lang.name}</span>
                        <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                        {lang.code === defaultLanguage && (
                          <Badge variant="secondary" className="text-xs ml-1">Default</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleTranslate}
              disabled={!selectedLanguage || translateMutation.isPending}
              data-testid="button-start-translation"
            >
              {translateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Translating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Translate
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Educational Only</p>
                  <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                    This translation is for educational purposes only. NOT medical advice. 
                    Always consult your healthcare provider for clinical decisions.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">Clinical Terms Preserved</p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    Drug names, lab tests (HbA1c, CBC), ICD codes, and units (mg/dL, mmHg) 
                    remain in their original form for safety.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <ScrollArea className="flex-1 min-h-[200px]">
            {translatedContent ? (
              <div className="space-y-4 pr-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="gap-1">
                    <Languages className="h-3 w-3" />
                    {getLanguageName(translatedContent.targetLanguage)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleViewOriginal}
                    disabled={viewOriginalMutation.isPending}
                    data-testid="button-view-original"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showOriginal ? "Viewing Original" : "View Original"}
                  </Button>
                </div>

                {showOriginal ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Original (English)</span>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      {originalTitle && (
                        <h4 className="font-medium mb-2">{originalTitle}</h4>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{originalContent}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowOriginal(false)}
                    >
                      Back to Translation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-primary/5 rounded-lg border">
                      {originalTitle && (
                        <h4 className="font-medium mb-2">
                          {translatedContent.title || originalTitle}
                        </h4>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{translatedContent.content}</p>
                    </div>

                    {translatedContent.plainLanguageVersion && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Plain Language</Badge>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                          <p className="text-sm whitespace-pre-wrap">
                            {translatedContent.plainLanguageVersion}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="p-2 rounded-lg bg-muted/50 border mt-4">
                      <p className="text-xs text-muted-foreground text-center">
                        EDUCATIONAL ONLY. NOT MEDICAL ADVICE. Translation may not preserve all clinical nuances.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Languages className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a language and tap Translate to begin</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
