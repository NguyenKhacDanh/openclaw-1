import fs from "node:fs";
import path from "node:path";
import type { PluginManifestRecord } from "../plugins/manifest-registry.js";

type RawEntry = Record<string, unknown>;

function readStoreEntriesSync(stateDir: string): Array<{ provider: string; keyRef: string; priority: number }> {
  const storePath = path.join(stateDir, "api-key-priority.json");
  try {
    const raw = fs.readFileSync(storePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const result: Array<{ provider: string; keyRef: string; priority: number }> = [];
    for (const entry of parsed as RawEntry[]) {
      if (
        entry &&
        typeof entry.provider === "string" &&
        typeof entry.keyRef === "string" &&
        entry.keyRef.length > 0 &&
        !entry.keyRef.startsWith("$") &&
        !entry.keyRef.startsWith("env:")
      ) {
        result.push({
          provider: entry.provider,
          keyRef: entry.keyRef,
          priority: typeof entry.priority === "number" ? entry.priority : 0,
        });
      }
    }
    // Sort by priority ascending so highest-priority (lowest number) wins
    result.sort((a, b) => a.priority - b.priority);
    return result;
  } catch {
    return [];
  }
}

function buildProviderEnvVarMap(plugins: readonly PluginManifestRecord[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const plugin of plugins) {
    if (plugin.providerAuthEnvVars) {
      for (const [provider, envVars] of Object.entries(plugin.providerAuthEnvVars)) {
        if (!map.has(provider)) map.set(provider, []);
        const list = map.get(provider)!;
        for (const envVar of envVars) {
          if (!list.includes(envVar)) list.push(envVar);
        }
      }
    }
    if (plugin.setup?.providers) {
      for (const p of plugin.setup.providers) {
        if (p.id && p.envVars?.length) {
          if (!map.has(p.id)) map.set(p.id, []);
          const list = map.get(p.id)!;
          for (const envVar of p.envVars) {
            if (!list.includes(envVar)) list.push(envVar);
          }
        }
      }
    }
  }
  return map;
}

/**
 * Injects API keys from the UI priority store (~/.openclaw/api-key-priority.json)
 * into process.env so extension plugins can authenticate without needing .env entries.
 * Only sets env vars that are not already present.
 */
export function injectStoreKeysToEnv(params: {
  stateDir: string;
  plugins: readonly PluginManifestRecord[];
  env?: NodeJS.ProcessEnv;
  log?: (msg: string) => void;
}): void {
  const env = params.env ?? process.env;
  const entries = readStoreEntriesSync(params.stateDir);
  if (entries.length === 0) return;

  const providerEnvVarMap = buildProviderEnvVarMap(params.plugins);
  for (const entry of entries) {
    const envVars = providerEnvVarMap.get(entry.provider);
    if (!envVars) continue;
    for (const envVar of envVars) {
      if (!env[envVar]) {
        env[envVar] = entry.keyRef;
        params.log?.(`inject-store-keys: set ${envVar} for provider ${entry.provider}`);
      }
    }
  }
}
