import { afterEach, describe, expect, it } from 'vitest';
import { draftStore, patchDraft, resetDraft, setDraftDate } from './draftStore';

const EMPTY = {
  dateKey: null,
  time: null,
  appointmentId: null,
  clientId: null,
  clientName: null,
  service: null,
  durationMinutes: null,
  price: null,
};

afterEach(() => {
  resetDraft();
});

describe('draftStore', () => {
  it('starts empty', () => {
    expect(draftStore.state).toEqual(EMPTY);
  });

  it('setDraftDate sets the date and leaves the rest untouched', () => {
    setDraftDate('2026-08-22');
    expect(draftStore.state).toEqual({ ...EMPTY, dateKey: '2026-08-22' });
  });

  it('resetDraft clears a fully-populated draft back to empty', () => {
    setDraftDate('2026-08-22');
    patchDraft({ time: '11:00' });
    patchDraft({
      clientId: 'c1',
      clientName: 'Elena',
      service: 'Haircut',
      durationMinutes: 30,
      price: 25,
      appointmentId: 'a1',
    });
    resetDraft();
    expect(draftStore.state).toEqual(EMPTY);
  });

  describe('patchDraft', () => {
    it('merges the given fields without clobbering the rest', () => {
      setDraftDate('2026-08-22');
      patchDraft({ time: '11:00' });
      patchDraft({ clientId: 'c1', clientName: 'Elena' });
      expect(draftStore.state).toEqual({
        ...EMPTY,
        dateKey: '2026-08-22',
        time: '11:00',
        clientId: 'c1',
        clientName: 'Elena',
      });

      patchDraft({ service: 'Haircut', durationMinutes: 30 });
      expect(draftStore.state).toEqual({
        ...EMPTY,
        dateKey: '2026-08-22',
        time: '11:00',
        clientId: 'c1',
        clientName: 'Elena',
        service: 'Haircut',
        durationMinutes: 30,
      });
    });

    it('can overwrite dateKey/time while preserving other in-progress fields (the Промени round trip)', () => {
      patchDraft({
        clientId: 'c1',
        clientName: 'Elena',
        service: 'Haircut',
        durationMinutes: 30,
        price: 25,
      });
      // Simulates re-entering the form after the day view round trip: only
      // dateKey/time are re-seeded from the new search params.
      patchDraft({ dateKey: '2026-08-23', time: '15:30' });

      expect(draftStore.state).toEqual({
        ...EMPTY,
        dateKey: '2026-08-23',
        time: '15:30',
        clientId: 'c1',
        clientName: 'Elena',
        service: 'Haircut',
        durationMinutes: 30,
        price: 25,
      });
    });

    it('sets appointmentId alone, leaving everything else in place', () => {
      setDraftDate('2026-08-22');
      patchDraft({ time: '11:00' });
      patchDraft({ clientId: 'c1', service: 'Haircut', durationMinutes: 30 });
      patchDraft({ appointmentId: 'a1' });

      expect(draftStore.state).toEqual({
        ...EMPTY,
        dateKey: '2026-08-22',
        time: '11:00',
        clientId: 'c1',
        service: 'Haircut',
        durationMinutes: 30,
        appointmentId: 'a1',
      });
    });
  });
});
