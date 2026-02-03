export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function rgbToHex(r: number, g: number, b: number) {
  const to2 = (x: number) =>
    clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
}

// RGB -> LAB: insan algısına daha yakın renk mesafesi için
export function rgbToLab(
  rgb: [number, number, number]
): [number, number, number] {
  const [r8, g8, b8] = rgb;
  const r = srgbToLinear(r8 / 255);
  const g = srgbToLinear(g8 / 255);
  const b = srgbToLinear(b8 / 255);

  // linear RGB -> XYZ (D65)
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  // XYZ -> LAB
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const fx = labF(x / Xn);
  const fy = labF(y / Yn);
  const fz = labF(z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);

  return [L, a, bb];
}

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function labF(t: number) {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3)
    ? Math.cbrt(t)
    : t / (3 * delta * delta) + 4 / 29;
}

export function labDistanceSq(
  a: [number, number, number],
  b: [number, number, number]
) {
  const d0 = a[0] - b[0];
  const d1 = a[1] - b[1];
  const d2 = a[2] - b[2];
  return d0 * d0 + d1 * d1 + d2 * d2;
}
