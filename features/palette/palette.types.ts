export type PaletteMode = 'natural' | 'artwork';

export type ExtractOptions = {
  colorCount: number;
  mode: PaletteMode;
};

export type PaletteColor = {
  rgb: [number, number, number];
  hex: string;
  weight: number;
};
