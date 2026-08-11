import { useCallback, useState } from 'react';
import {
  addAppointment,
  updateAppointment,
  type Appointment,
} from '../appointments';
import { addClient, type Client } from '../clients';

function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [isPending, setPending] = useState(false);
  const mutateAsync = useCallback(
    async (...args: TArgs) => {
      setPending(true);
      try {
        return await fn(...args);
      } finally {
        setPending(false);
      }
    },
    [fn],
  );
  return { mutateAsync, isPending };
}

const saveFn = (data: Omit<Appointment, 'id'>) => addAppointment(data);
const updateFn = async (appointment: Appointment) => {
  await updateAppointment(appointment);
  return appointment;
};
const cancelFn = async (appointment: Appointment) => {
  const cancelled: Appointment = { ...appointment, status: 'cancelled' };
  await updateAppointment(cancelled);
  return cancelled;
};
const addClientFn = (data: Omit<Client, 'id'>) => addClient(data);

export const useSaveAppointment = () => useAsyncAction(saveFn);
export const useUpdateAppointment = () => useAsyncAction(updateFn);
export const useCancelAppointment = () => useAsyncAction(cancelFn);
export const useAddClient = () => useAsyncAction(addClientFn);
