import { describe, expect, it } from 'vitest';
import { buildInfo, formatBuiltAt, formatStamp } from './buildInfo';

describe('formatBuiltAt', () => {
  it('formats a minute-precision ISO timestamp as "date time UTC"', () => {
    expect(formatBuiltAt('2026-08-11T14:32:00Z')).toBe('2026-08-11 14:32 UTC');
  });
});

describe('formatStamp', () => {
  it('joins built-at and commit with a middle dot', () => {
    expect(
      formatStamp({ builtAt: '2026-08-11T14:32:00Z', commit: 'bd12529' }),
    ).toBe('2026-08-11 14:32 UTC · bd12529');
  });
});

describe('buildInfo', () => {
  it('carries the build constants injected by the bundler config', () => {
    expect(buildInfo).toMatchObject({
      version: '2026-01-02-0304',
      commit: 'testsha',
      builtAt: '2026-01-02T03:04:00Z',
    });
  });
});
