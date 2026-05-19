# ============================================================
#  OpenClaw VPS Installer — Full Setup
#  Repo: https://github.com/NguyenKhacDanh/openclaw-1
#
#  Cách dùng:
#    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
#    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/NguyenKhacDanh/openclaw-1/main/scripts/install-full-vps.ps1" -OutFile "D:\install.ps1" -UseBasicParsing
#    powershell -ExecutionPolicy Bypass -File D:\install.ps1
#
#  Sau khi cài xong: http://YOUR_IP:19001/#token=80130a3a631f966a38d943e7ba21cebc2c2c6f46911b5a7b
# ============================================================

param(
    [string]$InstallDir      = "D:\OpenClaw",
    [string]$GatewayToken   = "80130a3a631f966a38d943e7ba21cebc2c2c6f46911b5a7b",
    [int]   $Port            = 19001,
    [string]$DeepSeekApiKey  = "",
    [string]$NvidiaApiKey    = "",
    [string]$GroqApiKey      = "",
    [switch]$NoAutoStart,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

# ── Colors ───────────────────────────────────────────────────
$C_OK   = "`e[92m"   # green
$C_WARN = "`e[93m"   # yellow
$C_ERR  = "`e[91m"   # red
$C_INFO = "`e[96m"   # cyan
$C_DIM  = "`e[90m"   # gray
$C_NC   = "`e[0m"

function Log-Ok($msg)   { Microsoft.PowerShell.Utility\Write-Host "${C_OK}  ✓${C_NC} $msg" }
function Log-Info($msg) { Microsoft.PowerShell.Utility\Write-Host "${C_INFO}  ·${C_NC} $msg" }
function Log-Warn($msg) { Microsoft.PowerShell.Utility\Write-Host "${C_WARN}  !${C_NC} $msg" }
function Log-Err($msg)  { Microsoft.PowerShell.Utility\Write-Host "${C_ERR}  ✗${C_NC} $msg" }
function Log-Head($msg) { Microsoft.PowerShell.Utility\Write-Host "`n${C_INFO}══ $msg ══${C_NC}" }

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ── Banner ───────────────────────────────────────────────────
Clear-Host
Microsoft.PowerShell.Utility\Write-Host @"
${C_INFO}
  ╔═══════════════════════════════════════════╗
  ║       🦞  OpenClaw VPS Installer          ║
  ║   Auto-setup: Node · Build · Gateway      ║
  ╚═══════════════════════════════════════════╝
${C_NC}
"@

# ── Collect API keys if not passed ───────────────────────────
Log-Head "Cấu hình API Keys"

if (-not $DeepSeekApiKey) {
    Microsoft.PowerShell.Utility\Write-Host "  DeepSeek API Key ${C_DIM}(bắt buộc — platform.deepseek.com)${C_NC}: " -NoNewline
    $DeepSeekApiKey = (Read-Host -AsSecureString | ForEach-Object { [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)) }).Trim()
}
if (-not $DeepSeekApiKey) {
    Log-Err "DeepSeek API Key là bắt buộc. Thoát."
    exit 1
}

if (-not $NvidiaApiKey) {
    Microsoft.PowerShell.Utility\Write-Host "  NVIDIA NIM API Key ${C_DIM}(tuỳ chọn — build.nvidia.com, Enter bỏ qua)${C_NC}: " -NoNewline
    $NvidiaApiKey = (Read-Host).Trim()
}

if (-not $GroqApiKey) {
    Microsoft.PowerShell.Utility\Write-Host "  Groq API Key ${C_DIM}(tuỳ chọn — console.groq.com, Enter bỏ qua)${C_NC}: " -NoNewline
    $GroqApiKey = (Read-Host).Trim()
}

Log-Ok "API keys đã nhập"

# ── Check Admin ───────────────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Log-Warn "Không chạy với quyền Admin — một số bước (winget, service) có thể bị bỏ qua"
}

# ── Cài Node.js ──────────────────────────────────────────────
Log-Head "Node.js"

function Get-NodeMajor {
    try {
        $v = node --version 2>$null
        if ($v -match '^v(\d+)') { return [int]$Matches[1] }
    } catch {}
    return 0
}

$nodeMajor = Get-NodeMajor
if ($nodeMajor -ge 22) {
    Log-Ok "Node.js v$((node --version 2>$null)) đã có"
} else {
    $nodeDesc = if ($nodeMajor -gt 0) { "v$nodeMajor (cần v22+)" } else { "chưa cài" }
    Log-Info "Node.js $nodeDesc — đang cài..."

    $nodeInstalled = $false

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Log-Info "  Dùng winget..."
        try {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
            Refresh-Path
            if ((Get-NodeMajor) -ge 22) { $nodeInstalled = $true; Log-Ok "  Node.js cài xong (winget)" }
        } catch {}
    }

    if (-not $nodeInstalled -and (Get-Command choco -ErrorAction SilentlyContinue)) {
        Log-Info "  Dùng chocolatey..."
        try {
            choco install nodejs-lts -y --no-progress 2>&1 | Out-Null
            Refresh-Path
            if ((Get-NodeMajor) -ge 22) { $nodeInstalled = $true; Log-Ok "  Node.js cài xong (choco)" }
        } catch {}
    }

    if (-not $nodeInstalled) {
        # Download installer trực tiếp
        Log-Info "  Tải Node.js installer..."
        $nodeUrl  = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
        $nodeMsi  = "$env:TEMP\node-install.msi"
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /quiet /norestart ADDLOCAL=ALL" -Wait
            Refresh-Path
            if ((Get-NodeMajor) -ge 22) { $nodeInstalled = $true; Log-Ok "  Node.js cài xong (MSI)" }
        } catch {
            Log-Err "  Tải MSI thất bại: $_"
        }
    }

    if (-not $nodeInstalled) {
        Log-Err "Không cài được Node.js tự động."
        Log-Info "Hãy cài thủ công từ https://nodejs.org (v22+) rồi chạy lại script."
        exit 1
    }
}

# ── Cài Git ──────────────────────────────────────────────────
Log-Head "Git"

if (Get-Command git -ErrorAction SilentlyContinue) {
    Log-Ok "$(git --version 2>$null) đã có"
} else {
    Log-Info "Git chưa cài — đang cài..."
    $gitInstalled = $false

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            winget install Git.Git --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
            Refresh-Path
            if (Get-Command git -ErrorAction SilentlyContinue) { $gitInstalled = $true; Log-Ok "  Git cài xong (winget)" }
        } catch {}
    }

    if (-not $gitInstalled) {
        $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe"
        $gitExe = "$env:TEMP\git-install.exe"
        try {
            Invoke-WebRequest -Uri $gitUrl -OutFile $gitExe -UseBasicParsing
            Start-Process $gitExe -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Wait
            Refresh-Path
            if (Get-Command git -ErrorAction SilentlyContinue) { $gitInstalled = $true; Log-Ok "  Git cài xong (installer)" }
        } catch {
            Log-Err "  Tải Git thất bại: $_"
        }
    }

    if (-not $gitInstalled) {
        Log-Err "Không cài được Git. Cài thủ công từ https://git-scm.com"
        exit 1
    }
}

# ── Clone / Update repo ───────────────────────────────────────
Log-Head "Source Code"

$REPO_URL = "https://github.com/NguyenKhacDanh/openclaw-1.git"

if (Test-Path "$InstallDir\.git") {
    Log-Info "Repo đã có — đang pull mới nhất..."
    git -C $InstallDir pull --rebase 2>&1 | ForEach-Object { Log-Info "  $_" }
    Log-Ok "Repo đã cập nhật"
} else {
    Log-Info "Đang clone về $InstallDir ..."
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    git clone $REPO_URL $InstallDir 2>&1 | ForEach-Object { Log-Info "  $_" }
    Log-Ok "Clone xong"
}

Set-Location $InstallDir

# ── npm install ───────────────────────────────────────────────
Log-Head "Cài dependencies (root)"
Log-Info "npm install (có thể mất 2-5 phút lần đầu)..."
node --version | Out-Null  # ensure node in path
npm install --prefer-offline --no-fund --no-audit 2>&1 | ForEach-Object {
    if ($_ -match "^(added|updated|warn|error)" ) { Log-Info "  $_" }
}
Log-Ok "npm install xong"

# ── Build backend ─────────────────────────────────────────────
if (-not $SkipBuild) {
    Log-Head "Build Backend"
    Log-Info "node scripts/tsdown-build.mjs ..."
    node scripts/tsdown-build.mjs
    if ($LASTEXITCODE -ne 0) { Log-Err "Build backend thất bại"; exit 1 }
    Log-Ok "Backend đã build"

    # ── npm install UI ─────────────────────────────────────────
    Log-Head "Cài dependencies UI"
    Set-Location "$InstallDir\ui"
    npm install --prefer-offline --no-fund --no-audit 2>&1 | ForEach-Object {
        if ($_ -match "^(added|updated|warn|error)") { Log-Info "  $_" }
    }
    Log-Ok "UI deps xong"

    # ── Build UI ───────────────────────────────────────────────
    Log-Head "Build UI"
    Log-Info "npx vite build ..."
    npx vite build 2>&1 | ForEach-Object { Log-Info "  $_" }
    if ($LASTEXITCODE -ne 0) { Log-Err "Build UI thất bại"; exit 1 }
    Log-Ok "UI đã build"

    Set-Location $InstallDir
}

# ── Tạo thư mục ~/.openclaw ───────────────────────────────────
Log-Head "Cấu hình OpenClaw"

$ocDir = "$env:USERPROFILE\.openclaw"
$extDir = "$ocDir\extensions"
New-Item -ItemType Directory -Path $ocDir                    -Force | Out-Null
New-Item -ItemType Directory -Path $extDir                   -Force | Out-Null
New-Item -ItemType Directory -Path "$ocDir\knowledgebase"    -Force | Out-Null
New-Item -ItemType Directory -Path "$ocDir\workspace"        -Force | Out-Null

# ── Ghi .env ─────────────────────────────────────────────────
$envLines = @(
    "# OpenClaw - API Keys"
    "# Sinh tự động bởi install-full-vps.ps1"
    ""
    "# DeepSeek (primary model)"
    "DEEPSEEK_API_KEY=$DeepSeekApiKey"
    ""
)
if ($NvidiaApiKey) {
    $envLines += "# NVIDIA NIM (free)"
    $envLines += "NVIDIA_API_KEY=$NvidiaApiKey"
    $envLines += ""
}
if ($GroqApiKey) {
    $envLines += "# Groq (fast inference)"
    $envLines += "GROQ_API_KEY=$GroqApiKey"
    $envLines += ""
}
$envLines += "# Gateway auth token"
$envLines += "OPENCLAW_GATEWAY_TOKEN=$GatewayToken"

$envLines | Out-File -FilePath "$ocDir\.env" -Encoding utf8 -Force
Log-Ok ".env đã tạo tại $ocDir\.env"

# ── Ghi openclaw.json ─────────────────────────────────────────
$pluginsAllow = @('"zalouser"', '"zalo"', '"whatsapp"', '"deepseek"', '"groq"')
if ($NvidiaApiKey) { $pluginsAllow += '"nvidia"' }

$fallbacks = @('"deepseek/deepseek-chat"', '"groq/llama-3.3-70b-versatile"', '"groq/llama-3.1-8b-instant"')
if ($NvidiaApiKey) { $fallbacks += '"nvidia/meta/llama-3.3-70b-instruct"' }

$allowJson    = $pluginsAllow -join ", "
$fallbackJson = $fallbacks    -join ", "

# Build plugins.entries JSON
$pluginEntries = @(
    '"zalouser": { "enabled": true, "config": {} }'
    '"zalo":     { "enabled": true, "config": {} }'
    '"whatsapp": { "enabled": true, "config": {} }'
    '"deepseek": { "enabled": true, "config": {} }'
    '"groq":     { "enabled": true, "config": {} }'
    '"openai":   { "enabled": false,"config": {} }'
)
if ($NvidiaApiKey) { $pluginEntries += '"nvidia": { "enabled": true, "config": {} }' }
$entriesJson = $pluginEntries -join ",`n                    "

$ocJson = @"
{
    "meta": {
        "lastTouchedVersion": "2026.5.6",
        "lastTouchedAt": "$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')"
    },
    "agents": {
        "defaults": {
            "model": {
                "primary": "deepseek/deepseek-v4-flash",
                "fallbacks": [ $fallbackJson ]
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
        "port": $Port,
        "bind": "lan",
        "auth": {
            "mode": "token",
            "token": "$GatewayToken"
        },
        "controlUi": {
            "dangerouslyAllowHostHeaderOriginFallback": true,
            "dangerouslyDisableDeviceAuth": true
        }
    },
    "plugins": {
        "enabled": true,
        "allow": [ $allowJson ],
        "entries": {
                    $entriesJson
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
"@

$ocJson | Out-File -FilePath "$ocDir\openclaw.json" -Encoding utf8 -Force
Log-Ok "openclaw.json đã tạo tại $ocDir\openclaw.json"

# ── Tạo start script ──────────────────────────────────────────
$startScript = @"
@echo off
cd /d "$InstallDir"
:: Xoá lock cũ nếu có
del /q "%TEMP%\openclaw\*.lock" 2>nul
node openclaw.mjs gateway --allow-unconfigured
"@
$startScript | Out-File -FilePath "$InstallDir\start-gateway.cmd" -Encoding ASCII -Force

$startPs1 = @"
Set-Location '$InstallDir'
Remove-Item -Force "`$env:TEMP\openclaw\*.lock" -ErrorAction SilentlyContinue
node openclaw.mjs gateway --allow-unconfigured
"@
$startPs1 | Out-File -FilePath "$InstallDir\start-gateway.ps1" -Encoding utf8 -Force
Log-Ok "start-gateway.cmd / start-gateway.ps1 đã tạo"

# ── Đăng ký Task Scheduler (auto-start khi đăng nhập) ────────
if (-not $NoAutoStart) {
    Log-Head "Auto-start (Task Scheduler)"
    try {
        $taskName   = "OpenClaw-Gateway"
        $action     = New-ScheduledTaskAction -Execute "node" -Argument "openclaw.mjs gateway --allow-unconfigured" -WorkingDirectory $InstallDir
        $trigger    = New-ScheduledTaskTrigger -AtLogOn
        $settings   = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
        $principal  = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

        # Xoá task cũ nếu có
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Log-Ok "Task '$taskName' đã đăng ký — gateway tự khởi động khi đăng nhập"
    } catch {
        Log-Warn "Không đăng ký được Task Scheduler (cần Admin): $_"
        Log-Info "Chạy thủ công: $InstallDir\start-gateway.cmd"
    }
}

# ── Lấy IP để hiển thị URL ────────────────────────────────────
$localIP = try {
    (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notmatch '^127\.' -and $_.IPAddress -notmatch '^169\.254\.'
    } | Select-Object -First 1).IPAddress
} catch { "YOUR_IP" }

# ── Khởi động gateway ngay bây giờ ───────────────────────────
Log-Head "Khởi động Gateway"

# Kill gateway cũ nếu đang chạy trên port này
$portPid = try {
    (netstat -ano | Select-String ":$Port\s" | Select-Object -First 1) -replace '.+\s(\d+)$','$1'
} catch { $null }
if ($portPid -and $portPid -match '^\d+$') {
    Log-Info "Port $Port đang bị dùng (PID $portPid) — kill..."
    Stop-Process -Id ([int]$portPid) -Force -ErrorAction SilentlyContinue
    Start-Sleep 2
}

Remove-Item -Force "$env:TEMP\openclaw\*.lock" -ErrorAction SilentlyContinue

Set-Location $InstallDir
$gwProc = Start-Process -FilePath "node" -ArgumentList "openclaw.mjs gateway --allow-unconfigured" `
    -WorkingDirectory $InstallDir `
    -RedirectStandardOutput "$env:TEMP\openclaw-gw.log" `
    -RedirectStandardError  "$env:TEMP\openclaw-gw-err.log" `
    -PassThru

Log-Info "Chờ gateway khởi động..."
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep 1
    if (Test-Path "$env:TEMP\openclaw-gw.log") {
        $log = Get-Content "$env:TEMP\openclaw-gw.log" -Raw -ErrorAction SilentlyContinue
        if ($log -match "ready|listening") { $ready = $true; break }
    }
}

if ($ready) {
    Log-Ok "Gateway đã sẵn sàng (PID $($gwProc.Id))"
} else {
    Log-Warn "Gateway chưa xác nhận sẵn sàng sau 20s — có thể đang build UI lần đầu"
    Log-Info "Xem log: $env:TEMP\openclaw-gw.log"
}

# ── Done ──────────────────────────────────────────────────────
Microsoft.PowerShell.Utility\Write-Host @"

${C_OK}╔══════════════════════════════════════════════════════════╗
║         ✅  Cài đặt hoàn thành!                          ║
╚══════════════════════════════════════════════════════════╝${C_NC}

${C_INFO}  Truy cập bảng điều khiển:${C_NC}
  http://${localIP}:${Port}/#token=${GatewayToken}

${C_DIM}  Thư mục cài đặt : $InstallDir
  Config OpenClaw  : $ocDir\openclaw.json
  Log gateway      : $env:TEMP\openclaw-gw.log
  Khởi động thủ công: $InstallDir\start-gateway.cmd${C_NC}

${C_WARN}  Lưu ý:${C_NC} Mở firewall port $Port nếu truy cập từ ngoài:
  ${C_DIM}netsh advfirewall firewall add rule name="OpenClaw" dir=in action=allow protocol=TCP localport=$Port${C_NC}

"@
