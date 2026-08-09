import type { ServicePreset } from '../settings';

// Pure: remembers a just-used service into a provider's preset list so the
// most-recently-used service suggests first (both here and, indirectly, as
// the schedule screen's default slot step — see
// `schedule/ScheduleScreen.tsx`'s `stepMinutes`). Never mutates its input.
export function rememberService(
  services: ServicePreset[],
  entry: { name: string; durationMinutes: number; price?: number },
): ServicePreset[] {
  const nameLower = entry.name.trim().toLowerCase();
  const remembered: ServicePreset = {
    name: entry.name,
    durationMinutes: entry.durationMinutes,
    ...(entry.price !== undefined ? { price: entry.price } : {}),
  };
  const rest = services.filter(
    (s) => s.name.trim().toLowerCase() !== nameLower,
  );
  return [remembered, ...rest];
}
