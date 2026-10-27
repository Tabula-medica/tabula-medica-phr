import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URI = "https://appleid.apple.com/auth/keys";

const APPLE_AUDIENCES = [
  process.env.APPLE_BUNDLE_ID,
  "app.replit.tabulamedica",
  "com.tabulamedica.app",
].filter((a): a is string => typeof a === "string" && a.length > 0);

const client = jwksClient({
  jwksUri: APPLE_JWKS_URI,
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error("Apple identity token missing kid"));
    return;
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      callback(err ?? new Error("Apple signing key not found"));
      return;
    }
    callback(null, key.getPublicKey());
  });
}

export interface VerifiedAppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  isPrivateRelay: boolean;
  audience: string;
}

export function verifyAppleIdentityToken(idToken: string): Promise<VerifiedAppleIdentity> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getSigningKey,
      {
        audience: APPLE_AUDIENCES as [string, ...string[]],
        issuer: APPLE_ISSUER,
        algorithms: ["RS256"],
        clockTolerance: 30,
      },
      (err: jwt.VerifyErrors | null, decoded: any) => {
        if (err) {
          reject(new Error(`Apple identity token verification failed: ${err.message}`));
          return;
        }
        if (!decoded || typeof decoded !== "object") {
          reject(new Error("Apple identity token decoded payload invalid"));
          return;
        }
        const payload = decoded as jwt.JwtPayload & {
          sub?: string;
          email?: string;
          email_verified?: string | boolean;
          is_private_email?: string | boolean;
          aud?: string | string[];
        };
        if (!payload.sub) {
          reject(new Error("Apple identity token missing sub claim"));
          return;
        }
        const audClaim = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
        resolve({
          sub: payload.sub,
          email: typeof payload.email === "string" ? payload.email : undefined,
          emailVerified: payload.email_verified === true || payload.email_verified === "true",
          isPrivateRelay:
            payload.is_private_email === true || payload.is_private_email === "true",
          audience: audClaim ?? "",
        });
      }
    );
  });
}
