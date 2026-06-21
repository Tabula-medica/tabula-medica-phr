import crypto from "crypto";

const CROSS_APP_SECRET = process.env.CROSS_APP_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_EXPIRY_SECONDS = 900;

interface CrossAppPayload {
  saidPatientId: string;
  hint: {
    cptCode: string;
    specialty: string;
  };
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export function generateCrossAppToken(opts: {
  saidPatientId: string;
  cptCode: string;
  specialty: string;
}): string {
  const now = Math.floor(Date.now() / 1000);

  const payload: CrossAppPayload = {
    saidPatientId: opts.saidPatientId,
    hint: {
      cptCode: opts.cptCode,
      specialty: opts.specialty,
    },
    iss: "https://tabulamedica.health",
    aud: "https://uninsurance.care",
    exp: now + TOKEN_EXPIRY_SECONDS,
    iat: now,
  };

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", CROSS_APP_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

export function verifyCrossAppToken(token: string): CrossAppPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;

    const expectedSig = crypto
      .createHmac("sha256", CROSS_APP_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) {
      console.error("[CrossApp] Invalid signature");
      return null;
    }

    const payload: CrossAppPayload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      console.error("[CrossApp] Token expired");
      return null;
    }

    if (payload.aud !== "https://uninsurance.care") {
      console.error("[CrossApp] Invalid audience");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("[CrossApp] Token verification failed:", error);
    return null;
  }
}

export function buildDeepLinkUrl(opts: {
  saidPatientId: string;
  cptCode: string;
  specialty: string;
}): string {
  const xtoken = generateCrossAppToken(opts);
  return `https://uninsurance.care/book?xtoken=${xtoken}`;
}
