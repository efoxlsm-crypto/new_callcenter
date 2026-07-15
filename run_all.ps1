# 백엔드(API)와 프론트엔드(화면)를 각각 새 PowerShell 창으로 띄웁니다.
# 사용법: 이 폴더(ai-callcenter)에서 PowerShell을 열고 다음을 실행하세요.
#   .\run_all.ps1

$root = $PSScriptRoot

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$root'; Write-Host '=== 백엔드(API) 서버 - 이 창은 닫지 마세요 ===' -ForegroundColor Cyan; uvicorn backend.main:app --reload --port 8000"
)

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$root\web'; Write-Host '=== 프론트엔드(화면) 서버 - 이 창은 닫지 마세요 ===' -ForegroundColor Cyan; npm run dev"
)

Write-Host "두 개의 새 창이 열렸습니다. 잠시 후 브라우저에서 http://localhost:3000 을 열어주세요." -ForegroundColor Green
