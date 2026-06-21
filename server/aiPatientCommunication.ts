import { Router, Request, Response } from "express";
import {
  draftResponseToInquiry,
  generateAppointmentReminder,
  generateFollowUpMessage,
  getAllInquiries,
  getInquiryById,
  getAllResponseDrafts,
  getResponseDraftById,
  approveResponseDraft,
  rejectResponseDraft,
  getAllProactiveMessages,
  getProactiveMessageById,
  cancelProactiveMessage,
  sendProactiveMessage,
  getProactiveMessageStats,
  triagePatientMessage,
  getAllTriages,
  getTriageById,
  updateTriageStatus,
  getDepartments,
  getCommunicationDashboard,
  PatientContext,
  PatientInquiry,
  UpcomingAppointment,
} from "./services/aiPatientCommunicationService";

const router = Router();

router.get("/inquiries", async (req: Request, res: Response) => {
  try {
    const inquiries = getAllInquiries();
    res.json(inquiries);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching inquiries:", error);
    res.status(500).json({ error: "Failed to fetch patient inquiries" });
  }
});

router.get("/inquiries/:id", async (req: Request, res: Response) => {
  try {
    const inquiry = getInquiryById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }
    res.json(inquiry);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching inquiry:", error);
    res.status(500).json({ error: "Failed to fetch inquiry" });
  }
});

router.post("/inquiries/:id/draft-response", async (req: Request, res: Response) => {
  try {
    const inquiry = getInquiryById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    const context: PatientContext = req.body.context || {
      patientId: inquiry.patientId,
      patientName: inquiry.patientName,
      recentInteractions: [],
      upcomingAppointments: [],
      activeMedications: [],
    };

    const draft = await draftResponseToInquiry(inquiry, context);
    res.json(draft);
  } catch (error) {
    console.error("[AIPatientCommunication] Error drafting response:", error);
    res.status(500).json({ error: "Failed to draft response" });
  }
});

router.get("/response-drafts", async (req: Request, res: Response) => {
  try {
    const drafts = getAllResponseDrafts();
    res.json(drafts);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching drafts:", error);
    res.status(500).json({ error: "Failed to fetch response drafts" });
  }
});

router.get("/response-drafts/:id", async (req: Request, res: Response) => {
  try {
    const draft = getResponseDraftById(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    res.json(draft);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching draft:", error);
    res.status(500).json({ error: "Failed to fetch draft" });
  }
});

router.post("/response-drafts/:id/approve", async (req: Request, res: Response) => {
  try {
    const { approvedBy } = req.body;
    if (!approvedBy) {
      return res.status(400).json({ error: "approvedBy is required" });
    }

    const draft = approveResponseDraft(req.params.id, approvedBy);
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    res.json(draft);
  } catch (error) {
    console.error("[AIPatientCommunication] Error approving draft:", error);
    res.status(500).json({ error: "Failed to approve draft" });
  }
});

router.post("/response-drafts/:id/reject", async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const draft = rejectResponseDraft(req.params.id, reason || "Rejected by care team");
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    res.json(draft);
  } catch (error) {
    console.error("[AIPatientCommunication] Error rejecting draft:", error);
    res.status(500).json({ error: "Failed to reject draft" });
  }
});

router.get("/proactive-messages", async (req: Request, res: Response) => {
  try {
    const messages = getAllProactiveMessages();
    res.json(messages);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch proactive messages" });
  }
});

router.get("/proactive-messages/stats", async (req: Request, res: Response) => {
  try {
    const stats = getProactiveMessageStats();
    res.json(stats);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch message stats" });
  }
});

router.get("/proactive-messages/:id", async (req: Request, res: Response) => {
  try {
    const message = getProactiveMessageById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(message);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching message:", error);
    res.status(500).json({ error: "Failed to fetch message" });
  }
});

router.post("/proactive-messages/:id/send", async (req: Request, res: Response) => {
  try {
    const message = sendProactiveMessage(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(message);
  } catch (error) {
    console.error("[AIPatientCommunication] Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/proactive-messages/:id/cancel", async (req: Request, res: Response) => {
  try {
    const message = cancelProactiveMessage(req.params.id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(message);
  } catch (error) {
    console.error("[AIPatientCommunication] Error cancelling message:", error);
    res.status(500).json({ error: "Failed to cancel message" });
  }
});

router.post("/generate/appointment-reminder", async (req: Request, res: Response) => {
  try {
    const { patientId, patientName, appointment, context } = req.body;
    
    if (!patientId || !patientName || !appointment) {
      return res.status(400).json({ error: "patientId, patientName, and appointment are required" });
    }

    const message = await generateAppointmentReminder(patientId, patientName, appointment, context);
    res.json(message);
  } catch (error) {
    console.error("[AIPatientCommunication] Error generating reminder:", error);
    res.status(500).json({ error: "Failed to generate appointment reminder" });
  }
});

router.post("/generate/follow-up", async (req: Request, res: Response) => {
  try {
    const { patientId, patientName, context, followUpType } = req.body;
    
    if (!patientId || !patientName || !followUpType) {
      return res.status(400).json({ error: "patientId, patientName, and followUpType are required" });
    }

    const patientContext: PatientContext = context || {
      patientId,
      patientName,
      recentInteractions: [],
      upcomingAppointments: [],
      activeMedications: [],
    };

    const message = await generateFollowUpMessage(patientId, patientName, patientContext, followUpType);
    res.json(message);
  } catch (error) {
    console.error("[AIPatientCommunication] Error generating follow-up:", error);
    res.status(500).json({ error: "Failed to generate follow-up message" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const dashboard = getCommunicationDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

router.get("/triages", async (req: Request, res: Response) => {
  try {
    const triages = getAllTriages();
    res.json(triages);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching triages:", error);
    res.status(500).json({ error: "Failed to fetch triages" });
  }
});

router.get("/triages/:id", async (req: Request, res: Response) => {
  try {
    const triage = getTriageById(req.params.id);
    if (!triage) {
      return res.status(404).json({ error: "Triage not found" });
    }
    res.json(triage);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching triage:", error);
    res.status(500).json({ error: "Failed to fetch triage" });
  }
});

router.post("/inquiries/:id/triage", async (req: Request, res: Response) => {
  try {
    const inquiry = getInquiryById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ error: "Inquiry not found" });
    }

    const triageResult = await triagePatientMessage(inquiry);
    res.json(triageResult);
  } catch (error) {
    console.error("[AIPatientCommunication] Error triaging inquiry:", error);
    res.status(500).json({ error: "Failed to triage inquiry" });
  }
});

router.patch("/triages/:id/status", async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status || !["pending", "routed", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required (pending, routed, in_progress, resolved)" });
    }

    const triage = updateTriageStatus(req.params.id, status);
    if (!triage) {
      return res.status(404).json({ error: "Triage not found" });
    }
    res.json(triage);
  } catch (error) {
    console.error("[AIPatientCommunication] Error updating triage status:", error);
    res.status(500).json({ error: "Failed to update triage status" });
  }
});

router.get("/departments", async (req: Request, res: Response) => {
  try {
    const depts = getDepartments();
    res.json(depts);
  } catch (error) {
    console.error("[AIPatientCommunication] Error fetching departments:", error);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

export default router;
