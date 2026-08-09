import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { formatCurrency, getActiveLanguage, t } from '../i18n';
import { getAppointment, type Appointment } from '../appointments';
import { getClient } from '../clients';
import { formatDayLabel } from '../schedule';
import { resetDraft, useBookingDraft } from './draftStore';
import './ShareLanding.css';

// The booking funnel's terminal screen. Save, cancel, and reschedule (Tasks
// 6b/7) all `patchDraft({ appointmentId })` just before navigating here, so
// `draft.appointmentId` identifies the appointment on arrival. This is also
// the funnel's reset point: Готово below calls `resetDraft()` so the next
// visit to any funnel screen starts clean (see the plan's "Design update",
// the Готово/Task 8 note).
//
// Epic 6 owns the real QR/payload/share; the Сподели button here is
// deliberately disabled — it only announces that the feature is coming.
export function ShareLanding() {
  const navigate = useNavigate();
  const draft = useBookingDraft();
  const appointmentId = draft.appointmentId;

  // The authoritative record: reuses the `['appointment', id]` cache that
  // `useUpdateAppointment`/`useCancelAppointment` (mutations.ts) invalidate,
  // so it reflects the just-written status without a second fetch on top of
  // what those mutations already triggered. Needed for the status-aware
  // title (a fresh save is never 'cancelled', but a fresh cancel is).
  //
  // The query SHAPE here must exactly match `AppointmentForm`'s edit-load
  // query (same file, `editLoad`) — both hang off the identical
  // `['appointment', id]` key, and TanStack Query caches by key only, not by
  // caller. A mismatched shape (e.g. this originally returning the raw
  // `Appointment` while the form's query returns `{ appointment, clientName
  // }`) serves the WRONG shape to whichever query mounts second, which
  // crashes it (found by scratch-testing: save → landing → tap the
  // appointment to edit threw `Cannot read properties of undefined (reading
  // 'start')`). Fetching the client name here too — even though it is
  // usually unused below, since `draft.clientName` is preferred — is what
  // keeps the shape identical.
  const { data: record } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async (): Promise<{
      appointment: Appointment;
      clientName: string;
    } | null> => {
      const appointment = await getAppointment(appointmentId as string);
      if (!appointment) return null;
      const client = await getClient(appointment.clientId);
      return { appointment, clientName: client?.name ?? '' };
    },
    enabled: appointmentId != null,
  });
  const appointment = record?.appointment;
  // Prefer the draft's client name (already populated in-flow, Task 6b);
  // `record.clientName` — fetched as part of the query above regardless, to
  // keep its shape aligned with the edit-load query — is the fallback for
  // the edge case where the draft lacks one (e.g. a reload lost the
  // in-memory draft store but `appointmentId` alone survived some other
  // way).
  const clientName = draft.clientName ?? record?.clientName ?? '';

  // Edge: arriving here without a `draft.appointmentId` (direct navigation,
  // or a reload after a reset already ran) — nothing to summarize. Show a
  // calm "nothing to show" instead of rendering a blank/broken summary.
  if (appointmentId == null) {
    return (
      <main className="shareLanding">
        <div className="shareLanding-card">
          <h1 className="shareLanding-title">{t('booking.landing.empty')}</h1>
          <button
            type="button"
            className="shareLanding-done"
            onClick={() => void navigate({ to: '/' })}
          >
            {t('booking.landing.done')}
          </button>
        </div>
      </main>
    );
  }

  const cancelled = appointment?.status === 'cancelled';
  const service = draft.service ?? appointment?.service ?? '';
  const dateKey =
    draft.dateKey ?? appointment?.start.dateTime.slice(0, 10) ?? null;
  const time =
    draft.time ??
    (appointment ? appointment.start.dateTime.slice(11, 16) : null);
  const durationMinutes =
    draft.durationMinutes ?? appointment?.durationMinutes ?? null;
  const price = draft.price ?? appointment?.price ?? null;

  function handleDone() {
    // Capture before `resetDraft()` clears it — this is the reset point.
    const returnDateKey = draft.dateKey;
    resetDraft();
    void navigate({ to: '/', search: { date: returnDateKey ?? undefined } });
  }

  return (
    <main className="shareLanding">
      <div className="shareLanding-card">
        <h1 className="shareLanding-title">
          {t(
            cancelled
              ? 'booking.landing.cancelledTitle'
              : 'booking.landing.savedTitle',
          )}
        </h1>

        <dl className="shareLanding-summary">
          {clientName && (
            <div className="shareLanding-row">
              <dt>{t('booking.landing.client')}</dt>
              <dd>{clientName}</dd>
            </div>
          )}
          {service && (
            <div className="shareLanding-row">
              <dt>{t('booking.landing.service')}</dt>
              <dd>{service}</dd>
            </div>
          )}
          {dateKey && (
            <div className="shareLanding-row">
              <dt>{t('booking.landing.when')}</dt>
              <dd>
                {formatDayLabel(dateKey, getActiveLanguage())}
                {time ? ` · ${time}` : ''}
              </dd>
            </div>
          )}
          {durationMinutes != null && (
            <div className="shareLanding-row">
              <dt>{t('booking.landing.duration')}</dt>
              <dd>
                {durationMinutes} {t('booking.form.duration.suffix')}
              </dd>
            </div>
          )}
          {price != null && (
            <div className="shareLanding-row">
              <dt>{t('booking.landing.price')}</dt>
              <dd>{formatCurrency(price)}</dd>
            </div>
          )}
        </dl>

        <button
          type="button"
          className="shareLanding-share"
          disabled
          aria-disabled="true"
        >
          {t('booking.landing.shareSoon')}
        </button>

        <button
          type="button"
          className="shareLanding-done"
          onClick={handleDone}
        >
          {t('booking.landing.done')}
        </button>
      </div>
    </main>
  );
}
