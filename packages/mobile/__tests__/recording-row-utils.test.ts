// Mock recordings-service so the import of RecordingStatus works in isolation
jest.mock("../utils/recordings-service", () => ({}));

// formatRelativeTime now calls useI18n() internally — mock the i18n module
jest.mock("@/locales/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { justNow: "Just now" },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
}));

import { formatRelativeTime, getStatusColor } from "../utils/recording-row-utils";

// Reference point: 2026-03-02T12:00:00.000Z (Monday)
const NOW = new Date("2026-03-02T12:00:00.000Z");

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

// Helper: create an ISO timestamp N milliseconds before NOW
const msBefore = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("formatRelativeTime", () => {
  describe("within 60 seconds → 'Just now'", () => {
    it("returns 'Just now' for a timestamp 30 seconds ago", () => {
      expect(formatRelativeTime(msBefore(30_000))).toBe("Just now");
    });

    it("returns 'Just now' for a timestamp 59 seconds ago", () => {
      expect(formatRelativeTime(msBefore(59_000))).toBe("Just now");
    });

    it("returns 'Just now' for the current moment", () => {
      expect(formatRelativeTime(NOW.toISOString())).toBe("Just now");
    });
  });

  describe("1–59 minutes ago → 'X min ago'", () => {
    it("returns '1 min ago' for a timestamp 1 minute ago", () => {
      expect(formatRelativeTime(msBefore(60_000))).toBe("1 min ago");
    });

    it("returns '5 min ago' for a timestamp 5 minutes ago", () => {
      expect(formatRelativeTime(msBefore(5 * 60_000))).toBe("5 min ago");
    });

    it("returns '59 min ago' for a timestamp 59 minutes ago", () => {
      expect(formatRelativeTime(msBefore(59 * 60_000))).toBe("59 min ago");
    });
  });

  describe("same calendar day → 'Today, HH:MM'", () => {
    it("returns 'Today, ...' for a timestamp 2 hours ago (same calendar day)", () => {
      // 2h ago = 2026-03-02T10:00:00Z → still March 2
      const result = formatRelativeTime(msBefore(2 * 60 * 60_000));
      expect(result).toMatch(/^Today,/);
    });

    it("returns 'Today, ...' for a timestamp 11 hours ago (early morning same day)", () => {
      // 11h ago = 2026-03-02T01:00:00Z → still March 2
      const result = formatRelativeTime(msBefore(11 * 60 * 60_000));
      expect(result).toMatch(/^Today,/);
    });
  });

  describe("previous calendar day → 'Yesterday, HH:MM'", () => {
    it("returns 'Yesterday, ...' for a timestamp 23 hours ago (cross-midnight bug case)", () => {
      // 23h ago = 2026-03-01T13:00:00Z → March 1 (previous calendar day)
      // Bug: old code used elapsed hours, so <24h was "Today" even if a different day
      const result = formatRelativeTime(msBefore(23 * 60 * 60_000));
      expect(result).toMatch(/^Yesterday,/);
    });

    it("returns 'Yesterday, ...' for a timestamp 25 hours ago", () => {
      // 25h ago = 2026-03-01T11:00:00Z → March 1 (previous calendar day)
      const result = formatRelativeTime(msBefore(25 * 60 * 60_000));
      expect(result).toMatch(/^Yesterday,/);
    });
  });

  describe("2–6 calendar days ago → day name", () => {
    it("returns 'Saturday, ...' for a timestamp 47 hours ago (Feb 28)", () => {
      // 47h ago = 2026-02-28T13:00:00Z → 2 calendar days before → Saturday
      const result = formatRelativeTime(msBefore(47 * 60 * 60_000));
      expect(result).toMatch(/^Saturday,/);
    });

    it("returns day name for a timestamp 3 days ago (Friday)", () => {
      // NOW is Monday 2026-03-02; 3 days ago is Friday 2026-02-27
      const result = formatRelativeTime(msBefore(3 * 24 * 60 * 60_000));
      expect(result).toMatch(/^Friday,/);
    });

    it("returns day name for a timestamp 6 days ago (Tuesday)", () => {
      // NOW is Monday 2026-03-02; 6 days ago is Tuesday 2026-02-24
      const result = formatRelativeTime(msBefore(6 * 24 * 60 * 60_000));
      expect(result).toMatch(/^Tuesday,/);
    });
  });

  describe("7+ days ago → formatted date string", () => {
    it("returns a date string for a timestamp 8 days ago", () => {
      const result = formatRelativeTime(msBefore(8 * 24 * 60 * 60_000));
      // Should NOT match the relative patterns
      expect(result).not.toMatch(/^(Just now|\d+ min ago|Today,|Yesterday,|Sunday,|Monday,|Tuesday,|Wednesday,|Thursday,|Friday,|Saturday,)/);
    });

    it("returns a date string for a timestamp 30 days ago", () => {
      const result = formatRelativeTime(msBefore(30 * 24 * 60 * 60_000));
      expect(result).not.toMatch(/^(Just now|\d+ min ago|Today,|Yesterday,)/);
    });
  });
});

describe("getStatusColor", () => {
  it("returns green (#4CAF50) for 'uploaded' status", () => {
    expect(getStatusColor("uploaded")).toBe("#4CAF50");
  });

  it("returns yellow (#FFC107) for 'uploading' status", () => {
    expect(getStatusColor("uploading")).toBe("#FFC107");
  });

  it("returns red (#F44336) for 'failed' status", () => {
    expect(getStatusColor("failed")).toBe("#F44336");
  });

  it("returns gray (#9E9E9E) for unknown status", () => {
    expect(getStatusColor("unknown" as any)).toBe("#9E9E9E");
  });
});
