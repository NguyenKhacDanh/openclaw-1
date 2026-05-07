import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { ChannelAccountSnapshot, TelegramStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderTelegramCard(params: {
  props: ChannelsProps;
  telegram?: TelegramStatus;
  telegramAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, telegram, telegramAccounts, accountCountLabel } = params;
  const hasMultipleAccounts = telegramAccounts.length > 1;
  const configured = resolveChannelConfigured("telegram", props);

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const probe = account.probe as { bot?: { username?: string } } | undefined;
    const botUsername = probe?.bot?.username;
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${botUsername ? `@${botUsername}` : label}</div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${t("common.running")}</span>
            <span>${account.running ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("common.configured")}</span>
            <span>${account.configured ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("common.lastInbound")}</span>
            <span
              >${account.lastInboundAt
                ? formatRelativeTimestamp(account.lastInboundAt)
                : t("common.na")}</span
            >
          </div>
          ${account.lastError
            ? html` <div class="account-card-error">${account.lastError}</div> `
            : nothing}
        </div>
      </div>
    `;
  };

  if (hasMultipleAccounts) {
    return html`
      <div class="card">
        <div class="card-title">Telegram</div>
        <div class="card-sub">Bot status and channel configuration.</div>
        ${accountCountLabel}

        <div class="account-card-list">
          ${telegramAccounts.map((account) => renderAccountCard(account))}
        </div>

        ${telegram?.lastError
          ? html`<div class="callout danger" style="margin-top: 12px;">${telegram.lastError}</div>`
          : nothing}
        ${telegram?.probe
          ? html`<div class="callout" style="margin-top: 12px;">
              ${telegram.probe.ok ? t("common.probeOk") : t("common.probeFailed")} ·
              ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
            </div>`
          : nothing}
        ${renderChannelConfigSection({ channelId: "telegram", props })}

        <div class="row" style="margin-top: 12px;">
          <button class="btn" @click=${() => props.onRefresh(true)}>${t("common.probe")}</button>
        </div>
      </div>
    `;
  }

  return renderSingleAccountChannelCard({
    title: "Telegram",
    subtitle: "Bot status and channel configuration.",
    accountCountLabel,
    statusRows: [
      { label: t("common.configured"), value: formatNullableBoolean(configured) },
      { label: t("common.running"), value: telegram?.running ? t("common.yes") : t("common.no") },
      { label: t("common.mode"), value: telegram?.mode ?? t("common.na") },
      {
        label: t("common.lastStart"),
        value: telegram?.lastStartAt
          ? formatRelativeTimestamp(telegram.lastStartAt)
          : t("common.na"),
      },
      {
        label: t("common.lastProbe"),
        value: telegram?.lastProbeAt
          ? formatRelativeTimestamp(telegram.lastProbeAt)
          : t("common.na"),
      },
    ],
    lastError: telegram?.lastError,
    secondaryCallout: telegram?.probe
      ? html`<div class="callout" style="margin-top: 12px;">
          ${telegram.probe.ok ? t("common.probeOk") : t("common.probeFailed")} ·
          ${telegram.probe.status ?? ""} ${telegram.probe.error ?? ""}
        </div>`
      : nothing,
    extraContent: renderTelegramBotQr(telegram),
    configSection: renderChannelConfigSection({ channelId: "telegram", props }),
    footer: html`<div class="row" style="margin-top: 12px;">
      <button class="btn" @click=${() => props.onRefresh(true)}>${t("common.probe")}</button>
    </div>`,
  });
}

function renderTelegramBotQr(telegram?: TelegramStatus) {
  const botUsername = telegram?.probe?.bot?.username;
  if (!botUsername) return nothing;

  const botUrl = `https://t.me/${botUsername}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(botUrl)}`;

  return html`
    <div style="margin-top: 14px;">
      <div class="muted" style="font-size: 13px; margin-bottom: 6px;">
        ${t("telegram.scanQrHint")} <span class="mono">@${botUsername}</span>
      </div>
      <div class="qr-wrap">
        <img src=${qrUrl} alt="Telegram Bot QR" width="160" height="160" />
      </div>
      <div style="margin-top: 6px;">
        <a
          href=${botUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="mono muted"
          style="font-size: 12px;"
        >${botUrl}</a>
      </div>
    </div>
  `;
}
