import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { BUSINESS_HEADER } from "../../lib/business-header.ts";
import { forgeFetch } from "../../lib/forge-fetch.ts";

describe("forgeFetch", () => {
  it("injects X-Forge-Business-Id when businessId is set", async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const original = globalThis.fetch;
    // @ts-expect-error test stub
    globalThis.fetch = mock.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(input), headers });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    try {
      await forgeFetch("/api/processes", {
        businessId: "biz-123",
        headers: { "Content-Type": "application/json" },
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.headers.get(BUSINESS_HEADER), "biz-123");
      assert.equal(calls[0]!.headers.get("Content-Type"), "application/json");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("omits header when businessId is absent", async () => {
    const calls: Array<Headers> = [];
    const original = globalThis.fetch;
    // @ts-expect-error test stub
    globalThis.fetch = mock.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Headers(init?.headers));
      return new Response("{}", { status: 200 });
    });

    try {
      await forgeFetch("/api/auth/me");
      assert.equal(calls[0]!.get(BUSINESS_HEADER), null);
    } finally {
      globalThis.fetch = original;
    }
  });
});
