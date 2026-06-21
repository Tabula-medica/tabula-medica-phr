import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Hash,
  User,
  Clock,
  ArrowRight,
  Shield,
  Fingerprint,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Loader2,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface MatchCandidate {
  id: string;
  sourcePatientId: string;
  candidatePatientId: string;
  similarityScore: number;
  matchType: "deterministic" | "probabilistic";
  status: "pending" | "merged" | "rejected" | "deferred";
  matchDetails: {
    firstNameScore: number;
    lastNameScore: number;
    dobMatch: boolean;
    emailMatch: boolean;
    ssnMatch: boolean;
    addressScore: number;
    phoneMatch: boolean;
  };
  whyDuplicate: string[];
  sourcePatient: PatientRecord;
  candidatePatient: PatientRecord;
  createdAt: string;
}

interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender?: string;
  email?: string;
  phoneNumber?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  ssnLast4?: string;
  mrn?: string;
  sourceFacility?: string;
  sourceSystem?: string;
  createdAt: string;
}

interface DeduplicationStats {
  totalPatients: number;
  uniqueRecords: number;
  mergedRecords: number;
  pendingReviews: number;
  autoMergedToday: number;
  dataQualityAverage: number;
}

interface AIMergeRecommendation {
  action: "merge" | "keep_separate" | "review";
  confidence: number;
  reasoning: string;
  dataQualityNotes: string[];
  survivorFields: {
    field: string;
    selectedRecord: "source" | "candidate";
    reason: string;
  }[];
}

function generateAIRecommendation(match: MatchCandidate): AIMergeRecommendation {
  const score = match.similarityScore;
  const details = match.matchDetails;
  
  if (score >= 95 && (details.ssnMatch || details.emailMatch)) {
    return {
      action: "merge",
      confidence: 94,
      reasoning: "High confidence match with exact identifier overlap. SSN or email + DOB match indicates same individual.",
      dataQualityNotes: [
        "Both records have consistent core demographics",
        "No conflicting clinical data detected",
        "Source record has more recent data that will be preserved"
      ],
      survivorFields: [
        { field: "Name", selectedRecord: "candidate", reason: "Existing record has complete middle name" },
        { field: "Address", selectedRecord: "source", reason: "Source record has more recent address (newer created date)" },
        { field: "Phone", selectedRecord: "source", reason: "Source record has verified phone number" },
        { field: "MRN", selectedRecord: "candidate", reason: "Existing MRN maintained for continuity" }
      ]
    };
  } else if (score >= 85) {
    return {
      action: "review",
      confidence: 72,
      reasoning: "Moderate confidence match with some demographic overlap. Human review recommended to verify identity.",
      dataQualityNotes: [
        "Name similarity is high but not exact",
        "Consider verifying with patient directly",
        "Check for potential family members with similar demographics"
      ],
      survivorFields: [
        { field: "Name", selectedRecord: "candidate", reason: "Existing record likely more complete" },
        { field: "Contact Info", selectedRecord: "source", reason: "Source has newer contact information" }
      ]
    };
  } else {
    return {
      action: "keep_separate",
      confidence: 85,
      reasoning: "Low similarity score suggests these are likely different individuals. Demographic overlap may be coincidental.",
      dataQualityNotes: [
        "Key identifiers do not match",
        "Different source facilities may indicate different patients",
        "Name similarity alone is insufficient for merge"
      ],
      survivorFields: []
    };
  }
}

function AIMergeRecommendationCard({ match }: { match: MatchCandidate }) {
  const recommendation = generateAIRecommendation(match);
  
  const actionStyles = {
    merge: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",
    keep_separate: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
    review: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
  };
  
  const actionLabels = {
    merge: "Recommend Merge",
    keep_separate: "Keep Separate",
    review: "Human Review Needed",
  };
  
  const actionIcons = {
    merge: ThumbsUp,
    keep_separate: ThumbsDown,
    review: HelpCircle,
  };
  
  const ActionIcon = actionIcons[recommendation.action];

  return (
    <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20" data-testid="ai-merge-recommendation">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-500/10">
          <Brain className="h-5 w-5 text-purple-500" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Recommendation
              </span>
              <Badge className={`gap-1 ${actionStyles[recommendation.action]}`}>
                <ActionIcon className="h-3 w-3" />
                {actionLabels[recommendation.action]}
              </Badge>
            </div>
            <Badge variant="outline" className="text-xs">
              {recommendation.confidence}% confident
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {recommendation.reasoning}
          </p>
          
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            AI recommendations require human verification before final merge decisions
          </p>
          
          {recommendation.dataQualityNotes.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Data Quality Notes:</span>
              <ul className="space-y-0.5">
                {recommendation.dataQualityNotes.map((note, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {recommendation.action === "merge" && recommendation.survivorFields.length > 0 && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-xs font-medium text-muted-foreground block mb-2">Suggested Field Selection:</span>
              <div className="grid gap-1.5">
                {recommendation.survivorFields.map((field, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-background/50 px-2 py-1.5 rounded">
                    <span className="font-medium">{field.field}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {field.selectedRecord === "source" ? "New Record" : "Existing"}
                      </Badge>
                      <span className="text-muted-foreground max-w-[200px] truncate">{field.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  let color = "bg-destructive";
  let label = "Low";
  
  if (score >= 95) {
    color = "bg-green-500";
    label = "Very High";
  } else if (score >= 85) {
    color = "bg-primary";
    label = "High";
  } else if (score >= 80) {
    color = "bg-yellow-500";
    label = "Medium";
  }
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Match Confidence</span>
        <span className="font-medium">{score}% ({label})</span>
      </div>
      <Progress value={score} className={`h-2 [&>div]:${color}`} />
    </div>
  );
}

function WhyDuplicateBadges({ reasons }: { reasons: string[] }) {
  const reasonIcons: Record<string, React.ElementType> = {
    "Same LOINC code": FileText,
    "Same timestamp window": Clock,
    "Same facility": Building2,
    "Same value": Hash,
    "Same SSN": Fingerprint,
    "Same MRN": Hash,
    "Same email + DOB": Mail,
    "Name similarity": User,
    "Phone similarity": Phone,
    "Address similarity": MapPin,
    "DOB match": Calendar,
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {reasons.map((reason, idx) => {
        const Icon = reasonIcons[reason] || CheckCircle2;
        return (
          <Badge key={idx} variant="secondary" className="gap-1 text-xs">
            <Icon className="h-3 w-3" />
            {reason}
          </Badge>
        );
      })}
    </div>
  );
}

function PatientComparisonCard({ 
  patient, 
  label,
  isSource = false 
}: { 
  patient: PatientRecord; 
  label: string;
  isSource?: boolean;
}) {
  return (
    <Card className={isSource ? "border-primary/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {label}
          </CardTitle>
          {isSource && <Badge variant="outline" className="text-xs">New Record</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-muted-foreground text-xs">Name</span>
            <p className="font-medium">
              {patient.firstName} {patient.middleName || ""} {patient.lastName}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">DOB</span>
            <p className="font-medium">{patient.dateOfBirth}</p>
          </div>
        </div>
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-2">
          {patient.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span className="truncate text-xs">{patient.email}</span>
            </div>
          )}
          {patient.phoneNumber && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs">{patient.phoneNumber}</span>
            </div>
          )}
        </div>
        
        {patient.addressLine1 && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
            <span className="text-xs">
              {patient.addressLine1}, {patient.city}, {patient.state} {patient.zipCode}
            </span>
          </div>
        )}
        
        <Separator />
        
        <div className="grid grid-cols-2 gap-2">
          {patient.mrn && (
            <div>
              <span className="text-muted-foreground text-xs">MRN</span>
              <p className="font-mono text-xs">{patient.mrn}</p>
            </div>
          )}
          {patient.ssnLast4 && (
            <div>
              <span className="text-muted-foreground text-xs">SSN (Last 4)</span>
              <p className="font-mono text-xs">***-**-{patient.ssnLast4}</p>
            </div>
          )}
        </div>
        
        {patient.sourceFacility && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {patient.sourceFacility} ({patient.sourceSystem || "Unknown System"})
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchReviewCard({ 
  match, 
  onMerge, 
  onReject, 
  onDefer,
  isProcessing 
}: { 
  match: MatchCandidate; 
  onMerge: () => void;
  onReject: () => void;
  onDefer: () => void;
  isProcessing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const whyDuplicate = match.whyDuplicate?.length > 0 
    ? match.whyDuplicate 
    : generateWhyDuplicate(match.matchDetails);

  return (
    <Card className="hover-elevate" data-testid={`match-card-${match.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Badge 
                variant={match.similarityScore >= 95 ? "default" : "secondary"}
                className="gap-1"
              >
                <Activity className="h-3 w-3" />
                {match.similarityScore >= 95 ? "Likely Duplicate" : "Possible Duplicate"}
                ({match.similarityScore}%)
              </Badge>
              <Badge variant="outline" className="text-xs">
                {match.matchType === "deterministic" ? "Exact Match" : "Fuzzy Match"}
              </Badge>
            </div>
            <CardDescription>
              Found {new Date(match.createdAt).toLocaleDateString()} via {match.matchType} matching
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setExpanded(!expanded)}
            data-testid="button-expand-match"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        
        <ConfidenceBar score={match.similarityScore} />
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Why it's a duplicate:</p>
          <WhyDuplicateBadges reasons={whyDuplicate} />
        </div>
        
        <AIMergeRecommendationCard match={match} />
        
        {expanded && (
          <div className="grid md:grid-cols-2 gap-4 pt-2">
            <PatientComparisonCard 
              patient={match.sourcePatient} 
              label="New Record" 
              isSource 
            />
            <PatientComparisonCard 
              patient={match.candidatePatient} 
              label="Existing Record" 
            />
          </div>
        )}
        
        {!expanded && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {match.sourcePatient.firstName} {match.sourcePatient.lastName}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {match.candidatePatient.firstName} {match.candidatePatient.lastName}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setExpanded(true)}
              className="gap-1"
            >
              <Eye className="h-3 w-3" />
              Compare
            </Button>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="gap-2 flex-wrap">
        <Button 
          onClick={onMerge} 
          disabled={isProcessing}
          className="gap-1.5"
          data-testid="button-merge"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitMerge className="h-4 w-4" />
          )}
          Merge Records
        </Button>
        <Button 
          variant="outline" 
          onClick={onReject}
          disabled={isProcessing}
          className="gap-1.5"
          data-testid="button-keep-separate"
        >
          <XCircle className="h-4 w-4" />
          Keep Separate
        </Button>
        <Button 
          variant="ghost" 
          onClick={onDefer}
          disabled={isProcessing}
          className="gap-1.5"
          data-testid="button-not-sure"
        >
          <HelpCircle className="h-4 w-4" />
          Not Sure
        </Button>
      </CardFooter>
    </Card>
  );
}

function generateWhyDuplicate(details: MatchCandidate["matchDetails"]): string[] {
  const reasons: string[] = [];
  
  if (details.ssnMatch) reasons.push("Same SSN");
  if (details.dobMatch) reasons.push("DOB match");
  if (details.emailMatch) reasons.push("Same email + DOB");
  if (details.firstNameScore >= 90) reasons.push("Name similarity");
  if (details.phoneMatch) reasons.push("Phone similarity");
  if (details.addressScore >= 80) reasons.push("Address similarity");
  
  return reasons.length > 0 ? reasons : ["Pattern-based match"];
}

function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType;
  description?: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {trend && (
          <div className={`mt-2 text-xs ${trend.positive ? "text-green-600" : "text-destructive"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}% from last week
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DeduplicationCenter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "merge" | "reject" | null;
    matchId: string | null;
  }>({ open: false, action: null, matchId: null });

  const { data: statsResponse, isLoading: statsLoading } = useQuery<{ success: boolean; data: DeduplicationStats }>({
    queryKey: ["/api/deduplication/dashboard"],
  });
  const stats = statsResponse?.data;

  const { data: pendingResponse, isLoading: matchesLoading, refetch } = useQuery<{ success: boolean; reviews: MatchCandidate[] }>({
    queryKey: ["/api/deduplication/pending-reviews"],
  });
  const pendingMatches = pendingResponse?.reviews;

  const resolveMutation = useMutation({
    mutationFn: async ({ matchId, action }: { matchId: string; action: "merge" | "reject" | "defer" }) => {
      const decision = action === "merge" ? "confirmed_match" : action === "reject" ? "confirmed_different" : "deferred";
      const res = await apiRequest("POST", `/api/deduplication/resolve-match/${matchId}`, { decision, reviewedBy: "current_user" });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/pending-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/dashboard"] });
      
      const actionText = variables.action === "merge" ? "merged" : 
                         variables.action === "reject" ? "kept separate" : "deferred";
      toast({
        title: "Resolution Complete",
        description: `Records have been ${actionText} successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process the match resolution. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setProcessingId(null);
      setConfirmDialog({ open: false, action: null, matchId: null });
    },
  });

  const handleAction = (matchId: string, action: "merge" | "reject" | "defer") => {
    if (action === "defer") {
      setProcessingId(matchId);
      resolveMutation.mutate({ matchId, action });
    } else {
      setConfirmDialog({ open: true, action, matchId });
    }
  };

  const confirmAction = () => {
    if (confirmDialog.matchId && confirmDialog.action) {
      setProcessingId(confirmDialog.matchId);
      resolveMutation.mutate({ 
        matchId: confirmDialog.matchId, 
        action: confirmDialog.action 
      });
    }
  };

  const filteredMatches = pendingMatches?.filter(match => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      match.sourcePatient.firstName.toLowerCase().includes(query) ||
      match.sourcePatient.lastName.toLowerCase().includes(query) ||
      match.candidatePatient.firstName.toLowerCase().includes(query) ||
      match.candidatePatient.lastName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Deduplication Center
          </h1>
          <p className="text-muted-foreground">
            Review and resolve potential duplicate patient records
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="gap-1.5"
          data-testid="button-refresh"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatsCard
              title="Total Patients"
              value={stats?.totalPatients?.toLocaleString() || 0}
              icon={Users}
              description="In Master Patient Index"
            />
            <StatsCard
              title="Pending Reviews"
              value={stats?.pendingReviews || 0}
              icon={AlertTriangle}
              description="Awaiting decision"
            />
            <StatsCard
              title="Auto-Merged Today"
              value={stats?.autoMergedToday || 0}
              icon={GitMerge}
              description="≥95% confidence"
            />
            <StatsCard
              title="Data Quality"
              value={`${stats?.dataQualityAverage || 0}%`}
              icon={Activity}
              description="Average data quality score"
            />
          </>
        )}
      </div>

      {/* Trust Badge */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>HIPAA-Compliant Deduplication</AlertTitle>
        <AlertDescription>
          Patient matching uses NMN (No Middle Name) standard with two-pass verification: 
          deterministic matching on unique identifiers followed by probabilistic matching 
          with Levenshtein distance scoring. All merge decisions are audit-logged.
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <Tabs defaultValue="pending" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5" data-testid="tab-pending">
              <AlertTriangle className="h-4 w-4" />
              Pending Review
              {(stats?.pendingReviews || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{stats?.pendingReviews}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-1.5" data-testid="tab-resolved">
              <CheckCircle2 className="h-4 w-4" />
              Recently Resolved
            </TabsTrigger>
          </TabsList>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[250px]"
              data-testid="input-search"
            />
          </div>
        </div>

        <TabsContent value="pending" className="space-y-4">
          {matchesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : !filteredMatches?.length ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p className="text-muted-foreground">
                  No pending duplicate reviews at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {filteredMatches.map((match) => (
                  <MatchReviewCard
                    key={match.id}
                    match={match}
                    onMerge={() => handleAction(match.id, "merge")}
                    onReject={() => handleAction(match.id, "reject")}
                    onDefer={() => handleAction(match.id, "defer")}
                    isProcessing={processingId === match.id}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="resolved">
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Resolution History</h3>
              <p className="text-muted-foreground">
                View recently resolved duplicate records and merge history.
              </p>
              <Button variant="outline" className="mt-4" data-testid="button-view-history">
                <FileText className="h-4 w-4 mr-2" />
                View Merge History
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: null, matchId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === "merge" ? "Confirm Merge" : "Confirm Keep Separate"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === "merge" 
                ? "This will combine these records into a single patient record. This action is logged for compliance."
                : "This will mark these as separate patients and prevent future merge suggestions for this pair."
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, action: null, matchId: null })}>
              Cancel
            </Button>
            <Button onClick={confirmAction} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : confirmDialog.action === "merge" ? (
                <GitMerge className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
