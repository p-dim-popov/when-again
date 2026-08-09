import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getActiveLanguage, t } from '../i18n';
import { listClients, type Client } from '../clients';
import { getSettings, updateSettings, type ServicePreset } from '../settings';
import { wallClockNow, type WallClock } from '../time';
import { parseDateKey } from '../schedule';
import { draftStore, patchDraft, useBookingDraft } from './draftStore';
import { useAddClient, useSaveAppointment } from './mutations';
import { rememberService } from './remembered';
import './AppointmentForm.css';

// Same cache entries the schedule screen reads/writes (see
// `schedule/queries.ts`) so a save here is immediately visible there without
// a second round trip through IndexedDB.
const CLIENTS_QUERY_KEY = ['clients', 'all'];
const SETTINGS_QUERY_KEY = ['settings'];

const MAX_CLIENT_SUGGESTIONS = 6;
const MAX_SERVICE_SUGGESTIONS = 6;

function formatWhenDay(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  const date = new Date(parsed.y, parsed.m - 1, parsed.d);
  return new Intl.DateTimeFormat(getActiveLanguage(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
}

interface ServiceFormValues {
  service: string;
  durationMinutes: number | null;
  price: number | null;
}

// The draft-backed "new appointment" form — the funnel's last step. Day/time
// picking happens only on the day view (`schedule/ScheduleScreen.tsx`); this
// component never renders a time picker. It reads `date`/`time` from the
// `/appointment/new` route's search params (passed down by
// `src/app/router.tsx`) and seeds the draft store with them on mount,
// merging over any client/service/duration/price already in the draft from
// an earlier visit — that's what makes the "Промени" (change time) round
// trip back to the day view lossless.
export function AppointmentForm({
  date,
  time,
}: {
  date?: string;
  time?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useBookingDraft();

  // Snapshot the draft once, synchronously, at first render — before the
  // mount effect below overwrites dateKey/time. This is what a "Промени"
  // round trip returns to fill back in: client/service/duration/price
  // survived in the draft while the day view was on screen.
  const [initialDraft] = useState(() => draftStore.state);

  useEffect(() => {
    const patch: { dateKey?: string; time?: string } = {};
    if (date) patch.dateKey = date;
    if (time) patch.time = time;
    if (Object.keys(patch).length > 0) patchDraft(patch);
  }, [date, time]);

  const { data: clients } = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: listClients,
  });
  const { data: settings } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: getSettings,
  });

  const saveAppointment = useSaveAppointment();
  const addClientMutation = useAddClient();

  const [clientQuery, setClientQuery] = useState(initialDraft.clientName ?? '');
  const [clientId, setClientId] = useState<string | null>(
    initialDraft.clientId,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmedClientQuery = clientQuery.trim();
  const clientSuggestions: Client[] = trimmedClientQuery
    ? (clients ?? [])
        .filter((c) =>
          c.name.toLowerCase().includes(trimmedClientQuery.toLowerCase()),
        )
        .slice(0, MAX_CLIENT_SUGGESTIONS)
    : [];
  const hasExactClientMatch = (clients ?? []).some(
    (c) => c.name.toLowerCase() === trimmedClientQuery.toLowerCase(),
  );
  const showCreateClient =
    trimmedClientQuery.length > 0 && !hasExactClientMatch;
  const showClientSuggestions =
    trimmedClientQuery.length > 0 &&
    (clientSuggestions.length > 0 || showCreateClient);

  function selectClient(client: Client) {
    setClientId(client.id);
    setClientQuery(client.name);
    patchDraft({ clientId: client.id, clientName: client.name });
  }

  function handleClientQueryChange(value: string) {
    setClientQuery(value);
    // The previous selection no longer necessarily matches what's typed;
    // require an explicit (re-)pick before saving.
    setClientId(null);
    patchDraft({ clientId: null, clientName: null });
  }

  async function handleCreateClient() {
    const name = trimmedClientQuery;
    if (!name) return;
    const created = await addClientMutation.mutateAsync({ name });
    selectClient(created);
  }

  const form = useForm({
    defaultValues: {
      service: initialDraft.service ?? '',
      durationMinutes: initialDraft.durationMinutes,
      price: initialDraft.price,
    } as ServiceFormValues,
    onSubmit: async ({ value }) => {
      await handleSave(value);
    },
  });

  function applyPreset(preset: ServicePreset) {
    form.setFieldValue('service', preset.name);
    form.setFieldValue('durationMinutes', preset.durationMinutes);
    if (preset.price !== undefined) form.setFieldValue('price', preset.price);
    patchDraft({
      service: preset.name,
      durationMinutes: preset.durationMinutes,
      price: preset.price ?? null,
    });
  }

  function goChangeWhen() {
    void navigate({ to: '/', search: { date: draft.dateKey ?? undefined } });
  }

  async function handleSave(value: ServiceFormValues) {
    const trimmedService = value.service.trim();
    if (
      !clientId ||
      !trimmedService ||
      !draft.dateKey ||
      !draft.time ||
      !value.durationMinutes
    ) {
      setSaveError(t('booking.form.error.required'));
      return;
    }
    setSaveError(null);

    const timeZone = wallClockNow().timeZone;
    const start: WallClock = {
      dateTime: `${draft.dateKey}T${draft.time}`,
      timeZone,
    };

    const appointment = await saveAppointment.mutateAsync({
      clientId,
      service: trimmedService,
      start,
      durationMinutes: value.durationMinutes,
      ...(value.price !== null ? { price: value.price } : {}),
      status: 'booked',
    });

    const currentServices = (settings ?? (await getSettings())).services;
    const nextServices = rememberService(currentServices, {
      name: trimmedService,
      durationMinutes: value.durationMinutes,
      ...(value.price !== null ? { price: value.price } : {}),
    });
    await updateSettings({ services: nextServices });
    void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });

    // Keep the draft — the placeholder/eventual `/appointment/saved` screen
    // (Task 8) reads `appointmentId` to show the just-saved summary.
    patchDraft({ appointmentId: appointment.id });
    void navigate({ to: '/appointment/saved' });
  }

  const remembered = (settings?.services ?? []).slice(
    0,
    MAX_SERVICE_SUGGESTIONS,
  );

  const whenLabel =
    draft.dateKey && draft.time
      ? `${formatWhenDay(draft.dateKey)} · ${draft.time}`
      : '';

  return (
    <div className="apptForm">
      <div className="apptForm-appbar">
        <h1 className="apptForm-title">{t('booking.form.title')}</h1>
      </div>

      <form
        className="apptForm-form"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="apptForm-field">
          <label htmlFor="apptForm-client">{t('booking.form.client')}</label>
          <div className="apptForm-input">
            <span className="apptForm-lead" aria-hidden="true">
              ☺
            </span>
            <input
              id="apptForm-client"
              type="text"
              value={clientQuery}
              placeholder={t('booking.form.client.placeholder')}
              onChange={(e) => handleClientQueryChange(e.target.value)}
              autoComplete="off"
            />
          </div>
          {showClientSuggestions && (
            <div className="apptForm-suggestions">
              {clientSuggestions.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="apptForm-suggestion"
                  onClick={() => selectClient(client)}
                >
                  {client.name}
                </button>
              ))}
              {showCreateClient && (
                <button
                  type="button"
                  className="apptForm-suggestion apptForm-suggestion-create"
                  onClick={() => void handleCreateClient()}
                >
                  {t('booking.form.client.create', {
                    name: trimmedClientQuery,
                  })}
                </button>
              )}
            </div>
          )}
        </div>

        <form.Field name="service">
          {(field) => (
            <div className="apptForm-field">
              <label htmlFor="apptForm-service">
                {t('booking.form.service')}
              </label>
              <div className="apptForm-input">
                <input
                  id="apptForm-service"
                  type="text"
                  value={field.state.value}
                  placeholder={t('booking.form.service.placeholder')}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    patchDraft({ service: e.target.value });
                  }}
                />
              </div>
              {remembered.length > 0 && (
                <div className="apptForm-recent">
                  {remembered.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="apptForm-recentChip"
                      onClick={() => applyPreset(preset)}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form.Field>

        <div className="apptForm-field">
          <label>{t('booking.form.when')}</label>
          <div className="apptForm-input apptForm-whenrow">
            <span>{whenLabel}</span>
            <button
              type="button"
              className="apptForm-edit"
              onClick={goChangeWhen}
            >
              {t('booking.form.change')}
            </button>
          </div>
        </div>

        <div className="apptForm-row2">
          <form.Field name="durationMinutes">
            {(field) => (
              <div className="apptForm-field">
                <label htmlFor="apptForm-duration">
                  {t('booking.form.duration')}
                </label>
                <div className="apptForm-input">
                  <input
                    id="apptForm-duration"
                    type="number"
                    min={0}
                    step={5}
                    value={field.state.value ?? ''}
                    onChange={(e) => {
                      const next =
                        e.target.value === '' ? null : Number(e.target.value);
                      field.handleChange(next);
                      patchDraft({ durationMinutes: next });
                    }}
                  />
                  <span className="apptForm-suffix">
                    {t('booking.form.duration.suffix')}
                  </span>
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="price">
            {(field) => (
              <div className="apptForm-field">
                <label htmlFor="apptForm-price">
                  {t('booking.form.price')}
                </label>
                <div className="apptForm-input">
                  <input
                    id="apptForm-price"
                    type="number"
                    min={0}
                    step={1}
                    placeholder={t('booking.form.price.placeholder')}
                    value={field.state.value ?? ''}
                    onChange={(e) => {
                      const next =
                        e.target.value === '' ? null : Number(e.target.value);
                      field.handleChange(next);
                      patchDraft({ price: next });
                    }}
                  />
                </div>
              </div>
            )}
          </form.Field>
        </div>

        {saveError && <p className="apptForm-error">{saveError}</p>}

        <button
          type="submit"
          className="apptForm-save"
          disabled={saveAppointment.isPending}
        >
          {saveAppointment.isPending
            ? t('booking.form.saving')
            : t('booking.form.save')}
        </button>
      </form>
    </div>
  );
}
