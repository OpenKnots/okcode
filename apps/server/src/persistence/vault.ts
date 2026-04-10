import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const VAULT_PAYLOAD_VERSION = "v1";
export const VAULT_KEY_BYTES = 32;
export const VAULT_IV_BYTES = 12;

export interface EncodeVaultPayloadInput {
  readonly key: Buffer;
  readonly aad: ReadonlyArray<string>;
  readonly value: string;
}

export interface DecodeVaultPayloadInput {
  readonly key: Buffer;
  readonly aad: ReadonlyArray<string>;
  readonly encryptedValue: string;
}

export function encodeVaultPayload(input: EncodeVaultPayloadInput): string {
  const iv = randomBytes(VAULT_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  cipher.setAAD(Buffer.from(input.aad.join("\0"), "utf8"));

  const ciphertext = Buffer.concat([cipher.update(input.value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VAULT_PAYLOAD_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decodeVaultPayload(input: DecodeVaultPayloadInput): string {
  const parts = input.encryptedValue.split(":");
  if (parts.length !== 4 || parts[0] !== VAULT_PAYLOAD_VERSION) {
    throw new Error("Unsupported secret payload version.");
  }

  const [, ivRaw, authTagRaw, ciphertextRaw] = parts;
  const iv = Buffer.from(ivRaw ?? "", "base64");
  const authTag = Buffer.from(authTagRaw ?? "", "base64");
  const ciphertext = Buffer.from(ciphertextRaw ?? "", "base64");
  if (iv.byteLength !== VAULT_IV_BYTES || authTag.byteLength !== 16) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", input.key, iv);
  decipher.setAAD(Buffer.from(input.aad.join("\0"), "utf8"));
  decipher.setAuthTag(authTag);
  return `${decipher.update(ciphertext, undefined, "utf8")}${decipher.final("utf8")}`;
}

export async function readOrCreateVaultKey(secretKeyPath: string): Promise<Buffer> {
  try {
    const existing = await fs.readFile(secretKeyPath, "utf8");
    const decoded = Buffer.from(existing.trim(), "base64");
    if (decoded.byteLength !== VAULT_KEY_BYTES) {
      throw new Error("Invalid vault key length.");
    }
    return decoded;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      throw error;
    }

    await fs.mkdir(path.dirname(secretKeyPath), { recursive: true });
    const key = randomBytes(VAULT_KEY_BYTES);
    try {
      await fs.writeFile(secretKeyPath, `${key.toString("base64")}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      return key;
    } catch (writeError) {
      const writeCode = (writeError as NodeJS.ErrnoException | undefined)?.code;
      if (writeCode === "EEXIST") {
        const existing = await fs.readFile(secretKeyPath, "utf8");
        const decoded = Buffer.from(existing.trim(), "base64");
        if (decoded.byteLength !== VAULT_KEY_BYTES) {
          throw new Error("Invalid vault key length.", { cause: writeError });
        }
        return decoded;
      }
      throw writeError;
    }
  }
}
