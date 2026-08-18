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
    // Never regress the stored revision: a tap whose closure-captured
    // payload lands after a concurrent newer write (another tab, liveQuery
    // lag) must not undo it. Classify refuses stale links at render time;
    // this is the same guard at the write path. Absent revisions count as 0.
    const stored = await db.received.get(appointment.id);
    if ((appointment.revision ?? 0) < (stored?.revision ?? 0)) return;
    await upsertSavedProvider({
      id: key,
      name: appointment.providerName,
      ...(appointment.address ? { address: appointment.address } : {}),
      ...(phone ? { phone } : {}),
    });
    await db.received.put({ ...appointment, providerId: key });
  });
}

// The upToDate/revisionBehind write-through: catch the stored row's revision
// up to the payload's and touch NOTHING else. Deliberately not
// `applyHandoffImport` — that would also overwrite saved-provider
// name/address/phone (a tap-to-call surface) with no user interaction, so a
// crafted link with identical appointment fields and a bumped revision could
// silently replace the provider's phone on mere open. Attribute healing
// stays behind the interaction-gated import paths.
export async function catchUpReceivedRevision(
  stored: ReceivedAppointment,
  revision: number,
): Promise<void> {
  await db.received.put({ ...stored, revision });
}
