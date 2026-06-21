import { maskSensitiveData } from '../utils/logger';

let gcpLog: any = null;

async function getGcpLog() {
  if (gcpLog) return gcpLog;
  if (process.env.NODE_ENV !== "production") return null;

  try {
    const { Logging } = await import('@google-cloud/logging');
    const logging = new Logging({ projectId: process.env.PROJECT_ID || 'united-planet-485003-n7' });
    gcpLog = logging.log('tabula-medica-app-log');
    return gcpLog;
  } catch (err) {
    console.error("[GCPLogging] Failed to initialize Cloud Logging:", (err as Error).message);
    return null;
  }
}

export async function secureLog(severity: string, message: string, metadata?: any) {
  const metadataSafe = maskSensitiveData(metadata);

  const log = await getGcpLog();
  if (log) {
    try {
      const entry = log.entry({ severity }, { message, ...metadataSafe });
      await log.write(entry);
    } catch (err) {
      console.error("[GCPLogging] Write failed:", (err as Error).message);
      console.log(JSON.stringify({ level: severity.toLowerCase(), msg: message, details: metadataSafe }));
    }
  } else {
    console.log(JSON.stringify({ level: severity.toLowerCase(), msg: message, details: metadataSafe }));
  }
}
