import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  BarChart3,
  Activity,
  Users,
  Shield,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  Target,
  Building2,
  Heart,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

interface DashboardData {
  summary: {
    totalTestsAvoided: number;
    totalSavingsUSD: number;
    avgDetectionRate: number;
    currentQuarterACOSavings: number;
    qualityScore: number;
    totalBeneficiaries: number;
    platformROI: number;
    annualProjectedSavings: number;
  };
  monthlyMetrics: {
    month: string;
    testsOrdered: number;
    duplicatesDetected: number;
    duplicatesAvoided: number;
    savingsUSD: number;
  }[];
  categorySavings: {
    category: string;
    testsAvoided: number;
    totalSavings: number;
    avgCostPerTest: number;
    topTests: { name: string; count: number; savings: number }[];
  }[];
  acoSavings: {
    quarter: string;
    sharedSavings: number;
    qualityScore: number;
    totalBeneficiaries: number;
    perCapitaCost: number;
    benchmark: number;
    savingsRate: number;
  }[];
  demographics: {
    ageGroup: string;
    memberCount: number;
    duplicateTestsAvoided: number;
    savingsUSD: number;
    topConditions: string[];
  }[];
  insuranceSavings: {
    payerName: string;
    claimsProcessed: number;
    duplicatesAvoided: number;
    savingsToPatient: number;
    savingsToPayer: number;
    avgClaimReduction: number;
  }[];
  reportGeneratedAt: string;
  disclaimer: string;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m) - 1]} ${year.slice(2)}`;
}

function TrendIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value > 0) return <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5 text-sm font-medium"><ArrowUpRight className="h-3 w-3" />{value.toFixed(1)}{suffix}</span>;
  if (value < 0) return <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5 text-sm font-medium"><ArrowDownRight className="h-3 w-3" />{Math.abs(value).toFixed(1)}{suffix}</span>;
  return <span className="text-muted-foreground flex items-center gap-0.5 text-sm"><Minus className="h-3 w-3" />0{suffix}</span>;
}

function BarVisual({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function EnterpriseSavings() {
  useSEO({ title: "Enterprise Platform Savings | Tabula Medica", description: "Enterprise-level savings metrics, duplicate testing avoidance, and ACO performance reports." });
  const [activeTab, setActiveTab] = useState("overview");

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/enterprise-savings/dashboard"],
  });

  const handleExport = async (format: string) => {
    window.open(`/api/enterprise-savings/export?format=${format}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-enterprise">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert variant="destructive" data-testid="error-enterprise">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load enterprise savings data.</AlertDescription>
      </Alert>
    );
  }

  const maxMonthlySavings = Math.max(...data.monthlyMetrics.map(m => m.savingsUSD));
  const maxMonthlyAvoided = Math.max(...data.monthlyMetrics.map(m => m.duplicatesAvoided));
  const maxCatSavings = Math.max(...data.categorySavings.map(c => c.totalSavings));
  const maxInsuranceSavings = Math.max(...data.insuranceSavings.map(i => i.savingsToPayer));
  const maxDemoSavings = Math.max(...data.demographics.map(d => d.savingsUSD));

  return (
    <div className="min-h-screen bg-background" data-testid="page-enterprise-savings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="heading-enterprise">
              <Building2 className="h-6 w-6 text-primary" />
              Enterprise Platform Savings
            </h1>
            <p className="text-muted-foreground mt-1">Administrative metrics dashboard — not patient-facing</p>
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={handleExport}>
              <SelectTrigger className="w-[160px]" data-testid="select-export">
                <Download className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Export Report" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">Export as CSV</SelectItem>
                <SelectItem value="json">Export as JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
            {data.disclaimer}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card data-testid="metric-tests-avoided">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Duplicate Tests Avoided
              </div>
              <p className="text-2xl font-bold">{formatNumber(data.summary.totalTestsAvoided)}</p>
              <TrendIndicator value={14.2} />
            </CardContent>
          </Card>
          <Card data-testid="metric-total-savings">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Total Cost Savings
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(data.summary.totalSavingsUSD)}</p>
              <TrendIndicator value={18.7} />
            </CardContent>
          </Card>
          <Card data-testid="metric-quality-score">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <Target className="h-3.5 w-3.5" />
                ACO Quality Score
              </div>
              <p className="text-2xl font-bold">{data.summary.qualityScore}%</p>
              <TrendIndicator value={2.3} suffix=" pts" />
            </CardContent>
          </Card>
          <Card data-testid="metric-roi">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Platform ROI
              </div>
              <p className="text-2xl font-bold">{data.summary.platformROI}x</p>
              <p className="text-xs text-muted-foreground">Projected annual: {formatCurrency(data.summary.annualProjectedSavings)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap gap-1" data-testid="tabs-enterprise">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-1.5" />Overview
            </TabsTrigger>
            <TabsTrigger value="duplicate-testing" data-testid="tab-duplicate-testing">
              <Activity className="h-4 w-4 mr-1.5" />Duplicate Testing
            </TabsTrigger>
            <TabsTrigger value="aco-insurance" data-testid="tab-aco-insurance">
              <DollarSign className="h-4 w-4 mr-1.5" />ACO & Insurance
            </TabsTrigger>
            <TabsTrigger value="demographics" data-testid="tab-demographics">
              <Users className="h-4 w-4 mr-1.5" />Demographics
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              <FileText className="h-4 w-4 mr-1.5" />Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Savings Over Time</CardTitle>
                <CardDescription>Monthly cost savings from duplicate test avoidance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.monthlyMetrics.map((m) => (
                    <div key={m.month} className="flex items-center gap-3" data-testid={`month-row-${m.month}`}>
                      <span className="text-sm font-medium w-16 shrink-0">{formatMonth(m.month)}</span>
                      <div className="flex-1">
                        <BarVisual value={m.savingsUSD} max={maxMonthlySavings} color="bg-green-500" />
                      </div>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400 w-20 text-right">{formatCurrency(m.savingsUSD)}</span>
                      <span className="text-xs text-muted-foreground w-24 text-right">{m.duplicatesAvoided} avoided</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detection Rate Trend</CardTitle>
                  <CardDescription>Percentage of ordered tests flagged as potential duplicates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.monthlyMetrics.map((m) => {
                      const rate = ((m.duplicatesDetected / m.testsOrdered) * 100);
                      return (
                        <div key={m.month} className="flex items-center gap-3" data-testid={`detection-${m.month}`}>
                          <span className="text-xs w-14 shrink-0">{formatMonth(m.month)}</span>
                          <Progress value={rate} className="flex-1 h-2" />
                          <span className="text-xs font-medium w-12 text-right">{rate.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tests Avoided Over Time</CardTitle>
                  <CardDescription>Number of duplicate tests successfully avoided per month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.monthlyMetrics.map((m) => (
                      <div key={m.month} className="flex items-center gap-3" data-testid={`avoided-${m.month}`}>
                        <span className="text-xs w-14 shrink-0">{formatMonth(m.month)}</span>
                        <div className="flex-1">
                          <BarVisual value={m.duplicatesAvoided} max={maxMonthlyAvoided} color="bg-blue-500" />
                        </div>
                        <span className="text-xs font-medium w-10 text-right">{m.duplicatesAvoided}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="duplicate-testing" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {data.categorySavings.map((cat) => (
                <Card key={cat.category} data-testid={`category-${cat.category.toLowerCase()}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{cat.category}</CardTitle>
                      <Badge variant="secondary" className="text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40">
                        {formatCurrency(cat.totalSavings)} saved
                      </Badge>
                    </div>
                    <CardDescription>{formatNumber(cat.testsAvoided)} tests avoided &middot; Avg {formatCurrency(cat.avgCostPerTest)}/test</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      {cat.topTests.map((test) => (
                        <div key={test.name} className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{test.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <BarVisual value={test.count} max={cat.topTests[0].count} color="bg-primary/60" />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">{test.count}</p>
                            <p className="text-xs text-green-600 dark:text-green-400">{formatCurrency(test.savings)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cumulative Impact Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{formatNumber(data.categorySavings.reduce((s, c) => s + c.testsAvoided, 0))}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Tests Avoided</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(data.categorySavings.reduce((s, c) => s + c.totalSavings, 0))}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Savings</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{data.categorySavings.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">Categories Tracked</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{data.categorySavings.reduce((s, c) => s + c.topTests.length, 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Test Types Monitored</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aco-insurance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ACO Shared Savings Performance</CardTitle>
                <CardDescription>Quarterly ACO performance metrics and shared savings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.acoSavings.map((aco, i) => {
                    const prev = i > 0 ? data.acoSavings[i - 1] : null;
                    const savingsChange = prev ? ((aco.sharedSavings - prev.sharedSavings) / prev.sharedSavings) * 100 : 0;
                    return (
                      <div key={aco.quarter} className="border rounded-lg p-4" data-testid={`aco-${aco.quarter}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{aco.quarter}</Badge>
                            {prev && <TrendIndicator value={savingsChange} />}
                          </div>
                          <span className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(aco.sharedSavings)}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground text-xs">Quality Score</p>
                            <p className="font-semibold">{aco.qualityScore}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Beneficiaries</p>
                            <p className="font-semibold">{formatNumber(aco.totalBeneficiaries)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Per Capita Cost</p>
                            <p className="font-semibold">{formatCurrency(aco.perCapitaCost)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">Savings Rate</p>
                            <p className="font-semibold">{aco.savingsRate}%</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Per Capita Cost vs Benchmark</span>
                            <span>{formatCurrency(aco.perCapitaCost)} / {formatCurrency(aco.benchmark)}</span>
                          </div>
                          <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                            <div className="absolute h-full bg-green-500 rounded-full" style={{ width: `${(aco.perCapitaCost / aco.benchmark) * 100}%` }} />
                            <div className="absolute h-full w-0.5 bg-red-500" style={{ left: "100%" }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Insurance Payer Savings Breakdown</CardTitle>
                <CardDescription>Savings by insurance carrier from duplicate test avoidance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.insuranceSavings.map((ins) => (
                    <div key={ins.payerName} className="border rounded-lg p-3" data-testid={`insurance-${ins.payerName.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{ins.payerName}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(ins.claimsProcessed)} claims processed</p>
                        </div>
                        <Badge variant="secondary">{ins.duplicatesAvoided} avoided</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="p-2 rounded bg-green-50 dark:bg-green-950/30 text-center">
                          <p className="text-green-700 dark:text-green-300 font-semibold">{formatCurrency(ins.savingsToPatient)}</p>
                          <p className="text-xs text-muted-foreground">Patient Savings</p>
                        </div>
                        <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-center">
                          <p className="text-blue-700 dark:text-blue-300 font-semibold">{formatCurrency(ins.savingsToPayer)}</p>
                          <p className="text-xs text-muted-foreground">Payer Savings</p>
                        </div>
                        <div className="p-2 rounded bg-purple-50 dark:bg-purple-950/30 text-center">
                          <p className="text-purple-700 dark:text-purple-300 font-semibold">{ins.avgClaimReduction}%</p>
                          <p className="text-xs text-muted-foreground">Avg Reduction</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <BarVisual value={ins.savingsToPayer} max={maxInsuranceSavings} color="bg-blue-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demographics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Savings by Age Group</CardTitle>
                <CardDescription>Duplicate test avoidance impact across patient demographics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.demographics.map((demo) => (
                    <div key={demo.ageGroup} className="border rounded-lg p-4" data-testid={`demo-${demo.ageGroup}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-lg">Age {demo.ageGroup}</p>
                          <p className="text-sm text-muted-foreground">{formatNumber(demo.memberCount)} members</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(demo.savingsUSD)}</p>
                          <p className="text-xs text-muted-foreground">{demo.duplicateTestsAvoided} tests avoided</p>
                        </div>
                      </div>
                      <BarVisual value={demo.savingsUSD} max={maxDemoSavings} color="bg-primary" />
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {demo.topConditions.map((cond) => (
                          <Badge key={cond} variant="outline" className="text-xs">{cond}</Badge>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Avg savings per member: {formatCurrency(demo.savingsUSD / demo.memberCount)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Demographic Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-demographics">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Age Group</th>
                        <th className="text-right py-2 px-3 font-medium">Members</th>
                        <th className="text-right py-2 px-3 font-medium">Tests Avoided</th>
                        <th className="text-right py-2 px-3 font-medium">Savings</th>
                        <th className="text-right py-2 px-3 font-medium">Per Member</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.demographics.map((demo) => (
                        <tr key={demo.ageGroup} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-3 font-medium">{demo.ageGroup}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(demo.memberCount)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(demo.duplicateTestsAvoided)}</td>
                          <td className="py-2 px-3 text-right text-green-600 font-medium">{formatCurrency(demo.savingsUSD)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(demo.savingsUSD / demo.memberCount)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold bg-muted/50">
                        <td className="py-2 px-3">Total</td>
                        <td className="py-2 px-3 text-right">{formatNumber(data.demographics.reduce((s, d) => s + d.memberCount, 0))}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(data.demographics.reduce((s, d) => s + d.duplicateTestsAvoided, 0))}</td>
                        <td className="py-2 px-3 text-right text-green-600">{formatCurrency(data.demographics.reduce((s, d) => s + d.savingsUSD, 0))}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(data.demographics.reduce((s, d) => s + d.savingsUSD, 0) / data.demographics.reduce((s, d) => s + d.memberCount, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleExport("csv")} data-testid="report-monthly-csv">
                <CardContent className="pt-5 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/40">
                    <TrendingDown className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Monthly Savings Report</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Duplicate test avoidance metrics, savings by month, detection rates</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">CSV</Badge>
                      <Badge variant="outline" className="text-xs">JSON</Badge>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleExport("json")} data-testid="report-aco-json">
                <CardContent className="pt-5 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">ACO Performance Report</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Shared savings, quality scores, beneficiary trends, per capita costs</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">JSON</Badge>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleExport("csv")} data-testid="report-insurance-csv">
                <CardContent className="pt-5 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                    <Heart className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Insurance Payer Analysis</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Per-payer savings, claim reduction rates, patient vs payer impact</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">CSV</Badge>
                      <Badge variant="outline" className="text-xs">JSON</Badge>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleExport("json")} data-testid="report-demographic-json">
                <CardContent className="pt-5 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">Demographic Impact Report</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Age-based breakdown, condition correlations, per-member savings</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">JSON</Badge>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Information</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>Report generated: {new Date(data.reportGeneratedAt).toLocaleString()}</p>
                <p>Data covers: {formatMonth(data.monthlyMetrics[0].month)} through {formatMonth(data.monthlyMetrics[data.monthlyMetrics.length - 1].month)}</p>
                <p>Total beneficiaries tracked: {formatNumber(data.summary.totalBeneficiaries)}</p>
                <Separator className="my-3" />
                <p className="text-xs italic">{data.disclaimer}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
