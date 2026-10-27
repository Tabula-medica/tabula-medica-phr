import { db } from "./db";
import { baaAgreements } from "@shared/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { logger } from "./utils/logger";

export class BaaAgreementService {
  async getAgreements(userId: string) {
    return db.select().from(baaAgreements).where(eq(baaAgreements.userId, userId)).orderBy(baaAgreements.createdAt);
  }

  async getAgreementById(userId: string, id: string) {
    const [agreement] = await db
      .select()
      .from(baaAgreements)
      .where(and(eq(baaAgreements.id, id), eq(baaAgreements.userId, userId)));
    return agreement || null;
  }

  async createAgreement(data: {
    userId: string;
    partnerName: string;
    partnerEmail: string;
    partnerOrganization?: string;
    status?: string;
    signedDate?: Date | null;
    expirationDate: Date;
    documentPath?: string;
    documentName?: string;
    documentMimeType?: string;
    documentSizeBytes?: number;
    notes?: string;
  }) {
    const [agreement] = await db
      .insert(baaAgreements)
      .values({
        ...data,
        status: data.status || "draft",
      })
      .returning();
    return agreement;
  }

  async updateAgreement(
    userId: string,
    id: string,
    updates: Partial<{
      partnerName: string;
      partnerEmail: string;
      partnerOrganization: string;
      status: string;
      signedDate: Date | null;
      expirationDate: Date;
      documentPath: string;
      documentName: string;
      documentMimeType: string;
      documentSizeBytes: number;
      notes: string;
    }>
  ) {
    const [agreement] = await db
      .update(baaAgreements)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(baaAgreements.id, id), eq(baaAgreements.userId, userId)))
      .returning();
    return agreement || null;
  }

  async deleteAgreement(userId: string, id: string) {
    const [deleted] = await db
      .delete(baaAgreements)
      .where(and(eq(baaAgreements.id, id), eq(baaAgreements.userId, userId)))
      .returning();
    return deleted || null;
  }

  async processExpirationReminders(): Promise<{ sent: number; errors: number }> {
    const now = new Date();
    let sent = 0;
    let errors = 0;

    const thresholds = [
      { days: 30, field: "reminderSent30Days" as const, label: "30-day" },
      { days: 14, field: "reminderSent14Days" as const, label: "14-day" },
      { days: 7, field: "reminderSent7Days" as const, label: "7-day" },
    ];

    for (const threshold of thresholds) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + threshold.days);
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      try {
        const agreements = await db
          .select()
          .from(baaAgreements)
          .where(
            and(
              eq(baaAgreements.status, "active"),
              eq(baaAgreements[threshold.field], false),
              gte(baaAgreements.expirationDate, dayStart),
              lte(baaAgreements.expirationDate, dayEnd)
            )
          );

        for (const agreement of agreements) {
          try {
            await this.sendReminderEmail(agreement, threshold.label);
            await db
              .update(baaAgreements)
              .set({
                [threshold.field]: true,
                lastReminderSentAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(baaAgreements.id, agreement.id));
            sent++;
            logger.info(
              `[BAA Reminder] Sent ${threshold.label} reminder to ${agreement.partnerEmail} for agreement ${agreement.id}`
            );
          } catch (err) {
            errors++;
            logger.error(`[BAA Reminder] Failed ${threshold.label} reminder for ${agreement.id}:`, err);
          }
        }
      } catch (err) {
        logger.error(`[BAA Reminder] Query error for ${threshold.label} threshold:`, err);
        errors++;
      }
    }

    return { sent, errors };
  }

  private async sendReminderEmail(
    agreement: typeof baaAgreements.$inferSelect,
    thresholdLabel: string
  ): Promise<void> {
    const expirationDateStr = agreement.expirationDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const emailPayload = {
      to: agreement.partnerEmail,
      subject: `BAA Agreement Expiring in ${thresholdLabel} - Action Required`,
      body: [
        `Dear ${agreement.partnerName},`,
        "",
        `This is a reminder that your Business Associate Agreement (BAA) with Tabula Medica is set to expire on ${expirationDateStr}.`,
        "",
        `Partner: ${agreement.partnerName}`,
        agreement.partnerOrganization ? `Organization: ${agreement.partnerOrganization}` : "",
        `Expiration Date: ${expirationDateStr}`,
        "",
        "To ensure continued compliance with HIPAA regulations, please renew your BAA before the expiration date.",
        "",
        "If you have any questions or need assistance with the renewal process, please contact our compliance team.",
        "",
        "Best regards,",
        "Tabula Medica Compliance Team",
      ]
        .filter(Boolean)
        .join("\n"),
    };

    logger.info(`[BAA Email] Would send to ${emailPayload.to}: ${emailPayload.subject}`);
    logger.info(`[BAA Email] Body preview: ${emailPayload.body.substring(0, 200)}...`);
  }

  async getExpiringAgreements(
    userId: string,
    daysAhead: number = 30
  ) {
    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return db
      .select()
      .from(baaAgreements)
      .where(
        and(
          eq(baaAgreements.userId, userId),
          eq(baaAgreements.status, "active"),
          lte(baaAgreements.expirationDate, futureDate),
          gte(baaAgreements.expirationDate, now)
        )
      );
  }

  async getStats(userId: string) {
    const all = await this.getAgreements(userId);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    return {
      total: all.length,
      active: all.filter((a) => a.status === "active").length,
      expired: all.filter((a) => a.status === "expired" || (a.status === "active" && a.expirationDate < now)).length,
      expiringSoon: all.filter(
        (a) => a.status === "active" && a.expirationDate >= now && a.expirationDate <= thirtyDaysFromNow
      ).length,
      draft: all.filter((a) => a.status === "draft").length,
    };
  }
}

export const baaAgreementService = new BaaAgreementService();
