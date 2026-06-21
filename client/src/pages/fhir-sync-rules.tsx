import { FHIRSyncRulesDashboard } from "@/components/fhir-sync-rules-dashboard";

export default function FHIRSyncRulesPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">FHIR Sync Rules</h1>
        <p className="text-muted-foreground mt-1">
          Configure automated synchronization rules with trigger conditions, data transformations, and conflict resolution
        </p>
      </div>
      <FHIRSyncRulesDashboard />
    </div>
  );
}
