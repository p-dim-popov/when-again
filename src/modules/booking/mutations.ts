import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addAppointment,
  updateAppointment,
  type Appointment,
} from '../appointments';
import { addClient, type Client } from '../clients';

// The exact shape cached under `['appointment', id]` — written by
// `AppointmentForm`'s `editLoad` query and `ShareLanding`'s `record` query
// (both in this module), which must stay byte-for-byte identical since
// TanStack Query caches by key only, not by caller (see `ShareLanding.tsx`'s
// comment on `record`). `useCancelAppointment` below writes this same shape
// directly so `ShareLanding` sees the cancelled status immediately.
type AppointmentCacheEntry = {
  appointment: Appointment;
  clientName: string;
} | null;

// `addAppointment`/`addClient` (confirmed against `src/modules/appointments`
// and `src/modules/clients`) each take the entity minus its `id` and return
// the full, persisted entity (including the generated `id`) — so
// `mutateAsync` here hands the caller the new id directly.
//
// `updateAppointment(appointment: Appointment): Promise<void>` takes the FULL
// appointment (id included) and resolves to `void`; the hooks below re-return
// the appointment they wrote so callers/`onSuccess` still get the id.

export function useSaveAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Appointment, 'id'>) => addAppointment(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointment: Appointment) => {
      await updateAppointment(appointment);
      return appointment;
    },
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({
        queryKey: ['appointment', appointment.id],
      });
    },
  });
}

// Cancel reuses the update path: it flips `status` to 'cancelled' on the
// already-persisted appointment (kept as a de-emphasised record on the day
// view) rather than deleting it. Takes the loaded appointment so the rest of
// its fields survive unchanged — any unsaved edits in the form are ignored.
export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appointment: Appointment) => {
      const cancelled: Appointment = { ...appointment, status: 'cancelled' };
      await updateAppointment(cancelled);
      return cancelled;
    },
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      // Optimistically fold the now-cancelled status into the cached record
      // BEFORE the invalidation-triggered refetch resolves, so a `ShareLanding`
      // already mounted on `['appointment', id]` reads `status: 'cancelled'`
      // on its very next render instead of flashing the pre-cancel ("saved")
      // title for one frame while the invalidated query refetches.
      queryClient.setQueryData<AppointmentCacheEntry>(
        ['appointment', appointment.id],
        (old) => (old ? { ...old, appointment } : old),
      );
      void queryClient.invalidateQueries({
        queryKey: ['appointment', appointment.id],
      });
    },
  });
}

export function useAddClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Client, 'id'>) => addClient(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
