import { Navigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ReactNode } from 'react';
import { getSettings, type Mode } from '../settings';

// Reactive route guard (#7): wraps a pathless layout's Outlet. Reads the
// mode via useLiveQuery, so flipping it in Settings re-evaluates every
// guard instantly — no router.invalidate() choreography.
export function ModeGate({
  mode,
  children,
}: {
  mode: Mode;
  children: ReactNode;
}) {
  const settings = useLiveQuery(() => getSettings(), []);
  if (settings === undefined) return null; // loading — no flash
  if (settings.mode === null) return null; // first-run chooser is showing
  if (settings.mode !== mode) return <Navigate to="/" replace />;
  return <>{children}</>;
}
