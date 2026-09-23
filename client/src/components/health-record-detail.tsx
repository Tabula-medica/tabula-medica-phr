import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Info,
  MapPin,
  Building2,
  Calendar,
  User,
  Share2,
  Bookmark,
  BookmarkCheck,
  Copy,
  Check,
  ChevronRight,
  Loader2,
  Sparkles,
  FileText,
  Link2,
  ExternalLink,
  Clock,
  Shield,
  Code
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";

interface KeyValueItem {
  label: string;
  value: string;
  unit?: string;
  status?: "normal" | "abnormal" | "critical";
  referenceRange?: string;
  isExplainable?: boolean;
}

interface ProvenanceInfo {
  source: string;
  facility: string;
  recordedDate: string;
  provider?: string;
  ehrPlatform?: string;
  platformColor?: string;
  originalId?: string;
  recordType?: string;
  fetchedTime?: string;
  confidenceScore?: number;
  rawSourceAvailable?: boolean;
}

interface HealthRecordDetailProps {
  title: string;
  type: string;
  date: string;
  keyValues: KeyValueItem[];
  provenance: ProvenanceInfo;
  description?: string;
  onSave?: () => void;
  onShare?: () => void;
  isSaved?: boolean;
}

function KeyValueRow({ item, onExplain }: { item: KeyValueItem; onExplain: (term: string) => void }) {
  const statusColors = {
    normal: "text-foreground",
    abnormal: "text-yellow-600 dark:text-yellow-400",
    critical: "text-destructive",
  };

  const statusBadgeVariants: Record<string, "secondary" | "outline" | "destructive"> = {
    normal: "secondary",
    abnormal: "outline",
    critical: "destructive",
  };

  return (
    <div className="flex items-center justify-between py-3 gap-3" data-testid={`row-keyvalue-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">{item.label}</span>
          {item.isExplainable && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => onExplain(item.label)}
              data-testid={`button-explain-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Info className="h-3 w-3" />
              Explain
            </Button>
          )}
        </div>
        {item.referenceRange && (
          <span className="text-xs text-muted-foreground block mt-0.5">
            Range: {item.referenceRange}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-semibold text-sm ${item.status ? statusColors[item.status] : ''}`}>
          {item.value}
          {item.unit && <span className="text-muted-foreground font-normal ml-1">{item.unit}</span>}
        </span>
        {item.status && item.status !== "normal" && (
          <Badge variant={statusBadgeVariants[item.status]} data-testid={`badge-status-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
            {item.status === "critical" ? "Critical" : "Abnormal"}
          </Badge>
        )}
      </div>
    </div>
  );
}

function ProvenanceRow({ provenance, onViewFull }: { provenance: ProvenanceInfo; onViewFull: () => void }) {
  return (
    <div 
      className="flex items-center justify-between py-3 cursor-pointer hover-elevate rounded-lg px-2 -mx-2" 
      {...clickable(onViewFull)}
      data-testid="row-provenance"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <Link2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">View Provenance</p>
          <p className="text-xs text-muted-foreground">
            {provenance.facility} via {provenance.source}
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function ActionRow({ 
  onSave, 
  onShare, 
  isSaved 
}: { 
  onSave: () => void; 
  onShare: () => void; 
  isSaved: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-2" data-testid="row-actions">
      <Button
        variant={isSaved ? "secondary" : "outline"}
        className="flex-1 gap-2"
        onClick={onSave}
        data-testid="button-save-record"
      >
        {isSaved ? (
          <>
            <BookmarkCheck className="h-4 w-4" />
            Saved
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" />
            Save
          </>
        )}
      </Button>
      <Button
        variant="outline"
        className="flex-1 gap-2"
        onClick={onShare}
        data-testid="button-share-record"
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
    </div>
  );
}

function ConfidenceMeter({ score }: { score: number }) {
  const getConfidenceLabel = (s: number) => {
    if (s >= 90) return { label: "High", color: "text-green-600 dark:text-green-400" };
    if (s >= 70) return { label: "Good", color: "text-primary" };
    if (s >= 50) return { label: "Moderate", color: "text-yellow-600 dark:text-yellow-400" };
    return { label: "Low", color: "text-orange-600 dark:text-orange-400" };
  };

  const { label, color } = getConfidenceLabel(score);

  return (
    <div className="space-y-1.5" data-testid="confidence-meter">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Data Confidence</span>
        </div>
        <span className={`text-xs font-medium ${color}`}>{label} ({score}%)</span>
      </div>
      <Progress value={score} className="h-1.5" />
    </div>
  );
}

function SourceListItem({ provenance }: { provenance: ProvenanceInfo }) {
  return (
    <Card data-testid="source-list-item">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div 
            className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
            style={{ backgroundColor: `${provenance.platformColor || '#666'}20` }}
          >
            <div 
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: provenance.platformColor || '#666' }}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium" data-testid="text-source-name">
                {provenance.ehrPlatform || provenance.source}
              </p>
              {provenance.recordType && (
                <Badge variant="outline" data-testid="badge-record-type">
                  {provenance.recordType}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="text-facility-name">
              {provenance.facility}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {provenance.originalId && (
                <span className="font-mono truncate max-w-[150px]" title={provenance.originalId} data-testid="text-record-id">
                  ID: {provenance.originalId.slice(0, 12)}...
                </span>
              )}
              {provenance.fetchedTime && (
                <span className="flex items-center gap-1" data-testid="text-fetched-time">
                  <Clock className="h-3 w-3" />
                  Fetched {provenance.fetchedTime}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProvenanceSheet({ 
  provenance, 
  open, 
  onOpenChange 
}: { 
  provenance: ProvenanceInfo; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyId = () => {
    if (provenance.originalId) {
      navigator.clipboard.writeText(provenance.originalId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "Record ID copied to clipboard",
      });
    }
  };

  const handleViewRawSource = () => {
    toast({
      title: "Raw Source",
      description: "Opening raw FHIR resource data...",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl overflow-auto" data-testid="sheet-provenance">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <Link2 className="h-5 w-5 text-primary" />
            Data Provenance
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This record was imported from your connected health sources. Below are the details about its origin.
          </p>
          
          <SourceListItem provenance={provenance} />
          
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid gap-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm">{provenance.facility}</p>
                    <p className="text-xs text-muted-foreground">Healthcare Facility</p>
                  </div>
                </div>
                
                {provenance.provider && (
                  <div className="flex items-start gap-3 flex-wrap">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm">{provenance.provider}</p>
                      <p className="text-xs text-muted-foreground">Provider</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3 flex-wrap">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm">{provenance.recordedDate}</p>
                    <p className="text-xs text-muted-foreground">Recorded Date</p>
                  </div>
                </div>
                
                {provenance.originalId && (
                  <div className="flex items-start gap-3 flex-wrap">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-mono truncate max-w-[200px]">{provenance.originalId}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyId}
                          data-testid="button-copy-record-id"
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Original Record ID</p>
                    </div>
                  </div>
                )}
              </div>
              
              {provenance.confidenceScore !== undefined && (
                <>
                  <Separator />
                  <ConfidenceMeter score={provenance.confidenceScore} />
                </>
              )}
            </CardContent>
          </Card>
          
          {provenance.rawSourceAvailable !== false && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleViewRawSource}
              data-testid="button-view-raw-source"
            >
              <Code className="h-4 w-4" />
              View Raw Source
            </Button>
          )}
          
          <p className="text-xs text-muted-foreground text-center">
            Data provenance tracking ensures you always know where your health information comes from.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExplanationSheet({ 
  term, 
  open, 
  onOpenChange 
}: { 
  term: string; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [explanation, setExplanation] = useState<{
    plain: string;
    measures?: string;
    range?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = async () => {
    if (!term) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("POST", "/api/explain", { term });
      const data = await response.json();
      setExplanation({
        plain: data.explanation || data.plainEnglish || `${term} is a medical measurement used by healthcare providers to assess your health.`,
        measures: data.whatItMeasures,
        range: data.normalRange,
      });
    } catch (err) {
      setExplanation({
        plain: getDefaultExplanation(term),
        measures: undefined,
        range: undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultExplanation = (t: string): string => {
    const defaults: Record<string, string> = {
      "LDL": "LDL (Low-Density Lipoprotein) is often called 'bad' cholesterol. Higher levels can lead to buildup in your arteries, increasing heart disease risk.",
      "HDL": "HDL (High-Density Lipoprotein) is 'good' cholesterol. It helps remove other forms of cholesterol from your bloodstream.",
      "Triglycerides": "Triglycerides are a type of fat in your blood. High levels can increase your risk of heart disease.",
      "A1C": "A1C (Hemoglobin A1C) shows your average blood sugar over 2-3 months. It's used to diagnose and monitor diabetes.",
      "Glucose": "Glucose is blood sugar, your body's main source of energy. Abnormal levels may indicate diabetes or other conditions.",
      "Creatinine": "Creatinine is a waste product filtered by your kidneys. Levels indicate how well your kidneys are working.",
      "eGFR": "eGFR (estimated Glomerular Filtration Rate) measures kidney function. Lower values may indicate kidney disease.",
      "TSH": "TSH (Thyroid Stimulating Hormone) helps control thyroid function. Abnormal levels may indicate thyroid problems.",
      "WBC": "WBC (White Blood Cells) fight infection. High levels may indicate infection; low levels may mean immune issues.",
      "RBC": "RBC (Red Blood Cells) carry oxygen through your body. Abnormal levels can indicate anemia or other conditions.",
      "Hemoglobin": "Hemoglobin is the protein in red blood cells that carries oxygen. Low levels indicate anemia.",
      "Platelets": "Platelets help your blood clot. Low levels increase bleeding risk; high levels can cause clotting problems.",
    };
    return defaults[t] || `${t} is a medical term or measurement. Ask your healthcare provider for more details about what this means for your health.`;
  };

  useEffect(() => {
    if (open && term) {
      fetchExplanation();
    }
  }, [open, term]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[50vh] rounded-t-xl" data-testid="sheet-explanation">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-5 w-5 text-primary" />
            What is "{term}"?
          </SheetTitle>
        </SheetHeader>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Getting explanation...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchExplanation}>
              Try Again
            </Button>
          </div>
        ) : explanation ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm leading-relaxed">{explanation.plain}</p>
              </CardContent>
            </Card>
            
            {explanation.measures && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  What It Measures
                </h4>
                <p className="text-sm">{explanation.measures}</p>
              </div>
            )}
            
            {explanation.range && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Normal Range
                </h4>
                <p className="text-sm">{explanation.range}</p>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground italic text-center pt-2">
              This is general health information only. Always consult your healthcare provider for personalized advice.
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function HealthRecordDetail({
  title,
  type,
  date,
  keyValues,
  provenance,
  description,
  onSave,
  onShare,
  isSaved = false,
}: HealthRecordDetailProps) {
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [explainTerm, setExplainTerm] = useState<string | null>(null);
  const [saved, setSaved] = useState(isSaved);
  const { toast } = useToast();

  const handleSave = () => {
    setSaved(!saved);
    onSave?.();
    toast({
      title: saved ? "Removed from saved" : "Saved",
      description: saved ? "Record removed from your saved items" : "Record saved to your collection",
    });
  };

  const handleShare = () => {
    onShare?.();
    toast({
      title: "Share Options",
      description: "Choose how you'd like to share this record",
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="space-y-4" data-testid="health-record-detail">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" data-testid="badge-record-type">{type}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
        </div>
        <h2 className="text-lg font-semibold" data-testid="text-record-title">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground" data-testid="text-record-description">
            {description}
          </p>
        )}
      </div>
      
      <Separator />
      
      <div className="divide-y" data-testid="keyvalue-list">
        {keyValues.map((item, index) => (
          <KeyValueRow 
            key={`${item.label}-${index}`} 
            item={item} 
            onExplain={setExplainTerm}
          />
        ))}
      </div>
      
      <Separator />
      
      <ProvenanceRow 
        provenance={provenance} 
        onViewFull={() => setProvenanceOpen(true)} 
      />
      
      <Separator />
      
      <ActionRow 
        onSave={handleSave} 
        onShare={handleShare} 
        isSaved={saved} 
      />
      
      <ProvenanceSheet 
        provenance={provenance} 
        open={provenanceOpen} 
        onOpenChange={setProvenanceOpen} 
      />
      
      <ExplanationSheet
        term={explainTerm || ""}
        open={!!explainTerm}
        onOpenChange={(open) => !open && setExplainTerm(null)}
      />
    </div>
  );
}

export type { KeyValueItem, ProvenanceInfo, HealthRecordDetailProps };
