import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getActiveLanguage, t } from '../i18n';
import { getClient, listClients, type Client } from '../clients';
import { getAppointment, type Appointment } from '../appointments';
import { getSettings, updateSettings, type ServicePreset } from '../settings';
import { wallClockNow, type WallClock } from '../time';
import { formatDayLabel } from '../schedule';
import {
  draftStore,
  patchDraft,
  resetDraft,
  useBookingDraft,
} from './draftStore';
import { shouldResetDraft } from './freshStart';
import {
  useAddClient,
  useCancelAppointment,
  useSaveAppointment,
  useUpdateAppointment,
} from './mutations';
import { rememberService } from './remembered';
import { resolveClientId } from './resolveClient';
import { presetPatch } from './servicePreset';

// Shared field-box treatment (Tailwind v4 "Elevated & warm" restyle): the
// WHOLE box is the tap target — ≥44px tall, padding on the wrapper, the
// `<input>` itself only carries `flex-1 min-w-0 bg-transparent outline-none`
// so it fills the box instead of leaving a thin hit-strip (fixes #17-6b).
const FIELD_BOX =
  'flex items-center gap-2 min-h-11 rounded-card border border-line bg-surface px-3 focus-within:border-accent';
const FIELD_INPUT =
  'flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-faint';

// Same cache entries the schedule screen reads/writes (see
// `schedule/queries.ts`) so a save here is immediately visible there without
// a second round trip through IndexedDB.
const CLIENTS_QUERY_KEY = ['clients', 'all'];
const SETTINGS_QUERY_KEY = ['settings'];

const MAX_CLIENT_SUGGESTIONS = 6;
const MAX_SERVICE_SUGGESTIONS = 6;

// A fresh new booking (no preset picked yet, nothing typed) starts Времетраене
// at 30 minutes rather than empty, so manual service entry is one field
// lighter. Only applies to a brand-new booking with no duration already in
// the draft — see `initialDurationMinutes` below.
const DEFAULT_NEW_BOOKING_DURATION_MINUTES = 30;

// Stable ids for the combobox/listbox ARIA wiring below (item 4 of the
// followup-B polish pass): each text input's `aria-controls` points at its
// suggestion list's `id`.
const CLIENT_LISTBOX_ID = 'apptForm-client-listbox';
const SERVICE_LISTBOX_ID = 'apptForm-service-listbox';

interface ServiceFormValues {
  service: string;
  durationMinutes: number | null;
  price: number | null;
}

// The draft-backed appointment form — the funnel's last step, shared by both
// "new" and "edit". Day/time picking happens only on the day view
// (`schedule/ScheduleScreen.tsx`); this component never renders a time picker.
// It reads `date`/`time`/`appt` from the `/appointment/new` route's search
// params (passed down by `src/app/router.tsx`).
//
// `appt` is the id of an appointment being edited (absent ⇒ new booking). It
// travels in the URL so an edit survives the "Промени" → day-view detour and
// never leaks into a fresh booking. On first entry to edit the appointment is
// loaded and its fields seed the draft + form; a round-trip return keeps the
// (possibly user-edited) draft and only re-applies the re-picked date/time.
export function AppointmentForm({
  date,
  time,
  appt,
  resume,
}: {
  date?: string;
  time?: string;
  appt?: string;
  // Present only during a NEW-booking "Промени" round trip (#16): tells this
  // component the current entry continues an in-progress booking rather than
  // starting fresh. See `shouldResetDraft`.
  resume?: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useBookingDraft();

  const editingId = appt ?? null;

  // #16: a truly fresh entry (no appt, no resume) starts from a clean draft,
  // so an abandoned booking's client/service/price cannot leak in. Runs
  // once, synchronously, in a useState initializer — before the
  // `initialDraft` snapshot below — so the cleared draft is what seeds the
  // form. date/time are re-applied from the URL by the mount effect further
  // down.
  useState(() => {
    if (shouldResetDraft({ appt, resume })) resetDraft();
    return null;
  });

  // Snapshot the draft once, synchronously, at first render — before the
  // mount effect below overwrites dateKey/time. This is what a "Промени"
  // round trip returns to fill back in: client/service/duration/price
  // survived in the draft while the day view was on screen. On a round-trip
  // return in edit mode the draft already holds the edited fields (they were
  // patched on first entry and persisted through the detour), so this snapshot
  // seeds the form with them exactly the same way as a new-booking round trip.
  const [initialDraft] = useState(() => draftStore.state);

  // First-entry load for edit mode: the appointment plus its client's name
  // (the form's client field shows the name, but the appointment only carries
  // `clientId`). Cached under `['appointment', id]` — the same key
  // `useUpdateAppointment`/`useCancelAppointment` invalidate. Also the source
  // of truth for the ORIGINAL `status`, which must be preserved on save (a
  // reschedule must not silently flip a 'done'/'cancelled' record to
  // 'booked').
  const { data: editLoad } = useQuery({
    queryKey: ['appointment', editingId],
    queryFn: async (): Promise<{
      appointment: Appointment;
      clientName: string;
    } | null> => {
      const appointment = await getAppointment(editingId as string);
      if (!appointment) return null;
      const client = await getClient(appointment.clientId);
      return { appointment, clientName: client?.name ?? '' };
    },
    enabled: editingId != null,
  });

  // Distinguishes first-entry (draft.appointmentId !== editingId, hydrate from
  // the loaded appointment) from a round-trip return (draft.appointmentId ===
  // editingId, keep the draft). The ref guards against re-hydrating within a
  // single mount once we've seeded the form fields. The hydrate effect itself
  // lives below the `form`/client-state declarations it writes to.
  const hydratedRef = useRef(false);

  // Tracks the `editingId` the hydrate effect last saw. Today `editingId`
  // can't actually change within a single mounted instance of this
  // component — an identity change routes through an unmounting day-view
  // detour — but the effect shouldn't rely on that from the outside. If
  // `editingId` ever did change in place, this resets `hydratedRef` so the
  // effect re-hydrates for the new identity instead of silently keeping the
  // previous appointment's fields.
  const prevEditingIdRef = useRef<string | null>(editingId);

  // Set right before save/cancel patches `appointmentId` and navigates away
  // (see `handleSave`/`handleCancel`). Guards the mount effect below: without
  // it, patching a NEW booking's `appointmentId` to the just-saved id
  // re-triggers that effect (the draft store notifies subscribers
  // synchronously, and this component is still mounted until the route
  // transition commits) — its "no editingId → clear appointmentId" branch
  // would then read the fresh id as "stale" and immediately null it back out
  // from under the landing screen.
  const leavingRef = useRef(false);

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
  const updateAppointmentMutation = useUpdateAppointment();
  const cancelAppointmentMutation = useCancelAppointment();
  const addClientMutation = useAddClient();

  const [clientQuery, setClientQuery] = useState(initialDraft.clientName ?? '');
  const [clientId, setClientId] = useState<string | null>(
    initialDraft.clientId,
  );
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
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
  // A selected client whose name still matches the query verbatim (the
  // normal post-pick state) must not reopen the list — it would only ever
  // self-match. `suggestionsDismissed` additionally covers Escape/blur.
  const selectedName =
    clientId != null
      ? ((clients ?? []).find((c) => c.id === clientId)?.name ?? '')
      : '';
  const querySelectsClient =
    clientId != null &&
    selectedName.toLowerCase() === trimmedClientQuery.toLowerCase();
  const showClientSuggestions =
    trimmedClientQuery.length > 0 &&
    !suggestionsDismissed &&
    !querySelectsClient &&
    clientSuggestions.length > 0;

  function selectClient(client: Client) {
    setClientId(client.id);
    setClientQuery(client.name);
    patchDraft({ clientId: client.id, clientName: client.name });
  }

  function handleClientQueryChange(value: string) {
    setClientQuery(value);
    setSuggestionsDismissed(false);
    // The previous selection no longer necessarily matches what's typed;
    // require an explicit (re-)pick before saving. `clientName` still tracks
    // the raw typed text (not just a picked client's name) so a "Промени"
    // round trip (#16) restores an unpicked, freshly-typed name — matching
    // how the service field's `onChange` patches its raw value.
    setClientId(null);
    patchDraft({ clientId: null, clientName: value || null });
  }

  // Default Времетраене to 30 minutes, but only for a brand-new booking that
  // has no duration in the draft yet (`editingId == null` — an edit's real
  // duration loads via the hydrate effect below and must win; a round trip
  // that already patched a duration into the draft, explicitly chosen or via
  // a preset, must also win).
  const initialDurationMinutes =
    editingId == null && initialDraft.durationMinutes == null
      ? DEFAULT_NEW_BOOKING_DURATION_MINUTES
      : initialDraft.durationMinutes;

  const form = useForm({
    defaultValues: {
      service: initialDraft.service ?? '',
      durationMinutes: initialDurationMinutes,
      price: initialDraft.price,
    } as ServiceFormValues,
    onSubmit: async ({ value }) => {
      await handleSave(value);
    },
  });

  // Edit-mode mount logic (placed here so it can seed `form`/client state):
  //  - no editingId → clear a stale appointmentId, keep other fields (handled
  //    by the effect above? no — done here to keep all three branches in one
  //    place).
  //  - editingId set, draft.appointmentId !== editingId → FIRST entry: hydrate
  //    from the loaded appointment (fields + client name + its own date/time).
  //  - editingId set, draft.appointmentId === editingId → round-trip return:
  //    keep the draft; the date/time effect above re-applies the re-picked
  //    slot. So a reschedule is just an edit whose Кога changed.
  useEffect(() => {
    // Defensive: if `editingId` ever changed in place (it can't today — see
    // `prevEditingIdRef`'s comment), a stale `hydratedRef` would otherwise
    // suppress hydration for the new identity. Reset it so the branches below
    // treat this as a fresh first-entry hydrate. Fires (at most) once per
    // identity change, and the `draft.appointmentId === editingId`
    // round-trip check further down still governs whether an in-progress
    // edit's fields get clobbered.
    if (prevEditingIdRef.current !== editingId) {
      hydratedRef.current = false;
      prevEditingIdRef.current = editingId;
    }
    if (leavingRef.current) return; // save/cancel already claimed this draft
    if (editingId == null) {
      // New booking: clear any stale `appointmentId` left over from a previous
      // edit so this booking can't be mistaken for an edit. Other fields are
      // intentionally kept (new-booking Промени round-trip preservation, per
      // the plan); a fresh booking's reset happens elsewhere (month picker /
      // landing's Готово).
      if (draft.appointmentId !== null) patchDraft({ appointmentId: null });
      return;
    }
    if (draft.appointmentId === editingId) return; // round-trip return
    if (hydratedRef.current) return;
    if (!editLoad) return; // wait for the load
    hydratedRef.current = true;

    const a = editLoad.appointment;
    const dateKey = a.start.dateTime.slice(0, 10);
    const timeOfDay = a.start.dateTime.slice(11, 16);
    patchDraft({
      appointmentId: a.id,
      clientId: a.clientId,
      clientName: editLoad.clientName,
      service: a.service,
      durationMinutes: a.durationMinutes,
      price: a.price ?? null,
      dateKey,
      time: timeOfDay,
    });
    // The `initialDraft` snapshot didn't hold the appointment (it loads
    // async), so push the loaded values into the form fields + client input
    // state directly. This one-time seed of local state from async query data
    // is exactly the "reset state when identity changes" pattern; the
    // `hydratedRef`/`draft.appointmentId` guards make it fire once per edit.
    form.setFieldValue('service', a.service);
    form.setFieldValue('durationMinutes', a.durationMinutes);
    form.setFieldValue('price', a.price ?? null);
    /* eslint-disable react-hooks/set-state-in-effect */
    setClientId(a.clientId);
    setClientQuery(editLoad.clientName);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, draft.appointmentId, editLoad]);

  function applyPreset(preset: ServicePreset) {
    // Both the form fields and the draft derive from the same patch object
    // (see `servicePreset.ts`) so they can never disagree on `price` —
    // notably, switching from a priced preset to an unpriced one always
    // clears it on both sides instead of leaving a stale value on one.
    const patch = presetPatch(preset);
    form.setFieldValue('service', patch.service);
    form.setFieldValue('durationMinutes', patch.durationMinutes);
    form.setFieldValue('price', patch.price);
    patchDraft(patch);
  }

  // "Промени" returns to the day view to re-pick a time. In edit mode it
  // forwards `appt` so the day view hands it back on the next slot tap and the
  // round trip stays an edit (rather than starting a new booking). In NEW
  // booking mode it forwards `resume` (#16) instead, so the round trip is
  // recognised as continuing THIS booking rather than a fresh entry — without
  // it, the next slot tap would look identical to a fresh browse-in and wipe
  // the draft out from under the provider.
  function goChangeWhen() {
    void navigate({
      to: '/',
      search: {
        date: draft.dateKey ?? undefined,
        ...(editingId ? { appt: editingId } : { resume: true }),
      },
    });
  }

  async function handleSave(value: ServiceFormValues) {
    const trimmedService = value.service.trim();
    if (
      !trimmedClientQuery ||
      !trimmedService ||
      !draft.dateKey ||
      !draft.time ||
      !value.durationMinutes
    ) {
      setSaveError(t('booking.form.error.required'));
      return;
    }
    setSaveError(null);

    const resolvedClientId = await resolveClientId({
      clientId,
      name: trimmedClientQuery,
      clients: clients ?? [],
      createClient: (name) => addClientMutation.mutateAsync({ name }),
    });
    if (!resolvedClientId) {
      setSaveError(t('booking.form.error.required'));
      return;
    }

    const timeZone = wallClockNow().timeZone;
    const start: WallClock = {
      dateTime: `${draft.dateKey}T${draft.time}`,
      timeZone,
    };

    let savedId: string;
    if (draft.appointmentId) {
      // Edit / reschedule. Preserve the ORIGINAL status (read from the loaded
      // appointment, not hardcoded 'booked') so editing a 'done'/'cancelled'
      // record — or rescheduling one — keeps its state. `editLoad` is served
      // from the `['appointment', id]` cache in edit mode, so its status is
      // available synchronously; fall back to 'booked' only if it is somehow
      // absent (should not happen once appointmentId is set).
      const status = editLoad?.appointment?.status ?? 'booked';
      const updated: Appointment = {
        id: draft.appointmentId,
        clientId: resolvedClientId,
        service: trimmedService,
        start,
        durationMinutes: value.durationMinutes,
        ...(value.price !== null ? { price: value.price } : {}),
        status,
      };
      await updateAppointmentMutation.mutateAsync(updated);
      savedId = updated.id;
    } else {
      const appointment = await saveAppointment.mutateAsync({
        clientId: resolvedClientId,
        service: trimmedService,
        start,
        durationMinutes: value.durationMinutes,
        ...(value.price !== null ? { price: value.price } : {}),
        status: 'booked',
      });
      savedId = appointment.id;
    }

    // Best-effort: the appointment is already saved at this point, so a
    // failure remembering the service (IndexedDB quota, txn conflict, etc.)
    // must not strand the user on the form — that would both hide the
    // successful save and risk a duplicate booking if they tap Save again.
    try {
      const currentServices = (settings ?? (await getSettings())).services;
      const nextServices = rememberService(currentServices, {
        name: trimmedService,
        durationMinutes: value.durationMinutes,
        ...(value.price !== null ? { price: value.price } : {}),
      });
      await updateSettings({ services: nextServices });
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    } catch {
      // best-effort: a failed remember-service write must not block
      // navigation to the saved landing — the appointment itself is safe.
    }

    // Keep the draft — the `/appointment/saved` `ShareLanding` (Task 8) reads
    // `appointmentId` to show the just-saved summary. `leavingRef` stops the
    // mount effect above from clearing it back out on the re-render this
    // patch triggers (see the ref's comment).
    leavingRef.current = true;
    patchDraft({ appointmentId: savedId });
    void navigate({ to: '/appointment/saved' });
  }

  // Cancel (edit mode only): flip the loaded appointment's status to
  // 'cancelled' via the update path (the record stays, de-emphasised, on the
  // day view). The draft's appointmentId is kept so the saved landing can show
  // which appointment it was.
  async function handleCancel() {
    if (!editLoad?.appointment) return;
    setSaveError(null);
    await cancelAppointmentMutation.mutateAsync(editLoad.appointment);
    leavingRef.current = true;
    patchDraft({ appointmentId: editLoad.appointment.id });
    void navigate({ to: '/appointment/saved' });
  }

  const isEditing = draft.appointmentId != null;
  const isSaving =
    saveAppointment.isPending || updateAppointmentMutation.isPending;

  const remembered = (settings?.services ?? []).slice(
    0,
    MAX_SERVICE_SUGGESTIONS,
  );

  const whenLabel =
    draft.dateKey && draft.time
      ? `${formatDayLabel(draft.dateKey, getActiveLanguage())} · ${draft.time}`
      : '';

  return (
    <div className="flex flex-col">
      <div className="px-[15px] pt-1 pb-2.5 text-center">
        <h1 className="font-serif text-[15px] font-[680] tracking-[-0.01em]">
          {t(isEditing ? 'booking.form.editTitle' : 'booking.form.title')}
        </h1>
      </div>

      <form
        className="flex flex-col gap-[13px] px-[15px] pt-1.5 pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div
          className="relative"
          onBlur={(e) => {
            // Dismiss only when focus leaves the whole combobox widget
            // (input + listbox), not when it moves onto a suggestion option
            // (keyboard Tab) — the options have no arrow-key navigation, so
            // Tab is the only keyboard path onto them, and it must not be
            // eaten by the blur that fires as focus leaves the input.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setSuggestionsDismissed(true);
            }
          }}
        >
          <label
            htmlFor="apptForm-client"
            className="text-faint mb-[5px] block text-[10.5px] tracking-[0.05em] uppercase"
          >
            {t('booking.form.client')}
          </label>
          <div className={FIELD_BOX}>
            <span
              className="text-faint flex-none text-[15px]"
              aria-hidden="true"
            >
              ☺
            </span>
            <input
              id="apptForm-client"
              type="text"
              role="combobox"
              aria-expanded={showClientSuggestions}
              aria-controls={CLIENT_LISTBOX_ID}
              value={clientQuery}
              placeholder={t('booking.form.client.placeholder')}
              onChange={(e) => handleClientQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSuggestionsDismissed(true);
              }}
              autoComplete="off"
              className={FIELD_INPUT}
            />
          </div>
          {showClientSuggestions && (
            <div
              className="rounded-card border-line bg-surface shadow-card absolute top-[calc(100%+4px)] right-0 left-0 z-1 flex flex-col gap-0.5 border p-1.5"
              role="listbox"
              id={CLIENT_LISTBOX_ID}
            >
              {clientSuggestions.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="rounded-sm2 text-ink hover:bg-surface-2 cursor-pointer border-0 bg-transparent px-[9px] py-2 text-left text-[13.5px]"
                  role="option"
                  aria-selected={client.id === clientId}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectClient(client)}
                >
                  {client.name}
                </button>
              ))}
            </div>
          )}
          {trimmedClientQuery.length > 0 &&
            !hasExactClientMatch &&
            clientId == null && (
              <p className="text-faint mt-[5px] text-[11.5px]">
                {t('booking.form.client.willCreate')}
              </p>
            )}
        </div>

        <form.Field name="service">
          {(field) => (
            <div className="relative">
              <label
                htmlFor="apptForm-service"
                className="text-faint mb-[5px] block text-[10.5px] tracking-[0.05em] uppercase"
              >
                {t('booking.form.service')}
              </label>
              <div className={FIELD_BOX}>
                <input
                  id="apptForm-service"
                  type="text"
                  role="combobox"
                  aria-expanded={remembered.length > 0}
                  aria-controls={SERVICE_LISTBOX_ID}
                  value={field.state.value}
                  placeholder={t('booking.form.service.placeholder')}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    patchDraft({ service: e.target.value });
                  }}
                  className={FIELD_INPUT}
                />
              </div>
              {remembered.length > 0 && (
                <div
                  className="mt-[7px] flex flex-wrap gap-1.5"
                  role="listbox"
                  id={SERVICE_LISTBOX_ID}
                >
                  {remembered.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="border-line bg-surface text-muted cursor-pointer rounded-full border px-2.5 py-[5px] text-xs"
                      role="option"
                      aria-selected={preset.name === field.state.value}
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

        <div>
          <label className="text-faint mb-[5px] block text-[10.5px] tracking-[0.05em] uppercase">
            {t('booking.form.when')}
          </label>
          <div
            className={`${FIELD_BOX} bg-accent-soft border-accent-line text-accent-ink justify-between font-semibold tabular-nums`}
          >
            <span className="text-sm">{whenLabel}</span>
            <button
              type="button"
              className="text-accent cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold tracking-[0.04em] uppercase"
              onClick={goChangeWhen}
            >
              {t('booking.form.change')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <form.Field name="durationMinutes">
            {(field) => (
              <div className="min-w-0">
                <label
                  htmlFor="apptForm-duration"
                  className="text-faint mb-[5px] block text-[10.5px] tracking-[0.05em] uppercase"
                >
                  {t('booking.form.duration')}
                </label>
                <div className={`${FIELD_BOX} min-w-0`}>
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
                    className={FIELD_INPUT}
                  />
                  <span className="text-faint flex-none text-[12.5px]">
                    {t('booking.form.duration.suffix')}
                  </span>
                </div>
              </div>
            )}
          </form.Field>

          <form.Field name="price">
            {(field) => (
              <div className="min-w-0">
                <label
                  htmlFor="apptForm-price"
                  className="text-faint mb-[5px] block text-[10.5px] tracking-[0.05em] uppercase"
                >
                  {t('booking.form.price')}
                </label>
                <div className={`${FIELD_BOX} min-w-0`}>
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
                    className={FIELD_INPUT}
                  />
                </div>
              </div>
            )}
          </form.Field>
        </div>

        {saveError && (
          <p className="text-danger m-0 text-[12.5px]">{saveError}</p>
        )}

        <button
          type="submit"
          className="rounded-card bg-accent text-on-accent shadow-fab flex min-h-12 w-full cursor-pointer items-center justify-center border-0 text-center text-[15px] font-semibold disabled:cursor-default disabled:opacity-60"
          disabled={isSaving}
        >
          {isSaving ? t('booking.form.saving') : t('booking.form.save')}
        </button>

        {isEditing && (
          <button
            type="button"
            className="rounded-card border-danger-line text-danger min-h-11 cursor-pointer border bg-transparent py-[11px] text-center text-sm font-semibold disabled:cursor-default disabled:opacity-60"
            onClick={() => void handleCancel()}
            disabled={cancelAppointmentMutation.isPending}
          >
            {t('booking.form.cancel')}
          </button>
        )}
      </form>
    </div>
  );
}
