import { formatTime } from "../utils/format-time";

describe("formatTime", () => {
  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats seconds under a minute", () => {
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(30)).toBe("0:30");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats exactly one minute", () => {
    expect(formatTime(60)).toBe("1:00");
  });

  it("pads seconds with leading zero", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("does not pad seconds when >= 10", () => {
    expect(formatTime(75)).toBe("1:15");
  });

  it("formats 30 seconds (max recording duration)", () => {
    expect(formatTime(30)).toBe("0:30");
  });

  it("floors fractional seconds", () => {
    expect(formatTime(29.9)).toBe("0:29");
    expect(formatTime(30.0)).toBe("0:30");
    expect(formatTime(30.99)).toBe("0:30");
  });

  it("formats large values", () => {
    expect(formatTime(3600)).toBe("60:00");
    expect(formatTime(3661)).toBe("61:01");
  });
});
