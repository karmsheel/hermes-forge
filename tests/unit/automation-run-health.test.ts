import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRunHealthFromJob,
  buildRunHealthFromStatusOnly,
  countConsecutiveFailures,
  FAILURE_ALERT_THRESHOLD,
  formatRunHealthSummary,
  mapHermesJobStatus,
  mapRunOutcome,
  shouldAlertOnFailures,
} from "../../lib/automation-run-health.ts";
import { normalizeHermesJob } from "../../lib/hermes-jobs.ts";

describe("mapHermesJobStatus", () => {
  it("maps paused/disabled", () => {
    assert.equal(mapHermesJobStatus("paused"), "paused");
    assert.equal(mapHermesJobStatus("disabled"), "paused");
    assert.equal(mapHermesJobStatus("active", false), "paused");
  });

  it("maps failed/error", () => {
    assert.equal(mapHermesJobStatus("failed"), "failed");
    assert.equal(mapHermesJobStatus("error"), "failed");
  });

  it("defaults to active", () => {
    assert.equal(mapHermesJobStatus("running"), "active");
    assert.equal(mapHermesJobStatus(undefined), "active");
  });
});

describe("mapRunOutcome", () => {
  it("maps success variants", () => {
    assert.equal(mapRunOutcome("success"), "success");
    assert.equal(mapRunOutcome("completed"), "success");
    assert.equal(mapRunOutcome(null, true), "success");
    assert.equal(mapRunOutcome(null, 1), "success");
  });

  it("maps failure variants", () => {
    assert.equal(mapRunOutcome("failed"), "failed");
    assert.equal(mapRunOutcome("error"), "failed");
    assert.equal(mapRunOutcome(null, false), "failed");
    assert.equal(mapRunOutcome(null, 0), "failed");
  });

  it("unknown when empty", () => {
    assert.equal(mapRunOutcome(undefined), "unknown");
    assert.equal(mapRunOutcome("weird"), "unknown");
  });
});

describe("countConsecutiveFailures", () => {
  it("counts from newest", () => {
    assert.equal(countConsecutiveFailures(["failed", "failed", "success"]), 2);
    assert.equal(countConsecutiveFailures(["success", "failed"]), 0);
    assert.equal(countConsecutiveFailures(["failed", "failed", "failed"]), 3);
  });

  it("stops on unknown", () => {
    assert.equal(countConsecutiveFailures(["failed", "unknown", "failed"]), 1);
  });
});

describe("buildRunHealthFromJob", () => {
  it("builds summary for healthy job", () => {
    const health = buildRunHealthFromJob({
      id: "job-1",
      status: "active",
      lastStatus: "success",
      lastRunAt: "2026-07-01T12:00:00.000Z",
    });
    assert.equal(health.runtimeStatus, "active");
    assert.equal(health.lastOutcome, "success");
    assert.equal(health.unhealthy, false);
    assert.match(health.summary, /succeeded|success/i);
  });

  it("marks unhealthy after consecutive failures threshold", () => {
    const health = buildRunHealthFromJob(
      { id: "job-2", status: "active", lastStatus: "failed" },
      { consecutiveFailures: FAILURE_ALERT_THRESHOLD, recentFailures: 3, recentRuns: 3 }
    );
    assert.equal(health.runtimeStatus, "failed");
    assert.equal(health.unhealthy, true);
    assert.match(health.summary, /consecutive failures/);
  });

  it("paused summary", () => {
    const health = buildRunHealthFromJob({ id: "job-3", status: "paused" });
    assert.equal(health.runtimeStatus, "paused");
    assert.match(health.summary, /Paused/);
  });
});

describe("buildRunHealthFromStatusOnly", () => {
  it("reflects stored status", () => {
    const h = buildRunHealthFromStatusOnly("j1", "paused");
    assert.equal(h.runtimeStatus, "paused");
    assert.equal(h.source, "status_only");
  });
});

describe("shouldAlertOnFailures", () => {
  it("alerts when consecutive failures high", () => {
    assert.equal(
      shouldAlertOnFailures({
        consecutiveFailures: FAILURE_ALERT_THRESHOLD,
        unhealthy: true,
        runtimeStatus: "failed",
      }),
      true
    );
  });

  it("does not alert on a single failure", () => {
    assert.equal(
      shouldAlertOnFailures({
        consecutiveFailures: 1,
        unhealthy: true,
        runtimeStatus: "active",
      }),
      false
    );
  });

  it("skips when paused or already alerted", () => {
    assert.equal(
      shouldAlertOnFailures(
        { consecutiveFailures: 5, unhealthy: true, runtimeStatus: "paused" },
      ),
      false
    );
    assert.equal(
      shouldAlertOnFailures(
        { consecutiveFailures: 5, unhealthy: true, runtimeStatus: "failed" },
        { alreadyAlertedRecently: true }
      ),
      false
    );
  });
});

describe("formatRunHealthSummary", () => {
  it("no runs", () => {
    assert.match(
      formatRunHealthSummary({
        runtimeStatus: "active",
        lastOutcome: "unknown",
        lastRunAt: null,
        consecutiveFailures: 0,
        recentRuns: 0,
        successRate: null,
      }),
      /No runs/
    );
  });
});

describe("normalizeHermesJob", () => {
  it("parses nested last_run", () => {
    const job = normalizeHermesJob({
      id: "abc",
      name: "forge-demo",
      status: "active",
      last_run: {
        status: "failed",
        error: "timeout",
        ended_at: "2026-07-01T10:00:00Z",
      },
    });
    assert.ok(job);
    assert.equal(job!.id, "abc");
    assert.equal(job!.lastStatus, "failed");
    assert.equal(job!.lastError, "timeout");
  });

  it("returns null without id", () => {
    assert.equal(normalizeHermesJob({ name: "x" }), null);
  });
});
