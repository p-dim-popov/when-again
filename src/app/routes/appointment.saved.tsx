import { createFileRoute } from '@tanstack/react-router';
import { ShareLanding } from '../../modules/booking';

// Save, cancel, and reschedule all navigate here after
// `patchDraft({ appointmentId })`; `ShareLanding` reads that id, shows a
// calm confirmation, and is the funnel's reset point (its "Готово" calls
// `resetDraft()`). No payload/QR here — that's Epic 6.
export const Route = createFileRoute('/appointment/saved')({
  component: ShareLanding,
});
