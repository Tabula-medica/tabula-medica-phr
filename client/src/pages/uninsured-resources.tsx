import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Search,
  ExternalLink,
  Heart,
  DollarSign,
  Stethoscope,
  Building2,
  Pill,
  ShieldCheck,
  TrendingDown,
  Info,
  ScanLine,
  FileText,
  MapPin,
  UserPlus,
  Users,
  Phone,
  Globe,
  CheckCircle,
  Loader2,
  CreditCard,
  ArrowRight,
  Calculator,
  Shield,
  Award,
  HandHelping,
  Home,
  Utensils,
  Brain,
  Briefcase,
  Zap,
  Baby,
  Scale,
  BookOpen,
  Car,
  HeartPulse,
  Star,
  Clock,
  ChevronRight,
  AlertCircle,
  Download,
  Database,
  Wifi,
  ClipboardList,
  RefreshCw,
} from "lucide-react";

interface MedicareRate {
  cptCode: string;
  description: string;
  category: string;
  medicareRate: number;
  typicalUninsuredRate: number;
  savings: string;
  year: number;
}

interface ImagingService {
  id: string;
  name: string;
  radiologyAssistPrice: string;
  typicalHospitalPrice: string;
  savings: string;
}

interface CommunityResource {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
}

interface DiscountProvider {
  id: string;
  name: string;
  type: string;
  specialties: string[];
  location: string;
  state: string;
  acceptsMedicareRates: boolean;
  discountPercent: number;
  phone: string;
  website: string;
  acceptingNewPatients: boolean;
}

interface EligibilityProgram {
  id: string;
  name: string;
  type: string;
  description: string;
  eligible: boolean;
  reason: string;
}

interface MarketplacePlan {
  id: string;
  name: string;
  metalLevel: string;
  issuer: string;
  monthlyPremium: number;
  estimatedPremiumAfterSubsidy: number;
  deductible: number;
  maxOutOfPocket: number;
  copayCoverage: { primary: string; specialist: string; er: string; generic: string };
  rating: number;
  features: string[];
}

const metalColors: Record<string, string> = {
  catastrophic: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  bronze: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  silver: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  platinum: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

function CMSEligibilityPanel() {
  const [income, setIncome] = useState("");
  const [household, setHousehold] = useState("1");
  const [zipCode, setZipCode] = useState("");
  const [age, setAge] = useState("");
  const [state, setState] = useState("");

  const checkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/cms-marketplace/check-eligibility", {
        annualIncome: income,
        householdSize: household,
        zipCode,
        age: age || "35",
        state,
      });
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-primary/20" data-testid="card-eligibility-checker">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Healthcare Coverage Eligibility Checker
          </CardTitle>
          <CardDescription>
            Check if you qualify for Medicaid, CHIP, or ACA Marketplace subsidies based on your household income. Uses 2026 Federal Poverty Level guidelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <Label htmlFor="uninsured-resources-annual-household-income" className="text-sm font-medium mb-1 block">Annual Household Income</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="uninsured-resources-annual-household-income"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="e.g., 35000"
                  className="pl-9"
                  type="number"
                  data-testid="input-eligibility-income"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="uninsured-resources-household-size" className="text-sm font-medium mb-1 block">Household Size</Label>
              <Select value={household} onValueChange={setHousehold}>
                <SelectTrigger id="uninsured-resources-household-size" data-testid="select-household-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "person" : "people"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="uninsured-resources-zip-code" className="text-sm font-medium mb-1 block">ZIP Code</Label>
              <Input id="uninsured-resources-zip-code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g., 90210"
                maxLength={5}
                data-testid="input-eligibility-zip"
              />
            </div>
            <div>
              <Label htmlFor="uninsured-resources-your-age" className="text-sm font-medium mb-1 block">Your Age</Label>
              <Input id="uninsured-resources-your-age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g., 35"
                type="number"
                data-testid="input-eligibility-age"
              />
            </div>
            <div>
              <Label htmlFor="uninsured-resources-state" className="text-sm font-medium mb-1 block">State</Label>
              <Input id="uninsured-resources-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g., CA, TX, NY"
                maxLength={2}
                data-testid="input-eligibility-state"
              />
            </div>
          </div>
          <Button
            onClick={() => checkMutation.mutate()}
            disabled={!income || !zipCode || checkMutation.isPending}
            className="w-full"
            data-testid="button-check-eligibility"
          >
            {checkMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking eligibility...</>
            ) : (
              <><Shield className="h-4 w-4 mr-2" />Check My Eligibility</>
            )}
          </Button>
        </CardContent>
      </Card>

      {checkMutation.data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className={checkMutation.data.estimatedSubsidy > 0 ? "border-green-200 dark:border-green-800" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Your Eligibility Results
              </CardTitle>
              <CardDescription>
                Based on {checkMutation.data.fplPercent}% of Federal Poverty Level (FPL)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {checkMutation.data.programs?.map((prog: EligibilityProgram) => (
                  <div
                    key={prog.id}
                    className={`p-3 rounded-lg border ${prog.eligible ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : "border-muted bg-muted/30"}`}
                    data-testid={`card-program-${prog.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {prog.eligible ? (
                        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm">{prog.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">{prog.reason}</p>
                  </div>
                ))}
              </div>

              {checkMutation.data.estimatedSubsidy > 0 && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-center">
                  <p className="text-sm text-muted-foreground">Estimated Monthly Subsidy</p>
                  <p className="text-3xl font-bold text-green-600" data-testid="text-subsidy-amount">
                    ${checkMutation.data.estimatedSubsidy}/mo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">This amount reduces your monthly premium</p>
                </div>
              )}

              {checkMutation.data.csr && (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertDescription>
                    You qualify for <strong>Cost-Sharing Reductions ({checkMutation.data.csr.tier})</strong> on Silver plans.
                    Your deductible could be as low as <strong>${checkMutation.data.csr.reducedDeductible}</strong> and
                    max out-of-pocket <strong>${checkMutation.data.csr.reducedOOP}</strong>.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {checkMutation.data.marketplace?.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2026 Marketplace Plans in Your Area</CardTitle>
                <CardDescription>Estimated monthly premiums after subsidies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {checkMutation.data.marketplace.map((plan: MarketplacePlan) => (
                    <div
                      key={plan.id}
                      className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      data-testid={`card-plan-${plan.id}`}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium">{plan.name}</span>
                            <Badge className={`text-xs ${metalColors[plan.metalLevel] || ""}`}>
                              {plan.metalLevel.charAt(0).toUpperCase() + plan.metalLevel.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{plan.issuer}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {plan.features.map((f, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {checkMutation.data.estimatedSubsidy > 0 && (
                            <p className="text-xs line-through text-muted-foreground">${plan.monthlyPremium}/mo</p>
                          )}
                          <p className="text-xl font-bold text-primary">
                            ${plan.estimatedPremiumAfterSubsidy}/mo
                          </p>
                          <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                            <p>Deductible: ${plan.deductible.toLocaleString()}</p>
                            <p>Max OOP: ${plan.maxOutOfPocket.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <p className="text-muted-foreground">Primary</p>
                          <p className="font-medium">{plan.copayCoverage.primary}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Specialist</p>
                          <p className="font-medium">{plan.copayCoverage.specialist}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">ER</p>
                          <p className="font-medium">{plan.copayCoverage.er}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Generic Rx</p>
                          <p className="font-medium">{plan.copayCoverage.generic}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="flex-1" data-testid="link-healthcare-gov">
              <a href={checkMutation.data.enrollmentUrl} target="_blank" rel="noopener noreferrer">
                Enroll at Healthcare.gov <ExternalLink className="h-4 w-4 ml-2" />
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground italic">{checkMutation.data.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

interface SDoHResource {
  id: string;
  name: string;
  organizationName: string;
  category: string;
  description: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;
  distance: number;
  eligibility: string[];
  hours: string;
  languages: string[];
  acceptsUninsured: boolean;
  slidingScale: boolean;
  freeServices: boolean;
  lastVerified: string;
  rating: number;
  servicesOffered: string[];
}

interface ScreeningQuestion {
  id: string;
  question: string;
  category: string;
}

const SDOH_CATEGORY_ICONS: Record<string, typeof Heart> = {
  healthcare: Stethoscope,
  food: Utensils,
  housing: Home,
  transportation: Car,
  financial: DollarSign,
  legal: Scale,
  education: BookOpen,
  employment: Briefcase,
  "mental-health": Brain,
  "substance-use": HeartPulse,
  childcare: Baby,
  utilities: Zap,
};

function FindHelpPanel() {
  const [zipCode, setZipCode] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [radius, setRadius] = useState("10");
  const [showScreening, setShowScreening] = useState(false);
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, boolean>>({});

  const searchMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ zipCode, radius });
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      const res = await fetch(`/api/findhelp/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
  });

  const screeningQuery = useQuery<{ questions: ScreeningQuestion[]; source: string }>({
    queryKey: ["/api/findhelp/screening"],
    enabled: showScreening,
  });

  const screeningMutation = useMutation({
    mutationFn: async () => {
      const answers = Object.entries(screeningAnswers).map(([id, positive]) => {
        const q = screeningQuery.data?.questions.find(qq => qq.id === id);
        return { id, positive, category: q?.category };
      });
      const res = await apiRequest("POST", "/api/findhelp/screening/results", { answers, zipCode: zipCode || "10001" });
      return res.json();
    },
  });

  const handleSearch = () => {
    if (!zipCode || !/^\d{5}$/.test(zipCode)) return;
    searchMutation.mutate();
  };

  const handleScreeningSubmit = () => {
    screeningMutation.mutate();
  };

  const toggleScreeningAnswer = (questionId: string) => {
    setScreeningAnswers(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20" data-testid="card-findhelp-search">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HandHelping className="h-5 w-5 text-primary" />
            FindHelp.org Community Resource Search
          </CardTitle>
          <CardDescription>
            Find free and low-cost social services near you — healthcare, food assistance, housing, transportation, financial help, and more. Powered by the nation's leading social care network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="uninsured-resources-zip-code-2" className="text-sm font-medium mb-1 block">ZIP Code</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="uninsured-resources-zip-code-2"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="e.g., 10001"
                  className="pl-9"
                  maxLength={5}
                  data-testid="input-findhelp-zip"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="uninsured-resources-category" className="text-sm font-medium mb-1 block">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger id="uninsured-resources-category" data-testid="select-findhelp-category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="healthcare">Healthcare & Clinics</SelectItem>
                  <SelectItem value="food">Food Assistance</SelectItem>
                  <SelectItem value="housing">Housing & Shelter</SelectItem>
                  <SelectItem value="mental-health">Mental Health</SelectItem>
                  <SelectItem value="financial">Financial Assistance</SelectItem>
                  <SelectItem value="transportation">Transportation</SelectItem>
                  <SelectItem value="legal">Legal Aid</SelectItem>
                  <SelectItem value="employment">Employment</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="childcare">Childcare</SelectItem>
                  <SelectItem value="utilities">Utility Assistance</SelectItem>
                  <SelectItem value="substance-use">Substance Use Recovery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="uninsured-resources-search-radius" className="text-sm font-medium mb-1 block">Search Radius</Label>
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger id="uninsured-resources-search-radius" data-testid="select-findhelp-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 miles</SelectItem>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSearch}
              disabled={!zipCode || zipCode.length !== 5 || searchMutation.isPending}
              className="flex-1"
              data-testid="button-findhelp-search"
            >
              {searchMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Find Resources
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowScreening(!showScreening)}
              data-testid="button-findhelp-screening"
            >
              <FileText className="h-4 w-4 mr-2" />
              Needs Screening
            </Button>
          </div>
        </CardContent>
      </Card>

      {showScreening && (
        <Card className="border-blue-200 dark:border-blue-800" data-testid="card-sdoh-screening">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Social Needs Screening
            </CardTitle>
            <CardDescription>
              Answer these questions to identify what types of community resources may help you. Based on the CMS Accountable Health Communities screening tool.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {screeningQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : screeningQuery.data?.questions ? (
              <>
                {screeningQuery.data.questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${screeningAnswers[q.id] ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700" : "hover:bg-muted/50"}`}
                    {...clickable(() => toggleScreeningAnswer(q.id))}
                    data-testid={`screening-question-${q.id}`}
                  >
                    <div className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${screeningAnswers[q.id] ? "bg-blue-600 border-blue-600" : "border-muted-foreground/40"}`}>
                      {screeningAnswers[q.id] && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{idx + 1}. {q.question}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{q.category.replace("-", " ")}</Badge>
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex gap-2">
                  <Button onClick={handleScreeningSubmit} disabled={screeningMutation.isPending} className="flex-1" data-testid="button-submit-screening">
                    {screeningMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Get Recommendations ({Object.values(screeningAnswers).filter(Boolean).length} needs identified)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Source: {screeningQuery.data.source}
                </p>
              </>
            ) : null}

            {screeningMutation.data && (
              <div className="space-y-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Badge variant={screeningMutation.data.totalNeeds >= 3 ? "destructive" : "secondary"}>
                    {screeningMutation.data.totalNeeds} need{screeningMutation.data.totalNeeds !== 1 ? "s" : ""} identified
                  </Badge>
                  {screeningMutation.data.followUpRecommended && (
                    <Badge variant="outline" className="text-amber-700 dark:text-amber-400">Follow-up recommended</Badge>
                  )}
                </div>

                {screeningMutation.data.crisisResources && (
                  <Alert className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-sm space-y-1">
                      <p className="font-semibold text-red-800 dark:text-red-200">If you're in crisis:</p>
                      <p>{screeningMutation.data.crisisResources.lifeline}</p>
                      <p>{screeningMutation.data.crisisResources.crisisText}</p>
                      <p>{screeningMutation.data.crisisResources.veteransCrisis}</p>
                    </AlertDescription>
                  </Alert>
                )}

                {screeningMutation.data.recommendations.map((rec: { category: string; label: string; urgency: string; resources: SDoHResource[] }) => {
                  const IconComponent = SDOH_CATEGORY_ICONS[rec.category] || Heart;
                  return (
                    <Card key={rec.category} className={rec.urgency === "high" ? "border-red-200 dark:border-red-800" : ""} data-testid={`card-recommendation-${rec.category}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {rec.label}
                          <Badge variant={rec.urgency === "high" ? "destructive" : "outline"} className="text-xs ml-auto">
                            {rec.urgency} priority
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {rec.resources.map((r: SDoHResource) => (
                          <div key={r.id} className="flex items-start justify-between gap-2 p-2 bg-muted/30 rounded text-sm">
                            <div>
                              <p className="font-medium">{r.name}</p>
                              <p className="text-xs text-muted-foreground">{r.phone}</p>
                            </div>
                            {r.website && (
                              <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" asChild>
                                <a
                                  href={r.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Visit ${r.name} website (opens in new tab)`}
                                >
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              </Button>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {searchMutation.data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" data-testid="text-findhelp-results-count">
              {searchMutation.data.totalResults} resource{searchMutation.data.totalResults !== 1 ? "s" : ""} found within {searchMutation.data.query.radius} miles of {searchMutation.data.query.zipCode}
            </p>
          </div>

          {searchMutation.data.categories && searchMutation.data.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {searchMutation.data.categories.map((cat: { category: string; count: number; label: string }) => {
                const IconComponent = SDOH_CATEGORY_ICONS[cat.category] || Heart;
                return (
                  <Badge
                    key={cat.category}
                    variant={selectedCategory === cat.category ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => { setSelectedCategory(cat.category === selectedCategory ? "all" : cat.category); }}
                    data-testid={`badge-category-${cat.category}`}
                  >
                    <IconComponent className="h-3 w-3 mr-1" />
                    {cat.label} ({cat.count})
                  </Badge>
                );
              })}
            </div>
          )}

          {searchMutation.data.resources.map((resource: SDoHResource) => {
            const IconComponent = SDOH_CATEGORY_ICONS[resource.category] || Heart;
            return (
              <Card key={resource.id} data-testid={`card-resource-${resource.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <IconComponent className="h-4 w-4 text-primary shrink-0" />
                        <span data-testid={`text-resource-name-${resource.id}`}>{resource.name}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{resource.organizationName}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {resource.freeServices && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Free</Badge>}
                      {resource.slidingScale && <Badge variant="outline" className="text-xs">Sliding Scale</Badge>}
                      <div className="flex items-center gap-0.5 ml-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{resource.rating}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{resource.description}</p>

                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p>{resource.address}</p>
                        <p>{resource.city}, {resource.state} {resource.zipCode}</p>
                        <p className="text-muted-foreground">{resource.distance} miles away</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{resource.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{resource.hours}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span>{resource.languages.join(", ")}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-1">Services Offered</p>
                    <div className="flex flex-wrap gap-1">
                      {resource.servicesOffered.map(service => (
                        <Badge key={service} variant="secondary" className="text-xs font-normal">{service}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium mb-1">Eligibility</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {resource.eligibility.map((req, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t">
                    <p className="text-xs text-muted-foreground">Verified: {resource.lastVerified}</p>
                    {resource.website && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" asChild data-testid={`link-resource-website-${resource.id}`}>
                        <a href={resource.website} target="_blank" rel="noopener noreferrer">
                          Visit Website <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!searchMutation.data && !showScreening && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Stethoscope className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold" data-testid="text-sdoh-fqhc-count">1,400+</div>
              <p className="text-sm text-muted-foreground">Federally Qualified Health Centers</p>
              <p className="text-xs text-muted-foreground mt-1">Sliding-scale care regardless of insurance</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <Utensils className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">60,000+</div>
              <p className="text-sm text-muted-foreground">Food Pantries Nationwide</p>
              <p className="text-xs text-muted-foreground mt-1">No documentation required at most locations</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <HandHelping className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">500,000+</div>
              <p className="text-sm text-muted-foreground">Programs on FindHelp.org</p>
              <p className="text-xs text-muted-foreground mt-1">Connecting people to social services since 2010</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface SesameService {
  id: string;
  name: string;
  category: string;
  description: string;
  sesamePrice: number;
  typicalInsuredPrice: number;
  typicalUninsuredPrice: number;
  duration: string;
  includedItems: string[];
}

interface SesameProviderInfo {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  bio: string;
  languages: string[];
  acceptsNewPatients: boolean;
  nextAvailable: string;
  address: string;
  city: string;
  state: string;
  distance: number;
  virtualAvailable: boolean;
  inPersonAvailable: boolean;
}

interface DPCPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  bestFor: string;
  savings: string;
}

function PayerClaimsPanel() {
  const [selectedPayer, setSelectedPayer] = useState<string | null>(null);
  const [claimsView, setClaimsView] = useState<"payers" | "claims" | "providers" | "coverage" | "checklist">("payers");
  const [payerSearch, setPayerSearch] = useState("");
  const [payerCategory, setPayerCategory] = useState("all");
  const [claimTypeFilter, setClaimTypeFilter] = useState("all");

  const { data: payerData, isLoading: payersLoading } = useQuery<any>({
    queryKey: ["/api/payer-fhir/payers", payerCategory, payerSearch],
    queryFn: () => fetch(`/api/payer-fhir/payers?category=${payerCategory}&search=${payerSearch}`).then(r => r.json()),
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery<any>({
    queryKey: ["/api/payer-fhir/claims", selectedPayer, claimTypeFilter],
    queryFn: () => fetch(`/api/payer-fhir/claims/${selectedPayer}?type=${claimTypeFilter}`).then(r => r.json()),
    enabled: !!selectedPayer && claimsView === "claims",
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<any>({
    queryKey: ["/api/payer-fhir/provider-directory", selectedPayer],
    queryFn: () => fetch(`/api/payer-fhir/provider-directory/${selectedPayer}`).then(r => r.json()),
    enabled: !!selectedPayer && claimsView === "providers",
  });

  const { data: coverageData, isLoading: coverageLoading } = useQuery<any>({
    queryKey: ["/api/payer-fhir/coverage", selectedPayer],
    queryFn: () => fetch(`/api/payer-fhir/coverage/${selectedPayer}`).then(r => r.json()),
    enabled: !!selectedPayer && claimsView === "coverage",
  });

  const { data: checklistData } = useQuery<any>({
    queryKey: ["/api/payer-fhir/transition-checklist"],
    enabled: claimsView === "checklist",
  });

  const selectedPayerInfo = payerData?.payers?.find((p: any) => p.id === selectedPayer);

  const handleSelectPayer = (payerId: string) => {
    setSelectedPayer(payerId);
    setClaimsView("claims");
  };

  const formatCurrency = (amount: number) => `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "denied": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "pending": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "in-process": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getClaimTypeIcon = (type: string) => {
    switch (type) {
      case "professional": return <Stethoscope className="h-4 w-4" />;
      case "pharmacy": return <Pill className="h-4 w-4" />;
      case "dental": return <Star className="h-4 w-4" />;
      case "vision": return <Search className="h-4 w-4" />;
      case "institutional": return <Building2 className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="payer-claims-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-claims-title">
            <Database className="h-5 w-5 text-primary" />
            Payer FHIR Claims Access
          </CardTitle>
          <CardDescription data-testid="text-claims-description">
            Under CMS-9115-F, insurers must give you digital access to your claims, EOBs, and provider directories via FHIR APIs.
            Download your complete medical history before transitioning off insurance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={claimsView === "payers" ? "default" : "outline"} size="sm" onClick={() => setClaimsView("payers")} data-testid="btn-view-payers">
              <Wifi className="h-4 w-4 mr-1" /> Connect to Payer
            </Button>
            {selectedPayer && (
              <>
                <Button variant={claimsView === "claims" ? "default" : "outline"} size="sm" onClick={() => setClaimsView("claims")} data-testid="btn-view-claims">
                  <FileText className="h-4 w-4 mr-1" /> Claims & EOBs
                </Button>
                <Button variant={claimsView === "providers" ? "default" : "outline"} size="sm" onClick={() => setClaimsView("providers")} data-testid="btn-view-providers">
                  <Users className="h-4 w-4 mr-1" /> Provider Directory
                </Button>
                <Button variant={claimsView === "coverage" ? "default" : "outline"} size="sm" onClick={() => setClaimsView("coverage")} data-testid="btn-view-coverage">
                  <Shield className="h-4 w-4 mr-1" /> Coverage & Benefits
                </Button>
              </>
            )}
            <Button variant={claimsView === "checklist" ? "default" : "outline"} size="sm" onClick={() => setClaimsView("checklist")} data-testid="btn-view-checklist">
              <ClipboardList className="h-4 w-4 mr-1" /> Transition Checklist
            </Button>
          </div>

          {selectedPayer && claimsView !== "payers" && claimsView !== "checklist" && (
            <Alert className="mb-4">
              <Wifi className="h-4 w-4" />
              <AlertDescription data-testid="text-connected-payer">
                Connected to: <strong>{selectedPayerInfo?.payerName}</strong>
                <Button variant="ghost" size="sm" className="ml-2 h-6" onClick={() => { setSelectedPayer(null); setClaimsView("payers"); }} data-testid="btn-disconnect">
                  Change Payer
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {claimsView === "payers" && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input placeholder="Search insurers..." value={payerSearch} onChange={(e) => setPayerSearch(e.target.value)} className="max-w-xs" data-testid="input-payer-search" />
            <Select value={payerCategory} onValueChange={setPayerCategory}>
              <SelectTrigger className="w-[200px]" data-testid="select-payer-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="medicare">Medicare</SelectItem>
                <SelectItem value="medicaid">Medicaid</SelectItem>
                <SelectItem value="marketplace">Marketplace</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {payerData?.complianceInfo && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription data-testid="text-compliance-info">
                <strong>{payerData.complianceInfo.rule}</strong> — Your insurer must provide digital access to your claims data. This is your federally protected right.
              </AlertDescription>
            </Alert>
          )}

          {payersLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {payerData?.payers?.map((payer: any) => (
                <Card key={payer.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelectPayer(payer.id)} data-testid={`card-payer-${payer.id}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span data-testid={`text-payer-name-${payer.id}`}>{payer.payerName}</span>
                      <Badge variant={payer.status === "live" ? "default" : "secondary"} data-testid={`badge-payer-status-${payer.id}`}>
                        {payer.status === "live" ? "API Live" : payer.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription>Payer ID: {payer.payerId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {payer.supportedResources.map((r: string) => (
                        <Badge key={r} variant="outline" className="text-xs" data-testid={`badge-resource-${payer.id}-${r}`}>{r}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Badge variant="outline" className="text-xs">{payer.category}</Badge></span>
                      <span>Verified {payer.lastVerified}</span>
                    </div>
                    <Button className="w-full mt-2" size="sm" data-testid={`btn-connect-${payer.id}`}>
                      <Wifi className="h-4 w-4 mr-1" /> Connect & Pull Records
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {claimsView === "claims" && selectedPayer && (
        <div className="space-y-4">
          {claimsData?.summary && (
            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-summary-billed">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Billed</p>
                  <p className="text-2xl font-bold" data-testid="text-total-billed">{formatCurrency(claimsData.summary.totalBilled)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-summary-paid">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Insurer Paid</p>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-total-paid">{formatCurrency(claimsData.summary.totalPaidByInsurer)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-summary-patient">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Your Cost</p>
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-patient-cost">{formatCurrency(claimsData.summary.totalPatientResponsibility)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-summary-savings">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Network Savings</p>
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-network-savings">{formatCurrency(claimsData.summary.networkSavings)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex gap-3 flex-wrap items-center">
            <Select value={claimTypeFilter} onValueChange={setClaimTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-claim-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="institutional">Institutional</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
                <SelectItem value="dental">Dental</SelectItem>
                <SelectItem value="vision">Vision</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" data-testid="btn-export-claims">
              <Download className="h-4 w-4 mr-1" /> Export FHIR Bundle
            </Button>
            <Button variant="outline" size="sm" data-testid="btn-export-pdf">
              <FileText className="h-4 w-4 mr-1" /> Download PDF EOBs
            </Button>
          </div>

          {claimsData?.dataRetentionNotice && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription data-testid="text-retention-notice">{claimsData.dataRetentionNotice}</AlertDescription>
            </Alert>
          )}

          {claimsLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              {claimsData?.claims?.map((claim: any) => (
                <Card key={claim.id} data-testid={`card-claim-${claim.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getClaimTypeIcon(claim.claimType)}
                          <span className="font-medium" data-testid={`text-claim-provider-${claim.id}`}>{claim.provider}</span>
                          <Badge className={`text-xs ${getStatusColor(claim.status)}`} data-testid={`badge-claim-status-${claim.id}`}>
                            {claim.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{claim.claimType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{claim.facilityName} — {claim.dateOfService}</p>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {claim.diagnosisCodes.map((dx: any) => (
                            <p key={dx.code}><span className="font-mono">{dx.code}</span> — {dx.description}</p>
                          ))}
                          {claim.procedureCodes.map((px: any) => (
                            <p key={px.code}><span className="font-mono">{px.code}</span> — {px.description}</p>
                          ))}
                        </div>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <p className="text-sm text-muted-foreground line-through">{formatCurrency(claim.billedAmount)}</p>
                        <p className="font-medium text-green-600" data-testid={`text-claim-paid-${claim.id}`}>Paid: {formatCurrency(claim.paidAmount)}</p>
                        <p className="text-sm text-orange-600" data-testid={`text-claim-responsibility-${claim.id}`}>You: {formatCurrency(claim.patientResponsibility)}</p>
                        {claim.copay > 0 && <p className="text-xs text-muted-foreground">Copay: {formatCurrency(claim.copay)}</p>}
                        {claim.coinsurance > 0 && <p className="text-xs text-muted-foreground">Coinsurance: {formatCurrency(claim.coinsurance)}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {claimsView === "providers" && selectedPayer && (
        <div className="space-y-4">
          {providersLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Save this provider list before your coverage ends. These providers accepted your plan and may offer competitive self-pay rates.
                </AlertDescription>
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                {providersData?.providers?.map((prov: any) => (
                  <Card key={prov.id} data-testid={`card-provider-${prov.id}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span data-testid={`text-provider-name-${prov.id}`}>{prov.name}</span>
                        <Badge variant={prov.acceptingNewPatients ? "default" : "secondary"}>
                          {prov.acceptingNewPatients ? "Accepting Patients" : "Not Accepting"}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{prov.specialty} — NPI: {prov.npi}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {prov.addresses.map((addr: any, i: number) => (
                        <p key={i} className="text-sm flex items-center gap-1"><MapPin className="h-3 w-3" /> {addr.line}, {addr.city}, {addr.state} {addr.zip}</p>
                      ))}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={prov.networkStatus === "in-network" ? "border-green-500 text-green-600" : ""}>{prov.networkStatus}</Badge>
                        {prov.telehealth && <Badge variant="outline" className="border-blue-500 text-blue-600">Telehealth</Badge>}
                        {prov.languages.map((lang: string) => <Badge key={lang} variant="outline" className="text-xs">{lang}</Badge>)}
                      </div>
                      {prov.boardCertifications.length > 0 && (
                        <p className="text-xs text-muted-foreground">Board Certified: {prov.boardCertifications.join(", ")}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button variant="outline" className="w-full" data-testid="btn-export-providers">
                <Download className="h-4 w-4 mr-1" /> Export Provider Directory (CSV)
              </Button>
            </>
          )}
        </div>
      )}

      {claimsView === "coverage" && selectedPayer && (
        <div className="space-y-4">
          {coverageLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : coverageData && (
            <>
              <Card data-testid="card-coverage-summary">
                <CardHeader>
                  <CardTitle className="text-lg">{coverageData.planName}</CardTitle>
                  <CardDescription>
                    {coverageData.payerName} — {coverageData.planType} — Member ID: {coverageData.memberId} — Group: {coverageData.groupNumber}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium mb-2">Individual Deductible</p>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{formatCurrency(coverageData.deductibleStatus.individual.met)} / {formatCurrency(coverageData.deductibleStatus.individual.total)}</span>
                          <span className="text-sm font-medium">{Math.round((coverageData.deductibleStatus.individual.met / coverageData.deductibleStatus.individual.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                          <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(coverageData.deductibleStatus.individual.met / coverageData.deductibleStatus.individual.total) * 100}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm font-medium mb-2">Out-of-Pocket Max</p>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">{formatCurrency(coverageData.outOfPocketStatus.individual.met)} / {formatCurrency(coverageData.outOfPocketStatus.individual.total)}</span>
                          <span className="text-sm font-medium">{Math.round((coverageData.outOfPocketStatus.individual.met / coverageData.outOfPocketStatus.individual.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                          <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: `${(coverageData.outOfPocketStatus.individual.met / coverageData.outOfPocketStatus.individual.total) * 100}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-benefits-table">
                <CardHeader>
                  <CardTitle className="text-base">Benefits Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Category</th>
                          <th className="text-left py-2 pr-4">In-Network</th>
                          <th className="text-left py-2 pr-4">Out-of-Network</th>
                          <th className="text-left py-2 pr-4">Prior Auth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coverageData.benefits.map((b: any, i: number) => (
                          <tr key={i} className="border-b last:border-0" data-testid={`row-benefit-${i}`}>
                            <td className="py-2 pr-4 font-medium">{b.category}</td>
                            <td className="py-2 pr-4">{b.inNetworkCopay}</td>
                            <td className="py-2 pr-4">{b.outOfNetworkCopay}</td>
                            <td className="py-2 pr-4">{b.priorAuthRequired ? <Badge variant="destructive" className="text-xs">Required</Badge> : <Badge variant="outline" className="text-xs">No</Badge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              <Button variant="outline" className="w-full" data-testid="btn-export-coverage">
                <Download className="h-4 w-4 mr-1" /> Export Coverage Summary (PDF)
              </Button>
            </>
          )}
        </div>
      )}

      {claimsView === "checklist" && (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Losing insurance coverage? Use this checklist to preserve your medical history and prepare for the transition. Complete these steps before your coverage ends.
            </AlertDescription>
          </Alert>
          {checklistData?.steps?.map((step: any) => (
            <Card key={step.id} data-testid={`card-checklist-${step.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.priority === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                    step.priority === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {step.id}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium" data-testid={`text-step-title-${step.id}`}>{step.title}</span>
                      <Badge variant={step.priority === "critical" ? "destructive" : step.priority === "high" ? "default" : "secondary"} className="text-xs">
                        {step.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{step.timeframe}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-step-desc-${step.id}`}>{step.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SesameCarePanel() {
  const [zipCode, setZipCode] = useState("");
  const [serviceCategory, setServiceCategory] = useState("all");
  const [specialty, setSpecialty] = useState("all");
  const [viewMode, setViewMode] = useState<"services" | "providers" | "dpc">("services");
  const [selectedService, setSelectedService] = useState<SesameService | null>(null);

  const servicesQuery = useQuery<{ services: SesameService[]; categories: { name: string; count: number }[] }>({
    queryKey: ["/api/sesame-care/services", serviceCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (serviceCategory !== "all") params.set("category", serviceCategory);
      const res = await fetch(`/api/sesame-care/services?${params}`);
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  const providersMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ zipCode });
      if (specialty !== "all") params.set("specialty", specialty);
      const res = await fetch(`/api/sesame-care/providers?${params}`);
      if (!res.ok) throw new Error("Failed to fetch providers");
      return res.json() as Promise<{ providers: SesameProviderInfo[] }>;
    },
  });

  const dpcQuery = useQuery<{ plans: DPCPlan[]; whatIsDPC: { title: string; description: string; benefits: string[]; stats: { practicesNationwide: number; averageMonthlyCost: number; averageVisitLength: string; patientSatisfaction: string } } }>({
    queryKey: ["/api/sesame-care/dpc-plans"],
    enabled: viewMode === "dpc",
  });

  const handleProviderSearch = () => {
    if (!zipCode || !/^\d{5}$/.test(zipCode)) return;
    providersMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        <Button variant={viewMode === "services" ? "default" : "outline"} size="sm" onClick={() => setViewMode("services")} data-testid="button-sesame-services">
          <DollarSign className="h-4 w-4 mr-1" /> Services & Pricing
        </Button>
        <Button variant={viewMode === "providers" ? "default" : "outline"} size="sm" onClick={() => setViewMode("providers")} data-testid="button-sesame-providers">
          <Stethoscope className="h-4 w-4 mr-1" /> Find Providers
        </Button>
        <Button variant={viewMode === "dpc" ? "default" : "outline"} size="sm" onClick={() => setViewMode("dpc")} data-testid="button-sesame-dpc">
          <Award className="h-4 w-4 mr-1" /> DPC Memberships
        </Button>
      </div>

      {viewMode === "services" && (
        <div className="space-y-4">
          <Card className="border-primary/20" data-testid="card-sesame-services">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Sesame Care — Transparent Healthcare Pricing
              </CardTitle>
              <CardDescription>
                Book doctor visits, lab work, therapy, and more at upfront, no-surprise prices. No insurance needed — pay the price you see.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant={serviceCategory === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setServiceCategory("all")} data-testid="badge-category-all">All</Badge>
                {servicesQuery.data?.categories?.map(cat => (
                  <Badge key={cat.name} variant={serviceCategory === cat.name ? "default" : "outline"} className="cursor-pointer" onClick={() => setServiceCategory(cat.name)} data-testid={`badge-category-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}>
                    {cat.name} ({cat.count})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {servicesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {servicesQuery.data?.services.map(service => {
                const savingsPercent = Math.round(((service.typicalUninsuredPrice - service.sesamePrice) / service.typicalUninsuredPrice) * 100);
                return (
                  <Card key={service.id} className={`transition-all ${selectedService?.id === service.id ? "ring-2 ring-primary" : ""}`} data-testid={`card-service-${service.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm">{service.name}</CardTitle>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 shrink-0">
                          Save {savingsPercent}%
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">{service.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Sesame Price</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid={`text-price-${service.id}`}>${service.sesamePrice}</p>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5 pb-1">
                          <p className="line-through">Typical uninsured: ${service.typicalUninsuredPrice}</p>
                          <p className="line-through">With insurance: ${service.typicalInsuredPrice}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{service.duration}</span>
                        <Badge variant="outline" className="text-xs">{service.category}</Badge>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-1">Included:</p>
                        <div className="flex flex-wrap gap-1">
                          {service.includedItems.map(item => (
                            <span key={item} className="text-xs bg-muted/50 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5 text-green-600" />{item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" className="w-full" variant="outline" onClick={() => setSelectedService(service === selectedService ? null : service)} data-testid={`button-select-${service.id}`}>
                        {selectedService?.id === service.id ? "Selected" : "Select & Find Provider"}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === "providers" && (
        <div className="space-y-4">
          <Card className="border-primary/20" data-testid="card-sesame-provider-search">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Find Direct-Pay Providers Near You
              </CardTitle>
              <CardDescription>
                Search for doctors, therapists, and specialists who offer transparent, upfront pricing without insurance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="uninsured-resources-zip-code-3" className="text-sm font-medium mb-1 block">ZIP Code</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="uninsured-resources-zip-code-3" value={zipCode} onChange={e => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="e.g., 10001" className="pl-9" maxLength={5} data-testid="input-sesame-zip" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="uninsured-resources-specialty" className="text-sm font-medium mb-1 block">Specialty</Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger id="uninsured-resources-specialty" data-testid="select-sesame-specialty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specialties</SelectItem>
                      <SelectItem value="Primary Care">Primary Care</SelectItem>
                      <SelectItem value="Mental Health">Mental Health</SelectItem>
                      <SelectItem value="Dermatology">Dermatology</SelectItem>
                      <SelectItem value="Women's Health">Women's Health</SelectItem>
                      <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                      <SelectItem value="Urgent Care">Urgent Care</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleProviderSearch} disabled={!zipCode || zipCode.length !== 5 || providersMutation.isPending} className="w-full" data-testid="button-search-providers">
                    {providersMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {providersMutation.data && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground" data-testid="text-provider-results-count">
                {providersMutation.data.providers.length} provider{providersMutation.data.providers.length !== 1 ? "s" : ""} found near {zipCode}
              </p>
              {providersMutation.data.providers.map(provider => (
                <Card key={provider.id} data-testid={`card-provider-${provider.id}`}>
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-4">
                      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Stethoscope className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h3 className="font-semibold text-base" data-testid={`text-provider-name-${provider.id}`}>{provider.name}</h3>
                            <p className="text-xs text-muted-foreground">{provider.credentials}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-0.5">
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-semibold">{provider.rating}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">({provider.reviewCount} reviews)</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{provider.bio}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{provider.city}, {provider.state} — {provider.distance} mi</span>
                          <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{provider.languages.join(", ")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-xs">{provider.specialty}</Badge>
                          {provider.virtualAvailable && <Badge variant="secondary" className="text-xs">Telehealth</Badge>}
                          {provider.inPersonAvailable && <Badge variant="secondary" className="text-xs">In-Person</Badge>}
                          {provider.acceptsNewPatients && <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">Accepting Patients</Badge>}
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <p className="text-xs text-muted-foreground">Next available: <span className="font-medium text-foreground">{provider.nextAvailable}</span></p>
                          <Button size="sm" variant="outline" className="text-xs h-7" data-testid={`button-book-${provider.id}`}>
                            Book Appointment <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!providersMutation.data && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="text-center">
                <CardContent className="pt-6">
                  <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold">60-80%</div>
                  <p className="text-sm text-muted-foreground">Less than ER / urgent care</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">Same Day</div>
                  <p className="text-sm text-muted-foreground">Appointments available</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-6">
                  <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">$0 Surprise</div>
                  <p className="text-sm text-muted-foreground">Bills — pay the price you see</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {viewMode === "dpc" && (
        <div className="space-y-4">
          {dpcQuery.isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : dpcQuery.data ? (
            <>
              <Card className="border-primary/20" data-testid="card-dpc-explainer">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    {dpcQuery.data.whatIsDPC.title}
                  </CardTitle>
                  <CardDescription>{dpcQuery.data.whatIsDPC.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="text-center p-3 bg-muted/50 rounded">
                      <p className="text-2xl font-bold text-primary">{dpcQuery.data.whatIsDPC.stats.practicesNationwide.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">DPC Practices</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded">
                      <p className="text-2xl font-bold text-green-600">${dpcQuery.data.whatIsDPC.stats.averageMonthlyCost}/mo</p>
                      <p className="text-xs text-muted-foreground">Average Cost</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded">
                      <p className="text-2xl font-bold">{dpcQuery.data.whatIsDPC.stats.averageVisitLength}</p>
                      <p className="text-xs text-muted-foreground">Visit Length</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded">
                      <p className="text-2xl font-bold text-primary">{dpcQuery.data.whatIsDPC.stats.patientSatisfaction}</p>
                      <p className="text-xs text-muted-foreground">Satisfaction</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Benefits of DPC:</p>
                    <ul className="grid gap-1 sm:grid-cols-2 text-sm">
                      {dpcQuery.data.whatIsDPC.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                {dpcQuery.data.plans.map(plan => (
                  <Card key={plan.id} className={plan.id === "dpc-family" ? "border-primary ring-1 ring-primary/20" : ""} data-testid={`card-plan-${plan.id}`}>
                    <CardHeader className="pb-2 text-center">
                      {plan.id === "dpc-family" && <Badge className="mx-auto mb-2 bg-primary">Most Popular</Badge>}
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <div className="pt-2">
                        <span className="text-3xl font-bold text-green-600 dark:text-green-400">${plan.monthlyPrice}</span>
                        <span className="text-muted-foreground text-sm">/month</span>
                      </div>
                      <p className="text-xs text-muted-foreground">or ${plan.annualPrice}/year (save ${plan.monthlyPrice * 12 - plan.annualPrice})</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                      <Separator />
                      <ul className="space-y-1.5 text-sm">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground text-sm">{plan.bestFor}</p>
                        <p className="mt-1 text-green-700 dark:text-green-400 font-medium">{plan.savings}</p>
                      </div>
                      <Button className="w-full" variant={plan.id === "dpc-family" ? "default" : "outline"} data-testid={`button-enroll-${plan.id}`}>
                        Learn More <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function UninsuredResources() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [providerState, setProviderState] = useState("all");
  const [providerType, setProviderType] = useState("all");

  const [signupForm, setSignupForm] = useState({ firstName: "", lastName: "", email: "", phone: "", zipCode: "" });
  const [enrollForm, setEnrollForm] = useState({ providerName: "", npi: "", specialty: "", email: "", phone: "", address: "", state: "" });

  const { data: ratesData, isLoading: ratesLoading } = useQuery<{ rates: MedicareRate[]; categories: string[]; year: number }>({
    queryKey: ["/api/uninsured-resources/medicare-rates"],
  });

  const { data: searchData } = useQuery<{ rates: MedicareRate[]; total: number }>({
    queryKey: ["/api/uninsured-resources/medicare-rates/search", searchQuery, selectedCategory],
    enabled: searchQuery.length > 0 || selectedCategory !== "all",
  });

  const { data: imagingData, isLoading: imagingLoading } = useQuery<{ services: ImagingService[] }>({
    queryKey: ["/api/uninsured-resources/imaging-services"],
  });

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery<{ resources: CommunityResource[]; categories: string[] }>({
    queryKey: ["/api/uninsured-resources/community-resources"],
  });

  const { data: providersData, isLoading: providersLoading } = useQuery<{ providers: DiscountProvider[]; providerTypes: string[]; states: string[] }>({
    queryKey: ["/api/uninsured-resources/discount-providers", providerState, providerType],
  });

  const patientSignup = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/uninsured-resources/patient-signup", signupForm);
      return res.json();
    },
  });

  const providerEnroll = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/uninsured-resources/provider-enrollment", enrollForm);
      return res.json();
    },
  });

  const rates = searchQuery || selectedCategory !== "all" ? (searchData?.rates || []) : (ratesData?.rates || []);
  const categories = ratesData?.categories || [];
  const rateYear = ratesData?.year || 2026;
  const imagingServices = imagingData?.services || [];
  const resources = resourcesData?.resources || [];
  const resourceCategories = resourcesData?.categories || [];
  const providers = providersData?.providers || [];
  const providerTypes = providersData?.providerTypes || [];
  const states = providersData?.states || [];

  const filteredProviders = providers.filter(p => {
    if (providerState !== "all" && p.state !== providerState) return false;
    if (providerType !== "all" && p.type !== providerType) return false;
    return true;
  });

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
          Savings & Resources for Uninsured Patients
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Affordable healthcare options including discounted imaging, {rateYear} Medicare-rate pricing, provider directory, and community resources.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription data-testid="text-disclaimer">
          Tabula Medica does not provide medical services or sell medications. This page provides informational resources
          and links to third-party programs. Prices shown are estimates based on {rateYear} CMS Medicare Fee Schedule and may vary by location and provider.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="eligibility" className="space-y-6">
        <TabsList className="grid w-full max-w-7xl grid-cols-9" data-testid="tabs-resources">
          <TabsTrigger value="eligibility" data-testid="tab-eligibility">
            <Shield className="h-4 w-4 mr-1" />
            Eligibility
          </TabsTrigger>
          <TabsTrigger value="claims" data-testid="tab-claims">
            <Database className="h-4 w-4 mr-1" />
            Claims
          </TabsTrigger>
          <TabsTrigger value="sesame" data-testid="tab-sesame">
            <Stethoscope className="h-4 w-4 mr-1" />
            Sesame Care
          </TabsTrigger>
          <TabsTrigger value="findhelp" data-testid="tab-findhelp">
            <HandHelping className="h-4 w-4 mr-1" />
            FindHelp
          </TabsTrigger>
          <TabsTrigger value="imaging" data-testid="tab-imaging">
            <ScanLine className="h-4 w-4 mr-1" />
            Radiology
          </TabsTrigger>
          <TabsTrigger value="medicare" data-testid="tab-medicare">
            <DollarSign className="h-4 w-4 mr-1" />
            Medicare Rates
          </TabsTrigger>
          <TabsTrigger value="discount-platform" data-testid="tab-discount-platform">
            <CreditCard className="h-4 w-4 mr-1" />
            Discount
          </TabsTrigger>
          <TabsTrigger value="providers" data-testid="tab-providers">
            <Building2 className="h-4 w-4 mr-1" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <Heart className="h-4 w-4 mr-1" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eligibility" className="space-y-6">
          <CMSEligibilityPanel />
        </TabsContent>

        <TabsContent value="claims" className="space-y-6">
          <PayerClaimsPanel />
        </TabsContent>

        <TabsContent value="sesame" className="space-y-6">
          <SesameCarePanel />
        </TabsContent>

        <TabsContent value="findhelp" className="space-y-6">
          <FindHelpPanel />
        </TabsContent>

        <TabsContent value="imaging" className="space-y-6">
          <Card data-testid="card-radiology-assist">
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ScanLine className="h-5 w-5 text-primary" />
                    RadiologyAssist.com
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-2xl">
                    Affordable imaging services for uninsured and out-of-pocket patients. Get MRI, CT, X-Ray,
                    and Ultrasound scans at a fraction of hospital prices.
                  </CardDescription>
                </div>
                <Button asChild data-testid="link-radiology-assist">
                  <a href="https://www.radiologyassist.com" target="_blank" rel="noopener noreferrer">
                    Visit RadiologyAssist.com
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600" data-testid="text-savings-highlight">Up to 90%</div>
                    <p className="text-sm text-muted-foreground">savings vs hospital prices</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <ScanLine className="h-8 w-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold" data-testid="text-mri-price">MRI from $250</div>
                    <p className="text-sm text-muted-foreground">vs $2,500+ at hospitals</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <ShieldCheck className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">No Insurance Needed</div>
                    <p className="text-sm text-muted-foreground">pay out-of-pocket directly</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Imaging Price Comparison</h3>
                {imagingLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {imagingServices.map((service) => (
                      <Card key={service.id} data-testid={`card-imaging-${service.id}`}>
                        <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                          <div className="flex items-center gap-3">
                            <ScanLine className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="font-medium" data-testid={`text-imaging-name-${service.id}`}>{service.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Hospital price: <span className="line-through">{service.typicalHospitalPrice}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600" data-testid={`text-imaging-price-${service.id}`}>
                                {service.radiologyAssistPrice}
                              </p>
                              <Badge variant="secondary">{service.savings} savings</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medicare" className="space-y-6">
          <Card data-testid="card-uninsured-plan">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Stethoscope className="h-5 w-5 text-primary" />
                {rateYear} Medicare Rate Lookup
              </CardTitle>
              <CardDescription className="max-w-3xl">
                Look up fair prices based on the {rateYear} CMS Medicare Physician Fee Schedule. These rates represent
                what Medicare pays providers — use them as a benchmark when negotiating cash-pay rates.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
                      <Search className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium text-sm">1. Look Up CPT Code</p>
                    <p className="text-xs text-muted-foreground mt-1">Find the code for your needed service</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium text-sm">2. See Medicare Rate</p>
                    <p className="text-xs text-muted-foreground mt-1">View the {rateYear} fair price</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-medium text-sm">3. Find Provider</p>
                    <p className="text-xs text-muted-foreground mt-1">Visit a participating provider</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 mx-auto mb-2">
                      <Heart className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">4. Pay Fair Price</p>
                    <p className="text-xs text-muted-foreground mt-1">Out-of-pocket at Medicare rate</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                  <div>
                    <p className="font-medium">Example: Office Visit (99213)</p>
                    <p className="text-sm text-muted-foreground">Low complexity office visit</p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Typical Uninsured</p>
                      <p className="text-lg font-bold line-through text-muted-foreground">$260+</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-600 font-medium">{rateYear} Medicare Rate</p>
                      <p className="text-lg font-bold text-green-600" data-testid="text-example-rate">$95</p>
                    </div>
                    <Badge variant="secondary">63% savings</Badge>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">CPT Code & Medicare Rate Lookup ({rateYear})</h3>
                <div className="flex gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by CPT code or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-cpt-search"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[200px]" data-testid="select-category">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ratesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground mb-2">{rates.length} CPT codes found</p>
                    {rates.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          No results found. Try a different search term or category.
                        </CardContent>
                      </Card>
                    ) : (
                      rates.map((rate) => (
                        <Card key={rate.cptCode} data-testid={`card-rate-${rate.cptCode}`}>
                          <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge variant="outline" className="font-mono flex-shrink-0" data-testid={`badge-cpt-${rate.cptCode}`}>
                                {rate.cptCode}
                              </Badge>
                              <div className="min-w-0">
                                <p className="font-medium truncate" data-testid={`text-rate-description-${rate.cptCode}`}>
                                  {rate.description}
                                </p>
                                <p className="text-xs text-muted-foreground">{rate.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap flex-shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">Typical Price</p>
                                <p className="text-sm line-through text-muted-foreground">{formatCurrency(rate.typicalUninsuredRate)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-green-600 font-medium">{rateYear} Medicare</p>
                                <p className="text-lg font-bold text-green-600" data-testid={`text-medicare-rate-${rate.cptCode}`}>
                                  {formatCurrency(rate.medicareRate)}
                                </p>
                              </div>
                              <Badge variant="secondary">{rate.savings} off</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discount-platform" className="space-y-6">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CreditCard className="h-5 w-5 text-primary" />
                Tabula Medica Discount Platform
              </CardTitle>
              <CardDescription className="max-w-3xl">
                A new way for uninsured patients to access healthcare at fair prices. Sign up for free and pay
                {rateYear} Medicare rates at participating providers — no premiums, no deductibles, no hidden fees.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-6 text-center">
                    <DollarSign className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-xl font-bold text-green-600">$0 Membership</div>
                    <p className="text-sm text-muted-foreground mt-1">No monthly fees or premiums</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-6 text-center">
                    <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-xl font-bold text-green-600">60-92% Off</div>
                    <p className="text-sm text-muted-foreground mt-1">vs typical uninsured prices</p>
                  </CardContent>
                </Card>
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-6 text-center">
                    <Building2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-xl font-bold text-green-600">{providers.length}+ Providers</div>
                    <p className="text-sm text-muted-foreground mt-1">and growing nationwide</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">1</span>
                  <div>
                    <p className="font-medium text-sm">Sign Up Free</p>
                    <p className="text-xs text-muted-foreground">Create your membership in seconds</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">2</span>
                  <div>
                    <p className="font-medium text-sm">Find a Provider</p>
                    <p className="text-xs text-muted-foreground">Browse our participating directory</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold flex-shrink-0">3</span>
                  <div>
                    <p className="font-medium text-sm">Show Your Card</p>
                    <p className="text-xs text-muted-foreground">Present digital membership at check-in</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold flex-shrink-0">4</span>
                  <div>
                    <p className="font-medium text-sm">Pay Medicare Rate</p>
                    <p className="text-xs text-muted-foreground">Transparent, fair pricing</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card data-testid="card-patient-signup">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-primary" />
                      Patient Signup
                    </CardTitle>
                    <CardDescription>
                      Join for free and access discounted healthcare at Medicare rates.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {patientSignup.data?.success ? (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <p className="font-semibold">Welcome to Tabula Medica!</p>
                        </div>
                        <p className="text-sm">Your Member ID: <strong>{patientSignup.data.memberId}</strong></p>
                        <p className="text-sm text-muted-foreground">{patientSignup.data.message}</p>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Your Benefits:</p>
                          {patientSignup.data.benefits.map((b: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{b}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="signup-first">First Name *</Label>
                            <Input id="signup-first" value={signupForm.firstName} onChange={(e) => setSignupForm(f => ({ ...f, firstName: e.target.value }))} data-testid="input-signup-first" />
                          </div>
                          <div>
                            <Label htmlFor="signup-last">Last Name *</Label>
                            <Input id="signup-last" value={signupForm.lastName} onChange={(e) => setSignupForm(f => ({ ...f, lastName: e.target.value }))} data-testid="input-signup-last" />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="signup-email">Email *</Label>
                          <Input id="signup-email" type="email" value={signupForm.email} onChange={(e) => setSignupForm(f => ({ ...f, email: e.target.value }))} data-testid="input-signup-email" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="signup-phone">Phone</Label>
                            <Input id="signup-phone" value={signupForm.phone} onChange={(e) => setSignupForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-signup-phone" />
                          </div>
                          <div>
                            <Label htmlFor="signup-zip">ZIP Code</Label>
                            <Input id="signup-zip" value={signupForm.zipCode} onChange={(e) => setSignupForm(f => ({ ...f, zipCode: e.target.value }))} data-testid="input-signup-zip" />
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => patientSignup.mutate()}
                          disabled={!signupForm.firstName || !signupForm.lastName || !signupForm.email || patientSignup.isPending}
                          data-testid="button-patient-signup"
                        >
                          {patientSignup.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                          Join for Free
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-provider-enrollment">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      Provider Enrollment
                    </CardTitle>
                    <CardDescription>
                      Join our network and offer Medicare-rate pricing to uninsured patients.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {providerEnroll.data?.success ? (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                          <p className="font-semibold">Application Submitted!</p>
                        </div>
                        <p className="text-sm">Enrollment ID: <strong>{providerEnroll.data.enrollmentId}</strong></p>
                        <p className="text-sm text-muted-foreground">{providerEnroll.data.message}</p>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Next Steps:</p>
                          {providerEnroll.data.nextSteps.map((s: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary flex-shrink-0">{i + 1}</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="enroll-name">Practice/Provider Name *</Label>
                            <Input id="enroll-name" value={enrollForm.providerName} onChange={(e) => setEnrollForm(f => ({ ...f, providerName: e.target.value }))} data-testid="input-enroll-name" />
                          </div>
                          <div>
                            <Label htmlFor="enroll-npi">NPI Number *</Label>
                            <Input id="enroll-npi" value={enrollForm.npi} onChange={(e) => setEnrollForm(f => ({ ...f, npi: e.target.value }))} data-testid="input-enroll-npi" />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor="enroll-specialty">Specialty</Label>
                            <Input id="enroll-specialty" value={enrollForm.specialty} onChange={(e) => setEnrollForm(f => ({ ...f, specialty: e.target.value }))} data-testid="input-enroll-specialty" />
                          </div>
                          <div>
                            <Label htmlFor="enroll-email">Email *</Label>
                            <Input id="enroll-email" type="email" value={enrollForm.email} onChange={(e) => setEnrollForm(f => ({ ...f, email: e.target.value }))} data-testid="input-enroll-email" />
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => providerEnroll.mutate()}
                          disabled={!enrollForm.providerName || !enrollForm.npi || !enrollForm.email || providerEnroll.isPending}
                          data-testid="button-provider-enroll"
                        >
                          {providerEnroll.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}
                          Apply to Join Network
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" />
                Participating Provider Directory
              </CardTitle>
              <CardDescription>
                Find providers near you who accept Tabula Medica Discount Platform membership for Medicare-rate pricing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Select value={providerState} onValueChange={setProviderState}>
                  <SelectTrigger className="w-[150px]" data-testid="select-provider-state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={providerType} onValueChange={setProviderType}>
                  <SelectTrigger className="w-[180px]" data-testid="select-provider-type">
                    <SelectValue placeholder="Provider Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {providerTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {providersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredProviders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No providers match your criteria. Try adjusting your filters or check back as our network grows.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredProviders.map((provider) => (
                    <Card key={provider.id} data-testid={`card-provider-${provider.id}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h4 className="font-semibold" data-testid={`text-provider-name-${provider.id}`}>{provider.name}</h4>
                            <p className="text-sm text-muted-foreground">{provider.type}</p>
                          </div>
                          <div className="flex gap-2">
                            {provider.acceptingNewPatients ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Accepting Patients</Badge>
                            ) : (
                              <Badge variant="secondary">Waitlist</Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span>{provider.location}</span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {provider.specialties.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                          ))}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Discount off typical rates:</span>
                          <span className="font-bold text-green-600">Up to {provider.discountPercent}% off</span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" asChild data-testid={`link-provider-phone-${provider.id}`}>
                            <a href={`tel:${provider.phone}`}>
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild data-testid={`link-provider-web-${provider.id}`}>
                            <a href={provider.website} target="_blank" rel="noopener noreferrer">
                              <Globe className="h-3 w-3 mr-1" />
                              Website
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <MapPin className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold" data-testid="text-health-centers-count">1,400+</div>
                <p className="text-sm text-muted-foreground">Community Health Centers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Pill className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">340B Program</div>
                <p className="text-sm text-muted-foreground">Discounted Drug Pricing</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold">Hill-Burton</div>
                <p className="text-sm text-muted-foreground">Free/Reduced Hospital Care</p>
              </CardContent>
            </Card>
          </div>

          {resourcesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            resourceCategories.map((category) => (
              <div key={category} className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2" data-testid={`text-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  {category}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {resources
                    .filter((r) => r.category === category)
                    .map((resource) => (
                      <Card key={resource.id} data-testid={`card-resource-${resource.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                            <span data-testid={`text-resource-name-${resource.id}`}>{resource.name}</span>
                            <Button variant="ghost" size="icon" asChild data-testid={`link-resource-${resource.id}`}>
                              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground" data-testid={`text-resource-desc-${resource.id}`}>
                            {resource.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                </div>
                <Separator className="my-4" />
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
