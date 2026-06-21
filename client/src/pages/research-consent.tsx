import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Heart,
  Activity,
  Users,
  Pill,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Save,
  Lock,
  Unlock,
  FileText,
} from "lucide-react";

type ResearchCategory = 
  | "treatment_outcomes"
  | "late_effects"
  | "adherence_rates"
  | "quality_of_life"
  | "survival_rates"
  | "demographics"
  | "treatment_regimens"
  | "symptom_prevalence";

interface ResearchConsentItem {
  id: string;
  userId: string;
  profileId: string;
  category: ResearchCategory;
  isOptedIn: boolean;
  consentedAt: string;
  updatedAt: string;
  title: string;
  description: string;
}

const categoryIcons: Record<ResearchCategory, any> = {
  treatment_outcomes: TrendingUp,
  late_effects: AlertTriangle,
  adherence_rates: CheckCircle,
  quality_of_life: Heart,
  survival_rates: Activity,
  demographics: Users,
  treatment_regimens: Pill,
  symptom_prevalence: Brain,
};

const categoryColors: Record<ResearchCategory, string> = {
  treatment_outcomes: "text-green-500 bg-green-500/10",
  late_effects: "text-orange-500 bg-orange-500/10",
  adherence_rates: "text-blue-500 bg-blue-500/10",
  quality_of_life: "text-pink-500 bg-pink-500/10",
  survival_rates: "text-purple-500 bg-purple-500/10",
  demographics: "text-cyan-500 bg-cyan-500/10",
  treatment_regimens: "text-indigo-500 bg-indigo-500/10",
  symptom_prevalence: "text-amber-500 bg-amber-500/10",
};

function ConsentCard({
  consent,
  onToggle,
  isPending,
}: {
  consent: ResearchConsentItem;
  onToggle: (category: ResearchCategory, isOptedIn: boolean) => void;
  isPending: boolean;
}) {
  const Icon = categoryIcons[consent.category] || FileText;
  const colorClass = categoryColors[consent.category] || "text-primary bg-primary/10";
  const [iconBg, textColor] = colorClass.split(" ");

  return (
    <Card className={consent.isOptedIn ? "border-primary/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-medium">{consent.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {consent.description}
                </p>
              </div>
              <div className="flex items-center gap-3 min-h-[44px]">
                {consent.isOptedIn ? (
                  <Badge variant="default" className="bg-green-500 h-7">
                    <Unlock className="w-3 h-3 mr-1" />
                    Shared
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="h-7">
                    <Lock className="w-3 h-3 mr-1" />
                    Private
                  </Badge>
                )}
                <div className="flex items-center justify-center min-w-[44px] min-h-[44px]">
                  <Switch
                    checked={consent.isOptedIn}
                    onCheckedChange={(checked) => onToggle(consent.category, checked)}
                    disabled={isPending}
                    data-testid={`switch-consent-${consent.category}`}
                    className="scale-110"
                  />
                </div>
              </div>
            </div>
            {consent.isOptedIn && consent.consentedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Consented on {new Date(consent.consentedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResearchConsentPage() {
  const { toast } = useToast();
  const [pendingCategory, setPendingCategory] = useState<ResearchCategory | null>(null);

  const { data: consentsData, isLoading } = useQuery<{
    data: ResearchConsentItem[];
    meta: { totalCategories: number; optedInCount: number; optedOutCount: number };
  }>({
    queryKey: ["/api/research/patient/consents"],
  });

  const updateConsentMutation = useMutation({
    mutationFn: async ({ category, isOptedIn }: { category: ResearchCategory; isOptedIn: boolean }) => {
      const res = await apiRequest("PATCH", `/api/research/patient/consents/${category}`, {
        isOptedIn,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/patient/consents"] });
      toast({
        title: data.data.isOptedIn ? "Research Sharing Enabled" : "Research Sharing Disabled",
        description: data.message,
      });
      setPendingCategory(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
      setPendingCategory(null);
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (optInAll: boolean) => {
      const updates = consentsData?.data?.map(c => ({
        category: c.category,
        isOptedIn: optInAll,
      })) || [];
      const res = await apiRequest("PUT", "/api/research/patient/consents/bulk", { updates });
      return res.json();
    },
    onSuccess: (data, optInAll) => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/patient/consents"] });
      toast({
        title: optInAll ? "All Categories Enabled" : "All Categories Disabled",
        description: `You have ${optInAll ? "opted in to" : "opted out of"} sharing all data categories for research.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleToggleConsent = (category: ResearchCategory, isOptedIn: boolean) => {
    setPendingCategory(category);
    updateConsentMutation.mutate({ category, isOptedIn });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading consent settings...</p>
        </div>
      </div>
    );
  }

  const consents = consentsData?.data || [];
  const meta = consentsData?.meta || { totalCategories: 0, optedInCount: 0, optedOutCount: 0 };

  return (
    <div className="container max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" />
            Research Data Consent
          </h1>
          <p className="text-muted-foreground">
            Control how your health data is used for research
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Your Privacy Matters</AlertTitle>
        <AlertDescription>
          You have full control over which categories of your health data can be included in anonymized 
          research studies. Your data is always de-identified before being aggregated with other patients' 
          data. You can change these settings at any time.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Data Sharing Summary</CardTitle>
              <CardDescription>
                {meta.optedInCount} of {meta.totalCategories} categories shared for research
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkUpdateMutation.mutate(true)}
                disabled={bulkUpdateMutation.isPending}
                className="min-h-[44px]"
                data-testid="button-opt-in-all"
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4 mr-2" />
                )}
                Share All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkUpdateMutation.mutate(false)}
                disabled={bulkUpdateMutation.isPending}
                className="min-h-[44px]"
                data-testid="button-opt-out-all"
              >
                {bulkUpdateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Keep All Private
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(meta.optedInCount / meta.totalCategories) * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium">
              {Math.round((meta.optedInCount / meta.totalCategories) * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Data Categories</h2>
        {consents.map(consent => (
          <ConsentCard
            key={consent.category}
            consent={consent}
            onToggle={handleToggleConsent}
            isPending={pendingCategory === consent.category && updateConsentMutation.isPending}
          />
        ))}
      </div>

      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-medium text-blue-700 dark:text-blue-300">How Your Data Is Protected</h3>
              <ul className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1 list-disc list-inside">
                <li>All data is anonymized before being used for research</li>
                <li>Your name, address, and other identifying information is never shared</li>
                <li>Data is aggregated with many other patients to prevent identification</li>
                <li>Only healthcare providers and researchers with proper authorization can access aggregated data</li>
                <li>You can revoke consent at any time</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Why Share Your Data?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            By sharing your anonymized health data, you can help:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Improve Treatment</div>
              <div className="text-xs text-muted-foreground">
                Help researchers identify more effective treatments
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Advance Science</div>
              <div className="text-xs text-muted-foreground">
                Contribute to medical breakthroughs
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Help Future Patients</div>
              <div className="text-xs text-muted-foreground">
                Your experience can benefit others facing similar challenges
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium text-sm">Reduce Side Effects</div>
              <div className="text-xs text-muted-foreground">
                Aid in identifying and preventing late effects
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
