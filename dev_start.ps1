#Requires -Version 7
<#
.SYNOPSIS
    一键启动金番写作 (jfxz) 前后端开发环境
.DESCRIPTION
    同时启动后端 (FastAPI/Uvicorn) 和前端 (Next.js)，日志输出到 logs/ 目录。
    按 Ctrl+C 或关闭窗口即可停止对应服务。
#>

$ProjectRoot = "C:\Projects\jfxz"
$LogDir = Join-Path $ProjectRoot "logs"
$null = New-Item -ItemType Directory -Force -Path $LogDir

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackendLog = Join-Path $LogDir "backend-$timestamp.log"
$FrontendLog = Join-Path $LogDir "frontend-$timestamp.log"

# Start backend
Write-Host "=== Launching backend (FastAPI) ===" -ForegroundColor Green
$backendJob = Start-Process powershell -WindowStyle Normal -PassThru -ArgumentList @(
    "-NoExit"
    "-Command"
    "cd '$ProjectRoot/backend'; uv sync --frozen 2>&1 | Out-Null; uv run uvicorn app.main:app --reload --port 8000 2>&1 | Tee-Object -FilePath '$BackendLog'"
)
Write-Host "  Backend PID: $($backendJob.Id)  ->  $BackendLog" -ForegroundColor Cyan

# Start frontend
Write-Host "=== Launching frontend (Next.js) ===" -ForegroundColor Green
$frontendJob = Start-Process powershell -WindowStyle Normal -PassThru -ArgumentList @(
    "-NoExit"
    "-Command"
    "cd '$ProjectRoot/frontend'; npm run dev 2>&1 | Tee-Object -FilePath '$FrontendLog'"
)
Write-Host "  Frontend PID: $($frontendJob.Id)  ->  $FrontendLog" -ForegroundColor Cyan

Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  Backend  : http://localhost:8000" -ForegroundColor Yellow
Write-Host "  Frontend : http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Logs dir : $LogDir" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Close the service windows or press Ctrl+C to stop." -ForegroundColor Gray
