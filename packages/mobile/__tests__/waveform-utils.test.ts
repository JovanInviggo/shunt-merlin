import { scaleAmplitudeToBarHeight } from "../utils/waveform-utils";
import { MIN_BAR_HEIGHT, MAX_BAR_HEIGHT } from "../utils/waveform-constants";

describe("scaleAmplitudeToBarHeight", () => {
  describe("zero and negative amplitude clamp to minHeight", () => {
    it("returns MIN_BAR_HEIGHT for zero amplitude", () => {
      expect(scaleAmplitudeToBarHeight(0, 1)).toBe(MIN_BAR_HEIGHT);
    });

    it("returns MIN_BAR_HEIGHT for negative amplitude", () => {
      expect(scaleAmplitudeToBarHeight(-0.5, 1)).toBe(MIN_BAR_HEIGHT);
    });

    it("returns MIN_BAR_HEIGHT for very negative amplitude", () => {
      expect(scaleAmplitudeToBarHeight(-100, 5)).toBe(MIN_BAR_HEIGHT);
    });
  });

  describe("factor zero always clamps to minHeight", () => {
    it("returns MIN_BAR_HEIGHT when factor is 0", () => {
      expect(scaleAmplitudeToBarHeight(1, 0)).toBe(MIN_BAR_HEIGHT);
    });

    it("returns MIN_BAR_HEIGHT for mid-range amplitude with factor 0", () => {
      expect(scaleAmplitudeToBarHeight(0.5, 0)).toBe(MIN_BAR_HEIGHT);
    });
  });

  describe("high amplitude × large factor clamps to maxHeight", () => {
    it("returns MAX_BAR_HEIGHT for full amplitude with large factor", () => {
      // 1.0 * 100 * 60 = 6000 → clamped to MAX_BAR_HEIGHT (60)
      expect(scaleAmplitudeToBarHeight(1, 100)).toBe(MAX_BAR_HEIGHT);
    });

    it("returns MAX_BAR_HEIGHT when scaled value exceeds default max", () => {
      // 0.5 * 5 * 60 = 150 → clamped to 60
      expect(scaleAmplitudeToBarHeight(0.5, 5)).toBe(MAX_BAR_HEIGHT);
    });
  });

  describe("mid-range values scale correctly", () => {
    it("scales 0.5 amplitude with factor 1 to half of MAX_BAR_HEIGHT", () => {
      // 0.5 * 1 * 60 = 30 (between min and max)
      expect(scaleAmplitudeToBarHeight(0.5, 1)).toBe(30);
    });

    it("scales 0.1 amplitude with factor 1 correctly", () => {
      // 0.1 * 1 * 60 = 6 (between min and max)
      expect(scaleAmplitudeToBarHeight(0.1, 1)).toBe(6);
    });

    it("scales amplitude with factor > 1", () => {
      // 0.1 * 2 * 60 = 12
      expect(scaleAmplitudeToBarHeight(0.1, 2)).toBe(12);
    });
  });

  describe("custom minHeight and maxHeight params", () => {
    it("uses custom minHeight for zero amplitude", () => {
      expect(scaleAmplitudeToBarHeight(0, 1, 5, 100)).toBe(5);
    });

    it("uses custom maxHeight as ceiling", () => {
      // 1.0 * 2 * 100 = 200 → clamped to 100
      expect(scaleAmplitudeToBarHeight(1, 2, 5, 100)).toBe(100);
    });

    it("scales correctly with custom min and max", () => {
      // 0.5 * 1 * 100 = 50 (between 5 and 100)
      expect(scaleAmplitudeToBarHeight(0.5, 1, 5, 100)).toBe(50);
    });

    it("clamps to custom minHeight when result is below it", () => {
      // 0.0001 * 1 * 100 = 0.01 → clamped to 5
      expect(scaleAmplitudeToBarHeight(0.0001, 1, 5, 100)).toBe(5);
    });
  });

  describe("return type is always a number", () => {
    it("returns a number for any input", () => {
      expect(typeof scaleAmplitudeToBarHeight(0.3, 1.5)).toBe("number");
    });
  });
});
