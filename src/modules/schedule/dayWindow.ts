/**
 * The bookable day window, in wall-clock 'HH:mm'. Single source of truth for
 * both `ScheduleScreen` (slot-chip generation) and `TimePicker` (друг час
 * bounds, via its `dayEnd` fallback) — do not redeclare these elsewhere.
 *
 * There is no working-hours setting yet — a later Settings epic may make
 * this configurable.
 */
export const DAY_START = '08:00';
export const DAY_END = '20:00';
