import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import { formatRelativeTimestamp } from "../format.ts";

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      return `=== ${sheetName} ===\n${XLSX.utils.sheet_to_csv(sheet)}`;
    }).join("\n\n");
  }

  if (name.endsWith(".pdf")) {
    const text = await file.text();
    const lines: string[] = [];
    const re = /\(([^)]{2,})\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[1].replace(/\\[()\\]/g, "").trim();
      if (s.length > 1) lines.push(s);
    }
    return lines.length > 0 ? lines.join("\n") : text;
  }

  return file.text();
}

export type ScenarioFile = {
  name: string;
  size?: number;
  updatedAtMs?: number;
};

export type ScenarioPanelState = {
  list: ScenarioFile[] | null;
  loading: boolean;
  error: string | null;
  active: string | null;
  contents: Record<string, string>;
  drafts: Record<string, string>;
  saving: boolean;
};

export function renderAgentScenarioPanel(params: {
  agentId: string;
  state: ScenarioPanelState;
  onLoad: (agentId: string) => void;
  onSelect: (name: string) => void;
  onDraftChange: (name: string, content: string) => void;
  onSave: (name: string) => void;
  onDelete: (agentId: string, name: string) => void;
  onImport: (agentId: string, name: string, content: string) => void;
  onCreate: (agentId: string, name: string, content: string) => void;
}) {
  const { state, agentId } = params;
  const files = state.list ?? [];
  const active = state.active;
  const activeFile = active ? (files.find((f) => f.name === active) ?? null) : null;
  const baseContent = active ? (state.contents[active] ?? "") : "";
  const draft = active ? (state.drafts[active] ?? baseContent) : "";
  const isDirty = active ? draft !== baseContent : false;

  const formatBytes = (n?: number) => {
    if (n == null) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  };

  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">${t("scenario.title")}</div>
          <div class="card-sub">${t("scenario.subtitle")}</div>
        </div>
        <div class="row" style="gap: 6px; flex-wrap: wrap;">
          <button
            class="btn btn--sm"
            @click=${() => {
              const name = window.prompt(t("scenario.newName"), "kichban-moi.json");
              if (!name?.trim()) return;
              const safeName = name.trim();
              params.onCreate(agentId, safeName, "");
            }}
          >
            ${icons.plus ?? html`<span>+</span>`} ${t("scenario.newFile")}
          </button>
          <label class="btn btn--sm" style="cursor: pointer; margin: 0;">
            ${t("scenario.import")}
            <input
              type="file"
              style="display: none;"
              accept=".json,.yaml,.yml,.txt,.md,.docx,.xlsx,.xls,.pdf"
              multiple
              @change=${async (e: Event) => {
                const input = e.target as HTMLInputElement;
                const fileList = Array.from(input.files ?? []);
                for (const file of fileList) {
                  try {
                    const content = await extractTextFromFile(file);
                    const baseName = file.name.replace(/\.(docx|xlsx|xls|pdf)$/i, ".txt");
                    params.onImport(agentId, baseName, content);
                  } catch (err) {
                    console.error("Failed to extract file", file.name, err);
                  }
                }
                input.value = "";
              }}
            />
          </label>
          <button
            class="btn btn--sm"
            ?disabled=${state.loading}
            @click=${() => params.onLoad(agentId)}
          >
            ${state.loading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </div>

      ${state.error
        ? html`<div class="callout danger" style="margin-top: 12px;">${state.error}</div>`
        : nothing}

      ${state.list === null
        ? html`<div class="callout info" style="margin-top: 12px;">${t("scenario.loadHint")}</div>`
        : files.length === 0
          ? html`<div class="muted" style="margin-top: 16px;">${t("scenario.empty")}</div>`
          : html`
              <div class="agent-tabs" style="margin-top: 14px; flex-wrap: wrap;">
                ${files.map((file) => html`
                  <button
                    class="agent-tab ${active === file.name ? "active" : ""}"
                    @click=${() => params.onSelect(file.name)}
                  >
                    ${file.name}
                    ${file.size != null
                      ? html`<span class="agent-tab-badge">${formatBytes(file.size)}</span>`
                      : nothing}
                  </button>
                `)}
              </div>
              ${!activeFile
                ? html`<div class="muted" style="margin-top: 16px;">${t("scenario.selectFile")}</div>`
                : html`
                    <div class="agent-file-header" style="margin-top: 14px;">
                      <div>
                        <div class="agent-file-sub mono">${activeFile.name}</div>
                        ${activeFile.updatedAtMs
                          ? html`<div class="muted" style="font-size: 12px;">
                              ${t("agents.files.updated", {
                                time: formatRelativeTimestamp(activeFile.updatedAtMs),
                              })}
                            </div>`
                          : nothing}
                      </div>
                      <div class="agent-file-actions">
                        <button
                          class="btn btn--sm"
                          ?disabled=${!isDirty}
                          @click=${() => params.onDraftChange(active!, baseContent)}
                        >
                          ${t("common.reset")}
                        </button>
                        <button
                          class="btn btn--sm primary"
                          ?disabled=${state.saving || !isDirty}
                          @click=${() => params.onSave(active!)}
                        >
                          ${state.saving ? t("common.saving") : t("common.save")}
                        </button>
                        <button
                          class="btn btn--sm danger"
                          ?disabled=${state.saving}
                          @click=${() => {
                            if (window.confirm(t("scenario.deleteConfirm").replace("{name}", active!))) {
                              params.onDelete(agentId, active!);
                            }
                          }}
                        >
                          ${t("agents.files.deleteFile")}
                        </button>
                      </div>
                    </div>
                    <label class="field agent-file-field" style="margin-top: 12px;">
                      <span>${t("agents.files.content")}</span>
                      <textarea
                        class="agent-file-textarea"
                        .value=${draft}
                        @input=${(e: Event) =>
                          params.onDraftChange(active!, (e.target as HTMLTextAreaElement).value)}
                      ></textarea>
                    </label>
                  `}
            `}
    </section>
  `;
}
