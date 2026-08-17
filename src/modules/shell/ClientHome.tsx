import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveLanguage, t } from '../i18n';
import { listReceived, type ReceivedAppointment } from '../received';
import { listSavedProviders } from '../savedProviders';
import { formatDayLabel } from '../schedule';
import { partitionVisits, selectNextVisit } from './clientVisits';
import { countdownBucket } from './countdown';
import { useTickingNow } from './useTickingNow';

function countdownText(now: string, start: string): string {
  const bucket = countdownBucket(now, start);
  switch (bucket.kind) {
    case 'minutes':
      return t('shell.clientHome.inMinutes', { count: bucket.minutes });
    case 'today':
      return t('shell.clientHome.today', { time: bucket.time });
    case 'tomorrow':
      return t('shell.clientHome.tomorrow', { time: bucket.time });
    case 'days':
      return t('shell.clientHome.inDays', { count: bucket.days });
  }
}

function NextVisitCard({
  visit,
  providerName,
  phone,
  now,
}: {
  visit: ReceivedAppointment;
  providerName: string;
  phone?: string;
  now: string;
}) {
  const day = formatDayLabel(
    visit.start.dateTime.slice(0, 10),
    getActiveLanguage(),
  );
  return (
    <section
      data-testid="next-visit-card"
      className="border-line bg-surface rounded-card flex flex-col gap-1.5 border p-4"
    >
      <p className="text-accent text-sm font-semibold">
        {countdownText(now, visit.start.dateTime)}
      </p>
      <p className="text-ink font-display text-2xl">
        {day} · {visit.start.dateTime.slice(11, 16)}
      </p>
      <p className="text-ink font-[550]">{visit.service}</p>
      <p className="text-faint text-sm">{providerName}</p>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-accent inline-flex min-h-11 items-center text-sm font-semibold no-underline"
        >
          {t('shell.clientHome.call')}: {phone}
        </a>
      )}
    </section>
  );
}

function EmptyCard() {
  return (
    <section
      data-testid="next-visit-empty"
      className="border-line bg-surface rounded-card flex flex-col gap-1.5 border p-4"
    >
      <p className="text-ink font-[550]">
        {t('shell.clientHome.emptyCard.title')}
      </p>
      <p className="text-faint text-sm">
        {t('shell.clientHome.emptyCard.hint')}
      </p>
    </section>
  );
}

function VisitRow({
  visit,
  nameOf,
}: {
  visit: ReceivedAppointment;
  nameOf: (v: ReceivedAppointment) => string;
}) {
  const cancelled = visit.status === 'cancelled';
  const when = `${formatDayLabel(visit.start.dateTime.slice(0, 10), getActiveLanguage())} · ${visit.start.dateTime.slice(11, 16)}`;
  return (
    <li
      className={`border-line bg-surface rounded-card border px-4 py-3 ${cancelled ? 'opacity-60' : ''}`}
      data-testid="client-visit"
    >
      <p className={`text-ink font-[550] ${cancelled ? 'line-through' : ''}`}>
        {visit.service}
      </p>
      <p className="text-faint text-sm">
        {nameOf(visit)} · {when}
        {cancelled ? ` · ${t('shell.clientHome.cancelled')}` : ''}
      </p>
    </li>
  );
}

function VisitGroup({
  titleKey,
  visits,
  nameOf,
}: {
  titleKey: 'shell.clientHome.upcoming' | 'shell.clientHome.past';
  visits: ReceivedAppointment[];
  nameOf: (v: ReceivedAppointment) => string;
}) {
  if (visits.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-faint text-sm font-semibold">{t(titleKey)}</h2>
      <ul role="list" className="flex list-none flex-col gap-2 p-0">
        {visits.map((v) => (
          <VisitRow key={v.id} visit={v} nameOf={nameOf} />
        ))}
      </ul>
    </section>
  );
}

// Big-card client home (#7 sub-project 2): next visit at a glance, then one
// flat chronological stream — remaining upcoming, then past.
export function ClientHome() {
  const now = useTickingNow();
  const items = useLiveQuery(() => listReceived(), []);
  const providers = useLiveQuery(() => listSavedProviders(), []);
  if (items === undefined || providers === undefined) return null;

  const byId = new Map(providers.map((p) => [p.id, p]));
  // Provider identity always displays from the saved record (ADR-0002:
  // attributes heal on import); the row's own snapshot is the fallback.
  const nameOf = (v: ReceivedAppointment) =>
    (v.providerId ? byId.get(v.providerId)?.name : undefined) ?? v.providerName;

  const { upcoming, past } = partitionVisits(items, now);
  const next = selectNextVisit(upcoming);
  const rest = upcoming.filter((v) => v !== next);
  const nextProvider = next?.providerId ? byId.get(next.providerId) : undefined;

  return (
    <main className="flex flex-col gap-4 p-4" data-testid="client-home">
      <h1 className="text-ink font-display text-xl">
        {t('shell.clientHome.title')}
      </h1>
      {next ? (
        <NextVisitCard
          visit={next}
          providerName={nameOf(next)}
          phone={nextProvider?.phone}
          now={now}
        />
      ) : (
        <EmptyCard />
      )}
      <VisitGroup
        titleKey="shell.clientHome.upcoming"
        visits={rest}
        nameOf={nameOf}
      />
      <VisitGroup
        titleKey="shell.clientHome.past"
        visits={past}
        nameOf={nameOf}
      />
    </main>
  );
}
