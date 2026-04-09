const REDACTED = "[REDACTED]";

const SECRET_PREFIX_PATTERN = /\bsk-[A-Za-z0-9][A-Za-z0-9_-]*\b/g;
const BEARER_TOKEN_PATTERN = /\b(Bearer\s+)([^\s,;]+)/gi;
const SENSITIVE_QUERY_PARAM_PATTERN =
  /([?&](?:access[_-]?token|api[_-]?key|auth(?:orization)?|client[_-]?secret|password|refresh[_-]?token|secret|session[_-]?token|token)=)([^&#\s]+)/gi;
const SENSITIVE_FIELD_PATTERN =
  /((?:"|')?(?:access[_-]?token|api[_-]?key|auth(?:orization)?|client[_-]?secret|password|refresh[_-]?token|secret|session[_-]?token|token)(?:"|')?\s*[:=]\s*)(["'`]?)([^"'`\s,}]+)(\2)/gi;
const PROCESS_ENV_PATTERN =
  /\b((?:process\.)?env\.[A-Za-z_][A-Za-z0-9_]*\s*(?:=|:)\s*)(["'`]?)([^"'`\s,}]+)(\2)/g;
const ENV_ASSIGNMENT_PATTERN =
  /\b([A-Z][A-Z0-9_]{1,63}\s*=\s*)(["'`]?)([^"'`\s]+)(\2)/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(SECRET_PREFIX_PATTERN, REDACTED)
    .replace(BEARER_TOKEN_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_QUERY_PARAM_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_FIELD_PATTERN, `$1$2${REDACTED}$4`)
    .replace(PROCESS_ENV_PATTERN, `$1$2${REDACTED}$4`)
    .replace(ENV_ASSIGNMENT_PATTERN, `$1$2${REDACTED}$4`);
}

export function redactSensitiveValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactSensitiveText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item)) as T;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(([key, entryValue]) => [
      key,
      redactSensitiveValue(entryValue),
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}
