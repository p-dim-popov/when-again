import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveLanguage, t } from '../i18n';
import { formatDayLabel } from '../schedule';
import { getReceived, type ReceivedAppointment } from '../received';
import { decodeHandoff } from './codec';
import { classifyImport, type ImportOutcome } from './classify';
import { applyHandoffImport, enrichWithProviderKey } from './importWrite';
import { CalendarAction } from './CalendarAction';
import { adoptClientModeIfUnset } from '../settings';

function CalmScreen({
  title,
  children,
  onDone,
  doneLabel,
}: {
  title: string;
  children?: React.ReactNode;
  onDone: () => void;
  doneLabel: string;
}) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-[15px] py-6">
      <div className="flex w-full max-w-[360px] flex-col gap-3.5 text-center">
        <h1 className="font-display text-[19px] font-[680] tracking-[-0.01em]">
          {title}
        </h1>
        {children}
        <button
          type="button"
          onClick={onDone}
          className="rounded-card bg-accent text-on-accent shadow-fab w-full cursor-pointer border-0 p-[13px] text-center text-[15px] font-[650]"
        >
          {doneLabel}
        </button>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="[&+&]:border-line flex items-baseline justify-between gap-2.5 py-[9px] [&+&]:border-t">
      <dt className="text-faint text-[10.5px] tracking-[0.05em] uppercase">
        {label}
      </dt>
      <dd className="text-ink m-0 text-right text-sm font-[550]">{value}</dd>
    </div>
  );
}

function Card({ appt }: { appt: ReceivedAppointment }) {
  const when = `${formatDayLabel(appt.start.dateTime.slice(0, 10), getActiveLanguage())} · ${appt.start.dateTime.slice(11, 16)}`;
  return (
    <dl className="border-line bg-surface-2 rounded-card border px-3.5 py-1 text-left">
      <SummaryRow
        label={t('handoff.field.provider')}
        value={appt.providerName}
      />
      <SummaryRow label={t('handoff.field.service')} value={appt.service} />
      <SummaryRow label={t('handoff.field.when')} value={when} />
      <SummaryRow
        label={t('handoff.field.duration')}
        value={`${appt.durationMinutes} ${t('booking.form.duration.suffix')}`}
      />
      {appt.address && (
        <SummaryRow label={t('handoff.field.address')} value={appt.address} />
      )}
    </dl>
  );
}

export function ImportScreen() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState<null | 'added' | 'updated' | 'removed'>(
    null,
  );
  const [writeError, setWriteError] = useState(false);
  const [fragment, setFragment] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash.slice(1) : '',
  );

  // The payload rides in the URL fragment, which the router does not track.
  // Re-opening a `/import#...` link while the app is already on that route
  // — including the exact same link twice, e.g. to re-check a prior import —
  // is a same-document navigation: no reload, no route remount, so the
  // fragment must be re-read explicitly. `popstate` fires for both a
  // fragment change and a revisit to an identical URL; re-read the fragment
  // and drop any prior confirmation so decode → classify runs again.
  useEffect(() => {
    function onPopState() {
      setFragment(window.location.hash.slice(1));
      setSaved(null);
      setWriteError(false);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Memoized so the write-through effect below keys on the fragment, not on
  // a fresh object identity every render.
  const decoded = useMemo(
    () => (fragment ? decodeHandoff(fragment) : null),
    [fragment],
  );
  const incoming = useMemo(
    () =>
      decoded?.ok
        ? enrichWithProviderKey(decoded.appointment, decoded.provider.id)
        : null,
    [decoded],
  );
  const incomingId = decoded?.ok ? decoded.appointment.id : undefined;

  const storedResult = useLiveQuery(
    () =>
      incomingId != null
        ? getReceived(incomingId).then((value) => ({ value }))
        : undefined,
    [incomingId],
  );
  const stored = storedResult?.value;

  // Write-through: a reshared no-op edit carries a higher revision over
  // identical fields. Classify still reports upToDate — nothing the client
  // sees changes — but the stored row must catch up silently, or a later
  // calendar emit from the saved card would use a stale SEQUENCE. Best
  // effort: on failure the next open of the same link retries.
  useEffect(() => {
    if (!decoded?.ok || !incoming || !stored) return;
    const outcome = classifyImport(incoming, stored);
    if (outcome.kind !== 'upToDate' || !outcome.revisionBehind) return;
    void applyHandoffImport(incoming, decoded.provider.phone).catch(() => {});
  }, [decoded, incoming, stored]);

  const goHome = () => void navigate({ to: '/' });

  // --- edge states -------------------------------------------------------
  if (!fragment) {
    return (
      <CalmScreen
        title={t('handoff.import.empty')}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      />
    );
  }
  if (!decoded || !decoded.ok) {
    const reason = decoded && !decoded.ok ? decoded.reason : 'malformed';
    return (
      <CalmScreen
        title={t(
          reason === 'unsupported-version'
            ? 'handoff.import.invalid.version'
            : 'handoff.import.invalid.malformed',
        )}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      />
    );
  }

  // decoded.ok is guaranteed by the edge-state returns above, so `incoming`
  // was set by the ternary — narrow without the non-null assertion operator.
  if (!incoming) return null;

  // --- post-write confirmation ------------------------------------------
  if (saved) {
    const title =
      saved === 'added'
        ? t('handoff.import.added')
        : saved === 'updated'
          ? t('handoff.import.updated')
          : t('handoff.import.removed');
    return (
      <CalmScreen
        title={title}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      >
        <Card appt={incoming} />
        {saved !== 'added' && (
          // KTD9: iOS can silently no-op a same-UID re-import; after an
          // update or cancel, one guidance line covers the manual fix.
          <p className="text-muted text-center text-[11.5px]">
            {t('handoff.calendar.fallbackHint')}
          </p>
        )}
      </CalmScreen>
    );
  }

  if (incomingId != null && storedResult === undefined) return null;

  const outcome: ImportOutcome = classifyImport(incoming, stored);

  async function write(next: 'added' | 'updated' | 'removed') {
    // `incoming`/`decoded` are narrowed above in the component body, but
    // that narrowing doesn't reach into this nested function's closure —
    // TypeScript sees both as their declared (nullable) types here. Guard
    // locally rather than asserting with `!`; unreachable at runtime since
    // `write` is only ever invoked after the outer narrowing succeeded.
    if (!decoded?.ok || !incoming) return;
    setWriteError(false);
    try {
      await applyHandoffImport(incoming, decoded.provider.phone);
      await adoptClientModeIfUnset();
      setSaved(next);
    } catch {
      setWriteError(true);
    }
  }

  const errorNote = writeError ? (
    <p className="text-danger text-center text-[11.5px]">
      {t('handoff.import.writeFailed')}
    </p>
  ) : null;

  // A stale link never touches the store and offers no save or calendar
  // action — the card shows the STORED appointment, the client's real,
  // current one, not the outdated payload.
  if (outcome.kind === 'stale') {
    return (
      <CalmScreen
        title={t('handoff.import.stale.title')}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      >
        <p className="text-muted text-center text-[11.5px]">
          {t('handoff.import.stale.current')}
        </p>
        <Card appt={outcome.stored} />
      </CalmScreen>
    );
  }

  if (outcome.kind === 'upToDate') {
    return (
      <CalmScreen
        title={t('handoff.import.upToDate.title')}
        onDone={goHome}
        doneLabel={t('handoff.import.done')}
      >
        <Card appt={incoming} />
      </CalmScreen>
    );
  }

  // new / changed / cancelled all render a card + ONE combined primary
  // action (P0): the calendar handoff and the store write share the button,
  // so the label leads with the calendar verb for the outcome.
  const { title, action, next } =
    outcome.kind === 'new'
      ? {
          title: t('handoff.import.new.title'),
          action: t('handoff.calendar.add'),
          next: 'added' as const,
        }
      : outcome.kind === 'changed'
        ? {
            title: t('handoff.import.changed.title'),
            action: t('handoff.calendar.update'),
            next: 'updated' as const,
          }
        : {
            title: t('handoff.import.cancelled.title'),
            action: t('handoff.calendar.remove'),
            next: 'removed' as const,
          };

  return (
    <main className="grid min-h-[60vh] place-items-center px-[15px] py-6">
      <div className="flex w-full max-w-[360px] flex-col gap-3.5 text-center">
        <h1 className="font-display text-[19px] font-[680] tracking-[-0.01em]">
          {title}
        </h1>
        <Card appt={incoming} />
        {outcome.kind === 'changed' && (
          <ChangedNote incoming={incoming} stored={outcome.stored} />
        )}
        {errorNote}
        <CalendarAction
          label={action}
          appointment={decoded.appointment}
          provider={decoded.provider}
          onActivate={() => void write(next)}
        />
      </div>
    </main>
  );
}

// For a "changed" import, show the prior value of each field that moved.
function ChangedNote({
  incoming,
  stored,
}: {
  incoming: ReceivedAppointment;
  stored: ReceivedAppointment;
}) {
  const lines: string[] = [];
  if (
    incoming.start.dateTime !== stored.start.dateTime ||
    incoming.start.timeZone !== stored.start.timeZone
  ) {
    lines.push(
      t('handoff.import.previously', {
        value: `${formatDayLabel(stored.start.dateTime.slice(0, 10), getActiveLanguage())} · ${stored.start.dateTime.slice(11, 16)}`,
      }),
    );
  }
  if (incoming.service !== stored.service) {
    lines.push(t('handoff.import.previously', { value: stored.service }));
  }
  if (incoming.durationMinutes !== stored.durationMinutes) {
    lines.push(
      t('handoff.import.previously', {
        value: `${stored.durationMinutes} ${t('booking.form.duration.suffix')}`,
      }),
    );
  }
  if (lines.length === 0) return null;
  return (
    <p className="text-muted text-center text-[11.5px]">{lines.join(' · ')}</p>
  );
}
