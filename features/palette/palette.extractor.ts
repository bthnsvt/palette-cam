import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

import { labDistanceSq, rgbToHex, rgbToLab } from './color.utils';
import type {
  ExtractOptions,
  PaletteColor,
  PaletteMode,
} from './palette.types';

type Sample = {
  rgb: [number, number, number];
  lab: [number, number, number];
};

type Cluster = {
  centerLab: [number, number, number];
  centerRgb: [number, number, number];
  count: number;
};

type Candidate = {
  rgb: [number, number, number];
  lab: [number, number, number];
  count: number;
  hex: string;
  hue: number; // 0..360
  sat: number; // 0..1
};

export async function extractPaletteFromPhotoUri(
  photoUri: string,
  options: ExtractOptions
): Promise<PaletteColor[]> {
  const { colorCount, mode } = options;

  // 1) Küçült + JPEG’e çevir (hız + decode garanti)
  const manipulated = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 180 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 2) JPEG decode -> RGBA
  const res = await fetch(manipulated.uri);
  const ab = await res.arrayBuffer();
  const bytes = new Uint8Array(ab);

  const decoded = jpeg.decode(bytes as any, { useTArray: true });
  if (!decoded?.data) throw new Error('Failed to decode image');

  const rgba: Uint8Array = decoded.data;

  // 3) sample setini hazırla
  const samples = buildSamplesByMode(rgba, mode);

  // 4) K-Means (LAB)
  const clusters = kmeansLab(samples, colorCount, 12);

  // 5) Merge: Artwork’te daha az merge -> tonları korur
  const mergeThreshold = mode === 'artwork' ? 12 : 18;
  const merged = mergeCloseClusters(clusters, mergeThreshold);

  // 6) Candidate listesi
  const candidates: Candidate[] = merged
    .filter((c) => c.count > 0)
    .map((c) => {
      const r = clamp255(Math.round(c.centerRgb[0]));
      const g = clamp255(Math.round(c.centerRgb[1]));
      const b = clamp255(Math.round(c.centerRgb[2]));
      const rgb: [number, number, number] = [r, g, b];
      const lab = rgbToLab(rgb);
      const { h, s } = rgbToHsv(rgb);
      return {
        rgb,
        lab,
        count: c.count,
        hex: rgbToHex(r, g, b),
        hue: h,
        sat: s,
      };
    })
    .sort((a, b) => b.count - a.count);

  if (candidates.length === 0) return [];

  // 7) Mode’a göre seçim stratejisi
  const selected =
    mode === 'artwork'
      ? selectArtworkPaletteWithAccentFamily(candidates, colorCount)
      : selectNaturalPalette(candidates, colorCount);

  // 8) weight normalize (sadece seçilenler üzerinden)
  const total = selected.reduce((sum, c) => sum + c.count, 0) || 1;

  return selected.map((c) => ({
    rgb: c.rgb,
    hex: c.hex,
    weight: c.count / total,
  }));
}

/**
 * NATURAL:
 * - Direkt “en çok görünen” ilk N rengi alır.
 * - Bu mod gerçek dağılım içindir, accent hilesi yok.
 */
function selectNaturalPalette(
  candidates: Candidate[],
  colorCount: number
): Candidate[] {
  return candidates.slice(0, colorCount);
}

/**
 * ARTWORK (GENELLEŞTİRİLMİŞ):
 * - “Kırmızıya özel” değil.
 * - Fotoğraftaki en “doygun” (accent) renk ailesini otomatik bulur.
 * - O aileden 2 farklı tonu (açık/koyu gibi) palete koymaya çalışır.
 * - Kalan slotları çeşitlilikle doldurur.
 */
function selectArtworkPaletteWithAccentFamily(
  candidates: Candidate[],
  colorCount: number
): Candidate[] {
  const selected: Candidate[] = [];

  // 1) Base: en baskın renk (genel zemin)
  selected.push(candidates[0]);

  // 2) Accent ailesini bul: doygun renkleri hue-bucket’lara ayır
  // Hue bucket genişliği (derece): 20 => aynı renk ailesi daha iyi yakalanır
  const BUCKET = 20;

  // “Accent” saymak için minimum doygunluk ve minimum görünürlük
  const satMin = 0.22;

  // Çok küçük lekeleri yok saymak için (toplam adaylar üzerinden yaklaşık)
  const totalCount = candidates.reduce((s, c) => s + c.count, 0) || 1;
  const minCount = Math.floor(totalCount * 0.003); // ~0.3% ve üzeri

  const accentCandidates = candidates.filter(
    (c) => c.sat >= satMin && c.count >= minCount
  );

  const bucketStats = new Map<number, { score: number; list: Candidate[] }>();

  for (const c of accentCandidates) {
    const bucket = hueBucket(c.hue, BUCKET);
    const entry = bucketStats.get(bucket) ?? { score: 0, list: [] };

    // Score: doygunluk * (count) => hem canlı hem görünür olanı öne çıkar
    entry.score += c.sat * c.count;
    entry.list.push(c);

    bucketStats.set(bucket, entry);
  }

  // Eğer hiç accent yoksa: çeşitlilikle doldur
  if (bucketStats.size === 0) {
    return fillWithDiversity(candidates, selected, colorCount, 12);
  }

  // En iyi bucket’ı bul (accent family)
  let bestBucket: number | null = null;
  let bestScore = -1;

  for (const [bucket, info] of bucketStats.entries()) {
    if (info.score > bestScore) {
      bestScore = info.score;
      bestBucket = bucket;
    }
  }

  const accentList =
    bestBucket === null ? [] : bucketStats.get(bestBucket)!.list;

  // 3) Accent ailesinden 2 farklı ton seç
  //  - İlk: en görünür (count yüksek)
  //  - İkinci: seçilenden LAB’da yeterince uzak (ton farkı yakalansın)
  accentList.sort((a, b) => b.count - a.count);

  const firstAccent = pickFirstNotIn(selected, accentList);
  if (firstAccent) selected.push(firstAccent);

  const secondAccent = pickFirstWithMinLabDistance(selected, accentList, 10);
  if (secondAccent) selected.push(secondAccent);

  // 4) Kalan slotları çeşitlilikle doldur
  return fillWithDiversity(candidates, selected, colorCount, 12);
}

function fillWithDiversity(
  candidates: Candidate[],
  selected: Candidate[],
  colorCount: number,
  minDist: number
): Candidate[] {
  // Önce “çok küçükleri” biraz kırp (Artwork’te çok agresif değil)
  const total = candidates.reduce((s, c) => s + c.count, 0) || 1;
  const minWeight = 0.005;

  const filtered = candidates.filter((c) => c.count / total >= minWeight);

  for (const c of filtered) {
    if (selected.length >= colorCount) break;
    if (isAlreadySelected(selected, c)) continue;

    const tooClose = selected.some(
      (s) => Math.sqrt(labDistanceSq(s.lab, c.lab)) < minDist
    );
    if (tooClose) continue;

    selected.push(c);
  }

  // Eğer hâlâ dolmadıysa, en baştan başlayıp doldur (yakınlık filtresiz)
  if (selected.length < colorCount) {
    for (const c of candidates) {
      if (selected.length >= colorCount) break;
      if (isAlreadySelected(selected, c)) continue;
      selected.push(c);
    }
  }

  return selected.slice(0, colorCount);
}

function pickFirstNotIn(selected: Candidate[], list: Candidate[]) {
  for (const c of list) {
    if (!isAlreadySelected(selected, c)) return c;
  }
  return null;
}

function pickFirstWithMinLabDistance(
  selected: Candidate[],
  list: Candidate[],
  minDist: number
) {
  for (const c of list) {
    if (isAlreadySelected(selected, c)) continue;
    const ok = selected.every(
      (s) => Math.sqrt(labDistanceSq(s.lab, c.lab)) >= minDist
    );
    if (ok) return c;
  }
  return null;
}

function isAlreadySelected(selected: Candidate[], c: Candidate) {
  return selected.some((s) => s.hex === c.hex);
}

/**
 * Hue’yu bucket’a yerleştirir (ör: 0..19 => 0, 20..39 => 20)
 */
function hueBucket(h: number, bucketSize: number) {
  const b = Math.floor(h / bucketSize) * bucketSize;
  return b === 360 ? 0 : b;
}

function buildSamplesByMode(rgba: Uint8Array, mode: PaletteMode): Sample[] {
  return mode === 'artwork'
    ? buildSamplesArtwork(rgba)
    : buildSamplesNatural(rgba);
}

/**
 * NATURAL: dağılımı olduğu gibi
 */
function buildSamplesNatural(rgba: Uint8Array): Sample[] {
  const samples: Sample[] = [];
  const stepPixels = 6;
  const step = 4 * stepPixels;

  for (let i = 0; i < rgba.length; i += step) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];

    if (a < 220) continue;

    const brightness = (r + g + b) / 3;
    if (brightness < 5) continue;
    if (brightness > 252) continue;

    const rgb: [number, number, number] = [r, g, b];
    samples.push({ rgb, lab: rgbToLab(rgb) });
  }

  return samples;
}

/**
 * ARTWORK: daha fazla örnek + background bastırma + gri azaltma
 */
function buildSamplesArtwork(rgba: Uint8Array): Sample[] {
  const samples: Sample[] = [];
  const stepPixels = 4;
  const step = 4 * stepPixels;

  for (let i = 0; i < rgba.length; i += step) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const a = rgba[i + 3];

    if (a < 220) continue;

    const brightness = (r + g + b) / 3;
    if (brightness < 10) continue;
    if (brightness > 248) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max - min;

    if (brightness > 160 && saturation < 20) continue;
    if (saturation < 6) continue;

    const rgb: [number, number, number] = [r, g, b];
    samples.push({ rgb, lab: rgbToLab(rgb) });
  }

  return samples;
}

function kmeansLab(
  samples: Sample[],
  k: number,
  iterations: number
): Cluster[] {
  if (samples.length === 0) return [];

  const centers: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    const s = samples[Math.floor(Math.random() * samples.length)];
    centers.push([...s.lab] as [number, number, number]);
  }

  const assignments = new Array<number>(samples.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    // assign
    for (let i = 0; i < samples.length; i++) {
      let best = 0;
      let bestDist = Infinity;

      for (let c = 0; c < centers.length; c++) {
        const d = labDistanceSq(samples[i].lab, centers[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignments[i] = best;
    }

    // update
    const sum = Array.from({ length: k }, () => [0, 0, 0]);
    const count = Array.from({ length: k }, () => 0);

    for (let i = 0; i < samples.length; i++) {
      const a = assignments[i];
      const [L, A, B] = samples[i].lab;
      sum[a][0] += L;
      sum[a][1] += A;
      sum[a][2] += B;
      count[a] += 1;
    }

    for (let c = 0; c < k; c++) {
      if (count[c] === 0) continue;
      centers[c] = [
        sum[c][0] / count[c],
        sum[c][1] / count[c],
        sum[c][2] / count[c],
      ];
    }
  }

  const clusters: Cluster[] = centers.map((centerLab) => ({
    centerLab,
    centerRgb: [0, 0, 0],
    count: 0,
  }));

  const sumRgb = Array.from({ length: k }, () => [0, 0, 0]);
  const countRgb = Array.from({ length: k }, () => 0);

  for (let i = 0; i < samples.length; i++) {
    const c = assignments[i];
    clusters[c].count += 1;

    const [r, g, b] = samples[i].rgb;
    sumRgb[c][0] += r;
    sumRgb[c][1] += g;
    sumRgb[c][2] += b;
    countRgb[c] += 1;
  }

  for (let c = 0; c < k; c++) {
    if (countRgb[c] === 0) continue;
    clusters[c].centerRgb = [
      sumRgb[c][0] / countRgb[c],
      sumRgb[c][1] / countRgb[c],
      sumRgb[c][2] / countRgb[c],
    ];
  }

  return clusters.filter((c) => c.count > 0);
}

function mergeCloseClusters(clusters: Cluster[], threshold: number): Cluster[] {
  const result: Cluster[] = [];

  for (const c of clusters) {
    let merged = false;

    for (const r of result) {
      const d = Math.sqrt(labDistanceSq(c.centerLab, r.centerLab));
      if (d < threshold) {
        const total = r.count + c.count;

        r.centerLab = [
          (r.centerLab[0] * r.count + c.centerLab[0] * c.count) / total,
          (r.centerLab[1] * r.count + c.centerLab[1] * c.count) / total,
          (r.centerLab[2] * r.count + c.centerLab[2] * c.count) / total,
        ];

        r.centerRgb = [
          (r.centerRgb[0] * r.count + c.centerRgb[0] * c.count) / total,
          (r.centerRgb[1] * r.count + c.centerRgb[1] * c.count) / total,
          (r.centerRgb[2] * r.count + c.centerRgb[2] * c.count) / total,
        ];

        r.count = total;
        merged = true;
        break;
      }
    }

    if (!merged) result.push({ ...c });
  }

  return result;
}

function rgbToHsv(rgb: [number, number, number]) {
  const [r8, g8, b8] = rgb;
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;

    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h, s, v };
}

function clamp255(n: number) {
  return Math.max(0, Math.min(255, n));
}
