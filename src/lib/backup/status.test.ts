import { describe, expect, it } from "vitest";
import { describeBackupDate, describeLastBackup, formatCounts, formatMegabytes, summarizeRestore } from "./status";
import type { RestoreResult } from "./types";

const now = new Date(2026, 9, 16, 21, 0);
const daysAgo = (days: number) => new Date(2026, 9, 16 - days, 8, 0).getTime();

describe("describeLastBackup", () => {
  it("warns when there has never been a backup", () => {
    expect(describeLastBackup(null, now)).toEqual({ label: "Never backed up", stale: true });
  });

  it("describes recent backups by local calendar day", () => {
    expect(describeLastBackup(daysAgo(0), now)).toEqual({ label: "Last backup: today", stale: false });
    expect(describeLastBackup(daysAgo(1), now)).toEqual({ label: "Last backup: yesterday", stale: false });
    expect(describeLastBackup(daysAgo(3), now)).toEqual({ label: "Last backup: 3 days ago", stale: false });
    expect(describeLastBackup(daysAgo(14), now).stale).toBe(false);
  });

  it("turns stale after two weeks, and treats future timestamps as today", () => {
    expect(describeLastBackup(daysAgo(15), now)).toEqual({ label: "Last backup: 2 weeks ago", stale: true });
    expect(describeLastBackup(daysAgo(-2), now)).toEqual({ label: "Last backup: today", stale: false });
  });
});

describe("formatMegabytes", () => {
  it.each([
    [0, "0 MB"],
    [20_000, "< 0.1 MB"],
    [340 * 1024, "0.3 MB"],
    [3.25 * 1024 * 1024, "3.3 MB"],
    [12.4 * 1024 * 1024, "12 MB"],
    [1.5 * 1024 * 1024 * 1024, "1.5 GB"],
  ])("%d bytes → %s", (bytes, label) => {
    expect(formatMegabytes(bytes)).toBe(label);
  });
});

describe("formatCounts", () => {
  it("lists every count with correct plurals", () => {
    expect(formatCounts({ recipes: 12, logs: 1, photos: 0 })).toBe("12 recipes, 1 log entry and 0 photos");
    expect(formatCounts({ recipes: 1, logs: 40, photos: 1 })).toBe("1 recipe, 40 log entries and 1 photo");
  });
});

describe("describeBackupDate", () => {
  it("shows the export time and how long ago it was", () => {
    const iso = new Date(2026, 9, 13, 21, 30).toISOString();
    expect(describeBackupDate(iso, now, "en-GB")).toBe("13 Oct 2026, 21:30 · 3 days ago");
  });

  it("returns null for a missing or unreadable date and drops 'upcoming'", () => {
    expect(describeBackupDate(null, now)).toBeNull();
    expect(describeBackupDate("not a date", now)).toBeNull();
    const future = new Date(2026, 9, 20, 9, 0).toISOString();
    expect(describeBackupDate(future, now, "en-GB")).toBe("20 Oct 2026, 09:00");
  });
});

describe("summarizeRestore", () => {
  const empty: RestoreResult = {
    mode: "merge",
    recipesAdded: 0,
    recipesUpdated: 0,
    logsAdded: 0,
    logsUpdated: 0,
    photos: 0,
    skipped: 4,
    warnings: [],
  };

  it("lists only what changed", () => {
    expect(summarizeRestore({ ...empty, recipesAdded: 2, logsAdded: 1, photos: 3 })).toBe(
      "2 recipes added · 1 log entry added · 3 photos",
    );
    expect(summarizeRestore({ ...empty, recipesUpdated: 1, logsUpdated: 2 })).toBe(
      "1 recipe updated · 2 log entries updated",
    );
  });

  it("says so when nothing changed", () => {
    expect(summarizeRestore(empty)).toBe("Everything was already up to date.");
  });
});
