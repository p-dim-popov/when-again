import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { getActiveLanguage, t, type TranslationKeys } from '../i18n';
import { wallClockNow } from '../time';
import { computeDayLayout, generateSlots, type DayLayoutItem } from './slots';
import { addDays, parseDateKey, todayKey, weekOf } from './dateParam';
import {
  useAllClients,
  useDayAppointments,
  useProviderSettings,
} from './queries';
import './ScheduleScreen.css';

// The bookable day window for slot-chip generation only ("другa час" is not
// bound by it beyond the free gap itself). There is no working-hours setting
// yet — a later Settings epic may make this configurable.
const DAY_START = '08:00';
const DAY_END = '20:00';

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

// Slot chips and the "друг час" chip are visual-only stubs in this task: Task
// 6 wires a slot tap to the booking draft + navigation to the new-appointment
// form. Keep them as no-op buttons for now so nothing crashes or links to a
// route that doesn't exist yet.
function handleSlotTapStub() {
  // Wired in Task 6.
}

// Tapping an appointment opens the edit form in Task 7; a no-op stub here.
function handleAppointmentTapStub() {
  // Wired in Task 7.
}

function AppointmentBlock({
  appt,
  clientName,
}: {
  appt: DayLayoutItem & { kind: 'appt' };
  clientName: string;
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
      className={`schedule-appt${cancelled ? ' schedule-appt-cancelled' : ''}`}
    >
      <div className="schedule-appt-t">
        {start}
        <span className="schedule-appt-end">{end}</span>
      </div>
      <button
        type="button"
        className="schedule-appt-block"
        onClick={handleAppointmentTapStub}
      >
        <div className="schedule-appt-who">
          {clientName}
          {cancelled && (
            <span className="schedule-appt-cancelledTag">
              {' '}
              · {t('schedule.cancelled')}
            </span>
          )}
        </div>
        <div className="schedule-appt-svc">
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
}: {
  item: DayLayoutItem & { kind: 'gap' };
  stepMinutes: number;
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
    <div className="schedule-gap">
      <div className="schedule-gap-label">{t('schedule.free')}</div>
      <div className="schedule-slots">
        {slots.map((time) => (
          <button
            key={time}
            type="button"
            className="schedule-slot"
            onClick={handleSlotTapStub}
          >
            {time}
          </button>
        ))}
        {mayHaveMore && (
          <button
            type="button"
            className="schedule-slot schedule-slot-more"
            onClick={handleSlotTapStub}
          >
            {t('schedule.more')}
          </button>
        )}
        <button
          type="button"
          className="schedule-slot schedule-slot-other"
          onClick={handleSlotTapStub}
        >
          <span aria-hidden="true">◷</span> {t('schedule.otherTime')}
        </button>
      </div>
    </div>
  );
}

export function ScheduleScreen({ dateKey: dateKeyProp }: { dateKey: string }) {
  const navigate = useNavigate();
  const dateKey = parseDateKey(dateKeyProp)
    ? dateKeyProp
    : todayKey(new Date());
  const todayDateKey = wallClockNow().dateTime.slice(0, 10);

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

  const layout = useMemo(
    () =>
      computeDayLayout(appointments ?? [], {
        dayStart: DAY_START,
        dayEnd: DAY_END,
      }),
    [appointments],
  );

  function goTo(newDateKey: string) {
    void navigate({ to: '/', search: { date: newDateKey } });
  }

  return (
    <div className="schedule">
      <div className="schedule-appbar">
        <button
          type="button"
          className="schedule-arrow"
          aria-label={t('schedule.nav.prevDay')}
          onClick={() => goTo(addDays(dateKey, -1))}
        >
          ‹
        </button>
        <div className="schedule-date">
          <div className="schedule-date-d">
            {weekdayIdx >= 0 ? t(WEEKDAY_LONG_KEYS[weekdayIdx]) : ''},{' '}
            {dateKey.slice(8, 10)} {monthShortLabel(dateKey)}
          </div>
          <div className="schedule-date-m">
            {relativeDayLabel(dateKey, todayDateKey)}
          </div>
        </div>
        <button
          type="button"
          className="schedule-arrow"
          aria-label={t('schedule.nav.nextDay')}
          onClick={() => goTo(addDays(dateKey, 1))}
        >
          ›
        </button>
      </div>

      <div className="schedule-week">
        {week.map((key, i) => (
          <button
            key={key}
            type="button"
            className={`schedule-weekday${key === dateKey ? ' schedule-weekday-on' : ''}`}
            onClick={() => goTo(key)}
          >
            <div className="schedule-weekday-wd">
              {t(WEEKDAY_SHORT_KEYS[i])}
            </div>
            {key.slice(8, 10)}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="schedule-pending">{t('schedule.loading')}</div>
      ) : (
        <div className="schedule-list">
          {(appointments ?? []).length === 0 && (
            <p className="schedule-emptyDay">{t('schedule.emptyDay')}</p>
          )}
          {layout.items.map((item, i) =>
            item.kind === 'appt' ? (
              <AppointmentBlock
                key={item.appt.id}
                appt={item}
                clientName={
                  clientNameById.get(item.appt.clientId) ?? item.appt.clientId
                }
              />
            ) : (
              <GapRow key={`gap-${i}`} item={item} stepMinutes={stepMinutes} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
