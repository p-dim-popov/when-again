import { createFileRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../../modules/shell';

// Route wiring only: the screen itself lives in modules/shell/SettingsScreen.
export const Route = createFileRoute('/settings')({
  component: SettingsScreen,
});
