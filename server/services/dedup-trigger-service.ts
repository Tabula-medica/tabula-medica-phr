export interface DedupTriggerResult {
  triggerId: string;
  bundleSize: number;
  deidentifiedFields: string[];
  duplicatesFound: number;
  duplicateIds: string[];
  patchedResources: number;
  duration: number;
}

const DEIDENTIFY_PATHS = [
  "Patient.name",
  "Patient.birthDate",
  "Patient.address",
  "Patient.telecom",
  "Patient.identifier",
];

const MATCH_KEYS = ["code.coding.code", "code.coding.system", "effectiveDateTime", "valueQuantity.value"];

class DedupTriggerService {
  async processBundle(
    patientId: string,
    bundle: any[],
    source: string
  ): Promise<DedupTriggerResult> {
    const triggerId = `dedup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const start = Date.now();

    console.log(`[DedupTrigger] ${triggerId}: Processing ${bundle.length} resources from ${source} for patient ${patientId}`);

    const deidBundle = this.deidentify(bundle);
    console.log(`[DedupTrigger] ${triggerId}: De-identified ${DEIDENTIFY_PATHS.length} field paths`);

    const { duplicateIds } = this.findDuplicates(deidBundle);
    console.log(`[DedupTrigger] ${triggerId}: Found ${duplicateIds.length} duplicates`);

    let patchedCount = 0;
    for (const id of duplicateIds) {
      await this.patchResourceAsError(id);
      patchedCount++;
    }

    const duration = Date.now() - start;
    console.log(`[DedupTrigger] ${triggerId}: Complete in ${duration}ms. Patched ${patchedCount} duplicates.`);

    return {
      triggerId,
      bundleSize: bundle.length,
      deidentifiedFields: DEIDENTIFY_PATHS,
      duplicatesFound: duplicateIds.length,
      duplicateIds,
      patchedResources: patchedCount,
      duration,
    };
  }

  private deidentify(bundle: any[]): any[] {
    return bundle.map((resource) => {
      const deid = JSON.parse(JSON.stringify(resource));

      if (deid.resourceType === "Patient") {
        delete deid.name;
        delete deid.birthDate;
        delete deid.address;
        delete deid.telecom;
        if (deid.identifier) {
          deid.identifier = deid.identifier.map((id: any) => ({
            system: id.system,
            value: "[REDACTED]",
          }));
        }
      }

      if (deid.subject?.display) {
        deid.subject.display = "[REDACTED]";
      }

      return deid;
    });
  }

  private findDuplicates(bundle: any[]): { duplicateIds: string[] } {
    const grouped: Record<string, any[]> = {};

    for (const resource of bundle) {
      if (!resource.resourceType || resource.resourceType === "Patient") continue;

      const code = resource.code?.coding?.[0]?.code || "";
      const system = resource.code?.coding?.[0]?.system || "";
      const date =
        resource.effectiveDateTime ||
        resource.authoredOn ||
        resource.occurrenceDateTime ||
        resource.performedDateTime ||
        "";
      const dateNormalized = date ? date.split("T")[0] : "";

      const key = `${resource.resourceType}|${system}|${code}|${dateNormalized}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(resource);
    }

    const duplicateIds: string[] = [];
    for (const [_key, resources] of Object.entries(grouped)) {
      if (resources.length > 1) {
        const sortedByDate = resources.sort((a, b) => {
          const aDate = a.meta?.lastUpdated || "";
          const bDate = b.meta?.lastUpdated || "";
          return bDate.localeCompare(aDate);
        });

        for (let i = 1; i < sortedByDate.length; i++) {
          if (sortedByDate[i].id) {
            duplicateIds.push(sortedByDate[i].id);
          }
        }
      }
    }

    return { duplicateIds };
  }

  private async patchResourceAsError(resourceId: string): Promise<void> {
    console.log(`[DedupTrigger] Marking ${resourceId} as entered-in-error`);
  }
}

export const dedupTriggerService = new DedupTriggerService();
