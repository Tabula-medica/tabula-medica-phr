import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// HIPAA compliance: Auth0 has been removed from the patient path (no BAA).
// Identity-verification sync now flows from the GCIP provider only.
const VALID_PROVIDERS = ["gcip"] as const;

export function registerAuthRoutes(app: Express): void {
  // Session probe — must NOT 401 for anonymous visitors. Returning 200 with
  // a null body lets the frontend cleanly distinguish "not logged in" from
  // "auth check failed" without polluting the browser console with 401s on
  // every public page load (landing, /symptom-checker, /ccpa, etc.).
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.json(null);
      }
      const user = await authStorage.getUser(userId);
      res.json(user ?? null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users/verify-status", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const syncToken = process.env.INTERNAL_SYNC_TOKEN;

      if (!syncToken || token !== syncToken) {
        console.warn("[VerifySync] Unauthorized verification sync attempt");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { email, isVerified, provider } = req.body;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ message: "Valid email is required" });
      }

      if (typeof isVerified !== "boolean") {
        return res.status(400).json({ message: "isVerified must be a boolean" });
      }

      if (!provider || !VALID_PROVIDERS.includes(provider)) {
        return res.status(400).json({ message: `provider must be one of: ${VALID_PROVIDERS.join(", ")}` });
      }

      const existingUser = await authStorage.getUserByEmail(email);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await authStorage.updateUserVerification(email, isVerified, provider);

      console.log(`[HIPAA-AUDIT][VerifySync] Identity verification synced: email=${email}, provider=${provider}, verified=${isVerified}`);

      res.status(200).json({ message: "Verification synced", userId: updatedUser?.id });
    } catch (error) {
      console.error("[VerifySync] Verification sync failed:", error);
      res.status(500).json({ message: "Verification sync failed" });
    }
  });
}
