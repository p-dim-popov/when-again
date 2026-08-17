import { db } from '../db';
import { type ReceivedAppointment } from '../received';
import { syntheticProviderId, upsertSavedProvider } from '../savedProviders';

// Resolve the grouping key once, before classify: the minted id from the
// payload, or the synthetic name key for payloads that predate it
// (ADR-0002). Classify compares providerId, so a legacy stored row shows
// "changed" exactly once and the update below writes the id.
export function enrichWithProviderKey(
  appointment: ReceivedAppointment,
  providerId?: string,
): ReceivedAppointment {
  return {
    ...appointment,
    providerId: providerId ?? syntheticProviderId(appointment.providerName),
  };
}

// One write path (Epic 6 invariant, extended): a confirmed import upserts
// the saved provider AND the received appointment atomically. Saved-provider
// attributes are overwritten wholesale — each payload is the provider's
// latest word on their own name/address/phone.
export async function applyHandoffImport(
  appointment: ReceivedAppointment,
  phone?: string,
): Promise<void> {
  const key =
    appointment.providerId ?? syntheticProviderId(appointment.providerName);
  await db.transaction('rw', db.savedProviders, db.received, async () => {
    await upsertSavedProvider({
      id: key,
      name: appointment.providerName,
      ...(appointment.address ? { address: appointment.address } : {}),
      ...(phone ? { phone } : {}),
    });
    await db.received.put({ ...appointment, providerId: key });
  });
}
