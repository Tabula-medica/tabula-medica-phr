import { db } from "./db";
import { soc2RemediationTickets, soc2Evidence, users } from "@shared/schema";
import { eq, and, desc, gte, sql, or } from "drizzle-orm";
import { logger } from "./utils/logger";
import { randomBytes } from "crypto";

interface ControlFailure {
  controlId: string;
  controlName: string;
  category: string;
  severity: "critical" | "high" | "warning";
  reason: string;
  evidenceIds: string[];
  affectedUserIds: string[];
  incidentLogs: Record<string, unknown>[];
}

interface RemediationResult {
  ticketId: string;
  ticketRef: string;
  flaggedAccounts: string[];
  notificationsSent: { channel: string; recipient: string; sentAt: string; status: string }[];
}

const CONTROL_FAILURE_RULES: {
  controlId: string;
  check: (evidence: any[], allEvidence: any[]) => ControlFailure | null;
}[] = [
  {
    controlId: "CC6.1",
    check: (evidence, allEvidence) => {
      const criticalAuth = allEvidence.filter(
        (e) => e.controlId === "CC6.1" && e.severity === "critical"
      );
      if (criticalAuth.length >= 2) {
        return {
          controlId: "CC6.1",
          controlName: "Logical Access",
          category: "Logical & Physical Access",
          severity: "critical",
          reason: `${criticalAuth.length} critical authentication failures detected - potential brute force or credential stuffing attack`,
          evidenceIds: criticalAuth.map((e) => e.id),
          affectedUserIds: criticalAuth
            .map((e) => e.userId)
            .filter((id: string) => id !== "system"),
          incidentLogs: criticalAuth.map((e) => ({
            id: e.id,
            title: e.title,
            severity: e.severity,
            timestamp: e.collectedAt,
            metadata: e.metadata,
          })),
        };
      }
      return null;
    },
  },
  {
    controlId: "CC6.6",
    check: (evidence, allEvidence) => {
      const threats = allEvidence.filter(
        (e) => e.controlId === "CC6.6" && (e.severity === "critical" || e.severity === "high")
      );
      if (threats.length >= 3) {
        return {
          controlId: "CC6.6",
          controlName: "External Threats",
          category: "Logical & Physical Access",
          severity: "high",
          reason: `${threats.length} external threat events detected - potential intrusion attempt`,
          evidenceIds: threats.map((e) => e.id),
          affectedUserIds: threats
            .map((e) => e.userId)
            .filter((id: string) => id !== "system"),
          incidentLogs: threats.map((e) => ({
            id: e.id,
            title: e.title,
            severity: e.severity,
            timestamp: e.collectedAt,
            metadata: e.metadata,
          })),
        };
      }
      return null;
    },
  },
  {
    controlId: "CC7.2",
    check: (evidence, allEvidence) => {
      const anomalies = allEvidence.filter(
        (e) => e.controlId === "CC7.2" && e.severity === "critical"
      );
      if (anomalies.length >= 1) {
        return {
          controlId: "CC7.2",
          controlName: "Anomaly Detection",
          category: "System Operations",
          severity: "critical",
          reason: `Critical anomaly detected in system monitoring`,
          evidenceIds: anomalies.map((e) => e.id),
          affectedUserIds: anomalies
            .map((e) => e.userId)
            .filter((id: string) => id !== "system"),
          incidentLogs: anomalies.map((e) => ({
            id: e.id,
            title: e.title,
            severity: e.severity,
            timestamp: e.collectedAt,
            metadata: e.metadata,
          })),
        };
      }
      return null;
    },
  },
  {
    controlId: "CC7.1",
    check: (evidence, allEvidence) => {
      const detectionFailures = allEvidence.filter(
        (e) => e.controlId === "CC7.1" && e.severity === "critical"
      );
      if (detectionFailures.length >= 2) {
        return {
          controlId: "CC7.1",
          controlName: "Detection Monitoring",
          category: "System Operations",
          severity: "high",
          reason: `Multiple detection monitoring failures identified`,
          evidenceIds: detectionFailures.map((e) => e.id),
          affectedUserIds: [],
          incidentLogs: detectionFailures.map((e) => ({
            id: e.id,
            title: e.title,
            severity: e.severity,
            timestamp: e.collectedAt,
            metadata: e.metadata,
          })),
        };
      }
      return null;
    },
  },
  {
    controlId: "CC9.1",
    check: (evidence, allEvidence) => {
      const riskItems = allEvidence.filter(
        (e) => e.controlId === "CC9.1" && (e.severity === "critical" || e.severity === "high")
      );
      if (riskItems.length >= 2) {
        return {
          controlId: "CC9.1",
          controlName: "Risk Mitigation",
          category: "Risk Mitigation",
          severity: "high",
          reason: `${riskItems.length} unmitigated risk items detected`,
          evidenceIds: riskItems.map((e) => e.id),
          affectedUserIds: [],
          incidentLogs: riskItems.map((e) => ({
            id: e.id,
            title: e.title,
            severity: e.severity,
            timestamp: e.collectedAt,
            metadata: e.metadata,
          })),
        };
      }
      return null;
    },
  },
];

export class Soc2RemediationService {
  async evaluateAndRemediate(): Promise<RemediationResult[]> {
    logger.info("[Remediation] Starting automated remediation evaluation", { category: "compliance" });

    const since = new Date();
    since.setHours(since.getHours() - 24);

    const recentEvidence = await db
      .select()
      .from(soc2Evidence)
      .where(gte(soc2Evidence.collectedAt, since));

    const failures: ControlFailure[] = [];

    for (const rule of CONTROL_FAILURE_RULES) {
      const controlEvidence = recentEvidence.filter((e) => e.controlId === rule.controlId);
      const failure = rule.check(controlEvidence, recentEvidence);
      if (failure) {
        const existing = await db
          .select()
          .from(soc2RemediationTickets)
          .where(
            and(
              eq(soc2RemediationTickets.controlId, failure.controlId),
              eq(soc2RemediationTickets.status, "open"),
              gte(soc2RemediationTickets.createdAt, since)
            )
          )
          .limit(1);

        if (existing.length === 0) {
          failures.push(failure);
        }
      }
    }

    if (failures.length === 0) {
      logger.info("[Remediation] No control failures detected", { category: "compliance" });
      return [];
    }

    logger.warn(`[Remediation] ${failures.length} control failure(s) detected, triggering remediation`, { category: "compliance" });

    const results: RemediationResult[] = [];
    for (const failure of failures) {
      const result = await this.triggerRemediation(failure);
      results.push(result);
    }

    return results;
  }

  private async triggerRemediation(failure: ControlFailure): Promise<RemediationResult> {
    logger.info(`[Remediation] Triggering remediation for ${failure.controlId}: ${failure.reason}`, { category: "compliance" });

    const flaggedAccounts = await this.flagAffectedAccounts(failure);

    const { ticketId, ticketRef } = await this.createRemediationTicket(failure, flaggedAccounts);

    const notificationsSent = await this.sendSecurityAlerts(failure, ticketRef);

    await db
      .update(soc2RemediationTickets)
      .set({
        flaggedAccounts,
        notificationsSent,
        updatedAt: new Date(),
      })
      .where(eq(soc2RemediationTickets.id, ticketId));

    for (const evidenceId of failure.evidenceIds) {
      await db
        .update(soc2Evidence)
        .set({
          status: "needs_review",
          metadata: sql`COALESCE(${soc2Evidence.metadata}, '{}'::jsonb) || ${JSON.stringify({
            remediationTicketId: ticketId,
            remediationTicketRef: ticketRef,
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(soc2Evidence.id, evidenceId));
    }

    logger.info(`[Remediation] Remediation complete for ${failure.controlId}: ticket=${ticketRef}, flagged=${flaggedAccounts.length}, notifications=${notificationsSent.length}`, { category: "compliance" });

    return { ticketId, ticketRef, flaggedAccounts, notificationsSent };
  }

  private async flagAffectedAccounts(failure: ControlFailure): Promise<string[]> {
    const uniqueUserIds = [...new Set(failure.affectedUserIds)].filter(Boolean);
    if (uniqueUserIds.length === 0) return [];

    const flagged: string[] = [];
    for (const userId of uniqueUserIds) {
      try {
        await db
          .update(users)
          .set({
            securityFlagged: true,
            securityFlaggedAt: new Date(),
            securityFlagReason: `Automated remediation: ${failure.reason} (Control ${failure.controlId})`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        flagged.push(userId);
        logger.warn(`[Remediation] Account flagged: ${userId} for ${failure.controlId}`, { category: "compliance" });
      } catch (err) {
        logger.error(`[Remediation] Failed to flag account ${userId}`, { category: "compliance", error: err });
      }
    }

    return flagged;
  }

  private async createRemediationTicket(
    failure: ControlFailure,
    flaggedAccounts: string[]
  ): Promise<{ ticketId: string; ticketRef: string }> {
    const ticketRef = `REM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    const remediationSteps = this.generateRemediationSteps(failure);

    const [ticket] = await db
      .insert(soc2RemediationTickets)
      .values({
        controlId: failure.controlId,
        controlName: failure.controlName,
        category: failure.category,
        severity: failure.severity,
        status: "open",
        title: `[${failure.severity.toUpperCase()}] ${failure.controlName} - ${failure.reason}`,
        description: this.buildTicketDescription(failure, flaggedAccounts),
        incidentDetails: {
          reason: failure.reason,
          evidenceCount: failure.evidenceIds.length,
          evidenceIds: failure.evidenceIds,
          detectedAt: new Date().toISOString(),
          logs: failure.incidentLogs,
        },
        affectedUserIds: failure.affectedUserIds,
        remediationSteps,
        ticketRef,
        assignedTo: "compliance-team",
        flaggedAccounts,
      })
      .returning();

    logger.info(`[Remediation] Ticket created: ${ticketRef} (${ticket.id})`, { category: "compliance" });
    return { ticketId: ticket.id, ticketRef };
  }

  private generateRemediationSteps(failure: ControlFailure): string[] {
    const steps: string[] = [
      "Review attached incident logs and evidence",
      "Verify the scope and impact of the control failure",
    ];

    switch (failure.controlId) {
      case "CC6.1":
        steps.push(
          "Audit authentication logs for affected accounts",
          "Check for credential compromise indicators",
          "Enforce password reset for flagged accounts",
          "Review MFA enrollment status for affected users",
          "Update access control policies if needed"
        );
        break;
      case "CC6.6":
        steps.push(
          "Review firewall and WAF logs for attack patterns",
          "Block identified threat source IPs",
          "Check for data exfiltration indicators",
          "Update threat detection rules"
        );
        break;
      case "CC7.1":
      case "CC7.2":
        steps.push(
          "Verify monitoring system health",
          "Check alerting pipeline integrity",
          "Review system logs for undetected events",
          "Recalibrate detection thresholds"
        );
        break;
      case "CC9.1":
        steps.push(
          "Reassess risk registry entries",
          "Evaluate control effectiveness",
          "Implement additional mitigating controls",
          "Update risk treatment plan"
        );
        break;
      default:
        steps.push(
          "Investigate root cause",
          "Implement corrective actions",
          "Document findings and resolution"
        );
    }

    steps.push(
      "Document resolution and lessons learned",
      "Unflag affected accounts after verification",
      "Close ticket with resolution notes"
    );

    return steps;
  }

  private buildTicketDescription(failure: ControlFailure, flaggedAccounts: string[]): string {
    const lines = [
      `## Automated Remediation Ticket`,
      ``,
      `**Control:** ${failure.controlId} - ${failure.controlName}`,
      `**Category:** ${failure.category}`,
      `**Severity:** ${failure.severity.toUpperCase()}`,
      `**Detected:** ${new Date().toISOString()}`,
      ``,
      `### Incident Summary`,
      failure.reason,
      ``,
      `### Evidence`,
      `- ${failure.evidenceIds.length} evidence item(s) linked`,
      `- ${failure.incidentLogs.length} incident log(s) attached`,
      ``,
    ];

    if (flaggedAccounts.length > 0) {
      lines.push(
        `### Flagged Accounts`,
        `${flaggedAccounts.length} account(s) temporarily flagged for security review:`,
        ...flaggedAccounts.map((id) => `- Account ID: ${id.substring(0, 8)}...`),
        ``
      );
    }

    lines.push(
      `### Required Actions`,
      `1. Review incident logs and confirm the control failure`,
      `2. Verify affected accounts and remove flags after investigation`,
      `3. Implement corrective measures`,
      `4. Close this ticket with resolution notes`
    );

    return lines.join("\n");
  }

  private async sendSecurityAlerts(
    failure: ControlFailure,
    ticketRef: string
  ): Promise<{ channel: string; recipient: string; sentAt: string; status: string }[]> {
    const notifications: { channel: string; recipient: string; sentAt: string; status: string }[] = [];

    try {
      const emailResult = await this.sendEmailAlert(failure, ticketRef);
      notifications.push(emailResult);
    } catch (err) {
      logger.error("[Remediation] Email alert failed", { category: "compliance", error: err });
      notifications.push({
        channel: "email",
        recipient: "compliance@tabulamedica.health",
        sentAt: new Date().toISOString(),
        status: "failed",
      });
    }

    try {
      const slackResult = await this.sendSlackAlert(failure, ticketRef);
      notifications.push(slackResult);
    } catch (err) {
      logger.error("[Remediation] Slack alert failed", { category: "compliance", error: err });
      notifications.push({
        channel: "slack",
        recipient: "#security-alerts",
        sentAt: new Date().toISOString(),
        status: "failed",
      });
    }

    return notifications;
  }

  private async sendEmailAlert(
    failure: ControlFailure,
    ticketRef: string
  ): Promise<{ channel: string; recipient: string; sentAt: string; status: string }> {
    const recipient = process.env.SECURITY_ALERT_EMAIL || "compliance@tabulamedica.health";
    const subject = `[SOC 2 ALERT] ${failure.severity.toUpperCase()}: ${failure.controlName} Control Failure - ${ticketRef}`;

    const body = [
      `SOC 2 Automated Remediation Alert`,
      ``,
      `Ticket: ${ticketRef}`,
      `Control: ${failure.controlId} - ${failure.controlName}`,
      `Category: ${failure.category}`,
      `Severity: ${failure.severity.toUpperCase()}`,
      `Detected: ${new Date().toISOString()}`,
      ``,
      `Incident: ${failure.reason}`,
      `Evidence Items: ${failure.evidenceIds.length}`,
      `Affected Accounts: ${failure.affectedUserIds.length}`,
      ``,
      `Action Required: Review and resolve in the SOC 2 Compliance Dashboard.`,
    ].join("\n");

    if (process.env.SENDGRID_API_KEY) {
      try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: recipient }] }],
            from: { email: process.env.SENDGRID_FROM_EMAIL || "noreply@tabulamedica.health" },
            subject,
            content: [{ type: "text/plain", value: body }],
          }),
        });

        if (response.ok) {
          logger.info(`[Remediation] Email alert sent to ${recipient}`, { category: "compliance" });
          return { channel: "email", recipient, sentAt: new Date().toISOString(), status: "sent" };
        }
      } catch (err) {
        logger.error("[Remediation] SendGrid delivery failed", { category: "compliance", error: err });
      }
    }

    logger.info(`[Remediation] Email alert queued (no email provider configured): ${subject}`, { category: "compliance" });
    return { channel: "email", recipient, sentAt: new Date().toISOString(), status: "queued" };
  }

  private async sendSlackAlert(
    failure: ControlFailure,
    ticketRef: string
  ): Promise<{ channel: string; recipient: string; sentAt: string; status: string }> {
    const channel = process.env.SLACK_SECURITY_CHANNEL || "#security-alerts";
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    const severityEmoji: Record<string, string> = {
      critical: "rotating_light",
      high: "warning",
      warning: "large_yellow_circle",
    };
    const emoji = severityEmoji[failure.severity] || "bell";

    const payload = {
      channel,
      username: "SOC 2 Remediation Bot",
      icon_emoji: `:${emoji}:`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `SOC 2 Control Failure: ${failure.controlId}`,
          },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Control:*\n${failure.controlName}` },
            { type: "mrkdwn", text: `*Severity:*\n${failure.severity.toUpperCase()}` },
            { type: "mrkdwn", text: `*Ticket:*\n${ticketRef}` },
            { type: "mrkdwn", text: `*Evidence:*\n${failure.evidenceIds.length} item(s)` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Incident:*\n${failure.reason}` },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Affected Accounts:* ${failure.affectedUserIds.length} | *Action Required:* Review in SOC 2 Dashboard`,
          },
        },
      ],
    };

    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          logger.info(`[Remediation] Slack alert sent to ${channel}`, { category: "compliance" });
          return { channel: "slack", recipient: channel, sentAt: new Date().toISOString(), status: "sent" };
        }
      } catch (err) {
        logger.error("[Remediation] Slack webhook delivery failed", { category: "compliance", error: err });
      }
    }

    logger.info(`[Remediation] Slack alert queued (no webhook configured): ${failure.controlId}`, { category: "compliance" });
    return { channel: "slack", recipient: channel, sentAt: new Date().toISOString(), status: "queued" };
  }

  async getTickets(filters?: { status?: string; severity?: string }): Promise<any[]> {
    let query = db.select().from(soc2RemediationTickets).orderBy(desc(soc2RemediationTickets.createdAt));

    if (filters?.status) {
      query = query.where(eq(soc2RemediationTickets.status, filters.status)) as any;
    }

    return query.limit(100);
  }

  async resolveTicket(
    ticketId: string,
    resolvedBy: string,
    resolvedNotes: string
  ): Promise<any> {
    const [ticket] = await db
      .select()
      .from(soc2RemediationTickets)
      .where(eq(soc2RemediationTickets.id, ticketId))
      .limit(1);

    if (!ticket) throw new Error("Ticket not found");

    const flaggedAccounts = (ticket.flaggedAccounts as string[]) || [];
    for (const userId of flaggedAccounts) {
      await db
        .update(users)
        .set({
          securityFlagged: false,
          securityFlagReason: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }

    const [updated] = await db
      .update(soc2RemediationTickets)
      .set({
        status: "resolved",
        resolvedBy,
        resolvedAt: new Date(),
        resolvedNotes,
        updatedAt: new Date(),
      })
      .where(eq(soc2RemediationTickets.id, ticketId))
      .returning();

    logger.info(`[Remediation] Ticket resolved: ${ticket.ticketRef} by ${resolvedBy}`, { category: "compliance" });
    return updated;
  }

  async getTicketStats(): Promise<{
    total: number;
    open: number;
    resolved: number;
    critical: number;
    high: number;
    flaggedAccounts: number;
  }> {
    const tickets = await db.select().from(soc2RemediationTickets);
    const flaggedUsers = await db
      .select()
      .from(users)
      .where(eq(users.securityFlagged, true));

    return {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      critical: tickets.filter((t) => t.severity === "critical" && t.status === "open").length,
      high: tickets.filter((t) => t.severity === "high" && t.status === "open").length,
      flaggedAccounts: flaggedUsers.length,
    };
  }

  async triggerManualEvaluation(): Promise<RemediationResult[]> {
    return this.evaluateAndRemediate();
  }
}

export const soc2RemediationService = new Soc2RemediationService();
