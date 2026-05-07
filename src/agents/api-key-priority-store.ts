import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredApiKeyEntry = {
  id: string;
  provider: string;
  alias: string;
  priority: number;
  /** Encrypted/env-referenced key value — stored as env var name or direct (if short-lived) */
  keyRef: string;
  /** Models this key is authorized to use. Empty = all models for provider. */
  models: string[];
  active: boolean;
  createdAt: number;
  lastUsedAt?: number | null;
  errorCount: number;
  status?: "ok" | "rate_limited" | "expired" | "error" | null;
};

const STORE_FILENAME = "api-key-priority.json";

function getStorePath(stateDir: string): string {
  return path.join(stateDir, STORE_FILENAME);
}

export async function loadApiKeyPriorityStore(stateDir: string): Promise<StoredApiKeyEntry[]> {
  const storePath = getStorePath(stateDir);
  try {
    const raw = await fs.readFile(storePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

export async function saveApiKeyPriorityStore(
  stateDir: string,
  entries: StoredApiKeyEntry[],
): Promise<void> {
  const storePath = getStorePath(stateDir);
  await fs.mkdir(stateDir, { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(entries, null, 2), "utf-8");
}

export function addApiKey(
  entries: StoredApiKeyEntry[],
  params: {
    provider: string;
    alias: string;
    keyRef: string;
    models?: string[];
  },
): StoredApiKeyEntry[] {
  const maxPriority = entries.reduce((max, e) => Math.max(max, e.priority), 0);
  const newEntry: StoredApiKeyEntry = {
    id: randomUUID(),
    provider: params.provider,
    alias: params.alias,
    priority: maxPriority + 1,
    keyRef: params.keyRef,
    models: params.models ?? [],
    active: false,
    createdAt: Date.now(),
    errorCount: 0,
    status: null,
  };
  return [...entries, newEntry];
}

export function removeApiKey(entries: StoredApiKeyEntry[], id: string): StoredApiKeyEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function reorderApiKeys(
  entries: StoredApiKeyEntry[],
  orderedIds: string[],
): StoredApiKeyEntry[] {
  return entries.map((entry) => {
    const newPriority = orderedIds.indexOf(entry.id);
    return newPriority >= 0 ? { ...entry, priority: newPriority + 1 } : entry;
  });
}

export function updateApiKey(
  entries: StoredApiKeyEntry[],
  id: string,
  updates: { alias?: string; keyRef?: string; models?: string[] },
): StoredApiKeyEntry[] {
  return entries.map((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      ...(updates.alias != null ? { alias: updates.alias } : {}),
      ...(updates.keyRef != null ? { keyRef: updates.keyRef } : {}),
      ...(updates.models != null ? { models: updates.models } : {}),
    };
  });
}

export function markApiKeyUsed(
  entries: StoredApiKeyEntry[],
  id: string,
  status: StoredApiKeyEntry["status"],
): StoredApiKeyEntry[] {
  return entries.map((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      active: status === "ok",
      status,
      lastUsedAt: Date.now(),
      errorCount: status === "ok" ? 0 : e.errorCount + 1,
    };
  });
}

export function maskKeyRef(keyRef: string): string {
  if (!keyRef) return "***";
  if (keyRef.startsWith("$") || keyRef.startsWith("env:")) return keyRef;
  if (keyRef.length <= 8) return "***";
  return `${keyRef.slice(0, 4)}...${keyRef.slice(-4)}`;
}

function isValidEntry(entry: unknown): entry is StoredApiKeyEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.provider === "string" &&
    typeof e.alias === "string" &&
    typeof e.priority === "number"
  );
}
