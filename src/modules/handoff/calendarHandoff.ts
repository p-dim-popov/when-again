import { appointmentToIcs, icsFileName, type IcsAppointment } from '../ics';
import type { ReceivedAppointment } from '../received';
import { buildHandoffUrl } from './codec';

/**
 * Provider identity/contact riding in the rebuilt re-import link: the
 * payload's own `provider` on the import screen, the saved provider on the
 * client-home card.
 */
export interface CalendarProvider {
  id?: string;
  phone?: string;
}

export interface CalendarHandoff {
  icsText: string;
  fileName: string;
  reimportUrl: string;
}

/**
 * Map one received appointment (the decoded payload on the import screen,
 * the stored row on the saved card — each carrying its own revision, which
 * becomes SEQUENCE) to the deliverable `.ics` text, its file name, and the
 * re-import URL that rides in the event DESCRIPTION (AE4).
 */
export function buildCalendarHandoff(
  appointment: ReceivedAppointment,
  provider: CalendarProvider,
  opts: { origin: string; basePath: string },
  now?: Date,
): CalendarHandoff {
  const reimportUrl = buildHandoffUrl(
    {
      id: appointment.id,
      providerName: appointment.providerName,
      ...(appointment.address ? { address: appointment.address } : {}),
      service: appointment.service,
      start: appointment.start,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      ...(provider.id ? { providerId: provider.id } : {}),
      ...(provider.phone ? { phone: provider.phone } : {}),
      ...(appointment.revision ? { revision: appointment.revision } : {}),
    },
    opts,
  );
  const icsAppointment: IcsAppointment = {
    id: appointment.id,
    providerName: appointment.providerName,
    ...(appointment.address ? { address: appointment.address } : {}),
    service: appointment.service,
    start: appointment.start,
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    ...(appointment.revision !== undefined
      ? { revision: appointment.revision }
      : {}),
    reimportUrl,
  };
  return {
    icsText: appointmentToIcs(icsAppointment, now),
    fileName: icsFileName(appointment.start),
    reimportUrl,
  };
}

/**
 * Hand the `.ics` to the calendar app: share-sheet-first (KTD4), else a
 * plain file download. MUST be called synchronously inside the click
 * handler — the `navigator.share` call / anchor click happens before the
 * first `await`, because an awaited blob-URL click is silently dropped on
 * iOS. A dismissed share sheet (rejection) resolves quietly: no error
 * state, no false success.
 */
export async function deliverIcs(
  icsText: string,
  fileName: string,
): Promise<void> {
  const blob = new Blob([icsText], { type: 'text/calendar' });
  const file = new File([blob], fileName, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch {
      // The user dismissed the share sheet (or share failed) — stay quiet.
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // WebKit/standalone-PWA hazard: revoking immediately can cut the
  // download off before it starts, so defer it a tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
