$ErrorActionPreference = "Stop"

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $nodePath = $nodeCommand.Source
} else {
    $bundledNode = "C:\Users\yang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if (-not (Test-Path -LiteralPath $bundledNode)) {
        throw "未找到 Node.js。请安装 Node.js 22.5 或更高版本。"
    }
    $nodePath = $bundledNode
}

$securePassword = Read-Host "请设置创建者管理密码" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

if ([string]::IsNullOrWhiteSpace($plainPassword) -or $plainPassword.Length -lt 8) {
    throw "管理密码至少需要 8 个字符。"
}

$secretBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)

$env:ADMIN_PASSWORD = $plainPassword
$env:SESSION_SECRET = [Convert]::ToBase64String($secretBytes)
$env:PORT = "3000"
$env:NODE_ENV = "development"

Set-Location -LiteralPath $PSScriptRoot
Write-Host ""
Write-Host "新生百科网站即将启动：http://localhost:3000" -ForegroundColor Cyan
Write-Host "关闭此窗口或按 Ctrl+C 可停止网站。" -ForegroundColor DarkGray
Write-Host ""

Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
    "-NoProfile",
    "-Command",
    "Start-Sleep -Milliseconds 900; Start-Process 'http://localhost:3000'"
)
& $nodePath "server.js"

if ($LASTEXITCODE -ne 0) {
    throw "网站启动失败。请检查 3000 端口是否已被占用。"
}
