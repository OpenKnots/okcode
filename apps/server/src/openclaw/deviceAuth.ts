import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";

export interface OpenclawDeviceIdentity {
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly publicKey: string;
  readonly privateKeyPem: string;
}

export interface OpenclawSignedDeviceIdentity {
  readonly id: string;
  readonly publicKey: string;
  readonly signature: string;
  readonly signedAt: number;
  readonly nonce: string;
}

export interface OpenclawDeviceSigningParams {
  readonly clientId: string;
  readonly clientMode: string;
  readonly role: string;
  readonly scopes: ReadonlyArray<string>;
  readonly token: string;
  readonly nonce: string;
  readonly signedAt: number;
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function generateOpenclawDeviceIdentity(): OpenclawDeviceIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  if (typeof publicJwk.x !== "string") {
    throw new Error("Failed to export OpenClaw device public key.");
  }

  const rawPublicKey = decodeBase64Url(publicJwk.x);
  const fingerprint = createHash("sha256").update(rawPublicKey).digest("hex");

  return {
    deviceId: fingerprint,
    deviceFingerprint: fingerprint,
    publicKey: toBase64Url(rawPublicKey),
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
  };
}

export function signOpenclawDeviceChallenge(
  identity: OpenclawDeviceIdentity,
  params: OpenclawDeviceSigningParams,
): OpenclawSignedDeviceIdentity {
  const payload = [
    "v2",
    identity.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    [...params.scopes].join(","),
    String(params.signedAt),
    params.token,
    params.nonce,
  ].join("|");

  const signature = sign(
    null,
    Buffer.from(payload, "utf8"),
    createPrivateKey(identity.privateKeyPem),
  );
  return {
    id: identity.deviceId,
    publicKey: identity.publicKey,
    signature: toBase64Url(signature),
    signedAt: params.signedAt,
    nonce: params.nonce,
  };
}
