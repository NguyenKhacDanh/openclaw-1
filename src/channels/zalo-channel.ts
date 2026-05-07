/**
 * Zalo channel — supports two modes:
 *   - "personal": QR-based login using the unofficial Zalo protocol (similar to WhatsApp-go)
 *   - "oa": Official Account webhook (Zalo OA Dashboard → configure webhook URL)
 *
 * Environment variables:
 *   ZALO_BOT_TOKEN       — cookie/session token for personal mode
 *   ZALO_OA_ACCESS_TOKEN — OA access token for official-account mode
 *   ZALO_OA_WEBHOOK_SECRET — webhook secret for OA mode verification
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { ZaloConfig } from "../config/types.zalo.js";

const logger = createSubsystemLogger("zalo-channel");

export type ZaloChannelStatus = {
  configured: boolean;
  linked: boolean;
  running: boolean;
  connected: boolean;
  botMode: "personal" | "oa" | null;
  phone: string | null;
  displayName: string | null;
  oaId: string | null;
  oaName: string | null;
  lastConnectedAt: number | null;
  lastMessageAt: number | null;
  authAgeMs: number | null;
  lastError: string | null;
};

export type ZaloQrResult = {
  qrDataUrl: string;
  expiresAt: number;
};

export class ZaloChannel {
  private _status: ZaloChannelStatus;
  private _config: ZaloConfig;
  private _loginStartedAt: number | null = null;

  constructor(config: ZaloConfig) {
    this._config = config;
    this._status = {
      configured: this._isConfigured(config),
      linked: false,
      running: false,
      connected: false,
      botMode: config.botMode ?? null,
      phone: null,
      displayName: null,
      oaId: config.oaId ?? null,
      oaName: null,
      lastConnectedAt: null,
      lastMessageAt: null,
      authAgeMs: null,
      lastError: null,
    };
  }

  get status(): ZaloChannelStatus {
    return { ...this._status };
  }

  private _isConfigured(config: ZaloConfig): boolean {
    if (!config.enabled) return false;
    if (config.botMode === "oa") {
      return Boolean(config.oaAccessToken || process.env.ZALO_OA_ACCESS_TOKEN);
    }
    return Boolean(config.botToken || process.env.ZALO_BOT_TOKEN);
  }

  async start(): Promise<void> {
    logger.info("Starting Zalo channel (mode=%s)", this._config.botMode ?? "personal");
    this._status.running = true;
    this._status.lastError = null;

    if (this._config.botMode === "oa") {
      await this._startOaMode();
    } else {
      await this._startPersonalMode();
    }
  }

  async stop(): Promise<void> {
    this._status.running = false;
    this._status.connected = false;
    this._status.linked = false;
    logger.info("Zalo channel stopped");
  }

  async generateQr(): Promise<ZaloQrResult> {
    if (this._config.botMode === "oa") {
      throw new Error("QR scan is only available in personal mode. Use OA webhook for OA mode.");
    }
    this._loginStartedAt = Date.now();
    logger.info("Generating Zalo personal account QR code");
    // Placeholder: in production, integrate with zalo-api-js or similar library
    // that generates a QR code image for scanning with Zalo app
    const placeholderQrDataUrl =
      "data:image/svg+xml;base64," +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">` +
          `<rect width="200" height="200" fill="white"/>` +
          `<text x="100" y="90" text-anchor="middle" font-size="14" fill="#333">Zalo QR</text>` +
          `<text x="100" y="115" text-anchor="middle" font-size="11" fill="#666">(Integration pending)</text>` +
          `</svg>`,
      ).toString("base64");
    return {
      qrDataUrl: placeholderQrDataUrl,
      expiresAt: Date.now() + 60 * 1000,
    };
  }

  async logout(): Promise<void> {
    this._status.linked = false;
    this._status.connected = false;
    this._status.phone = null;
    this._status.displayName = null;
    logger.info("Zalo account logged out");
  }

  private async _startPersonalMode(): Promise<void> {
    const token = this._config.botToken ?? process.env.ZALO_BOT_TOKEN;
    if (!token) {
      this._status.lastError = "No Zalo bot token configured. Use QR scan to link account.";
      return;
    }
    // TODO: connect using token/cookie
    this._status.linked = true;
    this._status.connected = true;
    this._status.lastConnectedAt = Date.now();
    logger.info("Zalo personal account connected");
  }

  private async _startOaMode(): Promise<void> {
    const oaToken =
      this._config.oaAccessToken ?? process.env.ZALO_OA_ACCESS_TOKEN;
    if (!oaToken) {
      this._status.lastError = "No Zalo OA access token configured.";
      return;
    }
    this._status.oaId = this._config.oaId ?? null;
    this._status.connected = true;
    this._status.lastConnectedAt = Date.now();
    logger.info("Zalo OA mode ready (oaId=%s)", this._status.oaId);
  }
}
