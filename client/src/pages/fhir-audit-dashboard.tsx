import { FhirAuditViewer } from "@/components/fhir-audit-viewer";

export default function FhirAuditDashboard() {
  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <FhirAuditViewer />
    </div>
  );
}
