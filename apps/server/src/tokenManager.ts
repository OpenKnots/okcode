/**
 * TokenManager - Token lifecycle management for mobile pairing.
 *
 * Manages long-lived auth tokens and short-lived pairing tokens with
 * rotation, revocation, and expiry.
 *
 * @module TokenManager
 */
import crypto from "node:crypto";

export interface TokenRecord {
  readonly tokenId: string;
  readonly tokenValue: string;
  readonly kind: "long-lived" | "short-lived";
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly label: string | undefined;
  revoked: boolean;
}

/**
 * Generate a cryptographically random token string.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateTokenId(): string {
  return crypto.randomUUID();
}

/**
 * TokenManager handles token creation, rotation, revocation, and validation.
 *
 * The manager wraps the single process-level `authToken` from the server config
 * and extends it with support for:
 * - Short-lived pairing tokens (for QR code / bootstrap link flows)
 * - Token rotation (issue a new long-lived token, grace-period the old one)
 * - Token revocation (immediately invalidate a specific token)
 */
export class TokenManager {
  private tokens = new Map<string, TokenRecord>();
  private primaryTokenId: string | null = null;

  /**
   * Seed the manager with the initial auth token from server config.
   * If `initialToken` is undefined, auth is disabled and all tokens are accepted.
   */
  constructor(private initialToken: string | undefined) {
    if (initialToken) {
      const tokenId = generateTokenId();
      this.tokens.set(tokenId, {
        tokenId,
        tokenValue: initialToken,
        kind: "long-lived",
        createdAt: new Date().toISOString(),
        expiresAt: null,
        label: "initial",
        revoked: false,
      });
      this.primaryTokenId = tokenId;
    }
  }

  /**
   * Check whether a provided token value is valid (matches any non-revoked,
   * non-expired token). Returns true if auth is disabled (no initial token).
   */
  validate(providedToken: string | null): boolean {
    if (!this.initialToken && this.tokens.size === 0) {
      return true; // Auth disabled
    }
    if (!providedToken) {
      return false;
    }

    const now = Date.now();
    for (const record of this.tokens.values()) {
      if (record.revoked) continue;
      if (record.expiresAt && new Date(record.expiresAt).getTime() <= now) continue;
      if (record.tokenValue === providedToken) return true;
    }
    return false;
  }

  /**
   * Generate a short-lived pairing token.
   */
  generatePairingToken(options?: {
    ttlSeconds?: number | undefined;
    label?: string | undefined;
  }): TokenRecord {
    const ttl = options?.ttlSeconds ?? 300; // Default 5 minutes
    const tokenId = generateTokenId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const record: TokenRecord = {
      tokenId,
      tokenValue: generateToken(),
      kind: "short-lived",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      label: options?.label,
      revoked: false,
    };
    this.tokens.set(tokenId, record);
    return record;
  }

  /**
   * Rotate the primary long-lived token. Issues a new token and revokes the old
   * one after a short grace period (30 seconds) to allow in-flight connections
   * to complete their handshake.
   */
  rotate(): { previousTokenId: string | null; newRecord: TokenRecord } {
    const previousTokenId = this.primaryTokenId;

    // Issue new token
    const tokenId = generateTokenId();
    const now = new Date();
    const newRecord: TokenRecord = {
      tokenId,
      tokenValue: generateToken(),
      kind: "long-lived",
      createdAt: now.toISOString(),
      expiresAt: null,
      label: undefined,
      revoked: false,
    };
    this.tokens.set(tokenId, newRecord);
    this.primaryTokenId = tokenId;

    // Grace-period revoke the old token (30s)
    if (previousTokenId) {
      const oldRecord = this.tokens.get(previousTokenId);
      if (oldRecord && !oldRecord.revoked) {
        setTimeout(() => {
          oldRecord.revoked = true;
        }, 30_000);
      }
    }

    return { previousTokenId, newRecord };
  }

  /**
   * Immediately revoke a specific token by ID.
   */
  revoke(tokenId: string): boolean {
    const record = this.tokens.get(tokenId);
    if (!record) return false;
    record.revoked = true;
    return true;
  }

  /**
   * List all tokens (values are masked for security).
   */
  list(): Array<{
    tokenId: string;
    kind: "long-lived" | "short-lived";
    createdAt: string;
    expiresAt: string | null;
    revoked: boolean;
    label: string | undefined;
  }> {
    this.pruneExpired();
    return Array.from(this.tokens.values()).map((record) => ({
      tokenId: record.tokenId,
      kind: record.kind,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      revoked: record.revoked,
      label: record.label,
    }));
  }

  /**
   * Get the current primary token value (for building pairing URLs).
   */
  getPrimaryTokenValue(): string | null {
    if (!this.primaryTokenId) return null;
    const record = this.tokens.get(this.primaryTokenId);
    return record && !record.revoked ? record.tokenValue : null;
  }

  /**
   * Remove expired short-lived tokens to avoid unbounded growth.
   */
  private pruneExpired(): void {
    const now = Date.now();
    for (const [id, record] of this.tokens) {
      if (record.expiresAt && new Date(record.expiresAt).getTime() <= now && record.revoked) {
        this.tokens.delete(id);
      }
    }
  }
}
