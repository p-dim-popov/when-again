import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ModeGate } from '../../modules/shell';

// Pathless layout (adds no URL segment): everything under it is
// provider-only. A client landing on these URLs is sent home.
export const Route = createFileRoute('/_provider')({
  component: () => (
    <ModeGate mode="provider">
      <Outlet />
    </ModeGate>
  ),
});
