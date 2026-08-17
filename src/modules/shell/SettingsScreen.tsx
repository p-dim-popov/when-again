import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { t, type Language } from '../i18n';
import {
  getSettings,
  updateSettings,
  type Mode,
  type Theme,
} from '../settings';
import { BackupSection } from './BackupSection';
import { applyLanguageChoice } from './switchLanguage';
import { applyThemeChoice } from './switchTheme';
import { VersionFooter } from './VersionFooter';

function Segmented<T extends string | null>({
  value,
  options,
  onChange,
  testId,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  testId: string;
  label: string;
}) {
  return (
    <div
      className="border-line bg-surface rounded-card inline-flex overflow-hidden border"
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
    >
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`cursor-pointer border-0 px-4 py-2 text-sm ${
            option.value === value
              ? 'bg-accent text-on-accent font-[650]'
              : 'bg-surface text-ink'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ProfileSection({
  initialName,
  initialAddress,
  initialPhone,
  saved,
  onSaved,
}: {
  initialName: string;
  initialAddress: string;
  initialPhone: string;
  saved: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [phone, setPhone] = useState(initialPhone);

  const save = async () => {
    await updateSettings({
      providerName: name,
      address: address || undefined,
      phone: phone || undefined,
    });
    onSaved();
  };

  return (
    <section className="flex flex-col gap-2" data-testid="profile-section">
      <h2 className="text-faint text-sm font-semibold">
        {t('shell.settings.profile.title')}
      </h2>
      <label className="text-ink flex flex-col gap-1 text-sm">
        {t('shell.settings.profile.name')}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="profile-name"
          className="border-line bg-surface text-ink rounded-card min-h-11 border px-3"
        />
      </label>
      <label className="text-ink flex flex-col gap-1 text-sm">
        {t('shell.settings.profile.address')}
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          data-testid="profile-address"
          className="border-line bg-surface text-ink rounded-card min-h-11 border px-3"
        />
      </label>
      <label className="text-ink flex flex-col gap-1 text-sm">
        {t('shell.settings.profile.phone')}
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          data-testid="profile-phone"
          className="border-line bg-surface text-ink rounded-card min-h-11 border px-3"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          data-testid="profile-save"
          className="bg-accent text-on-accent rounded-card cursor-pointer border-0 px-4 py-2 text-sm font-[650]"
        >
          {t('shell.settings.profile.save')}
        </button>
        {saved && (
          <span className="text-faint text-sm" role="status">
            {t('shell.settings.profile.saved')}
          </span>
        )}
      </div>
    </section>
  );
}

// The real Settings screen (#7, replaces the Epic-4 placeholder).
export function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings(), []);
  // Lives here (not in ProfileSection) so it survives the section's own
  // remount: saving changes settings.providerName/address, which changes
  // ProfileSection's `key` below (that key exists to resync the form's
  // local input state after an *external* change, e.g. a backup import),
  // remounting it with fresh local state. A "saved" flag stored inside
  // ProfileSection would be wiped by that remount before it ever painted.
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (!profileSaved) return;
    const timer = window.setTimeout(() => setProfileSaved(false), 2000);
    return () => window.clearTimeout(timer);
  }, [profileSaved]);

  if (settings === undefined) return null;

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-ink font-display text-xl">
        {t('shell.settings.title')}
      </h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-faint text-sm font-semibold">
          {t('shell.settings.mode.label')}
        </h2>
        <Segmented<Mode>
          value={settings.mode ?? 'provider'}
          testId="mode-switch"
          label={t('shell.settings.mode.label')}
          options={[
            { value: 'provider', label: t('shell.settings.mode.provider') },
            { value: 'client', label: t('shell.settings.mode.client') },
          ]}
          onChange={(mode) => void updateSettings({ mode })}
        />
      </section>

      {settings.mode === 'provider' && (
        <ProfileSection
          key={`${settings.providerName}|${settings.address ?? ''}|${settings.phone ?? ''}`}
          initialName={settings.providerName}
          initialAddress={settings.address ?? ''}
          initialPhone={settings.phone ?? ''}
          saved={profileSaved}
          onSaved={() => setProfileSaved(true)}
        />
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-faint text-sm font-semibold">
          {t('shell.settings.appearance.title')}
        </h2>
        <Segmented<Theme | null>
          value={settings.theme}
          testId="theme-switch"
          label={t('shell.settings.appearance.title')}
          options={[
            { value: 'light', label: t('shell.settings.appearance.light') },
            { value: 'dark', label: t('shell.settings.appearance.dark') },
            { value: null, label: t('shell.settings.appearance.auto') },
          ]}
          onChange={(theme) => void applyThemeChoice(theme)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-faint text-sm font-semibold">
          {t('shell.settings.language.title')}
        </h2>
        <Segmented<Language | null>
          value={settings.language}
          testId="language-switch"
          label={t('shell.settings.language.title')}
          options={[
            { value: 'bg', label: 'БГ' },
            { value: 'en', label: 'EN' },
            { value: null, label: t('shell.settings.lang.auto') },
          ]}
          onChange={(language) => void applyLanguageChoice(language)}
        />
      </section>

      {settings.mode === 'provider' && <BackupSection />}

      <VersionFooter />
    </main>
  );
}
