import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSEO } from "@/hooks/use-seo";
import { LongevityPreventivePanel } from "@/components/longevity-preventive-panel";
import { LONGEVITY_PROTOCOL_VERSION } from "@shared/longevity-preventive";
import { Shield, Timer } from "lucide-react";

export default function LongevityPreventivePage() {
  useSEO({
    title: "Longevity & Preventive Health",
    description:
      "Your age- and risk-adjusted preventive plan: screenings, vaccines, longevity biomarkers, fitness markers and lifestyle targets, with US and international guideline sets.",
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="page-title-longevity-preventive">
              <Timer className="h-7 w-7 text-primary" />
              Longevity &amp; Preventive Health
            </h1>
            <p className="text-muted-foreground mt-1">
              What to check, how often, and what "optimal" looks like. Built from USPSTF, ACC/AHA, ADA, ACIP and WHO guidance.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge variant="outline" className="text-xs">Protocol {LONGEVITY_PROTOCOL_VERSION}</Badge>
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Stored on this device
            </Badge>
          </div>
        </div>

        <LongevityPreventivePanel mode="patient" embedded />

        <Separator />
        <div className="text-center text-xs text-muted-foreground pb-4">
          <p>Educational information for your personal records. It does not constitute medical advice; confirm every item with your clinician.</p>
        </div>
      </div>
    </div>
  );
}
