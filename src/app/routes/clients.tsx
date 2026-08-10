import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '../../modules/shell';

export const Route = createFileRoute('/clients')({
  component: () => <Placeholder titleKey="shell.placeholder.clients" />,
});
