import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  decodeOAuthState,
  encodeOAuthState,
  isRichLocalPlaceholder,
  sanitizeRedirectPath,
} from "@/lib/github-oauth-state";
import { shouldUseSecureCookies } from "@/lib/auth-secret";

const PREV_SECRET = process.env.AUTH_SECRET;
const PREV_DESKTOP = process.env.FORGE_DESKTOP;
const PREV_NODE_ENV = process.env.NODE_ENV;
const PREV_COOKIE_SECURE = process.env.COOKIE_SECURE;

before(() => {
  process.env.AUTH_SECRET = "test-auth-secret-for-oauth-state-hmac";
});

after(() => {
  if (PREV_SECRET === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = PREV_SECRET;
  if (PREV_DESKTOP === undefined) delete process.env.FORGE_DESKTOP;
  else process.env.FORGE_DESKTOP = PREV_DESKTOP;
  if (PREV_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = PREV_NODE_ENV;
  if (PREV_COOKIE_SECURE === undefined) delete process.env.COOKIE_SECURE;
  else process.env.COOKIE_SECURE = PREV_COOKIE_SECURE;
});

describe("encodeOAuthState / decodeOAuthState", () => {
  it("round-trips nonce, redirect, and linkUserId", () => {
    const state = encodeOAuthState({
      nonce: "abc123nonce",
      redirectTo: "/business-manager",
      linkUserId: "user_local_1",
    });
    const decoded = decodeOAuthState(state);
    assert.ok(decoded);
    assert.equal(decoded!.nonce, "abc123nonce");
    assert.equal(decoded!.redirectTo, "/business-manager");
    assert.equal(decoded!.linkUserId, "user_local_1");
    assert.ok(decoded!.exp > Math.floor(Date.now() / 1000));
  });

  it("omits linkUserId when absent", () => {
    const state = encodeOAuthState({
      nonce: "n2",
      redirectTo: "/setup/overlord",
    });
    const decoded = decodeOAuthState(state);
    assert.ok(decoded);
    assert.equal(decoded!.linkUserId, undefined);
  });

  it("rejects tampered payload", () => {
    const state = encodeOAuthState({
      nonce: "n3",
      redirectTo: "/home",
      linkUserId: "u1",
    });
    const [body, sig] = state.split(".");
    const tampered = `${body!.slice(0, -1)}x.${sig}`;
    assert.equal(decodeOAuthState(tampered), null);
  });

  it("rejects bad signature", () => {
    const state = encodeOAuthState({
      nonce: "n4",
      redirectTo: "/home",
    });
    const [body] = state.split(".");
    assert.equal(decodeOAuthState(`${body}.not-a-real-sig`), null);
  });

  it("rejects expired state", () => {
    const state = encodeOAuthState({
      nonce: "n5",
      redirectTo: "/home",
      maxAgeSec: -10,
    });
    assert.equal(decodeOAuthState(state), null);
  });
});

describe("sanitizeRedirectPath", () => {
  it("allows relative app paths", () => {
    assert.equal(sanitizeRedirectPath("/business-manager"), "/business-manager");
  });
  it("blocks protocol-relative and absolute URLs", () => {
    assert.equal(sanitizeRedirectPath("//evil.com"), "/business-manager");
    assert.equal(sanitizeRedirectPath("https://evil.com"), "/business-manager");
  });
});

describe("isRichLocalPlaceholder", () => {
  it("true for local with businesses", () => {
    assert.equal(
      isRichLocalPlaceholder({
        email: "local@hermes-forge.local",
        githubId: null,
        forgeOverlordProfileKey: null,
        businessCount: 7,
      }),
      true
    );
  });
  it("true for local with overlord only", () => {
    assert.equal(
      isRichLocalPlaceholder({
        email: "local@hermes-forge.local",
        githubId: null,
        forgeOverlordProfileKey: "overlord",
        businessCount: 0,
      }),
      true
    );
  });
  it("false when already has githubId", () => {
    assert.equal(
      isRichLocalPlaceholder({
        email: "local@hermes-forge.local",
        githubId: "123",
        forgeOverlordProfileKey: "overlord",
        businessCount: 7,
      }),
      false
    );
  });
  it("false for empty local or non-local email", () => {
    assert.equal(
      isRichLocalPlaceholder({
        email: "local@hermes-forge.local",
        githubId: null,
        forgeOverlordProfileKey: null,
        businessCount: 0,
      }),
      false
    );
    assert.equal(
      isRichLocalPlaceholder({
        email: "someone@gmail.com",
        githubId: null,
        forgeOverlordProfileKey: "x",
        businessCount: 3,
      }),
      false
    );
  });
});

describe("isEmptyGithubShell predicate (inline mirror)", () => {
  // Mirrors lib/github-oauth isEmptyGithubShell without importing prisma module.
  function isEmptyGithubShell(user: {
    forgeOverlordProfileKey?: string | null;
    businesses: { id: string }[];
  }): boolean {
    return user.businesses.length === 0 && !user.forgeOverlordProfileKey?.trim();
  }

  it("true when no businesses and no overlord", () => {
    assert.equal(
      isEmptyGithubShell({ forgeOverlordProfileKey: null, businesses: [] }),
      true
    );
  });
  it("false when overlord set", () => {
    assert.equal(
      isEmptyGithubShell({ forgeOverlordProfileKey: "o", businesses: [] }),
      false
    );
  });
  it("false when has business", () => {
    assert.equal(
      isEmptyGithubShell({ forgeOverlordProfileKey: null, businesses: [{ id: "b1" }] }),
      false
    );
  });
});

describe("shouldUseSecureCookies", () => {
  it("false on desktop even in production", () => {
    process.env.FORGE_DESKTOP = "1";
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SECURE;
    assert.equal(shouldUseSecureCookies(), false);
  });
  it("true in production web without desktop", () => {
    delete process.env.FORGE_DESKTOP;
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SECURE;
    assert.equal(shouldUseSecureCookies(), true);
  });
  it("false in development", () => {
    delete process.env.FORGE_DESKTOP;
    process.env.NODE_ENV = "development";
    delete process.env.COOKIE_SECURE;
    assert.equal(shouldUseSecureCookies(), false);
  });
});
