import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  User,
  Users,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Shield,
  FileText,
  ArrowRight,
  GitMerge,
  Fingerprint,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PendingMatch {
  id: string;
  similarityScore: number;
  matchType: "deterministic" | "probabilistic";
  matchDetails: {
    firstNameScore: number;
    lastNameScore: number;
    dobMatch: boolean;
    emailMatch: boolean;
    addressScore: number;
    phoneMatch: boolean;
  };
  existingRecord: PatientRecord;
  newRecord: PatientRecord;
  whyMatched: string[];
  createdAt: string;
}

interface PatientRecord {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  email?: string;
  phoneNumber?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  sourceFacility?: string;
  sourceSystem?: string;
}

export default function PatientMatchReview() {
  const { toast } = useToast();
  const [selectedMatch, setSelectedMatch] = useState<PendingMatch | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const { data: pendingMatches, isLoading } = useQuery<{ success: boolean; data: PendingMatch[] }>({
    queryKey: ["/api/deduplication/patient-pending-reviews"],
  });

  const confirmMergeMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", "/api/deduplication/patient-confirm-merge", { matchId, confirmed: true });
    },
    onSuccess: () => {
      toast({
        title: "Records merged",
        description: "Your health records have been successfully consolidated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/patient-pending-reviews"] });
      setConfirmDialogOpen(false);
      setSelectedMatch(null);
    },
    onError: () => {
      toast({
        title: "Merge failed",
        description: "Unable to merge records. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMergeMutation = useMutation({
    mutationFn: async (matchId: string) => {
      return apiRequest("POST", "/api/deduplication/patient-confirm-merge", { matchId, confirmed: false });
    },
    onSuccess: () => {
      toast({
        title: "Match rejected",
        description: "These records will be kept separate.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/patient-pending-reviews"] });
      setRejectDialogOpen(false);
      setSelectedMatch(null);
    },
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCards(newExpanded);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 95) return "text-green-600 dark:text-green-400";
    if (score >= 90) return "text-yellow-600 dark:text-yellow-400";
    return "text-orange-600 dark:text-orange-400";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderRecordCard = (record: PatientRecord, label: string, variant: "existing" | "new") => (
    <Card className={variant === "existing" ? "border-blue-200 dark:border-blue-800" : "border-green-200 dark:border-green-800"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={variant === "existing" ? "secondary" : "default"}>
            {label}
          </Badge>
          {record.sourceFacility && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {record.sourceFacility}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {record.firstName} {record.middleName || ""} {record.lastName}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatDate(record.dateOfBirth)}</span>
        </div>

        {record.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{record.email}</span>
          </div>
        )}

        {record.phoneNumber && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{record.phoneNumber}</span>
          </div>
        )}

        {record.addressLine1 && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {record.addressLine1}{record.city ? `, ${record.city}` : ""}{record.state ? `, ${record.state}` : ""} {record.zipCode || ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const matches = pendingMatches?.data || [];

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Is This You?</h1>
        <p className="text-muted-foreground">
          We found records that may belong to you. Please review and confirm to consolidate your health history.
        </p>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
            <p className="text-muted-foreground text-center max-w-md">
              You have no pending record matches to review. Your health records are consolidated.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Privacy Protected</AlertTitle>
            <AlertDescription>
              Only you can confirm whether these records belong to you. Your decision is private and secure.
            </AlertDescription>
          </Alert>

          {matches.map((match) => (
            <Card key={match.id} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover-elevate"
                onClick={() => toggleExpanded(match.id)}
                data-testid={`card-match-${match.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {match.existingRecord.firstName} {match.existingRecord.lastName}
                      </CardTitle>
                      <CardDescription>
                        DOB: {formatDate(match.existingRecord.dateOfBirth)}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getConfidenceColor(match.similarityScore)}`}>
                        {match.similarityScore.toFixed(0)}% Match
                      </div>
                      <Progress value={match.similarityScore} className="w-24 h-2" />
                    </div>
                    {expandedCards.has(match.id) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedCards.has(match.id) && (
                <>
                  <Separator />
                  <CardContent className="pt-6">
                    <div className="mb-6">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Fingerprint className="h-4 w-4" />
                        Why we think these are the same person:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {match.whyMatched.map((reason, idx) => (
                          <Badge key={idx} variant="outline">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      {renderRecordCard(match.existingRecord, "Existing Record", "existing")}
                      {renderRecordCard(match.newRecord, "New Record", "new")}
                    </div>

                    <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                      <ArrowRight className="h-5 w-5" />
                      <GitMerge className="h-5 w-5" />
                      <span className="text-sm">Merge into single unified record</span>
                    </div>
                  </CardContent>

                  <CardFooter className="flex justify-end gap-3 bg-muted/50">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedMatch(match);
                        setRejectDialogOpen(true);
                      }}
                      data-testid={`button-reject-${match.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Not Me
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedMatch(match);
                        setConfirmDialogOpen(true);
                      }}
                      data-testid={`button-confirm-${match.id}`}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Yes, This Is Me
                    </Button>
                  </CardFooter>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Confirm Record Merge
            </DialogTitle>
            <DialogDescription>
              By confirming, these records will be merged into your unified health history. 
              This helps ensure doctors see your complete medical picture.
            </DialogDescription>
          </DialogHeader>
          
          {selectedMatch && (
            <div className="py-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>What happens next?</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Both records will be linked to your profile</li>
                    <li>Your medical timeline will show data from both sources</li>
                    <li>Original data is preserved (never deleted)</li>
                    <li>An audit trail records this merge for compliance</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedMatch && confirmMergeMutation.mutate(selectedMatch.id)}
              disabled={confirmMergeMutation.isPending}
              data-testid="button-confirm-merge"
            >
              {confirmMergeMutation.isPending ? "Merging..." : "Confirm Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-orange-500" />
              Keep Records Separate?
            </DialogTitle>
            <DialogDescription>
              If you're sure this record doesn't belong to you, we'll keep them separate.
              This helps prevent incorrect data from appearing in your health history.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert variant="default">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Before you decide</AlertTitle>
              <AlertDescription className="text-sm">
                Sometimes records look different due to:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Name changes (marriage, legal changes)</li>
                  <li>Old addresses or phone numbers</li>
                  <li>Data entry typos at a facility</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Go Back
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedMatch && rejectMergeMutation.mutate(selectedMatch.id)}
              disabled={rejectMergeMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMergeMutation.isPending ? "Processing..." : "Not My Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <Clock className="h-4 w-4" />
          Your review decisions are logged for SOC2/HITRUST compliance
        </p>
      </div>
    </div>
  );
}
