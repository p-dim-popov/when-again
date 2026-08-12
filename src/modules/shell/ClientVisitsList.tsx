import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveLanguage, t } from '../i18n';
import { listReceived, type ReceivedAppointment } from '../received';
import { formatDayLabel } from '../schedule';
import { wallClockNow } from '../time';
import { partitionVisits } from './clientVisits';

function VisitRow({ visit }: { visit: ReceivedAppointment }) {
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
        {visit.providerName} · {when}
        {cancelled ? ` · ${t('shell.clientHome.cancelled')}` : ''}
      </p>
    </li>
  );
}

function VisitGroup({
  titleKey,
  visits,
}: {
  titleKey: 'shell.clientHome.upcoming' | 'shell.clientHome.past';
  visits: ReceivedAppointment[];
}) {
  if (visits.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-faint text-sm font-semibold">{t(titleKey)}</h2>
      <ul className="flex list-none flex-col gap-2 p-0">
        {visits.map((v) => (
          <VisitRow key={v.id} visit={v} />
        ))}
      </ul>
    </section>
  );
}

// v1 client home: chronological received appointments. Sub-project 2
// replaces this with the big-card home & salons.
export function ClientVisitsList() {
  const items = useLiveQuery(() => listReceived(), []);
  if (items === undefined) return null;
  const { upcoming, past } = partitionVisits(items, wallClockNow().dateTime);
  return (
    <main className="flex flex-col gap-4 p-4" data-testid="client-home">
      <h1 className="text-ink font-serif text-xl">
        {t('shell.clientHome.title')}
      </h1>
      {items.length === 0 && (
        <p className="text-faint">{t('shell.clientHome.empty')}</p>
      )}
      <VisitGroup titleKey="shell.clientHome.upcoming" visits={upcoming} />
      <VisitGroup titleKey="shell.clientHome.past" visits={past} />
    </main>
  );
}
