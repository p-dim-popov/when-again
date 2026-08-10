import { createFileRoute } from '@tanstack/react-router';
import { ImportScreen } from '../../modules/handoff';

// The client-side import target. The payload rides in the URL FRAGMENT (never
// sent to the host); this route only needs to exist so GitHub Pages' SPA
// fallback boots the app here. ImportScreen reads `location.hash`.
export const Route = createFileRoute('/import')({
  component: ImportScreen,
});
