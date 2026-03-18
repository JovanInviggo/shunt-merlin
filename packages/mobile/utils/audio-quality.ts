import { Buffer } from "buffer";

export interface AudioQualityResult {
  medianPeak: number;
  maxWindowPeak: number;
  artifactRatio: number;
  hasArtifacts: boolean;
  isLowSignal: boolean;
  windowPeaks: number[];
}

export const SIGNAL_THRESHOLD = 0.02; // default / iOS
export const SIGNAL_THRESHOLD_IOS = 0.02;
export const SIGNAL_THRESHOLD_ANDROID = 0.015; // Samsung and other Android mics have lower gain
const QUALITY_WINDOW_COUNT = 5;

export function analyzeAudioQuality(
  chunks: Buffer[],
  sampleRate: number,
  threshold = SIGNAL_THRESHOLD
): AudioQualityResult {
  const audioData = Buffer.concat(chunks);
  const totalSamples = audioData.length / 2; // 16-bit = 2 bytes per sample
  const windowSamples = sampleRate; // 1 second per window

  const windowPeaks: number[] = [];
  for (let w = 0; w < QUALITY_WINDOW_COUNT; w++) {
    const startSample = w * windowSamples;
    const endSample = Math.min(startSample + windowSamples, totalSamples);

    if (startSample >= totalSamples) {
      windowPeaks.push(0);
      continue;
    }

    let peak = 0;
    for (let i = startSample; i < endSample; i++) {
      const float = Math.abs(audioData.readInt16LE(i * 2) / 32768.0);
      if (float > peak) peak = float;
    }
    windowPeaks.push(peak);
  }

  const sorted = [...windowPeaks].sort((a, b) => a - b);
  const medianPeak = sorted[Math.floor(sorted.length / 2)];
  const maxWindowPeak = Math.max(...windowPeaks);
  const artifactRatio = medianPeak > 0 ? maxWindowPeak / medianPeak : 0;

  return {
    medianPeak,
    maxWindowPeak,
    artifactRatio,
    hasArtifacts: artifactRatio > 3,
    isLowSignal: medianPeak < threshold,
    windowPeaks,
  };
}
