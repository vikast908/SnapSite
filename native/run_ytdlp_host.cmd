@echo off
setlocal
set SCRIPT_DIR=%~dp0
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Node.js is required to run the GetInspire yt-dlp host.
  echo Install from https://nodejs.org/ and ensure `node` is in PATH.
  exit /b 1
)
node "%SCRIPT_DIR%ytdlp_host.js"
