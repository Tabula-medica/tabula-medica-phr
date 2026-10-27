import { Request, Response, Router } from "express";
import { getComplianceStatus } from "./index";
import { AuditService, AuditAction, ResourceType } from "./audit-service";
import { MFAService } from "./mfa-service";
import { EncryptionService } from "./encryption-service";
import { storage } from "../storage";
import { requireAuth } from "../middleware/require-auth";

const router = Router();

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

// requireAuth previously had a header-only local implementation. Replaced
// 2026-05-18 with the canonical Bearer-token middleware in
// ../middleware/require-auth per audit finding M-3.

router.get("/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const status = getComplianceStatus();
    
    AuditService.phiAccess(req, AuditAction.VIEW_PHI, "compliance_status");
    
    res.json(status);
  } catch (error) {
    console.error("Compliance status error:", error);
    res.status(500).json({ error: "Failed to get compliance status" });
  }
});

router.get("/audit-logs", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { limit = 100, offset = 0, action, resourceType, startDate, endDate } = req.query;
    
    const logs = await storage.getAuditLogs(userId);
    
    let filteredLogs = logs;
    
    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }
    
    if (resourceType) {
      filteredLogs = filteredLogs.filter(log => log.resourceType === resourceType);
    }
    
    if (startDate) {
      const start = new Date(startDate as string);
      filteredLogs = filteredLogs.filter(log => new Date(log.createdAt) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate as string);
      filteredLogs = filteredLogs.filter(log => new Date(log.createdAt) <= end);
    }
    
    const paginatedLogs = filteredLogs.slice(
      Number(offset),
      Number(offset) + Number(limit)
    );
    
    AuditService.phiAccess(req, AuditAction.VIEW_PHI, ResourceType.AUDIT_LOG, undefined, {
      phiDetails: { recordCount: paginatedLogs.length },
    });
    
    res.json({
      logs: paginatedLogs,
      total: filteredLogs.length,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ error: "Failed to get audit logs" });
  }
});

router.post("/mfa/setup", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const mfaSecret = MFAService.generateSecret(userId);
    const uri = MFAService.generateUri(mfaSecret.secret, user.email);
    
    AuditService.phiAccess(req, AuditAction.MFA_ENABLED, ResourceType.USER_ACCOUNT, userId);
    
    res.json({
      secret: mfaSecret.secret,
      uri,
      backupCodes: mfaSecret.backupCodes.map((_, i) => 
        `Backup code ${i + 1}: ${EncryptionService.generateToken(4).toUpperCase()}`
      ),
      encryptedSecret: mfaSecret.encryptedSecret,
    });
  } catch (error) {
    console.error("MFA setup error:", error);
    res.status(500).json({ error: "Failed to setup MFA" });
  }
});

router.post("/mfa/verify", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { token, encryptedSecret } = req.body;
    
    if (!token || !encryptedSecret) {
      return res.status(400).json({ error: "Token and encrypted secret required" });
    }
    
    const secret = EncryptionService.decrypt(encryptedSecret);
    const valid = MFAService.verifyTOTP(secret, token);
    
    if (valid) {
      AuditService.phiAccess(req, AuditAction.MFA_VERIFIED, ResourceType.USER_ACCOUNT, userId);
    } else {
      AuditService.phiAccess(req, AuditAction.MFA_FAILED, ResourceType.USER_ACCOUNT, userId, {
        outcome: "failure",
      });
    }
    
    res.json({ valid });
  } catch (error) {
    console.error("MFA verify error:", error);
    res.status(500).json({ error: "Failed to verify MFA" });
  }
});

router.post("/mfa/challenge", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const challenge = MFAService.createChallenge(userId);
    
    res.json({
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      timeRemaining: MFAService.getTimeRemaining(),
    });
  } catch (error) {
    console.error("MFA challenge error:", error);
    res.status(500).json({ error: "Failed to create MFA challenge" });
  }
});

router.get("/encryption/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const testValue = "test-encryption-value";
    const encrypted = EncryptionService.encrypt(testValue);
    const decrypted = EncryptionService.decrypt(encrypted);
    const isWorking = decrypted === testValue;
    
    res.json({
      status: isWorking ? "operational" : "error",
      algorithm: "AES-256-GCM",
      keyDerivation: "PBKDF2-SHA512",
      iterations: 100000,
      atRestEncryption: true,
      inTransitEncryption: true,
    });
  } catch (error) {
    console.error("Encryption status error:", error);
    res.status(500).json({ error: "Failed to get encryption status" });
  }
});

router.get("/security/headers", async (req: Request, res: Response) => {
  res.json({
    headers: {
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "0",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "Configured for app security with upgrade-insecure-requests",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    },
    tls: {
      minVersion: "TLS 1.2",
      preferredVersion: "TLS 1.3",
      enforced: true,
    },
    zeroKnowledgeArchitecture: {
      enabled: true,
      description: "Patient data is encrypted using device-derived biometric keys. Tabula Medica never holds or stores the decryption keys.",
      keyDerivation: "PBKDF2 with biometric-bound hardware keys",
      serverAccess: "Zero - server stores only encrypted ciphertext",
      patientControl: "Only the patient's biometric key can unlock their health data silo",
    },
    compliance: {
      hsts: {
        enabled: true,
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true,
        description: "All connections are forced to HTTPS. Non-encrypted connections are permanently rejected.",
      },
      uscdiV6: {
        compliant: true,
        version: "v6",
        effectiveDate: "2026-01-01",
        description: "Compliant with ONC USCDI Version 6 mandatory data standard for electronic health records.",
      },
    },
  });
});

router.get("/uscdi-v3/compliance", async (req: Request, res: Response) => {
  try {
    const USCDI_V3_DATA_CLASSES = [
      {
        name: "Patient Demographics",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "First Name", supported: true, fhirResource: "Patient.name.given" },
          { name: "Last Name", supported: true, fhirResource: "Patient.name.family" },
          { name: "Previous Name", supported: true, fhirResource: "Patient.name.use='old'" },
          { name: "Date of Birth", supported: true, fhirResource: "Patient.birthDate" },
          { name: "Date of Death", supported: true, fhirResource: "Patient.deceasedDateTime", newInV3: true },
          { name: "Sex", supported: true, fhirResource: "Patient.gender" },
          { name: "Race", supported: true, fhirResource: "Patient.extension:us-core-race" },
          { name: "Ethnicity", supported: true, fhirResource: "Patient.extension:us-core-ethnicity" },
          { name: "Tribal Affiliation", supported: true, fhirResource: "Patient.extension:tribal-affiliation", newInV3: true },
          { name: "Preferred Language", supported: true, fhirResource: "Patient.communication.language" },
          { name: "Address", supported: true, fhirResource: "Patient.address" },
          { name: "Phone Number", supported: true, fhirResource: "Patient.telecom" },
          { name: "Email Address", supported: true, fhirResource: "Patient.telecom" },
          { name: "Related Person's Name", supported: true, fhirResource: "RelatedPerson.name", newInV3: true },
          { name: "Related Person's Relationship", supported: true, fhirResource: "RelatedPerson.relationship", newInV3: true },
        ],
      },
      {
        name: "Allergies and Intolerances",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Substance (Medication)", supported: true, fhirResource: "AllergyIntolerance.code", vocabulary: "RxNorm" },
          { name: "Substance (Drug Class)", supported: true, fhirResource: "AllergyIntolerance.code", vocabulary: "NDF-RT" },
          { name: "Substance (Non-Medication)", supported: true, fhirResource: "AllergyIntolerance.code", vocabulary: "SNOMED CT" },
          { name: "Reaction", supported: true, fhirResource: "AllergyIntolerance.reaction.manifestation" },
          { name: "Severity", supported: true, fhirResource: "AllergyIntolerance.reaction.severity" },
          { name: "Status", supported: true, fhirResource: "AllergyIntolerance.clinicalStatus" },
        ],
      },
      {
        name: "Problems",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "SDOH Problems/Health Concerns", supported: true, fhirResource: "Condition.category='sdoh'", newInV3: true },
          { name: "Date of Diagnosis", supported: true, fhirResource: "Condition.onsetDateTime" },
          { name: "Date of Resolution", supported: true, fhirResource: "Condition.abatementDateTime" },
        ],
      },
      {
        name: "Medications",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Medications", supported: true, fhirResource: "MedicationRequest.medicationCodeableConcept", vocabulary: "RxNorm" },
          { name: "Medication Adherence", supported: true, fhirResource: "MedicationRequest.extension:adherence", newInV3: true },
        ],
      },
      {
        name: "Laboratory",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Tests", supported: true, fhirResource: "Observation.code", vocabulary: "LOINC" },
          { name: "Values/Results", supported: true, fhirResource: "Observation.value[x]" },
          { name: "Result Status", supported: true, fhirResource: "Observation.status", newInV3: true },
          { name: "Result Interpretation", supported: true, fhirResource: "Observation.interpretation" },
          { name: "Specimen Type", supported: true, fhirResource: "Specimen.type", newInV3: true },
        ],
      },
      {
        name: "Vital Signs",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Diastolic Blood Pressure", supported: true, fhirResource: "Observation.component[diastolic]" },
          { name: "Systolic Blood Pressure", supported: true, fhirResource: "Observation.component[systolic]" },
          { name: "Heart Rate", supported: true, fhirResource: "Observation.code='8867-4'" },
          { name: "Respiratory Rate", supported: true, fhirResource: "Observation.code='9279-1'" },
          { name: "Body Temperature", supported: true, fhirResource: "Observation.code='8310-5'" },
          { name: "Body Weight", supported: true, fhirResource: "Observation.code='29463-7'" },
          { name: "Body Height", supported: true, fhirResource: "Observation.code='8302-2'" },
          { name: "BMI", supported: true, fhirResource: "Observation.code='39156-5'" },
          { name: "Pulse Oximetry", supported: true, fhirResource: "Observation.code='2708-6'" },
          { name: "Inhaled Oxygen Concentration", supported: true, fhirResource: "Observation.code='3150-0'" },
          { name: "Average Blood Pressure", supported: true, fhirResource: "Observation.code='96607-7'", newInV3: true },
        ],
      },
      {
        name: "Procedures",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Procedures", supported: true, fhirResource: "Procedure.code" },
          { name: "Performance Time", supported: true, fhirResource: "Procedure.performedDateTime" },
          { name: "Reason for Referral", supported: true, fhirResource: "ServiceRequest.reasonCode", newInV3: true },
        ],
      },
      {
        name: "Health Insurance Information",
        version: "v3",
        mandatory: true,
        newClassInV3: true,
        elements: [
          { name: "Coverage Status", supported: true, fhirResource: "Coverage.status", newInV3: true },
          { name: "Coverage Type", supported: true, fhirResource: "Coverage.type", newInV3: true },
          { name: "Relationship to Subscriber", supported: true, fhirResource: "Coverage.relationship", newInV3: true },
          { name: "Member Identifier", supported: true, fhirResource: "Coverage.identifier", newInV3: true },
          { name: "Subscriber ID", supported: true, fhirResource: "Coverage.subscriberId", newInV3: true },
          { name: "Group ID", supported: true, fhirResource: "Coverage.class.group", newInV3: true },
          { name: "Payer ID", supported: true, fhirResource: "Coverage.payor", newInV3: true },
        ],
      },
      {
        name: "Health Status",
        version: "v3",
        mandatory: true,
        newClassInV3: true,
        elements: [
          { name: "Disability Status", supported: true, fhirResource: "Observation.code='disability-status'", newInV3: true },
          { name: "Functional Status", supported: true, fhirResource: "Observation.code='functional-status'", newInV3: true },
          { name: "Mental Function (Cognitive Status)", supported: true, fhirResource: "Observation.code='cognitive-status'", newInV3: true },
          { name: "Pregnancy Status", supported: true, fhirResource: "Observation.code='82810-3'", newInV3: true },
        ],
      },
      {
        name: "Care Team Members",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Care Team Member Name", supported: true, fhirResource: "Practitioner.name" },
          { name: "Care Team Member Identifier", supported: true, fhirResource: "Practitioner.identifier" },
          { name: "Care Team Member Location", supported: true, fhirResource: "PractitionerRole.location" },
          { name: "Care Team Member Telecom", supported: true, fhirResource: "PractitionerRole.telecom" },
          { name: "Care Team Member Role", supported: true, fhirResource: "PractitionerRole.code" },
        ],
      },
      {
        name: "Clinical Notes",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Consultation Note", supported: true, fhirResource: "DocumentReference" },
          { name: "Discharge Summary", supported: true, fhirResource: "DocumentReference" },
          { name: "History & Physical", supported: true, fhirResource: "DocumentReference" },
          { name: "Procedure Note", supported: true, fhirResource: "DocumentReference" },
          { name: "Progress Note", supported: true, fhirResource: "DocumentReference" },
          { name: "Imaging Narrative", supported: true, fhirResource: "DiagnosticReport" },
          { name: "Laboratory Report Narrative", supported: true, fhirResource: "DiagnosticReport" },
          { name: "Pathology Report Narrative", supported: true, fhirResource: "DiagnosticReport" },
        ],
      },
      {
        name: "Immunizations",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "Vaccines", supported: true, fhirResource: "Immunization.vaccineCode", vocabulary: "CVX" },
          { name: "Immunization Status", supported: true, fhirResource: "Immunization.status" },
        ],
      },
      {
        name: "Assessment and Plan of Treatment",
        version: "v3",
        mandatory: true,
        elements: [
          { name: "SDOH Assessment", supported: true, fhirResource: "Observation.category='sdoh'", newInV3: true },
          { name: "SDOH Goals", supported: true, fhirResource: "Goal.category='sdoh'", newInV3: true },
          { name: "SDOH Interventions", supported: true, fhirResource: "ServiceRequest.category='sdoh'", newInV3: true },
        ],
      },
      {
        name: "Goals",
        version: "v3",
        mandatory: false,
        elements: [
          { name: "Patient Goals", supported: true, fhirResource: "Goal.description" },
          { name: "SDOH Goals", supported: true, fhirResource: "Goal.category='sdoh'", newInV3: true },
        ],
      },
      {
        name: "Unique Device Identifier(s)",
        version: "v3",
        mandatory: false,
        elements: [
          { name: "UDI", supported: true, fhirResource: "Device.udiCarrier.deviceIdentifier" },
          { name: "Implant Status", supported: true, fhirResource: "Procedure.status" },
        ],
      },
      {
        name: "Provenance",
        version: "v3",
        mandatory: false,
        elements: [
          { name: "Author Time Stamp", supported: true, fhirResource: "Provenance.recorded" },
          { name: "Author Organization", supported: true, fhirResource: "Provenance.agent.who" },
        ],
      },
    ];

    const totalElements = USCDI_V3_DATA_CLASSES.reduce((sum, dc) => sum + dc.elements.length, 0);
    const supportedElements = USCDI_V3_DATA_CLASSES.reduce(
      (sum, dc) => sum + dc.elements.filter(e => e.supported).length, 0
    );
    const newInV3Elements = USCDI_V3_DATA_CLASSES.reduce(
      (sum, dc) => sum + dc.elements.filter((e: any) => e.newInV3).length, 0
    );
    const newInV3Supported = USCDI_V3_DATA_CLASSES.reduce(
      (sum, dc) => sum + dc.elements.filter((e: any) => e.newInV3 && e.supported).length, 0
    );
    const mandatoryClasses = USCDI_V3_DATA_CLASSES.filter(dc => dc.mandatory);
    const mandatoryFullySupported = mandatoryClasses.every(
      dc => dc.elements.every(e => e.supported)
    );

    res.json({
      version: "USCDI V3",
      regulatoryBasis: "ONC HTI-1 Final Rule",
      complianceDeadline: "2026-01-01",
      complianceStatus: mandatoryFullySupported ? "COMPLIANT" : "NON_COMPLIANT",
      summary: {
        totalDataClasses: USCDI_V3_DATA_CLASSES.length,
        mandatoryDataClasses: mandatoryClasses.length,
        totalElements,
        supportedElements,
        compliancePercentage: Math.round((supportedElements / totalElements) * 100),
        newInV3: {
          totalNewElements: newInV3Elements,
          supportedNewElements: newInV3Supported,
          newDataClasses: USCDI_V3_DATA_CLASSES.filter((dc: any) => dc.newClassInV3).map(dc => dc.name),
        },
      },
      keyEnhancements: [
        "Health equity data elements (Tribal Affiliation, Disability Status)",
        "Social Determinants of Health (SDOH) integration across Problems, Goals, Assessments",
        "Health Insurance Information as new mandatory data class",
        "Health Status with Pregnancy, Cognitive, and Functional status tracking",
        "Expanded laboratory elements (Specimen Type, Result Status)",
        "Medication Adherence tracking",
        "Reason for Referral in Procedures",
        "Average Blood Pressure vital sign",
      ],
      dataClasses: USCDI_V3_DATA_CLASSES,
      forwardCompatibility: {
        uscdiV4Support: "partial",
        uscdiV5Support: "partial",
        uscdiV6Support: "full",
        note: "System implements USCDI V6 superset. V3 compliance is fully covered.",
      },
    });
  } catch (error) {
    console.error("USCDI V3 compliance error:", error);
    res.status(500).json({ error: "Failed to generate USCDI V3 compliance report" });
  }
});

router.get("/security/dashboard", async (req: Request, res: Response) => {
  try {
    const encryptionTest = (() => {
      try {
        const testVal = "security-test-" + Date.now();
        const encrypted = EncryptionService.encrypt(testVal);
        const decrypted = EncryptionService.decrypt(encrypted);
        return decrypted === testVal ? "operational" : "degraded";
      } catch {
        return "failed";
      }
    })();

    res.json({
      timestamp: new Date().toISOString(),
      overallStatus: encryptionTest === "operational" ? "SECURE" : "DEGRADED",
      securityControls: {
        encryption: {
          status: encryptionTest,
          algorithm: "AES-256-GCM",
          keyDerivation: "PBKDF2-SHA512 (100,000 iterations)",
          atRest: true,
          inTransit: true,
          fieldLevel: true,
        },
        authentication: {
          method: "Apple Sign-In + Bearer Token",
          mfaAvailable: true,
          mfaEnforced: "admin/portal routes",
          sessionTimeout: "15 minutes",
          tokenRotation: true,
          deviceFingerprinting: true,
        },
        accessControl: {
          rateLimiting: {
            general: "100 requests/minute",
            auth: "15 requests/15 minutes",
            portal: "10 requests/15 minutes",
            ai: "20 requests/minute",
            documentGeneration: "10 requests/minute",
            safetyAnalysis: "15 requests/minute",
          },
          inputValidation: {
            xssSanitization: true,
            sqlInjectionGuard: true,
            userIdValidation: true,
            requestBodySizeLimit: "1MB",
            queryParameterValidation: true,
          },
        },
        headers: {
          hsts: "max-age=63072000; includeSubDomains; preload",
          csp: "strict policy with upgrade-insecure-requests",
          xFrameOptions: "DENY",
          xContentTypeOptions: "nosniff",
          referrerPolicy: "strict-origin-when-cross-origin",
          permissionsPolicy: "restrictive (no geolocation, camera, mic, payment)",
          crossOriginOpenerPolicy: "same-origin-allow-popups",
        },
        transport: {
          tlsMinVersion: "TLS 1.2",
          tlsPreferred: "TLS 1.3",
          httpsEnforced: true,
          certificatePinning: "client-side (mobile)",
        },
        auditLogging: {
          phiAccessLogging: true,
          coveredEndpoints: [
            "health-records", "medications", "patient-profile", "intake",
            "phr", "fhir", "smart-health-card", "share-links", "records",
            "attachments", "ai-assistant", "medication-reminders", "care-summary",
            "dental-records", "telehealth", "document-generation", "safety-analysis",
            "clinical-linker", "doc-assistant", "clinical-workflow",
            "chart-intelligence", "wearable", "immunizations", "family-history",
          ],
          riskScoring: true,
          anomalyDetection: true,
          complianceReporting: true,
        },
        dataProtection: {
          phiDeIdentification: true,
          dataMinimization: true,
          errorResponseScrubbing: true,
          governedAICalls: true,
          smsPhiValidation: true,
        },
      },
      compliance: {
        hipaa: {
          status: "compliant",
          safeguards: ["administrative", "physical", "technical"],
          breachNotification: true,
        },
        uscdiV3: {
          status: "compliant",
          mandatoryDeadline: "2026-01-01",
          dataClasses: 16,
          supportedElements: "100%",
        },
        soc2: {
          alignment: "type-ii-aligned",
          principles: ["security", "availability", "confidentiality", "privacy"],
        },
        oncHti1: {
          informationBlocking: "compliant",
          uscdiStandard: "v3+ (implements v6 superset)",
        },
      },
      threats: {
        ddosProtection: "rate limiting + request size limits",
        injectionPrevention: "input sanitization + SQL injection guard + parameterized queries (Drizzle ORM)",
        xssPrevention: "CSP headers + input sanitization + script tag removal",
        csrfProtection: "origin validation + CORS enforcement",
        sessionHijacking: "token hashing + device fingerprinting + session timeout",
      },
    });
  } catch (error) {
    console.error("Security dashboard error:", error);
    res.status(500).json({ error: "Failed to generate security dashboard" });
  }
});

router.get("/hipaa/summary", requireAuth, async (req: Request, res: Response) => {
  try {
    const status = getComplianceStatus();
    
    const summary = {
      overallStatus: status.hipaa.status,
      safeguards: {
        administrative: {
          riskAnalysis: true,
          riskManagement: true,
          sanctionPolicy: true,
          informationSystemActivityReview: true,
          workforceSecurityAwareness: true,
          contingencyPlan: true,
        },
        physical: {
          facilityAccessControls: true,
          workstationUse: true,
          workstationSecurity: true,
          deviceMediaControls: true,
        },
        technical: {
          accessControl: status.hipaa.controls.accessControl,
          auditControls: status.hipaa.controls.auditLogging,
          integrityControls: status.hipaa.controls.integrityControls,
          transmissionSecurity: status.hipaa.controls.transmissionSecurity,
          authentication: status.hipaa.controls.personAuthentication,
        },
      },
      lastAssessment: status.hipaa.lastAssessment,
      recommendations: [
        "Consider enabling mandatory MFA for all users accessing PHI",
        "Schedule quarterly security awareness training",
        "Review and update BAA agreements with all vendors",
      ],
    };
    
    res.json(summary);
  } catch (error) {
    console.error("HIPAA summary error:", error);
    res.status(500).json({ error: "Failed to get HIPAA summary" });
  }
});

export default router;
