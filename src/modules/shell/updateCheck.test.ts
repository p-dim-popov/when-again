import { describe, expect, it, vi } from 'vitest';
import { checkForUpdates, type RemoteVersion } from './updateCheck';

const remote: RemoteVersion = {
  version: '2026-08-12-0910',
  commit: 'abc1234',
  builtAt: '2026-08-12T09:10:00Z',
};

describe('checkForUpdates', () => {
  it('reports up-to-date when the deployed commit matches', async () => {
    const triggerSwUpdate = vi.fn();
    const result = await checkForUpdates({
      fetchVersion: async () => ({ ...remote, commit: 'same123' }),
      currentCommit: 'same123',
      triggerSwUpdate,
    });
    expect(result).toEqual({ status: 'up-to-date' });
    expect(triggerSwUpdate).not.toHaveBeenCalled();
  });

  it('names the incoming version and stages the worker when commits differ', async () => {
    const triggerSwUpdate = vi.fn().mockResolvedValue(undefined);
    const result = await checkForUpdates({
      fetchVersion: async () => remote,
      currentCommit: 'old0000',
      triggerSwUpdate,
    });
    expect(result).toEqual({
      status: 'update-available',
      version: '2026-08-12-0910',
      builtAt: '2026-08-12T09:10:00Z',
    });
    expect(triggerSwUpdate).toHaveBeenCalledOnce();
  });

  it('fails calmly when the fetch rejects (offline)', async () => {
    const triggerSwUpdate = vi.fn();
    const result = await checkForUpdates({
      fetchVersion: async () => {
        throw new Error('offline');
      },
      currentCommit: 'any',
      triggerSwUpdate,
    });
    expect(result).toEqual({ status: 'failed' });
    expect(triggerSwUpdate).not.toHaveBeenCalled();
  });

  it('fails calmly when the payload is not a version file', async () => {
    // A SPA-fallback HTML response parsed as JSON, or any wrong shape.
    const result = await checkForUpdates({
      fetchVersion: async () => ({}) as RemoteVersion,
      currentCommit: 'any',
      triggerSwUpdate: vi.fn(),
    });
    expect(result).toEqual({ status: 'failed' });
  });

  it('still reports the update when staging the worker fails', async () => {
    const result = await checkForUpdates({
      fetchVersion: async () => remote,
      currentCommit: 'old0000',
      triggerSwUpdate: vi.fn().mockRejectedValue(new Error('no SW')),
    });
    expect(result).toEqual({
      status: 'update-available',
      version: '2026-08-12-0910',
      builtAt: '2026-08-12T09:10:00Z',
    });
  });
});
