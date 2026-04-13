import type NodeWebSocket from "ws";

export const OPENCLAW_PROTOCOL_VERSION = 3;
export const OPENCLAW_OPERATOR_SCOPES = ["operator.read", "operator.write"] as const;

export type GatewayFrame = {
  type?: unknown;
  id?: unknown;
  ok?: unknown;
  method?: unknown;
  event?: unknown;
  payload?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

export interface ParsedGatewayError {
  readonly message: string;
  readonly code: string | undefined;
  readonly detailCode: string | undefined;
  readonly detailReason: string | undefined;
  readonly recommendedNextStep: string | undefined;
  readonly canRetryWithDeviceToken: boolean | undefined;
}

export interface OpenclawHelloAuth {
  readonly deviceToken: string | undefined;
  readonly role: string | undefined;
  readonly scopes: ReadonlyArray<string>;
}

export interface OpenclawHelloPayload {
  readonly type: string | undefined;
  readonly protocol: number | undefined;
  readonly auth: OpenclawHelloAuth | undefined;
  readonly features:
    | {
        readonly methods: ReadonlyArray<string> | undefined;
      }
    | undefined;
}

export function bufferToString(data: NodeWebSocket.Data): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return data.toString("utf8");
}

export function parseGatewayFrame(data: NodeWebSocket.Data): GatewayFrame | null {
  try {
    const parsed = JSON.parse(bufferToString(data));
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as GatewayFrame;
    }
  } catch {
    // Ignore non-JSON frames.
  }
  return null;
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function parseGatewayError(error: GatewayFrame["error"]): ParsedGatewayError {
  const details =
    typeof error?.details === "object" && error.details !== null
      ? (error.details as Record<string, unknown>)
      : undefined;
  return {
    message: readString(error?.message) ?? "Gateway request failed.",
    code:
      typeof error?.code === "string" || typeof error?.code === "number"
        ? String(error.code)
        : undefined,
    detailCode: readString(details?.code),
    detailReason: readString(details?.reason),
    recommendedNextStep: readString(details?.recommendedNextStep),
    canRetryWithDeviceToken: readBoolean(details?.canRetryWithDeviceToken),
  };
}

export function formatGatewayError(error: ParsedGatewayError): string {
  const details = [
    error.code ? `code ${error.code}` : null,
    error.detailCode ? `detail ${error.detailCode}` : null,
    error.detailReason ? `reason ${error.detailReason}` : null,
    error.recommendedNextStep ? `next ${error.recommendedNextStep}` : null,
    error.canRetryWithDeviceToken ? "device-token retry available" : null,
  ].filter((detail): detail is string => detail !== null);
  return details.length > 0 ? `${error.message} (${details.join(", ")})` : error.message;
}

export function extractHelloPayload(payload: unknown): OpenclawHelloPayload | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const authRecord =
    record.auth && typeof record.auth === "object" && !Array.isArray(record.auth)
      ? (record.auth as Record<string, unknown>)
      : undefined;
  const featuresRecord =
    record.features && typeof record.features === "object" && !Array.isArray(record.features)
      ? (record.features as Record<string, unknown>)
      : undefined;
  const methods =
    Array.isArray(featuresRecord?.methods) &&
    featuresRecord?.methods.every((item) => typeof item === "string")
      ? (featuresRecord.methods as string[])
      : undefined;

  const type = readString(record.type);
  const protocol = typeof record.protocol === "number" ? record.protocol : undefined;
  const deviceToken = readString(authRecord?.deviceToken);
  const role = readString(authRecord?.role);

  return {
    type,
    protocol,
    auth: authRecord
      ? {
          deviceToken,
          role,
          scopes: Array.isArray(authRecord.scopes)
            ? authRecord.scopes.filter((scope): scope is string => typeof scope === "string")
            : [],
        }
      : undefined,
    features: methods ? { methods } : undefined,
  };
}

export function extractHelloMethods(hello: OpenclawHelloPayload | undefined): Set<string> {
  return new Set(hello?.features?.methods ?? []);
}

export function assertRequiredMethods(
  methods: Set<string>,
  requiredMethods: ReadonlyArray<string>,
): void {
  const missing = requiredMethods.filter((method) => !methods.has(method));
  if (missing.length > 0) {
    throw new Error(`Gateway is missing required methods: ${missing.join(", ")}`);
  }
}
