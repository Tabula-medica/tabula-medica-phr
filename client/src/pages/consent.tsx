import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Heart,
  Shield,
  Lock,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronRight,
  AlertCircle,
  Clock,
  Scale,
  ShieldCheck,
  Scroll,
  FlaskConical,
  Mail,
} from "lucide-react";

interface ConsentDocument {
  id: string;
  type: string;
  version: string;
  title: string;
  summary: string;
  content: string;
  effectiveDate: string;
  isRequired: boolean;
  isActive: boolean;
}

const documentIcons: Record<string, React.ElementType> = {
  privacy_policy: Shield,
  terms_of_service: Scale,
  hipaa_notice: ShieldCheck,
  data_processing_agreement: Lock,
  research_consent: FlaskConical,
  marketing_consent: Mail,
};

export default function Consent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [acceptedDocuments, setAcceptedDocuments] = useState<Set<string>>(new Set());
  const [expandedDocument, setExpandedDocument] = useState<ConsentDocument | null>(null);

  const { data: documents = [], isLoading } = useQuery<ConsentDocument[]>({
    queryKey: ["/api/consent/documents/active"],
  });

  const { data: consentStatus } = useQuery({
    queryKey: ["/api/consent/status"],
  });

  const acceptBatchMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      return apiRequest("POST", "/api/consent/accept-batch", {
        documentIds,
        method: "click",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consent/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Preferences saved",
        description: "Your consent preferences have been recorded with timestamps and versions.",
      });
      const hasCompletedSetup = localStorage.getItem("tabula_setup_complete");
      setLocation(hasCompletedSetup ? "/timeline" : "/sync-progress");
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const requiredDocuments = documents.filter((d) => d.isRequired);
  const optionalDocuments = documents.filter((d) => !d.isRequired);

  const allRequiredAccepted = requiredDocuments.every((d) => acceptedDocuments.has(d.id));
  const canProceed = allRequiredAccepted;

  const toggleDocument = (id: string) => {
    setAcceptedDocuments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    if (canProceed) {
      acceptBatchMutation.mutate(Array.from(acceptedDocuments));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="page-consent-loading">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading consent documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-consent">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <Heart className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-semibold">Tabula Medica</span>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-consent-title">
            Your Privacy Matters
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Before connecting your health data sources, please review and accept the required legal agreements.
          </p>
        </div>

        {requiredDocuments.length > 0 && (
          <Card className="mb-6" data-testid="card-required-consents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Required Agreements
              </CardTitle>
              <CardDescription>
                These agreements are required to use Tabula Medica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {requiredDocuments.map((doc) => {
                  const Icon = documentIcons[doc.type] || FileText;
                  return (
                    <AccordionItem key={doc.id} value={doc.id}>
                      <div className="flex items-start gap-4 py-2">
                        <Checkbox
                          id={doc.id}
                          checked={acceptedDocuments.has(doc.id)}
                          onCheckedChange={() => toggleDocument(doc.id)}
                          className="mt-1"
                          data-testid={`checkbox-${doc.type}`}
                        />
                        <div className="flex-1">
                          <AccordionTrigger className="hover:no-underline py-0">
                            <div className="flex items-start gap-3 text-left">
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{doc.title}</span>
                                  <Badge variant="secondary" className="text-xs" data-testid={`badge-version-${doc.type}`}>
                                    v{doc.version}
                                  </Badge>
                                  <span className="text-xs text-destructive">(Required)</span>
                                </div>
                                <p className="text-sm text-muted-foreground font-normal">
                                  {doc.summary}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-3 pb-0">
                            <div className="ml-11 p-3 bg-muted/50 rounded-lg text-sm space-y-3">
                              <ScrollArea className="h-[200px]">
                                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                  {doc.content}
                                </div>
                              </ScrollArea>
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  Effective: {formatDate(doc.effectiveDate)}
                                </div>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => setExpandedDocument(doc)}
                                      data-testid={`button-expand-${doc.type}`}
                                    >
                                      <Scroll className="h-4 w-4 mr-1" />
                                      Read Full Document
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-3xl max-h-[80vh]">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        {doc.title}
                                        <Badge variant="secondary">v{doc.version}</Badge>
                                      </DialogTitle>
                                      <DialogDescription>
                                        Effective: {formatDate(doc.effectiveDate)}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <ScrollArea className="h-[60vh] pr-4">
                                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                        {doc.content}
                                      </div>
                                    </ScrollArea>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                          </AccordionContent>
                        </div>
                      </div>
                      <Separator className="my-2" />
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {optionalDocuments.length > 0 && (
          <Card className="mb-6" data-testid="card-optional-consents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Optional Agreements
              </CardTitle>
              <CardDescription>
                You can choose to accept these now or later in Settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {optionalDocuments.map((doc) => {
                  const Icon = documentIcons[doc.type] || FileText;
                  return (
                    <AccordionItem key={doc.id} value={doc.id}>
                      <div className="flex items-start gap-4 py-2">
                        <Checkbox
                          id={doc.id}
                          checked={acceptedDocuments.has(doc.id)}
                          onCheckedChange={() => toggleDocument(doc.id)}
                          className="mt-1"
                          data-testid={`checkbox-${doc.type}`}
                        />
                        <div className="flex-1">
                          <AccordionTrigger className="hover:no-underline py-0">
                            <div className="flex items-start gap-3 text-left">
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium">{doc.title}</span>
                                  <Badge variant="outline" className="text-xs" data-testid={`badge-version-${doc.type}`}>
                                    v{doc.version}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">(Optional)</span>
                                </div>
                                <p className="text-sm text-muted-foreground font-normal">
                                  {doc.summary}
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-3 pb-0">
                            <div className="ml-11 p-3 bg-muted/50 rounded-lg text-sm space-y-3">
                              <ScrollArea className="h-[150px]">
                                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                  {doc.content}
                                </div>
                              </ScrollArea>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                                <Clock className="h-3 w-3" />
                                Effective: {formatDate(doc.effectiveDate)}
                              </div>
                            </div>
                          </AccordionContent>
                        </div>
                      </div>
                      <Separator className="my-2" />
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {!canProceed && (
          <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg mb-6" data-testid="alert-requirements">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Please accept all required agreements to connect your health data sources.
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => setLocation("/login")}
            data-testid="button-decline"
          >
            Decline and Sign Out
          </Button>
          <Button
            className="gap-2"
            size="lg"
            disabled={!canProceed || acceptBatchMutation.isPending}
            onClick={handleSubmit}
            data-testid="button-accept"
          >
            {acceptBatchMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Accept and Continue
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-muted-foreground">
            Your consent will be recorded with timestamps and document versions for compliance.
          </p>
          <p className="text-xs text-muted-foreground">
            You can review and change your preferences at any time in Settings.
          </p>
        </div>
      </main>
    </div>
  );
}
