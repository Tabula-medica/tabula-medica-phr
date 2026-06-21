import { useState, useEffect, useRef } from "react";
import { useParams, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Pill,
  AlertTriangle,
  TestTube,
  FileImage,
  Clock,
  Shield,
  CheckCircle,
  XCircle,
  User,
  Calendar,
} from "lucide-react";

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  status: string;
  patientStatus?: string;
}

interface Allergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: string;
}

interface LabResult {
  id: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: string;
  date: string;
}

interface ImagingResult {
  id: string;
  type: string;
  bodyPart: string;
  findings: string;
  date: string;
}

interface ProviderViewData {
  patientName: string;
  dateOfBirth: string;
  recordType: string;
  generatedAt: string;
  expiresAt: string;
  medications: Medication[];
  allergies: Allergy[];
  recentLabs: LabResult[];
  imaging: ImagingResult[];
}

function getMedicationStatusIcon(patientStatus?: string) {
  if (patientStatus === "confirmed") {
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  }
  if (patientStatus === "not_taking") {
    return <XCircle className="h-4 w-4 text-amber-600" />;
  }
  return null;
}

function getSeverityVariant(severity: string): "destructive" | "secondary" | "outline" {
  switch (severity.toLowerCase()) {
    case "severe":
    case "high":
      return "destructive";
    case "moderate":
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function getLabStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "abnormal":
    case "high":
    case "low":
      return "text-amber-600 dark:text-amber-400";
    case "critical":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-green-600 dark:text-green-400";
  }
}

export default function SharedRecordView() {
  const params = useParams<{ shareId: string }>();
  const searchString = useSearch();
  const [data, setData] = useState<ProviderViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadStartTime = useRef(performance.now());

  useEffect(() => {
    const fetchData = async () => {
      const shareId = params.shareId;
      const urlParams = new URLSearchParams(searchString);
      const code = urlParams.get("code");

      if (!shareId || !code) {
        setError("Invalid share link. Please check the URL.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/quick-share/${shareId}/provider-view?code=${code}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || "Unable to load health records.");
          setLoading(false);
          return;
        }

        const viewData = await response.json();
        setData(viewData);
        
        const loadTime = Math.round(performance.now() - loadStartTime.current);
        
        fetch("/api/quick-share/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "provider_view_opened",
            shareId,
          }),
        }).catch(() => {});
        
        fetch("/api/quick-share/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "provider_view_time_to_load_ms",
            shareId,
            loadTimeMs: loadTime,
          }),
        }).catch(() => {});

      } catch (err) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.shareId, searchString]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-background" data-testid="shared-record-view-container">
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-bold" data-testid="text-patient-name">
                  {data.patientName}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>DOB: {data.dateOfBirth}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                Read-Only
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                Expires: {new Date(data.expiresAt).toLocaleDateString()}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-medications">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Pill className="h-5 w-5 text-muted-foreground" />
                Current Medications
                <Badge variant="secondary" className="ml-auto">
                  {data.medications.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.medications.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No medications on file</p>
              ) : (
                <div className="space-y-2">
                  {data.medications.map((med) => (
                    <div
                      key={med.id}
                      className="flex items-start gap-2 py-2 border-b last:border-0"
                      data-testid={`medication-${med.id}`}
                    >
                      {getMedicationStatusIcon(med.patientStatus)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{med.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {med.dosage} - {med.frequency}
                        </div>
                      </div>
                      {med.patientStatus === "confirmed" && (
                        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                          Confirmed
                        </Badge>
                      )}
                      {med.patientStatus === "not_taking" && (
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
                          Not Taking
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-allergies">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Allergies
                <Badge variant="secondary" className="ml-auto">
                  {data.allergies.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.allergies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No known allergies</p>
              ) : (
                <div className="space-y-2">
                  {data.allergies.map((allergy) => (
                    <div
                      key={allergy.id}
                      className="flex items-start justify-between gap-2 py-2 border-b last:border-0"
                      data-testid={`allergy-${allergy.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{allergy.allergen}</div>
                        <div className="text-xs text-muted-foreground">
                          Reaction: {allergy.reaction}
                        </div>
                      </div>
                      <Badge variant={getSeverityVariant(allergy.severity)}>
                        {allergy.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-labs">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TestTube className="h-5 w-5 text-muted-foreground" />
              Recent Lab Results
              <Badge variant="secondary" className="ml-auto">
                {data.recentLabs.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.recentLabs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No recent lab results</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Test</th>
                      <th className="text-left py-2 font-medium">Result</th>
                      <th className="text-left py-2 font-medium">Reference</th>
                      <th className="text-left py-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentLabs.map((lab) => (
                      <tr key={lab.id} className="border-b last:border-0" data-testid={`lab-${lab.id}`}>
                        <td className="py-2">{lab.testName}</td>
                        <td className={`py-2 font-medium ${getLabStatusColor(lab.status)}`}>
                          {lab.value} {lab.unit}
                        </td>
                        <td className="py-2 text-muted-foreground">{lab.referenceRange}</td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(lab.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-imaging">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileImage className="h-5 w-5 text-muted-foreground" />
              Recent Imaging
              <Badge variant="secondary" className="ml-auto">
                {data.imaging.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.imaging.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No recent imaging studies</p>
            ) : (
              <div className="space-y-3">
                {data.imaging.map((img) => (
                  <div
                    key={img.id}
                    className="py-2 border-b last:border-0"
                    data-testid={`imaging-${img.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-medium text-sm">
                        {img.type} - {img.bodyPart}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(img.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{img.findings}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        <div className="text-center text-xs text-muted-foreground py-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-4 w-4" />
            <span>HIPAA-compliant secure health record view</span>
          </div>
          <p>
            This information was shared by the patient on{" "}
            {new Date(data.generatedAt).toLocaleDateString()} and expires on{" "}
            {new Date(data.expiresAt).toLocaleDateString()}.
          </p>
          <p className="mt-1">
            For clinical decision-making, always verify with original sources.
          </p>
        </div>
      </div>
    </div>
  );
}
