import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Search,
  Lightbulb,
  Heart,
  Pill,
  Activity,
  TestTube,
  Stethoscope,
  Brain,
  Loader2,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/shared";

interface HealthTopic {
  id: string;
  title: string;
  description: string;
  category: "medications" | "conditions" | "tests" | "wellness" | "procedures";
  icon: React.ElementType;
  content: string;
  relatedTerms: string[];
}

const healthTopics: HealthTopic[] = [
  {
    id: "blood-pressure",
    title: "Understanding Blood Pressure",
    description: "Learn what your blood pressure numbers mean and how to manage hypertension",
    category: "conditions",
    icon: Heart,
    content: "Blood pressure is measured in millimeters of mercury (mmHg) and is given as two numbers: systolic (when heart beats) over diastolic (when heart rests). Normal is less than 120/80 mmHg. High blood pressure (hypertension) can lead to heart disease and stroke if not managed.",
    relatedTerms: ["Systolic", "Diastolic", "Hypertension", "mmHg"],
  },
  {
    id: "cholesterol",
    title: "Cholesterol Explained",
    description: "Understanding LDL, HDL, and what your lipid panel results mean",
    category: "tests",
    icon: TestTube,
    content: "Cholesterol travels in your blood in packages called lipoproteins. LDL (low-density lipoprotein) is often called 'bad' cholesterol because high levels can lead to plaque buildup in arteries. HDL (high-density lipoprotein) is 'good' cholesterol that helps remove LDL from your arteries.",
    relatedTerms: ["LDL", "HDL", "Triglycerides", "Lipid Panel", "Statins"],
  },
  {
    id: "a1c",
    title: "HbA1c and Diabetes",
    description: "What your A1C test tells you about blood sugar control",
    category: "tests",
    icon: Activity,
    content: "HbA1c (glycated hemoglobin) measures your average blood sugar over the past 2-3 months. It's expressed as a percentage. Normal is below 5.7%, prediabetes is 5.7-6.4%, and diabetes is 6.5% or higher. For people with diabetes, the goal is usually below 7%.",
    relatedTerms: ["Glucose", "Diabetes", "Prediabetes", "Blood Sugar", "Metformin"],
  },
  {
    id: "medications-basics",
    title: "Taking Medications Safely",
    description: "Tips for managing multiple medications and avoiding interactions",
    category: "medications",
    icon: Pill,
    content: "Always take medications as prescribed. Keep an updated list of all your medications, including over-the-counter drugs and supplements. Ask your pharmacist about potential interactions. Don't stop medications without consulting your doctor, even if you feel better.",
    relatedTerms: ["Drug Interactions", "Side Effects", "Dosage", "Refills"],
  },
  {
    id: "immunizations",
    title: "Vaccines and Immunizations",
    description: "Why vaccines matter and recommended schedules for adults",
    category: "wellness",
    icon: Stethoscope,
    content: "Vaccines train your immune system to fight specific diseases. Adults need vaccines too - including annual flu shots, Tdap boosters every 10 years, and shingles vaccine after age 50. COVID-19 vaccines and boosters are recommended for most adults.",
    relatedTerms: ["Flu Shot", "COVID-19", "Tdap", "Shingles", "Booster"],
  },
  {
    id: "mental-health",
    title: "Mental Health Basics",
    description: "Understanding anxiety, depression, and when to seek help",
    category: "wellness",
    icon: Brain,
    content: "Mental health is as important as physical health. Anxiety and depression are common and treatable. Warning signs include persistent sadness, excessive worry, sleep changes, and loss of interest in activities. Don't hesitate to talk to your doctor - effective treatments are available.",
    relatedTerms: ["Anxiety", "Depression", "Therapy", "SSRIs", "Mental Wellness"],
  },
];

const categoryInfo = {
  medications: { label: "Medications", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  conditions: { label: "Conditions", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  tests: { label: "Lab Tests", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  wellness: { label: "Wellness", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  procedures: { label: "Procedures", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

function TopicCard({ topic, onSelect }: { topic: HealthTopic; onSelect: () => void }) {
  const Icon = topic.icon;
  const category = categoryInfo[topic.category];
  
  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      onClick={onSelect}
      data-testid={`card-topic-${topic.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${category.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold">{topic.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {category.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {topic.description}
            </p>
            <div className="flex items-center gap-1 mt-3 text-sm text-primary">
              <span>Learn more<span className="sr-only"> about {topic.title}</span></span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AskAISection() {
  const [term, setTerm] = useState("");
  const [explanation, setExplanation] = useState<{ term: string; explanation: string } | null>(null);
  
  const explainMutation = useMutation({
    mutationFn: async (termToExplain: string) => {
      const response = await apiRequest("POST", "/api/explain-term", { term: termToExplain });
      return response.json();
    },
    onSuccess: (data) => {
      setExplanation(data);
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.trim()) {
      explainMutation.mutate(term.trim());
    }
  };
  
  const suggestedTerms = ["LDL Cholesterol", "A1C", "Blood Pressure", "BMI", "Creatinine", "TSH"];
  
  return (
    <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Ask AI About Medical Terms</CardTitle>
            <CardDescription>Get plain-English explanations of medical terminology</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter a medical term (e.g., LDL, A1C, hypertension)"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="flex-1"
            data-testid="input-medical-term"
          />
          <Button 
            type="submit" 
            disabled={!term.trim() || explainMutation.isPending}
            data-testid="button-explain-term"
          >
            {explainMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Explain"
            )}
          </Button>
        </form>
        
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Try:</span>
          {suggestedTerms.map((suggestedTerm) => (
            <Badge 
              key={suggestedTerm}
              variant="outline" 
              className="cursor-pointer hover-elevate"
              onClick={() => {
                setTerm(suggestedTerm);
                explainMutation.mutate(suggestedTerm);
              }}
              data-testid={`badge-suggested-${suggestedTerm.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {suggestedTerm}
            </Badge>
          ))}
        </div>
        
        {explanation && (
          <div className="p-4 rounded-lg bg-background border">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="font-semibold">{explanation.term}</span>
            </div>
            <p className="text-sm text-muted-foreground">{explanation.explanation}</p>
          </div>
        )}
        
        {explainMutation.isError && (
          <p className="text-sm text-destructive">
            Unable to get explanation. Please try again.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FAQSection() {
  const faqs = [
    {
      question: "How do I connect my health records?",
      answer: "Go to the Connect Health Records section and click 'Connect Your Records'. Search for your healthcare provider and follow the secure login process powered by Fasten Health. Your credentials are never stored by our app."
    },
    {
      question: "Why do I see duplicate records?",
      answer: "When you visit multiple healthcare facilities, each one may create records for the same test or condition. We identify these duplicates and show you which sources have the same information, so you always know where your data came from."
    },
    {
      question: "What does 'provenance' mean?",
      answer: "Provenance is the origin or source of your health data. We track which hospital, clinic, or EHR system each piece of information came from, so you can verify its accuracy and share the right records with your doctors."
    },
    {
      question: "Is my health information secure?",
      answer: "Yes. We use industry-standard encryption and secure OAuth 2.0 with PKCE for connecting to your EHR systems. Your login credentials are never stored, and you can revoke access to any connected source at any time."
    },
    {
      question: "Can I share my records with my doctor?",
      answer: "Yes! You can view and download your documents, lab results, and medical records. Use the Documents section to find specific records to share with healthcare providers."
    },
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Frequently Asked Questions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger className="text-left" data-testid={`faq-${index}`}>
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export default function Learn() {
  useSEO({
    title: "Learn",
    description: "Educational content about health topics, medical terms, and how to use your health records"
  });

  const [selectedTopic, setSelectedTopic] = useState<HealthTopic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  const filteredTopics = healthTopics.filter((topic) => {
    const matchesSearch = 
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.relatedTerms.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeTab === "all" || topic.category === activeTab;
    return matchesSearch && matchesCategory;
  });
  
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <PageHeader
            title="Health Education"
            subtitle="Learn about health topics and get plain-English explanations of medical terms"
            data-testid="page-title"
          />

          <AskAISection />

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <h2 className="text-lg font-semibold">Health Topics</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="search-input"
                />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
                <TabsTrigger value="tests" data-testid="tab-tests">Lab Tests</TabsTrigger>
                <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
                <TabsTrigger value="wellness" data-testid="tab-wellness">Wellness</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2">
              {filteredTopics.length > 0 ? (
                filteredTopics.map((topic) => (
                  <TopicCard 
                    key={topic.id} 
                    topic={topic} 
                    onSelect={() => setSelectedTopic(topic)} 
                  />
                ))
              ) : (
                <div className="col-span-2 text-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-1">No topics found</h3>
                  <p className="text-sm text-muted-foreground">
                    Try a different search term or category
                  </p>
                </div>
              )}
            </div>
          </div>

          <FAQSection />

          <Dialog open={!!selectedTopic} onOpenChange={() => setSelectedTopic(null)}>
            <DialogContent className="max-w-lg">
              {selectedTopic && (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${categoryInfo[selectedTopic.category].color}`}>
                        <selectedTopic.icon className="h-5 w-5" />
                      </div>
                      <Badge variant="secondary">
                        {categoryInfo[selectedTopic.category].label}
                      </Badge>
                    </div>
                    <DialogTitle>{selectedTopic.title}</DialogTitle>
                    <DialogDescription>{selectedTopic.description}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed">{selectedTopic.content}</p>
                    
                    <div>
                      <h4 className="text-sm font-medium mb-2">Related Terms</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTopic.relatedTerms.map((relatedTerm) => (
                          <Badge key={relatedTerm} variant="outline">
                            {relatedTerm}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      This information is for educational purposes only and should not replace medical advice from your healthcare provider.
                    </p>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
