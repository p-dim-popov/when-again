import { t } from '../i18n';
import type { TranslationKeys } from '../i18n';

export function Placeholder({
  titleKey,
}: {
  titleKey: keyof TranslationKeys & string;
}) {
  return (
    <main
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div>
        <h1>{t(titleKey)}</h1>
        <p>{t('shell.soon')}</p>
      </div>
    </main>
  );
}
