// `@tanstack/react-store` (the direct dependency declared in package.json)
// re-exports the full `@tanstack/store` core (`export * from
// "@tanstack/store"`), so `Store` comes from here too — this avoids an
// import from `@tanstack/store` itself, which is only a transitive/hoisted
// dependency, not one declared directly.
import { Store, useStore } from '@tanstack/react-store';

// Carries the in-flight booking-funnel selection (month picker -> slot ->
// form) across the funnel's separate route/screens, without prop-drilling.
//
// Also carries the in-progress appointment fields (client/service/duration/
// price) so that a "Промени" round trip — form -> day view (to re-pick the
// time) -> form — does not lose what the provider already typed. The day
// view only ever touches `dateKey`/`time`; the form seeds those two from the
// route's search params on mount and leaves the rest of the draft alone.
export interface BookingDraft {
  dateKey: string | null;
  time: string | null;
  appointmentId: string | null;
  clientId: string | null;
  clientName: string | null;
  service: string | null;
  durationMinutes: number | null;
  price: number | null;
}

const initialDraft: BookingDraft = {
  dateKey: null,
  time: null,
  appointmentId: null,
  clientId: null,
  clientName: null,
  service: null,
  durationMinutes: null,
  price: null,
};

export const draftStore = new Store<BookingDraft>(initialDraft);

export function setDraftDate(dateKey: string): void {
  draftStore.setState((state) => ({ ...state, dateKey }));
}

/** Merges `partial` into the draft without touching any other field. */
export function patchDraft(partial: Partial<BookingDraft>): void {
  draftStore.setState((state) => ({ ...state, ...partial }));
}

export function resetDraft(): void {
  draftStore.setState(() => initialDraft);
}

/** Subscribes the component to the whole booking draft. */
export function useBookingDraft(): BookingDraft {
  return useStore(draftStore);
}
