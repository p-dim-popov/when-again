import { describe, expect, it } from 'vitest';
import { shouldResetDraft } from './freshStart';

describe('shouldResetDraft', () => {
  it('resets only a truly fresh entry (no appt, no resume)', () => {
    expect(shouldResetDraft({})).toBe(true);
    expect(shouldResetDraft({ appt: 'a1' })).toBe(false); // edit/reschedule
    expect(shouldResetDraft({ resume: true })).toBe(false); // Промени round-trip
    expect(shouldResetDraft({ appt: 'a1', resume: true })).toBe(false);
  });
});
