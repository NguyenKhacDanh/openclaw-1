import type { DmPolicy, GroupPolicy } from "./types.base.js";

export type ZaloBotMode = "personal" | "oa";

export type ZaloConfig = {
  enabled?: boolean;
  botMode?: ZaloBotMode;
  /** OA (Official Account) ID — only used when botMode = "oa" */
  oaId?: string;
  /** OA access token / secret — resolved from env ZALO_OA_ACCESS_TOKEN or secretRef */
  oaAccessToken?: string;
  /** OA webhook secret for verifying incoming events */
  oaWebhookSecret?: string;
  /** Personal account cookie/token — resolved from env ZALO_BOT_TOKEN or secretRef */
  botToken?: string;
  dmPolicy?: DmPolicy;
  groupPolicy?: GroupPolicy;
  /** Session reconnect delay in ms (default 5000) */
  reconnectDelayMs?: number;
  /** Max consecutive reconnect attempts before giving up */
  maxReconnectAttempts?: number;
};

export type ZaloAccountConfig = {
  accountId: string;
  zalo?: ZaloConfig;
};
