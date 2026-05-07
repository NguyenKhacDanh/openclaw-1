import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import type { TelegramStatus, WhatsAppStatus, ZaloStatus } from "../types.ts";
import type { ChannelsProps } from "./channels.types.ts";

type QrTab = "zalo" | "zalo-oa" | "whatsapp" | "telegram";

const TAB_LABELS: Record<QrTab, string> = {
  zalo: "Zalo Cá nhân",
  "zalo-oa": "Zalo OA",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

function dotColor(connected: boolean | null | undefined): string {
  if (connected == null) return "#aaa";
  return connected ? "#22c55e" : "#f87171";
}

function statusDot(connected: boolean | null | undefined) {
  return html`<span
    style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dotColor(connected)};margin-right:6px;flex-shrink:0;vertical-align:middle;"
  ></span>`;
}

function inputRow(label: string, body: unknown) {
  return html`
    <div style="margin-top:12px;">
      <div class="muted" style="font-size:12px;margin-bottom:4px;">${label}</div>
      ${body}
    </div>
  `;
}

function readConfigNested(form: Record<string, unknown> | null, keys: string[]): unknown {
  let cur: unknown = form;
  for (const k of keys) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function renderZaloPersonalTab(props: ChannelsProps & QrExtProps, zalo: ZaloStatus | null | undefined) {
  // props.zaloConnected is set immediately after QR confirm; zalo?.connected comes from channels snapshot (may lag)
  const connected = props.zaloConnected ?? zalo?.connected ?? null;

  return html`
    <div class="qrscan-status-row">
      ${statusDot(connected)}
      <span>${connected ? "Đã kết nối" : "Chưa kết nối"}</span>
      ${zalo?.phone ? html`&nbsp;·&nbsp;<span class="mono">${zalo.phone}</span>` : nothing}
      ${zalo?.displayName ? html`&nbsp;·&nbsp;<span>${zalo.displayName}</span>` : nothing}
    </div>

    ${zalo?.lastError && zalo.lastError !== "not configured"
      ? html`<div class="callout danger" style="margin-top:8px;">${zalo.lastError}</div>`
      : nothing}
    ${props.zaloMessage
      ? html`<div class="callout info" style="margin-top:8px;">${props.zaloMessage}</div>`
      : nothing}

    ${renderMentionToggle(props, ["channels", "zalouser", "groups", "*", "requireMention"])}

    ${props.zaloQrDataUrl
      ? html`<div style="margin-top:8px;font-size:13px;" class="muted">
          Sau khi quét, đợi vài giây — hệ thống tự động xác nhận.
        </div>`
      : nothing}

    ${props.zaloQrDataUrl
      ? html`
          <div style="margin-top:16px;text-align:center;">
            <div class="muted" style="font-size:13px;margin-bottom:8px;">
              Mở <strong>Zalo</strong> trên điện thoại → Quét QR
            </div>
            <div style="display:inline-block;padding:8px;background:#fff;border-radius:8px;border:1px solid var(--border);">
              <img src=${props.zaloQrDataUrl} alt="Zalo QR" style="max-width:200px;display:block;" />
            </div>
          </div>
        `
      : nothing}

    <div class="qrscan-actions">
      <button
        class="btn primary"
        ?disabled=${props.zaloBusy}
        @click=${() => props.onZaloStart(false)}
      >
        ${props.zaloBusy ? "Đang xử lý..." : "Hiển thị QR"}
      </button>
      <button class="btn" ?disabled=${props.zaloBusy} @click=${() => props.onZaloStart(true)}>
        Kết nối lại
      </button>
      ${connected
        ? html`<button class="btn danger" ?disabled=${props.zaloBusy} @click=${() => props.onZaloLogout()}>
            Đăng xuất
          </button>`
        : nothing}
    </div>
  `;
}

function renderMentionToggle(
  props: ChannelsProps,
  configPath: string[],
  label = "Chỉ trả lời khi được @tag trong nhóm",
) {
  const requireMention = readConfigNested(props.configForm, configPath) as boolean | undefined;
  const mentionOn = requireMention === true;
  return html`
    <div style="margin-top:12px;display:flex;align-items:center;gap:10px;">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;">
        <input
          type="checkbox"
          .checked=${mentionOn}
          @change=${(e: Event) => {
            const checked = (e.target as HTMLInputElement).checked;
            props.onConfigPatch(configPath, checked);
            props.onConfigSave();
          }}
          style="width:16px;height:16px;cursor:pointer;"
        />
        <span>${label}</span>
      </label>
    </div>
    ${mentionOn
      ? nothing
      : html`<div class="callout info" style="margin-top:8px;font-size:12px;">
          ✅ <strong>Open mode:</strong> Bot trả lời tất cả tin nhắn trong nhóm, không cần @tag.
        </div>`}
  `;
}

function renderZaloOaTab(props: ChannelsProps & QrExtProps, zalo: ZaloStatus | null | undefined) {
  const connected = zalo?.connected ?? null;
  const webhookUrl = props.zaloOaWebhookUrl ?? `${location.origin}/webhook/zalo`;
  return html`
    <div class="qrscan-status-row">
      ${statusDot(connected)}
      <span>${connected ? "OA đã kết nối" : "Chưa kết nối"}</span>
      ${zalo?.oaId ? html`&nbsp;·&nbsp;<span class="mono">${zalo.oaId}</span>` : nothing}
      ${zalo?.oaName ? html`&nbsp;·&nbsp;<span>${zalo.oaName}</span>` : nothing}
    </div>

    ${zalo?.lastError
      ? html`<div class="callout danger" style="margin-top:8px;">${zalo.lastError}</div>`
      : nothing}

    ${renderMentionToggle(props, ["channels", "zalo", "groups", "*", "requireMention"])}

    ${inputRow(
      "OA Access Token",
      html`<input
        class="input"
        type="password"
        placeholder="Dán OA Access Token từ Zalo OA Dashboard..."
        style="width:100%;box-sizing:border-box;"
        .value=${props.zaloOaTokenInput ?? ""}
        @input=${(e: Event) => props.onZaloOaTokenInput((e.target as HTMLInputElement).value)}
      />`,
    )}

    ${inputRow(
      "OA ID (tuỳ chọn)",
      html`<input
        class="input"
        type="text"
        placeholder="OA ID của bạn"
        style="width:100%;box-sizing:border-box;"
        .value=${props.zaloOaIdInput ?? ""}
        @input=${(e: Event) => props.onZaloOaIdInput((e.target as HTMLInputElement).value)}
      />`,
    )}

    ${inputRow(
      "Webhook URL — trỏ URL này trong Zalo OA Dashboard",
      html`<div style="display:flex;gap:6px;align-items:center;">
        <input
          class="input"
          type="text"
          readonly
          .value=${webhookUrl}
          style="flex:1;background:var(--surface-2,#f5f5f5);cursor:default;"
        />
        <button
          class="btn btn--sm"
          @click=${() => navigator.clipboard.writeText(webhookUrl)}
        >Sao chép</button>
      </div>`,
    )}

    <div class="qrscan-actions">
      <button class="btn primary" @click=${() => props.onZaloOaSave()}>Lưu cấu hình</button>
      <button class="btn" @click=${() => props.onRefresh(true)}>Làm mới</button>
    </div>
  `;
}

function renderWhatsAppTab(props: ChannelsProps) {
  const connected = props.whatsappConnected;
  return html`
    <div class="qrscan-status-row">
      ${statusDot(connected)}
      <span>${connected ? "Đã kết nối" : "Chưa kết nối"}</span>
    </div>

    ${props.whatsappMessage
      ? html`<div class="callout info" style="margin-top:8px;">${props.whatsappMessage}</div>`
      : nothing}

    ${renderMentionToggle(props, ["channels", "whatsapp", "groups", "*", "requireMention"])}

    ${props.whatsappQrDataUrl
      ? html`
          <div style="margin-top:16px;text-align:center;">
            <div class="muted" style="font-size:13px;margin-bottom:8px;">
              Mở <strong>WhatsApp</strong> → Thiết bị được liên kết → Quét QR
            </div>
            <div style="display:inline-block;padding:8px;background:#fff;border-radius:8px;border:1px solid var(--border);">
              <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" style="max-width:200px;display:block;" />
            </div>
          </div>
        `
      : nothing}

    <div class="qrscan-actions">
      <button
        class="btn primary"
        ?disabled=${props.whatsappBusy}
        @click=${() => props.onWhatsAppStart(false)}
      >
        ${props.whatsappBusy ? "Đang xử lý..." : "Hiển thị QR"}
      </button>
      <button class="btn" ?disabled=${props.whatsappBusy} @click=${() => props.onWhatsAppStart(true)}>
        Kết nối lại
      </button>
      ${connected
        ? html`<button class="btn danger" ?disabled=${props.whatsappBusy} @click=${() => props.onWhatsAppLogout()}>
            Đăng xuất
          </button>`
        : nothing}
    </div>
  `;
}

function renderTelegramTab(props: ChannelsProps & QrExtProps, telegram: TelegramStatus | undefined) {
  const botUsername = (telegram as { probe?: { bot?: { username?: string } } } | undefined)?.probe
    ?.bot?.username;
  const connected = Boolean(botUsername);
  const botUrl = botUsername ? `https://t.me/${botUsername}` : null;
  const qrUrl = botUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(botUrl)}`
    : null;

  return html`
    <div class="qrscan-status-row">
      ${statusDot(connected ? true : null)}
      <span>${connected ? "Bot đang hoạt động" : "Chưa cấu hình"}</span>
      ${botUsername ? html`&nbsp;·&nbsp;<span class="mono">@${botUsername}</span>` : nothing}
    </div>

    ${renderMentionToggle(props, ["channels", "telegram", "groups", "*", "requireMention"])}

    ${inputRow(
      "Bot Token (lấy từ @BotFather trên Telegram)",
      html`<input
        class="input"
        type="password"
        placeholder="123456789:AABBCCDDEEFFaabbccddeeff..."
        style="width:100%;box-sizing:border-box;"
        .value=${props.telegramTokenInput ?? ""}
        @input=${(e: Event) => props.onTelegramTokenInput((e.target as HTMLInputElement).value)}
      />`,
    )}

    <div class="qrscan-actions">
      <button class="btn primary" @click=${() => props.onTelegramTokenSave()}>
        Lưu & Kết nối
      </button>
    </div>

    ${qrUrl && botUrl
      ? html`
          <div style="margin-top:16px;text-align:center;border-top:1px solid var(--border);padding-top:16px;">
            <div class="muted" style="font-size:13px;margin-bottom:8px;">
              QR để mở chat với bot <span class="mono">@${botUsername}</span>
            </div>
            <div style="display:inline-block;padding:8px;background:#fff;border-radius:8px;border:1px solid var(--border);">
              <img src=${qrUrl} alt="Telegram Bot QR" style="max-width:200px;display:block;" />
            </div>
            <div style="margin-top:8px;">
              <a href=${botUrl} target="_blank" class="link" style="font-size:13px;">${botUrl}</a>
            </div>
          </div>
        `
      : nothing}
  `;
}

export type QrExtProps = {
  zaloTokenInput: string;
  zaloOaTokenInput: string;
  zaloOaIdInput: string;
  zaloOaWebhookUrl?: string;
  telegramTokenInput: string;
  onZaloTokenInput: (v: string) => void;
  onZaloTokenSave: () => void;
  onZaloOaTokenInput: (v: string) => void;
  onZaloOaIdInput: (v: string) => void;
  onZaloOaSave: () => void;
  onTelegramTokenInput: (v: string) => void;
  onTelegramTokenSave: () => void;
};

export function renderQrScanPanel(
  props: ChannelsProps & QrExtProps & {
    qrActiveTab: QrTab;
    onQrTabChange: (tab: QrTab) => void;
  },
  zaloPersonal: ZaloStatus | null | undefined,
  zaloOa: ZaloStatus | null | undefined,
  whatsapp: WhatsAppStatus | undefined,
  telegram: TelegramStatus | undefined,
) {
  const { qrActiveTab, onQrTabChange } = props;

  return html`
    <div class="card" style="margin-bottom:18px;">
      <div class="card-title">Kết nối kênh nhắn tin</div>
      <div class="card-sub">Quét QR hoặc nhập token để kết nối Zalo, WhatsApp, Telegram</div>

      <div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap;">
        ${(Object.keys(TAB_LABELS) as QrTab[]).map(
          (tab) => html`
            <button
              class="btn btn--sm ${qrActiveTab === tab ? "primary" : ""}"
              @click=${() => onQrTabChange(tab)}
            >
              ${TAB_LABELS[tab]}
            </button>
          `,
        )}
      </div>

      <div style="margin-top:16px;">
        ${qrActiveTab === "zalo"
          ? renderZaloPersonalTab(props, zaloPersonal)
          : qrActiveTab === "zalo-oa"
            ? renderZaloOaTab(props, zaloOa)
            : qrActiveTab === "whatsapp"
              ? renderWhatsAppTab(props)
              : renderTelegramTab(props, telegram)}
      </div>
    </div>

    <style>
      .qrscan-status-row {
        display: flex;
        align-items: center;
        font-size: 14px;
        padding: 4px 0;
      }
      .qrscan-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
    </style>
  `;
}
