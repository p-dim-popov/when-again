import { afterEach, describe, expect, it } from 'vitest';
import {
  draftStore,
  resetDraft,
  setDraftDate,
  setDraftTime,
} from './draftStore';

afterEach(() => {
  resetDraft();
});

describe('draftStore', () => {
  it('starts empty', () => {
    expect(draftStore.state).toEqual({
      dateKey: null,
      time: null,
      appointmentId: null,
    });
  });

  it('setDraftDate sets the date and leaves the rest untouched', () => {
    setDraftDate('2026-08-22');
    expect(draftStore.state).toEqual({
      dateKey: '2026-08-22',
      time: null,
      appointmentId: null,
    });
  });

  it('setDraftTime sets the time and leaves an already-set date untouched', () => {
    setDraftDate('2026-08-22');
    setDraftTime('11:00');
    expect(draftStore.state).toEqual({
      dateKey: '2026-08-22',
      time: '11:00',
      appointmentId: null,
    });
  });

  it('resetDraft clears a fully-populated draft back to empty', () => {
    setDraftDate('2026-08-22');
    setDraftTime('11:00');
    resetDraft();
    expect(draftStore.state).toEqual({
      dateKey: null,
      time: null,
      appointmentId: null,
    });
  });
});
