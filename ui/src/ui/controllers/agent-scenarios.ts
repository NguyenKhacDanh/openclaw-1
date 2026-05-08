import type { GatewayBrowserClient } from "../gateway.ts";

export type ScenarioEntry = { name: string; size?: number; updatedAtMs?: number };

export type AgentScenariosState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  agentScenarioLoading: boolean;
  agentScenarioError: string | null;
  agentScenarioList: ScenarioEntry[] | null;
  agentScenarioListAgentId: string | null;
  agentScenarioContents: Record<string, string>;
  agentScenarioDrafts: Record<string, string>;
  agentScenarioActive: string | null;
  agentScenarioSaving: boolean;
};

const INDEX_FILE = "_index.txt";

function buildIndexLine(name: string, content: string): string {
  const summary = content.replace(/\s+/g, " ").trim().slice(0, 120);
  return `${name}: ${summary}`;
}

function updateIndexContent(existing: string, name: string, content: string): string {
  const lines = existing ? existing.split("\n").filter(Boolean) : [];
  const prefix = `${name}: `;
  const filtered = lines.filter((l) => !l.startsWith(prefix));
  filtered.push(buildIndexLine(name, content));
  filtered.sort();
  return filtered.join("\n") + "\n";
}

function removeFromIndexContent(existing: string, name: string): string {
  const prefix = `${name}: `;
  const lines = existing ? existing.split("\n").filter((l) => Boolean(l) && !l.startsWith(prefix)) : [];
  return lines.length > 0 ? lines.join("\n") + "\n" : "";
}

export async function loadAgentScenarios(state: AgentScenariosState, agentId: string) {
  if (!state.client || !state.connected || state.agentScenarioLoading) {
    return;
  }
  state.agentScenarioLoading = true;
  state.agentScenarioError = null;
  try {
    const res = await state.client.request<{ agentId: string; files: ScenarioEntry[] } | null>(
      "agents.scenario.list",
      { agentId },
    );
    if (res) {
      state.agentScenarioList = res.files;
      state.agentScenarioListAgentId = agentId;
      if (
        state.agentScenarioActive &&
        !res.files.some((f) => f.name === state.agentScenarioActive)
      ) {
        state.agentScenarioActive = null;
      }
    }
  } catch (err) {
    state.agentScenarioError = String(err);
  } finally {
    state.agentScenarioLoading = false;
  }
}

export async function loadAgentScenarioContent(
  state: AgentScenariosState,
  agentId: string,
  name: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (Object.hasOwn(state.agentScenarioContents, name)) {
    return;
  }
  try {
    const res = await state.client.request<{ agentId: string; name: string; content: string } | null>(
      "agents.scenario.get",
      { agentId, name },
    );
    if (res) {
      state.agentScenarioContents = { ...state.agentScenarioContents, [name]: res.content };
      state.agentScenarioDrafts = { ...state.agentScenarioDrafts, [name]: res.content };
    }
  } catch {
    // file may not exist yet
  }
}

export async function saveAgentScenario(
  state: AgentScenariosState,
  agentId: string,
  name: string,
  content: string,
) {
  if (!state.client || !state.connected || state.agentScenarioSaving) {
    return;
  }
  state.agentScenarioSaving = true;
  state.agentScenarioError = null;
  try {
    await state.client.request("agents.scenario.set", { agentId, name, content });
    state.agentScenarioContents = { ...state.agentScenarioContents, [name]: content };
    state.agentScenarioDrafts = { ...state.agentScenarioDrafts, [name]: content };
    await loadAgentScenarios(state, agentId);
  } catch (err) {
    state.agentScenarioError = String(err);
  } finally {
    state.agentScenarioSaving = false;
  }
}

export async function importAgentScenario(
  state: AgentScenariosState,
  agentId: string,
  name: string,
  content: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    await state.client.request("agents.scenario.set", { agentId, name, content });
    state.agentScenarioContents = { ...state.agentScenarioContents, [name]: content };
    state.agentScenarioDrafts = { ...state.agentScenarioDrafts, [name]: content };

    // Update master index file
    let existingIndex = "";
    try {
      const indexRes = await state.client.request<{ content: string } | null>(
        "agents.scenario.get",
        { agentId, name: INDEX_FILE },
      );
      existingIndex = indexRes?.content ?? "";
    } catch {
      // index doesn't exist yet
    }
    const newIndex = updateIndexContent(existingIndex, name, content);
    await state.client.request("agents.scenario.set", {
      agentId,
      name: INDEX_FILE,
      content: newIndex,
    });

    await loadAgentScenarios(state, agentId);
  } catch (err) {
    state.agentScenarioError = String(err);
  }
}

export async function deleteAgentScenario(
  state: AgentScenariosState,
  agentId: string,
  name: string,
) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    await state.client.request("agents.scenario.delete", { agentId, name });
    const { [name]: _removed, ...restContents } = state.agentScenarioContents;
    const { [name]: _removedDraft, ...restDrafts } = state.agentScenarioDrafts;
    state.agentScenarioContents = restContents;
    state.agentScenarioDrafts = restDrafts;
    if (state.agentScenarioActive === name) {
      state.agentScenarioActive = null;
    }

    // Remove from index
    if (name !== INDEX_FILE) {
      try {
        const indexRes = await state.client.request<{ content: string } | null>(
          "agents.scenario.get",
          { agentId, name: INDEX_FILE },
        );
        const existingIndex = indexRes?.content ?? "";
        if (existingIndex) {
          const newIndex = removeFromIndexContent(existingIndex, name);
          await state.client.request("agents.scenario.set", {
            agentId,
            name: INDEX_FILE,
            content: newIndex,
          });
        }
      } catch {
        // index missing, nothing to update
      }
    }

    await loadAgentScenarios(state, agentId);
  } catch (err) {
    state.agentScenarioError = String(err);
  }
}
