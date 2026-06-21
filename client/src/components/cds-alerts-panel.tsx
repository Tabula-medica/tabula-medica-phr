/**
 * CDS Alerts Panel - Clinical Decision Support Alerts for Providers
 * 
 * Displays informational alerts from CDS hooks based on patient context.
 * All outputs are INFORMATIONAL ONLY and do not provide treatment recommendations.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  Info, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  CheckCircle,
  XCircle,
  RefreshCw,
  Shield,
  Lightbulb
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface CDSCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    topic?: {
      code: string;
      system: string;
      display: string;
    };
  };
  suggestions?: CDSSuggestion[];
  overrideReasons?: { code: string; display: string }[];
  links?: { label: string; url: string; type: 'absolute' | 'smart' }[];
  isInformationalOnly: true;
}

interface CDSSuggestion {
  label: string;
  uuid: string;
  isRecommended?: boolean;
  actions: { type: string; description: string }[];
}

interface CDSResponse {
  cards: CDSCard[];
  disclaimer: string;
  generatedAt: string;
}

interface MedicationContext {
  id: string;
  code: string;
  display: string;
  status: string;
}

interface ConditionContext {
  id: string;
  code: string;
  display: string;
  clinicalStatus: string;
}

interface LabContext {
  id: string;
  code: string;
  display: string;
  value: number;
  unit: string;
  referenceRange?: { low?: number; high?: number };
  effectiveDate: string;
}

interface CDSAlertsPanelProps {
  patientId: string;
  userId?: string;
  hookType?: 'patient-view' | 'medication-prescribe' | 'order-select';
  medications?: MedicationContext[];
  conditions?: ConditionContext[];
  labResults?: LabContext[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  compact?: boolean;
}

const INFORMATIONAL_DISCLAIMER = `⚠️ INFORMATIONAL ONLY - NOT MEDICAL ADVICE
This information is provided for educational and informational purposes only.
It does NOT constitute medical advice, diagnosis, or treatment recommendations.
Clinical judgment by qualified healthcare providers is required for all patient care decisions.`;

export function CDSAlertsPanel({
  patientId,
  userId,
  hookType = 'patient-view',
  medications = [],
  conditions = [],
  labResults = [],
  autoRefresh = false,
  refreshInterval = 60000,
  compact = false
}: CDSAlertsPanelProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const queryClient = useQueryClient();

  const { data: cdsResponse, isLoading, error, refetch } = useQuery<CDSResponse>({
    queryKey: ['/api/cds-hooks', hookType, patientId],
    queryFn: async () => {
      const response = await apiRequest('POST', `/api/cds-hooks/${hookType}`, {
        patientId,
        userId,
        medications,
        conditions,
        labResults
      });
      return response.json();
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 30000
  });

  const feedbackMutation = useMutation({
    mutationFn: async (feedback: { cardId: string; outcome: string; overrideReasons?: string[] }) => {
      const response = await apiRequest('POST', `/api/cds-hooks/cds-services/${hookType}/feedback`, {
        card: feedback.cardId,
        outcome: feedback.outcome,
        patientId,
        providerId: userId,
        overrideReasons: feedback.overrideReasons
      });
      return response.json();
    }
  });

  const toggleCardExpanded = (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
    }
    setExpandedCards(newExpanded);
  };

  const dismissCard = (cardId: string, reason?: string) => {
    setDismissedCards(new Set(Array.from(dismissedCards).concat(cardId)));
    feedbackMutation.mutate({
      cardId,
      outcome: 'overridden',
      overrideReasons: reason ? [reason] : ['dismissed-by-user']
    });
  };

  const acknowledgeCard = (cardId: string) => {
    feedbackMutation.mutate({
      cardId,
      outcome: 'accepted'
    });
  };

  const getIndicatorIcon = (indicator: string) => {
    switch (indicator) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getIndicatorColor = (indicator: string) => {
    switch (indicator) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-950/20';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20';
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/20';
    }
  };

  const visibleCards = cdsResponse?.cards.filter(card => !dismissedCards.has(card.uuid)) || [];

  if (isLoading) {
    return (
      <Card data-testid="cds-alerts-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Clinical Decision Support
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="cds-alerts-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            CDS Service Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to retrieve clinical decision support information. 
            Please consult authoritative clinical sources directly.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => refetch()}
            data-testid="button-cds-retry"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="cds-alerts-panel">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Clinical Decision Support
            {visibleCards.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {visibleCards.length} alert{visibleCards.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => refetch()}
                  data-testid="button-cds-refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh CDS Alerts</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <CardDescription>
          Evidence-based informational alerts for patient context
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {showDisclaimer && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Informational Only</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
              All CDS alerts are for informational purposes only. They do NOT constitute medical advice 
              or treatment recommendations. Clinical judgment by qualified providers is required.
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-2 h-auto p-0 text-xs underline"
                onClick={() => setShowDisclaimer(false)}
                data-testid="button-dismiss-disclaimer"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {visibleCards.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No informational alerts at this time.</p>
            <p className="text-xs mt-1">CDS alerts will appear when relevant patient context is available.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleCards.map((card) => (
              <Collapsible
                key={card.uuid}
                open={expandedCards.has(card.uuid)}
                onOpenChange={() => toggleCardExpanded(card.uuid)}
              >
                <div 
                  className={`border-l-4 rounded-md p-3 ${getIndicatorColor(card.indicator)}`}
                  data-testid={`cds-card-${card.uuid}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      {getIndicatorIcon(card.indicator)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{card.summary}</p>
                          <Badge variant="outline" className="text-xs">
                            {card.source.topic?.display || 'Info'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Source: {card.source.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-expand-${card.uuid}`}>
                          {expandedCards.has(card.uuid) ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  <CollapsibleContent className="mt-3">
                    {card.detail && (
                      <p className="text-sm text-foreground/80 mb-3 whitespace-pre-wrap">
                        {card.detail}
                      </p>
                    )}

                    {card.links && card.links.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {card.links.map((link, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (link.type === 'absolute') {
                                window.open(link.url, '_blank');
                              } else {
                                window.location.href = link.url;
                              }
                            }}
                            data-testid={`link-${card.uuid}-${idx}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {link.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    {card.overrideReasons && card.overrideReasons.length > 0 && (
                      <div className="border-t pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2">Override reasons (if dismissing):</p>
                        <div className="flex flex-wrap gap-1">
                          {card.overrideReasons.map((reason) => (
                            <Button
                              key={reason.code}
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => dismissCard(card.uuid, reason.code)}
                              data-testid={`override-${card.uuid}-${reason.code}`}
                            >
                              {reason.display}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => dismissCard(card.uuid)}
                        data-testid={`button-dismiss-${card.uuid}`}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Dismiss
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => acknowledgeCard(card.uuid)}
                        data-testid={`button-acknowledge-${card.uuid}`}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        {cdsResponse?.generatedAt && (
          <p className="text-xs text-muted-foreground text-right mt-2">
            Generated: {new Date(cdsResponse.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default CDSAlertsPanel;
