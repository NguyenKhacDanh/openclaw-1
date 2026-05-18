#!/usr/bin/env bash
# ============================================================
#  OpenClaw VPS Installer — Linux / macOS
#  Repo: https://github.com/NguyenKhacDanh/OpenClaw_New
#
#  Cách dùng:
#    curl -fsSL https://raw.githubusercontent.com/NguyenKhacDanh/OpenClaw_New/main/scripts/install-full-vps.sh | bash
#
#  Hoặc với tham số:
#    curl -fsSL .../install-full-vps.sh -o install.sh
#    bash install.sh --deepseek-key sk-xxx --port 19001
#
#  Sau khi cài: http://YOUR_IP:19001/#token=80130a3a631f966a38d943e7ba21cebc2c2c6f46911b5a7b
# ============================================================

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────
INSTALL_DIR="${INSTALL_DIR:-/opt/openclaw}"
GATEWAY_TOKEN="${GATEWAY_TOKEN:-80130a3a631f966a38d943e7ba21cebc2c2c6f46911b5a7b}"
PORT="${PORT:-19001}"
DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}"
NVIDIA_API_KEY="${NVIDIA_API_KEY:-}"
GROQ_API_KEY="${GROQ_API_KEY:-}"
NO_AUTOSTART="${NO_AUTOSTART:-}"
SKIP_BUILD="${SKIP_BUILD:-}"
NODE_VERSION="22"
REPO_URL="https://github.com/NguyenKhacDanh/OpenClaw_New.git"

# ── Parse args ────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)     INSTALL_DIR="$2"; shift 2 ;;
    --token)           GATEWAY_TOKEN="$2"; shift 2 ;;
    --port)            PORT="$2"; shift 2 ;;
    --deepseek-key)    DEEPSEEK_API_KEY="$2"; shift 2 ;;
    --nvidia-key)      NVIDIA_API_KEY="$2"; shift 2 ;;
    --groq-key)        GROQ_API_KEY="$2"; shift 2 ;;
    --no-autostart)    NO_AUTOSTART=1; shift ;;
    --skip-build)      SKIP_BUILD=1; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Colors ────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_OK='\033[92m'; C_WARN='\033[93m'; C_ERR='\033[91m'
  C_INFO='\033[96m'; C_DIM='\033[90m'; C_NC='\033[0m'
else
  C_OK=''; C_WARN=''; C_ERR=''; C_INFO=''; C_DIM=''; C_NC=''
fi

log_ok()   { echo -e "${C_OK}  ✓${C_NC} $*"; }
log_info() { echo -e "${C_INFO}  ·${C_NC} $*"; }
log_warn() { echo -e "${C_WARN}  !${C_NC} $*"; }
log_err()  { echo -e "${C_ERR}  ✗${C_NC} $*"; }
log_head() { echo -e "\n${C_INFO}══ $* ══${C_NC}"; }

# ── Banner ────────────────────────────────────────────────────
clear 2>/dev/null || true
echo -e "${C_INFO}
  ╔═══════════════════════════════════════════╗
  ║       🦞  OpenClaw VPS Installer          ║
  ║   Auto-setup: Node · Build · Gateway      ║
  ╚═══════════════════════════════════════════╝
${C_NC}"

# ── Collect API keys if not set ───────────────────────────────
log_head "Cấu hình API Keys"

if [[ -z "$DEEPSEEK_API_KEY" ]]; then
  echo -en "  DeepSeek API Key ${C_DIM}(bắt buộc — platform.deepseek.com)${C_NC}: "
  read -r DEEPSEEK_API_KEY
  DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY//[[:space:]]/}"
fi
if [[ -z "$DEEPSEEK_API_KEY" ]]; then
  log_err "DeepSeek API Key là bắt buộc. Thoát."
  exit 1
fi

if [[ -z "$NVIDIA_API_KEY" ]]; then
  echo -en "  NVIDIA NIM API Key ${C_DIM}(tuỳ chọn — build.nvidia.com, Enter bỏ qua)${C_NC}: "
  read -r NVIDIA_API_KEY
fi
if [[ -z "$GROQ_API_KEY" ]]; then
  echo -en "  Groq API Key ${C_DIM}(tuỳ chọn — console.groq.com, Enter bỏ qua)${C_NC}: "
  read -r GROQ_API_KEY
fi
log_ok "API keys đã nhập"

# ── Check root / sudo ─────────────────────────────────────────
IS_ROOT=0
[[ "$EUID" -eq 0 ]] && IS_ROOT=1
if [[ $IS_ROOT -eq 0 ]]; then
  if ! command -v sudo &>/dev/null; then
    log_warn "Không có root/sudo — một số bước cài package có thể thất bại"
  fi
fi

SUDO=""
[[ $IS_ROOT -eq 0 ]] && command -v sudo &>/dev/null && SUDO="sudo"

# ── Helper: detect package manager ───────────────────────────
detect_pkg_manager() {
  if command -v apt-get &>/dev/null; then echo "apt"
  elif command -v dnf &>/dev/null; then echo "dnf"
  elif command -v yum &>/dev/null; then echo "yum"
  elif command -v pacman &>/dev/null; then echo "pacman"
  elif command -v brew &>/dev/null; then echo "brew"
  else echo "unknown"; fi
}

PKG_MGR="$(detect_pkg_manager)"

pkg_install() {
  local pkg="$1"
  log_info "  Cài $pkg..."
  case "$PKG_MGR" in
    apt)    $SUDO apt-get install -y -q "$pkg" ;;
    dnf)    $SUDO dnf install -y -q "$pkg" ;;
    yum)    $SUDO yum install -y -q "$pkg" ;;
    pacman) $SUDO pacman -S --noconfirm "$pkg" ;;
    brew)   brew install "$pkg" ;;
    *)      log_warn "Package manager không nhận diện được — cài $pkg thủ công"; return 1 ;;
  esac
}

# ── Cài Git ───────────────────────────────────────────────────
log_head "Git"
if command -v git &>/dev/null; then
  log_ok "$(git --version) đã có"
else
  log_info "Git chưa cài..."
  if [[ "$PKG_MGR" == "apt" ]]; then
    $SUDO apt-get update -q
  fi
  pkg_install git
  log_ok "Git cài xong"
fi

# ── Cài Node.js 22+ ──────────────────────────────────────────
log_head "Node.js"

node_major() {
  node --version 2>/dev/null | grep -oP '(?<=^v)\d+' || echo 0
}

CURRENT_NODE="$(node_major)"
if [[ "$CURRENT_NODE" -ge 22 ]]; then
  log_ok "Node.js v$(node --version 2>/dev/null) đã có"
else
  log_info "Node.js ${CURRENT_NODE:-chưa có} — cài Node.js $NODE_VERSION..."

  # Ưu tiên: nvm → nodesource → package manager
  if command -v nvm &>/dev/null || [[ -f "$HOME/.nvm/nvm.sh" ]]; then
    log_info "  Dùng nvm..."
    # shellcheck source=/dev/null
    [[ -f "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
    nvm install "$NODE_VERSION" && nvm use "$NODE_VERSION" && nvm alias default "$NODE_VERSION"
    log_ok "  Node.js cài xong (nvm)"

  elif [[ "$PKG_MGR" == "apt" ]]; then
    log_info "  Dùng NodeSource..."
    $SUDO apt-get update -q
    $SUDO apt-get install -y -q ca-certificates curl gnupg
    $SUDO mkdir -p /etc/apt/keyrings
    curl -fsSL "https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key" \
      | $SUDO gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_VERSION}.x nodistro main" \
      | $SUDO tee /etc/apt/sources.list.d/nodesource.list >/dev/null
    $SUDO apt-get update -q
    $SUDO apt-get install -y nodejs
    log_ok "  Node.js cài xong (NodeSource)"

  elif [[ "$PKG_MGR" == "dnf" || "$PKG_MGR" == "yum" ]]; then
    log_info "  Dùng NodeSource RPM..."
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_VERSION}.x" | $SUDO bash -
    $SUDO "${PKG_MGR}" install -y nodejs
    log_ok "  Node.js cài xong (NodeSource RPM)"

  elif [[ "$PKG_MGR" == "brew" ]]; then
    brew install node@22 && brew link node@22 --force --overwrite
    log_ok "  Node.js cài xong (brew)"

  else
    # Fallback: cài nvm rồi dùng nvm
    log_info "  Cài nvm trước..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
    nvm install "$NODE_VERSION" && nvm use "$NODE_VERSION" && nvm alias default "$NODE_VERSION"
    log_ok "  Node.js cài xong (nvm fallback)"
  fi

  # Reload PATH
  hash -r 2>/dev/null || true
  CURRENT_NODE="$(node_major)"
  if [[ "$CURRENT_NODE" -lt 22 ]]; then
    log_err "Node.js vẫn chưa đủ version ($CURRENT_NODE). Cài thủ công v22+ từ https://nodejs.org"
    exit 1
  fi
fi

# ── Clone / Update repo ───────────────────────────────────────
log_head "Source Code"

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log_info "Repo đã có — pull mới nhất..."
  git -C "$INSTALL_DIR" pull --rebase 2>&1 | while IFS= read -r line; do log_info "  $line"; done
  log_ok "Repo đã cập nhật"
else
  log_info "Clone về $INSTALL_DIR ..."
  $SUDO mkdir -p "$(dirname "$INSTALL_DIR")"
  if [[ $IS_ROOT -eq 0 ]] && [[ "$INSTALL_DIR" == /opt/* || "$INSTALL_DIR" == /usr/* ]]; then
    $SUDO git clone "$REPO_URL" "$INSTALL_DIR"
    $SUDO chown -R "$USER:$(id -gn)" "$INSTALL_DIR"
  else
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  log_ok "Clone xong"
fi

cd "$INSTALL_DIR"

# ── npm install ───────────────────────────────────────────────
log_head "Cài dependencies (root)"
log_info "npm install (có thể mất 2-5 phút lần đầu)..."
npm install --prefer-offline --no-fund --no-audit 2>&1 | grep -E "^(added|updated|warn|error)" | while IFS= read -r line; do log_info "  $line"; done || true
log_ok "npm install xong"

# ── Build backend ─────────────────────────────────────────────
if [[ -z "$SKIP_BUILD" ]]; then
  log_head "Build Backend"
  log_info "node scripts/tsdown-build.mjs ..."
  node scripts/tsdown-build.mjs
  log_ok "Backend đã build"

  log_head "Cài dependencies UI"
  cd "$INSTALL_DIR/ui"
  npm install --prefer-offline --no-fund --no-audit 2>&1 | grep -E "^(added|updated|warn|error)" | while IFS= read -r line; do log_info "  $line"; done || true
  log_ok "UI deps xong"

  log_head "Build UI"
  log_info "npx vite build ..."
  npx vite build 2>&1 | while IFS= read -r line; do log_info "  $line"; done
  log_ok "UI đã build"

  cd "$INSTALL_DIR"
fi

# ── Tạo ~/.openclaw ───────────────────────────────────────────
log_head "Cấu hình OpenClaw"

OC_DIR="$HOME/.openclaw"
mkdir -p "$OC_DIR/extensions"

# ── Ghi .env ─────────────────────────────────────────────────
cat > "$OC_DIR/.env" <<ENV
# OpenClaw - API Keys
# Sinh tự động bởi install-full-vps.sh

# DeepSeek (primary model)
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}

ENV

[[ -n "$NVIDIA_API_KEY" ]] && cat >> "$OC_DIR/.env" <<ENV
# NVIDIA NIM (free)
NVIDIA_API_KEY=${NVIDIA_API_KEY}

ENV

[[ -n "$GROQ_API_KEY" ]] && cat >> "$OC_DIR/.env" <<ENV
# Groq (fast inference)
GROQ_API_KEY=${GROQ_API_KEY}

ENV

cat >> "$OC_DIR/.env" <<ENV
# Gateway auth token
OPENCLAW_GATEWAY_TOKEN=${GATEWAY_TOKEN}
ENV

log_ok ".env đã tạo tại $OC_DIR/.env"

# ── Ghi openclaw.json ─────────────────────────────────────────
build_plugins_allow() {
  local p='"zalouser","zalo","whatsapp","deepseek","groq"'
  [[ -n "$NVIDIA_API_KEY" ]] && p="$p,\"nvidia\""
  echo "$p"
}

build_fallbacks() {
  local f='"deepseek/deepseek-chat","groq/llama-3.3-70b-versatile","groq/llama-3.1-8b-instant"'
  [[ -n "$NVIDIA_API_KEY" ]] && f="$f,\"nvidia/meta/llama-3.3-70b-instruct\""
  echo "$f"
}

NVIDIA_ENTRY=""
[[ -n "$NVIDIA_API_KEY" ]] && NVIDIA_ENTRY=',"nvidia": { "enabled": true, "config": {} }'

cat > "$OC_DIR/openclaw.json" <<JSON
{
    "meta": {
        "lastTouchedVersion": "2026.5.6",
        "lastTouchedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
    },
    "agents": {
        "defaults": {
            "model": {
                "primary": "deepseek/deepseek-v4-flash",
                "fallbacks": [ $(build_fallbacks) ]
            },
            "thinkingDefault": "off"
        }
    },
    "tools": {
        "profile": "minimal",
        "alsoAllow": ["web_search"],
        "deny": ["session_status", "sessions_send", "sessions_list"]
    },
    "commands": {
        "native": "auto",
        "nativeSkills": "auto",
        "restart": true,
        "ownerDisplay": "raw"
    },
    "channels": {
        "zalouser": {
            "enabled": true,
            "dmPolicy": "open",
            "groupPolicy": "open",
            "allowFrom": ["*"],
            "groups": { "*": { "requireMention": true } }
        },
        "whatsapp": {
            "enabled": true,
            "dmPolicy": "open",
            "groupPolicy": "open",
            "allowFrom": ["*"],
            "debounceMs": 0,
            "mediaMaxMb": 50
        },
        "zalo": {
            "enabled": true,
            "dmPolicy": "open",
            "groupPolicy": "open",
            "allowFrom": ["*"]
        }
    },
    "gateway": {
        "mode": "local",
        "port": ${PORT},
        "bind": "lan",
        "auth": {
            "mode": "token",
            "token": "${GATEWAY_TOKEN}"
        },
        "controlUi": {
            "dangerouslyAllowHostHeaderOriginFallback": true,
            "dangerouslyDisableDeviceAuth": true
        }
    },
    "plugins": {
        "enabled": true,
        "allow": [ $(build_plugins_allow) ],
        "entries": {
            "zalouser": { "enabled": true, "config": {} },
            "zalo":     { "enabled": true, "config": {} },
            "whatsapp": { "enabled": true, "config": {} },
            "deepseek": { "enabled": true, "config": {} },
            "groq":     { "enabled": true, "config": {} },
            "openai":   { "enabled": false,"config": {} }${NVIDIA_ENTRY}
        }
    },
    "session": {
        "reset": { "mode": "idle", "idleMinutes": 5 },
        "maintenance": { "pruneAfter": "12h", "maxEntries": 6 }
    },
    "messages": {
        "groupChat": { "visibleReplies": "automatic" }
    }
}
JSON

log_ok "openclaw.json đã tạo tại $OC_DIR/openclaw.json"

# ── Tạo start script ──────────────────────────────────────────
cat > "$INSTALL_DIR/start-gateway.sh" <<'SH'
#!/usr/bin/env bash
cd "$(dirname "$0")"
rm -f /tmp/openclaw/*.lock 2>/dev/null || true
node openclaw.mjs gateway --allow-unconfigured
SH
chmod +x "$INSTALL_DIR/start-gateway.sh"
log_ok "start-gateway.sh đã tạo"

# ── systemd service (nếu có systemd) ─────────────────────────
if [[ -z "$NO_AUTOSTART" ]]; then
  log_head "Auto-start"

  if command -v systemctl &>/dev/null && [[ -d /etc/systemd/system ]]; then
    # Lấy đường dẫn node
    NODE_BIN="$(command -v node)"

    cat > /tmp/openclaw-gateway.service <<UNIT
[Unit]
Description=OpenClaw Gateway
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${INSTALL_DIR}
ExecStartPre=/bin/bash -c 'rm -f /tmp/openclaw/*.lock'
ExecStart=${NODE_BIN} openclaw.mjs gateway --allow-unconfigured
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw

[Install]
WantedBy=multi-user.target
UNIT

    if [[ $IS_ROOT -eq 1 ]]; then
      cp /tmp/openclaw-gateway.service /etc/systemd/system/openclaw-gateway.service
      systemctl daemon-reload
      systemctl enable openclaw-gateway
      systemctl restart openclaw-gateway
      log_ok "systemd service 'openclaw-gateway' đã đăng ký & khởi động"
    else
      # User-level systemd
      SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
      mkdir -p "$SYSTEMD_USER_DIR"
      sed "s|WantedBy=multi-user.target|WantedBy=default.target|" \
        /tmp/openclaw-gateway.service > "$SYSTEMD_USER_DIR/openclaw-gateway.service"
      systemctl --user daemon-reload
      systemctl --user enable openclaw-gateway
      systemctl --user restart openclaw-gateway
      loginctl enable-linger "$USER" 2>/dev/null || true
      log_ok "systemd user service đã đăng ký & khởi động"
    fi

  else
    log_info "systemd không có — dùng nohup..."
    NO_AUTOSTART=""  # fall through to manual start below
  fi
fi

# ── Khởi động gateway ─────────────────────────────────────────
log_head "Khởi động Gateway"

# Kiểm tra xem systemd đã khởi động chưa
GATEWAY_STARTED=0
if command -v systemctl &>/dev/null; then
  if systemctl --user is-active openclaw-gateway &>/dev/null 2>&1 || \
     systemctl    is-active openclaw-gateway &>/dev/null 2>&1; then
    GATEWAY_STARTED=1
    log_ok "Gateway đang chạy qua systemd"
  fi
fi

if [[ $GATEWAY_STARTED -eq 0 ]]; then
  # Kill port cũ nếu có
  if command -v fuser &>/dev/null; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
  elif command -v lsof &>/dev/null; then
    OLD_PID="$(lsof -ti:"$PORT" 2>/dev/null || true)"
    [[ -n "$OLD_PID" ]] && kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  sleep 1

  mkdir -p /tmp/openclaw
  GW_LOG="/tmp/openclaw-gw.log"

  nohup bash "$INSTALL_DIR/start-gateway.sh" > "$GW_LOG" 2>&1 &
  GW_PID=$!
  log_info "Gateway khởi động (PID $GW_PID) — đợi..."

  READY=0
  for i in $(seq 1 20); do
    sleep 1
    if grep -qE "ready|listening" "$GW_LOG" 2>/dev/null; then
      READY=1; break
    fi
  done

  if [[ $READY -eq 1 ]]; then
    log_ok "Gateway sẵn sàng (PID $GW_PID)"
  else
    log_warn "Gateway chưa xác nhận sau 20s (đang build UI lần đầu?)"
    log_info "Xem log: $GW_LOG"
  fi
fi

# ── Lấy IP ────────────────────────────────────────────────────
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || \
            ip route get 1 2>/dev/null | awk '{print $7; exit}' || \
            echo "YOUR_IP")"

# ── Done ──────────────────────────────────────────────────────
echo -e "
${C_OK}╔══════════════════════════════════════════════════════════╗
║         ✅  Cài đặt hoàn thành!                          ║
╚══════════════════════════════════════════════════════════╝${C_NC}

${C_INFO}  Truy cập bảng điều khiển:${C_NC}
  http://${LOCAL_IP}:${PORT}/#token=${GATEWAY_TOKEN}

${C_DIM}  Thư mục cài đặt : $INSTALL_DIR
  Config OpenClaw  : $OC_DIR/openclaw.json
  Log gateway      : /tmp/openclaw-gw.log
  Khởi động thủ công: bash $INSTALL_DIR/start-gateway.sh${C_NC}

${C_WARN}  Nếu dùng firewall:${C_NC}
  ${C_DIM}# Ubuntu/Debian:
  ufw allow ${PORT}/tcp
  # CentOS/RHEL:
  firewall-cmd --permanent --add-port=${PORT}/tcp && firewall-cmd --reload${C_NC}
"
