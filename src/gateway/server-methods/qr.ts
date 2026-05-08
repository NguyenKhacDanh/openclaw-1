import { listChannelPlugins } from "../../channels/plugins/index.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

function resolveZalouserPlugin() {
  return listChannelPlugins().find((p) => p.id === "zalouser") ?? null;
}

export const qrHandlers: GatewayRequestHandlers = {
  "qr.zalouser.start": async ({ params, respond, context }) => {
    const plugin = resolveZalouserPlugin();
    if (!plugin?.gateway?.loginWithQrStart) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "zalouser plugin not available"));
      return;
    }
    const force = Boolean((params as { force?: boolean }).force);
    try {
      if (!force) {
        // Quick status check without stopping the running channel
        const quickResult = await plugin.gateway.loginWithQrStart({
          force: false,
          timeoutMs: 35000,
          verbose: false,
          accountId: undefined,
        });
        if (quickResult.connected) {
          // Already linked — ensure channel is running without disrupting it
          await context.startChannel("zalouser" as import("../../channels/plugins/types.public.js").ChannelId);
          respond(true, quickResult);
          return;
        }
      }
      // Not connected or force=true: stop channel then do full QR flow
      await context.stopChannel("zalouser" as import("../../channels/plugins/types.public.js").ChannelId);
      const result = await plugin.gateway.loginWithQrStart({
        force,
        timeoutMs: 35000,
        verbose: false,
        accountId: undefined,
      });
      if (result.connected) {
        await context.startChannel("zalouser" as import("../../channels/plugins/types.public.js").ChannelId);
      }
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
    }
  },

  "qr.zalouser.wait": async ({ params, respond, context }) => {
    const plugin = resolveZalouserPlugin();
    if (!plugin?.gateway?.loginWithQrWait) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "zalouser plugin not available"));
      return;
    }
    try {
      const result = await plugin.gateway.loginWithQrWait({
        timeoutMs:
          typeof (params as { timeoutMs?: unknown }).timeoutMs === "number"
            ? (params as { timeoutMs?: number }).timeoutMs
            : 120000,
        accountId: undefined,
        currentQrDataUrl:
          typeof (params as { currentQrDataUrl?: unknown }).currentQrDataUrl === "string"
            ? (params as { currentQrDataUrl?: string }).currentQrDataUrl
            : undefined,
      });
      if (result.connected) {
        await context.startChannel("zalouser" as import("../../channels/plugins/types.public.js").ChannelId);
      }
      respond(true, result);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
    }
  },

  "qr.zalouser.logout": async ({ respond, context }) => {
    try {
      await context.stopChannel("zalouser" as import("../../channels/plugins/types.public.js").ChannelId);
      await context.markChannelLoggedOut("zalouser" as import("../../channels/plugins/types.public.js").ChannelId, true);
      respond(true, { ok: true });
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
    }
  },
};
