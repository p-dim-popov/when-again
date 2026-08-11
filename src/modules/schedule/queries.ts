import { useLiveQuery } from 'dexie-react-hooks';
import { listAppointmentsOnDate } from '../appointments';
import { listClients } from '../clients';
import { getSettings } from '../settings';

export function useDayAppointments(dateKey: string) {
  return useLiveQuery(() => listAppointmentsOnDate(dateKey), [dateKey]);
}

export function useAllClients() {
  return useLiveQuery(() => listClients(), []);
}

export function useProviderSettings() {
  return useLiveQuery(() => getSettings(), []);
}
