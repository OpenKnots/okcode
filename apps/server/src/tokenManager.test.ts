import { describe, expect, it } from "vitest";

import { TokenManager } from "./tokenManager";

describe("TokenManager", () => {
  describe("validate", () => {
    it("accepts any token when auth is disabled", () => {
      const manager = new TokenManager(undefined);
      expect(manager.validate(null)).toBe(true);
      expect(manager.validate("anything")).toBe(true);
    });

    it("accepts the initial token", () => {
      const manager = new TokenManager("secret-token");
      expect(manager.validate("secret-token")).toBe(true);
    });

    it("rejects an incorrect token", () => {
      const manager = new TokenManager("secret-token");
      expect(manager.validate("wrong-token")).toBe(false);
    });

    it("rejects null token when auth is enabled", () => {
      const manager = new TokenManager("secret-token");
      expect(manager.validate(null)).toBe(false);
    });
  });

  describe("generatePairingToken", () => {
    it("creates a short-lived token that validates", () => {
      const manager = new TokenManager("initial");
      const record = manager.generatePairingToken({ ttlSeconds: 60 });
      expect(record.kind).toBe("short-lived");
      expect(record.expiresAt).not.toBeNull();
      expect(manager.validate(record.tokenValue)).toBe(true);
    });

    it("defaults to 5 minute TTL", () => {
      const manager = new TokenManager("initial");
      const record = manager.generatePairingToken();
      const expiresAt = new Date(record.expiresAt!).getTime();
      const createdAt = new Date(record.createdAt).getTime();
      // Allow 1 second tolerance
      expect(expiresAt - createdAt).toBeGreaterThanOrEqual(299_000);
      expect(expiresAt - createdAt).toBeLessThanOrEqual(301_000);
    });
  });

  describe("rotate", () => {
    it("issues a new token and returns the previous token ID", () => {
      const manager = new TokenManager("initial");
      const tokens = manager.list();
      const initialTokenId = tokens[0]!.tokenId;

      const result = manager.rotate();
      expect(result.previousTokenId).toBe(initialTokenId);
      expect(result.newRecord.kind).toBe("long-lived");
      expect(manager.validate(result.newRecord.tokenValue)).toBe(true);
    });

    it("old token is still valid during grace period", () => {
      const manager = new TokenManager("initial");
      manager.rotate();
      // The old token should still work during the 30s grace period
      expect(manager.validate("initial")).toBe(true);
    });
  });

  describe("revoke", () => {
    it("immediately invalidates a token", () => {
      const manager = new TokenManager("initial");
      const record = manager.generatePairingToken();
      expect(manager.validate(record.tokenValue)).toBe(true);

      manager.revoke(record.tokenId);
      expect(manager.validate(record.tokenValue)).toBe(false);
    });

    it("returns false for unknown token ID", () => {
      const manager = new TokenManager("initial");
      expect(manager.revoke("nonexistent")).toBe(false);
    });
  });

  describe("list", () => {
    it("lists all tokens without exposing values", () => {
      const manager = new TokenManager("initial");
      manager.generatePairingToken({ label: "test-pairing" });

      const tokens = manager.list();
      expect(tokens).toHaveLength(2);
      expect(tokens.some((t) => t.kind === "long-lived")).toBe(true);
      expect(tokens.some((t) => t.kind === "short-lived")).toBe(true);
      // Values should not be present in list output
      for (const token of tokens) {
        expect(token).not.toHaveProperty("tokenValue");
      }
    });
  });

  describe("getPrimaryTokenValue", () => {
    it("returns the primary token value", () => {
      const manager = new TokenManager("initial");
      expect(manager.getPrimaryTokenValue()).toBe("initial");
    });

    it("returns null when auth is disabled", () => {
      const manager = new TokenManager(undefined);
      expect(manager.getPrimaryTokenValue()).toBeNull();
    });

    it("returns the new value after rotation", () => {
      const manager = new TokenManager("initial");
      const { newRecord } = manager.rotate();
      expect(manager.getPrimaryTokenValue()).toBe(newRecord.tokenValue);
    });
  });
});
