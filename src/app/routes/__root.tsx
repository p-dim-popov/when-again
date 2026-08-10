import { createRootRoute } from '@tanstack/react-router';
import { AppShell } from '../../modules/shell';

export const Route = createRootRoute({
  component: AppShell,
});
