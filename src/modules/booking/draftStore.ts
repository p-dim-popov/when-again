// `@tanstack/react-store` (the direct dependency declared in package.json)
// re-exports the full `@tanstack/store` core (`export * from
// "@tanstack/store"`), so `Store` comes from here too — this avoids an
// import from `@tanstack/store` itself, which is only a transitive/hoisted
// dependency, not one declared directly.
import { Store, useStore } from '@tanstack/react-store';

// Carries the in-flight booking-funnel selection (month picker -> slot ->
// form) across the funnel's separate route/screens, without prop-drilling.
// Reset once the appointment is saved (or the funnel is abandoned).
export interface BookingDraft {
  dateKey: string | null;
  time: string | null;
  appointmentId: string | null;
}

const initialDraft: BookingDraft = {
  dateKey: null,
  time: null,
  appointmentId: null,
};

export const draftStore = new Store<BookingDraft>(initialDraft);

export function setDraftDate(dateKey: string): void {
  draftStore.setState((state) => ({ ...state, dateKey }));
}

export function setDraftTime(time: string): void {
  draftStore.setState((state) => ({ ...state, time }));
}

export function resetDraft(): void {
  draftStore.setState(() => initialDraft);
}

/** Subscribes the component to the whole booking draft. */
export function useBookingDraft(): BookingDraft {
  return useStore(draftStore);
}
