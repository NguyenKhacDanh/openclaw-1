/**
 * Facebook Page channel — post content, schedule posts, manage Facebook Page.
 *
 * Environment variables:
 *   FACEBOOK_PAGE_ACCESS_TOKEN — Page Access Token from Meta Developer Console
 *   FACEBOOK_APP_ID            — App ID for token management
 *   FACEBOOK_APP_SECRET        — App Secret for long-lived token exchange
 *
 * Setup:
 *   1. Create a Meta app at developers.facebook.com
 *   2. Add Facebook Login + Pages API permissions (pages_manage_posts, pages_read_engagement)
 *   3. Generate a Page Access Token and add to env or config
 */

import https from "node:https";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { FacebookConfig } from "../config/types.facebook.js";

const logger = createSubsystemLogger("facebook-channel");

const GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

export type FacebookPageStatus = {
  configured: boolean;
  running: boolean;
  pageId: string | null;
  pageName: string | null;
  tokenSource: string | null;
  tokenExpiresAt: number | null;
  lastPostAt: number | null;
  instagramLinked: boolean | null;
  lastError: string | null;
};

export type FacebookPostResult = {
  postId: string;
  url: string;
};

export class FacebookPageChannel {
  private _config: FacebookConfig;
  private _status: FacebookPageStatus;
  private _token: string | null = null;

  constructor(config: FacebookConfig) {
    this._config = config;
    this._token = config.pageAccessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? null;
    this._status = {
      configured: this._isConfigured(config),
      running: false,
      pageId: config.pageId ?? null,
      pageName: null,
      tokenSource: this._token
        ? config.pageAccessToken
          ? "config"
          : "env"
        : null,
      tokenExpiresAt: null,
      lastPostAt: null,
      instagramLinked: null,
      lastError: null,
    };
  }

  get status(): FacebookPageStatus {
    return { ...this._status };
  }

  private _isConfigured(config: FacebookConfig): boolean {
    return Boolean(
      config.enabled &&
        config.pageId &&
        (config.pageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
    );
  }

  async start(): Promise<void> {
    logger.info("Starting Facebook Page channel (pageId=%s)", this._config.pageId);
    if (!this._status.configured) {
      this._status.lastError = "Facebook channel not configured. Set pageId and pageAccessToken.";
      return;
    }
    this._status.running = true;
    await this._probePageInfo();
  }

  async stop(): Promise<void> {
    this._status.running = false;
    logger.info("Facebook Page channel stopped");
  }

  async post(message: string, options?: { scheduleAt?: number }): Promise<FacebookPostResult> {
    if (!this._token || !this._status.pageId) {
      throw new Error("Facebook channel not configured or not running.");
    }
    const endpoint = `${GRAPH_API_BASE}/${this._status.pageId}/feed`;
    const body: Record<string, unknown> = {
      message,
      access_token: this._token,
    };
    if (options?.scheduleAt) {
      body.scheduled_publish_time = Math.floor(options.scheduleAt / 1000);
      body.published = false;
    }
    const result = await this._graphPost<{ id: string }>(endpoint, body);
    this._status.lastPostAt = Date.now();
    const postId = result.id;
    const url = `https://www.facebook.com/${postId.replace("_", "/posts/")}`;
    logger.info("Posted to Facebook Page (postId=%s)", postId);
    return { postId, url };
  }

  async refreshToken(): Promise<void> {
    const appId = this._config.appId ?? process.env.FACEBOOK_APP_ID;
    const appSecret = this._config.appSecret ?? process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret || !this._token) {
      throw new Error("Cannot refresh token: appId, appSecret, and current token are required.");
    }
    const url =
      `${GRAPH_API_BASE}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(this._token)}`;
    const result = await this._graphGet<{ access_token: string; expires_in?: number }>(url);
    this._token = result.access_token;
    if (result.expires_in) {
      this._status.tokenExpiresAt = Date.now() + result.expires_in * 1000;
    }
    logger.info("Facebook Page token refreshed");
  }

  private async _probePageInfo(): Promise<void> {
    if (!this._token || !this._status.pageId) return;
    try {
      const url =
        `${GRAPH_API_BASE}/${this._status.pageId}` +
        `?fields=name,connected_instagram_account` +
        `&access_token=${encodeURIComponent(this._token)}`;
      const data = await this._graphGet<{
        name?: string;
        connected_instagram_account?: { id: string };
      }>(url);
      this._status.pageName = data.name ?? null;
      this._status.instagramLinked = Boolean(data.connected_instagram_account);
      this._status.lastError = null;
    } catch (err: unknown) {
      this._status.lastError = String(err instanceof Error ? err.message : err);
      logger.error("Failed to probe Facebook page info: %s", this._status.lastError);
    }
  }

  private _graphGet<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data) as { error?: { message: string } } & T;
              if ("error" in parsed && parsed.error) {
                reject(new Error(parsed.error.message));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`Invalid JSON from Facebook API: ${data.slice(0, 100)}`));
            }
          });
        })
        .on("error", reject);
    });
  }

  private _graphPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = new URLSearchParams(
        Object.entries(body).map(([k, v]) => [k, String(v)]),
      ).toString();
      const req = https.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data) as { error?: { message: string } } & T;
              if ("error" in parsed && parsed.error) {
                reject(new Error(parsed.error.message));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`Invalid JSON: ${data.slice(0, 100)}`));
            }
          });
        },
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }
}
