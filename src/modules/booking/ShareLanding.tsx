import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from '@tanstack/react-router';
import { formatCurrency, getActiveLanguage, t } from '../i18n';
import { getAppointment } from '../appointments';
import { getClient } from '../clients';
import { formatDayLabel } from '../schedule';
import { getSettings } from '../settings';
import { HandoffShare } from '../handoff';
import { resetDraft, useBookingDraft } from './draftStore';

// The booking funnel's terminal screen. Save, cancel, and reschedule (Tasks
// 6b/7) all `patchDraft({ appointmentId })` just before navigating here, so
// `draft.appointmentId` identifies the appointment on arrival. This is also
// the funnel's reset point: Готово below calls `resetDraft()` so the next
// visit to any funnel screen starts clean (see the plan's "Design update",
// the Готово/Task 8 note).
//
// The share row below (Epic 6) renders the real QR + share/copy link once an
// appointment is loaded.
export function ShareLanding() {
  const navigate = useNavigate();
  const draft = useBookingDraft();
  const appointmentId = draft.appointmentId;

  const record = useLiveQuery(
    () =>
      appointmentId != null
        ? (async () => {
            const appointment = await getAppointment(appointmentId);
            if (!appointment) return null;
            const client = await getClient(appointment.clientId);
            return { appointment, clientName: client?.name ?? '' };
          })()
        : undefined,
    [appointmentId],
  );
  const appointment = record?.appointment;
  const settings = useLiveQuery(() => getSettings(), []);
  // Prefer the draft's client name (already populated in-flow, Task 6b);
  // `record.clientName` is the fallback for the edge case where the draft
  // lacks one (e.g. a reload lost the in-memory draft store but
  // `appointmentId` alone survived some other way).
  const clientName = draft.clientName ?? record?.clientName ?? '';

  // Edge: arriving here without a `draft.appointmentId` (direct navigation,
  // or a reload after a reset already ran) — nothing to summarize. Show a
  // calm "nothing to show" instead of rendering a blank/broken summary.
  if (appointmentId == null) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-[15px] py-6">
        <div className="flex w-full max-w-[360px] flex-col gap-3.5 text-center">
          <h1 className="font-display text-[19px] font-[680] tracking-[-0.01em]">
            {t('booking.landing.empty')}
          </h1>
          <button
            type="button"
            className="rounded-card bg-accent text-on-accent shadow-fab w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650]"
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

  const rowClassName =
    '[&+&]:border-line [&+&]:border-t flex items-baseline justify-between gap-2.5 py-[9px]';
  const dtClassName = 'text-faint text-[10.5px] tracking-[0.05em] uppercase';
  const ddClassName = 'text-ink m-0 text-right text-sm font-[550]';

  return (
    <main className="grid min-h-[60vh] place-items-center px-[15px] py-6">
      <div className="flex w-full max-w-[360px] flex-col gap-3.5 text-center">
        <h1 className="font-display text-[19px] font-[680] tracking-[-0.01em]">
          {t(
            cancelled
              ? 'booking.landing.cancelledTitle'
              : 'booking.landing.savedTitle',
          )}
        </h1>

        <dl className="border-line bg-surface-2 rounded-card border px-3.5 py-1 text-left">
          {clientName && (
            <div className={rowClassName}>
              <dt className={dtClassName}>{t('booking.landing.client')}</dt>
              <dd className={ddClassName}>{clientName}</dd>
            </div>
          )}
          {service && (
            <div className={rowClassName}>
              <dt className={dtClassName}>{t('booking.landing.service')}</dt>
              <dd className={ddClassName}>{service}</dd>
            </div>
          )}
          {dateKey && (
            <div className={rowClassName}>
              <dt className={dtClassName}>{t('booking.landing.when')}</dt>
              <dd className={ddClassName}>
                {formatDayLabel(dateKey, getActiveLanguage())}
                {time ? ` · ${time}` : ''}
              </dd>
            </div>
          )}
          {durationMinutes != null && (
            <div className={rowClassName}>
              <dt className={dtClassName}>{t('booking.landing.duration')}</dt>
              <dd className={ddClassName}>
                {durationMinutes} {t('booking.form.duration.suffix')}
              </dd>
            </div>
          )}
          {price != null && (
            <div className={rowClassName}>
              <dt className={dtClassName}>{t('booking.landing.price')}</dt>
              <dd className={ddClassName}>{formatCurrency(price)}</dd>
            </div>
          )}
        </dl>

        {appointment && (
          <HandoffShare
            appointment={appointment}
            providerName={settings?.providerName ?? ''}
            address={settings?.address}
          />
        )}

        <button
          type="button"
          className="rounded-card bg-accent text-on-accent shadow-fab w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650]"
          onClick={handleDone}
        >
          {t('booking.landing.done')}
        </button>
      </div>
    </main>
  );
}
