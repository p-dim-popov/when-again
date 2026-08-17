import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { t } from '../i18n';
import { type Appointment } from '../appointments';
import { buildHandoffUrl } from './codec';

// Provider share widget. Renders a scannable QR of the handoff link plus a
// system-share / copy row. The QR sits on an explicit WHITE card with black
// modules (not themed to dark tokens) so it stays scannable in either theme.
export function HandoffShare({
  appointment,
  providerName,
  address,
  providerId,
  phone,
}: {
  appointment: Appointment;
  providerName: string;
  address?: string;
  providerId?: string;
  phone?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const url = buildHandoffUrl(
    {
      id: appointment.id,
      providerName,
      ...(address ? { address } : {}),
      ...(providerId ? { providerId } : {}),
      ...(phone ? { phone } : {}),
      service: appointment.service,
      start: appointment.start,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status === 'cancelled' ? 'cancelled' : 'booked',
    },
    { origin: window.location.origin, basePath: import.meta.env.BASE_URL },
  );

  async function copy() {
    setCopied(false);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    await copy();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-card bg-white p-3">
        <QRCodeSVG value={url} size={180} level="M" marginSize={0} />
      </div>
      {!providerName && (
        <p className="text-muted text-center text-[11.5px]">
          {t('handoff.share.setNameHint')}
        </p>
      )}
      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={() => void share()}
          className="bg-accent text-on-accent rounded-card flex-1 cursor-pointer border-0 p-3 text-center text-sm font-[650]"
        >
          {t('handoff.share.link')}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="bg-surface-2 text-ink border-line rounded-card flex-1 cursor-pointer border p-3 text-center text-sm font-semibold"
        >
          {copied ? t('handoff.share.copied') : t('handoff.share.copy')}
        </button>
      </div>
      {copyFailed && (
        <p className="text-danger text-center text-[11.5px]">
          {t('handoff.share.copyFailed')}
        </p>
      )}
      <span data-testid="handoff-link" className="sr-only">
        {url}
      </span>
    </div>
  );
}
