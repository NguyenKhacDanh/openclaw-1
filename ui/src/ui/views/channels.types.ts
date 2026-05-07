import type {
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  ConfigUiHints,
  DiscordStatus,
  FacebookPageStatus,
  GoogleChatStatus,
  IMessageStatus,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
  ZaloStatus,
} from "../types.ts";
import type { NostrProfileFormState } from "./channels.nostr-profile-form.ts";

export type ChannelKey = string;

export type ChannelsProps = {
  connected: boolean;
  loading: boolean;
  snapshot: ChannelsStatusSnapshot | null;
  lastError: string | null;
  lastSuccessAt: number | null;
  // WhatsApp
  whatsappMessage: string | null;
  whatsappQrDataUrl: string | null;
  whatsappConnected: boolean | null;
  whatsappBusy: boolean;
  // QR scan panel
  qrActiveTab: "zalo" | "zalo-oa" | "whatsapp" | "telegram";
  onQrTabChange: (tab: "zalo" | "zalo-oa" | "whatsapp" | "telegram") => void;
  zaloTokenInput: string;
  zaloOaTokenInput: string;
  zaloOaIdInput: string;
  zaloOaWebhookUrl?: string;
  telegramTokenInput: string;
  onZaloTokenInput: (v: string) => void;
  onZaloOaTokenInput: (v: string) => void;
  onZaloOaIdInput: (v: string) => void;
  onZaloOaSave: () => void;
  onTelegramTokenInput: (v: string) => void;
  onTelegramTokenSave: () => void;
  // Zalo
  zaloMessage: string | null;
  zaloQrDataUrl: string | null;
  zaloConnected: boolean | null;
  zaloBusy: boolean;
  // Facebook Page
  facebookPostDraft: string | null;
  facebookBusy: boolean;
  // Config
  configSchema: unknown;
  configSchemaLoading: boolean;
  configForm: Record<string, unknown> | null;
  configUiHints: ConfigUiHints;
  configSaving: boolean;
  configFormDirty: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  // Handlers
  onRefresh: (probe: boolean) => void;
  onWhatsAppStart: (force: boolean) => void;
  onWhatsAppWait: () => void;
  onWhatsAppLogout: () => void;
  onZaloStart: (force: boolean) => void;
  onZaloTokenSave: () => void;
  onZaloWait: () => void;
  onZaloLogout: () => void;
  onZaloSetMode: (mode: "personal" | "oa") => void;
  onFacebookPost: () => void;
  onFacebookSchedulePost: () => void;
  onFacebookPostDraftChange: (draft: string | null) => void;
  onFacebookRefreshToken: () => void;
  onConfigPatch: (path: Array<string | number>, value: unknown) => void;
  onConfigSave: () => void;
  onConfigReload: () => void;
  onNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  onNostrProfileCancel: () => void;
  onNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  onNostrProfileSave: () => void;
  onNostrProfileImport: () => void;
  onNostrProfileToggleAdvanced: () => void;
};

export type ChannelsChannelData = {
  whatsapp?: WhatsAppStatus;
  telegram?: TelegramStatus;
  discord?: DiscordStatus | null;
  googlechat?: GoogleChatStatus | null;
  slack?: SlackStatus | null;
  signal?: SignalStatus | null;
  imessage?: IMessageStatus | null;
  nostr?: NostrStatus | null;
  zalo?: ZaloStatus | null;
  zalouser?: ZaloStatus | null;
  facebook?: FacebookPageStatus | null;
  channelAccounts?: Record<string, ChannelAccountSnapshot[]> | null;
};
