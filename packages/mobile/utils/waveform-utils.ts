import { MAX_BAR_HEIGHT, MIN_BAR_HEIGHT } from "./waveform-constants";

/**
 * Scales a normalized amplitude value (0-1) to a bar height suitable for display.
 *
 * @param normalizedAmplitude The amplitude value, expected to be between 0 and 1 (e.g., RMS or average absolute value).
 * @param amplificationFactor How much to boost the amplitude visually.
 * @param minHeight The minimum pixel height for a bar.
 * @param maxHeight The maximum pixel height for a bar.
 * @returns The calculated bar height, clamped between minHeight and maxHeight.
 */
export function scaleAmplitudeToBarHeight(
  normalizedAmplitude: number,
  amplificationFactor: number,
  minHeight: number = MIN_BAR_HEIGHT,
  maxHeight: number = MAX_BAR_HEIGHT
): number {
  // Ensure normalizedAmplitude is non-negative
  const positiveAmplitude = Math.max(0, normalizedAmplitude);

  // Scale the amplitude
  const scaledAmplitude = positiveAmplitude * amplificationFactor * maxHeight;

  // Clamp the result between minHeight and maxHeight
  const barHeight = Math.max(minHeight, Math.min(scaledAmplitude, maxHeight));

  return barHeight;
}
