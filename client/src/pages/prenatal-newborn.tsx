import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Baby,
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Activity,
  Stethoscope,
  Apple,
  Brain,
  Shield,
  Ear,
  Droplets,
  FlaskConical,
  ChevronRight,
  Info,
  BookOpen,
  Clock,
} from "lucide-react";

interface PrenatalGuideline {
  id: string;
  trimester: "first" | "second" | "third" | "preconception";
  title: string;
  description: string;
  category: string;
  weekRange: string;
  recommendations: string[];
  warningSignsToWatch: string[];
  source: string;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

interface NewbornScreeningPanel {
  id: string;
  name: string;
  abbreviation: string;
  category: string;
  description: string;
  conditionsTested: string[];
  sampleType: string;
  timing: string;
  prevalence: string;
  treatmentAvailable: boolean;
  source: string;
  noCdsDisclaimer: string;
}

interface PrenatalVisitSchedule {
  id: string;
  visitNumber: number;
  weekRange: string;
  trimester: string;
  title: string;
  procedures: string[];
  labTests: string[];
  screenings: string[];
  educationTopics: string[];
}

interface NewbornMilestone {
  id: string;
  ageRange: string;
  category: string;
  milestones: string[];
  redFlags: string[];
  source: string;
}

const trimesterLabels: Record<string, string> = {
  preconception: "Preconception",
  first: "1st Trimester",
  second: "2nd Trimester",
  third: "3rd Trimester",
};

const categoryIcons: Record<string, typeof Heart> = {
  screening: Stethoscope,
  nutrition: Apple,
  lifestyle: Activity,
  monitoring: Activity,
  vaccination: Shield,
  "mental-health": Brain,
  metabolic: FlaskConical,
  endocrine: Droplets,
  hemoglobin: Droplets,
  cardiac: Heart,
  hearing: Ear,
  other: Shield,
};

const categoryColors: Record<string, string> = {
  screening: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  nutrition: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  lifestyle: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  monitoring: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  vaccination: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "mental-health": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  metabolic: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  endocrine: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  hemoglobin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cardiac: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  hearing: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  other: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

export default function PrenatalNewbornPage() {
  useSEO({
    title: "Prenatal Care & Newborn Screening | Tabula Medica",
    description: "Evidence-based prenatal care guidelines, newborn screening panels, and developmental milestones.",
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTrimester, setSelectedTrimester] = useState<string>("all");
  const [selectedScreeningCategory, setSelectedScreeningCategory] = useState<string>("all");

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<any>({
    queryKey: ["/api/prenatal-newborn/dashboard"],
  });

  const guidelinesUrl = selectedTrimester !== "all"
    ? `/api/prenatal-newborn/prenatal-guidelines?trimester=${selectedTrimester}`
    : "/api/prenatal-newborn/prenatal-guidelines";

  const { data: guidelinesData, isLoading: guidelinesLoading } = useQuery<any>({
    queryKey: [guidelinesUrl],
  });

  const screeningUrl = selectedScreeningCategory !== "all"
    ? `/api/prenatal-newborn/newborn-screening?category=${selectedScreeningCategory}`
    : "/api/prenatal-newborn/newborn-screening";

  const { data: screeningData, isLoading: screeningLoading } = useQuery<any>({
    queryKey: [screeningUrl],
  });

  const { data: visitData, isLoading: visitLoading } = useQuery<any>({
    queryKey: ["/api/prenatal-newborn/visit-schedule"],
  });

  const { data: milestoneData, isLoading: milestoneLoading } = useQuery<any>({
    queryKey: ["/api/prenatal-newborn/newborn-milestones"],
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Baby className="h-6 w-6 text-pink-500" />
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Prenatal Care & Newborn Screening</h1>
          </div>
          <p className="text-muted-foreground">
            Evidence-based guidelines for prenatal care, newborn screening panels, and early developmental milestones.
          </p>
        </div>

        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-300" data-testid="text-disclaimer">
                This information is educational only and does not constitute clinical decision support (NO-CDS compliant). 
                Always consult your healthcare provider for personalized medical advice. Screening guidelines may vary by state and institution.
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Activity className="h-4 w-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="prenatal" data-testid="tab-prenatal">
              <Heart className="h-4 w-4 mr-1" />
              Prenatal Care
            </TabsTrigger>
            <TabsTrigger value="screening" data-testid="tab-screening">
              <FlaskConical className="h-4 w-4 mr-1" />
              Newborn Screening
            </TabsTrigger>
            <TabsTrigger value="visits" data-testid="tab-visits">
              <Calendar className="h-4 w-4 mr-1" />
              Visit Schedule
            </TabsTrigger>
            <TabsTrigger value="milestones" data-testid="tab-milestones">
              <Baby className="h-4 w-4 mr-1" />
              Milestones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <OverviewTab data={dashboardData} loading={dashboardLoading} />
          </TabsContent>

          <TabsContent value="prenatal" className="space-y-4 mt-4">
            <PrenatalTab
              data={guidelinesData}
              loading={guidelinesLoading}
              selectedTrimester={selectedTrimester}
              onTrimesterChange={setSelectedTrimester}
            />
          </TabsContent>

          <TabsContent value="screening" className="space-y-4 mt-4">
            <ScreeningTab
              data={screeningData}
              loading={screeningLoading}
              selectedCategory={selectedScreeningCategory}
              onCategoryChange={setSelectedScreeningCategory}
            />
          </TabsContent>

          <TabsContent value="visits" className="space-y-4 mt-4">
            <VisitScheduleTab data={visitData} loading={visitLoading} />
          </TabsContent>

          <TabsContent value="milestones" className="space-y-4 mt-4">
            <MilestonesTab data={milestoneData} loading={milestoneLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

function OverviewTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) {
    return <LoadingSkeleton count={4} />;
  }

  const stats = [
    {
      label: "Prenatal Guidelines",
      value: data?.prenatalGuidelines?.total || 0,
      icon: Heart,
      color: "text-pink-500",
    },
    {
      label: "Screening Panels",
      value: data?.newbornScreening?.total || 0,
      icon: FlaskConical,
      color: "text-blue-500",
    },
    {
      label: "Scheduled Visits",
      value: data?.visitSchedule?.total || 0,
      icon: Calendar,
      color: "text-green-500",
    },
    {
      label: "Developmental Milestones",
      value: data?.milestones?.total || 0,
      icon: Baby,
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const IconComp = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <IconComp className={`h-8 w-8 ${stat.color}`} />
                <span className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  {stat.value}
                </span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              Guidelines by Trimester
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.prenatalGuidelines?.byTrimester && Object.entries(data.prenatalGuidelines.byTrimester).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between" data-testid={`trimester-count-${key}`}>
                <span className="text-sm capitalize">{trimesterLabels[key] || key}</span>
                <Badge variant="secondary">{count as number}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-blue-500" />
              Screening by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.newbornScreening?.byCategory && Object.entries(data.newbornScreening.byCategory).map(([key, count]) => (
              <div key={key} className="flex items-center justify-between" data-testid={`screening-count-${key}`}>
                <span className="text-sm capitalize">{key}</span>
                <Badge variant="secondary">{count as number}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Evidence-Based Sources</p>
              <p className="text-xs text-muted-foreground">
                ACOG Practice Bulletins, ACMG Recommended Uniform Screening Panel (RUSP), AAP Bright Futures, 
                CDC Developmental Milestones, USPSTF Screening Recommendations, WHO Antenatal Care
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PrenatalTab({
  data,
  loading,
  selectedTrimester,
  onTrimesterChange,
}: {
  data: any;
  loading: boolean;
  selectedTrimester: string;
  onTrimesterChange: (v: string) => void;
}) {
  if (loading) {
    return <LoadingSkeleton count={3} />;
  }

  const guidelines: PrenatalGuideline[] = data?.guidelines || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["all", "preconception", "first", "second", "third"].map((t) => (
          <Button
            key={t}
            variant={selectedTrimester === t ? "default" : "outline"}
            size="sm"
            onClick={() => onTrimesterChange(t)}
            data-testid={`filter-trimester-${t}`}
          >
            {t === "all" ? "All" : trimesterLabels[t] || t}
          </Button>
        ))}
      </div>

      <Accordion type="multiple" className="space-y-3">
        {guidelines.map((guideline) => {
          const IconComp = categoryIcons[guideline.category] || Stethoscope;
          return (
            <AccordionItem key={guideline.id} value={guideline.id} className="border rounded-md px-4">
              <AccordionTrigger className="hover:no-underline py-4" data-testid={`guideline-${guideline.id}`}>
                <div className="flex items-start gap-3 text-left flex-1">
                  <IconComp className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{guideline.title}</span>
                      <Badge variant="outline" className={categoryColors[guideline.category]}>
                        {guideline.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{guideline.weekRange}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4 space-y-4">
                <p className="text-sm text-muted-foreground">{guideline.description}</p>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1.5 ml-6">
                    {guideline.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-muted-foreground list-disc">{rec}</li>
                    ))}
                  </ul>
                </div>

                {guideline.warningSignsToWatch.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Warning Signs to Watch
                    </h4>
                    <ul className="space-y-1.5 ml-6">
                      {guideline.warningSignsToWatch.map((sign, i) => (
                        <li key={i} className="text-sm text-amber-700 dark:text-amber-400 list-disc">{sign}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">Source: {guideline.source}</span>
                  <span className="text-xs text-muted-foreground">Updated: {guideline.lastUpdated}</span>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {guidelines.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No guidelines found for the selected filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScreeningTab({
  data,
  loading,
  selectedCategory,
  onCategoryChange,
}: {
  data: any;
  loading: boolean;
  selectedCategory: string;
  onCategoryChange: (v: string) => void;
}) {
  if (loading) {
    return <LoadingSkeleton count={3} />;
  }

  const panels: NewbornScreeningPanel[] = data?.panels || [];
  const categories = ["all", "metabolic", "endocrine", "hemoglobin", "cardiac", "hearing", "other"];

  return (
    <div className="space-y-4">
      {data?.disclaimer && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              {data.disclaimer}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button
            key={c}
            variant={selectedCategory === c ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(c)}
            data-testid={`filter-screening-${c}`}
          >
            {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {panels.map((panel) => {
          const IconComp = categoryIcons[panel.category] || FlaskConical;
          return (
            <Card key={panel.id} data-testid={`panel-${panel.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <IconComp className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{panel.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{panel.abbreviation}</Badge>
                </div>
                <CardDescription className="text-xs">{panel.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Sample:</span>
                    <p className="font-medium">{panel.sampleType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timing:</span>
                    <p className="font-medium">{panel.timing}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prevalence:</span>
                    <p className="font-medium">{panel.prevalence}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Treatment:</span>
                    <p className="font-medium flex items-center gap-1">
                      {panel.treatmentAvailable ? (
                        <><CheckCircle className="h-3 w-3 text-green-500" /> Available</>
                      ) : (
                        <><AlertTriangle className="h-3 w-3 text-amber-500" /> Limited</>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Conditions Tested:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {panel.conditionsTested.map((condition, i) => (
                      <Badge key={i} variant="secondary" className={`text-xs ${categoryColors[panel.category] || ""}`}>
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-2">Source: {panel.source}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function VisitScheduleTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) {
    return <LoadingSkeleton count={4} />;
  }

  const visits: PrenatalVisitSchedule[] = data?.visits || [];

  const trimesterColors: Record<string, string> = {
    first: "border-l-pink-400",
    second: "border-l-blue-400",
    third: "border-l-green-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-pink-400" />
          <span className="text-xs text-muted-foreground">1st Trimester</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-xs text-muted-foreground">2nd Trimester</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="text-xs text-muted-foreground">3rd Trimester</span>
        </div>
      </div>

      <div className="space-y-3">
        {visits.map((visit) => (
          <Card key={visit.id} className={`border-l-4 ${trimesterColors[visit.trimester] || ""} rounded-none rounded-r-md`} data-testid={`visit-${visit.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Visit {visit.visitNumber}: {visit.title}
                </CardTitle>
                <Badge variant="outline">{visit.weekRange}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                {visit.procedures.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Stethoscope className="h-3 w-3" /> Procedures
                    </h4>
                    <ul className="space-y-0.5">
                      {visit.procedures.map((p, i) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visit.labTests.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <FlaskConical className="h-3 w-3" /> Lab Tests
                    </h4>
                    <ul className="space-y-0.5">
                      {visit.labTests.map((t, i) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visit.screenings.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Screenings
                    </h4>
                    <ul className="space-y-0.5">
                      {visit.screenings.map((s, i) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {visit.educationTopics.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Education Topics
                    </h4>
                    <ul className="space-y-0.5">
                      {visit.educationTopics.map((e, i) => (
                        <li key={i} className="text-xs flex items-start gap-1.5">
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MilestonesTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) {
    return <LoadingSkeleton count={3} />;
  }

  const milestones: NewbornMilestone[] = data?.milestones || [];

  const milestoneIcons: Record<string, typeof Heart> = {
    physical: Activity,
    cognitive: Brain,
    social: Heart,
    language: BookOpen,
    feeding: Apple,
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {milestones.map((milestone) => {
          const IconComp = milestoneIcons[milestone.category] || Baby;
          return (
            <Card key={milestone.id} data-testid={`milestone-${milestone.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base flex items-center gap-2">
                    <IconComp className="h-4 w-4 text-muted-foreground" />
                    {milestone.category.charAt(0).toUpperCase() + milestone.category.slice(1)}
                  </CardTitle>
                  <Badge variant="outline">{milestone.ageRange}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-xs font-medium flex items-center gap-1 mb-1.5">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Expected Milestones
                  </h4>
                  <ul className="space-y-1 ml-4">
                    {milestone.milestones.map((m, i) => (
                      <li key={i} className="text-xs text-muted-foreground list-disc">{m}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-medium flex items-center gap-1 mb-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Red Flags
                  </h4>
                  <ul className="space-y-1 ml-4">
                    {milestone.redFlags.map((rf, i) => (
                      <li key={i} className="text-xs text-amber-700 dark:text-amber-400 list-disc">{rf}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-2">Source: {milestone.source}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
