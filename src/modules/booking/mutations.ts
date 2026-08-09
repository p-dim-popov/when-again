import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addAppointment, type Appointment } from '../appointments';
import { addClient, type Client } from '../clients';

// `addAppointment`/`addClient` (confirmed against `src/modules/appointments`
// and `src/modules/clients`) each take the entity minus its `id` and return
// the full, persisted entity (including the generated `id`) — so
// `mutateAsync` here hands the caller the new id directly.

export function useSaveAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Appointment, 'id'>) => addAppointment(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
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
