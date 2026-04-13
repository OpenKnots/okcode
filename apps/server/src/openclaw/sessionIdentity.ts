export type OpenclawSessionIdentityKind = "sessionKey" | "key" | "sessionId" | "id";

export interface OpenclawSessionIdentity {
  readonly kind: OpenclawSessionIdentityKind;
  readonly value: string;
}

const SESSION_IDENTITY_FIELDS: readonly OpenclawSessionIdentityKind[] = [
  "sessionKey",
  "key",
  "sessionId",
  "id",
];

export function normalizeOpenclawSessionIdentity(
  value: unknown,
): OpenclawSessionIdentity | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return { kind: "sessionKey", value: value.trim() };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const field of SESSION_IDENTITY_FIELDS) {
    const candidate = record[field];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return { kind: field, value: candidate.trim() };
    }
  }

  return undefined;
}
