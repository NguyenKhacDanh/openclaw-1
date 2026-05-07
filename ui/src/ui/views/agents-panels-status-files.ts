import { applyPreviewTheme } from "@create-markdown/preview";
import DOMPurify from "dompurify";
import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import { icons } from "../icons.ts";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../presenter.ts";
import type {
  AgentsFilesListResult,
  ChannelAccountSnapshot,
  ChannelsStatusSnapshot,
  CronJob,
  CronStatus,
} from "../types.ts";
import { formatBytes, type AgentContext } from "./agents-utils.ts";
import type { AgentsPanel } from "./agents.types.ts";
import { resolveChannelExtras as resolveChannelExtrasFromConfig } from "./channel-config-extras.ts";

function countWords(text: string) {
  const normalized = text.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

function countLines(text: string) {
  return text.length === 0 ? 0 : text.split(/\r?\n/).length;
}

function estimateReadingTimeLabel(wordCount: number) {
  if (wordCount <= 0) {
    return t("agents.files.emptyDraft");
  }
  return t("agents.files.minRead", { count: String(Math.max(1, Math.round(wordCount / 220))) });
}

const AGENT_FILE_DESCRIPTIONS: Record<string, { purpose: string; hint: string; example?: string }> = {
  AGENTS: {
    purpose: "Cấu hình chính của Agent — quy tắc trả lời, hành vi mặc định, giới hạn.",
    hint: "Đây là file quan trọng nhất. Mọi chỉ dẫn chung cho agent đều viết ở đây.",
    example: `## QUY TẮC TRẢ LỜI
- LUÔN ưu tiên trả lời dựa trên Knowledge Base.
- Câu hỏi nằm trong KB: trả lời chính xác theo KB.
- Câu hỏi KHÔNG có trong KB: hướng dẫn liên hệ hỗ trợ.
- Thân thiện, gần gũi nhưng vẫn rõ ràng.
- Xưng "em", gọi người dùng "anh/chị"`,
  },
  SOUL: {
    purpose: "Linh hồn & tính cách — agent là ai, cách suy nghĩ, giá trị cốt lõi.",
    hint: "Định nghĩa nhân cách sâu: thân thiện, nghiêm túc, hài hước… Ảnh hưởng đến toàn bộ cách agent giao tiếp.",
    example: `Tôi là trợ lý AI thân thiện, luôn cố gắng giúp đỡ hết lòng.
Tôi tôn trọng người dùng, kiên nhẫn và không bao giờ phán xét.
Khi không biết câu trả lời, tôi thành thật nói "em không chắc"
thay vì bịa đặt thông tin.`,
  },
  TOOLS: {
    purpose: "Công cụ được phép dùng — web search, đọc file, gọi API, v.v.",
    hint: "Liệt kê và cấu hình từng tool. Nếu không khai báo ở đây, agent sẽ không biết tool tồn tại.",
    example: `## CÔNG CỤ CÓ SẴN
- web_search: Tìm kiếm thông tin mới nhất trên internet
- read_file: Đọc nội dung file trong workspace
- write_file: Tạo hoặc cập nhật file

## HƯỚNG DẪN SỬ DỤNG
Chỉ dùng web_search khi thông tin KHÔNG có trong KB.
Luôn trích dẫn nguồn khi lấy thông tin từ web.`,
  },
  IDENTITY: {
    purpose: "Danh tính & cách trình bày — tên, vai trò, phong cách giao tiếp.",
    hint: "Agent tự giới thiệu thế nào, xưng hô ra sao, logo hay chữ ký nếu cần.",
    example: `Tên: Trợ lý AI [Tên công ty]
Vai trò: Hỗ trợ khách hàng và giải đáp thắc mắc
Xưng: "em" - Gọi người dùng: "anh/chị"
Ngôn ngữ chính: Tiếng Việt
Giờ làm việc: 7:00 - 22:00 hàng ngày`,
  },
  USER: {
    purpose: "Khai báo Chủ nhân & thông tin người dùng — ai sở hữu agent, sở thích, liên lạc.",
    hint: "⭐ Khai báo Chủ nhân ở đây. Agent sẽ nhận diện chủ nhân và ưu tiên báo cáo cho người này.",
    example: `## CHỦ NHÂN (OWNER)
Tên: [Họ và tên]
Zalo/Phone: [Số điện thoại hoặc username Zalo]
Vai trò: Quản lý hệ thống
Quyền hạn: Toàn quyền — được phép yêu cầu mọi thao tác

## SỞ THÍCH NHẬN BÁO CÁO
Hình thức: Tin nhắn Zalo
Thời điểm: Hàng ngày lúc 8:00 sáng
Nội dung muốn biết:
- Số lượng tin nhắn đã xử lý
- Các câu hỏi chưa trả lời được
- Trạng thái hệ thống`,
  },
  HEARTBEAT: {
    purpose: "Tác vụ định kỳ — report hàng ngày, kiểm tra hệ thống, nhắc nhở theo lịch.",
    hint: "⭐ Cấu hình báo cáo hàng ngày ở đây. Dùng cú pháp cron: '0 8 * * *' = mỗi ngày 8:00 sáng.",
    example: `## BÁO CÁO HÀNG NGÀY
Lịch: Mỗi ngày lúc 8:00 sáng (cron: 0 8 * * *)

Nhiệm vụ:
1. Tổng kết hoạt động 24h qua
2. Đếm số lượng hội thoại đã xử lý
3. Liệt kê các câu hỏi không trả lời được
4. Gửi báo cáo cho Chủ nhân qua Zalo

Mẫu báo cáo:
"Báo cáo ngày [ngày]:
- Tổng hội thoại: X
- Đã giải quyết: Y
- Cần hỗ trợ thêm: Z vấn đề
[Danh sách vấn đề nếu có]"

## NHẮC NHỞ ĐỊNH KỲ
Lịch: Thứ 2 hàng tuần lúc 9:00 (cron: 0 9 * * 1)
Nhiệm vụ: Kiểm tra và cập nhật Knowledge Base nếu cần`,
  },
  MEMORY: {
    purpose: "Bộ nhớ — cách agent lưu và nhớ lại thông tin từ các cuộc hội thoại trước.",
    hint: "Kiểm soát những gì agent nhớ lâu dài: thói quen người dùng, sự kiện quan trọng, kiến thức tích lũy.",
    example: `## THÔNG TIN CẦN GHI NHỚ
- Tên và sở thích của người dùng thường xuyên
- Các vấn đề đã được giải quyết để tránh hỏi lại
- Phản hồi của người dùng về chất lượng trả lời

## KHÔNG GHI NHỚ
- Thông tin nhạy cảm (mật khẩu, số thẻ, v.v.)
- Nội dung trò chuyện riêng tư không liên quan`,
  },
};

function getAgentFileDescription(fileName: string) {
  const key = fileName.replace(/\.md$/i, "").toUpperCase();
  return AGENT_FILE_DESCRIPTIONS[key] ?? null;
}

function renderQuickGuide(onSelectFile: (name: string) => void, files: { name: string }[]) {
  const hasFile = (name: string) => files.some((f) => f.name.toUpperCase() === name);
  return html`
    <section class="card" style="margin-bottom: 0; border-left: 3px solid var(--color-primary, #3b82f6);">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div>
          <div class="card-title" style="font-size: 14px;">Hướng dẫn nhanh</div>
          <div class="card-sub">Các cấu hình phổ biến nhất — nhấn để mở file tương ứng</div>
        </div>
      </div>

      <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px;">

        <!-- Owner declaration -->
        <div
          style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: ${hasFile("USER") ? "pointer" : "default"}; background: var(--surface-1);"
          @click=${() => hasFile("USER") ? onSelectFile("USER.md") : void 0}
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 18px;">👤</span>
            <span style="font-weight: 600; font-size: 13px;">Khai báo Chủ nhân</span>
            <span style="font-size: 10px; background: var(--color-primary, #3b82f6); color: #fff; padding: 1px 6px; border-radius: 4px;">USER.md</span>
          </div>
          <div class="muted" style="font-size: 12px; line-height: 1.5;">
            Tên, Zalo/Phone, quyền hạn của chủ nhân.<br/>
            Agent nhận diện & ưu tiên báo cáo cho người này.
          </div>
          ${!hasFile("USER")
            ? html`<div style="margin-top: 6px; font-size: 11px; color: var(--muted);">→ Tạo file USER.md để bắt đầu</div>`
            : html`<div style="margin-top: 6px; font-size: 11px; color: var(--color-primary, #3b82f6);">→ Nhấn để mở và chỉnh sửa</div>`}
        </div>

        <!-- Daily report -->
        <div
          style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: ${hasFile("HEARTBEAT") ? "pointer" : "default"}; background: var(--surface-1);"
          @click=${() => hasFile("HEARTBEAT") ? onSelectFile("HEARTBEAT.md") : void 0}
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 18px;">📊</span>
            <span style="font-weight: 600; font-size: 13px;">Report hàng ngày</span>
            <span style="font-size: 10px; background: #f59e0b; color: #fff; padding: 1px 6px; border-radius: 4px;">HEARTBEAT.md</span>
          </div>
          <div class="muted" style="font-size: 12px; line-height: 1.5;">
            Lịch báo cáo, nội dung tổng kết, gửi cho chủ nhân.<br/>
            Ví dụ: <span class="mono" style="font-size: 11px;">0 8 * * *</span> = mỗi ngày 8:00 sáng.
          </div>
          ${!hasFile("HEARTBEAT")
            ? html`<div style="margin-top: 6px; font-size: 11px; color: var(--muted);">→ Tạo file HEARTBEAT.md để bắt đầu</div>`
            : html`<div style="margin-top: 6px; font-size: 11px; color: #f59e0b;">→ Nhấn để mở và chỉnh sửa</div>`}
        </div>

        <!-- Rules & behavior -->
        <div
          style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: ${hasFile("AGENTS") ? "pointer" : "default"}; background: var(--surface-1);"
          @click=${() => hasFile("AGENTS") ? onSelectFile("AGENTS.md") : void 0}
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 18px;">📋</span>
            <span style="font-weight: 600; font-size: 13px;">Quy tắc & hành vi</span>
            <span style="font-size: 10px; background: #6366f1; color: #fff; padding: 1px 6px; border-radius: 4px;">AGENTS.md</span>
          </div>
          <div class="muted" style="font-size: 12px; line-height: 1.5;">
            Cách agent trả lời, giới hạn, ưu tiên dùng KB.<br/>
            Đây là file quan trọng nhất, đọc trước tiên.
          </div>
          ${!hasFile("AGENTS")
            ? html`<div style="margin-top: 6px; font-size: 11px; color: var(--muted);">→ Tạo file AGENTS.md để bắt đầu</div>`
            : html`<div style="margin-top: 6px; font-size: 11px; color: #6366f1;">→ Nhấn để mở và chỉnh sửa</div>`}
        </div>

        <!-- Personality -->
        <div
          style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: ${hasFile("SOUL") ? "pointer" : "default"}; background: var(--surface-1);"
          @click=${() => hasFile("SOUL") ? onSelectFile("SOUL.md") : void 0}
        >
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 18px;">✨</span>
            <span style="font-weight: 600; font-size: 13px;">Tính cách & Linh hồn</span>
            <span style="font-size: 10px; background: #ec4899; color: #fff; padding: 1px 6px; border-radius: 4px;">SOUL.md</span>
          </div>
          <div class="muted" style="font-size: 12px; line-height: 1.5;">
            Nhân cách sâu: thân thiện, nghiêm túc, hài hước.<br/>
            Ảnh hưởng đến toàn bộ cách giao tiếp của agent.
          </div>
          ${!hasFile("SOUL")
            ? html`<div style="margin-top: 6px; font-size: 11px; color: var(--muted);">→ Tạo file SOUL.md để bắt đầu</div>`
            : html`<div style="margin-top: 6px; font-size: 11px; color: #ec4899;">→ Nhấn để mở và chỉnh sửa</div>`}
        </div>

      </div>

      <div class="callout info" style="margin-top: 12px; font-size: 12px;">
        <strong>Cú pháp Cron (HEARTBEAT):</strong>&nbsp;
        <span class="mono">0 8 * * *</span> = 8:00 sáng mỗi ngày &nbsp;|&nbsp;
        <span class="mono">0 9 * * 1</span> = 9:00 sáng thứ Hai &nbsp;|&nbsp;
        <span class="mono">0 */6 * * *</span> = mỗi 6 tiếng
      </div>
    </section>
  `;
}

function getExtensionLabel(fileName: string) {
  const ext = fileName.split(".").pop()?.trim().toLowerCase();
  if (ext === "md" || ext === "markdown") {
    return t("agents.files.markdownPreview");
  }
  return ext
    ? t("agents.files.extensionPreview", { ext: ext.toUpperCase() })
    : t("agents.files.preview");
}

function formatWorkspaceRelativePath(filePath: string, workspace: string | null | undefined) {
  const normalizedPath = filePath.trim();
  const normalizedWorkspace = workspace?.trim();
  if (!normalizedPath) {
    return "";
  }
  if (normalizedWorkspace && normalizedPath === normalizedWorkspace) {
    return ".";
  }
  if (normalizedWorkspace && normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
    return normalizedPath.slice(normalizedWorkspace.length + 1) || ".";
  }
  const pathParts = normalizedPath.split(/[\\/]+/);
  for (let index = pathParts.length - 1; index >= 0; index -= 1) {
    const pathPart = pathParts[index];
    if (pathPart) {
      return pathPart;
    }
  }
  return normalizedPath;
}

function toDomId(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "preview";
}

function setPreviewExpandButtonState(button: Element | null | undefined, isFullscreen: boolean) {
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const label = isFullscreen ? t("agents.files.collapsePreview") : t("agents.files.expandPreview");
  button.classList.toggle("is-fullscreen", isFullscreen);
  button.setAttribute("aria-pressed", String(isFullscreen));
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

function renderAgentContextCard(
  context: AgentContext,
  subtitle: string,
  onSelectPanel: (panel: AgentsPanel) => void,
) {
  return html`
    <section class="card">
      <div class="card-title">${t("agents.context.title")}</div>
      <div class="card-sub">${subtitle}</div>
      <div class="agents-overview-grid" style="margin-top: 16px;">
        <div class="agent-kv">
          <div class="label">${t("agents.context.workspace")}</div>
          <div>
            <button
              type="button"
              class="workspace-link mono"
              @click=${() => onSelectPanel("files")}
              title=${t("agents.context.openFilesTab")}
            >
              ${context.workspace}
            </button>
          </div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.primaryModel")}</div>
          <div class="mono">${context.model}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.runtime")}</div>
          <div class="mono">${context.runtime}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.identityName")}</div>
          <div>${context.identityName}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.identityAvatar")}</div>
          <div>${context.identityAvatar}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.skillsFilter")}</div>
          <div>${context.skillsLabel}</div>
        </div>
        <div class="agent-kv">
          <div class="label">${t("agents.context.default")}</div>
          <div>${context.isDefault ? t("common.yes") : t("common.no")}</div>
        </div>
      </div>
    </section>
  `;
}

type ChannelSummaryEntry = {
  id: string;
  label: string;
  accounts: ChannelAccountSnapshot[];
};

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot, id: string) {
  const meta = snapshot.channelMeta?.find((entry) => entry.id === id);
  if (meta?.label) {
    return meta.label;
  }
  return snapshot.channelLabels?.[id] ?? id;
}

function resolveChannelEntries(snapshot: ChannelsStatusSnapshot | null): ChannelSummaryEntry[] {
  if (!snapshot) {
    return [];
  }
  const ids = new Set<string>();
  for (const id of snapshot.channelOrder ?? []) {
    ids.add(id);
  }
  for (const entry of snapshot.channelMeta ?? []) {
    ids.add(entry.id);
  }
  for (const id of Object.keys(snapshot.channelAccounts ?? {})) {
    ids.add(id);
  }
  const ordered: string[] = [];
  const seed = snapshot.channelOrder?.length ? snapshot.channelOrder : Array.from(ids);
  for (const id of seed) {
    if (!ids.has(id)) {
      continue;
    }
    ordered.push(id);
    ids.delete(id);
  }
  for (const id of ids) {
    ordered.push(id);
  }
  return ordered.map((id) => ({
    id,
    label: resolveChannelLabel(snapshot, id),
    accounts: snapshot.channelAccounts?.[id] ?? [],
  }));
}

const CHANNEL_EXTRA_FIELDS = ["groupPolicy", "streamMode", "dmPolicy"] as const;

function summarizeChannelAccounts(accounts: ChannelAccountSnapshot[]) {
  let connected = 0;
  let configured = 0;
  let enabled = 0;
  for (const account of accounts) {
    const probeOk =
      account.probe && typeof account.probe === "object" && "ok" in account.probe
        ? Boolean((account.probe as { ok?: unknown }).ok)
        : false;
    const isConnected = account.connected === true || account.running === true || probeOk;
    if (isConnected) {
      connected += 1;
    }
    if (account.configured) {
      configured += 1;
    }
    if (account.enabled) {
      enabled += 1;
    }
  }
  return {
    total: accounts.length,
    connected,
    configured,
    enabled,
  };
}

export function renderAgentChannels(params: {
  context: AgentContext;
  configForm: Record<string, unknown> | null;
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSuccess: number | null;
  onRefresh: () => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const entries = resolveChannelEntries(params.snapshot);
  const lastSuccessLabel = params.lastSuccess
    ? formatRelativeTimestamp(params.lastSuccess)
    : t("common.never");
  return html`
    <section class="grid grid-cols-2">
      ${renderAgentContextCard(
        params.context,
        t("agents.context.configurationSubtitle"),
        params.onSelectPanel,
      )}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("agents.channels.title")}</div>
            <div class="card-sub">${t("agents.channels.subtitle")}</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? t("common.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div class="muted" style="margin-top: 8px;">
          ${t("agents.channels.lastRefresh", { time: lastSuccessLabel })}
        </div>
        ${params.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
          : nothing}
        ${!params.snapshot
          ? html`
              <div class="callout info" style="margin-top: 12px">
                ${t("agents.channels.loadHint")}
              </div>
            `
          : nothing}
        ${entries.length === 0
          ? html` <div class="muted" style="margin-top: 16px">${t("agents.channels.empty")}</div>`
          : html`
              <div class="list" style="margin-top: 16px;">
                ${entries.map((entry) => {
                  const summary = summarizeChannelAccounts(entry.accounts);
                  const status = summary.total
                    ? t("agents.channels.connectedCount", {
                        connected: String(summary.connected),
                        total: String(summary.total),
                      })
                    : t("agents.channels.noAccounts");
                  const configLabel = summary.configured
                    ? t("agents.channels.configuredCount", { count: String(summary.configured) })
                    : t("agents.channels.notConfigured");
                  const enabled = summary.total
                    ? t("agents.channels.enabledCount", { count: String(summary.enabled) })
                    : t("common.disabled");
                  const extras = resolveChannelExtrasFromConfig({
                    configForm: params.configForm,
                    channelId: entry.id,
                    fields: CHANNEL_EXTRA_FIELDS,
                  });
                  return html`
                    <div class="list-item">
                      <div class="list-main">
                        <div class="list-title">${entry.label}</div>
                        <div class="list-sub mono">${entry.id}</div>
                      </div>
                      <div class="list-meta">
                        <div>${status}</div>
                        <div>${configLabel}</div>
                        <div>${enabled}</div>
                        ${summary.configured === 0
                          ? html`
                              <div>
                                <a
                                  href="https://docs.openclaw.ai/channels"
                                  target="_blank"
                                  rel="noopener"
                                  style="color: var(--accent); font-size: 12px"
                                  >${t("agents.channels.setupGuide")}</a
                                >
                              </div>
                            `
                          : nothing}
                        ${extras.length > 0
                          ? extras.map((extra) => html`<div>${extra.label}: ${extra.value}</div>`)
                          : nothing}
                      </div>
                    </div>
                  `;
                })}
              </div>
            `}
      </section>
    </section>
  `;
}

export function renderAgentCron(params: {
  context: AgentContext;
  agentId: string;
  jobs: CronJob[];
  status: CronStatus | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onRunNow: (jobId: string) => void;
  onSelectPanel: (panel: AgentsPanel) => void;
}) {
  const jobs = params.jobs.filter((job) => job.agentId === params.agentId);
  return html`
    <section class="grid grid-cols-2">
      ${renderAgentContextCard(
        params.context,
        t("agents.context.schedulingSubtitle"),
        params.onSelectPanel,
      )}
      <section class="card">
        <div class="row" style="justify-content: space-between;">
          <div>
            <div class="card-title">${t("agents.cronPanel.schedulerTitle")}</div>
            <div class="card-sub">${t("agents.cronPanel.schedulerSubtitle")}</div>
          </div>
          <button class="btn btn--sm" ?disabled=${params.loading} @click=${params.onRefresh}>
            ${params.loading ? t("common.refreshing") : t("common.refresh")}
          </button>
        </div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${t("common.enabled")}</div>
            <div class="stat-value">
              ${params.status
                ? params.status.enabled
                  ? t("common.yes")
                  : t("common.no")
                : t("common.na")}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("agents.cronPanel.jobs")}</div>
            <div class="stat-value">${params.status?.jobs ?? t("common.na")}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${t("agents.cronPanel.nextWake")}</div>
            <div class="stat-value">${formatNextRun(params.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        ${params.error
          ? html`<div class="callout danger" style="margin-top: 12px;">${params.error}</div>`
          : nothing}
      </section>
    </section>
    <section class="card">
      <div class="card-title">${t("agents.cronPanel.agentJobsTitle")}</div>
      <div class="card-sub">${t("agents.cronPanel.agentJobsSubtitle")}</div>
      ${jobs.length === 0
        ? html` <div class="muted" style="margin-top: 16px">${t("agents.cronPanel.noJobs")}</div>`
        : html`
            <div class="list" style="margin-top: 16px;">
              ${jobs.map(
                (job) => html`
                  <div class="list-item">
                    <div class="list-main">
                      <div class="list-title">${job.name}</div>
                      ${job.description
                        ? html`<div class="list-sub">${job.description}</div>`
                        : nothing}
                      <div class="chip-row" style="margin-top: 6px;">
                        <span class="chip">${formatCronSchedule(job)}</span>
                        <span class="chip ${job.enabled ? "chip-ok" : "chip-warn"}">
                          ${job.enabled ? t("common.enabled") : t("common.disabled")}
                        </span>
                        <span class="chip">${job.sessionTarget}</span>
                      </div>
                    </div>
                    <div class="list-meta">
                      <div class="mono">${formatCronState(job)}</div>
                      <div class="muted">${formatCronPayload(job)}</div>
                      <button
                        class="btn btn--sm"
                        style="margin-top: 6px;"
                        ?disabled=${!job.enabled}
                        @click=${() => params.onRunNow(job.id)}
                      >
                        ${t("agents.cronPanel.runNow")}
                      </button>
                    </div>
                  </div>
                `,
              )}
            </div>
          `}
    </section>
  `;
}

export function renderAgentFiles(params: {
  agentId: string;
  agentFilesList: AgentsFilesListResult | null;
  agentFilesLoading: boolean;
  onFileImport: (agentId: string, name: string, content: string) => void;
  onFileDelete: (agentId: string, name: string) => void;
  onFileCreate: (agentId: string, name: string) => void;
  agentFilesError: string | null;
  agentFileActive: string | null;
  agentFileContents: Record<string, string>;
  agentFileDrafts: Record<string, string>;
  agentFileSaving: boolean;
  onLoadFiles: (agentId: string) => void;
  onSelectFile: (name: string) => void;
  onFileDraftChange: (name: string, content: string) => void;
  onFileReset: (name: string) => void;
  onFileSave: (name: string) => void;
}) {
  const list = params.agentFilesList?.agentId === params.agentId ? params.agentFilesList : null;
  const files = list?.files ?? [];
  const active = params.agentFileActive ?? null;
  const activeEntry = active ? (files.find((file) => file.name === active) ?? null) : null;
  const baseContent = active ? (params.agentFileContents[active] ?? "") : "";
  const draft = active ? (params.agentFileDrafts[active] ?? baseContent) : "";
  const isDirty = active ? draft !== baseContent : false;
  const previewHtml = activeEntry
    ? applyPreviewTheme(marked.parse(draft, { gfm: true, breaks: true }) as string, {
        sanitize: (h: string) => DOMPurify.sanitize(h),
      })
    : "";
  const draftByteSize = formatBytes(new TextEncoder().encode(draft).length);
  const draftWordCount = countWords(draft);
  const draftLineCount = countLines(draft);
  const activePathLabel = activeEntry
    ? formatWorkspaceRelativePath(activeEntry.path, list?.workspace)
    : "";
  const previewTitleId = activeEntry ? `agent-file-preview-title-${toDomId(activeEntry.name)}` : "";
  const previewStatusLabel = activeEntry?.missing
    ? t("agents.files.willCreateOnSave")
    : isDirty
      ? t("agents.files.liveDraftPreview")
      : t("agents.files.savedPreview");
  const previewStatusClass = activeEntry?.missing
    ? "is-missing"
    : isDirty
      ? "is-dirty"
      : "is-synced";
  const previewUpdatedLabel = activeEntry?.updatedAtMs
    ? t("agents.files.updated", { time: formatRelativeTimestamp(activeEntry.updatedAtMs) })
    : activeEntry?.missing
      ? t("agents.files.notCreatedYet")
      : t("agents.files.updatedUnknown");

  return html`
    ${renderQuickGuide(params.onSelectFile, files)}

    <section class="card">
      <div class="row" style="justify-content: space-between;">
        <div>
          <div class="card-title">${t("agents.files.coreFilesTitle")}</div>
          <div class="card-sub">${t("agents.files.coreFilesSubtitle")}</div>
        </div>
        <div class="row" style="gap: 6px;">
          <button
            class="btn btn--sm"
            ?disabled=${params.agentFilesLoading}
            @click=${() => {
              const name = window.prompt(t("agents.files.newFileName"));
              if (name?.trim()) {
                params.onFileCreate(params.agentId, name.trim());
              }
            }}
          >
            ${t("agents.files.newFile")}
          </button>
          <label class="btn btn--sm" style="cursor: pointer; margin: 0;">
            ${t("agents.files.importFile")}
            <input
              type="file"
              style="display: none;"
              accept=".md,.txt,.json,.yaml,.yml"
              @change=${(e: Event) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  params.onFileImport(params.agentId, file.name, reader.result as string);
                };
                reader.readAsText(file);
                input.value = "";
              }}
            />
          </label>
          <button
            class="btn btn--sm"
            ?disabled=${params.agentFilesLoading}
            @click=${() => params.onLoadFiles(params.agentId)}
          >
            ${params.agentFilesLoading ? t("common.loading") : t("common.refresh")}
          </button>
        </div>
      </div>
      ${list
        ? html`<div class="muted mono" style="margin-top: 8px;">
            ${t("agents.files.workspace")}: <span>${list.workspace}</span>
          </div>`
        : nothing}
      ${params.agentFilesError
        ? html`<div class="callout danger" style="margin-top: 12px;">
            ${params.agentFilesError}
          </div>`
        : nothing}
      ${!list
        ? html`
            <div class="callout info" style="margin-top: 12px">${t("agents.files.loadHint")}</div>
          `
        : files.length === 0
          ? html` <div class="muted" style="margin-top: 16px">${t("agents.files.empty")}</div> `
          : html`
              <div class="agent-tabs" style="margin-top: 14px;">
                ${files.map((file) => {
                  const isActive = active === file.name;
                  const label = file.name.replace(/\.md$/i, "");
                  const desc = getAgentFileDescription(file.name);
                  return html`
                    <button
                      class="agent-tab ${isActive ? "active" : ""} ${file.missing
                        ? "agent-tab--missing"
                        : ""}"
                      title=${desc ? desc.purpose : label}
                      @click=${() => params.onSelectFile(file.name)}
                    >
                      ${label}${file.missing
                        ? html` <span class="agent-tab-badge">${t("agents.files.missing")}</span> `
                        : nothing}
                    </button>
                  `;
                })}
              </div>
              ${!activeEntry
                ? html` <div class="muted" style="margin-top: 16px">
                    ${t("agents.files.selectFile")}
                  </div>`
                : html`
                    ${(() => {
                      const desc = getAgentFileDescription(activeEntry.name ?? active ?? "");
                      if (!desc) return nothing;
                      return html`
                        <div style="margin-top: 10px; padding: 10px 14px; background: var(--surface-2, #f8f9fa); border-left: 3px solid var(--color-primary, #3b82f6); border-radius: 0 6px 6px 0; font-size: 13px;">
                          <div style="font-weight: 600; color: var(--text, #111);">${desc.purpose}</div>
                          <div style="margin-top: 4px; color: var(--muted, #6b7280);">${desc.hint}</div>
                          ${desc.example && (!baseContent || baseContent.trim() === "")
                            ? html`
                                <details style="margin-top: 8px;">
                                  <summary style="cursor: pointer; font-size: 12px; color: var(--color-primary, #3b82f6); user-select: none;">
                                    📄 Xem mẫu nội dung để bắt đầu
                                  </summary>
                                  <pre style="margin-top: 8px; padding: 10px; background: var(--surface-1, #fff); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; white-space: pre-wrap; overflow-x: auto;">${desc.example}</pre>
                                  <button
                                    class="btn btn--sm"
                                    style="margin-top: 6px;"
                                    @click=${() => params.onFileDraftChange(active!, desc.example!)}
                                  >
                                    📋 Dùng mẫu này
                                  </button>
                                </details>
                              `
                            : nothing}
                        </div>
                      `;
                    })()}
                    <div class="agent-file-header" style="margin-top: 14px;">
                      <div>
                        <div class="agent-file-sub mono">${activeEntry.path}</div>
                      </div>
                      <div class="agent-file-actions">
                        <button
                          class="btn btn--sm"
                          title=${t("agents.files.previewMarkdownTitle")}
                          @click=${(e: Event) => {
                            const btn = e.currentTarget as HTMLElement;
                            const dialog = btn.closest(".card")?.querySelector("dialog");
                            if (dialog) {
                              dialog.showModal();
                            }
                          }}
                        >
                          ${icons.eye} ${t("agents.files.preview")}
                        </button>
                        <button
                          class="btn btn--sm"
                          ?disabled=${!isDirty}
                          @click=${() => params.onFileReset(activeEntry.name)}
                        >
                          ${t("common.reset")}
                        </button>
                        <button
                          class="btn btn--sm primary"
                          ?disabled=${params.agentFileSaving || !isDirty}
                          @click=${() => params.onFileSave(activeEntry.name)}
                        >
                          ${params.agentFileSaving ? t("common.saving") : t("common.save")}
                        </button>
                        <button
                          class="btn btn--sm danger"
                          ?disabled=${params.agentFileSaving}
                          @click=${() => {
                            const msg = t("agents.files.deleteConfirm").replace(
                              "{name}",
                              activeEntry.name,
                            );
                            if (window.confirm(msg)) {
                              params.onFileDelete(params.agentId, activeEntry.name);
                            }
                          }}
                        >
                          ${t("agents.files.deleteFile")}
                        </button>
                      </div>
                    </div>
                    ${activeEntry.missing
                      ? html`
                          <div class="callout info" style="margin-top: 10px">
                            ${t("agents.files.missingHint")}
                          </div>
                        `
                      : nothing}
                    <label class="field agent-file-field" style="margin-top: 12px;">
                      <span>${t("agents.files.content")}</span>
                      <textarea
                        class="agent-file-textarea"
                        .value=${draft}
                        @input=${(e: Event) =>
                          params.onFileDraftChange(
                            activeEntry.name,
                            (e.target as HTMLTextAreaElement).value,
                          )}
                      ></textarea>
                    </label>
                    <dialog
                      class="md-preview-dialog"
                      aria-labelledby=${previewTitleId}
                      @click=${(e: Event) => {
                        const dialog = e.currentTarget as HTMLDialogElement;
                        if (e.target === dialog) {
                          dialog.close();
                        }
                      }}
                      @close=${(e: Event) => {
                        const dialog = e.currentTarget as HTMLElement;
                        dialog
                          .querySelector(".md-preview-dialog__panel")
                          ?.classList.remove("fullscreen");
                        setPreviewExpandButtonState(
                          dialog.querySelector(".md-preview-expand-btn"),
                          false,
                        );
                      }}
                    >
                      <div class="md-preview-dialog__panel">
                        <div class="md-preview-dialog__header">
                          <div class="md-preview-dialog__header-main">
                            <div class="md-preview-dialog__eyebrow">
                              ${icons.scrollText}
                              <span>${getExtensionLabel(activeEntry.name)}</span>
                            </div>
                            <div class="md-preview-dialog__title-wrap">
                              <div
                                id=${previewTitleId}
                                class="md-preview-dialog__title"
                                translate="no"
                              >
                                ${activeEntry.name}
                              </div>
                              <div class="md-preview-dialog__path mono" translate="no">
                                ${activePathLabel}
                              </div>
                            </div>
                          </div>
                          <div class="md-preview-dialog__actions">
                            <button
                              type="button"
                              class="btn btn--sm md-preview-icon-btn md-preview-expand-btn"
                              title=${t("agents.files.expandPreview")}
                              aria-label=${t("agents.files.expandPreview")}
                              aria-pressed="false"
                              @click=${(e: Event) => {
                                const btn = e.currentTarget as HTMLElement;
                                const panel = btn.closest(".md-preview-dialog__panel");
                                if (!panel) {
                                  return;
                                }
                                const isFullscreen = panel.classList.toggle("fullscreen");
                                setPreviewExpandButtonState(btn, isFullscreen);
                              }}
                            >
                              <span class="when-normal" aria-hidden="true">${icons.maximize}</span
                              ><span class="when-fullscreen" aria-hidden="true"
                                >${icons.minimize}</span
                              >
                            </button>
                            <button
                              type="button"
                              class="btn btn--sm md-preview-icon-btn"
                              title=${t("agents.files.editFile")}
                              aria-label=${t("agents.files.editFile")}
                              @click=${(e: Event) => {
                                (e.currentTarget as HTMLElement).closest("dialog")?.close();
                                const textarea =
                                  document.querySelector<HTMLElement>(".agent-file-textarea");
                                textarea?.focus();
                              }}
                            >
                              <span aria-hidden="true">${icons.edit}</span>
                            </button>
                            <button
                              type="button"
                              class="btn btn--sm md-preview-icon-btn"
                              title=${t("agents.files.closePreview")}
                              aria-label=${t("agents.files.closePreview")}
                              @click=${(e: Event) => {
                                (e.currentTarget as HTMLElement).closest("dialog")?.close();
                              }}
                            >
                              <span aria-hidden="true">${icons.x}</span>
                            </button>
                          </div>
                        </div>
                        <div class="md-preview-dialog__meta">
                          <div class="md-preview-dialog__chip ${previewStatusClass}">
                            <strong>${previewStatusLabel}</strong>
                          </div>
                          <div class="md-preview-dialog__chip">
                            <strong>${estimateReadingTimeLabel(draftWordCount)}</strong>
                            <span
                              >${t("agents.files.words", { count: String(draftWordCount) })}</span
                            >
                          </div>
                          <div class="md-preview-dialog__chip">
                            <strong>${draftLineCount}</strong>
                            <span>${t("agents.files.lines")}</span>
                          </div>
                          <div class="md-preview-dialog__chip">
                            <strong>${draftByteSize}</strong>
                            <span>${previewUpdatedLabel}</span>
                          </div>
                        </div>
                        <div class="md-preview-dialog__body">
                          <article class="md-preview-dialog__reader sidebar-markdown">
                            ${unsafeHTML(previewHtml)}
                          </article>
                        </div>
                      </div>
                    </dialog>
                  `}
            `}
    </section>
  `;
}
