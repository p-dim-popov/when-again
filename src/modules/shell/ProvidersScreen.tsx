import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getActiveLanguage, t } from '../i18n';
import { listReceived } from '../received';
import {
  deleteSavedProviderWithVisits,
  listSavedProviders,
  type SavedProvider,
} from '../savedProviders';
import { formatDayLabel } from '../schedule';
import { nextVisitByProvider } from './clientVisits';
import { useTickingNow } from './useTickingNow';

function ProviderCard({
  provider,
  nextDate,
  onDelete,
}: {
  provider: SavedProvider;
  nextDate?: string;
  onDelete: () => void;
}) {
  return (
    <li
      className="border-line bg-surface rounded-card flex flex-col gap-1.5 border p-4"
      data-testid="provider-card"
    >
      <h2 className="text-ink font-display m-0 text-lg">{provider.name}</h2>
      {provider.address && (
        <p className="text-faint text-sm">{provider.address}</p>
      )}
      {provider.phone && (
        <a
          href={`tel:${provider.phone}`}
          className="text-accent inline-flex min-h-11 items-center text-sm font-semibold no-underline"
        >
          {t('shell.clientHome.call')}: {provider.phone}
        </a>
      )}
      {nextDate && (
        <p className="text-accent text-sm">
          {t('shell.providers.nextVisit', {
            date: formatDayLabel(nextDate, getActiveLanguage()),
          })}
        </p>
      )}
      <button
        type="button"
        onClick={onDelete}
        data-testid="provider-delete"
        className="text-faint min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 text-sm underline"
      >
        {t('shell.providers.delete')}
      </button>
    </li>
  );
}

// Saved-providers tab (#7 sub-project 2): flat list, no detail route.
// Records auto-upsert on import, so delete (with confirm) is the only
// management verb — it removes the record AND its visits (spec).
export function ProvidersScreen() {
  const now = useTickingNow();
  const providers = useLiveQuery(() => listSavedProviders(), []);
  const items = useLiveQuery(() => listReceived(), []);
  const [confirming, setConfirming] = useState<SavedProvider | null>(null);
  if (providers === undefined || items === undefined) return null;

  const nextBy = nextVisitByProvider(items, now);

  return (
    <main className="flex flex-col gap-4 p-4" data-testid="providers-screen">
      <h1 className="text-ink font-display text-xl">
        {t('shell.providers.title')}
      </h1>
      {providers.length === 0 && (
        <p className="text-faint" data-testid="providers-empty">
          {t('shell.providers.empty')}
        </p>
      )}
      <ul role="list" className="flex list-none flex-col gap-2 p-0">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            nextDate={nextBy.get(provider.id)?.start.dateTime.slice(0, 10)}
            onDelete={() => setConfirming(provider)}
          />
        ))}
      </ul>
      {confirming && (
        <div className="border-line bg-surface rounded-card flex flex-col gap-2 border p-3">
          <p className="text-ink text-sm">
            {t('shell.providers.deleteConfirm', { name: confirming.name })}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              data-testid="provider-delete-confirm"
              onClick={() => {
                void deleteSavedProviderWithVisits(confirming.id).then(() =>
                  setConfirming(null),
                );
              }}
              className="bg-accent text-on-accent rounded-card min-h-11 cursor-pointer border-0 px-4 py-2 text-sm font-[650]"
            >
              {t('shell.providers.deleteAction')}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="border-line bg-surface text-ink rounded-card min-h-11 cursor-pointer border px-4 py-2 text-sm"
            >
              {t('shell.providers.cancel')}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
