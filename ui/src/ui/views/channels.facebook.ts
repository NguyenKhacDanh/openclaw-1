import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type { FacebookPageStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

export function renderFacebookPageCard(params: {
  props: ChannelsProps;
  facebook?: FacebookPageStatus;
  accountCountLabel: unknown;
}) {
  const { props, facebook, accountCountLabel } = params;
  const configured = resolveChannelConfigured("facebook", props);
  const tokenExpired =
    facebook?.tokenExpiresAt != null && facebook.tokenExpiresAt < Date.now();
  const tokenExpiresSoon =
    !tokenExpired &&
    facebook?.tokenExpiresAt != null &&
    facebook.tokenExpiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000;

  return renderSingleAccountChannelCard({
    title: "Facebook Page",
    subtitle: "Đăng bài, lên lịch và quản lý nội dung Facebook Page.",
    accountCountLabel,
    statusRows: [
      { label: t("common.configured"), value: formatNullableBoolean(configured) },
      { label: t("common.running"), value: facebook?.running ? t("common.yes") : t("common.no") },
      {
        label: t("facebook.pageId"),
        value: facebook?.pageId ?? t("common.na"),
      },
      {
        label: t("facebook.pageName"),
        value: facebook?.pageName ?? t("common.na"),
      },
      {
        label: t("facebook.tokenSource"),
        value: facebook?.tokenSource ?? t("common.na"),
      },
      {
        label: t("facebook.tokenExpires"),
        value: facebook?.tokenExpiresAt
          ? formatRelativeTimestamp(facebook.tokenExpiresAt)
          : t("common.na"),
      },
      {
        label: t("facebook.instagramLinked"),
        value: facebook?.instagramLinked
          ? t("common.yes")
          : facebook?.instagramLinked === false
            ? t("common.no")
            : t("common.na"),
      },
      {
        label: t("facebook.lastPost"),
        value: facebook?.lastPostAt
          ? formatRelativeTimestamp(facebook.lastPostAt)
          : t("common.na"),
      },
    ],
    lastError: facebook?.lastError,
    extraContent: html`
      ${tokenExpired
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${t("facebook.tokenExpiredWarning")}
          </div>`
        : nothing}
      ${tokenExpiresSoon
        ? html`<div class="callout warn" style="margin-top: 12px;">
            ${t("facebook.tokenExpiresSoonWarning")}
          </div>`
        : nothing}
      ${props.facebookPostDraft != null
        ? html`
            <div style="margin-top: 14px;">
              <div class="card-title" style="font-size: 14px; margin-bottom: 8px;">
                ${t("facebook.quickPost")}
              </div>
              <label class="field">
                <span>${t("facebook.postContent")}</span>
                <textarea
                  class="agent-file-textarea"
                  style="min-height: 90px;"
                  .value=${props.facebookPostDraft ?? ""}
                  @input=${(e: Event) =>
                    props.onFacebookPostDraftChange(
                      (e.target as HTMLTextAreaElement).value,
                    )}
                  placeholder=${t("facebook.postPlaceholder")}
                ></textarea>
              </label>
              <div class="row" style="margin-top: 8px; flex-wrap: wrap;">
                <button
                  class="btn primary"
                  ?disabled=${props.facebookBusy || !props.facebookPostDraft?.trim()}
                  @click=${() => props.onFacebookPost()}
                >
                  ${props.facebookBusy ? t("common.working") : t("facebook.postNow")}
                </button>
                <button
                  class="btn"
                  ?disabled=${props.facebookBusy}
                  @click=${() => props.onFacebookSchedulePost()}
                >
                  ${t("facebook.schedulePost")}
                </button>
                <button
                  class="btn"
                  @click=${() => props.onFacebookPostDraftChange(null)}
                >
                  ${t("common.cancel")}
                </button>
              </div>
            </div>
          `
        : nothing}
    `,
    configSection: renderChannelConfigSection({ channelId: "facebook", props }),
    footer: html`
      <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
        ${props.facebookPostDraft == null
          ? html`
              <button
                class="btn primary"
                ?disabled=${props.facebookBusy}
                @click=${() => props.onFacebookPostDraftChange("")}
              >
                ${t("facebook.newPost")}
              </button>
            `
          : nothing}
        <button
          class="btn"
          ?disabled=${props.facebookBusy}
          @click=${() => props.onFacebookRefreshToken()}
        >
          ${t("facebook.refreshToken")}
        </button>
        <button class="btn" @click=${() => props.onRefresh(true)}>${t("common.refresh")}</button>
      </div>
    `,
  });
}
