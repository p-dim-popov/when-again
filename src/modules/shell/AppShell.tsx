import { Link, Outlet } from '@tanstack/react-router';
import { t } from '../i18n';
import './AppShell.css';

// Bottom tab bar ported from docs/design/epic-4/schedule-and-booking-flow.html
// (the `.tabs` block: Днес · Клиенти · raised primary ＋ Нов час · Настройки).
export function AppShell() {
  return (
    <div className="appShell">
      <div className="appShell-content">
        <Outlet />
      </div>
      <nav className="tabs" aria-label={t('shell.nav.label')}>
        <Link to="/" className="tab" activeOptions={{ exact: true }}>
          <span className="ic" aria-hidden="true">
            ▤
          </span>
          {t('shell.tab.today')}
        </Link>
        <Link to="/clients" className="tab">
          <span className="ic" aria-hidden="true">
            ☺
          </span>
          {t('shell.tab.clients')}
        </Link>
        <Link to="/book" className="tab primary">
          <span className="fab" aria-hidden="true">
            ＋
          </span>
          {t('shell.tab.new')}
        </Link>
        <Link to="/settings" className="tab">
          <span className="ic" aria-hidden="true">
            ⚙
          </span>
          {t('shell.tab.settings')}
        </Link>
      </nav>
    </div>
  );
}
