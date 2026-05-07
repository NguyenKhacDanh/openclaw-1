import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { ZaloStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderZaloCard(params: {
  props: ChannelsProps;
  zalo?: ZaloStatus;
  zalouser?: ZaloStatus | null;
  accountCountLabel: unknown;
}) {
  const { props, zalo, zalouser, accountCountLabel } = params;
  const configured = resolveChannelConfigured("zalo", props);
  const isOaMode = zalo?.botMode === "oa";
  // For personal mode, status comes from the zalouser plugin channel
  const effectiveStatus = isOaMode ? zalo : (zalouser ?? zalo);

  return renderSingleAccountChannelCard({
    title: "Zalo",
    subtitle: isOaMode
      ? "Zalo Official Account (OA) bot — cấu hình webhook OA."
      : "Quét QR Zalo để kết nối tài khoản cá nhân làm agent.",
    accountCountLabel,
    statusRows: [
      { label: t("common.configured"), value: formatNullableBoolean(configured) },
      {
        label: t("zalo.botMode"),
        value: isOaMode ? t("zalo.modeOa") : t("zalo.modePersonal"),
      },
      { label: t("common.linked"), value: effectiveStatus?.linked ? t("common.yes") : t("common.no") },
      { label: t("common.running"), value: effectiveStatus?.running ? t("common.yes") : t("common.no") },
      {
        label: t("common.connected"),
        value: effectiveStatus?.connected ? t("common.yes") : t("common.no"),
      },
      {
        label: t("zalo.phone"),
        value: effectiveStatus?.phone ?? t("common.na"),
      },
      {
        label: t("zalo.displayName"),
        value: effectiveStatus?.displayName ?? t("common.na"),
      },
      ...(isOaMode
        ? [
            { label: t("zalo.oaId"), value: effectiveStatus?.oaId ?? t("common.na") },
            { label: t("zalo.oaName"), value: effectiveStatus?.oaName ?? t("common.na") },
          ]
        : []),
      {
        label: t("common.lastConnect"),
        value: effectiveStatus?.lastConnectedAt
          ? formatRelativeTimestamp(effectiveStatus.lastConnectedAt)
          : t("common.na"),
      },
      {
        label: t("common.lastMessage"),
        value: effectiveStatus?.lastMessageAt
          ? formatRelativeTimestamp(effectiveStatus.lastMessageAt)
          : t("common.na"),
      },
      {
        label: t("common.authAge"),
        value: effectiveStatus?.authAgeMs != null ? formatDurationHuman(effectiveStatus.authAgeMs) : t("common.na"),
      },
    ],
    lastError: effectiveStatus?.lastError,
    extraContent: html`
      ${props.zaloMessage
        ? html`<div class="callout" style="margin-top: 12px;">${props.zaloMessage}</div>`
        : nothing}
      ${props.zaloQrDataUrl
        ? html`
            <div style="margin-top: 12px;">
              <div class="muted" style="margin-bottom: 6px; font-size: 13px;">
                ${t("zalo.scanQrHint")}
              </div>
              <div class="qr-wrap">
                <img src=${props.zaloQrDataUrl} alt="Zalo QR" />
              </div>
            </div>
          `
        : nothing}
      ${isOaMode
        ? html`
            <div class="callout info" style="margin-top: 12px;">
              ${t("zalo.oaModeHint")}
            </div>
          `
        : nothing}
    `,
    configSection: renderChannelConfigSection({ channelId: "zalo", props }),
    footer: html`
      <div style="margin-top: 14px;">
        <div class="muted" style="margin-bottom: 8px; font-size: 13px;">${t("zalo.modeLabel")}</div>
        <div class="row" style="margin-bottom: 10px; flex-wrap: wrap;">
          <button
            class="btn btn--sm ${!isOaMode ? "primary" : ""}"
            @click=${() => props.onZaloSetMode("personal")}
          >
            ${t("zalo.modePersonal")}
          </button>
          <button
            class="btn btn--sm ${isOaMode ? "primary" : ""}"
            @click=${() => props.onZaloSetMode("oa")}
          >
            ${t("zalo.modeOa")}
          </button>
        </div>
        <div class="row" style="flex-wrap: wrap;">
          ${!isOaMode
            ? html`
                <button
                  class="btn primary"
                  ?disabled=${props.zaloBusy}
                  @click=${() => props.onZaloStart(false)}
                >
                  ${props.zaloBusy ? t("common.working") : t("common.showQr")}
                </button>
                <button
                  class="btn"
                  ?disabled=${props.zaloBusy}
                  @click=${() => props.onZaloStart(true)}
                >
                  ${t("common.relink")}
                </button>
                <button
                  class="btn"
                  ?disabled=${props.zaloBusy}
                  @click=${() => props.onZaloWait()}
                >
                  ${t("common.waitForScan")}
                </button>
                <button
                  class="btn danger"
                  ?disabled=${props.zaloBusy}
                  @click=${() => props.onZaloLogout()}
                >
                  ${t("common.logout")}
                </button>
              `
            : nothing}
          <button class="btn" @click=${() => props.onRefresh(true)}>${t("common.refresh")}</button>
        </div>
      </div>
    `,
  });
}
