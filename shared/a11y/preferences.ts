/** Patient-controlled presentation. Voice remains an extra path, not the only one. */

export const TEXT_SCALES = ["default", "large", "extra-large"] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export interface A11yPreferences {
  textScale: TextScale;
  lowBandwidth: boolean;
  reduceMotion: boolean;
  /** When true, audio and video need captions or a transcript before they play. */
  captionsRequired: boolean;
}

export const DEFAULT_A11Y_PREFERENCES: A11yPreferences = {
  textScale: "default",
  lowBandwidth: false,
  reduceMotion: false,
  captionsRequired: false,
};

export function textScaleFactor(scale: TextScale): number {
  if (scale === "large") return 1.25;
  if (scale === "extra-large") return 1.5;
  return 1;
}
