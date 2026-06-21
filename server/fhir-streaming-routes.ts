import { Router, Request, Response } from "express";
import { fhirEventStreaming } from "./services/fhir-event-streaming";
import { z } from "zod";
import { FhirEventType, FhirEventSource, FhirEventSeverity } from "../shared/fhir-event-types";

function logHipaaAudit(params: {
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: string;
  details?: Record<string, unknown>;
}) {
  console.log(`[HIPAA-AUDIT] ${params.action} - ${params.resourceType}/${params.resourceId} - ${params.outcome}`, params.details || {});
}

const router = Router();

const emitEventSchema = z.object({
  type: z.string(),
  severity: z.enum(["info", "warning", "error", "success"]).optional(),
  source: z.string(),
  resourceType: z.string(),
  resourceId: z.string().optional(),
  patientId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const stats = fhirEventStreaming.getStats();

    logHipaaAudit({
      action: "FHIR_STREAM_STATS_VIEW",
      resourceType: "StreamingStats",
      resourceId: "stats",
      outcome: "success",
      details: { clientCount: stats.connectedClients },
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("[FHIR-Streaming] Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve streaming stats",
    });
  }
});

router.get("/recent-events", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = fhirEventStreaming.getRecentEvents(limit);

    logHipaaAudit({
      action: "FHIR_STREAM_EVENTS_VIEW",
      resourceType: "StreamEvents",
      resourceId: "recent",
      outcome: "success",
      details: { eventCount: events.length, limit },
    });

    res.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("[FHIR-Streaming] Error getting recent events:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve recent events",
    });
  }
});

router.post("/emit", async (req: Request, res: Response) => {
  try {
    const validated = emitEventSchema.parse(req.body);

    const event = fhirEventStreaming.emitEvent({
      type: validated.type as FhirEventType,
      severity: validated.severity as FhirEventSeverity,
      source: validated.source as FhirEventSource,
      resourceType: validated.resourceType,
      resourceId: validated.resourceId,
      patientId: validated.patientId,
      title: validated.title,
      description: validated.description,
      metadata: validated.metadata,
    });

    logHipaaAudit({
      action: "FHIR_EVENT_EMITTED",
      resourceType: validated.resourceType,
      resourceId: event.id,
      outcome: "success",
      details: { eventType: validated.type, source: validated.source },
    });

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("[FHIR-Streaming] Error emitting event:", error);
    res.status(400).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to emit event",
    });
  }
});

router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const { count = 5, interval = 2000 } = req.body;
    const maxCount = Math.min(count, 20);
    const minInterval = Math.max(interval, 500);

    const sampleEvents = [
      {
        type: "patient.updated" as FhirEventType,
        source: "fastenhealth" as FhirEventSource,
        resourceType: "Patient",
        title: "Patient Demographics Updated",
        description: "Address and contact information updated via Fasten Health sync",
      },
      {
        type: "observation.created" as FhirEventType,
        source: "fastenhealth" as FhirEventSource,
        resourceType: "Observation",
        title: "New Lab Result",
        description: "Complete Blood Count (CBC) results received from Hospital Network",
      },
      {
        type: "medication.created" as FhirEventType,
        source: "provider" as FhirEventSource,
        resourceType: "MedicationRequest",
        title: "New Prescription",
        description: "Medication prescription added from Healthcare Provider",
      },
      {
        type: "encounter.completed" as FhirEventType,
        source: "fastenhealth" as FhirEventSource,
        resourceType: "Encounter",
        title: "Visit Completed",
        description: "Outpatient visit notes finalized and synced",
      },
      {
        type: "diagnostic.created" as FhirEventType,
        source: "fastenhealth" as FhirEventSource,
        resourceType: "DiagnosticReport",
        title: "Imaging Report Available",
        description: "X-Ray results processed and available for review",
      },
      {
        type: "immunization.created" as FhirEventType,
        source: "cms-bluebutton" as FhirEventSource,
        resourceType: "Immunization",
        title: "Vaccination Record Added",
        description: "COVID-19 booster vaccination record imported",
      },
      {
        type: "reconciliation.conflict" as FhirEventType,
        source: "reconciliation" as FhirEventSource,
        resourceType: "Patient",
        title: "Data Conflict Detected",
        description: "Conflicting patient address information between provider records",
        severity: "warning" as FhirEventSeverity,
      },
      {
        type: "quality.issue" as FhirEventType,
        source: "internal" as FhirEventSource,
        resourceType: "Observation",
        title: "Data Quality Alert",
        description: "Missing reference range for lab observation",
        severity: "warning" as FhirEventSeverity,
      },
      {
        type: "sync.completed" as FhirEventType,
        source: "fastenhealth" as FhirEventSource,
        resourceType: "Bundle",
        title: "EHR Sync Complete",
        description: "Successfully synchronized 47 resources from Healthcare Provider",
        severity: "success" as FhirEventSeverity,
      },
      {
        type: "document.processed" as FhirEventType,
        source: "upload" as FhirEventSource,
        resourceType: "DocumentReference",
        title: "Document Processed",
        description: "Uploaded PDF successfully tagged and indexed",
        severity: "success" as FhirEventSeverity,
      },
    ];

    let emitted = 0;
    const simulationInterval = setInterval(() => {
      if (emitted >= maxCount) {
        clearInterval(simulationInterval);
        return;
      }

      const randomEvent = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
      const patientIds = ["patient-001", "patient-002", "patient-003", "patient-004", "patient-005"];
      
      fhirEventStreaming.emitEvent({
        ...randomEvent,
        severity: randomEvent.severity || "info",
        patientId: patientIds[Math.floor(Math.random() * patientIds.length)],
        resourceId: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      });
      
      emitted++;
    }, minInterval);

    logHipaaAudit({
      action: "FHIR_EVENT_SIMULATION_STARTED",
      resourceType: "Simulation",
      resourceId: "simulation",
      outcome: "success",
      details: { count: maxCount, interval: minInterval },
    });

    res.json({
      success: true,
      message: `Simulation started: ${maxCount} events will be emitted every ${minInterval}ms`,
    });
  } catch (error) {
    console.error("[FHIR-Streaming] Error starting simulation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start event simulation",
    });
  }
});

export default router;
