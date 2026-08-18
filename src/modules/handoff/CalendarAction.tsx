import { t } from '../i18n';
import type { ReceivedAppointment } from '../received';
import {
  buildCalendarHandoff,
  deliverIcs,
  type CalendarProvider,
} from './calendarHandoff';

// The one calendar control (P0: one combined action per outcome — never two
// adjacent buttons). Used by the import screen, where `onActivate` runs the
// store write around the delivery, and by the client-home card, where the
// delivery is the whole action. The disclosure line (R10) renders with the
// button so both surfaces state that the event links back to the appointment.
export function CalendarAction({
  label,
  appointment,
  provider,
  onActivate,
}: {
  label: string;
  appointment: ReceivedAppointment;
  provider: CalendarProvider;
  /** Optional async work (e.g. the import's store write) kicked off in the
   * same tap, after the delivery has already fired synchronously. */
  onActivate?: () => void;
}) {
  function activate() {
    const { icsText, fileName } = buildCalendarHandoff(appointment, provider, {
      origin: window.location.origin,
      basePath: import.meta.env.BASE_URL,
    });
    // The share call / anchor click fires synchronously inside this
    // user-gesture handler, before any await — an awaited blob-URL click is
    // silently dropped on iOS.
    void deliverIcs(icsText, fileName);
    onActivate?.();
  }
  return (
    <>
      <button
        type="button"
        data-testid="calendar-action"
        onClick={activate}
        className="rounded-card bg-accent text-on-accent shadow-fab w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650]"
      >
        {label}
      </button>
      <p className="text-muted text-center text-[11.5px]">
        {t('handoff.calendar.disclosure')}
      </p>
    </>
  );
}
