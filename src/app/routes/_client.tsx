import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ModeGate } from '../../modules/shell';

// Pathless layout (adds no URL segment): everything under it is
// client-only. A provider landing on these URLs is sent home.
export const Route = createFileRoute('/_client')({
  component: () => (
    <ModeGate mode="client">
      <Outlet />
    </ModeGate>
  ),
});
