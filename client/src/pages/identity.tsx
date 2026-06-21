import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  UserCheck, 
  AlertTriangle,
  CheckCircle,
  Shield,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  Flag,
  X,
  Info
} from "lucide-react";
import type { PatientIdentity, EhrConnection } from "@shared/schema";
import { ehrPlatformInfo } from "@shared/schema";
import { PageHeader } from "@/components/shared";

interface PatientIdentityWithSources extends PatientIdentity {
  ehrSources: {
    platform: string;
    facility: string;
    mrn: string;
    lastSync: string;
  }[];
}

function IdentityAttributeCard({ 
  label, 
  values, 
  icon: Icon,
  onFlag 
}: { 
  label: string; 
  values: string[]; 
  icon: React.ElementType;
  onFlag: (value: string) => void;
}) {
  const [flaggedValues, setFlaggedValues] = useState<string[]>([]);

  const handleFlag = (value: string) => {
    if (flaggedValues.includes(value)) {
      setFlaggedValues(flaggedValues.filter(v => v !== value));
    } else {
      setFlaggedValues([...flaggedValues, value]);
      onFlag(value);
    }
  };

  return (
    <Card data-testid={`card-identity-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {values.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data found</p>
        ) : (
          values.map((value, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between gap-2 flex-wrap p-2 rounded-md ${
                flaggedValues.includes(value) ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'
              }`}
            >
              <span className={`text-sm ${flaggedValues.includes(value) ? 'line-through text-muted-foreground' : ''}`}>
                {value}
              </span>
              <Button
                variant={flaggedValues.includes(value) ? "destructive" : "ghost"}
                size="sm"
                onClick={() => handleFlag(value)}
                data-testid={`button-flag-${label.toLowerCase()}-${index}`}
              >
                {flaggedValues.includes(value) ? (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    Unflag
                  </>
                ) : (
                  <>
                    <Flag className="h-3 w-3 mr-1" />
                    Not mine
                  </>
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MatchConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const colors = {
    high: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
    low: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  };

  const icons = {
    high: CheckCircle,
    medium: Info,
    low: AlertTriangle,
  };

  const Icon = icons[confidence];

  return (
    <Badge variant="outline" className={colors[confidence]} data-testid="badge-match-confidence">
      <Icon className="h-3 w-3 mr-1" />
      {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence Match
    </Badge>
  );
}

export default function Identity() {
  const [flaggedItems, setFlaggedItems] = useState<string[]>([]);

  const { data: identity, isLoading, error } = useQuery<PatientIdentityWithSources>({
    queryKey: ['/api/identity'],
  });

  const { data: connections } = useQuery<EhrConnection[]>({
    queryKey: ['/api/ehr-connections'],
  });

  const handleFlag = (value: string) => {
    if (!flaggedItems.includes(value)) {
      setFlaggedItems([...flaggedItems, value]);
    }
  };

  const handleSubmitFlags = () => {
    console.log('Submitting flags:', flaggedItems);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 animate-in fade-in" data-testid="identity-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 animate-in fade-in">
        <Card className="p-8 text-center" data-testid="identity-error">
          <UserCheck className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Identity Data</h3>
          <p className="text-muted-foreground">
            There was a problem loading your identity information. Please try again later.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <PageHeader
          title="My Identity"
          subtitle="Verify and manage your identity information across health systems"
          actions={identity && <MatchConfidenceBadge confidence={identity.matchConfidence} />}
        />

        {flaggedItems.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
              <span>You've flagged {flaggedItems.length} item{flaggedItems.length !== 1 ? 's' : ''} as incorrect</span>
              <Button size="sm" onClick={handleSubmitFlags} data-testid="button-submit-flags">
                Submit for Review
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pt-0">
        {!identity ? (
          <Card className="p-8 text-center" data-testid="identity-empty">
            <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Identity Data</h3>
            <p className="text-muted-foreground">
              Connect your health data sources to see your identity information
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">Identity Verification</h2>
                    <p className="text-muted-foreground mt-1">
                      Review the information below. If any data doesn't belong to you, flag it by clicking "Not mine".
                      This helps us maintain accurate records and protect your health information.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <IdentityAttributeCard
                label="Name Variants"
                values={identity.nameVariants}
                icon={UserCheck}
                onFlag={handleFlag}
              />
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Date of Birth
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2 flex-wrap p-2 rounded-md bg-muted/50">
                    <span className="text-sm font-medium">
                      {new Date(identity.dateOfBirth).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFlag(identity.dateOfBirth)}
                      data-testid="button-flag-dob"
                    >
                      <Flag className="h-3 w-3 mr-1" />
                      Not mine
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <IdentityAttributeCard
                label="Email Addresses"
                values={identity.emails}
                icon={Mail}
                onFlag={handleFlag}
              />

              <IdentityAttributeCard
                label="Phone Numbers"
                values={identity.phones}
                icon={Phone}
                onFlag={handleFlag}
              />

              <IdentityAttributeCard
                label="Addresses"
                values={identity.addresses}
                icon={MapPin}
                onFlag={handleFlag}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Connected Health Systems
                </CardTitle>
                <CardDescription>
                  Your identity is matched across these systems
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {identity.ehrSources.map((source, index) => {
                    const platformData = ehrPlatformInfo[source.platform as keyof typeof ehrPlatformInfo];
                    return (
                      <div
                        key={index}
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: platformData?.color }}
                          />
                          <span className="font-medium text-sm" style={{ color: platformData?.color }}>
                            {platformData?.name || source.platform}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{source.facility}</p>
                        <p className="text-xs text-muted-foreground mt-1">MRN: {source.mrn}</p>
                        <p className="text-xs text-muted-foreground">
                          Last synced: {new Date(source.lastSync).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {identity.lastVerified && (
              <p className="text-xs text-muted-foreground text-center">
                Last verified: {new Date(identity.lastVerified).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
