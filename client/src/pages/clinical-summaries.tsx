import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  Globe,
  Info,
  Languages,
  Loader2,
  RefreshCw,
  Settings,
  Stethoscope
} from "lucide-react";
import { format } from "date-fns";
import { LanguageSelector, SummaryLanguageSwitch } from "@/components/language-selector";

const USER_ID = "patient-001";
const PATIENT_ID = "patient-001";

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

interface ClinicalSummary {
  id: string;
  patientId: string;
  title: string;
  content: string;
  category: string;
  dateCreated: string;
  originalLanguage: string;
}

interface TranslatedSummary {
  originalSummary: ClinicalSummary;
  targetLanguage: string;
  translatedTitle: string;
  translatedContent: string;
  plainLanguageVersion: string;
  translatedAt: string;
  noCdsCompliance: string;
}

interface SummaryWithTranslation {
  original: ClinicalSummary;
  translated?: TranslatedSummary;
  effectiveLanguage: string;
}

export default function ClinicalSummaries() {
  const [activeTab, setActiveTab] = useState("summaries");
  const [selectedSummary, setSelectedSummary] = useState<SummaryWithTranslation | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: prefData, isLoading: loadingPrefs } = useQuery<{
    preference: { defaultLanguage: string; summaryLanguageOverrides: Record<string, string> };
    supportedLanguages: SupportedLanguage[];
  }>({
    queryKey: ["/api/language-preferences/preferences", USER_ID],
    queryFn: async () => {
      const response = await fetch(`/api/language-preferences/preferences/${USER_ID}`);
      if (!response.ok) throw new Error("Failed to fetch preferences");
      return response.json();
    }
  });

  const { data: summariesData, isLoading: loadingSummaries, refetch: refetchSummaries } = useQuery<{
    summaries: SummaryWithTranslation[];
    userPreference: any;
  }>({
    queryKey: ["/api/language-preferences/summaries", USER_ID, PATIENT_ID],
    queryFn: async () => {
      const response = await fetch(`/api/language-preferences/summaries/${USER_ID}/${PATIENT_ID}`);
      if (!response.ok) throw new Error("Failed to fetch summaries");
      return response.json();
    }
  });

  const { data: analyticsData } = useQuery<{
    summary: {
      totalLanguageSelections: number;
      totalSummaryLanguageChanges: number;
      languageDistribution: Record<string, number>;
      recentEvents: any[];
    };
  }>({
    queryKey: ["/api/language-preferences/analytics/summary"],
    queryFn: async () => {
      const response = await fetch("/api/language-preferences/analytics/summary");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    }
  });

  const translateMutation = useMutation({
    mutationFn: async ({ summaryId, language }: { summaryId: string; language?: string }) => {
      setTranslatingId(summaryId);
      const response = await apiRequest("POST", `/api/language-preferences/translate/${USER_ID}/${summaryId}`, { 
        language,
        includePlainLanguage: true,
        readingLevel: "intermediate"
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTranslatingId(null);
      if (selectedSummary && selectedSummary.original.id === data.translation.originalSummary.id) {
        setSelectedSummary({
          ...selectedSummary,
          translated: data.translation,
          effectiveLanguage: data.translation.targetLanguage
        });
      }
      toast({ title: "Summary translated", description: `Translated to ${data.translation.targetLanguage}` });
      refetchSummaries();
    },
    onError: () => {
      setTranslatingId(null);
      toast({ title: "Translation failed", description: "Please try again", variant: "destructive" });
    }
  });

  const defaultLanguage = prefData?.preference?.defaultLanguage || "en";
  const languages = prefData?.supportedLanguages || [];
  const currentLangInfo = languages.find(l => l.code === defaultLanguage);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "wellness visit": return <Stethoscope className="h-4 w-4" />;
      case "medication review": return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleQuickTranslate = (summary: SummaryWithTranslation, language: string) => {
    translateMutation.mutate({ summaryId: summary.original.id, language });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-clinical-summaries">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-clinical-summaries">
            <FileText className="h-8 w-8 text-primary" />
            Clinical Summaries
          </h1>
          <p className="text-muted-foreground mt-1">
            View your health visit summaries in your preferred language
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowSettings(true)}
            data-testid="button-language-settings"
          >
            <Settings className="h-4 w-4 mr-2" />
            Language Settings
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Default Language
              </CardTitle>
              <CardDescription>
                All summaries will display in this language unless you override individually
              </CardDescription>
            </div>
            <LanguageSelector userId={USER_ID} variant="inline" />
          </div>
        </CardHeader>
        {currentLangInfo && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Currently set to: <strong>{currentLangInfo.name}</strong> ({currentLangInfo.nativeName})</span>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summaries" data-testid="tab-summaries">
            <FileText className="h-4 w-4 mr-2" />
            Summaries
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <Languages className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summaries" className="space-y-4 mt-4">
          {loadingSummaries ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4">
              {summariesData?.summaries?.map((item) => (
                <Card 
                  key={item.original.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedSummary(item)}
                  data-testid={`card-summary-${item.original.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {getCategoryIcon(item.original.category)}
                          {item.translated?.translatedTitle || item.original.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.original.dateCreated), "MMMM d, yyyy")}
                          <Badge variant="outline" className="ml-2">{item.original.category}</Badge>
                        </CardDescription>
                      </div>
                      <div role="presentation" className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <SummaryLanguageSwitch 
                          userId={USER_ID} 
                          summaryId={item.original.id}
                          currentLanguage={item.effectiveLanguage}
                          onLanguageChange={(lang) => handleQuickTranslate(item, lang)}
                        />
                        {translatingId === item.original.id && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {item.translated?.translatedContent || item.original.content}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        {item.effectiveLanguage.toUpperCase()}
                      </Badge>
                      {item.translated && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          <Check className="h-3 w-3 mr-1" />
                          Translated
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      View Full Summary
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Language Selections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analyticsData?.summary?.totalLanguageSelections || 0}
                </div>
                <p className="text-xs text-muted-foreground">profile default changes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Switches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {analyticsData?.summary?.totalSummaryLanguageChanges || 0}
                </div>
                <p className="text-xs text-muted-foreground">per-summary changes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Languages Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {Object.keys(analyticsData?.summary?.languageDistribution || {}).length || 1}
                </div>
                <p className="text-xs text-muted-foreground">different languages</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Language Distribution</CardTitle>
              <CardDescription>How often each language has been selected</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.summary?.languageDistribution && Object.keys(analyticsData.summary.languageDistribution).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(analyticsData.summary.languageDistribution).map(([lang, count]) => {
                    const langInfo = languages.find(l => l.code === lang);
                    return (
                      <div key={lang} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{lang.toUpperCase()}</Badge>
                          <span>{langInfo?.name || lang}</span>
                          {langInfo?.nativeName && langInfo.nativeName !== langInfo.name && (
                            <span className="text-muted-foreground text-sm">({langInfo.nativeName})</span>
                          )}
                        </div>
                        <Badge>{count} selections</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No language selection data yet. Change your language preference to see analytics.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Last 10 language selection events</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.summary?.recentEvents && analyticsData.summary.recentEvents.length > 0 ? (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {analyticsData.summary.recentEvents.map((event, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={event.eventType === "language_selected" ? "default" : "secondary"}>
                            {event.eventType === "language_selected" ? "Default" : "Quick Switch"}
                          </Badge>
                          <span>
                            {event.previousLanguage?.toUpperCase() || "none"} → {event.newLanguage.toUpperCase()}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(event.timestamp), "MMM d, h:mm a")}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No recent activity
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedSummary} onOpenChange={() => setSelectedSummary(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSummary && getCategoryIcon(selectedSummary.original.category)}
              {selectedSummary?.translated?.translatedTitle || selectedSummary?.original.title}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {selectedSummary && format(new Date(selectedSummary.original.dateCreated), "MMMM d, yyyy")}
              <Badge variant="outline" className="ml-2">{selectedSummary?.original.category}</Badge>
              <Badge variant="secondary" className="ml-auto">
                <Globe className="h-3 w-3 mr-1" />
                {selectedSummary?.effectiveLanguage.toUpperCase()}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {selectedSummary?.translated?.noCdsCompliance && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {selectedSummary.translated.noCdsCompliance}
                  </AlertDescription>
                </Alert>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">
                  {selectedSummary?.translated?.translatedContent || selectedSummary?.original.content}
                </div>
              </div>

              {selectedSummary?.translated?.plainLanguageVersion && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Plain Language Version
                    </h4>
                    <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                      {selectedSummary.translated.plainLanguageVersion}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-4 border-t">
            <div role="presentation" className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm text-muted-foreground">Quick translate:</span>
              {selectedSummary && (
                <SummaryLanguageSwitch 
                  userId={USER_ID} 
                  summaryId={selectedSummary.original.id}
                  currentLanguage={selectedSummary.effectiveLanguage}
                  onLanguageChange={(lang) => {
                    if (selectedSummary) {
                      translateMutation.mutate({ summaryId: selectedSummary.original.id, language: lang });
                    }
                  }}
                />
              )}
              {translatingId === selectedSummary?.original.id && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
            </div>
            <Button variant="outline" onClick={() => setSelectedSummary(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Language Settings</DialogTitle>
            <DialogDescription>
              Configure your default language for clinical summaries
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Default Language</span>
              <p className="text-xs text-muted-foreground mb-2">
                All summaries will display in this language by default
              </p>
              <LanguageSelector userId={USER_ID} variant="default" />
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">About Translations</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Summaries are translated using AI while preserving medical accuracy.</p>
                <p>Plain language versions simplify medical terminology for easier understanding.</p>
                <p>You can override the language for individual summaries using the quick switch.</p>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Translations are for educational purposes only. Always verify important medical information with your healthcare provider.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
