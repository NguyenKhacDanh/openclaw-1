import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import type { ModelCatalogEntry } from "../types.ts";

export type ApiKeyEntry = {
  id: string;
  provider: string;
  alias: string;
  priority: number;
  maskedValue?: string | null;
  active?: boolean;
  models?: string[];
  lastUsedAt?: number | null;
  errorCount?: number;
  status?: "ok" | "rate_limited" | "expired" | "error" | null;
};

export type ApiKeyPriorityProps = {
  keys: ApiKeyEntry[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  // Add form
  addingKey: boolean;
  newKeyProvider: string;
  newKeyAlias: string;
  newKeyValue: string;
  newKeyModels: string[];
  // Edit form
  editingId: string | null;
  editAlias: string;
  editKeyValue: string;
  editModels: string[];
  modelCatalog: ModelCatalogEntry[];
  // Add handlers
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onNewKeyProviderChange: (provider: string) => void;
  onNewKeyAliasChange: (alias: string) => void;
  onNewKeyValueChange: (value: string) => void;
  onNewKeyModelsChange: (models: string[]) => void;
  onConfirmAdd: () => void;
  // Edit handlers
  onStartEdit: (key: ApiKeyEntry) => void;
  onCancelEdit: () => void;
  onEditAliasChange: (alias: string) => void;
  onEditKeyValueChange: (value: string) => void;
  onEditModelsChange: (models: string[]) => void;
  onConfirmEdit: () => void;
  // List handlers
  onDelete: (id: string) => void;
  onDragReorder: (orderedIds: string[]) => void;
};

const KNOWN_PROVIDERS = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai", label: "OpenAI (GPT)" },
  { id: "google", label: "Google (Gemini)" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "mistral", label: "Mistral" },
  { id: "groq", label: "Groq" },
  { id: "cohere", label: "Cohere" },
  { id: "azure", label: "Azure OpenAI" },
  { id: "zai", label: "ZAI" },
  { id: "lkeap", label: "LKEAP" },
  { id: "minimax", label: "MiniMax" },
  { id: "synthetic", label: "Synthetic" },
];

const STATUS_COLORS: Record<string, string> = {
  ok: "var(--color-success, #16a34a)",
  rate_limited: "var(--color-warn, #d97706)",
  expired: "var(--color-danger, #dc2626)",
  error: "var(--color-danger, #dc2626)",
};

const STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  rate_limited: "Rate limited",
  expired: "Expired",
  error: "Error",
};

function renderStatusDot(status?: string | null) {
  if (!status) return nothing;
  const color = STATUS_COLORS[status] ?? "var(--muted)";
  const label = STATUS_LABELS[status] ?? status;
  return html`
    <span
      title=${label}
      style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${color}; flex-shrink: 0;"
    ></span>
  `;
}

function getModelsForProvider(provider: string, catalog: ModelCatalogEntry[]): ModelCatalogEntry[] {
  return catalog.filter((m) => m.provider === provider || provider === "");
}

// Module-level drag state — safe because only one drag can happen at a time
let _dragSrcId = "";
let _dragOverId = "";

function renderModelPicker(
  selectedModels: string[],
  provider: string,
  catalog: ModelCatalogEntry[],
  onChange: (models: string[]) => void,
) {
  const providerModels = getModelsForProvider(provider, catalog);
  if (!provider) return nothing;
  return html`
    <div class="field">
      <span class="label">${t("apiKeys.modelSelection")}</span>
      <div class="card-sub" style="margin-bottom: 8px;">${t("apiKeys.modelSelectionHint")}</div>
      ${providerModels.length === 0
        ? html`
            <input
              type="text"
              class="input"
              placeholder="e.g. claude-3-5-sonnet-20241022, claude-3-haiku-20240307"
              .value=${selectedModels.join(", ")}
              @input=${(e: Event) => {
                const val = (e.target as HTMLInputElement).value;
                onChange(val.split(",").map((s) => s.trim()).filter(Boolean));
              }}
            />
          `
        : html`
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 8px;">
              ${providerModels.map(
                (m) => html`
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                    <input
                      type="checkbox"
                      .checked=${selectedModels.includes(m.id)}
                      @change=${(e: Event) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        const next = checked
                          ? [...selectedModels, m.id]
                          : selectedModels.filter((id) => id !== m.id);
                        onChange(next);
                      }}
                    />
                    <span>${m.name || m.id}</span>
                    ${m.contextWindow
                      ? html`<span class="muted" style="font-size: 11px;">${(m.contextWindow / 1000).toFixed(0)}K ctx</span>`
                      : nothing}
                  </label>
                `,
              )}
            </div>
          `}
    </div>
  `;
}

export function renderApiKeyPriority(props: ApiKeyPriorityProps) {
  const sorted = [...props.keys].sort((a, b) => a.priority - b.priority);

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("apiKeys.title")}</div>
          <div class="card-sub">${t("apiKeys.subtitle")}</div>
        </div>
        <button
          class="btn btn--sm"
          ?disabled=${props.loading || props.addingKey}
          @click=${() => props.onStartAdd()}
        >
          ${t("apiKeys.addKey")}
        </button>
      </div>

      ${props.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${props.error}</div>`
        : nothing}

      <!-- ADD KEY FORM -->
      ${props.addingKey
        ? html`
            <div class="card" style="margin-top: 14px; border: 1px solid var(--border); padding: 16px; border-radius: 8px;">
              <div class="card-title" style="font-size: 14px; margin-bottom: 12px;">${t("apiKeys.addKey")}</div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <label class="field">
                  <span>${t("apiKeys.providerLabel")}</span>
                  <select
                    @change=${(e: Event) => props.onNewKeyProviderChange((e.target as HTMLSelectElement).value)}
                    style="width: 100%;"
                  >
                    <option value="">-- ${t("apiKeys.selectProvider")} --</option>
                    ${KNOWN_PROVIDERS.map(
                      (p) => html`<option value=${p.id} ?selected=${props.newKeyProvider === p.id}>${p.label}</option>`,
                    )}
                  </select>
                </label>
                <label class="field">
                  <span>${t("apiKeys.keyName")}</span>
                  <input
                    type="text"
                    class="input"
                    .value=${props.newKeyAlias}
                    placeholder="e.g. primary-anthropic, backup-openai"
                    @input=${(e: Event) => props.onNewKeyAliasChange((e.target as HTMLInputElement).value)}
                  />
                </label>
                <label class="field">
                  <span>${t("apiKeys.keyValue")}</span>
                  <input
                    type="password"
                    class="input"
                    .value=${props.newKeyValue}
                    placeholder="sk-..."
                    @input=${(e: Event) => props.onNewKeyValueChange((e.target as HTMLInputElement).value)}
                  />
                </label>
                ${renderModelPicker(props.newKeyModels, props.newKeyProvider, props.modelCatalog, props.onNewKeyModelsChange)}
                <div class="row" style="gap: 8px; margin-top: 4px;">
                  <button
                    class="btn primary"
                    ?disabled=${!props.newKeyProvider || !props.newKeyAlias || !props.newKeyValue || props.saving}
                    @click=${() => props.onConfirmAdd()}
                  >
                    ${props.saving ? t("common.saving") : t("apiKeys.addKey")}
                  </button>
                  <button class="btn" @click=${() => props.onCancelAdd()}>
                    ${t("common.cancel")}
                  </button>
                </div>
              </div>
            </div>
          `
        : nothing}

      <!-- KEY LIST -->
      ${sorted.length === 0
        ? props.loading
          ? html`<div class="muted" style="margin-top: 16px;">${t("common.loading")}</div>`
          : html`<div class="muted" style="margin-top: 16px;">${t("apiKeys.noKeys")}</div>`
        : html`
            <div style="margin-top: 16px; margin-bottom: 4px; font-size: 12px; color: var(--muted);">
              ${t("apiKeys.fallbackChainLabel")}
              <span style="font-size: 11px; opacity: 0.7;">— ${t("apiKeys.dragHint", { defaultValue: "kéo thả để đổi thứ tự" })}</span>
            </div>

            <div
              class="apikey-list"
              style="display: flex; flex-direction: column; gap: 0;"
              @dragover=${(e: DragEvent) => e.preventDefault()}
            >
              ${sorted.map((key, index) => {
                const isEditing = props.editingId === key.id;
                const editProviderModels = getModelsForProvider(key.provider, props.modelCatalog);

                return html`
                  <div
                    style="display: flex; align-items: stretch; gap: 0;"
                    draggable="true"
                    @dragstart=${(e: DragEvent) => {
                      _dragSrcId = key.id;
                      e.dataTransfer!.effectAllowed = "move";
                      e.dataTransfer!.setData("text/plain", key.id);
                    }}
                    @dragover=${(e: DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer!.dropEffect = "move";
                      _dragOverId = key.id;
                    }}
                    @dragleave=${() => {
                      if (_dragOverId === key.id) _dragOverId = "";
                    }}
                    @drop=${(e: DragEvent) => {
                      e.preventDefault();
                      if (_dragSrcId && _dragSrcId !== key.id) {
                        const srcIdx = sorted.findIndex((k) => k.id === _dragSrcId);
                        const dstIdx = index;
                        const next = [...sorted];
                        const [moved] = next.splice(srcIdx, 1);
                        next.splice(dstIdx, 0, moved);
                        props.onDragReorder(next.map((k) => k.id));
                      }
                      _dragSrcId = "";
                      _dragOverId = "";
                    }}
                    @dragend=${() => {
                      _dragSrcId = "";
                      _dragOverId = "";
                    }}
                  >
                    <!-- Priority number + connector line -->
                    <div style="display: flex; flex-direction: column; align-items: center; width: 32px; flex-shrink: 0;">
                      <div
                        style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${key.status ? (STATUS_COLORS[key.status] ?? "var(--border)") : "var(--border)"}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; background: var(--surface-1, #fff); z-index: 1;"
                      >
                        ${index + 1}
                      </div>
                      ${index < sorted.length - 1
                        ? html`<div style="width: 2px; flex: 1; background: var(--border); margin: 2px 0;"></div>`
                        : nothing}
                    </div>

                    <!-- Key card -->
                    <div
                      class="apikey-row"
                      style="flex: 1; margin-left: 8px; margin-bottom: ${index < sorted.length - 1 ? "4px" : "0"}; padding: 10px 12px; border: 1px solid ${key.active ? "var(--color-primary, #3b82f6)" : "var(--border, #e5e7eb)"}; border-radius: 8px; background: var(--surface-1, #fff);"
                    >
                      ${isEditing
                        ? html`
                            <!-- EDIT FORM -->
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                              <label class="field" style="margin: 0;">
                                <span style="font-size: 12px;">${t("apiKeys.keyName")}</span>
                                <input
                                  type="text"
                                  class="input"
                                  .value=${props.editAlias}
                                  @input=${(e: Event) => props.onEditAliasChange((e.target as HTMLInputElement).value)}
                                />
                              </label>
                              <label class="field" style="margin: 0;">
                                <span style="font-size: 12px;">${t("apiKeys.newKeyValue", { defaultValue: "API Key mới (để trống = không đổi)" })}</span>
                                <input
                                  type="password"
                                  class="input"
                                  .value=${props.editKeyValue}
                                  placeholder="sk-... (để trống nếu không muốn thay)"
                                  @input=${(e: Event) => props.onEditKeyValueChange((e.target as HTMLInputElement).value)}
                                />
                              </label>
                              <div class="field" style="margin: 0;">
                                <span class="label" style="font-size: 12px;">${t("apiKeys.modelSelection")}</span>
                                ${editProviderModels.length === 0
                                  ? html`
                                      <input
                                        type="text"
                                        class="input"
                                        style="margin-top: 4px;"
                                        .value=${props.editModels.join(", ")}
                                        placeholder="model-a, model-b"
                                        @input=${(e: Event) => {
                                          const v = (e.target as HTMLInputElement).value;
                                          props.onEditModelsChange(v.split(",").map((s) => s.trim()).filter(Boolean));
                                        }}
                                      />
                                    `
                                  : html`
                                      <div style="display: flex; flex-direction: column; gap: 5px; max-height: 160px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin-top: 4px;">
                                        ${editProviderModels.map(
                                          (m) => html`
                                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
                                              <input
                                                type="checkbox"
                                                .checked=${props.editModels.includes(m.id)}
                                                @change=${(e: Event) => {
                                                  const checked = (e.target as HTMLInputElement).checked;
                                                  const next = checked
                                                    ? [...props.editModels, m.id]
                                                    : props.editModels.filter((id) => id !== m.id);
                                                  props.onEditModelsChange(next);
                                                }}
                                              />
                                              <span>${m.name || m.id}</span>
                                            </label>
                                          `,
                                        )}
                                      </div>
                                    `}
                              </div>
                              <div class="row" style="gap: 6px;">
                                <button
                                  class="btn btn--sm primary"
                                  ?disabled=${props.saving || !props.editAlias}
                                  @click=${() => props.onConfirmEdit()}
                                >
                                  ${props.saving ? t("common.saving") : t("common.save")}
                                </button>
                                <button class="btn btn--sm" @click=${() => props.onCancelEdit()}>
                                  ${t("common.cancel")}
                                </button>
                              </div>
                            </div>
                          `
                        : html`
                            <!-- DISPLAY ROW -->
                            <div style="display: flex; align-items: center; gap: 10px;">
                              <!-- Drag handle -->
                              <div
                                style="cursor: grab; color: var(--muted); flex-shrink: 0; padding: 2px 4px; border-radius: 4px;"
                                title="Kéo để đổi thứ tự"
                              >
                                <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" opacity="0.5">
                                  <circle cx="4" cy="4" r="2"/>
                                  <circle cx="10" cy="4" r="2"/>
                                  <circle cx="4" cy="10" r="2"/>
                                  <circle cx="10" cy="10" r="2"/>
                                  <circle cx="4" cy="16" r="2"/>
                                  <circle cx="10" cy="16" r="2"/>
                                </svg>
                              </div>

                              <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                ${renderStatusDot(key.status)}
                                ${key.active
                                  ? html`<span style="font-size: 10px; background: var(--color-primary, #3b82f6); color: white; padding: 2px 6px; border-radius: 4px; font-weight: 600;">ACTIVE</span>`
                                  : nothing}
                              </div>

                              <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: 600; font-size: 13px;">${key.alias}</div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                                  <span class="muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">${key.provider}</span>
                                  ${key.maskedValue
                                    ? html`<span class="mono muted" style="font-size: 11px;">${key.maskedValue}</span>`
                                    : nothing}
                                </div>
                                ${key.models?.length
                                  ? html`
                                      <div style="margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px;">
                                        ${key.models.map(
                                          (m) => html`<span style="font-size: 10px; background: var(--surface-2, #f3f4f6); padding: 1px 6px; border-radius: 4px; font-family: monospace;">${m}</span>`,
                                        )}
                                      </div>
                                    `
                                  : nothing}
                                ${key.errorCount
                                  ? html`<div class="muted" style="font-size: 11px; color: var(--color-danger, #dc2626); margin-top: 2px;">${key.errorCount} recent error(s)</div>`
                                  : nothing}
                              </div>

                              <div class="row" style="gap: 4px; flex-shrink: 0;">
                                <button
                                  class="btn btn--sm"
                                  title=${t("common.edit", { defaultValue: "Sửa" })}
                                  @click=${() => props.onStartEdit(key)}
                                >
                                  ${icons.edit ?? html`<span style="font-size: 12px;">✏️</span>`}
                                </button>
                                <button
                                  class="btn btn--sm danger"
                                  title=${t("apiKeys.deleteKey")}
                                  @click=${() => {
                                    if (window.confirm(`Xóa key "${key.alias}"?`)) {
                                      props.onDelete(key.id);
                                    }
                                  }}
                                >
                                  ${icons.trash}
                                </button>
                              </div>
                            </div>
                          `}
                    </div>
                  </div>
                `;
              })}
            </div>

            <div class="callout info" style="margin-top: 12px; font-size: 12px;">
              ${t("apiKeys.fallbackHint")}
            </div>
          `}
    </section>

    <style>
      .apikey-row[data-drag-over] {
        outline: 2px dashed var(--color-primary, #3b82f6);
        outline-offset: 2px;
      }
    </style>
  `;
}
