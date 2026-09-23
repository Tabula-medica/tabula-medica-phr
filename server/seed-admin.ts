import { storage } from "./storage";
import { hashPassword } from "./auth/local-auth";
import { randomBytes } from "crypto";

export async function seedAdminUser(): Promise<void> {
  // P0-8: in production, admin seeding is opt-in only. Even with ADMIN_PASSWORD
  // set, require an explicit SEED_ADMIN=1 so a boot can never silently create or
  // re-provision a reachable admin account. (Dev/test still seed as before.)
  if (process.env.NODE_ENV === "production" && process.env.SEED_ADMIN !== "1") {
    console.warn("[SeedAdmin] Skipping admin seed in production (set SEED_ADMIN=1 to enable).");
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || "president@infotabula.digital";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[SeedAdmin] ADMIN_PASSWORD not set — skipping admin seed in production");
      return;
    }
    const generated = randomBytes(24).toString("base64url");
    console.warn(`[SeedAdmin] ADMIN_PASSWORD not set — generating ephemeral admin credentials for dev mode`);
    const existing = await storage.getUserByEmail(adminEmail);
    if (existing) {
      console.log(`[SeedAdmin] Admin user already exists: ${adminEmail}`);
      return;
    }
    const passwordHash = await hashPassword(generated);
    const user = await storage.createUser({
      email: adminEmail,
      firstName: "Admin",
      lastName: "President",
      passwordHash,
      authProvider: "local",
      role: "admin",
      mfaRequired: "false",
      emailVerified: true,
      status: "active",
    });
    console.log(`[SeedAdmin] Admin user created: ${adminEmail} (ID: ${user.id})`);
    return;
  }

  const existing = await storage.getUserByEmail(adminEmail);
  if (existing) {
    console.log(`[SeedAdmin] Admin user already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  const user = await storage.createUser({
    email: adminEmail,
    firstName: "Admin",
    lastName: "President",
    passwordHash,
    authProvider: "local",
    role: "admin",
    mfaRequired: "false",
    emailVerified: true,
    status: "active",
  });

  console.log(`[SeedAdmin] Admin user created: ${adminEmail} (ID: ${user.id})`);
}
