export type FacebookConfig = {
  enabled?: boolean;
  /** Facebook Page ID */
  pageId?: string;
  /** Page Access Token — resolved from env FACEBOOK_PAGE_ACCESS_TOKEN or secretRef */
  pageAccessToken?: string;
  /** App ID for token refresh */
  appId?: string;
  /** App Secret for token refresh — env FACEBOOK_APP_SECRET */
  appSecret?: string;
  /** Whether to also post to linked Instagram account */
  postToInstagram?: boolean;
  /** Default audience for posts: "EVERYONE" | "FRIENDS" | "ONLY_ME" */
  defaultAudience?: "EVERYONE" | "FRIENDS" | "ONLY_ME";
};

export type FacebookAccountConfig = {
  accountId: string;
  facebook?: FacebookConfig;
};
