import { createFileRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../../modules/shell';

// Temporary: Epic 7 ships the real Settings screen; for now this keeps the
// БГ/EN/Auto language toggle reachable (see modules/shell/SettingsScreen).
export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
});
