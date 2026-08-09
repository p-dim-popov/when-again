import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { getActiveLanguage, t, type TranslationKeys } from '../i18n';
import { wallClockNow } from '../time';
import {
  computeDayLayout,
  generateSlots,
  type DayLayoutItem,
  type FreeGap,
} from './slots';
import { addDays, parseDateKey, todayKey, weekOf } from './dateParam';
import {
  useAllClients,
  useDayAppointments,
  useProviderSettings,
} from './queries';
import { DAY_START, DAY_END } from './dayWindow';
import { TimePicker } from './TimePicker';

// Fallback slot step when there is no remembered service duration yet.
const DEFAULT_STEP_MINUTES = 30;

const WEEKDAY_SHORT_KEYS: (keyof TranslationKeys & string)[] = [
  'schedule.weekday.mon.short',
  'schedule.weekday.tue.short',
  'schedule.weekday.wed.short',
  'schedule.weekday.thu.short',
  'schedule.weekday.fri.short',
  'schedule.weekday.sat.short',
  'schedule.weekday.sun.short',
];

const WEEKDAY_LONG_KEYS: (keyof TranslationKeys & string)[] = [
  'schedule.weekday.mon.long',
  'schedule.weekday.tue.long',
  'schedule.weekday.wed.long',
  'schedule.weekday.thu.long',
  'schedule.weekday.fri.long',
  'schedule.weekday.sat.long',
  'schedule.weekday.sun.long',
];

function relativeDayLabel(dateKey: string, todayDateKey: string): string {
  if (dateKey === todayDateKey) return t('schedule.today');
  const a = parseDateKey(todayDateKey);
  const b = parseDateKey(dateKey);
  if (!a || !b) return '';
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (new Date(b.y, b.m - 1, b.d).getTime() -
      new Date(a.y, a.m - 1, a.d).getTime()) /
      msPerDay,
  );
  if (diffDays === 1) return t('schedule.relative.tomorrow');
  if (diffDays === -1) return t('schedule.relative.yesterday');
  if (diffDays > 1) return t('schedule.relative.inDays', { count: diffDays });
  return t('schedule.relative.daysAgo', { count: -diffDays });
}

function monthShortLabel(dateKey: string): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return '';
  const date = new Date(parsed.y, parsed.m - 1, parsed.d);
  return new Intl.DateTimeFormat(getActiveLanguage(), {
    month: 'short',
  }).format(date);
}

// The "still more" affordance (beyond generateSlots' MAX_SLOTS cap) has no
// defined behaviour yet — leave it a no-op stub for now.
function handleMoreTapStub() {
  // Unspecified; not part of this task.
}

function AppointmentBlock({
  appt,
  clientName,
  onTap,
}: {
  appt: DayLayoutItem & { kind: 'appt' };
  clientName: string;
  onTap: (id: string) => void;
}) {
  const start = appt.appt.start.dateTime.slice(11);
  const startMin = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMin = startMin + appt.appt.durationMinutes;
  const end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(
    endMin % 60,
  ).padStart(2, '0')}`;
  const cancelled = appt.appt.status === 'cancelled';

  return (
    <div
      data-testid={cancelled ? 'appt-cancelled' : undefined}
      className="grid grid-cols-[44px_1fr] items-start gap-2.5 py-2.5 pr-[15px] pl-3"
    >
      <div className="pt-px text-[13.5px] font-bold tabular-nums">
        {start}
        <span className="text-faint mt-px block text-[10.5px] font-medium">
          {end}
        </span>
      </div>
      <button
        type="button"
        data-testid="appt-block"
        className={`rounded-card border-line bg-surface shadow-card w-full cursor-pointer border px-[11px] py-2 text-left ${
          cancelled ? 'text-muted' : 'border-l-gold border-l-[3px]'
        }`}
        onClick={() => onTap(appt.appt.id)}
      >
        <div
          className={`text-[14px] font-semibold ${cancelled ? 'text-muted' : 'text-ink'}`}
        >
          {clientName}
          {cancelled && (
            <span className="text-muted font-medium">
              {' '}
              · {t('schedule.cancelled')}
            </span>
          )}
        </div>
        <div className="text-muted mt-0.5 text-xs">
          {appt.appt.service} ·{' '}
          {t('schedule.minutesShort', { count: appt.appt.durationMinutes })}
        </div>
      </button>
    </div>
  );
}

function GapRow({
  item,
  stepMinutes,
  onSlotTap,
  onOtherTime,
}: {
  item: DayLayoutItem & { kind: 'gap' };
  stepMinutes: number;
  onSlotTap: (time: string) => void;
  onOtherTime: (gap: FreeGap) => void;
}) {
  const slots = generateSlots(item.gap, {
    stepMinutes,
    serviceMinutes: stepMinutes,
    dayEnd: DAY_END,
  });
  // generateSlots caps its result at 8 candidates; treat a full cap as a
  // signal there may be more, and offer a "more…" affordance (a stub, same
  // as the slot chips, until later booking-funnel wiring).
  const mayHaveMore = slots.length >= 8;

  return (
    <div className="grid grid-cols-[44px_1fr] items-start gap-2.5 py-1.5 pr-[15px] pl-3">
      <div className="text-faint pt-1.5 text-[10px] tracking-[0.06em] uppercase">
        {t('schedule.free')}
      </div>
      <div className="flex flex-wrap gap-1.5 py-0.5">
        {slots.map((time) => (
          <button
            key={time}
            type="button"
            data-testid="free-slot"
            className="rounded-chip border-line bg-surface-2 text-accent-ink before:text-accent inline-flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 text-[12.5px] tabular-nums before:font-bold before:content-['+']"
            onClick={() => onSlotTap(time)}
          >
            {time}
          </button>
        ))}
        {mayHaveMore && (
          <button
            type="button"
            className="rounded-chip border-line bg-surface-2 text-accent-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 border px-3 text-[12.5px] tabular-nums"
            onClick={handleMoreTapStub}
          >
            {t('schedule.more')}
          </button>
        )}
        <button
          type="button"
          className="rounded-chip border-line bg-surface-2 text-muted inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-dashed px-3 text-[12.5px] tabular-nums"
          onClick={() => onOtherTime(item.gap)}
        >
          <span aria-hidden="true">◷</span> {t('schedule.otherTime')}
        </button>
      </div>
    </div>
  );
}

export function ScheduleScreen({
  dateKey: dateKeyProp,
  appt,
}: {
  dateKey: string;
  // Present only during a reschedule detour: the id of the appointment being
  // edited, forwarded from the form's "Промени". `schedule` only reads and
  // re-emits this string on navigation — it never imports `booking`, so the
  // module graph stays acyclic.
  appt?: string;
}) {
  const navigate = useNavigate();
  const dateKey = parseDateKey(dateKeyProp)
    ? dateKeyProp
    : todayKey(new Date());
  const todayDateKey = wallClockNow().dateTime.slice(0, 10);

  // The gap currently open in the "друг час" bottom sheet (over the day
  // view), or null when the sheet is closed. Only one gap can be open at a
  // time, so a single piece of state is enough.
  const [otherTimeGap, setOtherTimeGap] = useState<FreeGap | null>(null);

  const { data: appointments, isPending } = useDayAppointments(dateKey);
  const { data: clients } = useAllClients();
  const { data: settings } = useProviderSettings();

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients ?? []) map.set(client.id, client.name);
    return map;
  }, [clients]);

  // The most recently used service is the first entry (Task 5's
  // `rememberService` moves the used entry to the front); fall back to 30
  // minutes when nothing has been used yet.
  const stepMinutes =
    settings?.services[0]?.durationMinutes ?? DEFAULT_STEP_MINUTES;

  const week = weekOf(dateKey);
  const weekdayIdx = week.indexOf(dateKey);

  // The same weekday/date/relative-day text the appbar button shows
  // visually — folded into its accessible name below so screen-reader users
  // hear the date, not just "Choose month" (which would otherwise shadow the
  // visible text entirely).
  const weekdayLabel = weekdayIdx >= 0 ? t(WEEKDAY_LONG_KEYS[weekdayIdx]) : '';
  const visibleDateText = [
    `${weekdayLabel}, ${dateKey.slice(8, 10)} ${monthShortLabel(dateKey)}`,
    relativeDayLabel(dateKey, todayDateKey),
  ]
    .filter(Boolean)
    .join('. ');

  const layout = useMemo(
    () =>
      computeDayLayout(appointments ?? [], {
        dayStart: DAY_START,
        dayEnd: DAY_END,
      }),
    [appointments],
  );

  // Day navigation (‹ ›, week strip) preserves `appt` so a provider can
  // reschedule to a different day: the edit identity survives the day change.
  function goTo(newDateKey: string) {
    void navigate({
      to: '/',
      search: { date: newDateKey, ...(appt ? { appt } : {}) },
    });
  }

  // Both doors to picking a time — a quick-slot chip and the "друг час"
  // sheet — land on the same route with the same search-param shape.
  // `schedule` navigates by route string only; it never imports `booking`,
  // so the module graph stays acyclic. `appt`, when present, is forwarded so
  // the pick returns to the form as an edit (reschedule) rather than a new
  // booking.
  function goToForm(time: string) {
    setOtherTimeGap(null);
    void navigate({
      to: '/appointment/new',
      search: { date: dateKey, time, ...(appt ? { appt } : {}) },
    });
  }

  // Tapping an existing appointment opens the shared form in edit mode; the id
  // travels in the URL (no `booking` import).
  function openAppointment(id: string) {
    void navigate({ to: '/appointment/new', search: { appt: id } });
  }

  // The appbar's date/month heading opens the month picker (Task 7b) so the
  // provider can jump to a far month without abandoning the current flow.
  // `date` seeds the picker's shown month; `appt`, when present (a
  // reschedule detour), is forwarded so the round trip stays an edit. This
  // is a plain route string — `schedule` never imports `booking`.
  function openMonthPicker() {
    void navigate({
      to: '/book',
      search: { date: dateKey, ...(appt ? { appt } : {}) },
    });
  }

  return (
    <div className="flex flex-col pb-2">
      <div
        data-testid="day-appbar"
        className="flex items-center gap-2.5 px-[13px] py-2.5"
      >
        <button
          type="button"
          className="rounded-sm2 border-line bg-surface text-muted inline-flex size-11 flex-none cursor-pointer items-center justify-center border text-lg"
          aria-label={t('schedule.nav.prevDay')}
          onClick={() => goTo(addDays(dateKey, -1))}
        >
          ‹
        </button>
        <button
          type="button"
          className="rounded-sm2 border-line bg-surface flex min-h-11 flex-1 cursor-pointer flex-col justify-center border px-3 py-1 text-center"
          aria-label={`${visibleDateText}. ${t('schedule.chooseMonth')}`}
          onClick={openMonthPicker}
        >
          <div className="font-serif text-[15px] font-semibold tracking-[-0.01em]">
            {weekdayIdx >= 0 ? t(WEEKDAY_LONG_KEYS[weekdayIdx]) : ''},{' '}
            {dateKey.slice(8, 10)} {monthShortLabel(dateKey)}
            <span
              className="text-faint ml-[3px] inline-block text-[10px]"
              aria-hidden="true"
            >
              ▾
            </span>
          </div>
          <div className="text-faint text-[11px] tracking-[0.04em]">
            {relativeDayLabel(dateKey, todayDateKey)}
          </div>
        </button>
        <button
          type="button"
          className="rounded-sm2 border-line bg-surface text-muted inline-flex size-11 flex-none cursor-pointer items-center justify-center border text-lg"
          aria-label={t('schedule.nav.nextDay')}
          onClick={() => goTo(addDays(dateKey, 1))}
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pb-2.5">
        {week.map((key, i) => {
          const active = key === dateKey;
          return (
            <button
              key={key}
              type="button"
              className={`rounded-sm2 cursor-pointer py-1.5 text-center text-xs tabular-nums ${
                active ? 'bg-accent text-on-accent' : 'text-muted'
              }`}
              onClick={() => goTo(key)}
            >
              <div
                className={`text-[9px] tracking-[0.05em] uppercase ${
                  active ? 'text-on-accent/70' : 'text-faint'
                }`}
              >
                {t(WEEKDAY_SHORT_KEYS[i])}
              </div>
              {key.slice(8, 10)}
            </button>
          );
        })}
      </div>

      {isPending ? (
        <div className="text-muted px-[15px] py-6 text-center text-[13px]">
          {t('schedule.loading')}
        </div>
      ) : (
        <div className="border-line border-t pt-1.5 pb-3">
          {(appointments ?? []).length === 0 && (
            <p className="text-muted px-[15px] py-6 text-center text-[13px]">
              {t('schedule.emptyDay')}
            </p>
          )}
          {layout.items.map((item, i) =>
            item.kind === 'appt' ? (
              <AppointmentBlock
                key={item.appt.id}
                appt={item}
                clientName={
                  clientNameById.get(item.appt.clientId) ?? item.appt.clientId
                }
                onTap={openAppointment}
              />
            ) : (
              <GapRow
                key={`gap-${i}`}
                item={item}
                stepMinutes={stepMinutes}
                onSlotTap={goToForm}
                onOtherTime={setOtherTimeGap}
              />
            ),
          )}
        </div>
      )}

      {otherTimeGap && (
        <>
          <div
            className="fixed inset-0 z-[2] bg-[color-mix(in_srgb,var(--ink)_34%,transparent)]"
            onClick={() => setOtherTimeGap(null)}
          />
          <TimePicker
            gap={otherTimeGap}
            serviceMinutes={stepMinutes}
            dayEnd={DAY_END}
            onPick={goToForm}
          />
        </>
      )}
    </div>
  );
}
