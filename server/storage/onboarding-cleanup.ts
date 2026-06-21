import { eq } from "drizzle-orm";
import { db } from "../db";
import { mobileOnboardingProgress } from "@shared/schema";

export async function clearMobileOnboardingProgress(
  userId: string,
  database: { delete: typeof db.delete } = db,
): Promise<void> {
  if (!userId) return;
  await database
    .delete(mobileOnboardingProgress)
    .where(eq(mobileOnboardingProgress.userId, userId));
}
