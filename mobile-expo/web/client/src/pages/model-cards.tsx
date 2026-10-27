import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, Mic, Search, Shield, Settings, CheckCircle2, AlertTriangle, Info, ExternalLink
} from "lucide-react";

interface ModelCard {
  id: string;
  featureName: string;
  featureCategory: "clinical" | "administrative" | "voice" | "search" | "safety";
  description: string;
  models: { name: string; provider: string; version?: string; baaStatus: string }[];
  dataInput: {
    description: string;
    containsPHI: boolean;
    deidentificationApplied: boolean;
    dataTypes: string[];
  };
  humanInTheLoop: { required: boolean; description: string; overridable: boolean };
  knownLimitations: string[];
  outputDisclaimer: string;
  version: string;
  lastReviewed: string;
  regulatoryNotes?: string;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  clinical:      { label: "Clinical",       icon: <Brain className="h-3.5 w-3.5" /> },
  administrative:{ label: "Administrative", icon: <Settings className="h-3.5 w-3.5" /> },
  voice:         { label: "Voice",          icon: <Mic className="h-3.5 w-3.5" /> },
  search:        { label: "Search",         icon: <Search className="h-3.5 w-3.5" /> },
  safety:        { label: "Safety",         icon: <Shield className="h-3.5 w-3.5" /> },
};

function BaaChip({ status }: { status: string }) {
  if (status === "covered") return <Badge className="bg-green-600 text-white text-xs">BAA Covered</Badge>;
  if (status === "not_used_for_phi") return <Badge variant="secondary" className="text-xs">No PHI</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function ModelCardItem({ card }: { card: ModelCard }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{card.featureName}</CardTitle>
              <Badge variant="outline" className="text-xs gap-1">
                {CATEGORY_META[card.featureCategory]?.icon}
                {CATEGORY_META[card.featureCategory]?.label}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-xs">v{card.version} · Reviewed {new Date(card.lastReviewed).toLocaleDateString()}</CardDescription>
          </div>
        </div>
        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{card.description}</p>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Models Used</h4>
          <div className="space-y-1.5">
            {card.models.map((m) => (
              <div key={m.name} className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{m.provider}</span>
                  <BaaChip status={m.baaStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Data Input</h4>
          <p className="text-sm text-muted-foreground mb-2">{card.dataInput.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {card.dataInput.containsPHI ? (
              <Badge variant="destructive" className="text-xs">Contains PHI</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">De-identified / No PHI</Badge>
            )}
            {card.dataInput.deidentificationApplied && (
              <Badge className="bg-blue-600 text-white text-xs">De-identification Applied</Badge>
            )}
            {card.dataInput.dataTypes.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Human in the Loop</h4>
          <div className="flex items-start gap-2">
            {card.humanInTheLoop.required ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            )}
            <div>
              <span className="text-sm font-medium">
                {card.humanInTheLoop.required ? "Required" : "Optional / Informational"}
              </span>
              <p className="text-sm text-muted-foreground mt-0.5">{card.humanInTheLoop.description}</p>
            </div>
          </div>
        </div>

        {card.knownLimitations.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Known Limitations</h4>
              <ul className="space-y-1">
                {card.knownLimitations.map((lim, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    {lim}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <Separator />

        <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground italic">
          {card.outputDisclaimer}
        </div>

        {card.regulatoryNotes && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3">
            <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <span>{card.regulatoryNotes}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ModelCardsPage() {
  const { data, isLoading, error } = useQuery<{ cards: ModelCard[] }>({
    queryKey: ["/api/model-cards"],
    queryFn: async () => {
      const res = await fetch("/api/model-cards");
      if (!res.ok) throw new Error("Failed to load model cards");
      return res.json();
    },
  });

  const cards = data?.cards ?? [];
  const categories = [...new Set(cards.map((c) => c.featureCategory))];

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start gap-3">
        <Brain className="h-8 w-8 text-primary mt-0.5 shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold">AI Model Cards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Voluntary transparency documentation for every AI feature in Tabula Medica — what model is used,
            what data is processed, what human oversight is in place, and known limitations.
          </p>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10 dark:border-blue-900">
        <CardContent className="pt-4 pb-3 text-sm text-blue-800 dark:text-blue-300">
          <p>
            We publish these cards voluntarily as a trust differentiator. The HTI-5 proposed rule (Dec 2025)
            would remove the ONC certification requirement for model cards, but transparency remains a core
            Tabula Medica value and a practical guardrail for clinical teams evaluating AI-assisted workflows.
          </p>
        </CardContent>
      </Card>

      {isLoading && (
        <p className="text-muted-foreground text-sm animate-pulse text-center py-8">Loading model cards…</p>
      )}

      {error && (
        <p className="text-destructive text-sm text-center py-8">Failed to load model cards. Please try again.</p>
      )}

      {!isLoading && !error && cards.length > 0 && (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">All ({cards.length})</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="gap-1">
                {CATEGORY_META[cat]?.icon}
                {CATEGORY_META[cat]?.label} ({cards.filter((c) => c.featureCategory === cat).length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-4 mt-4">
            {cards.map((card) => <ModelCardItem key={card.id} card={card} />)}
          </TabsContent>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
              {cards.filter((c) => c.featureCategory === cat).map((card) => (
                <ModelCardItem key={card.id} card={card} />
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <div className="text-xs text-muted-foreground border-t pt-4 flex items-center gap-1">
        <ExternalLink className="h-3.5 w-3.5" />
        <span>Questions about AI governance: </span>
        <a href="mailto:ai-governance@tabulamedica.health" className="underline underline-offset-2">
          ai-governance@tabulamedica.health
        </a>
      </div>
    </div>
  );
}
