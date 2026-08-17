import { createFileRoute } from '@tanstack/react-router';
import { ProvidersScreen } from '../../modules/shell';

// Route wiring only. URL is /providers — a technical identifier; the tab
// label ("Salons"/"Салони") is UI copy, not a domain term (CONTEXT.md).
export const Route = createFileRoute('/_client/providers')({
  component: ProvidersScreen,
});
