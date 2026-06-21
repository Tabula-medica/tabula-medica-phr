import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Crown,
  CheckCircle,
  Shield,
  Brain,
  Stethoscope,
  Heart,
  Users,
  Smartphone,
  Star,
  Loader2,
  ArrowRight,
  Zap,
  Lock,
  Copy,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

function PricingCard({
  product,
  selected,
  onSelect,
}: {
  product: any;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`relative cursor-pointer transition-all ${
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-lg"
          : "border-gray-200 dark:border-gray-700 hover:border-primary/40"
      } ${product.bestValue ? "scale-[1.02]" : ""}`}
      onClick={onSelect}
      data-testid={`pricing-card-${product.productId}`}
    >
      {product.bestValue && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2" data-testid="best-value-badge">
          <Badge className="bg-amber-500 text-white font-bold px-4 py-1 text-xs uppercase tracking-wider">
            Best Value
          </Badge>
        </div>
      )}
      <CardContent className="p-6 text-center">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{product.displayName.split("—")[1]?.trim()}</div>
        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1" data-testid={`price-${product.productId}`}>
          {product.priceFormatted}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          /{product.billingPeriod === "monthly" ? "month" : "year"}
        </div>
        {product.savingsPercent > 0 && (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 mb-3">
            Save {product.savingsPercent}%
          </Badge>
        )}
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {product.trialDays}-day trial
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubscriptionPaywall() {
  const [selectedProduct, setSelectedProduct] = useState("com.tabulamedica.pro.annual");
  const [activeTab, setActiveTab] = useState("subscribe");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const { data: productsData, isLoading: loadingProducts } = useQuery<any>({
    queryKey: ["/api/appstore-iap/products"],
  });

  const { data: configData } = useQuery<any>({
    queryKey: ["/api/appstore-iap/storekit-config"],
  });

  const { data: statusData } = useQuery<any>({
    queryKey: ["/api/appstore-iap/subscription/status"],
    queryFn: () => fetch("/api/appstore-iap/subscription/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "current" }),
    }).then(r => r.json()),
  });

  if (loadingProducts) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const products = productsData?.products || [];
  const selected = products.find((p: any) => p.productId === selectedProduct);
  const hasSub = statusData?.hasSubscription;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto" data-testid="subscription-paywall-page">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4" data-testid="crown-icon">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="paywall-title">
          Tabula Medica Pro
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          AI-powered health intelligence, unlimited connections, and priority support for your complete medical record
        </p>

        {hasSub && (
          <div className="mt-4 inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-full border border-green-200 dark:border-green-800" data-testid="active-subscription-badge">
            <CheckCircle className="w-4 h-4" />
            <span className="font-medium">Active Subscription — {statusData?.tier?.toUpperCase()}</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto" data-testid="paywall-tabs">
          <TabsTrigger value="subscribe" data-testid="tab-subscribe">Subscribe</TabsTrigger>
          <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
          <TabsTrigger value="dev-guide" data-testid="tab-dev-guide">Dev Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribe" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="pricing-grid">
              {products.map((product: any) => (
                <PricingCard
                  key={product.productId}
                  product={product}
                  selected={selectedProduct === product.productId}
                  onSelect={() => setSelectedProduct(product.productId)}
                />
              ))}
            </div>

            <div className="text-center">
              <Button
                size="lg"
                className="px-12 py-6 text-lg font-bold rounded-xl shadow-lg"
                data-testid="subscribe-button"
              >
                <Zap className="w-5 h-5 mr-2" />
                {selected?.trialDays > 0
                  ? `Start ${selected.trialDays}-Day Trial`
                  : "Subscribe Now"}
              </Button>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3" data-testid="trial-terms">
                {selected?.trialDays > 0 && `${selected.trialDays}-day trial, then `}
                {selected?.priceFormatted}/{selected?.billingPeriod === "monthly" ? "mo" : "yr"} · Cancel anytime · Restore purchases available
              </p>
            </div>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" data-testid="promoted-purchase-info">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-200 mb-1">App Store Promoted Purchase</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Users can subscribe directly from the App Store product page without opening the app.
                      The PurchaseIntent listener catches the intent and shows this payment sheet automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature highlights */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Brain, label: "AI Health Advisor", desc: "Personalized insights" },
                { icon: Stethoscope, label: "Unlimited EHR", desc: "Connect all providers" },
                { icon: Shield, label: "HIPAA + FIPS", desc: "Military-grade security" },
                { icon: Heart, label: "Priority Support", desc: "24/7 dedicated help" },
              ].map((feat) => (
                <div key={feat.label} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-center" data-testid={`feature-highlight-${feat.label.replace(/\s/g, "-")}`}>
                  <feat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{feat.label}</div>
                  <div className="text-xs text-gray-500">{feat.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <div className="space-y-4">
            <Card data-testid="feature-comparison">
              <CardHeader>
                <CardTitle className="text-lg">Plan Comparison</CardTitle>
                <CardDescription>See what's included in each tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="comparison-table">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-500">Feature</th>
                        <th className="text-center py-3 px-4 font-medium text-gray-500">Starter</th>
                        <th className="text-center py-3 px-4 font-medium text-primary">Pro</th>
                        <th className="text-center py-3 px-4 font-medium text-purple-600 dark:text-purple-400">Family</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { feature: "Health Profiles", free: "1", pro: "6", family: "Up to 6" },
                        { feature: "FHIR/EHR Connections", free: "1", pro: "Unlimited", family: "Unlimited" },
                        { feature: "Document Storage", free: "100 MB", pro: "5 GB", family: "5 GB" },
                        { feature: "Drug Savings Finder", free: true, pro: true, family: true },
                        { feature: "FQHC Care Finder", free: true, pro: true, family: true },
                        { feature: "Timeline View", free: true, pro: true, family: true },
                        { feature: "AI Health Assistant", free: false, pro: true, family: true },
                        { feature: "Care Team Sharing", free: false, pro: true, family: true },
                        { feature: "Smart Summaries", free: false, pro: true, family: true },
                        { feature: "Telehealth Integration", free: false, pro: true, family: true },
                        { feature: "IoT/Wearable Sync", free: false, pro: true, family: true },
                        { feature: "Advanced Analytics", free: false, pro: true, family: true },
                        { feature: "Shared Family View", free: false, pro: false, family: true },
                        { feature: "Dependent Management", free: false, pro: false, family: true },
                        { feature: "Pediatric Milestones", free: false, pro: false, family: true },
                      ].map((row) => (
                        <tr key={row.feature} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2 px-4 font-medium text-gray-900 dark:text-white">{row.feature}</td>
                          <td className="py-2 px-4 text-center">
                            {typeof row.free === "boolean" ? (
                              row.free ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">{row.free}</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {typeof row.pro === "boolean" ? (
                              row.pro ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                            ) : (
                              <span className="text-primary font-medium">{row.pro}</span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-center">
                            {typeof row.family === "boolean" ? (
                              row.family ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>
                            ) : (
                              <span className="text-purple-600 dark:text-purple-400 font-medium">{row.family}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Testimonials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { quote: "Finally, all my family's health records in one secure place. The AI advisor caught a medication interaction my doctor missed.", name: "Sarah M.", role: "Pro Subscriber", rating: 5 },
                { quote: "The EHR integration saved me hours of paperwork when switching providers. Worth every penny for the peace of mind.", name: "James K.", role: "Pro Subscriber", rating: 5 },
              ].map((testimonial, i) => (
                <Card key={i} data-testid={`testimonial-${i}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-1 mb-2">
                      {Array.from({ length: testimonial.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-3">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{testimonial.name}</div>
                        <div className="text-xs text-gray-500">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* FAQ */}
            <Card data-testid="faq-section">
              <CardHeader>
                <CardTitle className="text-lg">Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { q: "Can I cancel anytime?", a: "Yes. You can cancel your subscription at any time through your Apple ID settings. You'll keep access until the end of your billing period." },
                  { q: "Is there a free trial?", a: "Yes! All Pro and Family plans include a 7-day free trial. You won't be charged until the trial ends." },
                  { q: "What happens to my data if I downgrade?", a: "Your health records are always yours. If you downgrade to Free, you'll keep all your data but lose access to AI features and multi-profile support." },
                  { q: "Is my health data secure?", a: "Absolutely. Tabula Medica uses HIPAA-compliant zero-knowledge encryption with FIPS 140-3 standards. We never sell your data." },
                  { q: "Can I share my subscription with family?", a: "The Family plan supports up to 6 profiles. Each family member gets their own private health record with optional shared views." },
                ].map((faq, i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" data-testid={`faq-${i}`}>
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      data-testid={`faq-toggle-${i}`}
                    >
                      <span className="font-medium text-sm text-gray-900 dark:text-white">{faq.q}</span>
                      {expandedFaq === i ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>
                    {expandedFaq === i && (
                      <div className="px-3 pb-3 text-sm text-gray-600 dark:text-gray-400">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dev-guide" className="mt-6">
          <div className="space-y-4">
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20" data-testid="promoted-purchase-warning">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200 mb-1">Fixing the "Promoted Purchase" Warning</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                      The App Store warning about promoted purchases clears only after uploading a build that contains the PurchaseIntent listener.
                    </p>
                    <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
                      <li>Add the StoreKit 2 PurchaseIntent code to your app</li>
                      <li>Upload a new build to TestFlight</li>
                      <li>Select that build for your App Store version</li>
                      <li>The warning disappears only after the build is approved</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            {configData?.implementation && (
              <>
                {/* Swift StoreKit 2 */}
                <Card data-testid="swift-code">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Lock className="w-5 h-5 text-orange-500" />
                          StoreKit 2 — Swift (Native iOS)
                        </CardTitle>
                        <CardDescription>Required PurchaseIntent listener for promoted App Store purchases</CardDescription>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Required</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed" data-testid="swift-code-block">
                      {configData.implementation.swift.code}
                    </pre>
                    <div className="mt-3 space-y-1">
                      {configData.implementation.swift.notes.map((note: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <ArrowRight className="w-3 h-3 mt-1 shrink-0 text-primary" />
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* React Native */}
                <Card data-testid="react-native-code">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-blue-500" />
                      React Native IAP — react-native-iap
                    </CardTitle>
                    <CardDescription>For Expo/React Native wrapper (your current mobile setup)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-900 text-blue-400 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed" data-testid="rn-code-block">
                      {configData.implementation.reactNative.code}
                    </pre>
                  </CardContent>
                </Card>

                {/* Expo */}
                <Card data-testid="expo-code">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-purple-500" />
                      Expo IAP — expo-in-app-purchases
                    </CardTitle>
                    <CardDescription>Alternative if using expo-in-app-purchases</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-900 text-purple-400 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed" data-testid="expo-code-block">
                      {configData.implementation.expo.code}
                    </pre>
                  </CardContent>
                </Card>
              </>
            )}

            {/* App Store Connect Setup Steps */}
            {configData?.appStoreConnectSetup && (
              <Card data-testid="appstore-connect-steps">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">App Store Connect Setup</CardTitle>
                  <CardDescription>Steps to enable promoted in-app purchases in your App Store listing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {configData.appStoreConnectSetup.steps.map((step: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm" data-testid={`setup-step-${i}`}>
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{step.replace(/^\d+\.\s*/, "")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* API Endpoints Reference */}
            <Card data-testid="api-reference">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Backend API Endpoints</CardTitle>
                <CardDescription>Server-side receipt verification and subscription management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { method: "GET", path: "/api/appstore-iap/products", desc: "List all IAP products with pricing" },
                    { method: "POST", path: "/api/appstore-iap/verify-receipt", desc: "Verify App Store receipt and activate subscription" },
                    { method: "POST", path: "/api/appstore-iap/promoted-purchase", desc: "Handle promoted purchase intent from App Store" },
                    { method: "POST", path: "/api/appstore-iap/subscription/status", desc: "Check current subscription status and tier" },
                    { method: "POST", path: "/api/appstore-iap/webhook/app-store-server-notification", desc: "App Store Server Notification v2 webhook" },
                    { method: "GET", path: "/api/appstore-iap/storekit-config", desc: "StoreKit configuration and implementation guide" },
                  ].map((endpoint, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800/50" data-testid={`api-endpoint-${i}`}>
                      <Badge variant="outline" className={`font-mono text-xs ${endpoint.method === "GET" ? "text-green-600 border-green-300" : "text-blue-600 border-blue-300"}`}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs font-mono text-gray-800 dark:text-gray-200">{endpoint.path}</code>
                      <span className="text-xs text-gray-500 ml-auto">{endpoint.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
