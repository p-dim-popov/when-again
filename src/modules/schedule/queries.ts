import { useQuery } from '@tanstack/react-query';
import { listAppointmentsOnDate } from '../appointments';
import { getSettings } from '../settings';
// NOTE: `clients` is not listed among this task's expected imports
// (appointments/settings/time), but appointment blocks need a client name to
// render per the mockup (`.who`) and `Appointment` only carries a `clientId`.
// `clients` is a same-tier entity module (see CLAUDE.md's dependency graph)
// with no cycle back to `schedule`, so it is imported here too. Flagged as a
// DONE_WITH_CONCERNS deviation in the task report.
import { listClients } from '../clients';

/** `listAppointmentsOnDate` takes the plain `'YYYY-MM-DD'` date key directly
 * (confirmed against `src/modules/appointments/appointments.ts`), so no
 * adaptation is needed between the route's date key and the query arg. */
export function useDayAppointments(dateKey: string) {
  return useQuery({
    queryKey: ['appointments', 'day', dateKey],
    queryFn: () => listAppointmentsOnDate(dateKey),
  });
}

export function useAllClients() {
  return useQuery({
    queryKey: ['clients', 'all'],
    queryFn: listClients,
  });
}

export function useProviderSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });
}
