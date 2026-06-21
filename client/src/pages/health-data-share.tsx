import { HealthDataShareManager } from "@/components/health-data-share";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2 } from "lucide-react";
import { Link } from "wouter";

const PATIENT_ID = "patient-001";

export default function HealthDataSharePage() {
  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6" data-testid="page-health-data-share">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="w-6 h-6 text-primary" />
            Share My Health Data
          </h1>
          <p className="text-muted-foreground text-sm">
            Create secure, time-limited access to your health records
          </p>
        </div>
      </div>

      <HealthDataShareManager patientId={PATIENT_ID} />
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-data-share-disclaimer" />
    </div>
  );
}