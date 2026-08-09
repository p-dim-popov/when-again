import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addAppointment,
  updateAppointment,
  type Appointment,
} from '../appointments';
import { addClient, type Client } from '../clients';

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
