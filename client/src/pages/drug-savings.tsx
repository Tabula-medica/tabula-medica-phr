import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  Search,
  ExternalLink,
  Pill,
  Building2,
  ArrowRight,
  Info,
  Loader2,
  Tag,
  Heart,
  FileText,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  TrendingDown,
  Calculator,
  BarChart3,
  ShoppingCart,
  MapPin,
  Ticket,
  Store,
} from "lucide-react";

interface ManufacturerProgram {
  id: string;
  manufacturer: string;
  programName: string;
  description: string;
  url: string;
  eligibility: string;
  coveredMedications: string[];
  savingsEstimate: string;
}

interface ExternalResource {
  id: string;
  name: string;
  description: string;
  url: string;
  type: string;
}

interface GenericAlternative {
  brandName: string;
  genericName: string;
  estimatedSavings: string;
  notes: string;
}

interface PAPInfo {
  title: string;
  description: string;
  howToApply: string[];
  eligibilityTips: string[];
}

interface SavingsSummary {
  totalPrograms: number;
  totalGenerics: number;
  totalResources: number;
  totalMedsCovered: number;
  topSavings: { category: string; averageSavings: string; description: string }[];
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
        data-testid="input-drug-search"
      />
    </div>
  );
}

function ManufacturerProgramCard({ program }: { program: ManufacturerProgram }) {
  return (
    <Card data-testid={`card-program-${program.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground" data-testid={`text-manufacturer-${program.id}`}>{program.manufacturer}</span>
            </div>
            <h4 className="font-semibold mt-1" data-testid={`text-program-name-${program.id}`}>{program.programName}</h4>
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 no-default-hover-elevate no-default-active-elevate">
            {program.savingsEstimate}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">{program.description}</p>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Eligibility</p>
          <p className="text-sm">{program.eligibility}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Covered Medications</p>
          <div className="flex flex-wrap gap-1">
            {program.coveredMedications.map((med) => (
              <Badge key={med} variant="outline" className="text-xs">
                <Pill className="h-3 w-3 mr-1" />
                {med}
              </Badge>
            ))}
          </div>
        </div>

        <Button variant="outline" size="sm" asChild className="w-full" data-testid={`link-program-${program.id}`}>
          <a href={program.url} target="_blank" rel="noopener noreferrer">
            Visit Program <ExternalLink className="h-3 w-3 ml-2" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function AIComparePanel() {
  const [medication, setMedication] = useState("");
  const [cost, setCost] = useState("");

  const compareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/drug-savings/ai-compare", {
        medication,
        currentCost: cost ? parseFloat(cost) : undefined,
      });
      return res.json();
    },
  });

  return (
    <Card className="border-primary/20" data-testid="card-ai-compare">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Savings Advisor
        </CardTitle>
        <CardDescription>
          Enter your medication to get personalized savings recommendations powered by AI.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="drug-savings-medication-name" className="text-sm font-medium mb-1 block">Medication Name</label>
            <Input id="drug-savings-medication-name"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              placeholder="e.g., Lipitor, Ozempic, Humira"
              data-testid="input-compare-medication"
            />
          </div>
          <div>
            <label htmlFor="drug-savings-current-monthly-cost-optional" className="text-sm font-medium mb-1 block">Current Monthly Cost (optional)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="drug-savings-current-monthly-cost-optional"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="e.g., 150"
                className="pl-9"
                type="number"
                data-testid="input-compare-cost"
              />
            </div>
          </div>
        </div>
        <Button
          onClick={() => compareMutation.mutate()}
          disabled={!medication || compareMutation.isPending}
          className="w-full"
          data-testid="button-compare"
        >
          {compareMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing savings options...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Find Savings Options
            </>
          )}
        </Button>

        {compareMutation.data && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {compareMutation.data.genericAlternative && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    <p className="font-medium text-green-800 dark:text-green-200">Generic Alternative Available</p>
                  </div>
                  <p className="text-sm">
                    <strong>{compareMutation.data.genericAlternative.brandName}</strong> {"->"} <strong>{compareMutation.data.genericAlternative.genericName}</strong>
                    {" "}— {compareMutation.data.genericAlternative.estimatedSavings}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{compareMutation.data.genericAlternative.notes}</p>
                </CardContent>
              </Card>
            )}

            {compareMutation.data.assistancePrograms?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Matching Assistance Programs:</p>
                <div className="flex flex-wrap gap-2">
                  {compareMutation.data.assistancePrograms.map((p: ManufacturerProgram) => (
                    <Badge key={p.id} variant="secondary">{p.programName} — {p.savingsEstimate}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm whitespace-pre-wrap">{compareMutation.data.advice}</p>
            </div>

            <p className="text-xs text-muted-foreground italic">{compareMutation.data.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface GoodRxPrice {
  pharmacyName: string;
  pharmacyType: "retail" | "mail_order" | "online";
  price: number;
  priceWithCoupon: number | null;
  couponCode: string | null;
  distance: string | null;
  savings: string;
  url: string;
}

interface PopularDrug {
  name: string;
  category: string;
  lowestPrice: number;
  avgRetail: number;
  savings: string;
}

function GoodRxPricePanel() {
  const [drugName, setDrugName] = useState("");
  const [quantity, setQuantity] = useState("30");

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/goodrx/search?drug=${encodeURIComponent(drugName)}&quantity=${quantity}`);
      return res.json();
    },
  });

  const { data: popularData } = useQuery<{ popular: PopularDrug[] }>({
    queryKey: ["/api/goodrx/popular"],
  });

  const pharmacyIcon = (type: string) => {
    if (type === "mail_order") return <ShoppingCart className="h-4 w-4" />;
    if (type === "online") return <Store className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20" data-testid="card-goodrx-search">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            Prescription Price Comparison
          </CardTitle>
          <CardDescription>
            Compare cash prices and coupons across pharmacies. Often cheaper than insurance copays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="drug-savings-drug-name" className="text-sm font-medium mb-1 block">Drug Name</label>
              <Input id="drug-savings-drug-name"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                placeholder="e.g., Metformin, Lisinopril, Ozempic"
                data-testid="input-goodrx-drug"
                onKeyDown={(e) => e.key === "Enter" && drugName && searchMutation.mutate()}
              />
            </div>
            <div>
              <label htmlFor="drug-savings-quantity" className="text-sm font-medium mb-1 block">Quantity</label>
              <Input id="drug-savings-quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="30"
                type="number"
                data-testid="input-goodrx-quantity"
              />
            </div>
          </div>
          <Button
            onClick={() => searchMutation.mutate()}
            disabled={!drugName || searchMutation.isPending}
            className="w-full"
            data-testid="button-goodrx-search"
          >
            {searchMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Searching prices...</>
            ) : (
              <><Search className="h-4 w-4 mr-2" />Compare Prices</>
            )}
          </Button>
        </CardContent>
      </Card>

      {searchMutation.data?.suggestions && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-2">Did you mean:</p>
            <div className="flex flex-wrap gap-2">
              {searchMutation.data.suggestions.map((s: any) => (
                <Button
                  key={s.name}
                  variant="outline"
                  size="sm"
                  onClick={() => { setDrugName(s.name); }}
                  data-testid={`button-suggestion-${s.name.toLowerCase()}`}
                >
                  {s.name} <Badge variant="secondary" className="ml-2 text-xs">{s.category}</Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {searchMutation.data?.prices?.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Lowest Price</p>
                <p className="text-3xl font-bold text-green-600" data-testid="text-lowest-price">
                  ${searchMutation.data.lowestPrice?.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">with coupon</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">Avg Retail Price</p>
                <p className="text-2xl font-bold line-through text-muted-foreground" data-testid="text-avg-retail">
                  ${searchMutation.data.averageRetailPrice?.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">without coupon</p>
              </CardContent>
            </Card>
            <Card className="border-primary/20">
              <CardContent className="pt-4 text-center">
                <p className="text-sm text-muted-foreground">You Save</p>
                <p className="text-2xl font-bold text-primary" data-testid="text-savings-pct">
                  {searchMutation.data.bestSavings}
                </p>
                <p className="text-xs text-muted-foreground">
                  {searchMutation.data.drugName} {searchMutation.data.dosage} x{searchMutation.data.quantity}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Pharmacy Prices for {searchMutation.data.drugName}
                {searchMutation.data.genericName && (
                  <Badge variant="outline" className="ml-2 text-xs">Brand: {searchMutation.data.genericName}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {searchMutation.data.prices.map((p: GoodRxPrice, i: number) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-4 p-3 rounded-lg ${i === 0 ? "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800" : "bg-muted/50"}`}
                    data-testid={`row-pharmacy-${i}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-muted-foreground">
                        {pharmacyIcon(p.pharmacyType)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{p.pharmacyName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {p.distance && <span>{p.distance}</span>}
                          {p.couponCode && (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              <Ticket className="h-3 w-3 mr-1" />{p.couponCode}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        {p.priceWithCoupon !== null ? (
                          <>
                            <p className="text-xs line-through text-muted-foreground">${p.price.toFixed(2)}</p>
                            <p className="font-bold text-green-600">${p.priceWithCoupon.toFixed(2)}</p>
                          </>
                        ) : (
                          <p className="font-bold text-green-600">${p.price.toFixed(2)}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                        {p.savings} off
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground italic">
            {searchMutation.data.disclaimer}
          </p>
        </div>
      )}

      {!searchMutation.data && popularData?.popular && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Popular Medications</CardTitle>
            <CardDescription>Click a medication to see prices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {popularData.popular.map((drug) => (
                <button
                  key={drug.name}
                  onClick={() => { setDrugName(drug.name); setTimeout(() => searchMutation.mutate(), 100); }}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                  data-testid={`button-popular-${drug.name.toLowerCase()}`}
                >
                  <div>
                    <p className="font-medium text-sm">{drug.name}</p>
                    <p className="text-xs text-muted-foreground">{drug.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-600">From ${drug.lowestPrice.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{drug.savings}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DrugSavings() {
  useSEO({
    title: "Drug Savings & Coupons | Tabula Medica",
    description: "Find manufacturer programs, generic alternatives, and patient assistance to reduce your medication costs.",
  });

  const [programSearch, setProgramSearch] = useState("");
  const [genericSearch, setGenericSearch] = useState("");

  const { data: summaryData } = useQuery<SavingsSummary>({
    queryKey: ["/api/drug-savings/savings-summary"],
  });

  const { data: programsData, isLoading: programsLoading } = useQuery<{ programs: ManufacturerProgram[] }>({
    queryKey: ["/api/drug-savings/manufacturer-programs", programSearch],
  });

  const { data: resourcesData } = useQuery<{ resources: ExternalResource[] }>({
    queryKey: ["/api/drug-savings/external-resources"],
  });

  const { data: genericsData, isLoading: genericsLoading } = useQuery<{ alternatives: GenericAlternative[] }>({
    queryKey: ["/api/drug-savings/generic-alternatives", genericSearch],
  });

  const { data: papData } = useQuery<PAPInfo>({
    queryKey: ["/api/drug-savings/pap-info"],
  });

  const programs = programsData?.programs || [];
  const resources = resourcesData?.resources || [];
  const generics = genericsData?.alternatives || [];
  const pap = papData;
  const summary = summaryData;

  const filteredPrograms = programSearch
    ? programs.filter(p =>
        p.manufacturer.toLowerCase().includes(programSearch.toLowerCase()) ||
        p.programName.toLowerCase().includes(programSearch.toLowerCase()) ||
        p.coveredMedications.some(m => m.toLowerCase().includes(programSearch.toLowerCase()))
      )
    : programs;

  const filteredGenerics = genericSearch
    ? generics.filter(g =>
        g.brandName.toLowerCase().includes(genericSearch.toLowerCase()) ||
        g.genericName.toLowerCase().includes(genericSearch.toLowerCase())
      )
    : generics;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Drug Savings & Coupons</h1>
        <p className="text-muted-foreground max-w-3xl">
          Find manufacturer programs, generic alternatives, patient assistance, and AI-powered savings recommendations.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription data-testid="text-disclaimer">
          Tabula Medica does not sell medications or provide medical advice. This page connects you to third-party
          savings programs and provides informational resources. Always consult your doctor before switching medications.
        </AlertDescription>
      </Alert>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Building2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold" data-testid="text-total-programs">{summary.totalPrograms}</div>
              <p className="text-sm text-muted-foreground">Manufacturer Programs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Pill className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold" data-testid="text-total-meds">{summary.totalMedsCovered}</div>
              <p className="text-sm text-muted-foreground">Medications Covered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Tag className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600" data-testid="text-generic-count">{summary.totalGenerics}</div>
              <p className="text-sm text-muted-foreground">Generic Alternatives</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <BarChart3 className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold">80-90%</div>
              <p className="text-sm text-muted-foreground">Avg Generic Savings</p>
            </CardContent>
          </Card>
        </div>
      )}

      <AIComparePanel />

      <Tabs defaultValue="prices" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5" data-testid="tabs-drug-savings">
          <TabsTrigger value="prices" data-testid="tab-prices">
            <Ticket className="h-4 w-4 mr-2" />
            Price Lookup
          </TabsTrigger>
          <TabsTrigger value="programs" data-testid="tab-programs">
            <Building2 className="h-4 w-4 mr-2" />
            Programs
          </TabsTrigger>
          <TabsTrigger value="generics" data-testid="tab-generics">
            <Tag className="h-4 w-4 mr-2" />
            Generics
          </TabsTrigger>
          <TabsTrigger value="pap" data-testid="tab-pap">
            <Heart className="h-4 w-4 mr-2" />
            PAP Guide
          </TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">
            <FileText className="h-4 w-4 mr-2" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prices" className="space-y-4">
          <GoodRxPricePanel />
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <SearchBar value={programSearch} onChange={setProgramSearch} placeholder="Search by manufacturer, program name, or medication..." />
          {programsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredPrograms.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No programs match your search. Try a different medication or manufacturer name.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPrograms.map((program) => (
                <ManufacturerProgramCard key={program.id} program={program} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="generics" className="space-y-4">
          <SearchBar value={genericSearch} onChange={setGenericSearch} placeholder="Search by brand or generic name..." />
          {genericsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredGenerics.map((alt) => (
                <Card key={alt.brandName} data-testid={`card-generic-${alt.brandName.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium line-through text-muted-foreground">{alt.brandName}</span>
                          <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="font-semibold text-green-700 dark:text-green-400">{alt.genericName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{alt.notes}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex-shrink-0">
                      {alt.estimatedSavings}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pap" className="space-y-6">
          {pap && (
            <Card data-testid="card-pap-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Heart className="h-5 w-5 text-primary" />
                  {pap.title}
                </CardTitle>
                <CardDescription>{pap.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    How to Apply
                  </h3>
                  <ol className="space-y-2">
                    {pap.howToApply.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary flex-shrink-0 mt-0.5">{i + 1}</span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Eligibility Tips
                  </h3>
                  <ul className="space-y-2">
                    {pap.eligibilityTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          {summary?.topSavings && (
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Top Savings Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.topSavings.map((s) => (
                    <div key={s.category} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <TrendingDown className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{s.category}</p>
                        <p className="text-lg font-bold text-green-600">{s.averageSavings}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {resources.map((resource) => (
              <Card key={resource.id} data-testid={`card-resource-${resource.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold" data-testid={`text-resource-name-${resource.id}`}>{resource.name}</h4>
                    <Badge variant="outline" className="text-xs flex-shrink-0">{resource.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{resource.description}</p>
                  <Button variant="outline" size="sm" asChild className="w-full" data-testid={`link-resource-${resource.id}`}>
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      Visit {resource.name} <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
