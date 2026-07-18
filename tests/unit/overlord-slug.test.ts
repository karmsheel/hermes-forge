import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReservedProfileKey,
  isValidProfileKey,
  slugifyProfileKey,
} from "@/lib/overlord/slug";

describe("slugifyProfileKey", () => {
  it("lowercases and hyphenates", () => {
    assert.equal(slugifyProfileKey("Forge Overlord"), "forge-overlord");
  });

  it("strips unsafe characters", () => {
    assert.equal(slugifyProfileKey("Agent #1!!"), "agent-1");
  });

  it("collapses repeats and trims hyphens", () => {
    assert.equal(slugifyProfileKey("  --Foo__Bar--  "), "foo-bar");
  });
});

describe("isReservedProfileKey / isValidProfileKey", () => {
  it("reserves default and empty", () => {
    assert.equal(isReservedProfileKey("default"), true);
    assert.equal(isReservedProfileKey(""), true);
    assert.equal(isReservedProfileKey("  "), true);
    assert.equal(isReservedProfileKey("my-agent"), false);
  });

  it("validates non-reserved keys", () => {
    assert.equal(isValidProfileKey("my-agent"), true);
    assert.equal(isValidProfileKey("default"), false);
    assert.equal(isValidProfileKey(""), false);
  });
});
