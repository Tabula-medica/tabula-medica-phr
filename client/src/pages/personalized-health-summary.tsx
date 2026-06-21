import { useState } from "react";
import { PersonalizedHealthSummaryView } from "@/components/personalized-health-summary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles, User, Stethoscope, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const PATIENT_ID = "patient-001";

export default function PersonalizedHealthSummaryPage() {
  const [viewMode, setViewMode] = useState<"patient" | "provider">("patient");

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6" data-testid="page-personalized-health-summary">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              My Health Summary
            </h1>
            <p className="text-muted-foreground text-sm">
              AI-powered insights from your health records
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <User className={`w-4 h-4 ${viewMode === "patient" ? "text-primary" : "text-muted-foreground"}`} />
            <Switch
              id="view-mode"
              checked={viewMode === "provider"}
              onCheckedChange={(checked) => setViewMode(checked ? "provider" : "patient")}
              data-testid="switch-view-mode"
            />
            <Stethoscope className={`w-4 h-4 ${viewMode === "provider" ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <Badge variant="outline">
            {viewMode === "patient" ? "Patient View" : "Provider View"}
          </Badge>
        </div>
      </div>

      <PersonalizedHealthSummaryView 
        patientId={PATIENT_ID} 
        viewMode={viewMode}
      />

      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">About This Summary</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            This AI-generated summary synthesizes information from your electronic health records, 
            including conditions, medications, lab results, and healthcare visits.
          </p>
          <p>
            <strong>What's New:</strong> Recent changes to your medications, new lab results, and healthcare encounters.
          </p>
          <p>
            <strong>Key Trends:</strong> Analysis of how your health metrics are changing over time.
          </p>
          <p>
            <strong>Next Steps:</strong> Topics and questions to discuss with your healthcare provider.
          </p>
          <p className="italic pt-2 border-t">
            This summary is for informational purposes only and does not replace professional medical advice. 
            Always consult with your healthcare provider for medical decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
