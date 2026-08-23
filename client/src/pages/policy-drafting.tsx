import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Sparkles,
  BookTemplate,
  Shield,
  ChevronRight,
  Loader2,
  Lightbulb,
  Check,
  Edit,
  Trash2,
  Eye,
  Wand2
} from "lucide-react";

type PolicyCategory = "access_control" | "retention" | "encryption" | "audit" | "consent" | "breach_response" | "data_classification" | "vendor_management";
type RegulatoryFramework = "HIPAA" | "GDPR" | "SOC2" | "HITECH" | "CCPA" | "NIST" | "PCI_DSS" | "FDA";

interface PolicyTemplate {
  id: string;
  name: string;
  category: PolicyCategory;
  description: string;
  regulatoryBasis: RegulatoryFramework[];
  bestPractices: string[];
  industryStandard: boolean;
}

interface PolicyDraftSummary {
  id: string;
  title: string;
  category: PolicyCategory;
  status: string;
  version: string;
  regulatoryFrameworks: RegulatoryFramework[];
  sectionsCount: number;
  rulesCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PolicySuggestion {
  suggestedTitle: string;
  suggestedDescription: string;
  suggestedSections: Array<{ id: string; title: string; content: string; order: number; aiGenerated: boolean }>;
  suggestedRules: Array<{ id: string; name: string; description: string; condition: string; action: string }>;
  bestPractices: string[];
  complianceNotes: string[];
  gaps: string[];
  aiConfidence: number;
}

const categories: { value: PolicyCategory; label: string }[] = [
  { value: "access_control", label: "Access Control" },
  { value: "retention", label: "Data Retention" },
  { value: "encryption", label: "Encryption" },
  { value: "audit", label: "Audit Logging" },
  { value: "consent", label: "Consent Management" },
  { value: "breach_response", label: "Breach Response" },
  { value: "data_classification", label: "Data Classification" },
  { value: "vendor_management", label: "Vendor Management" }
];

const frameworks: { value: RegulatoryFramework; label: string }[] = [
  { value: "HIPAA", label: "HIPAA" },
  { value: "GDPR", label: "GDPR" },
  { value: "SOC2", label: "SOC2" },
  { value: "HITECH", label: "HITECH" },
  { value: "CCPA", label: "CCPA" },
  { value: "NIST", label: "NIST" },
  { value: "PCI_DSS", label: "PCI-DSS" },
  { value: "FDA", label: "FDA" }
];

export default function PolicyDrafting() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("templates");
  const [selectedCategory, setSelectedCategory] = useState<PolicyCategory>("access_control");
  const [selectedFrameworks, setSelectedFrameworks] = useState<RegulatoryFramework[]>(["HIPAA"]);
  const [currentSuggestions, setCurrentSuggestions] = useState<PolicySuggestion | null>(null);
  const [ruleDescription, setRuleDescription] = useState("");

  const { data: templatesData, isLoading: templatesLoading } = useQuery<{ templates: PolicyTemplate[] }>({
    queryKey: ["/api/policy-drafting/templates"]
  });

  const { data: draftsData, isLoading: draftsLoading } = useQuery<{ drafts: PolicyDraftSummary[]; total: number }>({
    queryKey: ["/api/policy-drafting/drafts"]
  });

  const generateSuggestionsMutation = useMutation({
    mutationFn: async (data: { targetCategory: PolicyCategory; targetFrameworks: RegulatoryFramework[] }) => {
      const response = await apiRequest("POST", "/api/policy-drafting/suggestions", {
        ...data,
        existingPolicies: []
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSuggestions(data);
      setActiveTab("suggestions");
      toast({ title: "Suggestions Generated", description: "AI policy suggestions are ready for review" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate suggestions", variant: "destructive" });
    }
  });

  const generateRuleMutation = useMutation({
    mutationFn: async (data: { category: PolicyCategory; description: string }) => {
      const response = await apiRequest("POST", "/api/policy-drafting/generate-rule", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Rule Generated", 
        description: `Created rule: ${data.rule.name}` 
      });
      setRuleDescription("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate rule", variant: "destructive" });
    }
  });

  const createDraftMutation = useMutation({
    mutationFn: async (data: { templateId: string | null; category: PolicyCategory; frameworks: RegulatoryFramework[] }) => {
      const response = await apiRequest("POST", "/api/policy-drafting/drafts", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Draft Created", description: "New policy draft created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-drafting/drafts"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create draft", variant: "destructive" });
    }
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const response = await apiRequest("DELETE", `/api/policy-drafting/drafts/${draftId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Draft deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/policy-drafting/drafts"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete draft", variant: "destructive" });
    }
  });

  const toggleFramework = (framework: RegulatoryFramework) => {
    setSelectedFrameworks(prev => 
      prev.includes(framework)
        ? prev.filter(f => f !== framework)
        : [...prev, framework]
    );
  };

  const getCategoryLabel = (cat: PolicyCategory) => 
    categories.find(c => c.value === cat)?.label || cat;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      review: "default",
      approved: "outline",
      active: "default"
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="h-6 w-6" />
            Policy Drafting Assistant
          </h1>
          <p className="text-muted-foreground">AI-powered policy creation based on industry standards</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <BookTemplate className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">
            <Edit className="h-4 w-4 mr-2" />
            Drafts
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          {currentSuggestions && (
            <TabsTrigger value="suggestions" data-testid="tab-suggestions">
              <Wand2 className="h-4 w-4 mr-2" />
              Suggestions
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Templates</CardTitle>
              <CardDescription>Industry-standard templates based on regulatory requirements</CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templatesData?.templates?.map((template) => (
                    <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-2 rounded-md bg-primary/10">
                            <Shield className="h-5 w-5 text-primary" />
                          </div>
                          {template.industryStandard && (
                            <Badge variant="outline" className="text-xs">Industry Standard</Badge>
                          )}
                        </div>
                        <h3 className="font-medium mt-2">{template.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                        <div className="flex flex-wrap gap-1 mt-3">
                          {template.regulatoryBasis.slice(0, 3).map(reg => (
                            <Badge key={reg} variant="secondary" className="text-xs">{reg}</Badge>
                          ))}
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          size="sm"
                          onClick={() => createDraftMutation.mutate({
                            templateId: template.id,
                            category: template.category,
                            frameworks: template.regulatoryBasis as RegulatoryFramework[]
                          })}
                          disabled={createDraftMutation.isPending}
                          data-testid={`button-use-template-${template.id}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Use Template
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Policy Drafts</CardTitle>
                  <CardDescription>Manage your policy drafts</CardDescription>
                </div>
                <Button 
                  onClick={() => setActiveTab("generate")}
                  data-testid="button-new-draft"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Draft
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : draftsData?.drafts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No drafts yet</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setActiveTab("templates")}
                    data-testid="button-browse-templates"
                  >
                    Browse Templates
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {draftsData?.drafts?.map((draft) => (
                      <Card key={draft.id} className="hover-elevate" data-testid={`card-draft-${draft.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{draft.title}</h3>
                                {getStatusBadge(draft.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {getCategoryLabel(draft.category)} | v{draft.version} | 
                                {draft.sectionsCount} sections, {draft.rulesCount} rules
                              </p>
                              <div className="flex gap-1 mt-2">
                                {draft.regulatoryFrameworks.map(f => (
                                  <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="icon" variant="ghost" data-testid={`button-view-${draft.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost"
                                onClick={() => deleteDraftMutation.mutate(draft.id)}
                                data-testid={`button-delete-${draft.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Generate Policy Suggestions
                </CardTitle>
                <CardDescription>Get AI-powered policy recommendations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="policy-drafting-policy-category">Policy Category</Label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={(v) => setSelectedCategory(v as PolicyCategory)}
                  >
                    <SelectTrigger id="policy-drafting-policy-category" data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <FieldCaption>Regulatory Frameworks</FieldCaption>
                  <div className="grid grid-cols-2 gap-2">
                    {frameworks.map(fw => (
                      <div key={fw.value} className="flex items-center space-x-2">
                        <Checkbox aria-label="Regulatory Frameworks" 
                          id={fw.value}
                          checked={selectedFrameworks.includes(fw.value)}
                          onCheckedChange={() => toggleFramework(fw.value)}
                          data-testid={`checkbox-${fw.value}`}
                        />
                        <label htmlFor={fw.value} className="text-sm">{fw.label}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full"
                  onClick={() => generateSuggestionsMutation.mutate({
                    targetCategory: selectedCategory,
                    targetFrameworks: selectedFrameworks
                  })}
                  disabled={generateSuggestionsMutation.isPending || selectedFrameworks.length === 0}
                  data-testid="button-generate-suggestions"
                >
                  {generateSuggestionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Suggestions
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  Generate Rule
                </CardTitle>
                <CardDescription>Create policy rules from requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="policy-drafting-category">Category</Label>
                  <Select 
                    value={selectedCategory} 
                    onValueChange={(v) => setSelectedCategory(v as PolicyCategory)}
                  >
                    <SelectTrigger id="policy-drafting-category" data-testid="select-rule-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="policy-drafting-rule-requirement">Rule Requirement</Label>
                  <Textarea id="policy-drafting-rule-requirement" 
                    placeholder="Describe what this rule should enforce..."
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="input-rule-description"
                  />
                </div>

                <Button 
                  className="w-full"
                  onClick={() => generateRuleMutation.mutate({
                    category: selectedCategory,
                    description: ruleDescription
                  })}
                  disabled={generateRuleMutation.isPending || ruleDescription.length < 10}
                  data-testid="button-generate-rule"
                >
                  {generateRuleMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Generate Rule
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {currentSuggestions && (
          <TabsContent value="suggestions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{currentSuggestions.suggestedTitle}</CardTitle>
                    <CardDescription>{currentSuggestions.suggestedDescription}</CardDescription>
                  </div>
                  <Badge variant="outline">
                    AI Confidence: {Math.round(currentSuggestions.aiConfidence * 100)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {currentSuggestions.suggestedSections.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Suggested Sections
                    </h3>
                    <div className="space-y-3">
                      {currentSuggestions.suggestedSections.map((section) => (
                        <Card key={section.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{section.title}</h4>
                              {section.aiGenerated && (
                                <Badge variant="secondary" className="text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI Generated
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{section.content || "Content to be added"}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {currentSuggestions.suggestedRules.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Suggested Rules
                    </h3>
                    <div className="space-y-2">
                      {currentSuggestions.suggestedRules.map((rule) => (
                        <div key={rule.id} className="p-3 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{rule.name}</span>
                            <Badge variant="outline">{rule.action}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block">{rule.condition}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Best Practices
                    </h3>
                    <ul className="space-y-2">
                      {currentSuggestions.bestPractices.map((bp, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Check className="h-4 w-4 text-green-500 mt-0.5" />
                          {bp}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-medium mb-3">Compliance Notes</h3>
                    <ul className="space-y-2">
                      {currentSuggestions.complianceNotes.map((note, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {currentSuggestions.gaps.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3 text-amber-500">Identified Gaps</h3>
                    <ul className="space-y-2">
                      {currentSuggestions.gaps.map((gap, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{gap}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button 
                  className="w-full"
                  onClick={() => createDraftMutation.mutate({
                    templateId: null,
                    category: selectedCategory,
                    frameworks: selectedFrameworks
                  })}
                  disabled={createDraftMutation.isPending}
                  data-testid="button-create-from-suggestions"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Draft from Suggestions
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
