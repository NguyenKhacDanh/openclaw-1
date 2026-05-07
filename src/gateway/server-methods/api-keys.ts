import {
  addApiKey,
  loadApiKeyPriorityStore,
  maskKeyRef,
  removeApiKey,
  reorderApiKeys,
  updateApiKey,
  saveApiKeyPriorityStore,
  type StoredApiKeyEntry,
} from "../../agents/api-key-priority-store.js";
import { resolveUserPath } from "../../utils.js";
import type { GatewayRequestHandlers } from "./types.js";

function getStateDir(): string {
  return resolveUserPath("~/.openclaw");
}

function toPublicEntry(entry: StoredApiKeyEntry) {
  return {
    id: entry.id,
    provider: entry.provider,
    alias: entry.alias,
    priority: entry.priority,
    maskedValue: maskKeyRef(entry.keyRef),
    models: entry.models,
    active: entry.active,
    status: entry.status ?? null,
    lastUsedAt: entry.lastUsedAt ?? null,
    errorCount: entry.errorCount,
  };
}

export const apiKeyHandlers: GatewayRequestHandlers = {
  "apikeys.list": async ({ respond }) => {
    const stateDir = getStateDir();
    const entries = await loadApiKeyPriorityStore(stateDir);
    respond(true, { keys: entries.map(toPublicEntry) }, undefined);
  },

  "apikeys.add": async ({ params, respond }) => {
    const { provider, alias, keyValue, models } = params as {
      provider: string;
      alias: string;
      keyValue: string;
      models?: string[];
    };
    if (!provider || !alias || !keyValue) {
      respond(false, undefined, { message: "provider, alias and keyValue are required" });
      return;
    }
    const stateDir = getStateDir();
    let entries = await loadApiKeyPriorityStore(stateDir);
    entries = addApiKey(entries, { provider, alias, keyRef: keyValue, models });
    await saveApiKeyPriorityStore(stateDir, entries);
    respond(true, { ok: true, keys: entries.map(toPublicEntry) }, undefined);
  },

  "apikeys.delete": async ({ params, respond }) => {
    const { id } = params as { id: string };
    if (!id) {
      respond(false, undefined, { message: "id is required" });
      return;
    }
    const stateDir = getStateDir();
    let entries = await loadApiKeyPriorityStore(stateDir);
    entries = removeApiKey(entries, id);
    await saveApiKeyPriorityStore(stateDir, entries);
    respond(true, { ok: true, keys: entries.map(toPublicEntry) }, undefined);
  },

  "apikeys.update": async ({ params, respond }) => {
    const { id, alias, keyValue, models } = params as {
      id: string;
      alias?: string;
      keyValue?: string;
      models?: string[];
    };
    if (!id) {
      respond(false, undefined, { message: "id is required" });
      return;
    }
    const stateDir = getStateDir();
    let entries = await loadApiKeyPriorityStore(stateDir);
    entries = updateApiKey(entries, id, {
      alias,
      keyRef: keyValue || undefined,
      models,
    });
    await saveApiKeyPriorityStore(stateDir, entries);
    respond(true, { ok: true, keys: entries.map(toPublicEntry) }, undefined);
  },

  "apikeys.reorder": async ({ params, respond }) => {
    const { orderedIds } = params as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) {
      respond(false, undefined, { message: "orderedIds must be an array" });
      return;
    }
    const stateDir = getStateDir();
    let entries = await loadApiKeyPriorityStore(stateDir);
    entries = reorderApiKeys(entries, orderedIds);
    await saveApiKeyPriorityStore(stateDir, entries);
    respond(true, { ok: true, keys: entries.map(toPublicEntry) }, undefined);
  },
};
