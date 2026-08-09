import type { ServicePreset } from '../settings';

export interface PresetPatch {
  service: string;
  durationMinutes: number;
  price: number | null;
}

// Pure: the single patch a picked service preset applies to both the form
// fields and the draft store. Both consumers MUST derive from this same
// object — computing `price` independently for each (as the form once did,
// conditionally, while the draft always used `?? null`) is exactly how a
// stale price survived a switch from a priced preset to an unpriced one.
export function presetPatch(preset: ServicePreset): PresetPatch {
  return {
    service: preset.name,
    durationMinutes: preset.durationMinutes,
    price: preset.price ?? null,
  };
}
