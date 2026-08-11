import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getDataVersion } from '../db';
import { t } from '../i18n';
import { buildInfo, formatBuiltAt, formatStamp } from './buildInfo';
import {
  checkForUpdates,
  type RemoteVersion,
  type UpdateCheckResult,
} from './updateCheck';

// Version footer (#33): a quiet build stamp, expandable into diagnostics
// (data version, copy-for-bug-report) and a manual update check. Built
// self-contained so Epic 7's real Settings screen re-mounts it unchanged.

async function fetchVersion(): Promise<RemoteVersion> {
  // no-store: version.json names the *deployed* build, so neither the HTTP
  // cache nor the service worker may answer (it is also excluded from the
  // precache via globIgnores in vite.config.ts).
  const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`version.json: HTTP ${response.status}`);
  return (await response.json()) as RemoteVersion;
}

async function triggerSwUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update();
}

export function VersionFooter() {
  const [expanded, setExpanded] = useState(false);
  const [check, setCheck] = useState<'idle' | 'checking' | UpdateCheckResult>(
    'idle',
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  // useLiveQuery re-throws querier errors during render, so a device where
  // IndexedDB cannot open would otherwise take down the whole footer;
  // swallow it here and let only the Data version line degrade.
  const dataVersion = useLiveQuery(
    () => getDataVersion().catch(() => undefined),
    [],
  );

  const runCheck = () => {
    setCheck('checking');
    void checkForUpdates({
      fetchVersion,
      currentCommit: buildInfo.commit,
      triggerSwUpdate,
    }).then(setCheck);
  };

  const copyDiagnostics = async () => {
    const block = [
      `version: ${buildInfo.version}`,
      `commit: ${buildInfo.commit}`,
      `builtAt: ${buildInfo.builtAt}`,
      `dataVersion: ${dataVersion ?? 'unknown'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(block);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    window.setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <footer className="text-ink mt-8 text-center text-xs opacity-70">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="cursor-pointer"
      >
        {formatStamp(buildInfo)}
        {buildInfo.dev ? ` (${t('shell.version.dev')})` : ''}
      </button>
      {expanded && (
        <div className="mt-2 flex flex-col items-center gap-1">
          <p>
            {t('shell.version.data')}: {dataVersion ?? '…'}
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => void copyDiagnostics()}
              className="cursor-pointer underline"
            >
              {copyState === 'copied' && t('shell.version.copied')}
              {copyState === 'failed' && t('shell.version.copyFailed')}
              {copyState === 'idle' && t('shell.version.copy')}
            </button>
            <button
              type="button"
              onClick={runCheck}
              disabled={check === 'checking'}
              className="cursor-pointer underline"
            >
              {check === 'checking'
                ? t('shell.version.checking')
                : t('shell.version.check')}
            </button>
          </div>
          {typeof check === 'object' && (
            <p role="status">
              {check.status === 'up-to-date' && t('shell.version.upToDate')}
              {check.status === 'update-available' &&
                t('shell.version.updateAvailable', {
                  version: formatBuiltAt(check.builtAt),
                })}
              {check.status === 'failed' && t('shell.version.checkFailed')}
            </p>
          )}
        </div>
      )}
    </footer>
  );
}
