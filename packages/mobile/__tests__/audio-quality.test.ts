import { Buffer } from "buffer";
import { analyzeAudioQuality, SIGNAL_THRESHOLD } from "../utils/audio-quality";

const SAMPLE_RATE = 44100;

/**
 * Creates a 5-window PCM buffer where each window has a controlled peak.
 * Each window is exactly SAMPLE_RATE samples (1 second).
 * The peak is set at the first sample of each window; all other samples are 0.
 */
function makeWindowedBuffer(peakPerWindow: number[]): Buffer[] {
  const buf = Buffer.alloc(SAMPLE_RATE * peakPerWindow.length * 2, 0);
  peakPerWindow.forEach((peak, w) => {
    const int16 = Math.round(peak * 32767);
    buf.writeInt16LE(int16, w * SAMPLE_RATE * 2);
  });
  return [buf];
}

/** Creates a buffer filled with a constant amplitude value across all samples. */
function makeConstantBuffer(amplitude: number, seconds: number): Buffer[] {
  const int16 = Math.round(amplitude * 32767);
  const buf = Buffer.alloc(SAMPLE_RATE * seconds * 2);
  for (let i = 0; i < SAMPLE_RATE * seconds; i++) {
    buf.writeInt16LE(int16, i * 2);
  }
  return [buf];
}

/** Creates a silent buffer (all zeros). */
function makeSilentBuffer(seconds: number): Buffer[] {
  return [Buffer.alloc(SAMPLE_RATE * seconds * 2, 0)];
}

describe("analyzeAudioQuality", () => {
  describe("silent / empty input", () => {
    it("returns all-zero metrics and flags as low signal for silent buffer", () => {
      const result = analyzeAudioQuality(makeSilentBuffer(5), SAMPLE_RATE);
      expect(result.medianPeak).toBe(0);
      expect(result.maxWindowPeak).toBe(0);
      expect(result.artifactRatio).toBe(0);
      expect(result.isLowSignal).toBe(true);
      expect(result.hasArtifacts).toBe(false);
    });

    it("returns empty chunks gracefully (concat of empty array = empty buffer)", () => {
      const result = analyzeAudioQuality([Buffer.alloc(0)], SAMPLE_RATE);
      expect(result.windowPeaks).toHaveLength(5);
      expect(result.windowPeaks.every((p) => p === 0)).toBe(true);
    });
  });

  describe("custom threshold parameter", () => {
    it("uses custom threshold when provided", () => {
      // amplitude 0.018 is below 0.02 (default) but above 0.015 (Android)
      const result = analyzeAudioQuality(makeConstantBuffer(0.018, 5), SAMPLE_RATE, 0.015);
      expect(result.isLowSignal).toBe(false);
    });

    it("flags low signal when amplitude is below custom threshold", () => {
      // amplitude 0.012 is below 0.015 (Android threshold)
      const result = analyzeAudioQuality(makeConstantBuffer(0.012, 5), SAMPLE_RATE, 0.015);
      expect(result.isLowSignal).toBe(true);
    });
  });

  describe("signal level detection", () => {
    it("flags signal just below threshold as low signal", () => {
      // SIGNAL_THRESHOLD - 0.001 rounds to a value still below the threshold
      const int16 = Math.round((SIGNAL_THRESHOLD - 0.001) * 32767);
      const buf = Buffer.alloc(SAMPLE_RATE * 5 * 2);
      for (let i = 0; i < SAMPLE_RATE * 5; i++) {
        buf.writeInt16LE(int16, i * 2);
      }
      const result = analyzeAudioQuality([buf], SAMPLE_RATE);
      expect(result.isLowSignal).toBe(true);
    });

    it("does not flag signal safely above threshold as low signal", () => {
      // 0.05 is safely above 0.02 threshold
      const result = analyzeAudioQuality(makeConstantBuffer(0.05, 5), SAMPLE_RATE);
      expect(result.isLowSignal).toBe(false);
    });

    it("correctly reports medianPeak for uniform signal", () => {
      const amplitude = 0.5;
      const result = analyzeAudioQuality(makeConstantBuffer(amplitude, 5), SAMPLE_RATE);
      expect(result.medianPeak).toBeCloseTo(amplitude, 2);
    });
  });

  describe("windowed peak extraction", () => {
    it("produces exactly 5 window peaks", () => {
      const result = analyzeAudioQuality(makeSilentBuffer(5), SAMPLE_RATE);
      expect(result.windowPeaks).toHaveLength(5);
    });

    it("extracts the correct peak per window", () => {
      const peaks = [0.1, 0.2, 0.3, 0.4, 0.5];
      const result = analyzeAudioQuality(makeWindowedBuffer(peaks), SAMPLE_RATE);
      result.windowPeaks.forEach((peak, i) => {
        expect(peak).toBeCloseTo(peaks[i], 2);
      });
    });

    it("pads with zeros when buffer shorter than 5 windows", () => {
      // Only 2 seconds of audio — windows 3, 4, 5 should be 0
      const result = analyzeAudioQuality(makeConstantBuffer(0.3, 2), SAMPLE_RATE);
      expect(result.windowPeaks[2]).toBe(0);
      expect(result.windowPeaks[3]).toBe(0);
      expect(result.windowPeaks[4]).toBe(0);
    });

    it("uses the correct median: middle value of sorted peaks", () => {
      // unsorted input: [0.5, 0.1, 0.3, 0.2, 0.4]
      // sorted:         [0.1, 0.2, 0.3, 0.4, 0.5] → median at index 2 = 0.3
      const peaks = [0.5, 0.1, 0.3, 0.2, 0.4];
      const result = analyzeAudioQuality(makeWindowedBuffer(peaks), SAMPLE_RATE);
      expect(result.medianPeak).toBeCloseTo(0.3, 2);
    });

    it("reports the highest window value as maxWindowPeak", () => {
      const peaks = [0.1, 0.05, 0.5, 0.2, 0.1];
      const result = analyzeAudioQuality(makeWindowedBuffer(peaks), SAMPLE_RATE);
      expect(result.maxWindowPeak).toBeCloseTo(0.5, 2);
    });
  });

  describe("artifact detection", () => {
    it("flags recording as having artifacts when ratio > 3", () => {
      // 4 quiet windows (0.05) + 1 loud spike (0.5) → ratio = 0.5 / 0.05 = 10
      const peaks = [0.05, 0.05, 0.05, 0.05, 0.5];
      const result = analyzeAudioQuality(makeWindowedBuffer(peaks), SAMPLE_RATE);
      expect(result.artifactRatio).toBeGreaterThan(3);
      expect(result.hasArtifacts).toBe(true);
    });

    it("does not flag uniform signal as artifact (ratio = 1)", () => {
      const result = analyzeAudioQuality(makeConstantBuffer(0.3, 5), SAMPLE_RATE);
      expect(result.artifactRatio).toBeCloseTo(1, 1);
      expect(result.hasArtifacts).toBe(false);
    });

    it("does not flag mild variation as artifact when ratio is exactly 3", () => {
      // median = 0.1, max = 0.3 → ratio = 3.0, threshold is > 3 so this should NOT flag
      const peaks = [0.1, 0.1, 0.1, 0.1, 0.3];
      const result = analyzeAudioQuality(makeWindowedBuffer(peaks), SAMPLE_RATE);
      expect(result.artifactRatio).toBeCloseTo(3, 1);
      expect(result.hasArtifacts).toBe(false);
    });

    it("artifactRatio is 4 when spike is 4× the median", () => {
      // median = 0.1, max = 0.4 → ratio should be ≈ 4
      const peaks = [0.1, 0.1, 0.1, 0.1, 0.4];
      const result = analyzeAudioQuality(makeWindowedBuffer(peaks), SAMPLE_RATE);
      expect(result.artifactRatio).toBeCloseTo(4, 1);
    });
  });

  describe("multi-chunk input", () => {
    it("correctly concatenates multiple chunks", () => {
      // Split a 5-second buffer into 5 chunks of 1 second each
      const full = makeConstantBuffer(0.3, 5)[0];
      const chunkSize = SAMPLE_RATE * 2; // 1 second in bytes
      const chunks = Array.from({ length: 5 }, (_, i) =>
        full.slice(i * chunkSize, (i + 1) * chunkSize)
      );
      const result = analyzeAudioQuality(chunks, SAMPLE_RATE);
      expect(result.medianPeak).toBeCloseTo(0.3, 2);
    });

    it("handles a single small chunk without crashing", () => {
      const chunk = Buffer.alloc(SAMPLE_RATE * 2); // 1 second
      chunk.writeInt16LE(10000, 0);
      expect(() => analyzeAudioQuality([chunk], SAMPLE_RATE)).not.toThrow();
    });
  });
});
