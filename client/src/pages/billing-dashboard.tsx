import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CreditCard,
  Building2,
  Users,
  Check,
  X,
  Sparkles,
  Shield,
  Zap,
  Crown,
  Download,
  Receipt,
  Settings,
  TrendingUp,
  Target,
  Activity,
  FileText,
  Lock,
  Palette,
  HeadphonesIcon,
  BarChart3,
} from "lucide-react";

interface PlanFeatures {
  maxProfiles: number;
  advancedPacketSharing: boolean;
  carePathways: boolean;
  iotIntegration: boolean;
  aiAssistant: boolean;
  telehealth: boolean;
  prioritySupport: boolean;
  customAuditExports: boolean;
  apiAccess: boolean;
  whiteLabeling: boolean;
  sso: boolean;
  dedicatedAccountManager: boolean;
  intakeTools: boolean;
  outcomeTracking: boolean;
  populationHealth: boolean;
}

interface Plan {
  id: string;
  name: string;
  tier: string;
  description: string;
  targetAudience: string;
  priceMonthly: number;
  priceAnnual: number;
  pricePerProvider?: number;
  pricePmpm?: number;
  features: PlanFeatures;
  trialDays: number;
  popular?: boolean;
  priceMonthlyFormatted: string;
  priceAnnualFormatted?: string;
  pricePerProviderFormatted?: string;
  pricePmpmFormatted?: string;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceMonthlyFormatted: string;
}

interface OutcomeMetric {
  id: string;
  name: string;
  description: string;
  targetReduction?: number;
  targetImprovement?: number;
  incentivePerPoint: number;
}

const featureLabels: Record<keyof PlanFeatures, { label: string; icon: typeof Check }> = {
  maxProfiles: { label: "Profile Management", icon: Users },
  advancedPacketSharing: { label: "Advanced Packet Sharing", icon: FileText },
  carePathways: { label: "Care Pathways", icon: Activity },
  iotIntegration: { label: "IoT Health Sensors", icon: Zap },
  aiAssistant: { label: "AI Health Assistant", icon: Sparkles },
  telehealth: { label: "Telehealth Integration", icon: HeadphonesIcon },
  prioritySupport: { label: "Priority Support", icon: HeadphonesIcon },
  customAuditExports: { label: "Custom Audit Exports", icon: Download },
  apiAccess: { label: "API Access", icon: Settings },
  whiteLabeling: { label: "White Labeling", icon: Palette },
  sso: { label: "SSO Integration", icon: Lock },
  dedicatedAccountManager: { label: "Dedicated Account Manager", icon: Crown },
  intakeTools: { label: "Intake/Packet Tools", icon: FileText },
  outcomeTracking: { label: "Outcome Tracking", icon: Target },
  populationHealth: { label: "Population Health", icon: BarChart3 },
};

export default function BillingDashboard() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [providerCount, setProviderCount] = useState(1);
  const [memberCount, setMemberCount] = useState(1000);
  const { toast } = useToast();

  const { data: plansData, isLoading: plansLoading } = useQuery<{ success: boolean; plans: Plan[] }>({
    queryKey: ["/api/billing/plans"],
  });

  const { data: addonsData } = useQuery<{ success: boolean; addons: Addon[] }>({
    queryKey: ["/api/billing/addons"],
  });

  const { data: metricsData } = useQuery<{ success: boolean; metrics: OutcomeMetric[] }>({
    queryKey: ["/api/billing/outcome-metrics"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async (data: { planId: string; billingCycle: string; providerCount?: number; memberCount?: number }) => {
      return apiRequest("POST", "/api/billing/subscription", data);
    },
    onSuccess: () => {
      toast({
        title: "Subscription Created",
        description: "Your subscription has been activated successfully.",
      });
      setShowUpgradeDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create subscription. Please try again.",
        variant: "destructive",
      });
    },
  });

  const plans = plansData?.plans || [];
  const addons = addonsData?.addons || [];
  const metrics = metricsData?.metrics || [];

  const consumerPlans = plans.filter((p) => p.targetAudience === "consumer");
  const b2bPlans = plans.filter((p) => p.targetAudience !== "consumer");

  const handleSubscribe = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowUpgradeDialog(true);
  };

  const confirmSubscription = () => {
    if (!selectedPlan) return;

    subscribeMutation.mutate({
      planId: selectedPlan.id,
      billingCycle,
      providerCount: selectedPlan.pricePerProvider ? providerCount : undefined,
      memberCount: selectedPlan.pricePmpm ? memberCount : undefined,
    });
  };

  const getDisplayPrice = (plan: Plan) => {
    if (plan.pricePerProvider) {
      return `${plan.pricePerProviderFormatted}/provider/mo`;
    }
    if (plan.pricePmpm) {
      return `${plan.pricePmpmFormatted} PMPM`;
    }
    if (billingCycle === "annual" && plan.priceAnnual) {
      const monthly = plan.priceAnnual / 12 / 100;
      return `$${monthly.toFixed(2)}/mo`;
    }
    return plan.priceMonthlyFormatted === "$0.00" ? "$0" : `${plan.priceMonthlyFormatted}/mo`;
  };

  const FeatureCheck = ({ enabled, label }: { enabled: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {enabled ? (
        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      <span className={enabled ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
          Plans
        </h1>
        <p className="text-muted-foreground">
          Choose the plan that fits your needs. All plans include HIPAA-compliant security.
        </p>
      </div>

      <Tabs defaultValue="consumer" className="space-y-8">
        <TabsList className="grid w-full max-w-md grid-cols-3" data-testid="tabs-pricing">
          <TabsTrigger value="consumer" data-testid="tab-consumer">
            <Users className="h-4 w-4 mr-2" />
            Consumer
          </TabsTrigger>
          <TabsTrigger value="b2b" data-testid="tab-b2b">
            <Building2 className="h-4 w-4 mr-2" />
            B2B
          </TabsTrigger>
          <TabsTrigger value="enterprise" data-testid="tab-enterprise">
            <Crown className="h-4 w-4 mr-2" />
            Enterprise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consumer" className="space-y-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={billingCycle === "monthly" ? "font-medium" : "text-muted-foreground"}>
              Monthly
            </span>
            <Switch
              checked={billingCycle === "annual"}
              onCheckedChange={(checked) => setBillingCycle(checked ? "annual" : "monthly")}
              data-testid="switch-billing-cycle"
            />
            <span className={billingCycle === "annual" ? "font-medium" : "text-muted-foreground"}>
              Annual
            </span>
            {billingCycle === "annual" && (
              <Badge variant="secondary" className="ml-2">
                Save 17%
              </Badge>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
            {consumerPlans.map((plan) => (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
                data-testid={`card-plan-${plan.tier}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {plan.tier === "free" ? (
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-primary" />
                    )}
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">{getDisplayPrice(plan)}</div>
                  {billingCycle === "annual" && plan.priceAnnual > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Billed {plan.priceAnnualFormatted} annually
                    </p>
                  )}
                  {plan.trialDays > 0 && (
                    <Badge variant="outline">{plan.trialDays}-day trial</Badge>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <FeatureCheck
                      enabled
                      label={`${plan.features.maxProfiles} ${plan.features.maxProfiles === 1 ? "profile" : "profiles"}`}
                    />
                    <FeatureCheck
                      enabled={plan.features.advancedPacketSharing}
                      label="Advanced Packet Sharing"
                    />
                    <FeatureCheck enabled={plan.features.carePathways} label="Care Pathways" />
                    <FeatureCheck enabled={plan.features.iotIntegration} label="IoT Health Sensors" />
                    <FeatureCheck enabled={plan.features.aiAssistant} label="AI Health Assistant" />
                    <FeatureCheck enabled={plan.features.telehealth} label="Telehealth Integration" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(plan)}
                    data-testid={`button-subscribe-${plan.tier}`}
                  >
                    {plan.tier === "free" ? "Get Started" : "Start Trial"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="b2b" className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">B2B Healthcare Solutions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Tailored pricing for concierge practices, ACOs, and MA plans with outcome-based incentives.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            {b2bPlans.slice(0, 2).map((plan) => (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {plan.name}
                    </CardTitle>
                    <Badge variant="outline">{plan.targetAudience.replace("_", " ")}</Badge>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold">{getDisplayPrice(plan)}</div>

                  {plan.pricePerProvider && (
                    <div className="space-y-2">
                      <Label>Number of Providers</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={providerCount}
                          onChange={(e) => setProviderCount(parseInt(e.target.value) || 1)}
                          className="w-24"
                          data-testid="input-provider-count"
                        />
                        <span className="text-muted-foreground">
                          Total: ${((plan.pricePerProvider * providerCount) / 100).toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  )}

                  {plan.pricePmpm && (
                    <div className="space-y-2">
                      <Label>Covered Members</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          min={100}
                          max={100000}
                          step={100}
                          value={memberCount}
                          onChange={(e) => setMemberCount(parseInt(e.target.value) || 1000)}
                          className="w-32"
                          data-testid="input-member-count"
                        />
                        <span className="text-muted-foreground">
                          Total: ${((plan.pricePmpm * memberCount) / 100).toFixed(2)}/mo
                        </span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Included Features:</h4>
                    <FeatureCheck enabled={plan.features.intakeTools} label="Intake/Packet Tools" />
                    <FeatureCheck enabled={plan.features.outcomeTracking} label="Outcome Tracking" />
                    <FeatureCheck enabled={plan.features.populationHealth} label="Population Health" />
                    <FeatureCheck enabled={plan.features.aiAssistant} label="AI Health Assistant" />
                    <FeatureCheck enabled={plan.features.prioritySupport} label="Priority Support" />
                    <FeatureCheck enabled={plan.features.apiAccess} label="API Access" />
                  </div>

                  {plan.pricePmpm && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          Outcome-Based Incentives
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Earn rebates when you hit quality improvement targets
                        </p>
                        {metrics.slice(0, 3).map((metric) => (
                          <div key={metric.id} className="text-sm flex justify-between">
                            <span className="text-muted-foreground">{metric.name}</span>
                            <span className="font-medium">
                              ${(metric.incentivePerPoint / 100).toFixed(0)}/point
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan)}
                    data-testid={`button-subscribe-${plan.id}`}
                  >
                    {plan.trialDays > 0 ? `Start ${plan.trialDays}-Day Trial` : "Contact Sales"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="enterprise" className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Enterprise Add-Ons</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Extend your plan with enterprise-grade features for larger organizations.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {addons.map((addon) => (
              <Card key={addon.id} data-testid={`card-addon-${addon.id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {addon.id === "addon_white_label" && <Palette className="h-5 w-5 text-primary" />}
                    {addon.id === "addon_sso" && <Lock className="h-5 w-5 text-primary" />}
                    {addon.id === "addon_custom_audit" && <FileText className="h-5 w-5 text-primary" />}
                    {addon.id === "addon_dedicated_support" && <HeadphonesIcon className="h-5 w-5 text-primary" />}
                    {addon.id === "addon_custom_integrations" && <Settings className="h-5 w-5 text-primary" />}
                    {addon.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{addon.description}</p>
                  <div className="text-2xl font-bold">{addon.priceMonthlyFormatted}/mo</div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full" data-testid={`button-addon-${addon.id}`}>
                    Add to Plan
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          <Card className="max-w-3xl mx-auto mt-8" data-testid="card-enterprise-contact">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Custom Enterprise Plan
              </CardTitle>
              <CardDescription>
                Need a fully customized solution? Let's build the perfect plan for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Everything in Pro, plus:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> White-label branding
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> SSO/SAML integration
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> Custom audit exports
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> Dedicated account manager
                    </li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Additional Benefits:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> Custom EHR integrations
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> SLA guarantees
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> Volume discounts
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" /> Priority feature requests
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" data-testid="button-contact-sales">
                <CreditCard className="h-4 w-4 mr-2" />
                Contact Sales
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent data-testid="dialog-subscribe">
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              {selectedPlan?.trialDays
                ? `Start your ${selectedPlan.trialDays}-day trial. No credit card required.`
                : "Confirm your subscription details below."}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Billing Cycle</span>
                <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as "monthly" | "annual")}>
                  <SelectTrigger className="w-32" data-testid="select-billing-cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Total</span>
                <span>{getDisplayPrice(selectedPlan)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSubscription} disabled={subscribeMutation.isPending} data-testid="button-confirm-subscribe">
              {subscribeMutation.isPending ? "Processing..." : "Confirm Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
