$ErrorActionPreference = 'Stop'

param(
  [Parameter(Mandatory=$true, HelpMessage='Find the extension ID at chrome://extensions (Developer mode)')]
  [string]$ExtensionId,
  [switch]$AlsoEdge
)

if ($ExtensionId -notmatch '^[a-p]{32}$') {
  Write-Error "ExtensionId looks invalid: $ExtensionId. Open chrome://extensions and copy the 32-char ID for GetInspire."; exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$hostName = 'com.getinspire.ytdlp'
$runner = (Resolve-Path (Join-Path $root 'run_ytdlp_host.cmd')).Path
$manifestPath = (Join-Path $root ($hostName + '.json'))

$manifestObj = @{
  name = $hostName
  description = 'GetInspire yt-dlp Native Messaging Host'
  path = $runner
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifestJson = $manifestObj | ConvertTo-Json -Depth 5
Set-Content -Path $manifestPath -Value $manifestJson -Encoding UTF8

# Register in Chrome (HKCU)
$regKeyChrome = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\' + $hostName
if (-not (Test-Path $regKeyChrome)) { New-Item -Path $regKeyChrome -Force | Out-Null }
Set-ItemProperty -Path $regKeyChrome -Name '(Default)' -Value $manifestPath -Force

if ($AlsoEdge) {
  $regKeyEdge = 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\' + $hostName
  if (-not (Test-Path $regKeyEdge)) { New-Item -Path $regKeyEdge -Force | Out-Null }
  Set-ItemProperty -Path $regKeyEdge -Name '(Default)' -Value $manifestPath -Force
}

# Basic env checks
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Warning 'Node.js not found in PATH. Install from https://nodejs.org/'
}
if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  Write-Warning 'yt-dlp not found in PATH. Install from https://github.com/yt-dlp/yt-dlp/releases'
}

Write-Host "Installed Native Messaging manifest:" -ForegroundColor Green
Write-Host "  $manifestPath" -ForegroundColor Green
Write-Host "Registered under:" -ForegroundColor Green
Write-Host "  $regKeyChrome" -ForegroundColor Green
if ($AlsoEdge) { Write-Host "  $regKeyEdge" -ForegroundColor Green }
Write-Host 'Reload the extension at chrome://extensions and try the yt-dlp download again.' -ForegroundColor Yellow
