/**
 * Interpolates a value [0, 1] to a color on the given scale.
 */
export function interpolateColor(t: number, scale: "blue" | "green" | "red" | "diverging" | string): string {
  const clamped = Math.max(0, Math.min(1, t));

  switch (scale) {
    case "blue":
      return interpolateRgb(clamped, [235, 245, 255], [30, 64, 175]);
    case "green":
      return interpolateRgb(clamped, [236, 253, 245], [22, 101, 52]);
    case "red":
      return interpolateRgb(clamped, [254, 242, 242], [185, 28, 28]);
    case "diverging":
      if (clamped < 0.5) {
        return interpolateRgb(clamped * 2, [185, 28, 28], [255, 255, 255]);
      }
      return interpolateRgb((clamped - 0.5) * 2, [255, 255, 255], [30, 64, 175]);
    default:
      return interpolateRgb(clamped, [235, 245, 255], [30, 64, 175]);
  }
}

function interpolateRgb(t: number, from: [number, number, number], to: [number, number, number]): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}
