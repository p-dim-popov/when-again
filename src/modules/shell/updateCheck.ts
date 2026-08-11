// Manual "check for updates" (#33, absorbing the #30 escape hatch). The
// deployed version.json only *names* what is live; any commit difference
// counts as an update (a rollback too — no ordering logic). Applying still
// goes through the one existing path: triggerSwUpdate stages the new worker,
// needRefresh flips in src/app/App.tsx, and the UpdateBanner applies it.
export type RemoteVersion = {
  version: string;
  commit: string;
  builtAt: string;
};

export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | { status: 'update-available'; version: string; builtAt: string }
  | { status: 'failed' };

function isRemoteVersion(value: unknown): value is RemoteVersion {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === 'string' &&
    typeof record.commit === 'string' &&
    typeof record.builtAt === 'string'
  );
}

export async function checkForUpdates(deps: {
  fetchVersion: () => Promise<RemoteVersion>;
  currentCommit: string;
  triggerSwUpdate: () => Promise<void>;
}): Promise<UpdateCheckResult> {
  let remote: unknown;
  try {
    remote = await deps.fetchVersion();
  } catch {
    return { status: 'failed' };
  }
  if (!isRemoteVersion(remote)) return { status: 'failed' };
  if (remote.commit === deps.currentCommit) return { status: 'up-to-date' };
  try {
    await deps.triggerSwUpdate();
  } catch {
    // Staging failed (no SW in this context, transient error) — the check
    // still names the update; the hourly re-check remains the fallback.
  }
  return {
    status: 'update-available',
    version: remote.version,
    builtAt: remote.builtAt,
  };
}
