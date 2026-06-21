import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { formatDate } from "@/components/shared/format-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pill,
  TestTube,
  Activity,
  Heart,
  Calendar,
  Stethoscope,
  FileText,
  Syringe,
  User,
  Info,
} from "lucide-react";

interface ShareValidation {
  valid: boolean;
  reason?: string;
  requiresPin?: boolean;
}

interface SharedHealthData {
  shareInfo: {
    recipientName: string;
    recipientType: string;
    expiresAt: string;
    sectionsGranted: string[];
  };
  patientInfo: {
    name: string;
    dateOfBirth?: string;
  };
  data: {
    sectionId: string;
    sectionName: string;
    resources: any[];
  }[];
  disclaimer: string;
}

function getSectionIcon(sectionId: string) {
  switch (sectionId) {
    case 'medications': return <Pill className="w-5 h-5" />;
    case 'labs': return <TestTube className="w-5 h-5" />;
    case 'conditions': return <Activity className="w-5 h-5" />;
    case 'allergies': return <AlertTriangle className="w-5 h-5" />;
    case 'vitals': return <Heart className="w-5 h-5" />;
    case 'immunizations': return <Syringe className="w-5 h-5" />;
    case 'encounters': return <Stethoscope className="w-5 h-5" />;
    case 'procedures': return <Activity className="w-5 h-5" />;
    case 'documents': return <FileText className="w-5 h-5" />;
    default: return <Activity className="w-5 h-5" />;
  }
}

export default function SharedHealthDataViewer() {
  const [, params] = useRoute("/shared-health-data/:token");
  const token = params?.token;

  const [validation, setValidation] = useState<ShareValidation | null>(null);
  const [sharedData, setSharedData] = useState<SharedHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessing, setAccessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinRequired, setPinRequired] = useState(false);

  useEffect(() => {
    if (!token) return;

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/health-share/validate/${token}`);
        const data = await response.json();
        setValidation(data);
        if (data.requiresPin) {
          setPinRequired(true);
        } else if (data.valid) {
          accessData();
        }
      } catch (err) {
        setError("Failed to validate share link");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const accessData = async (pinCode?: string) => {
    if (!token) return;

    setAccessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/health-share/access/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "PIN_REQUIRED") {
          setPinRequired(true);
        } else {
          setError(data.error || "Failed to access shared data");
        }
        return;
      }

      setSharedData(data);
      setPinRequired(false);
    } catch (err) {
      setError("Failed to access shared data");
    } finally {
      setAccessing(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    accessData(pin);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!validation || !validation.valid) {
    return (
      <div className="container mx-auto p-4 max-w-md" data-testid="share-invalid">
        <Card>
          <CardHeader className="text-center">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <CardTitle>Share Not Available</CardTitle>
            <CardDescription>
              {validation?.reason || "This share link is invalid or has expired"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>If you believe this is an error, please contact the patient who shared this link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pinRequired && !sharedData) {
    return (
      <div className="container mx-auto p-4 max-w-md" data-testid="share-pin-required">
        <Card>
          <CardHeader className="text-center">
            <Lock className="w-16 h-16 mx-auto text-primary mb-4" />
            <CardTitle>PIN Required</CardTitle>
            <CardDescription>
              This shared health data requires a PIN to access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">Enter PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="Enter the PIN shared with you"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoFocus
                  data-testid="input-access-pin"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={pin.length < 4 || accessing} data-testid="button-submit-pin">
                {accessing ? "Verifying..." : "Access Data"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground text-center mt-4">
              The PIN should have been shared separately by the patient
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !sharedData) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!sharedData) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p>Loading shared health data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6" data-testid="shared-health-data-viewer">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Shared Health Data
                </CardTitle>
                <CardDescription>
                  Shared by {sharedData.patientInfo.name}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                <Clock className="w-3 h-3 mr-1" />
                Expires {formatDate(sharedData.shareInfo.expiresAt)}
              </Badge>
              <p className="text-xs text-muted-foreground">
                For: {sharedData.shareInfo.recipientName} ({sharedData.shareInfo.recipientType})
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <Info className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Important Notice</AlertTitle>
            <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
              {sharedData.disclaimer}
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg mb-6">
            <div className="p-2 bg-primary/10 rounded-full">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{sharedData.patientInfo.name}</p>
              {sharedData.patientInfo.dateOfBirth && (
                <p className="text-sm text-muted-foreground">DOB: {formatDate(sharedData.patientInfo.dateOfBirth)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={sharedData.data[0]?.sectionId || "medications"}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {sharedData.data.map(section => (
            <TabsTrigger key={section.sectionId} value={section.sectionId} className="flex items-center gap-1" data-testid={`tab-${section.sectionId}`}>
              {getSectionIcon(section.sectionId)}
              <span className="hidden sm:inline">{section.sectionName}</span>
              <Badge variant="secondary" className="ml-1 text-xs">{section.resources.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {sharedData.data.map(section => (
          <TabsContent key={section.sectionId} value={section.sectionId} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getSectionIcon(section.sectionId)}
                  {section.sectionName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {section.resources.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No data available in this section</p>
                ) : (
                  <div className="space-y-3">
                    {section.resources.map((resource, index) => (
                      <ResourceCard key={index} sectionId={section.sectionId} resource={resource} index={index} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <Shield className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700 dark:text-blue-300">Secure Access</AlertTitle>
        <AlertDescription className="text-xs text-blue-600 dark:text-blue-400">
          This access is logged for the patient's security. The patient can revoke access at any time.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function ResourceCard({ sectionId, resource, index }: { sectionId: string; resource: any; index: number }) {
  switch (sectionId) {
    case 'medications':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{resource.name}</p>
            <Badge variant={resource.status === 'active' ? "default" : "secondary"}>{resource.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{resource.dosage}</p>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Started: {resource.startDate}</span>
            <span>Prescribed by: {resource.prescriber}</span>
          </div>
        </div>
      );
    case 'conditions':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{resource.name}</p>
            <Badge variant={resource.status === 'active' ? "default" : "secondary"}>{resource.status}</Badge>
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Onset: {resource.onsetDate}</span>
            <span>Severity: {resource.severity}</span>
          </div>
        </div>
      );
    case 'labs':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{resource.test}</p>
            <Badge variant={
              resource.interpretation === 'Normal' ? "default" : 
              resource.interpretation === 'High' || resource.interpretation === 'Above Normal' ? "destructive" : "secondary"
            }>
              {resource.interpretation}
            </Badge>
          </div>
          <p className="text-lg font-semibold mt-1">{resource.value}</p>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Reference: {resource.referenceRange}</span>
            <span>{resource.date}</span>
          </div>
        </div>
      );
    case 'allergies':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{resource.allergen}</p>
            <Badge variant={resource.severity === 'Severe' ? "destructive" : resource.severity === 'Moderate' ? "default" : "secondary"}>
              {resource.severity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Reaction: {resource.reaction}</p>
          <p className="text-xs text-muted-foreground mt-1">Recorded: {resource.recordedDate}</p>
        </div>
      );
    case 'immunizations':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <p className="font-medium">{resource.vaccine}</p>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Date: {resource.date}</span>
            <span>{resource.manufacturer}</span>
          </div>
        </div>
      );
    case 'vitals':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{resource.type}</p>
            <p className="text-lg font-semibold">{resource.value}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{resource.date} - {resource.location}</p>
        </div>
      );
    case 'encounters':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{resource.type}</p>
            <span className="text-sm text-muted-foreground">{resource.date}</span>
          </div>
          <p className="text-sm">{resource.reason}</p>
          <p className="text-xs text-muted-foreground mt-1">Provider: {resource.provider} at {resource.location}</p>
        </div>
      );
    case 'procedures':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <p className="font-medium">{resource.name}</p>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>Date: {resource.date}</span>
            <span>Provider: {resource.provider}</span>
          </div>
          {resource.result && <p className="text-sm mt-1">Result: {resource.result}</p>}
        </div>
      );
    case 'documents':
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <p className="font-medium">{resource.title}</p>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{resource.type}</span>
            <span>{resource.date}</span>
          </div>
          <p className="text-xs text-muted-foreground">Author: {resource.author}</p>
        </div>
      );
    default:
      return (
        <div className="p-3 border rounded-lg" data-testid={`resource-${sectionId}-${index}`}>
          <pre className="text-xs overflow-auto">{JSON.stringify(resource, null, 2)}</pre>
        </div>
      );
  }
}
