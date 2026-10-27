import crypto from "crypto";

export interface WebAuthnCredential {
  credentialId: string;
  userId: string;
  publicKeyJwk: string;
  counter: number;
  aaguid: string;
  transports: string[];
  createdAt: Date;
}

export interface RegistrationOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: string; alg: number }[];
  timeout: number;
  authenticatorSelection: {
    authenticatorAttachment: string;
    requireResidentKey: boolean;
    userVerification: string;
  };
  attestation: string;
}

export interface AuthenticationOptions {
  challenge: string;
  timeout: number;
  rpId: string;
  allowCredentials: { type: string; id: string; transports: string[] }[];
  userVerification: string;
}

const RP_ID = process.env.WEBAUTHN_RP_ID || "tabulamedica.health";
const RP_NAME = "Tabula Medica";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const pendingChallenges = new Map<string, { challenge: string; userId?: string; expiresAt: Date }>();

setInterval(() => {
  const now = new Date();
  for (const [key, entry] of pendingChallenges.entries()) {
    if (now > entry.expiresAt) pendingChallenges.delete(key);
  }
}, 60_000);

function generateChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createRegistrationOptions(userId: string, email: string): RegistrationOptions {
  const challenge = generateChallenge();
  pendingChallenges.set(`reg:${userId}`, {
    challenge,
    userId,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });

  return {
    challenge,
    rp: { name: RP_NAME, id: RP_ID },
    user: {
      id: Buffer.from(userId).toString("base64url"),
      name: email,
      displayName: email,
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    timeout: CHALLENGE_TTL_MS,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      requireResidentKey: true,
      userVerification: "required",
    },
    attestation: "none",
  };
}

export function createAuthenticationOptions(
  credentials: Pick<WebAuthnCredential, "credentialId" | "transports">[]
): AuthenticationOptions {
  const challenge = generateChallenge();
  const sessionKey = `auth:${challenge}`;
  pendingChallenges.set(sessionKey, {
    challenge,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
  });

  return {
    challenge,
    timeout: CHALLENGE_TTL_MS,
    rpId: RP_ID,
    allowCredentials: credentials.map((c) => ({
      type: "public-key",
      id: c.credentialId,
      transports: c.transports,
    })),
    userVerification: "required",
  };
}

function decodeCBORValue(data: Buffer, offset: number): [unknown, number] {
  if (offset >= data.length) throw new Error("CBOR: unexpected end of data");
  const firstByte = data[offset];
  const majorType = (firstByte & 0xe0) >> 5;
  const additionalInfo = firstByte & 0x1f;
  offset++;

  let length: number;
  if (additionalInfo < 24) {
    length = additionalInfo;
  } else if (additionalInfo === 24) {
    length = data[offset++];
  } else if (additionalInfo === 25) {
    length = (data[offset] << 8) | data[offset + 1];
    offset += 2;
  } else if (additionalInfo === 26) {
    length = ((data[offset] << 24) >>> 0) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
    offset += 4;
  } else if (additionalInfo === 31 && majorType === 5) {
    const map: Record<string | number, unknown> = {};
    while (data[offset] !== 0xff) {
      const [key, afterKey] = decodeCBORValue(data, offset);
      const [val, afterVal] = decodeCBORValue(data, afterKey);
      map[key as string | number] = val;
      offset = afterVal;
    }
    return [map, offset + 1];
  } else {
    throw new Error(`CBOR: unsupported additional info ${additionalInfo}`);
  }

  switch (majorType) {
    case 0: return [length, offset];
    case 1: return [-(length + 1), offset];
    case 2: return [data.slice(offset, offset + length), offset + length];
    case 3: return [data.slice(offset, offset + length).toString("utf8"), offset + length];
    case 4: {
      const arr: unknown[] = [];
      for (let i = 0; i < length; i++) {
        const [item, next] = decodeCBORValue(data, offset);
        arr.push(item);
        offset = next;
      }
      return [arr, offset];
    }
    case 5: {
      const map: Record<string | number, unknown> = {};
      for (let i = 0; i < length; i++) {
        const [key, afterKey] = decodeCBORValue(data, offset);
        const [val, afterVal] = decodeCBORValue(data, afterKey);
        map[key as string | number] = val;
        offset = afterVal;
      }
      return [map, offset];
    }
    default: throw new Error(`CBOR: unsupported major type ${majorType}`);
  }
}

function decodeCBOR(data: Buffer): unknown {
  const [value] = decodeCBORValue(data, 0);
  return value;
}

interface ParsedAuthenticatorData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid?: string;
  credentialId?: string;
  cosePublicKey?: Buffer;
}

function parseAuthenticatorData(authData: Buffer): ParsedAuthenticatorData {
  if (authData.length < 37) throw new Error("Authenticator data too short");

  const rpIdHash = authData.slice(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);

  const AT_FLAG = 0x40;
  const UP_FLAG = 0x01;
  const UV_FLAG = 0x04;

  if (!(flags & UP_FLAG)) throw new Error("User presence flag not set");

  let offset = 37;
  let aaguid: string | undefined;
  let credentialId: string | undefined;
  let cosePublicKey: Buffer | undefined;

  if (flags & AT_FLAG && authData.length > 37) {
    const aaguidBytes = authData.slice(offset, offset + 16);
    aaguid = [
      aaguidBytes.slice(0, 4).toString("hex"),
      aaguidBytes.slice(4, 6).toString("hex"),
      aaguidBytes.slice(6, 8).toString("hex"),
      aaguidBytes.slice(8, 10).toString("hex"),
      aaguidBytes.slice(10, 16).toString("hex"),
    ].join("-");
    offset += 16;

    const credIdLen = authData.readUInt16BE(offset);
    offset += 2;
    credentialId = authData.slice(offset, offset + credIdLen).toString("base64url");
    offset += credIdLen;

    cosePublicKey = authData.slice(offset);
  }

  return { rpIdHash, flags, signCount, aaguid, credentialId, cosePublicKey };
}

function coseKeyToJwk(coseKeyBuf: Buffer): Record<string, string | number> {
  const coseKey = decodeCBOR(coseKeyBuf) as Record<number, unknown>;
  const kty = coseKey[1] as number;
  const alg = coseKey[3] as number;

  if (kty === 2) {
    const x = coseKey[-2] as Buffer;
    const y = coseKey[-3] as Buffer;
    return {
      kty: "EC",
      crv: "P-256",
      alg: "ES256",
      x: x.toString("base64url"),
      y: y.toString("base64url"),
    };
  }

  if (kty === 3) {
    const n = coseKey[-1] as Buffer;
    const e = coseKey[-2] as Buffer;
    return {
      kty: "RSA",
      alg: "RS256",
      n: n.toString("base64url"),
      e: e.toString("base64url"),
    };
  }

  throw new Error(`Unsupported COSE key type: ${kty}`);
}

export interface VerifiedRegistration {
  credentialId: string;
  publicKeyJwk: string;
  counter: number;
  aaguid: string;
  transports: string[];
}

export function verifyRegistration(
  userId: string,
  clientDataJSONBase64: string,
  attestationObjectBase64: string,
  transports: string[] = []
): VerifiedRegistration {
  const storedEntry = pendingChallenges.get(`reg:${userId}`);
  if (!storedEntry) throw new Error("No pending registration challenge for user");
  if (new Date() > storedEntry.expiresAt) {
    pendingChallenges.delete(`reg:${userId}`);
    throw new Error("Registration challenge expired");
  }
  pendingChallenges.delete(`reg:${userId}`);

  const clientDataJSON = Buffer.from(clientDataJSONBase64, "base64url");
  const clientData = JSON.parse(clientDataJSON.toString("utf8"));

  if (clientData.type !== "webauthn.create") throw new Error("Invalid clientData type");
  if (clientData.challenge !== storedEntry.challenge) throw new Error("Challenge mismatch");

  const attestationObject = Buffer.from(attestationObjectBase64, "base64url");
  const attObj = decodeCBOR(attestationObject) as Record<string, unknown>;

  const authData = attObj["authData"] as Buffer;
  if (!authData) throw new Error("Missing authData in attestation");

  const rpIdHash = crypto.createHash("sha256").update(RP_ID).digest();
  const parsed = parseAuthenticatorData(authData);

  if (!parsed.rpIdHash.equals(rpIdHash)) throw new Error("RP ID hash mismatch");
  if (!parsed.credentialId) throw new Error("No credential ID in authenticator data");
  if (!parsed.cosePublicKey) throw new Error("No public key in authenticator data");

  const jwk = coseKeyToJwk(parsed.cosePublicKey);

  return {
    credentialId: parsed.credentialId,
    publicKeyJwk: JSON.stringify(jwk),
    counter: parsed.signCount,
    aaguid: parsed.aaguid || "00000000-0000-0000-0000-000000000000",
    transports,
  };
}

export interface VerifiedAuthentication {
  credentialId: string;
  newCounter: number;
}

export function verifyAuthentication(
  expectedChallenge: string,
  storedCredential: WebAuthnCredential,
  clientDataJSONBase64: string,
  authenticatorDataBase64: string,
  signatureBase64: string
): VerifiedAuthentication {
  const sessionKey = `auth:${expectedChallenge}`;
  const storedEntry = pendingChallenges.get(sessionKey);
  if (!storedEntry) throw new Error("No pending authentication challenge");
  if (new Date() > storedEntry.expiresAt) {
    pendingChallenges.delete(sessionKey);
    throw new Error("Authentication challenge expired");
  }
  pendingChallenges.delete(sessionKey);

  const clientDataJSON = Buffer.from(clientDataJSONBase64, "base64url");
  const clientData = JSON.parse(clientDataJSON.toString("utf8"));

  if (clientData.type !== "webauthn.get") throw new Error("Invalid clientData type");
  if (clientData.challenge !== expectedChallenge) throw new Error("Challenge mismatch");

  const authDataBuffer = Buffer.from(authenticatorDataBase64, "base64url");
  const rpIdHash = crypto.createHash("sha256").update(RP_ID).digest();
  const parsed = parseAuthenticatorData(authDataBuffer);

  if (!parsed.rpIdHash.equals(rpIdHash)) throw new Error("RP ID hash mismatch");
  if (parsed.signCount <= storedCredential.counter && parsed.signCount !== 0) {
    throw new Error("Authenticator counter did not increase — possible cloned authenticator");
  }

  const clientDataHash = crypto.createHash("sha256").update(clientDataJSON).digest();
  const signedData = Buffer.concat([authDataBuffer, clientDataHash]);
  const signature = Buffer.from(signatureBase64, "base64url");

  const jwk = JSON.parse(storedCredential.publicKeyJwk);
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });

  const algorithm = jwk.alg === "ES256" ? "SHA256" : "SHA256";
  const valid = crypto.verify(algorithm, signedData, publicKey, signature);
  if (!valid) throw new Error("Signature verification failed");

  return {
    credentialId: storedCredential.credentialId,
    newCounter: parsed.signCount,
  };
}
