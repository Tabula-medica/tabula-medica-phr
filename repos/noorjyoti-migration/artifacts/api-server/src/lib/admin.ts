// Admin authorization is driven by the ADMIN_USER_IDS env var, a comma-separated
// list of Clerk user ids. Centralized here so both the admin-only track routes
// and the /api/me/admin probe agree on who is an administrator.

export function adminUserIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const admins = adminUserIds();
  if (admins.size === 0) return false;
  return admins.has(userId);
}
