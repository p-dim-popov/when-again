import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { db } from '../modules/db';
import { defineAppointmentsStore } from '../modules/appointments';
import { defineClientsStore } from '../modules/clients';
import { defineSettingsStore } from '../modules/settings';
import { defineReceivedStore } from '../modules/received';

// Register every store once, before any test touches the DB. A missing store is
// a hard throw, and cross-store readers (e.g. clients.getVisitHistory reads the
// appointments store) need the full schema.
defineAppointmentsStore(db);
defineClientsStore(db);
defineSettingsStore(db);
defineReceivedStore(db);

// Isolate every test: delete the database after each. The version declarations
// live on the `db` instance, so the next operation reopens with the same
// schema. `disableAutoOpen: false` overrides Dexie's default (`true`), which
// would otherwise make the next test's first DB op throw `DatabaseClosedError`
// instead of transparently reopening.
afterEach(async () => {
  await db.delete({ disableAutoOpen: false });
});
