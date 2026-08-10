import { describe, expect, it, vi } from 'vitest';
import { resolveClientId } from './resolveClient';

const clients = [
  { id: 'c1', name: 'Ivan Petrov' },
  { id: 'c2', name: 'Maria Georgieva' },
];

describe('resolveClientId', () => {
  it('uses an explicitly selected clientId as-is', async () => {
    const createClient = vi.fn();
    expect(
      await resolveClientId({
        clientId: 'c2',
        name: 'whatever',
        clients,
        createClient,
      }),
    ).toBe('c2');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('matches an existing name case-insensitively without creating a duplicate', async () => {
    const createClient = vi.fn();
    expect(
      await resolveClientId({
        clientId: null,
        name: 'ivan petrov',
        clients,
        createClient,
      }),
    ).toBe('c1');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('creates a new client when the name is unknown', async () => {
    const createClient = vi.fn(async (name: string) => ({ id: 'new', name }));
    expect(
      await resolveClientId({
        clientId: null,
        name: 'New Person',
        clients,
        createClient,
      }),
    ).toBe('new');
    expect(createClient).toHaveBeenCalledWith('New Person');
  });

  it('returns null for an empty name', async () => {
    const createClient = vi.fn();
    expect(
      await resolveClientId({
        clientId: null,
        name: '',
        clients,
        createClient,
      }),
    ).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });
});
