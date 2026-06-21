interface UserUploadQuota {
  count: number;
  windowStart: number;
}

const userUploadQuotas = new Map<string, UserUploadQuota>();

export const UPLOAD_QUOTA_WINDOW_MS = 60 * 60 * 1000;
export const UPLOAD_QUOTA_MAX_PER_WINDOW = 20;

export function checkAndIncrementUserUploadQuota(userId: string): boolean {
  const now = Date.now();
  const quota = userUploadQuotas.get(userId);
  if (!quota || now - quota.windowStart > UPLOAD_QUOTA_WINDOW_MS) {
    userUploadQuotas.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (quota.count >= UPLOAD_QUOTA_MAX_PER_WINDOW) {
    return false;
  }
  quota.count++;
  return true;
}
